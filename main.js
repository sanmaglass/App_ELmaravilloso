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
    calculator: () => window.Views.calculator(document.getElementById('view-container')),
    settings: () => window.Views.settings(document.getElementById('view-container')),
    profit_monitor: () => window.Views.profit_monitor(document.getElementById('view-container')),
    abc_analysis: () => window.Views.abc_analysis(document.getElementById('view-container')),
    daily_sales: () => window.Views.daily_sales(document.getElementById('view-container')),
    suppliers: () => window.Views.suppliers(document.getElementById('view-container')),
    purchase_invoices: () => window.Views.purchase_invoices(document.getElementById('view-container')),
    expenses: () => window.Views.expenses(document.getElementById('view-container')),
    sales_invoices: () => window.Views.sales_invoices(document.getElementById('view-container')),
    loans: () => window.Views.loans(document.getElementById('view-container')),
    cash_register: () => window.Views.cash_register(document.getElementById('view-container')),
    credits: () => window.Views.credits(document.getElementById('view-container')),
    barcode: () => window.Views.barcode(document.getElementById('view-container'))
};

// ── Tema neutro premium para Chart.js (gris-dominante, sin glow) ──
(function themeCharts() {
    if (typeof window.Chart === 'undefined' || window.Chart._wmThemed) return;
    try {
        const C = window.Chart;
        C._wmThemed = true;
        const mono = "'JetBrains Mono','Cascadia Code','SF Mono','Consolas',monospace";
        C.defaults.font.family = mono;
        C.defaults.font.size = 11;
        C.defaults.color = '#9aa4b2';
        C.defaults.borderColor = 'rgba(255,255,255,0.06)';
        const el = C.defaults.elements || {};
        if (el.line) { el.line.tension = 0.35; el.line.borderWidth = 2; }
        if (el.point) { el.point.radius = 0; el.point.hoverRadius = 4; el.point.hoverBackgroundColor = '#4c8dff'; el.point.hoverBorderColor = '#4c8dff'; }
        if (el.bar) { el.bar.borderRadius = 4; }
        if (el.arc) { el.arc.borderColor = '#0a0c0f'; el.arc.borderWidth = 2; }
        const P = C.defaults.plugins || {};
        if (P.legend) { P.legend.labels = P.legend.labels || {}; P.legend.labels.color = '#9aa4b2'; P.legend.labels.boxWidth = 10; P.legend.labels.font = { family: mono, size: 10 }; }
        if (P.tooltip) {
            Object.assign(P.tooltip, {
                backgroundColor: 'rgba(16,19,25,0.97)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1,
                titleColor: '#eef1f5', bodyColor: '#9aa4b2', padding: 10, cornerRadius: 8, displayColors: false,
                titleFont: { family: mono, weight: '700' }, bodyFont: { family: mono }
            });
        }
        if (C.defaults.scale && C.defaults.scale.grid) {
            C.defaults.scale.grid.color = 'rgba(255,255,255,0.05)';
            C.defaults.scale.ticks = C.defaults.scale.ticks || {};
            C.defaults.scale.ticks.color = '#5f6b7a';
        }
    } catch (e) { console.warn('themeCharts:', e); }
})();

// --- AUTH GATE: Supabase Auth ---
// Versión de sesión — v3 = Supabase Auth (v2 era hash local)
const SESSION_VERSION = '3';

