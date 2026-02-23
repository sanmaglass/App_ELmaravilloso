// Database Configuration using Dexie.js (Global Scope)

const db = new Dexie('WorkMasterDB');

// Version 10: Fix suppliers schema (remove indexed fields, use only id)
db.version(10).stores({
    employees: 'id',
    workLogs: 'id',
    settings: 'key',
    products: 'id',
    promotions: 'id',
    suppliers: 'id',
    purchase_invoices: 'id',
    sales_invoices: 'id',
    expenses: 'id',
    daily_sales: 'id'
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
window.seedDatabase = seedDatabase;
window.seedSuppliersIfNeeded = seedSuppliersIfNeeded;
