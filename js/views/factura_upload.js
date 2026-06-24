// factura_upload.js — Subida de foto de factura (vista Cajera)
window.Views = window.Views || {};

(function () {

    window.Views.factura_upload = async (container) => {
        const tenantId = window.Auth?.getTenantId();
        const userId   = window.Auth?.session?.user?.id;
        const email    = window.state?.currentUser || window.Auth?.session?.user?.email || '';

        // Fecha de hoy en formato YYYY-MM-DD (hora Chile)
        function fechaHoy() {
            const now = new Date();
            const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
            return `${chile.getFullYear()}-${String(chile.getMonth() + 1).padStart(2, '0')}-${String(chile.getDate()).padStart(2, '0')}`;
        }

        // Estado interno del módulo
        let _blob = null;  // Blob JPEG resultante de canvas
        let _previewUrl = null; // dataURL para preview

        container.innerHTML = `
            <div style="max-width:520px; margin:0 auto; padding:0 16px 48px;">

                <!-- Header -->
                <div style="margin-bottom:24px;">
                    <div style="font-size:0.78rem; color:var(--primary); font-weight:700;
                                letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">
                        Módulo Equipo
                    </div>
                    <h1 style="margin:0 0 4px; font-size:1.6rem; color:var(--text-primary); font-weight:800;">
                        <i class="ph-fill ph-receipt" style="margin-right:8px; color:var(--primary);"></i>Subir Factura
                    </h1>
                    <p style="margin:0; color:var(--text-muted); font-size:0.88rem;">
                        Fotografía la factura cuando llegue mercadería
                    </p>
                </div>

                <!-- ZONA DE FOTO -->
                <div id="fu-foto-zona" style="margin-bottom:20px;">

                    <!-- Estado inicial: botón tomar foto -->
                    <div id="fu-captura-panel" style="
                        background:var(--bg-card); border:2px dashed var(--border);
                        border-radius:20px; padding:36px 24px; text-align:center;
                        transition:border-color 0.2s;">
                        <i class="ph-fill ph-camera" style="font-size:3rem; color:var(--primary); display:block; margin-bottom:12px; opacity:0.85;"></i>
                        <p style="margin:0 0 20px; color:var(--text-muted); font-size:0.9rem; line-height:1.5;">
                            Toma una foto clara de la factura.<br>
                            <span style="font-size:0.82rem; opacity:0.75;">El sistema mejorará el contraste automáticamente.</span>
                        </p>
                        <label id="fu-label-foto" style="
                            display:inline-flex; align-items:center; gap:10px;
                            padding:14px 28px; background:var(--primary); color:#fff;
                            border-radius:14px; font-weight:700; font-size:1rem; cursor:pointer;
                            box-shadow:0 4px 14px rgba(76,141,255,0.35); transition:opacity 0.15s;">
                            <i class="ph-fill ph-camera"></i> Tomar foto
                            <input id="fu-input-foto" type="file" accept="image/*" capture="environment"
                                style="display:none; position:absolute; width:0; height:0; opacity:0;">
                        </label>
                    </div>

                    <!-- Vista previa (oculto hasta que hay foto) -->
                    <div id="fu-preview-panel" style="display:none;">
                        <div style="background:var(--bg-card); border:1px solid var(--border);
                                    border-radius:20px; overflow:hidden; position:relative;">
                            <!-- Badge "Mejorada" -->
                            <div style="position:absolute; top:12px; left:12px; z-index:2;
                                        background:rgba(22,163,74,0.92); color:#fff; font-size:0.72rem;
                                        font-weight:700; padding:4px 10px; border-radius:8px;
                                        display:flex; align-items:center; gap:5px;">
                                <i class="ph ph-sparkle"></i> Imagen mejorada
                            </div>
                            <img id="fu-preview-img" src="" alt="Vista previa factura"
                                style="width:100%; display:block; max-height:360px; object-fit:contain; background:#f5f5f3;">
                        </div>
                        <!-- Botón repetir -->
                        <div style="margin-top:12px; text-align:center;">
                            <label id="fu-label-repetir" style="
                                display:inline-flex; align-items:center; gap:8px;
                                padding:10px 20px; background:transparent; color:var(--text-muted);
                                border:1px solid var(--border); border-radius:10px;
                                font-size:0.88rem; font-weight:600; cursor:pointer; transition:all 0.15s;">
                                <i class="ph ph-arrow-clockwise"></i> Repetir foto
                                <input id="fu-input-repetir" type="file" accept="image/*" capture="environment"
                                    style="display:none; position:absolute; width:0; height:0; opacity:0;">
                            </label>
                        </div>
                    </div>
                </div>

                <!-- FORMULARIO (aparece al tener foto) -->
                <div id="fu-form-panel" style="display:none;">

                    <!-- Proveedor -->
                    <div style="margin-bottom:16px;">
                        <label style="display:block; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                                      text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                            <i class="ph ph-buildings" style="margin-right:4px;"></i>Proveedor *
                        </label>
                        <input id="fu-proveedor" type="text" maxlength="80"
                            placeholder="Ej: Comercial López, SOPRAVAL…"
                            style="width:100%; box-sizing:border-box; padding:13px 16px;
                                   background:var(--bg-card); border:1.5px solid var(--border);
                                   border-radius:12px; color:var(--text-primary); font:inherit;
                                   font-size:0.95rem; outline:none; transition:border-color 0.2s;">
                    </div>

                    <!-- Fecha -->
                    <div style="margin-bottom:16px;">
                        <label style="display:block; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                                      text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                            <i class="ph ph-calendar" style="margin-right:4px;"></i>Fecha
                        </label>
                        <input id="fu-fecha" type="date"
                            style="width:100%; box-sizing:border-box; padding:13px 16px;
                                   background:var(--bg-card); border:1.5px solid var(--border);
                                   border-radius:12px; color:var(--text-primary); font:inherit;
                                   font-size:0.95rem; outline:none; transition:border-color 0.2s;">
                    </div>

                    <!-- Nota opcional -->
                    <div style="margin-bottom:24px;">
                        <label style="display:block; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                                      text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                            <i class="ph ph-note-pencil" style="margin-right:4px;"></i>Nota (opcional)
                        </label>
                        <input id="fu-nota" type="text" maxlength="120"
                            placeholder="Ej: Llegó incompleto, falta precio…"
                            style="width:100%; box-sizing:border-box; padding:13px 16px;
                                   background:var(--bg-card); border:1.5px solid var(--border);
                                   border-radius:12px; color:var(--text-primary); font:inherit;
                                   font-size:0.95rem; outline:none; transition:border-color 0.2s;">
                    </div>

                    <!-- Botones acción -->
                    <div style="display:flex; flex-direction:column; gap:12px;">

                        <!-- Guardar -->
                        <button id="fu-btn-guardar" style="
                            width:100%; padding:16px; background:var(--primary); color:#fff;
                            border:none; border-radius:14px; font-weight:800; font-size:1rem;
                            cursor:pointer; display:flex; align-items:center; justify-content:center;
                            gap:10px; box-shadow:0 4px 14px rgba(76,141,255,0.3); transition:opacity 0.15s;">
                            <i class="ph-fill ph-floppy-disk"></i>
                            <span id="fu-btn-guardar-txt">Guardar factura</span>
                        </button>

                        <!-- WhatsApp / Compartir -->
                        <button id="fu-btn-share" style="
                            width:100%; padding:14px; background:transparent; color:#16a34a;
                            border:1.5px solid #16a34a; border-radius:14px; font-weight:700;
                            font-size:0.95rem; cursor:pointer; display:flex; align-items:center;
                            justify-content:center; gap:10px; transition:all 0.15s;">
                            <i class="ph-fill ph-whatsapp-logo"></i> Enviar por WhatsApp
                        </button>

                    </div>
                </div>

                <!-- Canvas oculto para procesamiento de imagen -->
                <canvas id="fu-canvas" style="display:none;"></canvas>

            </div>
        `;

        // Foco en proveedor cuando aparezca el form
        const inputFecha = container.querySelector('#fu-fecha');
        inputFecha.value = fechaHoy();

        // ── Procesamiento de imagen ───────────────────────────────────────────
        async function procesarImagen(file) {
            if (!file || !file.type.startsWith('image/')) return;

            const canvas = container.querySelector('#fu-canvas');
            const ctx = canvas.getContext('2d');

            // Leer imagen como bitmap
            const bmp = await createImageBitmap(file);
            let { width: w, height: h } = bmp;

            // Redimensionar si el lado mayor > 1600px
            const MAX = 1600;
            if (Math.max(w, h) > MAX) {
                const ratio = MAX / Math.max(w, h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            canvas.width  = w;
            canvas.height = h;

            // Aplicar filtro de mejora tipo escaneo ANTES de dibujar
            ctx.filter = 'grayscale(0.15) contrast(1.5) brightness(1.08) saturate(1.05)';
            ctx.drawImage(bmp, 0, 0, w, h);
            bmp.close();

            // Obtener blob JPEG y dataURL para preview
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve({ blob, dataUrl: e.target.result });
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', 0.88);
            });
        }

        function mostrarPreview(dataUrl) {
            const capPanel   = container.querySelector('#fu-captura-panel');
            const prevPanel  = container.querySelector('#fu-preview-panel');
            const formPanel  = container.querySelector('#fu-form-panel');
            const previewImg = container.querySelector('#fu-preview-img');

            previewImg.src = dataUrl;
            capPanel.style.display  = 'none';
            prevPanel.style.display = 'block';
            formPanel.style.display = 'block';

            // Enfocar proveedor
            setTimeout(() => container.querySelector('#fu-proveedor')?.focus(), 100);
        }

        function volverACaptura() {
            const capPanel  = container.querySelector('#fu-captura-panel');
            const prevPanel = container.querySelector('#fu-preview-panel');
            const formPanel = container.querySelector('#fu-form-panel');

            capPanel.style.display  = 'block';
            prevPanel.style.display = 'none';
            formPanel.style.display = 'none';
            _blob       = null;
            _previewUrl = null;
        }

        // ── Handlers de input file ────────────────────────────────────────────
        async function handleFileChange(e) {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = ''; // permitir volver a elegir el mismo archivo

            try {
                const result = await procesarImagen(file);
                if (!result) return;
                _blob       = result.blob;
                _previewUrl = result.dataUrl;
                mostrarPreview(_previewUrl);
            } catch (err) {
                console.error('[factura_upload] Error procesando imagen:', err);
                window.showToast?.('No se pudo procesar la imagen. Inténtalo de nuevo.', 'error');
            }
        }

        container.querySelector('#fu-input-foto').addEventListener('change', handleFileChange);
        container.querySelector('#fu-input-repetir').addEventListener('change', async (e) => {
            await handleFileChange(e);
        });

        // ── Guardar factura ───────────────────────────────────────────────────
        container.querySelector('#fu-btn-guardar').addEventListener('click', async () => {
            if (!_blob) {
                window.showToast?.('Primero toma una foto de la factura.', 'error');
                return;
            }

            const proveedor = (container.querySelector('#fu-proveedor')?.value || '').trim();
            const fecha     = container.querySelector('#fu-fecha')?.value || fechaHoy();
            const nota      = (container.querySelector('#fu-nota')?.value || '').trim();

            if (!proveedor) {
                window.showToast?.('El nombre del proveedor es obligatorio.', 'error');
                container.querySelector('#fu-proveedor')?.focus();
                return;
            }

            const btn    = container.querySelector('#fu-btn-guardar');
            const btnTxt = container.querySelector('#fu-btn-guardar-txt');
            btn.disabled = true;
            btnTxt.textContent = 'Subiendo foto…';

            try {
                // 1. Subir foto a Storage
                const path = `${tenantId}/${Date.now()}-factura.jpg`;
                const { error: storageError } = await window.SyncV2.client
                    .storage.from('facturas').upload(path, _blob, { contentType: 'image/jpeg' });

                if (storageError) throw storageError;

                // 2. Guardar registro en purchase_invoices
                const notesField = [
                    `Foto: ${path}`,
                    nota ? `— ${nota}` : '',
                    `— subida por ${email}`
                ].filter(Boolean).join(' ');

                // Determinar periodo YYYY-MM para el campo period
                const period = fecha && fecha.length >= 7 ? fecha.substring(0, 7) : fechaHoy().substring(0, 7);

                const invoiceData = {
                    // sin id: saveAndSync genera el id numérico (la columna es bigint)
                    tenant_id:     tenantId,
                    supplierId:    null,               // sin lookup de tabla suppliers
                    supplierName:  proveedor,
                    invoiceNumber: '',                 // pendiente de ingresar por admin
                    date:          fecha,
                    amount:        0,
                    period:        period,
                    paymentMethod: 'Pendiente',
                    paymentStatus: 'Pendiente',
                    creditDays:    0,
                    dueDate:       fecha,
                    notes:         notesField,
                    paidAmount:    0,
                    deleted:       false,
                    version:       1,
                    created_at:    new Date().toISOString()
                };

                btnTxt.textContent = 'Guardando…';
                await window.DataManager.saveAndSync('purchase_invoices', invoiceData);

                window.showToast?.('Factura guardada correctamente', 'success');

                // Limpiar formulario y volver al estado inicial
                container.querySelector('#fu-proveedor').value = '';
                container.querySelector('#fu-fecha').value     = fechaHoy();
                container.querySelector('#fu-nota').value      = '';
                volverACaptura();

            } catch (err) {
                console.error('[factura_upload] Error guardando:', err);
                const msg = err?.message || 'Error desconocido';
                window.showToast?.(`Error al guardar: ${msg}`, 'error');
            } finally {
                btn.disabled = false;
                btnTxt.textContent = 'Guardar factura';
            }
        });

        // ── Compartir por WhatsApp ────────────────────────────────────────────
        container.querySelector('#fu-btn-share').addEventListener('click', async () => {
            if (!_blob) {
                window.showToast?.('Primero toma una foto de la factura.', 'error');
                return;
            }

            const proveedor = (container.querySelector('#fu-proveedor')?.value || '').trim();
            const fecha     = container.querySelector('#fu-fecha')?.value || fechaHoy();
            const caption   = `Factura ${proveedor || '(sin proveedor)'} — ${fecha} — El Maravilloso`;

            try {
                const file = new File([_blob], 'factura.jpg', { type: 'image/jpeg' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], text: caption });
                } else {
                    window.open('https://wa.me/?text=' + encodeURIComponent(caption), '_blank');
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('[factura_upload] Error compartiendo:', err);
                    window.open('https://wa.me/?text=' + encodeURIComponent(caption), '_blank');
                }
            }
        });

        // Focus-style en inputs
        const styledInputs = container.querySelectorAll('input[type="text"], input[type="date"]');
        styledInputs.forEach(inp => {
            inp.addEventListener('focus', () => { inp.style.borderColor = 'var(--primary)'; });
            inp.addEventListener('blur',  () => { inp.style.borderColor = 'var(--border)'; });
        });
    };

})();