function showEmailGate() {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';

    document.body.innerHTML = `
        <style>
            @keyframes wm-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
            @keyframes wm-scan { from{background-position:0 0} to{background-position:0 200px} }
            #email-gate::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.55;
                background:
                    repeating-linear-gradient(0deg, rgba(76,141,255,0.05) 0 1px, transparent 1px 3px),
                    radial-gradient(circle at 50% -10%, rgba(76,141,255,0.14), transparent 55%);
                animation: wm-scan 9s linear infinite; }
            #email-gate input::placeholder { color:#5f6b7a; letter-spacing:.05em; }
            #email-gate input:focus { border-color:#4c8dff !important; box-shadow:0 0 0 1px rgba(76,141,255,.5), 0 0 18px rgba(76,141,255,.25) !important; }
            #gate-btn:hover:not(:disabled) { box-shadow:0 0 26px rgba(76,141,255,.5) !important; filter:brightness(1.12); }
            #gate-toggle-pass:hover, #gate-forgot:hover { color:#4c8dff !important; }
            .wm-cursor { display:inline-block; width:9px; color:#4c8dff; animation: wm-blink 1.1s step-end infinite; }
        </style>
        <div id="email-gate" style="position:fixed; inset:0; overflow:hidden; background:#070b08; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono','Cascadia Code','SF Mono','Consolas','Courier New',monospace; z-index:99999;">
            <div style="position:relative; z-index:1; width:90%; max-width:380px; text-align:center;">
                <img src="assets/logo-dark.png" alt="Logo" style="width:80px; height:80px; border-radius:18px; margin-bottom:22px; filter:drop-shadow(0 0 18px rgba(76,141,255,0.45)); border:1px solid rgba(76,141,255,0.25);">
                <h1 style="color:#eef1f5; font-size:1.4rem; font-weight:700; margin:0 0 8px; letter-spacing:0.06em; text-shadow:0 0 12px rgba(76,141,255,0.5);">EL_MARAVILLOSO</h1>
                <p id="gate-subtitle" style="color:#4c8dff; font-size:0.72rem; margin:0 0 30px; letter-spacing:0.12em; text-transform:uppercase;">&gt; acceso_autorizado<span class="wm-cursor">_</span></p>
                <input id="gate-email" type="email" placeholder="correo" autocomplete="email" autofocus
                    style="width:100%; padding:14px 18px; background:#0a0f0b; border:1px solid rgba(76,141,255,0.18); border-radius:11px; color:#eef1f5; font-size:0.95rem; font-family:inherit; outline:none; caret-color:#4c8dff; transition:all 0.2s; margin-bottom:12px; box-sizing:border-box;">
                <div style="position:relative;">
                    <input id="gate-pass" type="password" placeholder="contraseña" autocomplete="current-password"
                        style="width:100%; padding:14px 18px; background:#0a0f0b; border:1px solid rgba(76,141,255,0.18); border-radius:11px; color:#eef1f5; font-size:0.95rem; font-family:inherit; outline:none; caret-color:#4c8dff; transition:all 0.2s; padding-right:48px; box-sizing:border-box;">
                    <button id="gate-toggle-pass" type="button" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#5f6b7a; cursor:pointer; font-size:1.1rem; padding:4px; transition:color .2s;">
                        <i class="ph ph-eye"></i>
                    </button>
                </div>
                <div id="gate-error" style="color:#ff6b6b; font-size:0.8rem; margin-top:10px; min-height:1.2em;"></div>
                <button id="gate-btn" style="width:100%; margin-top:16px; padding:14px; background:linear-gradient(135deg,#4c8dff,#2f6fe0); color:#07121f; border:none; border-radius:11px; font-size:0.95rem; font-weight:700; cursor:pointer; font-family:inherit; letter-spacing:0.08em; text-transform:uppercase; transition:all 0.2s; box-shadow:0 0 20px rgba(76,141,255,0.3);">
                    Ingresar
                </button>
                <div style="margin-top:16px;">
                    <button id="gate-forgot" type="button" style="background:none; border:none; color:#5f6b7a; font-size:0.76rem; cursor:pointer; font-family:inherit; text-decoration:underline; transition:color .2s;">
                        Olvidé mi contraseña
                    </button>
                </div>
                <p style="color:#3a5c48; font-size:0.62rem; margin-top:24px; letter-spacing:0.1em;">// SISTEMA DE GESTIÓN COMERCIAL</p>
            </div>
        </div>
    `;

    const emailInput = document.getElementById('gate-email');
    const passInput = document.getElementById('gate-pass');
    const errorEl = document.getElementById('gate-error');
    const btn = document.getElementById('gate-btn');
    const toggleBtn = document.getElementById('gate-toggle-pass');
    const forgotBtn = document.getElementById('gate-forgot');

    // Toggle ver/ocultar contraseña
    toggleBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        toggleBtn.innerHTML = isPass ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
    });

    // --- Rate limiting: máx 5 intentos, luego bloqueo progresivo ---
    const MAX_ATTEMPTS = 5;
    const BASE_LOCKOUT_MS = 30000; // 30s base, se duplica cada ronda
    let _loginAttempts = 0;
    let _lockedUntil = 0;
    let _lockoutRound = 0;
    let _countdownTimer = null;

    // Restaurar estado de bloqueo si quedó guardado (evita refresh bypass)
    try {
        const saved = JSON.parse(sessionStorage.getItem('wm_login_rl') || '{}');
        if (saved.until && saved.until > Date.now()) {
            _lockedUntil = saved.until;
            _loginAttempts = MAX_ATTEMPTS;
            _lockoutRound = saved.round || 1;
        }
    } catch (_) { /* ignore */ }

    function _startCountdown() {
        btn.disabled = true;
        if (_countdownTimer) clearInterval(_countdownTimer);
        _countdownTimer = setInterval(() => {
            const remaining = Math.ceil((_lockedUntil - Date.now()) / 1000);
            if (remaining <= 0) {
                clearInterval(_countdownTimer);
                _countdownTimer = null;
                _loginAttempts = 0;
                btn.disabled = false;
                btn.textContent = 'Ingresar';
                errorEl.textContent = '';
                return;
            }
            btn.textContent = `Bloqueado (${remaining}s)`;
            errorEl.textContent = 'Demasiados intentos. Espera antes de reintentar.';
        }, 1000);
    }

    // Si ya está bloqueado al cargar, iniciar countdown
    if (_lockedUntil > Date.now()) _startCountdown();

    async function attemptLogin() {
        // Verificar bloqueo activo
        if (_lockedUntil > Date.now()) return;

        const email = (emailInput.value || '').trim().toLowerCase();
        const pass = passInput.value || '';

        if (!email || !email.includes('@')) {
            errorEl.textContent = 'Ingresa un correo válido';
            emailInput.style.borderColor = '#ff6b6b';
            return;
        }
        if (!pass) {
            errorEl.textContent = 'Ingresa tu contraseña';
            passInput.style.borderColor = '#ff6b6b';
            return;
        }

        btn.textContent = 'Verificando...';
        btn.disabled = true;

        try {
            await window.Auth.login(email, pass);
            // Login exitoso — limpiar rate limit y reload
            sessionStorage.removeItem('wm_login_rl');
            window.location.reload();
        } catch (err) {
            _loginAttempts++;
            const msg = err.message || '';

            if (msg.includes('Invalid login')) {
                const left = MAX_ATTEMPTS - _loginAttempts;
                errorEl.textContent = left > 0
                    ? `Correo o contraseña incorrectos (${left} intento${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'})`
                    : 'Correo o contraseña incorrectos';
            } else if (msg.includes('Email not confirmed')) {
                errorEl.textContent = 'Confirma tu email antes de ingresar';
            } else {
                errorEl.textContent = 'Error de conexión. Intenta de nuevo.';
            }

            emailInput.style.borderColor = '#ff6b6b';
            passInput.style.borderColor = '#ff6b6b';

            // Activar bloqueo si se alcanzó el máximo
            if (_loginAttempts >= MAX_ATTEMPTS) {
                _lockoutRound++;
                const lockMs = BASE_LOCKOUT_MS * Math.pow(2, _lockoutRound - 1); // 30s, 60s, 120s...
                _lockedUntil = Date.now() + lockMs;
                sessionStorage.setItem('wm_login_rl', JSON.stringify({ until: _lockedUntil, round: _lockoutRound }));
                _startCountdown();
                return;
            }

            btn.textContent = 'Ingresar';
            btn.disabled = false;
            console.warn('Login error:', msg);
        }
    }

    // Recuperar contraseña
    forgotBtn.addEventListener('click', async () => {
        const email = (emailInput.value || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
            errorEl.textContent = 'Ingresa tu correo primero';
            emailInput.style.borderColor = '#ff6b6b';
            return;
        }
        try {
            await window.Auth.resetPassword(email);
            errorEl.style.color = '#4ade80';
            errorEl.textContent = 'Se envió un link a tu correo para restablecer la contraseña';
        } catch (err) {
            errorEl.textContent = 'Error al enviar email. Intenta de nuevo.';
        }
    });

    btn.addEventListener('click', attemptLogin);
    emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passInput.focus(); });
    passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
    emailInput.addEventListener('input', () => { errorEl.textContent = ''; errorEl.style.color = '#ff6b6b'; emailInput.style.borderColor = 'rgba(76,141,255,0.18)'; });
    passInput.addEventListener('input', () => { errorEl.textContent = ''; errorEl.style.color = '#ff6b6b'; passInput.style.borderColor = 'rgba(76,141,255,0.18)'; });
}

