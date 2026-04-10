// Auth View — SIMPLE Auto-Login (Sin PIN ni UI del PIN)
window.Views = window.Views || {};

window.Views.login = (container) => {
    // IMPORTANTE: Este archivo se carga desde la red, no del caché
    // Si ves PIN, significa que el service worker está sirviendo una versión vieja

    // Limpiar CUALQUIER localStorage viejo relacionado a PIN
    localStorage.removeItem('wm_pin_mode');
    localStorage.removeItem('pin_attempts');
    localStorage.removeItem('pin_lockout_until');

    // Auto-login: simplemente setear como autenticado
    localStorage.setItem('wm_auth', 'true');
    localStorage.setItem('wm_user', 'Administrador');

    // Mostrar pantalla de carga minimalista
    container.innerHTML = `
        <div style="position: fixed; inset: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; z-index: 9999;">
            <div style="text-align: center; color: white;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📦</div>
                <h1 style="margin: 0 0 10px 0; font-size: 1.5rem;">El Maravilloso</h1>
                <p style="margin: 0; opacity: 0.8;">Cargando...</p>
            </div>
        </div>
    `;

    // Esperar 1 segundo y llamar init() directamente
    setTimeout(() => {
        try {
            // Mostrar app
            const appContainer = document.querySelector('.app-container');
            if (appContainer) appContainer.style.display = 'flex';

            // Remover login
            const loginWrapper = document.getElementById('login-wrapper');
            if (loginWrapper) loginWrapper.remove();

            // Iniciar app
            if (typeof init === 'function') {
                init();
            }
        } catch (err) {
            console.error('Error iniciando app:', err);
        }
    }, 1000);
};
