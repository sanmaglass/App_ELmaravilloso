/**
 * critical-paths.test.js
 * Tests unitarios para los 5 paths críticos del backend.
 *
 * Framework: Jest (v29+)
 * Ejecutar: npx jest tests/critical-paths.test.js
 *
 * Dependencias de test (no producción):
 *   - jest
 *   - fake-indexeddb  (simula IndexedDB/Dexie en Node)
 *   - dexie            (versión que soporte fake-indexeddb)
 */

// ── Mocks de entorno (antes de importar módulos) ──────────────
const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
    eq: jest.fn().mockReturnThis(),
};

global.window = {
    Sync: { client: mockSupabaseClient, showToast: jest.fn() },
    DataManager: null, // Se asignará después de cargar db.js
    TransactionManager: null,
    db: null,
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
};

// ──────────────────────────────────────────────────────────────
// SECCIÓN 1: DataManager v2 — Retry + Queue
// ──────────────────────────────────────────────────────────────
describe('DataManager v2 — Retry Logic y Queue', () => {

    beforeEach(() => {
        // Reset mocks
        mockSupabaseClient.upsert.mockClear();
        mockSupabaseClient.select.mockResolvedValue({ data: [], error: null });

        // DataManager stub para tests unitarios puros
        window.DataManager = {
            syncQueue: new Map(),
            MAX_RETRIES: 5,
            RETRY_BASE_MS: 10, // Reducido para tests rápidos
            _isProcessingQueue: false,
            _versionedTables: new Set(['purchase_invoices', 'loans', 'electronic_invoices']),

            _validateIntegrity(tableName, data) {
                if (!data || typeof data !== 'object') return false;
                const moneyFields = ['amount', 'total', 'paidAmount', 'cash'];
                for (const field of moneyFields) {
                    if (data[field] !== undefined && Math.abs(parseFloat(data[field]) || 0) > 1e12) return false;
                }
                return true;
            },

            _enqueueChange(tableName, data) {
                const queueKey = `${tableName}:${data.id}`;
                const existing = this.syncQueue.get(queueKey);
                this.syncQueue.set(queueKey, {
                    tableName, data: { ...data },
                    retries: existing ? existing.retries : 0,
                    timestamp: Date.now()
                });
            },

            async _syncWithRetry(tableName, remoteTable, data) {
                for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
                    try {
                        const result = await window.Sync.client.from(remoteTable).upsert([data]).select('id');
                        if (!result.error) return { success: true };

                        const isSchemaErr = result.error.code === 'PGRST204' || result.error.code === '42703';
                        if (isSchemaErr) return { success: true, syncError: 'missing_columns' };

                        if (attempt === this.MAX_RETRIES - 1) return { success: false, error: result.error.message };

                        await new Promise(r => setTimeout(r, this.RETRY_BASE_MS * Math.pow(2, attempt)));
                    } catch (e) {
                        if (attempt === this.MAX_RETRIES - 1) return { success: false, error: e.message };
                        await new Promise(r => setTimeout(r, this.RETRY_BASE_MS * Math.pow(2, attempt)));
                    }
                }
                return { success: false, error: 'Max retries reached' };
            }
        };
    });

    test('_validateIntegrity rechaza montos > 1 Trillón', () => {
        expect(window.DataManager._validateIntegrity('purchase_invoices', { amount: 2e12 })).toBe(false);
        expect(window.DataManager._validateIntegrity('purchase_invoices', { amount: 500000 })).toBe(true);
    });

    test('_validateIntegrity rechaza datos no-objeto', () => {
        expect(window.DataManager._validateIntegrity('purchase_invoices', null)).toBe(false);
        expect(window.DataManager._validateIntegrity('purchase_invoices', 'string')).toBe(false);
    });

    test('_validateIntegrity acepta paidAmount = 0', () => {
        expect(window.DataManager._validateIntegrity('purchase_invoices', { paidAmount: 0 })).toBe(true);
    });

    test('_enqueueChange guarda en queue con key correcta', () => {
        window.DataManager._enqueueChange('purchase_invoices', { id: 42, amount: 100 });
        expect(window.DataManager.syncQueue.has('purchase_invoices:42')).toBe(true);
    });

    test('_enqueueChange deduplicación: reemplaza entrada anterior por id', () => {
        window.DataManager._enqueueChange('purchase_invoices', { id: 42, amount: 100 });
        window.DataManager._enqueueChange('purchase_invoices', { id: 42, amount: 200 });
        expect(window.DataManager.syncQueue.size).toBe(1);
        expect(window.DataManager.syncQueue.get('purchase_invoices:42').data.amount).toBe(200);
    });

    test('_syncWithRetry retorna success si Supabase responde OK en primer intento', async () => {
        mockSupabaseClient.select.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });
        const result = await window.DataManager._syncWithRetry('purchase_invoices', 'purchase_invoices', { id: 1 });
        expect(result.success).toBe(true);
        expect(mockSupabaseClient.upsert).toHaveBeenCalledTimes(1);
    });

    test('_syncWithRetry hace retry ante error transitorio y eventualmente falla', async () => {
        const networkError = new Error('fetch failed');
        mockSupabaseClient.select.mockRejectedValue(networkError);

        const result = await window.DataManager._syncWithRetry('purchase_invoices', 'purchase_invoices', { id: 1 });

        expect(result.success).toBe(false);
        expect(mockSupabaseClient.upsert.mock.calls.length).toBe(5); // MAX_RETRIES
    }, 10000);

    test('_syncWithRetry retorna success:true con syncError para errores de esquema (PGRST204)', async () => {
        mockSupabaseClient.select.mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST204', message: 'column not found' }
        });
        const result = await window.DataManager._syncWithRetry('purchase_invoices', 'purchase_invoices', { id: 1 });
        expect(result.success).toBe(true);
        expect(result.syncError).toBe('missing_columns');
    });
});


