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
                <!-- COMPANY INFO SECTION -->
                <div class="card">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-buildings" style="color:var(--primary);"></i>
                        Datos de la Empresa
                    </h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">
                        Configuración oficial para facturas y documentos legales.
                    </p>
                    
                    <div class="form-group" style="margin-bottom:12px;">
                        <label class="form-label">Razón Social</label>
                        <input type="text" id="company-name" class="form-input" placeholder="Nombre o Razón Social">
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
                        <div class="form-group">
                            <label class="form-label">RUT Empresa</label>
                            <input type="text" id="company-rut" class="form-input" placeholder="12.345.678-9">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Giro</label>
                            <input type="text" id="company-giro" class="form-input" placeholder="Giro Comercial">
                        </div>
                    </div>

                    <button id="btn-save-company" class="btn btn-primary" style="width:100%;">
                        <i class="ph ph-floppy-disk"></i> Guardar Configuración
                    </button>
                </div>

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

                <!-- NOTIFICATIONS SECTION -->
                <div class="card" style="border: 1px solid var(--primary); background: rgba(59, 130, 246, 0.02);">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-bell-ringing" style="color:var(--primary);"></i>
                        Notificaciones Móviles
                    </h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">
                        Recibe avisos en tu iPhone/Android sobre ventas y facturas en tiempo real.
                    </p>
                    
                    <div id="notif-status-box" style="padding:12px; border-radius:10px; margin-bottom:16px; font-size:0.85rem; display:flex; align-items:center; gap:10px;">
                        <i class="ph ph-circle-fill" id="notif-indicator"></i>
                        <span id="notif-status-text">Cargando estado...</span>
                    </div>

                    <div style="display:flex; gap:10px;">
                        <button id="btn-request-notif" class="btn btn-primary" style="flex:1;">
                            <i class="ph ph-hand-pointing"></i> Activar
                        </button>
                        <button id="btn-test-notif" class="btn btn-secondary" style="flex:1;">
                            <i class="ph ph-bell"></i> Probar (5s)
                        </button>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:10px; font-style:italic;">
                        *Recuerda que la app debe estar "Agregada a la pantalla de inicio" para que funcionen bien en iPhone.
                    </p>
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
                    <p><strong>El Maravilloso v1.69</strong></p>
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
                // alert('¡Botón presionado! Intentando sincronizar...'); // Removed debug
                // console.log("Botón Sincronizar presionado"); // Removed debug
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

        // --- COMPANY INFO HANDLER ---
        const companyName = document.getElementById('company-name');
        const companyRut = document.getElementById('company-rut');
        const companyGiro = document.getElementById('company-giro');
        const btnSaveCompany = document.getElementById('btn-save-company');

        if (btnSaveCompany) {
            btnSaveCompany.addEventListener('click', async () => {
                const data = {
                    name: companyName.value.trim(),
                    rut: companyRut.value.trim(),
                    giro: companyGiro.value.trim()
                };

                if (!data.name || !data.rut) {
                    alert('La Razón Social y el RUT son obligatorios.');
                    return;
                }

                localStorage.setItem('company_name', data.name);
                localStorage.setItem('company_rut', data.rut);
                localStorage.setItem('company_giro', data.giro);

                alert('Configuración de empresa guardada con éxito.');
            });
        }

        // --- INIT STATE ---
        // Load saved values
        supaUrl.value = localStorage.getItem('supabase_url') || '';
        supaKey.value = localStorage.getItem('supabase_key') || '';

        if (companyName) companyName.value = localStorage.getItem('company_name') || 'NELSON RODRIGO ARROYO NOVOA';
        if (companyRut) companyRut.value = localStorage.getItem('company_rut') || '14.061.423-8';
        if (companyGiro) companyGiro.value = localStorage.getItem('company_giro') || 'MINIMARKET, PROVISIONES Y BAZAR';

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

        // --- NOTIFICATIONS LOGIC ---
        const btnNotif = document.getElementById('btn-request-notif');
        const notifBox = document.getElementById('notif-status-box');
        const notifInd = document.getElementById('notif-indicator');
        const notifText = document.getElementById('notif-status-text');

        const updateNotifUI = () => {
            if (!window.Utils.NotificationManager.isSupported()) {
                notifBox.style.background = 'rgba(239, 68, 68, 0.1)';
                notifInd.style.color = '#ef4444';
                notifText.textContent = 'No soportado en este navegador';
                btnNotif.disabled = true;
                return;
            }

            const state = window.Utils.NotificationManager.getPermissionState();
            if (state === 'granted') {
                notifBox.style.background = 'rgba(16, 185, 129, 0.1)';
                notifInd.style.color = '#10b981';
                notifText.textContent = 'Notificaciones Activas ✅';
                btnNotif.innerHTML = '<i class="ph ph-check"></i> Ya están activas';
                btnNotif.classList.replace('btn-primary', 'btn-secondary');
                // btnNotif.disabled = true; // Let them click to re-test if they want
            } else if (state === 'denied') {
                notifBox.style.background = 'rgba(239, 68, 68, 0.1)';
                notifInd.style.color = '#ef4444';
                notifText.textContent = 'Permiso denegado (Revisa ajustes del celular)';
                btnNotif.innerHTML = '<i class="ph ph-warning"></i> Permiso Bloqueado';
            } else {
                notifBox.style.background = 'rgba(0,0,0,0.05)';
                notifInd.style.color = '#9ca3af';
                notifText.textContent = 'Pendiente de activación';
            }
        };

        if (btnNotif) {
            btnNotif.addEventListener('click', async () => {
                const granted = await window.Utils.NotificationManager.requestPermission();
                if (granted) {
                    window.Utils.NotificationManager.show('¡Suscrito!', 'Ahora recibirás avisos de El Maravilloso en este dispositivo.');
                }
                updateNotifUI();
            });

            // --- TEST NOTIFICATION LOGIC ---
            const btnTest = document.getElementById('btn-test-notif');
            if (btnTest) {
                btnTest.addEventListener('click', () => {
                    const state = window.Utils.NotificationManager.getPermissionState();
                    if (state !== 'granted') {
                        alert('Primero debes activar las notificaciones.');
                        return;
                    }

                    alert('En 5 segundos llegará la prueba. BLOQUEA TU CELULAR AHORA o salte de la app.');

                    setTimeout(() => {
                        window.Utils.NotificationManager.show(
                            'Prueba Maravillosa 🚀',
                            'Esta es una notificación de prueba. ¡Suena y funciona!',
                            './index.html'
                        );
                    }, 5000);
                });
            }

            updateNotifUI();
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
                    <div style="padding:10px; background:rgba(59,130,246,0.05); border-radius:8px; text-align:center;">
                        <h2 style="color:var(--primary);">${total}</h2>
                        <span style="font-size:0.8rem; color:var(--text-muted);">Total Registros</span>
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
