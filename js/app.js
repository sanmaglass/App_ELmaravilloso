// Main App Controller (Global Scope, Loaded Last)

// Application State
window.state = {
    currentView: 'dashboard',
    currentUser: null
};

// Router / View Manager
const views = {
    dashboard: () => window.Views.dashboard(document.getElementById('view-container')),
    employees: () => window.Views.employees(document.getElementById('view-container')),
    calendar: () => window.Views.calendar(document.getElementById('view-container')),
    calculator: () => window.Views.calculator(document.getElementById('view-container')),
    marketing: () => window.Views.marketing(document.getElementById('view-container')),
    payments: () => window.Views.payments(document.getElementById('view-container')),
    security: () => window.Views.security(document.getElementById('view-container')),
    suppliers: () => window.Views.suppliers(document.getElementById('view-container')),
    purchase_invoices: () => window.Views.purchase_invoices(document.getElementById('view-container')),
    expenses: () => window.Views.expenses(document.getElementById('view-container')),
    daily_sales: () => window.Views.daily_sales(document.getElementById('view-container')),
    sales_invoices: () => window.Views.sales_invoices(document.getElementById('view-container')),
    electronic_invoices: () => window.Views.electronic_invoices(document.getElementById('view-container')),
    reports: () => window.Views.reports(document.getElementById('view-container')),
    settings: () => window.Views.settings(document.getElementById('view-container'))
};

// Initialize App
async function init() {
    try {
        // --- AUTH CHECK (DISABLED for faster loading) ---
        /* 
        const isAuth = sessionStorage.getItem('wm_auth');
        if (!isAuth) {
            // Show Login View, bypass standard app load
            document.querySelector('.app-container').style.display = 'none'; // Hide main layout
            // Create a dedicated container for login if needed or use body
            const loginContainer = document.createElement('div');
            loginContainer.id = 'login-wrapper';
            document.body.appendChild(loginContainer);

            window.Views.login(loginContainer);
            return; // Stop initialization
        }
        */

        // Auto-authenticate for faster loading
        sessionStorage.setItem('wm_auth', 'true');

        // If Auth passed, ensure main layout is visible
        document.querySelector('.app-container').style.display = 'flex';

        await window.seedDatabase();
        const syncRes = await window.Sync.init();

        if (syncRes.success) {
            console.log('☁️ Supabase conectado — descargando datos de la nube...');

            // Sync first before rendering so the view has fresh data
            await window.Sync.syncAll();

            // Initialize WebSocket real-time sync (enterprise-grade)
            await window.Sync.initRealtimeSync();

            // Start polling as fallback (60s instead of 5s)
            window.Sync.startAutoSync(60000); // 1 minute
        }

        // Navigation Logic
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Logout Check
                if (btn.dataset.view === 'logout') {
                    if (confirm('¿Cerrar sesión?')) {
                        localStorage.removeItem('wm_auth');
                        window.location.reload();
                    }
                    return;
                }

                // Remove active class
                navItems.forEach(b => b.classList.remove('active'));
                // Add active class
                const target = e.currentTarget;
                target.classList.add('active');

                // Navigate
                const viewName = target.dataset.view;
                window.state.currentView = viewName; // Update state
                document.getElementById('page-title').textContent = target.querySelector('span').textContent;
                if (views[viewName]) {
                    views[viewName]();
                }

                // Close sidebar on mobile after navigation
                if (sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
            });
        });

        // Initial Load
        window.state.currentView = 'dashboard';
        views.dashboard();

        // GLOBAL SYNC LISTENER: Auto-refresh view when data changes
        window.addEventListener('sync-data-updated', () => {
            console.log("♻️ Data sync detected - Refreshing view...");
            const current = window.state.currentView;
            if (views[current]) {
                // Save scroll position if possible? (Optional refinement)
                views[current]();
            }
        });

        // Escuchar cambios de datos en segundo plano
        // RE-ENABLED for WebSocket real-time sync
        window.addEventListener('sync-data-updated', () => {
            console.log("Datos nuevos recibidos. Refrescando vista:", window.state.currentView);
            if (views[window.state.currentView]) {
                views[window.state.currentView]();
            }
        });
    } catch (err) {
        console.error("Critical Init Error:", err);
        document.body.innerHTML = `<div style="color:white; padding:50px; text-align:center;"><h1>Error de Carga</h1><p>${err.message}</p></div>`;
    }
}

// Mobile Menu Toggle Logic
const sidebar = document.querySelector('.sidebar');
const mobileBtn = document.getElementById('btn-mobile-menu');
const overlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

if (mobileBtn && overlay) {
    mobileBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
}

// Global Modal Handlers
document.getElementById('global-add-btn').addEventListener('click', () => {
    // For now, simpler action
    alert('Ve a la sección "Personal" para agregar empleados.');
});

// Privacy Toggle Logic
document.getElementById('btn-toggle-privacy').addEventListener('click', () => {
    document.body.classList.toggle('privacy-mode');
    const btn = document.getElementById('btn-toggle-privacy');
    const isHidden = document.body.classList.contains('privacy-mode');

    // Update Icon
    btn.innerHTML = isHidden ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
    btn.title = isHidden ? "Mostrar Montos" : "Ocultar Montos";

    // Optional: Save preference
    localStorage.setItem('wm_privacy', isHidden);
});

// Restore Privacy State on Load
if (localStorage.getItem('wm_privacy') === 'true') {
    document.body.classList.add('privacy-mode');
    document.getElementById('btn-toggle-privacy').innerHTML = '<i class="ph ph-eye-slash"></i>';
}

// Sync Indicator Click -> Settings
const syncInd = document.getElementById('sync-indicator');
if (syncInd) {
    syncInd.style.cursor = 'pointer';
    syncInd.addEventListener('click', () => {
        // Find settings button and click it to navigate
        const settingsBtn = document.querySelector('.nav-item[data-view="settings"]');
        if (settingsBtn) settingsBtn.click();
    });
}

// --- AUTO-LOCK SYSTEM (7 Days for Admin) ---
let inactivityTimer;
const INACTIVITY_LIMIT = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);

    // Only set timer if user is authenticated
    if (localStorage.getItem('wm_auth')) {
        inactivityTimer = setTimeout(() => {
            console.log("Inactivity detected. Locking session...");
            localStorage.removeItem('wm_auth');
            window.location.reload();
        }, INACTIVITY_LIMIT);
    }
}

// User interactions to monitor
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Initial start
resetInactivityTimer();

// Start
init();
