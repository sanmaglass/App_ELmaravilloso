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

                <!-- STORAGE MONITOR --  >
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

    // Load saved values
    supaUrl.value = localStorage.getItem('supabase_url') || '';
    supaKey.value = localStorage.getItem('supabase_key') || '';

    // Check for PRO MODE (Hardcoded Config)
    if (window.AppConfig && window.AppConfig.supabaseUrl) {
        supaUrl.value = window.AppConfig.supabaseUrl;
        supaKey.value = "**********************************"; // Masked key

        supaUrl.disabled = true;
        supaKey.disabled = true;
        btnConnect.disabled = true;
        btnToggleKey.disabled = true;
        btnGenQr.style.display = 'none'; // No need for QR in Pro Mode

        const proBadge = document.createElement('div');
        proBadge.innerHTML = '<i class="ph ph-crown"></i> MODO PRO ACTIVO: Configuración Global 24/7';
        proBadge.style.cssText = 'background: linear-gradient(135deg, #FFD700, #FFA500); color: black; padding: 10px; border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(255, 215, 0, 0.3);';

        // Insert before the input group
        supaUrl.closest('.form-group').parentNode.insertBefore(proBadge, supaUrl.closest('.form-group'));
    }

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

        // Prefix to prevent iPhone from opening as URL
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

    // ... (Verify connection on load code omitted intentionally if not changing) ...

    const cleanUrl = (u) => {
        u = u.trim();
        // Return as is if it's empty to avoid adding https:// to nothing
        if (!u) return '';
        if (!u.startsWith('http')) u = 'https://' + u;
        return u.replace(/\/$/, ''); // Remove trailing slash
    };

    const tryParsePaste = (text) => {
        try {
            // Remove prefix if present
            if (text.startsWith("CONFIG:")) {
                text = text.substring(7);
            }

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
            if (input === supaUrl && input.value) input.value = cleanUrl(input.value);
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
            }
        } catch (e) {
            updateStatus('Error inesperado: ' + e.message, 'error');
        } finally {
            btnSync.disabled = false;
            btnSync.innerHTML = original;
        }
    });

    // --- STORAGE MONITOR ---
    const refreshStats = async () => {
        const statsContainer = document.getElementById('storage-stats');
        if (!statsContainer) return;

        statsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">Cargando...</div>';

        try {
            const counts = {
                employees: await window.db.employees.count(),
                workLogs: await window.db.workLogs.count(),
                products: await window.db.products.count(),
                promotions: await window.db.promotions.count()
            };

            const total = Object.values(counts).reduce((a, b) => a + b, 0);

            // Estimate storage (rough calculation: ~1KB per record average)
            const estimatedKB = total;
            const estimatedMB = (estimatedKB / 1024).toFixed(2);

            statsContainer.innerHTML = `
                <div style="padding:12px; background:white; border-radius:8px; border:1px solid var(--border);">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Empleados</div>
                    <div style="font-size:1.3rem; font-weight:bold; color:var(--primary);">${counts.employees}</div>
                </div>
                <div style="padding:12px; background:white; border-radius:8px; border:1px solid var(--border);">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Jornadas</div>
                    <div style="font-size:1.3rem; font-weight:bold; color:var(--accent);">${counts.workLogs}</div>
                </div>
                <div style="padding:12px; background:white; border-radius:8px; border:1px solid var(--border);">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Productos</div>
                    <div style="font-size:1.3rem; font-weight:bold; color:var(--success);">${counts.products}</div>
                </div>
                <div style="padding:12px; background:white; border-radius:8px; border:1px solid var(--border);">
                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Campañas</div>
                    <div style="font-size:1.3rem; font-weight:bold; color:var(--warning);">${counts.promotions}</div>
                </div>
                <div style="padding:12px; background:linear-gradient(135deg, var(--primary), var(--accent)); border-radius:8px; color:white; grid-column:span 2;">
                    <div style="font-size:0.75rem; opacity:0.9; text-transform:uppercase; margin-bottom:4px;">Total Records</div>
                    <div style="font-size:1.5rem; font-weight:bold;">${total}</div>
                    <div style="font-size:0.7rem; opacity:0.8; margin-top:2px;">~${estimatedMB} MB estimado</div>
                </div>
            `;
        } catch (err) {
            statsContainer.innerHTML = `<div style="grid-column: 1/-1; color:var(--danger);">Error: ${err.message}</div>`;
        }
    };

    // Initial load
    refreshStats();

    // Refresh button
    document.getElementById('btn-refresh-stats').addEventListener('click', refreshStats);

    // Clear local button
    document.getElementById('btn-clear-local').addEventListener('click', async () => {
        if (!confirm('Esto borrará todos los datos locales y los volverá a descargar desde la nube. ¿Continuar?')) return;

        const btn = document.getElementById('btn-clear-local');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Limpiando...';
        btn.disabled = true;

        try {
            // Clear all local tables
            const tables = ['employees', 'workLogs', 'products', 'promotions'];
            for (const table of tables) {
                await window.db[table].clear();
            }

            // Re-sync from cloud
            if (window.Sync.client) {
                await window.Sync.syncAll();
            }

            alert('¡Datos locales limpiados y re-sincronizados desde la nube!');
            refreshStats();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
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

            // 3. Set flag to prevent auto-seeding
            localStorage.setItem('wm_skip_seed', 'true');

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

    // ===== STORAGE MONITOR =====
    async function updateStorageStats() {
        const statsContainer = document.getElementById('storage-stats');
        statsContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);"><i class="ph ph-spinner-gap ph-spin"></i> Cargando...</p>';

        try {
            // Get counts from local IndexedDB
            const employees = await window.db.employees.toArray();
            const workLogs = await window.db.workLogs.toArray();
            const products = await window.db.products.toArray();
            const promotions = await window.db.promotions.toArray();

            // Filter active (non-deleted)
            const activeEmployees = employees.filter(e => !e.deleted);
            const activeWorkLogs = workLogs.filter(w => !w.deleted);
            const activeProducts = products.filter(p => !p.deleted);
            const activePromotions = promotions.filter(p => !p.deleted);

            const totalActive = activeEmployees.length + activeWorkLogs.length + activeProducts.length + activePromotions.length;
            const totalWithDeleted = employees.length + workLogs.length + products.length + promotions.length;

            statsContainer.innerHTML = `
                <div style="padding:12px; background:rgba(99,102,241,0.1); border-radius:8px; text-align:center;">
                    <div style="font-size:2rem; font-weight:700; color:var(--accent);">${totalActive}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Registros Activos</div>
                </div>
                <div style="padding:12px; background:rgba(0,0,0,0.03); border-radius:8px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:600; color:var(--text-secondary);">${employees.length - activeEmployees.length}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Borrados (ocultos)</div>
                </div>
                <div style="padding:12px; background:rgba(16,185,129,0.1); border-radius:8px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:600; color:#10b981;">${activeEmployees.length}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Empleados</div>
                </div>
                <div style="padding:12px; background:rgba(245,158,11,0.1); border-radius:8px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:600; color:#f59e0b;">${activeProducts.length}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Productos</div>
                </div>
                <div style="padding:12px; background:rgba(59,130,246,0.1); border-radius:8px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:600; color:#3b82f6;">${activeWorkLogs.length}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Registros Laborales</div>
                </div>
                <div style="padding:12px; background:rgba(236,72,153,0.1); border-radius:8px; text-align:center;">
                    <div style="font-size:1.5rem; font-weight:600; color:#ec4899;">${activePromotions.length}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Promociones</div>
                </div>
            `;

            // Try to estimate storage size
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
                const percentUsed = ((estimate.usage / estimate.quota) * 100).toFixed(1);

                statsContainer.innerHTML += `
                    <div style="grid-column: 1 / -1; padding:12px; background:rgba(139,92,246,0.1); border-radius:8px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="font-size:0.75rem; color:var(--text-muted);">Espacio usado</span>
                            <span style="font-size:0.75rem; font-weight:600; color:#8b5cf6;">${usedMB} MB / ${quotaMB} MB</span>
                        </div>
                        <div style="width:100%; height:8px; background:rgba(0,0,0,0.1); border-radius:4px; overflow:hidden;">
                            <div style="width:${percentUsed}%; height:100%; background:linear-gradient(90deg, #8b5cf6, #ec4899); transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            statsContainer.innerHTML = '<p style="text-align:center; color:var(--danger);">Error al cargar estadísticas</p>';
            console.error('Storage stats error:', error);
        }
    }

    // Load stats on view load
    updateStorageStats();

    // Refresh button
    document.getElementById('btn-refresh-stats').addEventListener('click', () => {
        updateStorageStats();
    });

    // Clear local button
    document.getElementById('btn-clear-local').addEventListener('click', async () => {
        if (!confirm('¿Borrar TODOS los datos locales y volver a sincronizar desde la nube?\n\nEsto puede tardar unos segundos.')) return;

        try {
            const btn = document.getElementById('btn-clear-local');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Limpiando...';
            btn.disabled = true;

            // Clear all tables
            await window.db.employees.clear();
            await window.db.workLogs.clear();
            await window.db.products.clear();
            await window.db.promotions.clear();

            // Trigger sync to re-download
            if (window.Sync && window.Sync.syncAll) {
                await window.Sync.syncAll();
            }

            alert('✅ Datos locales borrados. Recarga sincronizada desde la nube.');
            updateStorageStats();

            btn.innerHTML = original;
            btn.disabled = false;
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
};

