// Auth View — Direct Access (Sin PIN)
window.Views = window.Views || {};

window.Views.login = (container) => {
    container.innerHTML = `
        <div class="login-container" style="
            position: fixed; top:0; left:0; width:100%; height:100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; overflow: hidden;
            font-family: 'Outfit', sans-serif;
        ">
            <div class="login-card" style="
                width: 100%;
                max-width: 320px;
                position: relative;
                z-index: 10;
                text-align: center;
                animation: fadeIn 0.8s ease;
            ">
                <div style="margin-bottom: 50px;">
                    <img src="assets/logo.png" alt="Logo" style="
                        width: 80px; height: 80px; border-radius: 18px;
                        margin-bottom: 25px;
                    ">
                    <h1 style="color:white; font-size:1.4rem; font-weight:600; letter-spacing:0.5px; margin-bottom:5px;">
                        El Maravilloso
                    </h1>
                    <p style="color:rgba(255,255,255,0.7); font-size:0.9rem; margin:0;">
                        Iniciando sesión...
                    </p>
                </div>

                <div style="margin: 40px 0;">
                    <div class="spinner" style="border-color: rgba(255,255,255,0.3); border-top-color: white; width: 40px; height: 40px; margin: 0 auto;"></div>
                </div>

                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    .spinner {
                        border: 3px solid;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                </style>
            </div>
        </div>
    `;

    // --- AUTO LOGIN (Sin PIN) ---
    // Usar sessionStorage (más seguro y no persiste entre pestañas)
    if (!sessionStorage.getItem('wm_auth')) {
        sessionStorage.setItem('wm_auth', 'true');
        sessionStorage.setItem('wm_user', 'Administrador');

        // Limpiar datos de PIN antiguos
        localStorage.removeItem('wm_pin_mode');
        localStorage.removeItem('pin_attempts');
        localStorage.removeItem('pin_lockout_until');

        // Esperar un momento y llamar init() directamente sin recargar
        setTimeout(() => {
            document.querySelector('.app-container').style.display = 'flex';
            const loginWrapper = document.getElementById('login-wrapper');
            if (loginWrapper) loginWrapper.remove();

            // Iniciar app
            if (typeof init === 'function') {
                init();
            } else {
                console.log('Init not ready, reloading...');
                window.location.reload();
            }
        }, 800);
    }
};
