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
        // --- AUTH CHECK ---
        const isAuth = localStorage.getItem('wm_auth');
        if (!isAuth) {
            // Show Login View, bypass standard app load
            document.querySelector('.app-container').style.display = 'none'; // Hide main layout

            // Create a dedicated container for login if needed or use body
            let loginContainer = document.getElementById('login-wrapper');
            if (!loginContainer) {
                loginContainer = document.createElement('div');
                loginContainer.id = 'login-wrapper';
                document.body.appendChild(loginContainer);
            }

            window.Views.login(loginContainer);
            return; // Stop initialization
        }

        // If Auth passed, ensure main layout is visible
        const loginWrapper = document.getElementById('login-wrapper');
        if (loginWrapper) loginWrapper.remove();
        document.querySelector('.app-container').style.display = 'flex';

        // --- SPLASH SCREEN START ---
        const splash = document.getElementById('splash-screen');
        const splashBar = document.getElementById('splash-bar');
        const splashStatus = document.getElementById('splash-status-text');

        const updateSplash = (pct, text) => {
            if (splashBar) splashBar.style.width = pct + '%';
            if (splashStatus) splashStatus.textContent = text;
        };

        // Trigger logo intro
        setTimeout(() => splash.classList.add('loaded'), 100);

        updateSplash(20, 'Cargando protocolos...');
        await new Promise(r => setTimeout(r, 400)); // Aesthetic pause

        await window.seedDatabase();
        updateSplash(40, 'Sincronizando base de datos...');

        const syncRes = await window.Sync.init();

        if (syncRes.success) {
            console.log('☁️ Supabase conectado — descargando datos de la nube...');
            updateSplash(60, 'Estableciendo conexión segura...');

            // Sync first before rendering so the view has fresh data
            await window.Sync.syncAll();
            updateSplash(80, 'Actualizando registros locales...');

            // Initialize WebSocket real-time sync (enterprise-grade)
            await window.Sync.initRealtimeSync();

            // Start polling as fallback (60s instead of 5s)
            window.Sync.startAutoSync(60000); // 1 minute
            updateSplash(100, 'Sistema listo.');
        } else {
            updateSplash(100, 'Modo offline activado.');
        }

        // Final transition
        setTimeout(() => {
            splash.classList.add('hidden');
            // Enable scrolling and interactions that might have been blocked
        }, 800);

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
                views[current]();
            }
        });

        // Habilitar clic en el indicador para forzar sincronización
        const syncIndicator = document.getElementById('sync-indicator');
        if (syncIndicator) {
            syncIndicator.addEventListener('click', () => {
                if (window.Sync) {
                    window.Sync.showToast('Sincronizando datos...', 'info');
                    window.dispatchEvent(new CustomEvent('request-sync-all'));
                }
            });
        }
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

// El listener de sincronización ahora se maneja arriba en init()


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