// Initialize App
async function init() {
    try {
        // --- AUTH CHECK: Supabase Auth ---
        window.Auth.init();
        const session = await window.Auth.getSession();

        if (!session) {
            showEmailGate();
            return;
        }

        // Sesión válida — cargar tenant
        window.Auth.session = session;
        await window.Auth._loadTenant();
        window.state.currentUser = session.user.email;
        localStorage.setItem('wm_auth', 'true');
        localStorage.setItem('wm_auth_email', session.user.email);
        localStorage.setItem('wm_user', session.user.email.split('@')[0]);

        // Auth passed - iniciar guard de inactividad
        if (window.InactivityGuard) window.InactivityGuard.start();

        // Database initialization
        try {
            await window.seedDatabase();
            await window.migratePendienteToPagado();
        } catch (dbError) {
            console.error("Database initialization failed:", dbError);
            showError('Error de Base de Datos',
                'No se pudo inicializar la base de datos local. Intenta recargar la página.',
                dbError.message
            );
            return;
        }

        // Cloud sync initialization v2 — FIRE-AND-FORGET (no bloquea el render del dashboard)
        // El dashboard se muestra inmediatamente con datos locales de Dexie; sync corre en background.
        (async () => {
            try {
                console.log("1️⃣ Inicializando SyncV2 (background)...");
                const synced = await window.SyncV2.init();

                if (synced) {
                    window.Sync?.updateIndicator?.('syncing');
                    console.log("2️⃣ SyncV2 listo - iniciando pull incremental...");
                    await window.SyncV2.syncAll();

                    console.log("3️⃣ Pull completado - iniciando Realtime...");
                    await window.SyncV2.initRealtimeSync();

                    // Polling cada 90s como red de seguridad aunque la pestaña esté oculta.
                    if (window._syncPollingInterval) clearInterval(window._syncPollingInterval);
                    window._syncPollingInterval = setInterval(() => {
                        if (!window.SyncV2.isSyncing) {
                            window.SyncV2.syncAll();
                        }
                    }, 90 * 1000);

                    // Heartbeat Realtime: cada 30s revisa si todos los canales siguen "joined".
                    if (window._heartbeatInterval) clearInterval(window._heartbeatInterval);
                    let _heartbeatRunning = false;
                    window._heartbeatInterval = setInterval(async () => {
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
                                window.SyncV2.syncAll();
                            }
                        } catch (e) { console.error('heartbeat error:', e); }
                        finally { _heartbeatRunning = false; }
                    }, 30 * 1000);

                    window.Sync?.updateIndicator?.('realtime');
                    console.log("✅ SyncV2 activado (Realtime + Polling 90s)");
                } else {
                    window.Sync?.updateIndicator?.('off');
                }
            } catch (syncError) {
                console.error("❌ SyncV2 init falló:", syncError);
                window.Sync?.updateIndicator?.('error', syncError.message || 'Error de sincronización');
            }
        })();

        // Navigation Logic
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Logout Check
                if (btn.dataset.view === 'logout') {
                    showConfirmModal('¿Cerrar sesión?', 'Se cerrará tu sesión en este dispositivo.', () => {
                        window.Auth.logout();
                    });
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
                    // Cleanup previous view (camera, timers, etc.)
                    if (window._viewCleanup) {
                        try { window._viewCleanup(); } catch (e) { /* ignore */ }
                        window._viewCleanup = null;
                    }
                    // Fade-in transition al cambiar de vista (150ms)
                    const vc = document.getElementById('view-container');
                    if (vc) {
                        vc.classList.remove('view-fade-in');
                        // Force reflow para reiniciar la animación
                        void vc.offsetWidth;
                        vc.classList.add('view-fade-in');
                    }
                    views[viewName]();
                }

                // Close sidebar on mobile after navigation
                if (sidebar.classList.contains('open')) {
                    toggleSidebar();
                }

                // Sincronizar bottom-nav active state
                syncBottomNav(viewName);
            });
        });

        // Bottom Nav — tabs mobile
        const bottomTabs = document.querySelectorAll('#bottom-nav .bottom-nav-item');

        function syncBottomNav(viewName) {
            bottomTabs.forEach(t => t.classList.remove('active'));
            const activeTab = document.querySelector(`#bottom-nav .bottom-nav-item[data-view="${viewName}"]`);
            if (activeTab) activeTab.classList.add('active');
        }

        function navigateToView(viewName, label) {
            // Cleanup previous view
            if (window._viewCleanup) {
                try { window._viewCleanup(); } catch (e) { /* ignore */ }
                window._viewCleanup = null;
            }
            // Fade-in transition
            const vc = document.getElementById('view-container');
            if (vc) {
                vc.classList.remove('view-fade-in');
                void vc.offsetWidth;
                vc.classList.add('view-fade-in');
            }
            if (label) document.getElementById('page-title').textContent = label;
            if (views[viewName]) views[viewName]();
            // Sync sidebar active state
            navItems.forEach(b => b.classList.remove('active'));
            const sidebarMatch = document.querySelector(`.nav-item[data-view="${viewName}"]`);
            if (sidebarMatch) sidebarMatch.classList.add('active');
            // Sync bottom-nav active state
            syncBottomNav(viewName);
        }
        // Exponer globalmente para accesos rápidos del dashboard
        window.navigateToView = navigateToView;

        bottomTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const viewName = tab.dataset.view;
                // Sync bottom-nav active
                bottomTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Sync sidebar active (in case sidebar is visible)
                navItems.forEach(b => b.classList.remove('active'));
                const matchingSidebarItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
                if (matchingSidebarItem) matchingSidebarItem.classList.add('active');
                // Navigate
                const label = tab.querySelector('span')?.textContent;
                navigateToView(viewName, label);
            });
        });

        // Bottom Nav Logic (Mobile)
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            const bottomItems = bottomNav.querySelectorAll('.bottom-nav-item[data-view]');
            bottomItems.forEach(btn => {
                btn.addEventListener('click', () => {
                    const viewName = btn.dataset.view;
                    if (!views[viewName]) return;

                    // Update bottom nav active state
                    bottomNav.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Also sync sidebar active state
                    navItems.forEach(b => b.classList.remove('active'));
                    const sidebarMatch = document.querySelector(`.nav-item[data-view="${viewName}"]`);
                    if (sidebarMatch) sidebarMatch.classList.add('active');

                    // Update page title
                    const titleMap = { dashboard: 'Resumen', daily_sales: 'Cierres Diarios', cash_register: 'Arqueo de Caja', credits: 'Créditos', barcode: 'Escáner' };
                    document.getElementById('page-title').textContent = titleMap[viewName] || viewName;

                    // Cleanup and navigate
                    if (window._viewCleanup) {
                        try { window._viewCleanup(); } catch (e) { /* ignore */ }
                        window._viewCleanup = null;
                    }
                    views[viewName]();
                });
            });

            // "Más" button opens popup menu (not full sidebar)
            const btnMore = document.getElementById('btn-bottom-more');
            const moreMenu = document.getElementById('more-menu');
            const moreOverlay = document.getElementById('more-menu-overlay');

            function toggleMoreMenu() {
                moreMenu.classList.toggle('active');
                moreOverlay.classList.toggle('active');
            }

            if (btnMore && moreMenu) {
                btnMore.addEventListener('click', toggleMoreMenu);
                moreOverlay.addEventListener('click', toggleMoreMenu);

                // Each menu item navigates and closes popup
                moreMenu.querySelectorAll('.more-menu-item[data-view]').forEach(item => {
                    item.addEventListener('click', () => {
                        const viewName = item.dataset.view;
                        if (!views[viewName]) return;

                        toggleMoreMenu();

                        // Clear bottom nav active (none of these views are in bottom nav)
                        bottomNav.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

                        // Sync sidebar
                        navItems.forEach(b => b.classList.remove('active'));
                        const sidebarMatch = document.querySelector(`.nav-item[data-view="${viewName}"]`);
                        if (sidebarMatch) sidebarMatch.classList.add('active');

                        const titleMap2 = { cash_register: 'Arqueo de Caja', employees: 'Personal', expenses: 'Gastos', suppliers: 'Proveedores', purchase_invoices: 'Facturas', loans: 'Préstamos', profit_monitor: 'Márgenes', abc_analysis: 'ABC Productos', calculator: 'Costeo', settings: 'Ajustes' };
                        document.getElementById('page-title').textContent = titleMap2[viewName] || viewName;

                        if (window._viewCleanup) {
                            try { window._viewCleanup(); } catch (e) { /* ignore */ }
                            window._viewCleanup = null;
                        }
                        views[viewName]();
                    });
                });
            }

            // Sync bottom nav when sidebar nav is used
            navItems.forEach(btn => {
                btn.addEventListener('click', () => {
                    const viewName = btn.dataset.view;
                    if (!viewName || viewName === 'logout') return;
                    bottomNav.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
                    const bottomMatch = bottomNav.querySelector(`[data-view="${viewName}"]`);
                    if (bottomMatch) bottomMatch.classList.add('active');
                });
            });
        }

        // Ocultar splash y mostrar app
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';

        // Inicializar Alertas Globales de Supabase (Créditos y Retiros)
        // Reusar el cliente de SyncV2 para no duplicar conexiones Realtime
        try {
            const alertClient = window.SyncV2.client;
            if (alertClient) {
                console.log("🔔 Iniciando suscripción a alertas globales...");
                alertClient.channel('global-alerts')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eleventa_alertas' }, payload => {
                        const alertData = payload.new;
                        console.log('🚨 ALERTA RECIBIDA:', alertData);
                        const isCredit = alertData.tipo === 'CREDITO_OTORGADO';
                        const icon = isCredit ? '<i class="ph ph-hand-holding-dollar" style="color:#f59e0b"></i>' : '<i class="ph ph-warning-circle" style="color:#dc2626"></i>';

                        const toastContainer = document.getElementById('toast-container');
                        if(!toastContainer) return;
                        const toast = document.createElement('div');
                        toast.className = `toast toast-${isCredit ? 'warning' : 'error'}`;
                        toast.innerHTML = `<div style="display:flex; align-items:center; gap:8px;">${icon} <span style="font-weight:bold;">${Utils.escapeHTML(alertData.mensaje)}</span></div>`;
                        toastContainer.appendChild(toast);

                        setTimeout(() => {
                            toast.style.opacity = '0';
                            setTimeout(() => toast.remove(), 300);
                        }, 6000);

                        if (window.AppNotify) window.AppNotify.playChime(isCredit ? 'success' : 'error');
                    })
                    .subscribe();
            }
        } catch (e) {
            console.error('Error suscribiendo a eleventa_alertas', e);
        }

        // Push Notifications — registrar SW y re-suscribir si ya tenía permiso
        try {
            if (window.PushSubscribe) {
                await window.PushSubscribe.init();
                // Si ya tenía permiso, suscribir automáticamente
                if (Notification.permission === 'granted') {
                    await window.PushSubscribe.subscribe();
                }
            }
        } catch (pushErr) {
            console.warn('[Push] Init error (no crítico):', pushErr);
        }

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
            console.log("🌐 Online - sincronizando...");
            window.Outbox?.drain();
            window.SyncV2?.syncAll();
            if (window.showToast) window.showToast('Conexión restaurada', 'success');
        });

        // Aviso cuando se pierde conexión
        window.addEventListener('offline', () => {
            if (window.showToast) window.showToast('Sin conexión — los cambios se guardan localmente', 'warning');
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

// Custom confirm modal (replaces native confirm)
function showConfirmModal(title, message, onConfirm) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal" style="max-width:400px; text-align:center; padding:32px;">
            <div style="font-size:2.5rem; margin-bottom:16px; color:var(--text-muted);"><i class="ph ph-warning-circle"></i></div>
            <h3 style="margin:0 0 8px; font-size:1.15rem; color:var(--text-primary);">${title}</h3>
            <p style="margin:0 0 24px; font-size:0.9rem; color:var(--text-muted);">${message}</p>
            <div style="display:flex; gap:12px; justify-content:center;">
                <button class="btn btn-secondary" id="confirm-cancel" style="flex:1; max-width:140px;">Cancelar</button>
                <button class="btn btn-danger" id="confirm-ok" style="flex:1; max-width:140px; background:var(--danger); color:white; border:none;">Confirmar</button>
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        modalContainer.classList.add('hidden');
        modalContainer.innerHTML = '';
    });
    document.getElementById('confirm-ok').addEventListener('click', () => {
        modalContainer.classList.add('hidden');
        modalContainer.innerHTML = '';
        onConfirm();
    });
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            modalContainer.classList.add('hidden');
            modalContainer.innerHTML = '';
        }
    }, { once: true });
}
window.showConfirmModal = showConfirmModal;

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

