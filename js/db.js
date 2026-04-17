// ──────────────────────────────────────────────────────────────
// Dexie Local Database
// ──────────────────────────────────────────────────────────────
const db = new Dexie('ElMaravillosoApp');

// DB Version History:
// v1-v4:  base schema
// v12:    added electronic_invoices
// v14:    added eleventa_sales integration
// v15:    added version field index for optimistic locking
// v16:    added error_logs table for centralized error tracking
db.version(14).stores({
    employees: 'id, rut, deleted',
    workLogs: 'id, employeeId, date, deleted',
    products: 'id, category, deleted',
    promotions: 'id, deleted',
    suppliers: 'id, name, deleted',
    purchase_invoices: 'id, supplierId, date, paymentStatus, paymentMethod, invoiceNumber, deleted',
    sales_invoices: 'id, date, clientName, invoiceNumber, deleted',
    electronic_invoices: 'id, date, folio, status, deleted',
    expenses: 'id, date, deleted',
    daily_sales: 'id, date, deleted',
    settings: 'key',
    reminders: 'id, deleted, completed, [completed+deleted]',
    eleventa_sales: 'id, ticket_id, date, deleted',
    loans: 'id, supplierId, date, deleted, direction, status'
});

db.version(15).stores({
    employees: 'id, rut, deleted',
    workLogs: 'id, employeeId, date, deleted',
    products: 'id, category, deleted',
    promotions: 'id, deleted',
    suppliers: 'id, name, deleted',
    purchase_invoices: 'id, supplierId, date, paymentStatus, paymentMethod, invoiceNumber, deleted, version',
    sales_invoices: 'id, date, clientName, invoiceNumber, deleted',
    electronic_invoices: 'id, date, folio, status, deleted, version',
    expenses: 'id, date, deleted',
    daily_sales: 'id, date, deleted',
    settings: 'key',
    reminders: 'id, deleted, completed, [completed+deleted]',
    eleventa_sales: 'id, ticket_id, date, deleted',
    loans: 'id, supplierId, date, deleted, direction, status, version'
});

db.version(16).stores({
    employees: 'id, rut, deleted',
    workLogs: 'id, employeeId, date, deleted',
    products: 'id, category, deleted',
    promotions: 'id, deleted',
    suppliers: 'id, name, deleted',
    purchase_invoices: 'id, supplierId, date, paymentStatus, paymentMethod, invoiceNumber, deleted, version',
    sales_invoices: 'id, date, clientName, invoiceNumber, deleted',
    electronic_invoices: 'id, date, folio, status, deleted, version',
    expenses: 'id, date, deleted',
    daily_sales: 'id, date, deleted',
    settings: 'key',
    reminders: 'id, deleted, completed, [completed+deleted]',
    eleventa_sales: 'id, ticket_id, date, deleted',
    loans: 'id, supplierId, date, deleted, direction, status, version',
    error_logs: 'id, timestamp, level, [level+timestamp]'
});

// v17: HLC sync - nueva arquitectura de sincronización
db.version(17).stores({
    employees: 'id, rut, deleted, updated_at_hlc',
    workLogs: 'id, employeeId, date, deleted, updated_at_hlc',
    products: 'id, category, deleted, updated_at_hlc',
    promotions: 'id, deleted, updated_at_hlc',
    suppliers: 'id, name, deleted, updated_at_hlc',
    purchase_invoices: 'id, supplierId, date, paymentStatus, paymentMethod, invoiceNumber, deleted, version, updated_at_hlc',
    sales_invoices: 'id, date, clientName, invoiceNumber, deleted, updated_at_hlc',
    electronic_invoices: 'id, date, folio, status, deleted, version, updated_at_hlc',
    expenses: 'id, date, deleted, updated_at_hlc',
    daily_sales: 'id, date, deleted, updated_at_hlc',
    settings: 'key',
    reminders: 'id, deleted, completed, [completed+deleted], updated_at_hlc',
    eleventa_sales: 'id, ticket_id, date, deleted, updated_at_hlc',
    loans: 'id, supplierId, date, deleted, direction, status, version, updated_at_hlc',
    error_logs: 'id, timestamp, level, [level+timestamp]',
    sync_outbox: '++id, tableName, status, created_at',
    sync_state: 'table_name'
}).upgrade(tx => {
    // Migrar datos: agregar updated_at_hlc a registros existentes
    const tables = ['employees', 'workLogs', 'products', 'promotions', 'suppliers',
                    'purchase_invoices', 'sales_invoices', 'electronic_invoices', 'expenses',
                    'daily_sales', 'reminders', 'eleventa_sales', 'loans'];
    const now = Date.now();

    tables.forEach(tableName => {
        tx.table(tableName).toCollection().modify(record => {
            if (!record.updated_at_hlc) {
                record.updated_at_hlc = now;
                record.updated_by_device = 'migration';
                record.version = record.version || 1;
            }
        });
    });
});

