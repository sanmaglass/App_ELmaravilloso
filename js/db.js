// Database Configuration using Dexie.js (Global Scope)

const db = new Dexie('WorkMasterDB');

// Version 9: Add Daily Sales (Cierre Diario)
db.version(9).stores({
    employees: 'id, name, email, role, hourlyRate, dailyRate, deleted',
    workLogs: 'id, employeeId, date, status, deleted',
    settings: 'key',
    products: 'id, name, category, buyPrice, salePrice, expiryDate, stock, deleted',
    promotions: 'id, title, text, isActive, deleted',
    suppliers: 'id, name, contact, deleted',
    purchase_invoices: 'id, supplierId, invoiceNumber, date, paymentStatus, period, deleted',
    sales_invoices: 'id, invoiceNumber, clientName, date, paymentStatus, deleted',
    expenses: 'id, title, category, date, deleted',
    daily_sales: 'id, date, deleted'
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
    const supCount = await db.suppliers.count();
    if (supCount === 0) {
        console.log("Seeding initial suppliers...");
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
    }


    // Don't seed if user explicitly deleted everything
    if (localStorage.getItem('wm_skip_seed') === 'true') {
        console.log('Skipping seed (user deleted all data)');
        return;
    }

    const allEmployees = await db.employees.toArray();
    const activeEmployees = allEmployees.filter(e => !e.deleted);

    if (activeEmployees.length === 0) {
        console.log("Seeding database...");
        await db.employees.add({
            id: Date.now(),
            name: "Demo Employee",
            email: "demo@example.com",
            role: "Developer",
            hourlyRate: 5000,
            dailyRate: 40000,
            avatar: "DE",
            startDate: new Date().toISOString(),
            deleted: false  // Explicitly set not deleted
        });
    }
}

// Expose to window
window.db = db;
window.seedDatabase = seedDatabase;
