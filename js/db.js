// Database Configuration using Dexie.js (Global Scope)

const db = new Dexie('WorkMasterDB');

// Version 6: Switch to manual IDs to avoid cloud collisions
db.version(6).stores({
    employees: 'id, name, email, role, hourlyRate, dailyRate, deleted',
    workLogs: 'id, employeeId, date, status, deleted',
    settings: 'key',
    products: 'id, name, category, buyPrice, salePrice, expiryDate, stock, deleted',
    promotions: 'id, title, text, isActive, deleted'
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
