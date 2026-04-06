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
    reminders: () => window.Views.reminders(document.getElementById('view-container')),
    reports: () => window.Views.reports(document.getElementById('view-container')),
    settings: () => window.Views.settings(document.getElementById('view-container')),
    loans: () => window.Views.loans(document.getElementById('view-container'))
};

// Initialize App
async function init() {
    try {
        // --- AUTH CHECK (Supabase Session) ---
        // First initialize Supabase so we can check session
        await window.Sync.init();

        let isAuthenticated = false;

        if (window.Sync?.client) {
            // Validate real Supabase session
            const { data: { session } } = await window.Sync.client.auth.getSession();
            if (session) {
                isAuthenticated = true;
                localStorage.setItem('wm_user', session.user?.email || 'Usuario');
            }
        } else {
            // Offline fallback: trust localStorage temporarily
            isAuthenticated = localStorage.getItem('wm_auth') === 'true';
        }

        if (!isAuthenticated) {
            localStorage.removeItem('wm_auth');
            document.querySelector('.app-container').style.display = 'none';
            let loginContainer = document.getElementById('login-wrapper');
            if (!loginContainer) {
                loginContainer = document.createElement('div');
                loginContainer.id = 'login-wrapper';
                document.body.appendChild(loginContainer);
            }
            window.Views.login(loginContainer);
            return;
        }

        // Auth passed — mark session and show app
        localStorage.setItem('wm_auth', 'true');
        const loginWrapper = document.getElementById('login-wrapper');
        if (loginWrapper) loginWrapper.remove();
        document.querySelector('.app-container').style.display = 'flex';

        // Global logout function
        window.AppSignOut = async () => {
            if (window.Sync?.client) {
                await window.Sync.client.auth.signOut();
            }
            localStorage.removeItem('wm_auth');
            localStorage.removeItem('wm_user');
            window.location.reload();
        };


        // 2. Initialization Flow
        const initFlow = async () => {
            const splash = document.getElementById('splash-screen');
            const progressBar = document.getElementById('splash-bar');
            const statusText = document.getElementById('splash-status-text');
            const percentText = document.getElementById('splash-percent');

            const updateSplash = (percent, status) => {
                // Animate the discreet loading bar
                if (progressBar) progressBar.style.width = `${percent}%`;
            };

            try {
                updateSplash(10, 'INICIANDO KERNEL...');

                updateSplash(30, 'CARGANDO BASE DE DATOS...');
                await window.seedDatabase();

                updateSplash(60, 'CONECTANDO CON LA NUBE...');
                // Sync.init() already ran during auth check — reuse existing client
                const syncReady = !!window.Sync.client;

                if (syncReady) {
                    // Render Dashboard immediately
                    views.dashboard();

                    updateSplash(90, 'DESBLOQUEANDO INTERFAZ...');

                    // Init notification system
                    window.AppNotify?.init();

                    // Background sync (async skip waiting)
                    window.Sync.syncAll().then(() => {
                        console.log('Background Sync Completed');
                        // Redundant re-render removed to prevent UI flicker/stuck modals
                    });

                    await window.Sync.initRealtimeSync();
                    window.Sync.startAutoSync(60000);
                } else {
                    updateSplash(80, 'MODO LOCAL ACTIVO');
                    views.dashboard();
                    window.AppNotify?.init();
                }

                updateSplash(100, 'SISTEMA LISTO');
                console.log("System Initialized: v210.0.1 (Digital Master Fix)");

                setTimeout(() => {
                    splash.classList.add('hidden');
                }, 800);

            } catch (error) {
                console.error('Fatal Initialization Error:', error);
                updateSplash(100, 'ERROR EN EL ARRANQUE');
            }
        };
        // Trigger the new initialization flow
        await initFlow();

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
                localStorage.setItem('wm_current_view', viewName); // Persist view for reloads
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

        // Initial Load (Restore from localStorage if possible)
        const savedView = localStorage.getItem('wm_current_view') || 'dashboard';
        window.state.currentView = savedView;
        if (views[savedView]) {
            views[savedView]();
            // Highlight correct nav item
            navItems.forEach(b => {
                if (b.dataset.view === savedView) b.classList.add('active');
                else b.classList.remove('active');
            });
            const titleEl = document.getElementById('page-title');
            const navBtn = Array.from(navItems).find(b => b.dataset.view === savedView);
            if (titleEl && navBtn) titleEl.textContent = navBtn.querySelector('span').textContent;
        }

        // Global initialization timestamp for sync guards
        window._appInitializedAt = Date.now();

        // GLOBAL SYNC LISTENER: Solo actúa en vistas sin syncHandler propio
        // Las vistas con su propio syncHandler (purchase_invoices, expenses, daily_sales, etc.)
        // se auto-refrescan. Este listener solo cubre el dashboard y vistas sin handler.
        const VIEWS_WITH_OWN_SYNC = new Set([
            'purchase_invoices', 'expenses', 'daily_sales', 'employees',
            'sales_invoices', 'reminders', 'suppliers', 'marketing'
        ]);
        let _globalSyncDebounce = null;
        window.addEventListener('sync-data-updated', () => {
            const current = window.state.currentView;
            if (VIEWS_WITH_OWN_SYNC.has(current)) return; // Ya tiene su propio handler

            // GUARDIA DE ARRANQUE: Durante los primeros 3 segundos, ignorar refrescos globales
            // si el dashboard ya está visible, para evitar el parpadeo de "carga múltiple".
            const timeSinceInit = Date.now() - window._appInitializedAt;
            if (timeSinceInit < 3000 && current === 'dashboard') {
                if (window._debugMode) console.log("🛡️ Sync Guard: Ignorando refresco de Dashboard durante arranque crítico.");
                return;
            }

            clearTimeout(_globalSyncDebounce);
            _globalSyncDebounce = setTimeout(() => {
                if (window._debugMode) console.log("♻️ Global sync refresh for:", current);
                if (views[current]) views[current]();
            }, 600);
        });

        // Evento para forzar sincronización total desde cualquier parte
        window.addEventListener('request-sync-all', async () => {
            if (window.Sync) {
                await window.Sync.syncAll();
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
        // --- REMINDER ENGINE START ---
        if (window.ReminderEngine) window.ReminderEngine.start();

        // --- SPLASH ON RESUME (como app nativa iOS) ---
        let _lastHidden = null;
        let _splashTimer = null;
        document.addEventListener('visibilitychange', () => {
            const splash = document.getElementById('splash-screen');
            if (!splash) return;

            if (document.hidden) {
                _lastHidden = Date.now();
            } else {
                const awayTime = Date.now() - (_lastHidden || 0);
                if (_lastHidden && awayTime > 3000) {
                    if (_splashTimer) clearTimeout(_splashTimer);
                    
                    splash.removeAttribute('style');
                    splash.classList.remove('hidden');

                    _splashTimer = setTimeout(() => {
                        splash.style.opacity = '0';
                        splash.style.transition = 'opacity 0.6s ease';
                        setTimeout(() => {
                            splash.classList.add('hidden');
                            splash.removeAttribute('style');
                        }, 600);
                        _splashTimer = null;
                    }, 1200);
                }
            }
        });


    } catch (err) {
        console.error("Critical Init Error:", err);
        document.body.innerHTML = `<div style="color:white; padding:50px; text-align:center;"><h1>Error de Carga</h1><p>${err.message}</p></div>`;
    }
}

// --- REMINDER ENGINE (Background Checker) ---
window.ReminderEngine = {
    _interval: null,

    start() {
        if (this._interval) return;
        console.log("🔔 Reminder Engine Started");
        this.check(); // Check immediately on start
        this._interval = setInterval(() => this.check(), 60000); // Every minute
    },

    async check() {
        try {
            const now = new Date();
            // Use filter() — compound index fails with boolean deleted values from Supabase
            const dueReminders = await window.db.reminders
                .filter(r => !r.deleted && !r.completed && new Date(r.next_run) <= now)
                .toArray();

            for (const reminder of dueReminders) {
                await this.trigger(reminder);
            }

            // Always update badge count
            window.AppNotify?.updateBadge();
        } catch (e) {
            console.error('ReminderEngine Check Error:', e);
        }
    },

    async trigger(reminder) {
        console.log(`🚀 Triggering Reminder: ${reminder.title}`);

        // Fire AppNotify (sound + notification + toast)
        window.AppNotify?.fire(reminder);

        // 2. Handle Recurrence or Completion
        if (reminder.type === 'periodic') {
            const next = new Date(reminder.next_run);
            if (reminder.frequency_unit === 'hours') {
                next.setHours(next.getHours() + (reminder.frequency_value || 1));
            } else if (reminder.frequency_unit === 'days') {
                next.setDate(next.getDate() + (reminder.frequency_value || 1));
            }

            // Si por alguna razón la app estuvo cerrada mucho tiempo y el "next" sigue siendo en el pasado,
            // lo adelantamos hasta el futuro para evitar bucle de notificaciones.
            const now = new Date();
            while (next <= now) {
                if (reminder.frequency_unit === 'hours') next.setHours(next.getHours() + (reminder.frequency_value || 1));
                else next.setDate(next.getDate() + (reminder.frequency_value || 1));
            }

            await window.DataManager.saveAndSync('reminders', {
                ...reminder,
                next_run: next.toISOString()
            });
        } else {
            // One-time reminder
            await window.DataManager.saveAndSync('reminders', {
                ...reminder,
                completed: 1
            });
        }

        // Trigger view refresh if we are in reminders view
        if (window.state.currentView === 'reminders') {
            window.dispatchEvent(new CustomEvent('sync-data-updated'));
        }
    }
};

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
