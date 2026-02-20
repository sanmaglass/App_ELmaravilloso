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
    // Suppliers are seeded by suppliers.js (seedSuppliersIfNeeded) after Sync is ready.
    // No seeding here to avoid race conditions with Supabase initialization.

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