// v18: cash_register — Arqueo y movimientos de caja
db.version(18).stores({
    employees: 'id, rut, deleted, updated_at_hlc',
    workLogs: 'id, employeeId, date, deleted, updated_at_hlc',
    products: 'id, category, deleted, updated_at_hlc',
    promotions: 'id, deleted, updated_at_hlc',
    suppliers: 'id, name, deleted, updated_at_hlc',
    purchase_invoices: 'id, supplierId, date, paymentStatus, paymentMethod, invoiceNumber, deleted, version, updated_at_hlc',
    sales_invoices: 'id, date, clientName, invoiceNumber, deleted, updated_at_hlc',
    electronic_invoices: 'id, date, folio, status, deleted, version, updated_at_hlc',
    expenses: 'id, date, deleted, updated_at_hlc',
    daily_sales: 'id, date, deleted, updated_at_hlc',
    settings: 'key',
    reminders: 'id, deleted, completed, [completed+deleted], updated_at_hlc',
    eleventa_sales: 'id, ticket_id, date, deleted, updated_at_hlc',
    loans: 'id, supplierId, date, deleted, direction, status, version, updated_at_hlc',
    error_logs: 'id, timestamp, level, [level+timestamp]',
    sync_outbox: '++id, tableName, status, created_at',
    sync_state: 'table_name',
    cash_register: 'id, date, type, category, deleted, updated_at_hlc'
});

// ──────────────────────────────────────────────────────────────
async function seedDatabase() {
    const count = await db.settings.count();
    if (count > 0) return;
    await db.settings.bulkPut([
        { key: 'business_name', value: 'Mi Negocio' },
        { key: 'currency', value: 'CLP' },
    ]);
}

async function seedSuppliersIfNeeded() {
    const count = await db.suppliers.count();
    if (count > 0) return;
}

// Expose to window
window.db = db;

