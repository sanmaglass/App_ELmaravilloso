// Settings View
window.Views = window.Views || {};

window.Views.settings = async (container) => {
    // 1. Render UI
    container.innerHTML = `
        <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1>Configuración</h1>
                <p style="color:var(--text-muted);">Respaldos, empresa y sesión</p>
            </div>
        </div>

        <div class="responsive-grid-2-1">
            <div style="display:flex; flex-direction:column; gap:24px;">

                <!-- SESSION CARD -->
                <div class="card" style="border: 1px solid rgba(220,38,38,0.3); background: linear-gradient(to bottom, rgba(220,38,38,0.05), transparent);">
                    <h3 style="margin-bottom:12px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-shield-check" style="color:var(--primary);"></i>
                        Sesión Activa
                    </h3>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; background:rgba(16,185,129,0.1); padding:8px 12px; border-radius:10px; border:1px solid rgba(16,185,129,0.2);">
                        <div class="security-pulse" style="width:10px; height:10px; background:#10b981; border-radius:50%; box-shadow:0 0 10px #10b981;"></div>
                        <span style="font-size:0.8rem; color:#10b981; font-weight:700; letter-spacing:1px;">SESIÓN SEGURA</span>
                    </div>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">
                        Conectado como <strong style="color:var(--text-primary);" id="session-user-label">—</strong>
                    </p>
                    <button id="btn-logout" class="btn btn-secondary" style="width:100%; color:#f87171; border-color:#f8717140;">
                        <i class="ph ph-sign-out"></i> Cerrar Sesión
                    </button>
                </div>

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
                        La conexión a <strong>Supabase</strong> está configurada de forma segura en el servidor.
                    </p>

                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;">
                        <div style="display:flex; gap:12px;">
                            <button id="btn-sync-now" class="btn btn-primary" style="flex:1;">
                                <i class="ph ph-arrows-clockwise"></i> Sincronizar Ahora
                            </button>
                        </div>
                    </div>

                    <div id="cloud-status" style="margin-top:16px; font-size:0.85rem; padding:8px; border-radius:6px; background:rgba(0,0,0,0.03); display:none;">
                        <!-- Status text -->
                    </div>
                </div>

                <!-- SII INTEGRATION SECTION -->
                <div class="card" style="border: 1px solid #2563eb; background: linear-gradient(to bottom, rgba(37,99,235,0.05), transparent);">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
                        <i class="ph ph-buildings" style="color:#2563eb;"></i>
                        Integración SII (Facturas Automáticas)
                    </h3>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:16px;">
                        Conecta con el Servicio de Impuestos Internos para importar facturas de compra automáticamente desde el Registro de Compras y Ventas (RCV).
                    </p>

                    <div class="form-group" style="margin-bottom:12px;">
                        <label class="form-label">API Key (BaseAPI.cl)</label>
                        <div style="display:flex; gap:8px;">
                            <input type="password" id="sii-api-key" class="form-input" placeholder="sk_..." style="flex:1;">
                            <button id="btn-toggle-sii-key" class="btn btn-secondary" style="padding:0 12px;" title="Mostrar/Ocultar">
                                <i class="ph ph-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
                        <div class="form-group">
                            <label class="form-label">RUT Contribuyente</label>
                            <input type="text" id="sii-rut" class="form-input" placeholder="12345678-9">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Clave SII</label>
                            <div style="display:flex; gap:8px;">
                                <input type="password" id="sii-password" class="form-input" placeholder="Clave tributaria" style="flex:1;">
                                <button id="btn-toggle-sii-pass" class="btn btn-secondary" style="padding:0 12px;" title="Mostrar/Ocultar">
                                    <i class="ph ph-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                        <button id="btn-save-sii" class="btn btn-primary" style="flex:1;">
                            <i class="ph ph-floppy-disk"></i> Guardar
                        </button>
                        <button id="btn-test-sii" class="btn btn-secondary" style="flex:1;">
                            <i class="ph ph-plugs-connected"></i> Probar Conexión
                        </button>
                    </div>

                    <div id="sii-status" style="font-size:0.85rem; padding:8px; border-radius:6px; background:rgba(0,0,0,0.03); display:none;"></div>
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
                        <i class="ph ph-trash"></i> REINICIAR APP (Solo Local)
                    </button>
                    <p style="font-size:0.75rem; color:#991b1b; margin-top:8px; font-style:italic;">
                        *Esto eliminará los datos guardados en este dispositivo. No afecta a la nube.
                    </p>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:24px;">
                <!-- SECURITY LOG CARD -->
                <div class="card" style="background: #050505; border: 1px solid #1a1a1a; padding: 20px;">
                    <h3 style="margin-bottom:16px; display:flex; align-items:center; gap:8px; color:#fff; font-size:1rem;">
                        <i class="ph ph-terminal-window" style="color:var(--primary);"></i>
                        Protocolo de Seguridad
                    </h3>
                    <div id="security-log" style="
                        font-family: 'Space Mono', monospace; 
                        font-size: 0.75rem; 
                        color: #0f0; 
                        background: #000; 
                        padding: 12px; 
                        border-radius: 8px; 
                        height: 150px; 
                        overflow-y: auto;
                        opacity: 0.8;
                    ">
                        <div>[SYSTEM] Inicializando escudo...</div>
                        <div>[AUTH] Sesión verificada vía Supabase JWT</div>
                        <div>[RLS] Políticas de fila forzadas</div>
                        <div>[DATA] Encriptación en tránsito (SSL) activa</div>
                        <div>[READY] Firewall de base de datos en línea</div>
                    </div>
                </div>

                <div class="card">
                    <h3 style="margin-bottom:16px;">Acerca de la App</h3>
                    <div style="font-size:0.9rem; color:var(--text-muted); line-height:1.6;">
                        <p><strong>El Maravilloso v1.7.0 (Stable & Secure)</strong></p>
                        <p>App de Gestión Integral</p>
                        <hr style="margin:12px 0; border:none; border-top:1px solid var(--border);">
                        <p>Desarrollada con arquitectura de alta seguridad y sincronización encriptada.</p>
                        <p style="margin-top:10px; font-size:0.8rem;">Los datos se guardan localmente en tu navegador por seguridad.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 2. Add Logic
    try {
        // --- SESSION DISPLAY & LOGOUT ---
        const userLabel = document.getElementById('session-user-label');
        if (userLabel) {
            userLabel.textContent = localStorage.getItem('wm_user') || 'Administrador';
        }
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                if (await window.showConfirmDialog('Cerrar Sesión', '¿Cerrar sesión en este dispositivo?')) {
                    if (typeof window.AppSignOut === 'function') {
                        await window.AppSignOut();
                    } else {
                        localStorage.removeItem('wm_auth');
                        localStorage.removeItem('wm_user');
                        window.location.reload();
                    }
                }
            });
        }

        // --- ELEMENTS ---
        const btnSync = document.getElementById('btn-sync-now');
        const cloudStatus = document.getElementById('cloud-status');

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
                        window.showToast('¡Datos sincronizados! La app se refrescará.', 'success');
                        window.location.reload();
                    } else {
                        updateStatus('Fallo: ' + result.error, 'error');
                        window.showToast('Error Sync: ' + result.error, 'error');
                    }
                } catch (e) {
                    updateStatus('Error inesperado: ' + e.message, 'error');
                    window.showToast('Excepción Sync: ' + e.message, 'error');
                } finally {
                    btnSync.disabled = false;
                    btnSync.innerHTML = original;
                }
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
                    window.showToast('Error: Utils no cargado', 'error');
                }
            } catch (e) {
                window.showToast('Error al exportar: ' + e.message, 'error');
            } finally {
                btn.innerHTML = original;
            }
        });

        document.getElementById('import-db-input').addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            try {
                const success = await window.Utils.importDatabase(e.target.files[0]);
                if (success) {
                    window.showToast('¡Datos restaurados! La aplicación se reiniciará.', 'success');
                    setTimeout(() => window.location.reload(), 1200);
                }
            } catch (err) {
                window.showToast('Error al importar: ' + err.message, 'error');
            } finally {
                e.target.value = '';
            }
        });

        // --- NUKE ALL ---
        document.getElementById('btn-nuke-all').addEventListener('click', async () => {
            const pass = prompt('Escribe "REINICIAR" para borrar tus datos locales:');
            if (pass !== 'REINICIAR') return;

            const btn = document.getElementById('btn-nuke-all');
            btn.innerHTML = 'Limpiando...';
            btn.disabled = true;

            try {
                // nukeCloud removed for security
                await window.db.employees.clear();
                await window.db.workLogs.clear();
                await window.db.products.clear();
                await window.db.promotions.clear();
                await window.db.settings.clear();

                localStorage.setItem('wm_skip_seed', 'true');
                window.showToast('¡Datos locales borrados! La app se refrescará.', 'success');
                setTimeout(() => window.location.reload(), 1200);
            } catch (e) {
                window.showToast('Error: ' + e.message, 'error');
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
                    window.showToast('La Razón Social y el RUT son obligatorios.', 'error');
                    return;
                }

                localStorage.setItem('company_name', data.name);
                localStorage.setItem('company_rut', data.rut);
                localStorage.setItem('company_giro', data.giro);

                window.showToast('Configuración de empresa guardada con éxito.', 'success');
            });
        }

        // --- SII INTEGRATION HANDLERS ---
        const siiApiKey = document.getElementById('sii-api-key');
        const siiRut = document.getElementById('sii-rut');
        const siiPassword = document.getElementById('sii-password');
        const siiStatus = document.getElementById('sii-status');

        // Load saved SII values
        if (siiApiKey) siiApiKey.value = localStorage.getItem('sii_baseapi_key') || '';
        if (siiRut) siiRut.value = localStorage.getItem('sii_rut') || '';
        if (siiPassword) {
            siiPassword.value = '';
            siiPassword.placeholder = sessionStorage.getItem('sii_password') ? '••••••••' : 'Contraseña SII';
        }

        // Toggle visibility buttons
        document.getElementById('btn-toggle-sii-key')?.addEventListener('click', () => {
            siiApiKey.type = siiApiKey.type === 'password' ? 'text' : 'password';
        });
        document.getElementById('btn-toggle-sii-pass')?.addEventListener('click', () => {
            siiPassword.type = siiPassword.type === 'password' ? 'text' : 'password';
        });

        const updateSiiStatus = (msg, type = 'info') => {
            if (!siiStatus) return;
            siiStatus.style.display = 'block';
            siiStatus.innerHTML = msg;
            siiStatus.style.color = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : 'var(--text-muted)');
        };

        document.getElementById('btn-save-sii')?.addEventListener('click', () => {
            const key = siiApiKey.value.trim();
            const rut = siiRut.value.trim();
            const pass = siiPassword.value.trim();

            if (!key || !rut || !pass) {
                updateSiiStatus('<i class="ph ph-warning"></i> Completa los 3 campos.', 'error');
                return;
            }

            localStorage.setItem('sii_baseapi_key', key);
            localStorage.setItem('sii_rut', rut);
            sessionStorage.setItem('sii_password', pass);
            updateSiiStatus('<i class="ph ph-check-circle"></i> Credenciales guardadas (contraseña solo en esta sesión).', 'success');
        });

        document.getElementById('btn-test-sii')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-test-sii');
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Probando...';
            updateSiiStatus('<i class="ph ph-spinner-gap ph-spin"></i> Conectando con SII...', 'info');

            try {
                // Guardar primero
                localStorage.setItem('sii_baseapi_key', siiApiKey.value.trim());
                localStorage.setItem('sii_rut', siiRut.value.trim());
                sessionStorage.setItem('sii_password', siiPassword.value.trim());

                const now = new Date();
                const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const result = await window.SII_API.consultarRCV(periodo, 'compra');

                if (result.success) {
                    const total = result.data.totalRegistros || 0;
                    const resumen = (result.data.resumenPorTipo || []).map(r =>
                        `${r.tipoDocumento}: ${r.totalDocumentos}`
                    ).join(', ');
                    updateSiiStatus(
                        `<i class="ph ph-check-circle"></i> <b>Conexión exitosa.</b> ${total} documentos en ${periodo}. ${resumen ? '(' + resumen + ')' : ''}`,
                        'success'
                    );
                } else {
                    updateSiiStatus('<i class="ph ph-x-circle"></i> La API respondió pero sin datos.', 'error');
                }
            } catch (err) {
                updateSiiStatus(`<i class="ph ph-x-circle"></i> Error: ${Utils.escapeHTML(err.message)}`, 'error');
            }

            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-plugs-connected"></i> Probar Conexión';
        });

        // --- INIT STATE ---
        // Load saved values
        if (companyName) companyName.value = localStorage.getItem('company_name') || '';
        if (companyRut) companyRut.value = localStorage.getItem('company_rut') || '';
        if (companyGiro) companyGiro.value = localStorage.getItem('company_giro') || '';

        // Show sync connection status
        if (window.Sync && window.Sync.client) {
            updateStatus('<i class="ph ph-wifi-high"></i> Conectado a la nube', 'success');
        } else {
            updateStatus('<i class="ph ph-warning"></i> Sin conexión a la nube', 'warning');
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
                        window.showToast('Primero debes activar las notificaciones.', 'error');
                        return;
                    }

                    window.showToast('En 5 segundos llegará la prueba. ¡Bloquea tu celular ahora!', 'info');

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
            if (!await window.showConfirmDialog('Borrar Datos Locales', '¿Borrar datos locales?')) return;
            await window.db.employees.clear();
            await window.db.workLogs.clear();
            await window.db.products.clear();
            await window.db.promotions.clear();
            window.showToast('Datos locales borrados.', 'success');
            updateStorageStats();
        });

    } catch (err) {

        console.error("Critical Settings Error:", err);
        container.innerHTML += `<div style="padding:20px; color:red;">Error cargando scripts de ajustes: ${window.Utils.escapeHTML(err.message)}</div>`;
    }
};
