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
    settings: () => window.Views.settings(document.getElementById('view-container')),
    profit_monitor: () => window.Views.profit_monitor(document.getElementById('view-container')),
    daily_sales: () => window.Views.daily_sales(document.getElementById('view-container')),
    suppliers: () => window.Views.suppliers(document.getElementById('view-container')),
    purchase_invoices: () => window.Views.purchase_invoices(document.getElementById('view-container')),
    loans: () => window.Views.loans(document.getElementById('view-container')),
    reminders: () => window.Views.reminders(document.getElementById('view-container')),
    reports: () => window.Views.reports(document.getElementById('view-container')),
    sales_invoices: () => window.Views.sales_invoices(document.getElementById('view-container')),
    expenses: () => window.Views.expenses(document.getElementById('view-container')),
    electronic_invoices: () => window.Views.electronic_invoices(document.getElementById('view-container'))
};

// Initialize App
async function init() {
    try {
        // --- AUTH CHECK ---
        // Usar localStorage para que persista entre recargas/cierres
        let isAuth = localStorage.getItem('wm_auth');
        if (!isAuth) {
            // Auto-login: setear como autenticado
            localStorage.setItem('wm_auth', 'true');
            localStorage.setItem('wm_user', 'Administrador');
            isAuth = 'true';
        }

        // Auth passed - continue with initialization
        // Splash screen already visible, will hide it after DB init

        // Database initialization
        try {
            await window.seedDatabase();
        } catch (dbError) {
            console.error("Database initialization failed:", dbError);
            showError('Error de Base de Datos',
                'No se pudo inicializar la base de datos local. Intenta recargar la página.',
                dbError.message
            );
            return;
        }

        // Cloud sync initialization v2 (non-blocking)
        try {
            console.log("1️⃣ Inicializando SyncV2...");
            const synced = await window.SyncV2.init();

            if (synced) {
                window.Sync?.updateIndicator?.('syncing');
                console.log("2️⃣ SyncV2 listo - iniciando pull incremental...");
                await window.SyncV2.syncAll();
                console.log("3️⃣ Pull completado - iniciando Realtime...");
                await window.SyncV2.initRealtimeSync();

                // Polling cada 90s como red de seguridad aunque la pestaña esté oculta.
                // Caso de uso real: un monitor que muestra el dashboard 24/7. Si la pestaña
                // pierde el foco (otra app al frente, otra pestaña activa), el navegador la
                // marca "hidden". No queremos dejar de refrescar en ese caso — los datos en
                // pantalla tienen que estar siempre al día. 90s es un compromiso: suficiente
                // para tapar caídas silenciosas del WebSocket Realtime sin saturar la red.
                setInterval(() => {
                    if (!window.SyncV2.isSyncing) {
                        window.SyncV2.syncAll();
                    }
                }, 90 * 1000);

                // Heartbeat Realtime: cada 30s revisa si todos los canales siguen "joined".
                // Si alguno murió (timeout del proxy, blip de red, suspend del laptop),
                // cerramos y re-suscribimos. Sin esto, un canal caído en background nunca
                // se recupera hasta recargar la página.
                // Guard de reentrada: si un tick anterior todavía está reconectando, el
                // siguiente se salta su ciclo. Evita que dos reconexiones se pisen si la
                // red está lenta y close+init tarda más de 30s.
                let _heartbeatRunning = false;
                setInterval(async () => {
                    if (_heartbeatRunning) return;
                    _heartbeatRunning = true;
                    try {
                        const channels = window.SyncV2.realtimeChannels || [];
                        const alive = channels.filter(c => c?.state === 'joined').length;
                        const expected = Object.keys(window.Constants.REMOTE_TABLE_MAP).length;
                        if (alive < expected) {
                            console.warn(`💔 Realtime degradado (${alive}/${expected}) — reconectando...`);
                            await window.SyncV2.closeRealtime();
                            await window.SyncV2.initRealtimeSync();
                            // Pull inmediato para recuperar lo perdido mientras estuvo caído
                            window.SyncV2.syncAll();
                        }
                    } catch (e) { console.error('heartbeat error:', e); }
                    finally { _heartbeatRunning = false; }
                }, 30 * 1000);

                // El badge del header lo mantiene la función legacy Sync.updateIndicator.
                // SyncV2 reemplazó al sistema viejo pero el indicador visual seguía huérfano,
                // por eso quedaba en "Sin Nube" aunque Realtime estuviera perfectamente activo.
                window.Sync?.updateIndicator?.('realtime');
                console.log("✅ SyncV2 activado (Realtime + Polling 5min)");
            } else {
                window.Sync?.updateIndicator?.('off');
            }
        } catch (syncError) {
            console.error("❌ SyncV2 init falló:", syncError);
            window.Sync?.updateIndicator?.('error', syncError.message || 'Error de sincronización');
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

        // Ocultar splash y mostrar app
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';

        // Initial Load
        views.dashboard();

        // Sincronizar cuando vuelve a primer plano
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log("📱 Primer plano - sync...");
                window.SyncV2.syncAll();
            }
        });

        // Sincronizar cuando se conecta a internet
        window.addEventListener('online', () => {
            console.log("🌐 Online - drenando outbox...");
            window.Outbox?.drain();
        });
    } catch (err) {
        console.error("Critical Init Error:", err);
        showError('Error de Carga',
            'No se pudo cargar la aplicación. Por favor recarga la página.',
            err.message
        );
    }
}

// Helper function to show user-friendly errors
function showError(title, message, details) {
    const safeTitle = window.Utils ? window.Utils.escapeHTML(title || '') : title;
    const safeMessage = window.Utils ? window.Utils.escapeHTML(message || '') : message;
    const safeDetails = details ? (window.Utils ? window.Utils.escapeHTML(details) : details) : '';

    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: 'Outfit', sans-serif; padding: 20px;">
            <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 40px; border-radius: 20px; max-width: 500px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                <h1 style="margin: 0 0 10px 0; font-size: 28px;">${safeTitle}</h1>
                <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">${safeMessage}</p>
                ${safeDetails ? `<details style="text-align: left; margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px; font-size: 12px;">
                    <summary style="cursor: pointer; font-weight: 600;">Detalles técnicos</summary>
                    <code style="display: block; margin-top: 10px; white-space: pre-wrap; word-break: break-word;">${safeDetails}</code>
                </details>` : ''}
                <button onclick="window.location.reload()" style="margin-top: 30px; padding: 12px 30px; background: white; color: #667eea; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;">
                    🔄 Recargar Aplicación
                </button>
            </div>
        </div>
    `;
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

// --- AUTO-LOCK SYSTEM (5 Minutes) ---
let inactivityTimer;
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes in ms

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