// Auto-lock eliminado: la sesión persiste indefinidamente en el dispositivo.
// El usuario solo vuelve a ver login si cierra sesión manualmente (botón logout)
// o si se incrementa SESSION_VERSION para forzar re-login global.

// --- Focus Trap para modales (accesibilidad) ---
(function initFocusTrap() {
    const mc = document.getElementById('modal-container');
    if (!mc) return;

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function trapFocus(e) {
        if (e.key !== 'Tab') return;
        const focusable = mc.querySelectorAll(FOCUSABLE);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function onEscape(e) {
        if (e.key === 'Escape' && !mc.classList.contains('hidden')) {
            mc.classList.add('hidden');
        }
    }

    const observer = new MutationObserver(() => {
        if (!mc.classList.contains('hidden')) {
            // Modal abierto: activar trap + foco al primer elemento
            document.addEventListener('keydown', trapFocus);
            document.addEventListener('keydown', onEscape);
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                const first = mc.querySelector(FOCUSABLE);
                if (first) first.focus();
            });
        } else {
            // Modal cerrado: desactivar
            document.removeEventListener('keydown', trapFocus);
            document.removeEventListener('keydown', onEscape);
            document.body.style.overflow = '';
        }
    });

    observer.observe(mc, { attributes: true, attributeFilter: ['class'] });
})();

// Start
init();
