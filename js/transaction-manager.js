// ──────────────────────────────────────────────────────────────
// TransactionManager — Batch Operations con Rollback Garantizado
//
// Ejecuta múltiples operaciones sobre Dexie en una única
// transacción atómica: o se aplican TODAS o ninguna.
// Registra un log inmutable de cada transacción ejecutada.
//
// Uso:
//   const result = await window.TransactionManager.executeBatch([
//     { table: 'purchase_invoices', action: 'put',    data: {...} },
//     { table: 'loans',             action: 'update', data: { id: 5, status: 'paid' } },
//     { table: 'expenses',          action: 'delete', data: { id: 9 } },
//   ]);
//   if (!result.success) console.error(result.error);
// ──────────────────────────────────────────────────────────────

window.TransactionManager = {

    // Historial de transacciones (solo en memoria; no persiste recargas)
    _log: [],
    MAX_LOG_SIZE: 500,

    /**
     * Ejecuta un conjunto de operaciones en una transacción Dexie atómica.
     *
     * @param {Array<{table: string, action: 'put'|'update'|'delete', data: object}>} operations
     * @param {object} [options]
     * @param {boolean} [options.syncAfter=true]   Sincronizar cada registro con Supabase tras commit.
     * @param {string}  [options.description='']   Etiqueta para el log.
     * @returns {Promise<{success: boolean, txId: string, error?: string, syncErrors?: Array}>}
     */
    async executeBatch(operations, { syncAfter = true, description = '' } = {}) {
        if (!Array.isArray(operations) || operations.length === 0) {
            return { success: false, error: 'No hay operaciones que ejecutar.' };
        }

        // Validar estructura de cada operación antes de tocar la BD
        for (const op of operations) {
            const validationError = this._validateOperation(op);
            if (validationError) {
                return { success: false, error: `Operación inválida: ${validationError}` };
            }
        }

        const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const startTime = Date.now();

        // Determinar tablas involucradas para la transacción Dexie
        const tableNames = [...new Set(operations.map(op => op.table))];

        try {
            // ── Transacción Dexie: atómica por diseño ──────────
            await window.db.transaction('rw', tableNames.map(t => window.db[t]), async () => {
                for (const op of operations) {
                    await this._executeOperation(op);
                }
            });

            // ── Registrar éxito en log ─────────────────────────
            this._addToLog({
                txId,
                description,
                operations: operations.map(op => ({ table: op.table, action: op.action, id: op.data?.id })),
                status: 'committed',
                durationMs: Date.now() - startTime
            });

            // ── Sync posterior (fuera de transacción) ──────────
            const syncErrors = [];
            if (syncAfter && window.DataManager) {
                for (const op of operations) {
                    if (op.action === 'delete') {
                        const res = await window.DataManager.deleteAndSync(op.table, op.data.id);
                        if (res.syncError) syncErrors.push({ table: op.table, id: op.data.id, error: res.syncError });
                    } else {
                        // Leer registro fresco para sincronizar con versión actualizada
                        const fresh = await window.db[op.table].get(Number(op.data.id));
                        if (fresh) {
                            const res = await window.DataManager.saveAndSync(op.table, fresh);
                            if (res.syncError) syncErrors.push({ table: op.table, id: op.data.id, error: res.syncError });
                        }
                    }
                }
            }

            return {
                success: true,
                txId,
                syncErrors: syncErrors.length ? syncErrors : undefined
            };

        } catch (e) {
            // Dexie revierte automáticamente la transacción al lanzar excepción
            this._addToLog({
                txId,
                description,
                operations: operations.map(op => ({ table: op.table, action: op.action, id: op.data?.id })),
                status: 'rolled_back',
                error: e.message,
                durationMs: Date.now() - startTime
            });

            return { success: false, txId, error: e.message };
        }
    },

    /**
     * Ejecuta una operación individual dentro de una transacción Dexie activa.
     * No llamar directamente; usar executeBatch().
     */
    async _executeOperation(op) {
        const table = window.db[op.table];

        switch (op.action) {
            case 'put': {
                // Incrementar version si la tabla lo soporta
                if (window.DataManager?._versionedTables?.has(op.table)) {
                    const existing = op.data.id ? await table.get(Number(op.data.id)) : null;
                    const currentVersion = (existing && existing.version) ? existing.version : 0;
                    op.data.version = currentVersion + 1;
                }
                await table.put({ ...op.data });
                break;
            }
            case 'update': {
                if (!op.data.id) throw new Error(`'update' requiere data.id en tabla ${op.table}`);
                const numericId = Number(op.data.id);
                const { id, ...fields } = op.data;
                // Incrementar version en el update si corresponde
                if (window.DataManager?._versionedTables?.has(op.table)) {
                    const existing = await table.get(numericId);
                    fields.version = ((existing && existing.version) || 0) + 1;
                }
                await table.update(numericId, fields);
                break;
            }
            case 'delete': {
                if (!op.data.id) throw new Error(`'delete' requiere data.id en tabla ${op.table}`);
                // Soft delete: marcar deleted = true
                await table.update(Number(op.data.id), { deleted: true });
                break;
            }
            default:
                throw new Error(`Acción desconocida: ${op.action}. Use 'put', 'update' o 'delete'.`);
        }
    },

    /**
     * Valida la estructura de una operación antes de ejecutarla.
     * Retorna string con el error, o null si es válida.
     */
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

    /**
     * Agrega una entrada al log circular (máximo MAX_LOG_SIZE entradas).
     */
    _addToLog(entry) {
        this._log.push({ ...entry, ts: new Date().toISOString() });
        if (this._log.length > this.MAX_LOG_SIZE) {
            this._log.shift();
        }
    },

    /**
     * Retorna el log de transacciones (solo lectura).
     */
    getLog() {
        return [...this._log];
    },

    /**
     * Helper: soft-delete múltiples registros de una misma tabla en una sola transacción.
     *
     * @param {string} tableName
     * @param {number[]} ids
     */
    async bulkSoftDelete(tableName, ids) {
        const operations = ids.map(id => ({ table: tableName, action: 'delete', data: { id } }));
        return this.executeBatch(operations, { description: `bulkSoftDelete ${tableName}` });
    }
};
