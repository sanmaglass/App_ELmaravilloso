// Security View - CCTV Integration (Hikvision)
window.Views = window.Views || {};

window.Views.security = async (container) => {
    // Load current NVR settings
    const nvrIp = (await window.db.settings.get('nvr_ip'))?.value || '192.168.1.22';
    const nvrUser = (await window.db.settings.get('nvr_user'))?.value || 'admin';
    const nvrPass = (await window.db.settings.get('nvr_pass'))?.value || '';
    const nvrPort = (await window.db.settings.get('nvr_port'))?.value || '80';
    const camCount = (await window.db.settings.get('cam_count'))?.value || 4;
    const streamType = (await window.db.settings.get('nvr_stream_type'))?.value || '02'; // Default to sub-stream (02) for better compatibility
    const nvrEndpoint = (await window.db.settings.get('nvr_endpoint'))?.value || 'Streaming'; // 'Streaming' or 'ContentMgmt/StreamingProxy'
    const channelFormat = (await window.db.settings.get('nvr_channel_format'))?.value || '101'; // '101' (101, 201...) or '1' (1, 2, 3...)

    container.innerHTML = `
        <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin:0; display:flex; align-items:center; gap:12px;">
                    <i class="ph ph-video-camera" style="color:var(--primary);"></i>
                    Seguridad
                </h1>
                <p style="color:var(--text-muted); margin-top:4px;">Cámaras en vivo</p>
            </div>
            <button id="btn-config-nvr" class="btn btn-secondary">
                <i class="ph ph-gear"></i> <span class="hide-mobile">Configuración Avanzada</span><span class="show-mobile-only" style="display:none;">Ajustes</span>
            </button>
        </div>

        <div id="cams-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
            <!-- Cameras will load here -->
            <div class="loading-state" style="grid-column: 1/-1; padding: 100px;">
                <div class="spinner"></div>
                <p>Estableciendo conexión...</p>
            </div>
        </div>

        <div style="margin-top:24px; padding:16px; background:rgba(220,38,38,0.05); border-radius:12px; border:1px dashed var(--primary); font-size:0.9rem; color:var(--text-secondary);">
            <i class="ph ph-info"></i> <b>Guía de Solución:</b> Si ves un error XML, abre **Configuración Avanzada** y cambia el **"Formato de Canal"** a **"Simple (1, 2, 3)"**. Algunos modelos antiguos requieren este formato.
        </div>
    `;

    const grid = document.getElementById('cams-grid');
    let refreshTimers = [];

    const startStreaming = () => {
        grid.innerHTML = '';
        refreshTimers.forEach(t => clearInterval(t));
        refreshTimers = [];

        for (let i = 1; i <= camCount; i++) {
            const camId = i;
            let channel = i;
            if (channelFormat === '101') {
                channel = (camId * 100) + parseInt(streamType);
            }

            const apiUrl = `/ISAPI/${nvrEndpoint}/channels/${channel}/picture`;

            const camCard = document.createElement('div');
            camCard.className = 'card';
            camCard.style.padding = '0';
            camCard.style.overflow = 'hidden';
            camCard.style.background = '#000';
            camCard.style.position = 'relative';
            camCard.style.aspectRatio = '16/9';

            camCard.innerHTML = `
                <div style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.6); color:#fff; padding:4px 10px; border-radius:4px; font-size:0.75rem; font-weight:bold; z-index:10; display:flex; align-items:center; gap:6px;">
                    <span style="width:8px; height:8px; background:#ff0000; border-radius:50%; box-shadow:0 0 5px #ff0000;"></span>
                    CÁMARA ${camId} (CH ${channel})
                </div>
                <img id="img-cam-${camId}" alt="Stream Cámara ${camId}" style="width:100%; height:100%; object-fit:cover; display:block;">
                <div id="status-cam-${camId}" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:rgba(255,255,255,0.4); font-size:0.8rem; padding:20px; text-align:center;">
                    <i class="ph ph-circle-notch ph-spin" style="font-size:1.5rem; margin-bottom:12px;"></i>
                    Conectando...
                    <button class="btn btn-secondary" style="margin-top:12px; font-size:0.7rem; padding:6px 12px; background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.2);" onclick="window.open('http://${nvrIp}:${nvrPort}${apiUrl}', '_blank')">
                        <i class="ph ph-arrow-square-out"></i> Probar en otra pestaña
                    </button>
                </div>
            `;

            grid.appendChild(camCard);

            const img = document.getElementById(`img-cam-${camId}`);
            const status = document.getElementById(`status-cam-${camId}`);

            const updateImage = () => {
                // Hikvision ISAPI URL: http://user:pass@ip:port/ISAPI/Streaming/channels/101/picture
                // Note: Auth in URL is deprecated but can work in some older browsers/NVRs.
                // Modern way: The browser will ask for credentials if not provided, or we use a proxy.
                // For local files, we'll try the direct approach.
                const timestamp = new Date().getTime();
                // We don't put user:pass in URL here for security/modern browser compatibility. 
                // The browser will prompt for credentials once for the NVR.
                img.src = `http://${nvrIp}:${nvrPort}${apiUrl}?t=${timestamp}`;

                img.onload = () => {
                    status.style.display = 'none';
                    img.style.opacity = '1';
                };

                img.onerror = () => {
                    status.innerHTML = `
                        <i class="ph ph-warning-circle" style="font-size:1.5rem; margin-bottom:12px; color:#ff8888;"></i>
                        <div style="font-weight:bold; color:#ff8888;">Error XML / Red</div>
                        <div style="font-size:0.7rem; margin-top:4px; opacity:0.8;">Modelo incompatible con el canal ${channel}.</div>
                        <button class="btn btn-primary" style="margin-top:12px; font-size:0.75rem; padding:8px 16px;" onclick="window.open('http://${nvrIp}:${nvrPort}${apiUrl}', '_blank')">
                            <i class="ph ph-wrench"></i> Cambiar Configuración
                        </button>
                    `;
                    status.style.display = 'flex';
                    img.style.opacity = '0.3';
                };
            };

            // Initial call
            updateImage();
            // Start refresh interval (2 seconds)
            const timer = setInterval(updateImage, 2000);
            refreshTimers.push(timer);
        }
    };

    // Modal Config
    const configBtn = document.getElementById('btn-config-nvr');
    if (configBtn) {
        configBtn.addEventListener('click', () => {
            const modal = document.getElementById('modal-container');
            if (!modal) return;

            modal.innerHTML = `
                <div class="modal" style="max-width:500px; border: 2px solid var(--primary);">
                    <div class="modal-header">
                        <h3 class="modal-title">Configuración Técnica de Cámaras</h3>
                        <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div style="background:#fffdec; padding:12px; border-radius:8px; border:1px solid #f97316; margin-bottom:16px; font-size:0.85rem;">
                            <i class="ph ph-warning-diamond" style="color:#f97316;"></i> <b>Si nada funciona, revisa tu NVR Hikvision:</b><br>
                            Ve a: <i>Red -> Ajustes Avanzados -> Protocolo de Integración</i>.<br>
                            1. Marca <b>"Habilitar Hikvision-CGI"</b>.<br>
                            2. Cambia Autenticación a <b>"Digest/Basic"</b>.<br>
                            3. Crea un usuario "admin" ahí o asegúrate de que tenga permisos.
                        </div>

                        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:12px;">
                            <div class="form-group" style="margin-bottom:12px;">
                                <label class="form-label">Dirección IP del NVR</label>
                                <input type="text" id="cfg-nvr-ip" class="form-input" value="${nvrIp}">
                            </div>
                            <div class="form-group" style="margin-bottom:12px;">
                                <label class="form-label">Puerto</label>
                                <input type="text" id="cfg-nvr-port" class="form-input" value="${nvrPort}">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div class="form-group" style="margin-bottom:12px;">
                                <label class="form-label">Usuario</label>
                                <input type="text" id="cfg-nvr-user" class="form-input" value="${nvrUser}">
                            </div>
                            <div class="form-group" style="margin-bottom:12px;">
                                <label class="form-label">Contraseña</label>
                                <input type="password" id="cfg-nvr-pass" class="form-input" value="${nvrPass}">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div class="form-group" style="margin-bottom:12px;">
                                <label class="form-label">Formato de Canal</label>
                                <select id="cfg-nvr-format" class="form-input">
                                    <option value="101" ${channelFormat === '101' ? 'selected' : ''}>Completo (101)</option>
                                    <option value="1" ${channelFormat === '1' ? 'selected' : ''}>Simple (1)</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:12px;">
                                <label class="form-label">Calidad</label>
                                <select id="cfg-nvr-stream" class="form-input">
                                    <option value="01" ${streamType === '01' ? 'selected' : ''}>Alta</option>
                                    <option value="02" ${streamType === '02' ? 'selected' : ''}>Baja</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom:12px;">
                            <label class="form-label">Método de Conexión</label>
                            <select id="cfg-nvr-endpoint" class="form-input">
                                <option value="Streaming" ${nvrEndpoint === 'Streaming' ? 'selected' : ''}>Estandar (Streaming)</option>
                                <option value="ContentMgmt/StreamingProxy" ${nvrEndpoint === 'ContentMgmt/StreamingProxy' ? 'selected' : ''}>Redes Modernas (Proxy)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">N° de Cámaras</label>
                            <input type="number" id="cfg-cam-count" class="form-input" value="${camCount}">
                        </div>

                        <div style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.05); border-radius:10px;">
                            <p style="margin:0 0 10px 0; font-weight:bold; font-size:0.85rem;">Herramientas:</p>
                            <div style="display:flex; gap:10px;">
                                <button class="btn btn-secondary" style="font-size:0.75rem; flex:1;" onclick="window.open('http://${nvrIp}:${nvrPort}/ISAPI/Streaming/channels/1/picture', '_blank')">Test Canal 1</button>
                                <button class="btn btn-secondary" style="font-size:0.75rem; flex:1;" onclick="window.open('http://${nvrIp}:${nvrPort}/ISAPI/Streaming/channels/101/picture', '_blank')">Test Canal 101</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="btn-save-nvr" style="width:100%;">Guardar Cambios</button>
                    </div>
                </div>
            `;

            modal.classList.remove('hidden');
            modal.style.display = 'flex'; // Ensure display is flex as per CSS

            document.getElementById('btn-save-nvr').addEventListener('click', async () => {
                const newIp = document.getElementById('cfg-nvr-ip').value;
                const newPort = document.getElementById('cfg-nvr-port').value;
                const newUser = document.getElementById('cfg-nvr-user').value;
                const newPass = document.getElementById('cfg-nvr-pass').value;
                const newCount = document.getElementById('cfg-cam-count').value;
                const newStream = document.getElementById('cfg-nvr-stream').value;
                const newEndpoint = document.getElementById('cfg-nvr-endpoint').value;

                await window.db.settings.put({ key: 'nvr_ip', value: newIp });
                await window.db.settings.put({ key: 'nvr_port', value: newPort });
                await window.db.settings.put({ key: 'nvr_user', value: newUser });
                await window.db.settings.put({ key: 'nvr_pass', value: newPass });
                await window.db.settings.put({ key: 'cam_count', value: parseInt(newCount) });
                await window.db.settings.put({ key: 'nvr_stream_type', value: newStream });
                await window.db.settings.put({ key: 'nvr_endpoint', value: newEndpoint });

                modal.classList.add('hidden');
                window.Views.security(container); // Refresh view
            });
        });
    }

    startStreaming();

    // Clean up on view change
    const viewButtons = document.querySelectorAll('.nav-item');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            refreshTimers.forEach(t => clearInterval(t));
        }, { once: true });
    });
};
