// Auth View — Supabase Auth (iOS Pure Style)
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
            <!-- PURE LOGO & CONTENT -->
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
                        INTRODUZCA CÓDIGO
                    </h1>
                </div>

                <div id="pin-display" class="flex justify-center gap-5 mb-12">
                    <div class="pin-dot" id="dot-0"></div>
                    <div class="pin-dot" id="dot-1"></div>
                    <div class="pin-dot" id="dot-2"></div>
                    <div class="pin-dot" id="dot-3"></div>
                    <div class="pin-dot" id="dot-4"></div>
                    <div class="pin-dot" id="dot-5"></div>
                </div>

                <div id="keypad" class="grid grid-cols-3 gap-y-6 gap-x-6" style="margin: 0 auto;">
                    <button class="key" onclick="window._inputPin('1')">1</button>
                    <button class="key" onclick="window._inputPin('2')">2</button>
                    <button class="key" onclick="window._inputPin('3')">3</button>
                    <button class="key" onclick="window._inputPin('4')">4</button>
                    <button class="key" onclick="window._inputPin('5')">5</button>
                    <button class="key" onclick="window._inputPin('6')">6</button>
                    <button class="key" onclick="window._inputPin('7')">7</button>
                    <button class="key" onclick="window._inputPin('8')">8</button>
                    <button class="key" onclick="window._inputPin('9')">9</button>
                    <div style="aspect-ratio:1/1;"></div>
                    <button class="key" onclick="window._inputPin('0')">0</button>
                    <button class="key" onclick="window._inputPin('del')" style="border:none; background:transparent;">
                        <i class="ph ph-backspace" style="font-size: 1.8rem; color: rgba(255,255,255,0.7);"></i>
                    </button>
                </div>

                <!-- Lockout Timer Overlay (iOS Style) -->
                <div id="lockout-overlay" style="
                    display:none; position:absolute; inset:-20px; 
                    background:#000; z-index:100;
                    flex-direction:column; align-items:center; justify-content:center;
                    text-align:center;
                ">
                    <h2 style="color:white; font-weight:400; font-size:1.6rem; margin-bottom:10px;">iPhone no disponible</h2>
                    <p style="color:rgba(255,255,255,0.6); font-size:0.9rem; line-height:1.4;">
                        Vuelve a intentarlo en <br>
                        <span id="lockout-timer" style="color:white; font-weight:600;">00:00</span>
                    </p>
                </div>

                <!-- Error Message (Subtle) -->
                <div id="login-error" style="
                    color: white; font-size: 0.85rem; margin-top: 30px; 
                    opacity: 0; transition: opacity 0.3s; min-height: 20px;
                "></div>

                <style>
                    .pin-dot { width:12px; height:12px; border-radius:50%; border:1px solid rgba(255,255,255,0.4); transition:all 0.2s; }
                    .pin-dot.active { background:white; border-color:white; }
                    
                    .key { 
                        aspect-ratio: 1/1; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);
                        background: rgba(255,255,255,0.02); color:white; font-size:2.2rem; font-weight:300;
                        cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center;
                        padding:0;
                    }
                    .key:active { background: rgba(255,255,255,0.3); transform: scale(0.95); }

                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                        20%, 40%, 60%, 80% { transform: translateX(10px); }
                    }
                    .shake { animation: shake 0.5s ease-in-out; }
                </style>
            </div>
        </div>
    `;

    // --- PIN SYSTEM LOGIC ---
    let currentPin = "";
    const MAX_ATTEMPTS = 3;
    let attempts = parseInt(localStorage.getItem('pin_attempts') || '0');
    let lockoutUntil = parseInt(localStorage.getItem('pin_lockout_until') || '0');

    const updateDots = () => {
        for (let i = 0; i < 6; i++) {
            const dot = document.getElementById(`dot-${i}`);
            if (dot) dot.className = i < currentPin.length ? 'pin-dot active' : 'pin-dot';
        }
    };

    const checkLockout = () => {
        const now = Date.now();
        if (lockoutUntil > now) {
            const overlay = document.getElementById('lockout-overlay');
            const timer = document.getElementById('lockout-timer');
            overlay.style.display = 'flex';
            
            const interval = setInterval(() => {
                const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
                if (remaining <= 0) {
                    clearInterval(interval);
                    overlay.style.display = 'none';
                    localStorage.setItem('pin_attempts', '0');
                    attempts = 0;
                } else {
                    const m = Math.floor(remaining / 60);
                    const s = remaining % 60;
                    timer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            }, 1000);
        }
    };

    window._inputPin = async (val) => {
        if (Date.now() < lockoutUntil) return;
        
        if (val === 'del') {
            currentPin = currentPin.slice(0, -1);
            updateDots();
            return;
        }

        if (currentPin.length < 6) {
            currentPin += val;
            updateDots();
        }

        if (currentPin.length === 6) {
            processLogin(currentPin);
        }
    };

    const processLogin = async (pin) => {
        const errorMsg = document.getElementById('login-error');
        errorMsg.style.opacity = '0';

        try {
            if (!window.Sync?.client) await window.Sync.init();
            
            const savedEmail = localStorage.getItem('wm_user_email') || 'admin@maravilloso.com';
            
            const { error } = await window.Sync.client.auth.signInWithPassword({
                email: savedEmail,
                password: pin
            });

            if (error) throw error;

            // Success
            localStorage.setItem('wm_auth', 'true');
            localStorage.setItem('wm_user', 'Administrador');
            localStorage.setItem('wm_pin_mode', 'true');
            localStorage.setItem('pin_attempts', '0');

            // Fade out
            const card = document.querySelector('.login-card');
            card.style.opacity = '0';
            card.style.transition = 'opacity 0.5s ease';
            setTimeout(() => window.location.reload(), 500);

        } catch (err) {
            attempts++;
            localStorage.setItem('pin_attempts', attempts);
            
            if (attempts >= MAX_ATTEMPTS) {
                const delays = [30000, 300000, 900000];
                const delay = delays[Math.min(attempts - MAX_ATTEMPTS, delays.length - 1)];
                lockoutUntil = Date.now() + delay;
                localStorage.setItem('pin_lockout_until', lockoutUntil);
                checkLockout();
            }

            currentPin = "";
            updateDots();
            errorMsg.textContent = 'CÓDIGO INCORRECTO';
            errorMsg.style.opacity = '1';

            const card = document.querySelector('.login-card');
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 500);
        }
    };

    checkLockout();
};
