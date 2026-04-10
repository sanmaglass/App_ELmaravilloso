// Auth View — SIMPLE Auto-Login (Sin PIN ni UI del PIN)
// NOTA: Este archivo solo setea autenticación, NO llama init() para evitar bucles infinitos
window.Views = window.Views || {};

window.Views.login = (container) => {
    // Limpiar CUALQUIER localStorage viejo relacionado a PIN
    localStorage.removeItem('wm_pin_mode');
    localStorage.removeItem('pin_attempts');
    localStorage.removeItem('pin_lockout_until');

    // Auto-login: setear como autenticado SIN llamar init()
    localStorage.setItem('wm_auth', 'true');
    localStorage.setItem('wm_user', 'Administrador');

    // Mostrar pantalla de carga minimalista
    container.innerHTML = `
        <div style="position: fixed; inset: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; z-index: 9999;">
            <div style="text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 1.5rem;">El Maravilloso</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.8;">Iniciando...</p>
            </div>
        </div>
    `;

    // NO llamar init() aquí - causaba bucle infinito
    // La app ya está inicializándose desde main.js
};
