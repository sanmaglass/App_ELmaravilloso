// ──────────────────────────────────────────────────────────────
// Dexie Local Database
// ──────────────────────────────────────────────────────────────
const db = new Dexie('ElMaravillosoApp');

// DB Version History:
// v1-v4: base schema
// v12: added electronic_invoices
// v13: added reminders
db.version(13).stores({
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
        'next_run', 'completed', 'deleted', 'created_at'],

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
            // Assign ID if new record
            if (!data.id) {
                data.id = Date.now() + Math.floor(Math.random() * 999);
            }

            // Save locally first (put = insert or update)
            await window.db[tableName].put(data);

            // Sync to Supabase
            if (window.Sync?.client) {
                const { error: syncErr } = await window.Sync.client
                    .from(remoteTable)
                    .upsert([data], { onConflict: 'id' });

                if (syncErr) {
                    console.warn(`[DataManager] Sync failed for ${tableName}:`, syncErr.message);

                    // ── FALLBACK: column not found (migration not run yet) ──
                    const isColumnErr = syncErr.message?.includes('column') ||
                        syncErr.message?.includes('schema cache') ||
                        syncErr.code === 'PGRST204' ||
                        syncErr.code === '42703';

                    if (isColumnErr && tableName === 'reminders') {
                        console.warn('[DataManager] Retrying reminders with core fields only...');
                        const coreData = {};
                        this._remindersCoreFields.forEach(k => {
                            if (data[k] !== undefined) coreData[k] = data[k];
                        });

                        const { error: retryErr } = await window.Sync.client
                            .from(remoteTable)
                            .upsert([coreData], { onConflict: 'id' });

                        if (!retryErr) {
                            // Synced with core fields OK — migration still needed for full features
                            return { success: true, id: data.id, syncError: 'missing_columns' };
                        }
                        return { success: true, id: data.id, syncError: retryErr.message };
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
            await window.db[tableName].update(id, { deleted: true });

            // 2. Intentar borrar en la nube
            if (window.Sync?.client) {
                const { error } = await window.Sync.client
                    .from(remoteTable)
                    .update({ deleted: true })
                    .eq('id', id);

                if (error) throw error;
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
