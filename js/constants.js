// Constants - Valores centralizados para evitar duplicaciones
window.Constants = {
    // Mapeo de nombres de tablas locales a nombres remotos (Supabase)
    REMOTE_TABLE_MAP: {
        'employees': 'employees',
        'workLogs': 'worklogs',
        'products': 'products',
        'promotions': 'promotions',
        'suppliers': 'suppliers',
        'purchase_invoices': 'purchase_invoices',
        'sales_invoices': 'sales_invoices',
        'expenses': 'expenses',
        'daily_sales': 'daily_sales',
        'electronic_invoices': 'electronic_invoices',
        'reminders': 'reminders',
        'eleventa_sales': 'eleventa_sales',
        'loans': 'loans',
        'cash_register': 'cash_register',
        'advances': 'advances'
    },

    // Versión actual de Dexie DB
    DB_VERSION: 19,

    // Tablas versionadas (con control de versión optimista)
    VERSIONED_TABLES: ['purchase_invoices', 'electronic_invoices', 'loans'],

    // Tablas sincronizadas con Supabase
    SYNCED_TABLES: [
        'employees', 'workLogs', 'products', 'promotions', 'suppliers',
        'purchase_invoices', 'sales_invoices', 'expenses', 'daily_sales',
        'electronic_invoices', 'reminders', 'eleventa_sales', 'loans', 'cash_register', 'advances'
    ],

    // Límites de sincronización
    SYNC: {
        ROLLING_DAYS: 90, // Descarga últimos 90 días de eleventa_sales
        BATCH_SIZE: 10000,
        RETRY_MAX: 3,
        RETRY_DELAY_MS: 1000
    },

    // Límites de inactividad
    INACTIVITY_LIMIT_MS: 5 * 60 * 1000, // 5 minutos

    // Modo debug
    DEBUG: false,

    // Validación de operaciones batch
    MIN_BATCH_SIZE: 1,
    MAX_BATCH_SIZE: 10000
};
