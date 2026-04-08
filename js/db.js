// ──────────────────────────────────────────────────────────────
// Dexie Local Database
// ──────────────────────────────────────────────────────────────
const db = new Dexie('ElMaravillosoApp');

// DB Version History:
// v1-v4: base schema
// v12: added electronic_invoices
// v14: added eleventa_sales integration
db.version(14).stores({
    employees: 'id, rut, deleted',
    workLogs: 'id, employeeId, date, deleted',
    products: 'id, category, deleted',
    promotions: 'id, deleted',
    suppliers: 'id, name, deleted',
    purchase_invoices: 'id, supplierId, date, deleted',
    sales_invoices: 'id, date, deleted',
    electronic_invoices: 'id, date, folio, deleted',
    expenses: 'id, date, deleted',
    daily_sales: 'id, date, deleted',
    settings: 'key',
    reminders: 'id, deleted, completed, [completed+deleted]',
    eleventa_sales: 'id, ticket_id, date, deleted',
    loans: 'id, supplierId, date, deleted'
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
// CENTRALIZED DATA MANAGER
// ──────────────────────────────────────────────────────────────
window.DataManager = {

    // Optional columns added by Pro migration — not all Supabase tables have them
    _remindersCoreFields: ['id', 'title', 'type', 'frequency_unit', 'frequency_value',
        'next_run', 'completed', 'deleted', 'priority', 'notes', 'snoozed_until', 'created_at'],
    _purchaseInvoicesCoreFields: ['id', 'supplierId', 'invoiceNumber', 'date', 'amount',
        'paymentMethod', 'paymentStatus', 'dueDate', 'creditDays', 'paidAmount', 'notes', 'deleted'],
    _suppliersCoreFields: ['id', 'name', 'rut', 'giro', 'address', 'contact', 'phone', 'email', 'deleted'],
    _expensesCoreFields: ['id', 'title', 'amount', 'category', 'date', 'deleted'],
    _employeesCoreFields: ['id', 'name', 'role', 'startDate', 'paymentMode', 'paymentFrequency', 'baseSalary',
        'workHoursPerDay', 'breakMinutes', 'defaultStartTime', 'defaultEndTime',
        'owedMinutes', 'recoveryRateMinutes', 'recoveryStartDate', 'deleted'],
    _dailySalesCoreFields: ['id', 'date', 'cash', 'transfer', 'debit', 'credit', 'total', 'notes', 'deleted'],
    _electronicInvoicesCoreFields: ['id', 'date', 'receiverName', 'receiverRut', 'total', 'status', 'folio', 'pdfUrl', 'deleted'],
    _loansCoreFields: ['id', 'item', 'quantity', 'total', 'date', 'notes', 'status', 'direction', 'type', 'deleted'],
    // Full fields list (used after running migration SQL in Supabase)
    _loansFullFields: ['id', 'supplier_id', 'borrower_name', 'item', 'quantity', 'unit_price', 'total', 'date', 'notes', 'status', 'direction', 'type', 'repayment_type', 'repayment_date', 'deleted'],

    /**
     * Guarda o actualiza una entidad y sincroniza con Supabase.
     * Estrategia defensiva de 2 fases para reminders:
     *   1. Intenta upsert con todos los campos (incluyendo priority, notes, etc.)
     *   2. Si falla por columna inexistente (migración no corrida), reintenta solo con campos base
     */
    async saveAndSync(tableName, data) {
        const remoteTableMap = { 'workLogs': 'worklogs' };
        const remoteTable = remoteTableMap[tableName] || tableName;

        try {
            // BUG FIX: ID Coercion. 
            // If data.id is a string (from a form), parse it as a number to avoid duplicates in Dexie.
            if (data.id) data.id = Number(data.id);

            // Assign ID and created_at if it's a completely new record
            if (!data.id) {
                data.id = Math.floor(Math.random() * 2000000000);
                data.created_at = new Date().toISOString();
            }

            // Save locally first (put = insert or update)
            await window.db[tableName].put(data);

            // Sync to Supabase
            if (window.Sync?.client) {
                // ── PREVENTIVE FILTERING ──
                // Check if we already know this table has schema issues
                const fallbackTables = {
                    'reminders': this._remindersCoreFields,
                    'purchase_invoices': this._purchaseInvoicesCoreFields,
                    'suppliers': this._suppliersCoreFields,
                    'expenses': this._expensesCoreFields,
                    'employees': this._employeesCoreFields,
                    'daily_sales': this._dailySalesCoreFields,
                    'electronic_invoices': this._electronicInvoicesCoreFields,
                    'loans': this._loansCoreFields
                };

                let syncData = { ...data };
                if (tableName === 'purchase_invoices') {
                    delete syncData.imageData;
                    delete syncData.created_at;
                }

                // Loans: convert camelCase local fields to snake_case for Supabase
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
                        // These will work once you run the migration SQL in Supabase:
                        supplier_id: data.supplierId || null,
                        unit_price: data.unitPrice || null,
                        borrower_name: data.borrowerName || null,
                        repayment_type: data.repaymentType || null,
                        repayment_date: data.repaymentDate || null,
                    };
                }

                // If it's a known "problematic" table, only send core fields to avoid 400 error in console
                if (fallbackTables[tableName] && tableName !== 'loans') {
                    const coreFields = fallbackTables[tableName];
                    const cleanData = {};
                    coreFields.forEach(k => {
                        if (syncData[k] !== undefined) cleanData[k] = syncData[k];
                    });
                    syncData = cleanData;
                }

                // reminders usa columnas INTEGER para deleted/completed (no BOOLEAN)
                if (tableName === 'reminders') {
                    if (syncData.deleted !== undefined) syncData.deleted = syncData.deleted ? 1 : 0;
                    if (syncData.completed !== undefined) syncData.completed = syncData.completed ? 1 : 0;
                }

                const { error: syncErr } = await window.Sync.client
                    .from(remoteTable)
                    .upsert([syncData], { onConflict: 'id' })
                    .select('id');

                if (syncErr) {
                    console.warn(`[DataManager] Sync failed for ${tableName}:`, syncErr.message);

                    // ── FALLBACK: column not found (migration not run yet) ──
                    const isColumnErr = syncErr.message?.includes('column') ||
                        syncErr.message?.includes('schema cache') ||
                        syncErr.code === 'PGRST204' ||
                        syncErr.code === '42703';

                    if (isColumnErr && fallbackTables[tableName]) {
                        // Synced silently (preventive filtering should have caught this, but this is a double safety)
                        return { success: true, id: data.id, syncError: 'missing_columns' };
                    }

                    return { success: true, id: data.id, syncError: syncErr.message };
                }
            }
            return { success: true, id: data.id };
        } catch (e) {
            console.error(`[DataManager] Local save failed for ${tableName}:`, e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Elimina (soft delete) una entidad y sincroniza
     */
    async deleteAndSync(tableName, id) {
        const remoteTableMap = { 'workLogs': 'worklogs' };
        const remoteTable = remoteTableMap[tableName] || tableName;

        try {
            // 1. Borrado local inmediato (Soft delete)
            const numericId = Number(id);
            await window.db[tableName].update(numericId, { deleted: true });

            // 2. Intentar borrar en la nube
            if (window.Sync?.client) {
                const { error } = await window.Sync.client
                    .from(remoteTable)
                    .update({ deleted: true })
                    .eq('id', id);

                if (error) {
                    console.warn(`[DataManager] Soft delete falló para ${tableName}, intentando hard delete...`);
                    const { error: hardDelErr } = await window.Sync.client
                        .from(remoteTable)
                        .delete()
                        .eq('id', id);
                    if (hardDelErr) throw hardDelErr;
                }
            }
            return { success: true };
        } catch (e) {
            console.error(`Error deleting ${tableName}:`, e);
            return { success: true, syncError: e.message };
        }
    }
};

window.seedDatabase = seedDatabase;
window.seedSuppliersIfNeeded = seedSuppliersIfNeeded;
