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
                const syncRes = await window.Sync.init();

                if (syncRes.success && window.Sync.client) {
                    updateSplash(80, 'VERIFICANDO SESIÓN...');
                    await window.Sync.client.auth.getSession();

                    // Render Dashboard immediately
                    views.dashboard();

                    updateSplash(90, 'DESBLOQUEANDO INTERFAZ...');

                    // Background sync (async skip waiting)
                    window.Sync.syncAll().then(() => {
                        console.log('Background Sync Completed');
                        const current = window.state.currentView;
                        if (views[current]) views[current]();
                    });

                    await window.Sync.initRealtimeSync();
                    window.Sync.startAutoSync(60000);
                } else {
                    updateSplash(80, 'MODO LOCAL ACTIVO');
                    views.dashboard();
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
        // Muestra el splash brevemente cada vez que el usuario vuelve a la app
        let _lastHidden = null;
        document.addEventListener('visibilitychange', () => {
            const splash = document.getElementById('splash-screen');
            if (!splash) return;

            if (document.hidden) {
                // App fue al fondo — registrar el momento
                _lastHidden = Date.now();
            } else {
                // App vuelve al frente — mostrar splash si estuvo en fondo > 3 segundos
                const awayTime = Date.now() - (_lastHidden || 0);
                if (_lastHidden && awayTime > 3000) {
                    // Mostrar splash
                    const bar = document.getElementById('splash-bar');
                    splash.classList.remove('hidden');
                    splash.style.opacity = '1';
                    splash.style.visibility = 'visible';

                    // Animar barra de carga
                    if (bar) {
                        bar.style.transition = 'none';
                        bar.style.width = '0%';
                        setTimeout(() => {
                            bar.style.transition = 'width 1s ease-out';
                            bar.style.width = '100%';
                        }, 50);
                    }

                    // Ocultar tras 1.2 segundos (como iOS)
                    setTimeout(() => {
                        splash.classList.add('hidden');
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
            const dueReminders = await window.db.reminders
                .where('[completed+deleted]').equals([0, 0])
                .and(r => new Date(r.next_run) <= now)
                .toArray();

            for (const reminder of dueReminders) {
                await this.trigger(reminder);
            }
        } catch (e) {
            console.error('ReminderEngine Check Error:', e);
        }
    },

    async trigger(reminder) {
        console.log(`🚀 Triggering Reminder: ${reminder.title}`);

        // 1. Show Notification (Only if hidden)
        if (document.visibilityState !== 'visible') {
            window.Utils.NotificationManager.show(
                'Recordatorio: ' + reminder.title,
                'Es momento de realizar esta tarea pendiente.',
                './index.html'
            );
        } else {
            // If visible, just show a Toast
            window.Sync.showToast('Recordatorio: ' + reminder.title, 'info');
        }

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