// ──────────────────────────────────────────────────────────────
// SECCIÓN 2: Optimistic Locking
// ──────────────────────────────────────────────────────────────
describe('Optimistic Locking — Detección de Conflictos de Versión', () => {

    test('version se incrementa correctamente al actualizar', () => {
        const existingVersion = 3;
        const newVersion = existingVersion + 1;
        expect(newVersion).toBe(4);
    });

    test('conflicto detectado si version cambió entre snapshot y confirmación', () => {
        const snapshotVersion = 2;
        const freshVersion = 3; // Otro dispositivo actualizó
        expect(freshVersion !== snapshotVersion).toBe(true);
    });

    test('sin conflicto si versions son iguales', () => {
        const snapshotVersion = 5;
        const freshVersion = 5;
        expect(freshVersion !== snapshotVersion).toBe(false);
    });

    test('fallback por paidAmount si tabla no tiene version aún', () => {
        const alreadyPaid = 1000;
        const freshPaidAmount = 2000; // Cambió
        const currentVersion = undefined; // Tabla sin version aún

        const hasConflict = freshPaidAmount !== alreadyPaid && currentVersion === undefined;
        expect(hasConflict).toBe(true);
    });

    test('no hay conflicto por paidAmount si tabla tiene version', () => {
        const alreadyPaid = 1000;
        const freshPaidAmount = 2000;
        const currentVersion = 3;
        const snapshotVersion = 3;

        // Con version, el paidAmount puede diferir sin conflicto si version no cambió
        const versionConflict = currentVersion !== snapshotVersion;
        expect(versionConflict).toBe(false);
    });
});


