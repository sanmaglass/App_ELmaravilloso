// Main App Controller (Global Scope, Loaded Last)

// Application State
const state = {
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
    settings: () => window.Views.settings(document.getElementById('view-container'))
};

// Initialize App
async function init() {
    try {
        // --- AUTH CHECK ---
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

        // If Auth passed, ensure main layout is visible
        document.querySelector('.app-container').style.display = 'flex';

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

        // Cloud sync initialization (non-blocking)
        try {
            await window.Sync.init();
        } catch (syncError) {
            console.warn("Cloud sync initialization failed:", syncError);
            // Don't block app loading if cloud sync fails
            // User will see "Sin Nube" indicator
        }

        // Navigation Logic
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Logout Check
                if (btn.dataset.view === 'logout') {
                    if (confirm('¿Cerrar sesión?')) {
                        sessionStorage.removeItem('wm_auth');
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

        // Initial Load
        views.dashboard();
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
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: 'Outfit', sans-serif; padding: 20px;">
            <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 40px; border-radius: 20px; max-width: 500px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                <h1 style="margin: 0 0 10px 0; font-size: 28px;">${title}</h1>
                <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">${message}</p>
                ${details ? `<details style="text-align: left; margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px; font-size: 12px;">
                    <summary style="cursor: pointer; font-weight: 600;">Detalles técnicos</summary>
                    <code style="display: block; margin-top: 10px; white-space: pre-wrap; word-break: break-word;">${details}</code>
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
    if (sessionStorage.getItem('wm_auth')) {
        inactivityTimer = setTimeout(() => {
            console.log("Inactivity detected. Locking session...");
            sessionStorage.removeItem('wm_auth');
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
