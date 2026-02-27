// Auth View — Supabase Auth (Real Login)
window.Views = window.Views || {};

window.Views.login = (container) => {
    container.innerHTML = `
        <div class="login-container" style="
            position: fixed; top:0; left:0; width:100%; height:100vh;
            background: #000;
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; overflow: hidden;
            font-family: 'Outfit', sans-serif;
        ">
            <!-- CINEMATIC BACKGROUND -->
            <div class="mesh-gradient" style="
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: 
                    radial-gradient(circle at 20% 30%, rgba(230, 0, 0, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(0, 68, 255, 0.15) 0%, transparent 50%),
                    linear-gradient(135deg, #0f0202 0%, #000 100%);
                filter: blur(40px);
                animation: meshMove 15s ease infinite alternate;
            "></div>

            <!-- EFFECT PARTICLES -->
            <div id="particles" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity: 0.4;"></div>

            <!-- GLASS LOGIN CARD -->
            <div class="login-card" style="
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(30px);
                -webkit-backdrop-filter: blur(30px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 50px 40px;
                border-radius: 32px;
                width: 90%;
                max-width: 420px;
                box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(255,255,255,0.02);
                position: relative;
                z-index: 10;
                text-align: center;
            ">
                <!-- LIVING LOGO -->
                <div class="login-logo-wrapper" style="margin-bottom: 35px; position: relative; display: inline-block;">
                    <div class="logo-glow" style="
                        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        width: 140px; height: 140px;
                        background: radial-gradient(circle, rgba(230, 0, 0, 0.4) 0%, transparent 70%);
                        animation: logoPulse 4s ease-in-out infinite;
                    "></div>
                    <img src="assets/logo.png" alt="Logo" style="
                        width: 110px; height: auto; border-radius: 20px;
                        box-shadow: 0 15px 40px rgba(230, 0, 0, 0.5);
                        position: relative; z-index: 2;
                        animation: logoFloat 5s ease-in-out infinite;
                    ">
                </div>

                <div style="margin-bottom: 40px;">
                    <h1 style="color:white; font-size:1.8rem; font-weight:800; letter-spacing:-1px; margin-bottom:8px; text-transform:uppercase; background: linear-gradient(to bottom, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        EL MARAVILLOSO
                    </h1>
                    <div style="height:2px; width:40px; background:var(--primary); margin:0 auto 12px;"></div>
                    <p style="color:rgba(255,255,255,0.5); font-size:0.85rem; letter-spacing:2px; font-weight:500;">SISTEMA DE GESTIÓN</p>
                </div>

                <form id="login-form">
                    <div class="form-group" style="margin-bottom:20px; text-align: left;">
                        <label style="color:rgba(255,255,255,0.4); font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:10px; display:block; padding-left:5px;">Correo</label>
                        <div style="position:relative;">
                            <i class="ph ph-envelope" style="position:absolute; left:18px; top:50%; transform:translateY(-50%); color:var(--primary); font-size:1.2rem;"></i>
                            <input type="email" id="inp-user" class="form-input-premium" placeholder="correo@ejemplo.com" autocomplete="email" style="
                                background: rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); 
                                color:white; padding: 16px 16px 16px 50px; width:100%; border-radius: 16px;
                                font-size: 1rem; transition: 0.3s; outline: none;
                            ">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:30px; text-align: left;">
                        <label style="color:rgba(255,255,255,0.4); font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:10px; display:block; padding-left:5px;">Contraseña</label>
                        <div style="position:relative;">
                            <i class="ph ph-lock-key" style="position:absolute; left:18px; top:50%; transform:translateY(-50%); color:var(--primary); font-size:1.2rem;"></i>
                            <input type="password" id="inp-pass" class="form-input-premium" placeholder="••••••••" autocomplete="current-password" style="
                                background: rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05);
                                color:white; padding: 16px 16px 16px 50px; width:100%; border-radius: 16px;
                                font-size: 1rem; transition: 0.3s; outline: none;
                            ">
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div id="login-error" style="
                        color: #f87171; font-size: 0.85rem; margin-bottom: 20px; 
                        opacity: 0; transition: opacity 0.3s; min-height: 20px;
                        background: rgba(220,38,38,0.1); border-radius: 8px; padding: 8px 12px;
                    "></div>

                    <button type="submit" id="btn-login" class="btn-login-pro" style="
                        width: 100%; padding: 18px;
                        background: linear-gradient(135deg, #dc2626, #b91c1c);
                        color: white; font-weight: 700; font-size: 1rem;
                        border: none; border-radius: 16px; cursor: pointer;
                        letter-spacing: 1px; text-transform: uppercase;
                        transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        box-shadow: 0 15px 30px rgba(230, 0, 0, 0.4);
                        display: flex; align-items: center; justify-content: center; gap: 10px;
                    ">
                        <i class="ph ph-sign-in"></i>
                        <span id="btn-login-text">Ingresar</span>
                    </button>
                </form>

                <style>
                    @keyframes meshMove {
                        0% { transform: scale(1) rotate(0deg); }
                        100% { transform: scale(1.2) rotate(15deg); }
                    }
                    @keyframes logoPulse {
                        0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
                        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
                    }
                    @keyframes logoFloat {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-8px); }
                    }
                    .form-input-premium:focus {
                        border-color: rgba(220, 38, 38, 0.5) !important;
                        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
                    }
                    .btn-login-pro:hover {
                        transform: translateY(-3px) scale(1.02);
                        box-shadow: 0 20px 40px rgba(230, 0, 0, 0.6);
                        filter: brightness(1.1);
                    }
                    .btn-login-pro:active { transform: scale(0.98); }
                    .btn-login-pro:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                </style>
            </div>
        </div>
    `;

    // Particles Effect
    const particleContainer = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        const size = Math.random() * 4 + 1;
        p.style.cssText = `
            position: absolute;
            width: ${size}px; height: ${size}px;
            background: rgba(220, 38, 38, ${Math.random() * 0.5});
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            border-radius: 50%;
            animation: moveParticle ${Math.random() * 10 + 10}s linear infinite;
        `;
        particleContainer.appendChild(p);
    }
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes moveParticle {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // --- LOGIN LOGIC (Supabase Auth) ---
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('inp-user').value.trim();
        const pass = document.getElementById('inp-pass').value.trim();
        const errorMsg = document.getElementById('login-error');
        const btn = document.getElementById('btn-login');
        const btnText = document.getElementById('btn-login-text');

        // Basic client-side validation
        if (!email || !pass) {
            errorMsg.textContent = 'Completa todos los campos.';
            errorMsg.style.opacity = '1';
            return;
        }
        if (!email.includes('@')) {
            errorMsg.textContent = 'Ingresa un correo válido.';
            errorMsg.style.opacity = '1';
            return;
        }

        // Loading state
        btn.disabled = true;
        btnText.textContent = 'Verificando...';
        errorMsg.style.opacity = '0';

        try {
            // Make sure Supabase client is ready
            if (!window.Sync?.client) {
                await window.Sync.init();
            }

            if (!window.Sync?.client) {
                throw new Error('Sin conexión a la nube. Verifica tu internet.');
            }

            const { data, error } = await window.Sync.client.auth.signInWithPassword({
                email,
                password: pass
            });

            if (error) throw error;

            // Success — save minimal session info
            localStorage.setItem('wm_auth', 'true');
            localStorage.setItem('wm_user', data.user?.email || 'Usuario');

            // Animate out
            const card = document.querySelector('.login-card');
            card.style.transform = 'scale(0.9) translateY(20px)';
            card.style.opacity = '0';
            card.style.transition = 'all 0.5s ease';

            setTimeout(() => window.location.reload(), 500);

        } catch (err) {
            btn.disabled = false;
            btnText.textContent = 'Ingresar';

            // Friendly error messages
            let msg = 'Credenciales incorrectas.';
            if (err.message?.includes('Invalid login')) msg = 'Correo o contraseña incorrectos.';
            else if (err.message?.includes('Email not confirmed')) msg = 'Debes confirmar tu correo primero.';
            else if (err.message?.includes('fetch') || err.message?.includes('network')) msg = 'Sin conexión. Verifica tu internet.';
            else if (err.message?.includes('cloud')) msg = err.message;

            errorMsg.textContent = msg;
            errorMsg.style.opacity = '1';

            // Shake animation
            const card = document.querySelector('.login-card');
            card.style.transform = 'translateX(10px)';
            setTimeout(() => card.style.transform = 'translateX(-10px)', 100);
            setTimeout(() => card.style.transform = 'translateX(0)', 200);
        }
    });
};
