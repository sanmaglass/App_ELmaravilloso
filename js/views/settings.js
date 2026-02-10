// Settings View
window.Views = window.Views || {};

window.Views.settings = async (container) => {
    container.innerHTML = `
        <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1>Configuración</h1>
                <p style="color:var(--text-muted);">Gestión de datos y sincronización</p>
            </div>
        </div>

        <div class="responsive-grid-2-1">
            <div style="display:flex; flex-direction:column; gap:24px;">
                <!-- BACKUP SECTION -->
                <div class="card">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-cloud-arrow-down" style="color:var(--primary);"></i>
                        Copia de Seguridad (Sinc. Manual)
                    </h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:20px;">
                        Descarga toda tu información en un archivo para pasarla de tu PC al celular (o viceversa). 
                        Es la opción más segura y 100% gratuita.
                    </p>
                    
                    <div style="display:flex; gap:12px; flex-wrap:wrap;">
                        <button id="btn-export-db" class="btn btn-primary">
                            <i class="ph ph-download-simple"></i> Descargar Copia
                        </button>
                        
                        <label for="import-db-input" class="btn btn-secondary" style="cursor:pointer; display:inline-flex; align-items:center; gap:8px;">
                            <i class="ph ph-upload-simple"></i> Cargar Copia
                        </label>
                        <input type="file" id="import-db-input" style="display:none;" accept=".json">
                    </div>
                </div>

                <!-- CLOUD SYNC SECTION -->
                <div class="card">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-planet" style="color:var(--accent);"></i>
                        Sincronización en la Nube (Auto)
                    </h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">
                        Conecta tu cuenta de <strong>Supabase</strong> para sincronizar PC y móvil al instante.
                    </p>
                    
                    <div class="form-group" style="margin-bottom:12px;">
                        <label class="form-label">Project URL</label>
                        <input type="text" id="supa-url" class="form-input" placeholder="https://xyz.supabase.co">
                    </div>
                    
                    <div class="form-group" style="margin-bottom:20px;">
                        <label class="form-label">Anon Key</label>
                        <div style="display:flex; gap:8px;">
                            <input type="password" id="supa-key" class="form-input" placeholder="Tu API Key Pública" style="flex:1;">
                            <button id="btn-toggle-key" class="btn btn-secondary" style="padding:0 12px;" title="Mostrar/Ocultar">
                                <i class="ph ph-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div style="display:flex; gap:12px; margin-bottom:16px;">
                        <button id="btn-connect-cloud" class="btn btn-secondary" style="flex:1;">
                            <i class="ph ph-plug"></i> Conectar
                        </button>
                        <button id="btn-sync-now" class="btn btn-primary" style="flex:1;" disabled>
                            <i class="ph ph-arrows-clockwise"></i> Sincronizar Ahora
                        </button>
                    </div>

                    <!-- Botón Generar QR -->
                    <button id="btn-gen-qr" class="btn btn-secondary" style="width:100%; margin-bottom:10px; border-color:var(--accent); color:var(--accent);">
                        <i class="ph ph-qr-code"></i> Generar QR de Conexión
                    </button>
                    <div id="qr-container" style="display:none; text-align:center; padding:15px; background:white; border-radius:12px; margin-top:10px;">
                        <div id="qrcode"></div>
                        <p style="font-size:0.8rem; color:#666; margin-top:10px;">Escanea esto con tu celular para copiar las claves.</p>
                    </div>

                    <div id="cloud-status" style="margin-top:16px; font-size:0.85rem; padding:8px; border-radius:6px; background:rgba(0,0,0,0.03); display:none;">
                        <!-- Status text -->
                    </div>
                </div>

                <!-- DANGER ZONE -->
                <div class="card" style="border: 1px solid #fee2e2; background: #fffafb;">
                    <h3 style="margin-bottom:12px; display:flex; align-items:center; gap:8px; color:#b91c1c;">
                        <i class="ph ph-warning-octagon"></i>
                        Zona de Peligro
                    </h3>
                    <p style="font-size:0.85rem; color:#7f1d1d; margin-bottom:16px;">
                        Estas acciones son irreversibles. Ten cuidado.
                    </p>
                    <button id="btn-nuke-all" class="btn btn-secondary" style="color:#b91c1c; border-color:#fca5a5; width:100%;">
                        <i class="ph ph-trash"></i> BORRAR TODA LA APP (Local y Nube)
                    </button>
                    <p style="font-size:0.75rem; color:#991b1b; margin-top:8px; font-style:italic;">
                        *Esto eliminará empleados, productos y jornadas en todos tus dispositivos.
                    </p>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom:16px;">Acerca de la App</h3>
                <div style="font-size:0.9rem; color:var(--text-muted); line-height:1.6;">
                    <p><strong>El Maravilloso v1.6</strong></p>
                    <p>App de Gestión Integral</p>
                    <hr style="margin:12px 0; border:none; border-top:1px solid var(--border);">
                    <p>Desarrollada para control de personal, inventario y marketing.</p>
                    <p style="margin-top:10px; font-size:0.8rem;">Los datos se guardan localmente en tu navegador por seguridad.</p>
                </div>
            </div>
        </div>
    `;

    // Handlers
    document.getElementById('btn-export-db').addEventListener('click', async () => {
        const btn = document.getElementById('btn-export-db');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Generando...';
        try {
            await window.Utils.exportDatabase();
            // alert('Copia generada con éxito.');
        } catch (e) {
            alert('Error al exportar: ' + e.message);
        } finally {
            btn.innerHTML = original;
        }
    });

    // --- CLOUD LOGIC ---
    const supaUrl = document.getElementById('supa-url');
    const supaKey = document.getElementById('supa-key');
    const btnConnect = document.getElementById('btn-connect-cloud');
    const btnSync = document.getElementById('btn-sync-now');
    const cloudStatus = document.getElementById('cloud-status');
    const btnToggleKey = document.getElementById('btn-toggle-key');
    const btnGenQr = document.getElementById('btn-gen-qr');
    const qrContainer = document.getElementById('qr-container');

    // Cargar valores guardados
    supaUrl.value = localStorage.getItem('supabase_url') || '';
    supaKey.value = localStorage.getItem('supabase_key') || '';

    const updateStatus = (msg, type = 'info') => {
        cloudStatus.style.display = 'block';
        cloudStatus.innerHTML = msg;
        cloudStatus.style.color = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : 'var(--text-muted)');
    };

    // Toggle Visibility
    btnToggleKey.addEventListener('click', () => {
        const type = supaKey.getAttribute('type') === 'password' ? 'text' : 'password';
        supaKey.setAttribute('type', type);
        btnToggleKey.innerHTML = type === 'text' ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
    });

    // Generate QR
    btnGenQr.addEventListener('click', () => {
        const url = supaUrl.value.trim();
        const key = supaKey.value.trim();

        if (!url || !key) {
            alert("Primero ingresa y guarda (Conectar) la URL y Key.");
            return;
        }

        qrContainer.style.display = 'block';
        document.getElementById('qrcode').innerHTML = ""; // Clear prev

        const qrData = JSON.stringify({ u: url, k: key });

        new QRCode(document.getElementById('qrcode'), {
            text: qrData,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    });

    // Verificar conexión al cargar
    if (supaUrl.value && supaKey.value) {
        btnSync.disabled = true; // Deshabilitar hasta verificar
        updateStatus('<i class="ph ph-spinner-gap ph-spin"></i> Verificando conexión...');
        window.Sync.init().then(result => {
            if (result.success) {
                btnSync.disabled = false;
                updateStatus('<i class="ph ph-check-circle"></i> Conectado y listo.', 'success');
            } else {
                updateStatus('<i class="ph ph-warning"></i> Fallo de conexión: ' + result.error, 'error');
            }
        });
    }

    const cleanUrl = (u) => {
        u = u.trim();
        if (!u.startsWith('http')) u = 'https://' + u;
        return u.replace(/\/$/, ''); // Remove trailing slash
    };

    const tryParsePaste = (text) => {
        try {
            const data = JSON.parse(text);
            if (data.u && data.k) {
                supaUrl.value = data.u;
                supaKey.value = data.k;
                updateStatus('<i class="ph ph-magic-wand"></i> Credenciales detectadas. Dale a Conectar.', 'success');
                return true;
            }
        } catch (e) {
            return false;
        }
    };

    // Smart Paste Listener
    [supaUrl, supaKey].forEach(input => {
        input.addEventListener('paste', (e) => {
            const text = (e.clipboardData || window.clipboardData).getData('text');
            if (tryParsePaste(text)) {
                e.preventDefault();
            }
        });
        // Also sanitize on blur
        input.addEventListener('blur', () => {
            if (input === supaUrl) input.value = cleanUrl(input.value);
            input.value = input.value.trim();
        });
    });

    btnConnect.addEventListener('click', async () => {
        const url = cleanUrl(supaUrl.value);
        const key = supaKey.value.trim();

        if (!url || !key) {
            updateStatus('Por favor, ingresa URL y API Key.', 'error');
            return;
        }

        if (!url.includes('supabase.co')) {
            updateStatus('Advertencia: La URL no parece ser de Supabase.', 'error');
        }

        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);

        const result = await window.Sync.init();
        if (result.success) {
            btnSync.disabled = false;
            updateStatus('<i class="ph ph-check-circle"></i> Conectado con éxito a Supabase.', 'success');
        } else {
            updateStatus('Error: ' + result.error, 'error');
        }
    });

    btnSync.addEventListener('click', async () => {
        btnSync.disabled = true;
        const original = btnSync.innerHTML;
        btnSync.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Sincronizando...';

        try {
            const result = await window.Sync.syncAll();
            if (result.success) {
                updateStatus('<i class="ph ph-check-circle"></i> Sincronización completada.', 'success');
                alert('¡Datos sincronizados! La app se refrescará.');
                window.location.reload();
            } else {
                updateStatus('Fallo: ' + result.error, 'error');
            }
        } catch (e) {
            updateStatus('Error inesperado: ' + e.message, 'error');
        } finally {
            btnSync.disabled = false;
            btnSync.innerHTML = original;
        }
    });

    // --- NUKE ALL ACTION ---
    document.getElementById('btn-nuke-all').addEventListener('click', async () => {
        const pass = prompt('Esto borrará TODO en este equipo y en la NUBE. Escribe "BORRAR" para confirmar:');
        if (pass !== 'BORRAR') return;

        if (!confirm('¿ESTÁS COMPLETAMENTE SEGURO? Esta acción no se puede deshacer.')) return;

        const btn = document.getElementById('btn-nuke-all');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> BORRANDO TODO...';
        btn.disabled = true;

        try {
            // 1. Nuke Cloud (si está conectado)
            if (window.Sync.client) {
                await window.Sync.nukeCloud();
            }

            // 2. Clear Local DB
            const tables = ['employees', 'workLogs', 'products', 'promotions', 'settings'];
            for (const table of tables) {
                await window.db[table].clear();
            }

            alert('¡Base de datos limpia! La app se reiniciará.');
            window.location.reload();
        } catch (e) {
            alert('Error al borrar: ' + e.message);
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    });

    document.getElementById('import-db-input').addEventListener('change', async (e) => {
        if (!e.target.files.length) return;

        try {
            const success = await window.Utils.importDatabase(e.target.files[0]);
            if (success) {
                alert('¡Datos restaurados con éxito! La aplicación se reiniciará.');
                window.location.reload();
            }
        } catch (err) {
            alert('Error al importar: ' + err.message);
        } finally {
            e.target.value = ''; // Reset input
        }
    });
};