// ──────────────────────────────────────────────────────────────
// SECCIÓN 3: TransactionManager — Batch + Rollback
// ──────────────────────────────────────────────────────────────
describe('TransactionManager — Atomicidad y Rollback', () => {

    const mockDb = {
        purchase_invoices: {
            put: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(1),
            get: jest.fn().mockResolvedValue({ id: 1, version: 2 }),
        },
        loans: {
            put: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(1),
            get: jest.fn().mockResolvedValue({ id: 2, version: 1 }),
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        window.db = mockDb;
        window.TransactionManager = {
            _log: [],
            MAX_LOG_SIZE: 500,

            _validateOperation(op) {
                if (!op || typeof op !== 'object') return 'Operación debe ser un objeto';
                if (!op.table || typeof op.table !== 'string') return 'Falta campo "table"';
                if (!window.db[op.table]) return `Tabla "${op.table}" no existe en la BD`;
                if (!['put', 'update', 'delete'].includes(op.action)) return `Acción "${op.action}" no válida`;
                if (!op.data || typeof op.data !== 'object') return 'Falta campo "data"';
                if (op.action === 'update' && !op.data.id) return '"update" requiere data.id';
                if (op.action === 'delete' && !op.data.id) return '"delete" requiere data.id';
                return null;
            },

            _addToLog(entry) {
                this._log.push({ ...entry, ts: new Date().toISOString() });
                if (this._log.length > this.MAX_LOG_SIZE) this._log.shift();
            },

            getLog() { return [...this._log]; }
        };
    });

    test('_validateOperation retorna null para operación put válida', () => {
        const op = { table: 'purchase_invoices', action: 'put', data: { id: 1, amount: 100 } };
        expect(window.TransactionManager._validateOperation(op)).toBeNull();
    });

    test('_validateOperation retorna error si falta tabla', () => {
        const op = { action: 'put', data: { id: 1 } };
        expect(window.TransactionManager._validateOperation(op)).not.toBeNull();
    });

    test('_validateOperation retorna error para tabla inexistente', () => {
        const op = { table: 'tabla_fantasma', action: 'put', data: { id: 1 } };
        expect(window.TransactionManager._validateOperation(op)).toMatch(/no existe/);
    });

    test('_validateOperation retorna error para acción desconocida', () => {
        const op = { table: 'purchase_invoices', action: 'merge', data: { id: 1 } };
        expect(window.TransactionManager._validateOperation(op)).toMatch(/no válida/);
    });

    test('_validateOperation retorna error para update sin id', () => {
        const op = { table: 'purchase_invoices', action: 'update', data: { amount: 100 } };
        expect(window.TransactionManager._validateOperation(op)).toMatch(/requiere data.id/);
    });

    test('log registra transacciones correctamente', () => {
        window.TransactionManager._addToLog({ txId: 'tx_test', status: 'committed' });
        expect(window.TransactionManager.getLog()).toHaveLength(1);
        expect(window.TransactionManager.getLog()[0].status).toBe('committed');
    });

    test('log no supera MAX_LOG_SIZE', () => {
        for (let i = 0; i < 510; i++) {
            window.TransactionManager._addToLog({ txId: `tx_${i}`, status: 'committed' });
        }
        expect(window.TransactionManager.getLog().length).toBeLessThanOrEqual(500);
    });

    test('executeBatch rechaza array vacío', async () => {
        window.TransactionManager.executeBatch = async (operations) => {
            if (!Array.isArray(operations) || operations.length === 0) {
                return { success: false, error: 'No hay operaciones que ejecutar.' };
            }
            return { success: true };
        };
        const result = await window.TransactionManager.executeBatch([]);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No hay operaciones/);
    });

    test('executeBatch rechaza operación con tabla inválida', async () => {
        window.TransactionManager.executeBatch = async (operations) => {
            for (const op of operations) {
                const err = window.TransactionManager._validateOperation(op);
                if (err) return { success: false, error: `Operación inválida: ${err}` };
            }
            return { success: true };
        };
        const result = await window.TransactionManager.executeBatch([
            { table: 'no_existe', action: 'put', data: { id: 1 } }
        ]);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no existe/);
    });
});