// ──────────────────────────────────────────────────────────────
// CENTRALIZED DATA MANAGER v2
// Mejoras: retry con exponential backoff, queue de cambios
// pendientes en memoria, optimistic locking por version field.
// ──────────────────────────────────────────────────────────────
window.DataManager = {

    // ── Retry / Queue config ──────────────────────────────────
    syncQueue: new Map(),   // { queueKey: { tableName, data, retries, timestamp } }
    MAX_RETRIES: 5,
    RETRY_BASE_MS: 1000,    // 1 s base → backoff × 2^attempt
    _queueProcessorTimer: null,
    _isProcessingQueue: false,

    // ── Tables with version support (optimistic locking) ──────
    _versionedTables: new Set(['purchase_invoices', 'loans', 'electronic_invoices']),

    // Optional columns added by Pro migration — not all Supabase tables have them
    _remindersCoreFields: ['id', 'title', 'type', 'frequency_unit', 'frequency_value',
        'next_run', 'completed', 'deleted', 'priority', 'notes', 'snoozed_until', 'created_at'],
    _purchaseInvoicesCoreFields: ['id', 'supplierId', 'supplierName', 'invoiceNumber', 'date', 'amount', 'period',
        'paymentMethod', 'paymentStatus', 'dueDate', 'creditDays', 'paidAmount', 'notes', 'deleted', 'version',
        'siiTipoDoc', 'siiRutProveedor', 'siiFolio', 'siiMontoNeto', 'siiMontoIva', 'siiMontoExento', 'siiImportado', 'siiImportDate'],
    _suppliersCoreFields: ['id', 'name', 'rut', 'giro', 'address', 'contact', 'phone', 'email', 'deleted'],
    _expensesCoreFields: ['id', 'title', 'amount', 'category', 'date', 'deleted'],
    _employeesCoreFields: ['id', 'name', 'role', 'startDate', 'paymentMode', 'paymentFrequency', 'baseSalary',
        'workHoursPerDay', 'breakMinutes', 'defaultStartTime', 'defaultEndTime',
        'owedMinutes', 'recoveryRateMinutes', 'recoveryStartDate', 'deleted'],
    _dailySalesCoreFields: ['id', 'date', 'cash', 'transfer', 'debit', 'credit', 'total', 'notes', 'deleted'],
    _electronicInvoicesCoreFields: ['id', 'date', 'receiverName', 'receiverRut', 'total', 'status', 'folio', 'pdfUrl', 'deleted', 'version'],
    _loansCoreFields: ['id', 'item', 'quantity', 'total', 'date', 'notes', 'status', 'direction', 'type', 'deleted', 'version'],
    // Full fields list (used after running migration SQL in Supabase)
    _loansFullFields: ['id', 'supplier_id', 'borrower_name', 'item', 'quantity', 'unit_price', 'total', 'date', 'notes', 'status', 'direction', 'type', 'repayment_type', 'repayment_date', 'deleted', 'version'],
    _cashRegisterCoreFields: ['id', 'date', 'type', 'category', 'amount', 'description', 'paymentMethod', 'reference', 'notes', 'deleted'],

    /**
     * Guarda o actualiza una entidad, gestiona version para locking
     * optimista, e intenta sync con Supabase con retry exponencial.
     * Si todos los reintentos fallan, encola el cambio para procesar
     * cuando vuelva la conexión.
     */
    async saveAndSync(tableName, data) {
        const remoteTable = (window.Constants?.REMOTE_TABLE_MAP?.[tableName]) || tableName;

        try {
            // ── ID Coercion: evitar duplicados por IDs string ──
            if (data.id) data.id = Number(data.id);

            if (!data.id) {
                data.id = Math.floor(Math.random() * 2000000000);
                data.created_at = new Date().toISOString();
            }

            // ── Integridad pre-save ────────────────────────────
            if (!this._validateIntegrity(tableName, data)) {
                return { success: false, error: 'Validación de integridad fallida' };
            }

            // ── Versioning: incrementar version en tablas que lo soportan ──
            if (this._versionedTables.has(tableName)) {
                const existing = await window.db[tableName].get(data.id);
                const currentVersion = (existing && existing.version) ? existing.version : 0;
                data.version = currentVersion + 1;
            }

            // ── Guardar localmente primero (nunca falla por red) ──
            await window.db[tableName].put(data);

            // ── Intentar sync con retry exponencial ───────────
            // SyncV2 tiene prioridad sobre el Sync legacy
            const activeClient = window.SyncV2?.client || window.Sync?.client;
            if (activeClient) {
                const syncResult = await this._syncWithRetry(tableName, remoteTable, data);
                if (!syncResult.success) {
                    // Guardar en queue para procesar cuando vuelva conexión
                    this._enqueueChange(tableName, data);
                    this._scheduleQueueProcessor();
                    return { success: true, id: data.id, syncError: syncResult.error, queued: true };
                }
            }
            return { success: true, id: data.id };

        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    /**
     * Intenta hacer sync a Supabase con retry y backoff exponencial.
     * Retorna { success, error? }
     */
    async _syncWithRetry(tableName, remoteTable, data) {
        const fallbackTables = this._getFallbackTables();
        let syncData = this._prepareSyncData(tableName, data, fallbackTables);

        // Usar SyncV2 primero (es el sistema activo), con fallback al Sync legacy
        const activeClient = window.SyncV2?.client || window.Sync?.client;
        if (!activeClient) return { success: false, error: 'Sin cliente de sync' };

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                const { error: syncErr } = await activeClient
                    .from(remoteTable)
                    .upsert([syncData], { onConflict: 'id' })
                    .select('id');

                if (!syncErr) return { success: true };

                // Errores de esquema: no reintentar, no son transitorios
                const isSchemaErr = syncErr.message?.includes('column') ||
                    syncErr.message?.includes('schema cache') ||
                    syncErr.code === 'PGRST204' ||
                    syncErr.code === '42703';
                if (isSchemaErr) {
                    return { success: true, syncError: 'missing_columns' };
                }

                // Error 409 = conflicto de versión → no reintentar
                if (syncErr.code === '23505' || syncErr.status === 409) {
                    return { success: false, error: 'version_conflict', retryable: false };
                }

                // Último intento: retornar error
                if (attempt === this.MAX_RETRIES - 1) {
                    return { success: false, error: syncErr.message };
                }

                // Backoff exponencial antes del siguiente intento
                const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));

            } catch (networkErr) {
                if (attempt === this.MAX_RETRIES - 1) {
                    return { success: false, error: networkErr.message };
                }
                const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        return { success: false, error: 'Max retries reached' };
    },

    /**
     * Agrega un cambio a la queue de pendientes en memoria.
     * Si ya existe una entrada para el mismo registro, la reemplaza
     * (deduplicación: solo el estado más reciente importa).
     */
    _enqueueChange(tableName, data) {
        const queueKey = `${tableName}:${data.id}`;
        const existing = this.syncQueue.get(queueKey);
        this.syncQueue.set(queueKey, {
            tableName,
            data: { ...data },
            retries: existing ? existing.retries : 0,
            timestamp: Date.now()
        });
    },

    /**
     * Programa el procesamiento de la queue con debounce.
     */
    _scheduleQueueProcessor() {
        if (this._queueProcessorTimer) clearTimeout(this._queueProcessorTimer);
        this._queueProcessorTimer = setTimeout(() => this.processPendingQueue(), 5000);
    },

    /**
     * Procesa los cambios pendientes en la queue.
     * Se llama automáticamente cuando vuelve la conexión.
     * Orden: más antiguos primero.
     */
    async processPendingQueue() {
        if (this._isProcessingQueue) return;
        if (this.syncQueue.size === 0) return;
        const activeClient = window.SyncV2?.client || window.Sync?.client;
        if (!activeClient) return;

        this._isProcessingQueue = true;

        // Ordenar por timestamp (FIFO)
        const entries = [...this.syncQueue.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);

        for (const [queueKey, entry] of entries) {
            const { tableName, data } = entry;
            const remoteTable = (window.Constants?.REMOTE_TABLE_MAP?.[tableName]) || tableName;

            const result = await this._syncWithRetry(tableName, remoteTable, data);

            if (result.success || result.retryable === false) {
                this.syncQueue.delete(queueKey);
                if (!result.success) {
                    console.warn(`[DataManager] Sincronización descartada (no reintentable) para ${tableName} #${data.id}:`, result.error);
                }
            } else {
                entry.retries = (entry.retries || 0) + 1;
                if (entry.retries >= this.MAX_RETRIES) {
                    // Descartar si superó el máximo de reintentos globales
                    this.syncQueue.delete(queueKey);
                    if (window.Sync?.showToast) {
                        window.Sync.showToast(`No se pudo sincronizar ${tableName} #${data.id} después de ${this.MAX_RETRIES} intentos.`, 'error');
                    }
                }
            }
        }

        this._isProcessingQueue = false;

        // Si quedan pendientes, volver a programar
        if (this.syncQueue.size > 0) {
            this._scheduleQueueProcessor();
        }
    },

    /**
     * Registra listener de reconexión para procesar queue automáticamente.
     * Debe llamarse una vez al inicializar la app.
     */
    initQueueProcessor() {
        window.addEventListener('online', () => {
            this.processPendingQueue();
        });
        // También procesar cuando Sync reporta conexión exitosa
        window.addEventListener('sync-connected', () => {
            this.processPendingQueue();
        });
    },

    /**
     * Validación básica de integridad antes de guardar.
     * Retorna false si hay datos obviamente corruptos.
     */
    _validateIntegrity(tableName, data) {
        if (!data || typeof data !== 'object') return false;

        // Detectar valores monetarios imposibles (> 1 Trillón CLP)
        const moneyFields = ['amount', 'total', 'paidAmount', 'cash'];
        for (const field of moneyFields) {
            if (data[field] !== undefined && Math.abs(parseFloat(data[field]) || 0) > 1e12) {
                return false;
            }
        }
        return true;
    },

    /**
     * Retorna el mapa de campos core por tabla.
     */
    _getFallbackTables() {
        return {
            'reminders': this._remindersCoreFields,
            'purchase_invoices': this._purchaseInvoicesCoreFields,
            'suppliers': this._suppliersCoreFields,
            'expenses': this._expensesCoreFields,
            'employees': this._employeesCoreFields,
            'daily_sales': this._dailySalesCoreFields,
            'electronic_invoices': this._electronicInvoicesCoreFields,
            'loans': this._loansCoreFields,
            'cash_register': this._cashRegisterCoreFields
        };
    },

    /**
     * Prepara los datos para enviar a Supabase, aplicando
     * filtros de campos core y conversiones necesarias.
     */
    _prepareSyncData(tableName, data, fallbackTables) {
        let syncData = { ...data };

        if (tableName === 'purchase_invoices') {
            delete syncData.imageData;
            delete syncData.created_at;
        }

        // Loans: convertir camelCase a snake_case para Supabase
        if (tableName === 'loans') {
            syncData = {
                id: data.id,
                item: data.item,
                quantity: data.quantity,
                total: data.total,
                date: data.date,
                notes: data.notes || null,
                status: data.status,
                direction: data.direction,
                type: data.type,
                deleted: data.deleted,
                version: data.version || 1,
                supplier_id: data.supplierId || null,
                unit_price: data.unitPrice || null,
                borrower_name: data.borrowerName || null,
                repayment_type: data.repaymentType || null,
                repayment_date: data.repaymentDate || null,
            };
        }

        // Filtrar solo campos core para tablas conocidas
        if (fallbackTables[tableName] && tableName !== 'loans') {
            const coreFields = fallbackTables[tableName];
            const cleanData = {};
            coreFields.forEach(k => {
                if (syncData[k] !== undefined) cleanData[k] = syncData[k];
            });
            syncData = cleanData;
        }

        // reminders usa INTEGER para deleted/completed (no BOOLEAN)
        if (tableName === 'reminders') {
            if (syncData.deleted !== undefined) syncData.deleted = syncData.deleted ? 1 : 0;
            if (syncData.completed !== undefined) syncData.completed = syncData.completed ? 1 : 0;
        }

        return syncData;
    },

    /**
     * Elimina (soft delete) una entidad y sincroniza.
     */
    async deleteAndSync(tableName, id) {
        const remoteTable = (window.Constants?.REMOTE_TABLE_MAP?.[tableName]) || tableName;

        try {
            // 1. Borrado local inmediato (Soft delete)
            const numericId = Number(id);
            await window.db[tableName].update(numericId, { deleted: true });

            // 2. Intentar borrar en la nube con retry
            const activeClient = window.SyncV2?.client || window.Sync?.client;
            if (activeClient) {
                const result = await this._syncWithRetry(tableName, remoteTable, { id: numericId, deleted: true });

                if (!result.success) {
                    // Fallback: hard delete
                    try {
                        const { error: hardDelErr } = await activeClient
                            .from(remoteTable)
                            .delete()
                            .eq('id', id);
                        if (hardDelErr) throw hardDelErr;
                    } catch (hardErr) {
                        // Encolar para retry posterior
                        this._enqueueChange(tableName, { id: numericId, deleted: true });
                        this._scheduleQueueProcessor();
                        return { success: true, syncError: hardErr.message, queued: true };
                    }
                }
            }
            return { success: true };
        } catch (e) {
            return { success: true, syncError: e.message };
        }
    }
};

window.seedDatabase = seedDatabase;
window.seedSuppliersIfNeeded = seedSuppliersIfNeeded;

// Inicializar queue processor al cargar el módulo
window.DataManager.initQueueProcessor();
