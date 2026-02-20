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
    // DISABLED: No demo data wanted for employees/logs
    // return; 

    // --- SEED SUPPLIERS (Critical for App Functionality) ---
    // Protegido por bandera localStorage: solo siembra la primera vez
    const alreadySeeded = localStorage.getItem('wm_suppliers_seeded') === 'true';
    const supCount = await db.suppliers.count();
    if (supCount === 0 && !alreadySeeded) {
        console.log("[DB] Seeding initial suppliers (first time only)...");
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
        await db.suppliers.bulkAdd(batch);
        localStorage.setItem('wm_suppliers_seeded', 'true');
        console.log("[DB] Suppliers seeded and protected.");
    } else if (supCount > 0 && !alreadySeeded) {
        // Ya hay datos pero no tenía la bandera: marcarla ahora para proteger
        localStorage.setItem('wm_suppliers_seeded', 'true');
        console.log("[DB] Suppliers ya existían. Bandera de protección activada.");
    }


    // Don't seed if user explicitly deleted everything
    if (localStorage.getItem('wm_skip_seed') === 'true') {
        console.log('Skipping seed (user deleted all data)');
        return;
    }

    // No demo employee seed — production app should start empty
}

// Expose to window
window.db = db;
window.seedDatabase = seedDatabase;