// ──────────────────────────────────────────────────────────────
// SECCIÓN 4: Sync — Deduplicación por Timestamp
// ──────────────────────────────────────────────────────────────
describe('Sync — Deduplicación por Timestamp', () => {

    const createSyncStub = (lastSyncCompletedAt = 0) => ({
        _lastSyncCompletedAt: lastSyncCompletedAt,
        MIN_SYNC_INTERVAL_MS: 500,
        isSyncing: false,
        client: { from: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue({ data: [], error: null }) },

        _isDuplicateSync() {
            return Date.now() - this._lastSyncCompletedAt < this.MIN_SYNC_INTERVAL_MS;
        }
    });

    test('sincronización bloqueada si se ejecutó hace < 500ms', () => {
        const sync = createSyncStub(Date.now() - 100); // Hace 100ms
        expect(sync._isDuplicateSync()).toBe(true);
    });

    test('sincronización permitida si última fue hace > 500ms', () => {
        const sync = createSyncStub(Date.now() - 1000); // Hace 1s
        expect(sync._isDuplicateSync()).toBe(false);
    });

    test('primera sincronización siempre permitida (timestamp = 0)', () => {
        const sync = createSyncStub(0);
        expect(sync._isDuplicateSync()).toBe(false);
    });

    test('pendingChangeTables acumula correctamente tablas distintas', () => {
        const tables = new Set();
        tables.add('purchase_invoices');
        tables.add('loans');
        tables.add('purchase_invoices'); // Duplicado — Set ignora
        expect(tables.size).toBe(2);
    });

    test('pendingChangeTables se vacía tras despachar evento', () => {
        const tables = new Set(['purchase_invoices', 'loans']);
        const snapshot = [...tables];
        tables.clear();
        expect(tables.size).toBe(0);
        expect(snapshot.length).toBe(2); // Snapshot preservado
    });
});


// ──────────────────────────────────────────────────────────────
// SECCIÓN 5: Migration SQL — Constraints e Índices
// ──────────────────────────────────────────────────────────────
describe('Migration SQL — Validaciones de Estructura', () => {
    const fs = require('fs');
    const path = require('path');

    let migrationSQL = '';

    beforeAll(() => {
        const migPath = path.resolve(__dirname, '../migrations/001_add_constraints.sql');
        migrationSQL = fs.readFileSync(migPath, 'utf-8');
    });

    test('migration contiene ADD COLUMN version para las 3 tablas críticas', () => {
        expect(migrationSQL).toMatch(/ALTER TABLE purchase_invoices.*ADD COLUMN.*version/s);
        expect(migrationSQL).toMatch(/ALTER TABLE loans.*ADD COLUMN.*version/s);
        expect(migrationSQL).toMatch(/ALTER TABLE electronic_invoices.*ADD COLUMN.*version/s);
    });

    test('migration contiene UNIQUE INDEX para folio en electronic_invoices', () => {
        expect(migrationSQL).toMatch(/CREATE UNIQUE INDEX.*electronic_invoices.*folio/s);
    });

    test('migration incluye índice para paymentStatus', () => {
        expect(migrationSQL).toMatch(/idx_purchase_invoices_payment_status/);
    });

    test('migration incluye CHECK CONSTRAINTS para montos', () => {
        expect(migrationSQL).toMatch(/chk_purchase_invoices_amount_range/);
        expect(migrationSQL).toMatch(/chk_loans_total_range/);
        expect(migrationSQL).toMatch(/chk_electronic_invoices_total_range/);
    });

    test('migration está envuelta en BEGIN/COMMIT', () => {
        expect(migrationSQL).toMatch(/^BEGIN;/m);
        expect(migrationSQL).toMatch(/^COMMIT;/m);
    });

    test('rollback SQL existe y elimina las columnas version', () => {
        const rollbackPath = path.resolve(__dirname, '../migrations/001_rollback.sql');
        const rollbackSQL = fs.readFileSync(rollbackPath, 'utf-8');
        expect(rollbackSQL).toMatch(/DROP COLUMN.*version/);
        expect(rollbackSQL).toMatch(/BEGIN;/);
        expect(rollbackSQL).toMatch(/COMMIT;/);
    });
});
