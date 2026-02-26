// Database Configuration using Dexie.js (Global Scope)

const db = new Dexie('WorkMasterDB');

// Version 13: Add more functional indices (date, employeeId)
db.version(13).stores({
    employees: 'id, deleted',
    workLogs: 'id, deleted, date, employeeId',
    settings: 'key',
    products: 'id, deleted',
    promotions: 'id, deleted',
    suppliers: 'id, deleted',
    purchase_invoices: 'id, deleted, supplierId, date',
    sales_invoices: 'id, deleted, date',
    expenses: 'id, deleted, date',
    daily_sales: 'id, deleted, date',
    electronic_invoices: 'id, deleted, date',
    reminders: 'id, deleted, completed, [completed+deleted]'
});


// Initial check and auto-migration fix
db.open().catch(async (err) => {
    if (err.name === 'UpgradeError') {
        console.warn("Detectada incompatibilidad de versión (ID Global). Reiniciando base de datos local...");
        await db.delete();
        window.location.reload();
    }
});

async function seedDatabase() {
    // 1. Seed Suppliers
    await seedSuppliersIfNeeded();

    // Don't seed if user explicitly deleted everything
    if (localStorage.getItem('wm_skip_seed') === 'true') {
        console.log('Skipping seed (user deleted all data)');
        return;
    }

    // No demo employee seed — production app should start empty
}

// --- SEEDING LOGIC ---
async function seedSuppliersIfNeeded() {
    try {
        const count = await window.db.suppliers.count();

        // Si hay datos locales, no hacer nada
        if (count > 0) return;

        // SIEMPRE intentar cargar desde Supabase primero (incluye deleted para no perder historial)
        if (window.Sync?.client) {
            console.log("[Suppliers] Base local vacía. Intentando restaurar desde Supabase...");
            const { data, error } = await window.Sync.client
                .from('suppliers')
                .select('*');

            if (!error && data && data.length > 0) {
                console.log(`[Suppliers] Restaurando ${data.length} proveedores desde la nube.`);
                await window.db.suppliers.bulkPut(data);
                // Activar bandera para que no se intente sembrar datos de fábrica en el futuro
                localStorage.setItem('wm_suppliers_seeded', 'true');
                return; // Datos restaurados desde la nube, NO sembrar datos de fábrica
            }

            // La nube está vacía también — no sembrar datos de fábrica para evitar duplicados futuros
            // Solo sembrar si NUNCA se ha usado esta app antes (flag no existe)
            const alreadySeeded = localStorage.getItem('wm_suppliers_seeded') === 'true';
            if (alreadySeeded) {
                console.log("[Suppliers] Ya se sembró antes pero la nube está vacía. No reinsertar.");
                return;
            }
        } else {
            // Sin Supabase: verificar flag antes de sembrar
            const alreadySeeded = localStorage.getItem('wm_suppliers_seeded') === 'true';
            if (alreadySeeded) {
                console.log("[Suppliers] Ya se sembró antes. No se insertan datos de fábrica.");
                return;
            }
        }

        // Solo llega aquí si: local vacío + nube vacía o sin conexión + nunca se sembró
        console.log("[Suppliers] Primera vez: sembrando proveedores iniciales...");
        const initialSuppliers = [
            "Distribuidora Kiwan", "El Mesón Mayorista", "BioÑuble", "Minuto Verde",
            "Coca Cola", "Comercial CCU", "Soprole", "Comercial Río Maullin",
            "Doña María", "Central Mayorista", "ICB", "La Veneciana",
            "Nestlé Chile S.A", "Distribuidora AEDOS", "ARCOR", "RAFUÑCO", "XFood Spa"
        ];

        const batch = initialSuppliers.map((name, index) => ({
            id: Date.now() + index,
            name: name,
            contact: "",
            deleted: false
        }));

        await window.db.suppliers.bulkAdd(batch);

        // Marcar que ya se sembró para no volver a hacerlo nunca
        localStorage.setItem('wm_suppliers_seeded', 'true');
        console.log("[Suppliers] Siembra inicial completada y protegida.");

    } catch (e) {
        console.error("Error seeding suppliers:", e);
    }
}

// Expose to window
window.db = db;
// --- CENTRALIZED DATA MANAGER (Centralización de Lógica) ---
window.DataManager = {
    /**
     * Guarda o actualiza una entidad y sincroniza con Supabase automáticamente
     */
    async saveAndSync(tableName, data) {
        const remoteTableMap = { 'workLogs': 'worklogs' };
        const remoteTable = remoteTableMap[tableName] || tableName;
        const isUpdate = !!data.id && (await window.db[tableName].get(data.id));

        try {
            if (isUpdate) {
                await window.db[tableName].update(data.id, data);
            } else {
                if (!data.id) {
                    data.id = Date.now() + Math.floor(Math.random() * 999);
                }
                await window.db[tableName].add(data);
            }

            if (window.Sync?.client) {
                try {
                    if (isUpdate) await window.Sync.client.from(remoteTable).update(data).eq('id', data.id);
                    else await window.Sync.client.from(remoteTable).insert([data]);
                } catch (syncErr) {
                    console.warn(`Sync failed for ${tableName}:`, syncErr);
                    // IMPORTANTE: Devolvemos éxito local pero avisamos del fallo de red
                    return { success: true, id: data.id, syncError: syncErr.message || 'Error de conexión con la nube' };
                }
            }
            return { success: true, id: data.id };
        } catch (e) {
            console.error(`Local save failed for ${tableName}:`, e);
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
            // Avisar pero permitir continuar localmente
            return { success: true, syncError: e.message };
        }
    }
};

window.seedDatabase = seedDatabase;
window.seedSuppliersIfNeeded = seedSuppliersIfNeeded;
