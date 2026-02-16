// Settings View
window.Views = window.Views || {};

window.Views.settings = async (container) => {
    // 1. Render UI
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
                        <button id="btn-sync-now" class="btn btn-primary" style="flex:1;">
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

                <!-- STORAGE MONITOR -->
                <div class="card" style="border: 1px solid var(--accent); background: linear-gradient(to bottom, rgba(99,102,241,0.05), transparent);">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-database" style="color:var(--accent);"></i>
                        Monitor de Almacenamiento
                    </h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">
                        Visualiza cuántos datos tienes almacenados localmente y en la nube.
                    </p>
                    
                    <div id="storage-stats" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:16px;">
                        <!-- Stats will be injected here -->
                    </div>
                    
                    <div style="display:flex; gap:10px; margin-top:16px;">
                        <button id="btn-refresh-stats" class="btn btn-secondary" style="flex:1;">
                            <i class="ph ph-arrow-clockwise"></i> Actualizar
                        </button>
                        <button id="btn-clear-local" class="btn btn-secondary" style="flex:1; color:var(--warning); border-color:var(--warning);">
                            <i class="ph ph-broom"></i> Limpiar Local
                        </button>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; font-style:italic;">
                        *Limpiar Local borra los datos del dispositivo actual y los vuelve a bajar de la nube. Útil para liberar espacio.
                    </p>
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
                    <p><strong>El Maravilloso v1.68</strong></p>
                    <p>App de Gestión Integral</p>
                    <hr style="margin:12px 0; border:none; border-top:1px solid var(--border);">
                    <p>Desarrollada para control de personal, inventario y marketing.</p>
                    <p style="margin-top:10px; font-size:0.8rem;">Los datos se guardan localmente en tu navegador por seguridad.</p>
                </div>
            </div>
        </div>
    `;

    // 2. Add Logic
    try {
        // --- ELEMENTS ---
        const supaUrl = document.getElementById('supa-url');
        const supaKey = document.getElementById('supa-key');
        const btnConnect = document.getElementById('btn-connect-cloud');
        const btnSync = document.getElementById('btn-sync-now');
        const cloudStatus = document.getElementById('cloud-status');
        const btnToggleKey = document.getElementById('btn-toggle-key');
        const btnGenQr = document.getElementById('btn-gen-qr');
        const qrContainer = document.getElementById('qr-container');

        if (!btnSync) console.error("Critical: btnSync not found");

        // Force enable Sync button
        if (btnSync) btnSync.disabled = false;

        // --- FUNCTIONS ---
        const updateStatus = (msg, type = 'info') => {
            if (!cloudStatus) return;
            cloudStatus.style.display = 'block';
            cloudStatus.innerHTML = msg;
            cloudStatus.style.color = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : 'var(--text-muted)');
        };

        const cleanUrl = (u) => {
            u = u.trim();
            if (!u) return '';
            if (!u.startsWith('http')) u = 'https://' + u;
            return u.replace(/\/$/, '');
        };

        // --- SYNC HANDLERS ---
        if (btnSync) {
            btnSync.addEventListener('click', async () => {
                alert('¡Botón presionado! Intentando sincronizar...');
                console.log("Botón Sincronizar presionado");
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
                        alert('Error Sync: ' + result.error);
                    }
                } catch (e) {
                    updateStatus('Error inesperado: ' + e.message, 'error');
                    alert('Excepción Sync: ' + e.message);
                } finally {
                    btnSync.disabled = false;
                    btnSync.innerHTML = original;
                }
            });
        }

        // --- CONNECT HANDLER ---
        if (btnConnect) {
            btnConnect.addEventListener('click', async () => {
                const url = cleanUrl(supaUrl.value);
                const key = supaKey.value.trim();

                if (!url || !key) {
                    updateStatus('Por favor, ingresa URL y API Key.', 'error');
                    return;
                }

                localStorage.setItem('supabase_url', url);
                localStorage.setItem('supabase_key', key);

                const result = await window.Sync.init();
                if (result.success) {
                    btnSync.disabled = false;
                    updateStatus('<i class="ph ph-check-circle"></i> Conectado con éxito.', 'success');
                } else {
                    updateStatus('Error: ' + result.error, 'error');
                }
            });
        }

        // --- PASSWORD TOGGLE ---
        if (btnToggleKey) {
            btnToggleKey.addEventListener('click', () => {
                const type = supaKey.getAttribute('type') === 'password' ? 'text' : 'password';
                supaKey.setAttribute('type', type);
                btnToggleKey.innerHTML = type === 'text' ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
            });
        }

        // --- QR CODE GENERATION ---
        if (btnGenQr) {
            btnGenQr.addEventListener('click', () => {
                const url = supaUrl.value.trim();
                const key = supaKey.value.trim();

                if (!url || !key) {
                    alert("Primero ingresa y guarda (Conectar) la URL y Key.");
                    return;
                }

                if (typeof QRCode === 'undefined') {
                    alert("Librería QR no cargada. Revisa tu conexión.");
                    return;
                }

                qrContainer.style.display = 'block';
                document.getElementById('qrcode').innerHTML = "";
                const qrData = "CONFIG:" + JSON.stringify({ u: url, k: key });

                new QRCode(document.getElementById('qrcode'), {
                    text: qrData,
                    width: 200,
                    height: 200,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            });
        }

        // --- BACKUP / EXPORT ---
        document.getElementById('btn-export-db').addEventListener('click', async () => {
            const btn = document.getElementById('btn-export-db');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Generando...';
            try {
                if (window.Utils && window.Utils.exportDatabase) {
                    await window.Utils.exportDatabase();
                } else {
                    alert("Error: Utils no cargado");
                }
            } catch (e) {
                alert('Error al exportar: ' + e.message);
            } finally {
                btn.innerHTML = original;
            }
        });

        document.getElementById('import-db-input').addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            try {
                const success = await window.Utils.importDatabase(e.target.files[0]);
                if (success) {
                    alert('¡Datos restaurados! La aplicación se reiniciará.');
                    window.location.reload();
                }
            } catch (err) {
                alert('Error al importar: ' + err.message);
            } finally {
                e.target.value = '';
            }
        });

        // --- NUKE ALL ---
        document.getElementById('btn-nuke-all').addEventListener('click', async () => {
            const pass = prompt('Escribe "BORRAR" para confirmar borrado total:');
            if (pass !== 'BORRAR') return;

            const btn = document.getElementById('btn-nuke-all');
            btn.innerHTML = 'Borrando...';
            btn.disabled = true;

            try {
                if (window.Sync.client) await window.Sync.nukeCloud();

                await window.db.employees.clear();
                await window.db.workLogs.clear();
                await window.db.products.clear();
                await window.db.promotions.clear();
                await window.db.settings.clear();

                localStorage.setItem('wm_skip_seed', 'true');
                alert('¡App reiniciada de cero!');
                window.location.reload();
            } catch (e) {
                alert('Error: ' + e.message);
                btn.disabled = false;
            }
        });

        // --- INIT STATE ---
        // Load saved values
        supaUrl.value = localStorage.getItem('supabase_url') || '';
        supaKey.value = localStorage.getItem('supabase_key') || '';

        // PRO MODE OVERRIDE
        if (window.AppConfig && window.AppConfig.supabaseUrl) {
            supaUrl.value = window.AppConfig.supabaseUrl;
            supaKey.value = "**********************************";
            supaUrl.disabled = true;
            supaKey.disabled = true;
            if (btnConnect) btnConnect.disabled = true;
            if (btnToggleKey) btnToggleKey.disabled = true;
            if (btnGenQr) btnGenQr.style.display = 'none';

            const proBadge = document.createElement('div');
            proBadge.innerHTML = '<i class="ph ph-crown"></i> MODO PRO ACTIVO';
            proBadge.style.cssText = 'background:#FFD700; color:black; padding:10px; border-radius:8px; font-weight:bold; text-align:center; margin-bottom:15px;';
            const grp = supaUrl.closest('.form-group');
            if (grp) grp.parentNode.insertBefore(proBadge, grp);

            if (window.Sync && window.Sync.client) {
                updateStatus('<i class="ph ph-wifi-high"></i> Conectado (Pro Mode)', 'success');
            } else {
                updateStatus('<i class="ph ph-warning"></i> Conectando...', 'warning');
            }
        }

        // --- STORAGE STATS ---
        const updateStorageStats = async () => {
            const statsContainer = document.getElementById('storage-stats');
            if (!statsContainer) return;
            statsContainer.innerHTML = 'Cargando...';

            try {
                const employees = await window.db.employees.count();
                const logs = await window.db.workLogs.count();
                const products = await window.db.products.count();
                const total = employees + logs + products;

                statsContainer.innerHTML = `
                    <div style="padding:10px; background:#f0f9ff; border-radius:8px; text-align:center;">
                        <h2>${total}</h2>
                        <span style="font-size:0.8rem; color:#666;">Total Registros</span>
                    </div>
                `;
            } catch (e) {
                statsContainer.innerHTML = 'Error stats';
            }
        };

        updateStorageStats();
        document.getElementById('btn-refresh-stats').addEventListener('click', updateStorageStats);

        document.getElementById('btn-clear-local').addEventListener('click', async () => {
            if (!confirm("¿Borrar datos locales?")) return;
            await window.db.employees.clear();
            await window.db.workLogs.clear();
            await window.db.products.clear();
            await window.db.promotions.clear();
            alert("Datos locales borrados.");
            updateStorageStats();
        });

    } catch (err) {
        console.error("Critical Settings Error:", err);
        container.innerHTML += `<div style="padding:20px; color:red;">Error cargando scripts de ajustes: ${err.message}</div>`;
    }
};
