// Team Reports View — Reportes del equipo (pedidos, mermas, limpieza, reportes)
window.Views = window.Views || {};

(function () {
    // ── Constantes de tipo ──
    const TIPOS = {
        pedido:   { label: 'Pedido',   icon: 'ph-package',   color: '#3b82f6', bg: '#eff6ff', placeholder_title: '¿Qué producto necesitas?',       placeholder_desc: 'Indica cantidad, urgencia u otros detalles...' },
        merma:    { label: 'Merma',    icon: 'ph-trash',     color: '#ef4444', bg: '#fef2f2', placeholder_title: '¿Qué producto se dañó o venció?', placeholder_desc: 'Describe el estado, cantidad afectada...' },
        limpieza: { label: 'Limpieza', icon: 'ph-broom',     color: '#22c55e', bg: '#f0fdf4', placeholder_title: '¿Qué producto de aseo usaste?',   placeholder_desc: 'Indica cantidad utilizada y área limpiada...' },
        reporte:  { label: 'Reporte',  icon: 'ph-chat-text', color: '#f97316', bg: '#fff7ed', placeholder_title: 'Asunto del reporte',              placeholder_desc: 'Describe la situación con el mayor detalle posible...' },
        vendedor: { label: 'Vendedor', icon: 'ph-handshake', color: '#8b5cf6', bg: '#f5f3ff', placeholder_title: 'Nombre del vendedor',            placeholder_desc: 'Notas adicionales (dejó catálogo, muestras, etc.)...' },
    };

    // Acuse de recibo estilo WhatsApp: 1 check = enviado, 2 checks = lo vio admin.
    // El color comunica el estado igual que en WhatsApp (azul = ya lo vieron).
    const STATUS_CFG = {
        pendiente:   { label: 'Enviado',     bg: 'rgba(107,114,128,0.12)', color: '#6b7280', checks: 1 },
        visto:       { label: 'Recibido',    bg: 'rgba(37,99,235,0.12)',   color: '#1e40af', checks: 2 },
        respondido:  { label: 'Respondido',  bg: 'rgba(22,163,74,0.12)',   color: '#166534', checks: 2 },
        resuelto:    { label: 'Resuelto',    bg: 'rgba(107,114,128,0.12)', color: '#6b7280', checks: 2 },
    };

    const MAX_FOTOS = 3;
    const PAGE_SIZE = 20;

    // Estado local del formulario
    let _selectedType = null;
    let _pendingFiles = []; // { file, previewUrl }
    let _showingAll = false;

    // ── Helpers ──
    function timeAgo(isoStr) {
        if (!isoStr) return '';
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return 'hace un momento';
        if (mins < 60) return `hace ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 7)  return `hace ${days} días`;
        return new Date(isoStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    }

    // BUG 2 FIX: added `ph` prefix class so Phosphor Icons render correctly
    function typeBadgeHTML(type) {
        const cfg = TIPOS[type];
        if (!cfg) return '';
        return `<span style="display:inline-flex; align-items:center; gap:5px; background:${cfg.bg}; color:${cfg.color}; border-radius:20px; padding:3px 10px; font-size:0.78rem; font-weight:700;">
            <i class="ph ${cfg.icon}" style="font-size:0.9rem;"></i> ${cfg.label}
        </span>`;
    }

    function statusBadgeHTML(status) {
        const cfg = STATUS_CFG[status] || STATUS_CFG.pendiente;
        const icon = cfg.checks === 2 ? 'ph-checks' : 'ph-check';
        return `<span style="display:inline-flex; align-items:center; gap:4px; background:${cfg.bg}; color:${cfg.color}; border-radius:20px; padding:3px 10px; font-size:0.78rem; font-weight:700;">
            <i class="ph ${icon}" style="font-size:0.95rem;"></i> ${cfg.label}
        </span>`;
    }

    // ── Upload a Supabase Storage ──
    async function uploadFotos(files) {
        const supabase = window.SyncV2?.client;
        if (!supabase) throw new Error('Cliente Supabase no disponible');
        const tenantId = window.Auth.getTenantId();
        const paths = [];
        for (const file of files) {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `${tenantId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage.from('team-photos').upload(fileName, file, { upsert: false });
            if (error) throw error;
            paths.push(fileName);
        }
        return paths;
    }

    // ── Obtener URL firmada para un path ──
    async function getSignedUrl(path) {
        const supabase = window.SyncV2?.client;
        if (!supabase || !path) return null;
        try {
            const { data } = await supabase.storage.from('team-photos').createSignedUrl(path, 3600);
            return data?.signedUrl || null;
        } catch { return null; }
    }

    // ── Construir HTML de una tarjeta ──
    async function buildCardHTML(r) {
        const typeCfg  = TIPOS[r.type]  || TIPOS.reporte;
        const desc     = r.description ? (r.description.length > 60 ? r.description.slice(0, 60) + '…' : r.description) : '';
        const hasPhotos = r.photo_urls && r.photo_urls.length > 0;

        // Datos extra vendedor
        const vend = (r.type === 'vendedor' && r.items && r.items[0]) ? r.items[0] : null;
        const vendHTML = vend ? `<div style="display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:6px; font-size:0.82rem; color:var(--text-muted);">
            ${vend.empresa   ? `<span><i class="ph ph-buildings" style="margin-right:3px;"></i>${window.escapeHTML(vend.empresa)}</span>` : ''}
            ${vend.telefono  ? `<span><i class="ph ph-phone" style="margin-right:3px;"></i>${window.escapeHTML(vend.telefono)}</span>` : ''}
            ${vend.productos ? `<span><i class="ph ph-tag" style="margin-right:3px;"></i>${window.escapeHTML(vend.productos)}</span>` : ''}
        </div>` : '';

        const responseHTML = r.admin_response
            ? `<div style="margin-top:10px; background:var(--bg-main); border-left:3px solid ${typeCfg.color}; border-radius:0 8px 8px 0; padding:10px 12px;">
                    <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                        <i class="ph ph-arrow-bend-down-right"></i> Respuesta del administrador
                    </div>
                    <div style="font-size:0.88rem; color:var(--text-primary);">${window.escapeHTML(r.admin_response)}</div>
                    ${r.admin_responded_at ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${timeAgo(r.admin_responded_at)}</div>` : ''}
               </div>`
            : '';

        const photoSlotsHTML = hasPhotos
            ? `<div id="photos-${r.id}" style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;">
                ${r.photo_urls.map(() => `
                    <div style="width:60px; height:60px; border-radius:8px; background:var(--bg-main); border:1px solid var(--border); display:flex; align-items:center; justify-content:center;">
                        <i class="ph ph-image" style="color:var(--text-muted); font-size:1.2rem;"></i>
                    </div>
                `).join('')}
               </div>`
            : '';

        return `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; padding:14px 16px; border-left:4px solid ${typeCfg.color};">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:8px;">
                <div style="display:flex; flex-direction:column; gap:6px; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${typeBadgeHTML(r.type)}
                        ${statusBadgeHTML(r.status)}
                    </div>
                    <div style="font-weight:700; font-size:0.97rem; color:var(--text-primary); word-break:break-word;">${window.escapeHTML(r.title)}</div>
                    ${desc ? `<div style="font-size:0.85rem; color:var(--text-muted);">${window.escapeHTML(desc)}</div>` : ''}
                    ${vendHTML}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">${timeAgo(r.created_at)}</div>
            </div>
            ${photoSlotsHTML}
            ${responseHTML}
        </div>`;
    }

    // ── Cargar fotos asíncronas para una tarjeta ──
    async function loadCardPhotos(reportId, photoPaths) {
        const el = document.getElementById(`photos-${reportId}`);
        if (!el) return;

        const slots = el.querySelectorAll('div');
        const urls  = await Promise.all(photoPaths.map(p => getSignedUrl(p)));

        urls.forEach((url, i) => {
            if (!url || !slots[i]) return;
            slots[i].innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:block; width:100%; height:100%;">
                <img src="${url}" alt="Foto ${i + 1}"
                     style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
            </a>`;
            slots[i].style.background = 'transparent';
            slots[i].style.border = 'none';
        });
    }

    // ══════════════════════════════════
    // VISTA PRINCIPAL
    // ══════════════════════════════════
    window.Views.team_reports = async (container) => {
        _selectedType = null;
        _pendingFiles = [];
        _showingAll   = false;

        container.innerHTML = `
        <style>
            .tr-type-chip {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 9px 16px;
                border-radius: 30px;
                border: 2px solid var(--border);
                background: var(--bg-card);
                color: var(--text-primary);
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
            }
            .tr-type-chip:hover {
                filter: brightness(0.96);
            }
            #tr-form-fields {
                flex-direction: column;
                gap: 12px;
            }
        </style>

        <div style="max-width: 680px; margin: 0 auto; padding: 0 16px 40px;">

            <!-- Encabezado -->
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
                <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#6366f1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="ph ph-clipboard-text" style="color:#fff; font-size:1.3rem;"></i>
                </div>
                <div>
                    <h1 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text-primary);">Mis Reportes</h1>
                    <p style="margin:0; font-size:0.82rem; color:var(--text-muted);">Pedidos, mermas, limpieza, vendedores y avisos</p>
                </div>
            </div>

            <!-- ── SECCIÓN A: FORMULARIO ── -->
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:24px;">
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:14px;">
                    Nuevo reporte
                </div>

                <!-- Selector de tipo -->
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
                    ${Object.entries(TIPOS).map(([key, cfg]) => `
                        <button class="tr-type-chip" data-type="${key}">
                            <i class="ph ${cfg.icon}" style="font-size:1rem;"></i>
                            ${cfg.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Campos del formulario (ocultos hasta elegir tipo) -->
                <div id="tr-form-fields" style="display:none; margin-top:16px;">
                    <input
                        id="tr-title"
                        type="text"
                        maxlength="120"
                        class="form-input"
                        placeholder="Título"
                        style="width:100%; box-sizing:border-box;">

                    <!-- Campos extra vendedor (solo visibles si tipo=vendedor) -->
                    <div id="tr-vendedor-fields" style="display:none; flex-direction:column; gap:10px; padding:14px; background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.2); border-radius:12px;">
                        <div style="font-size:0.75rem; font-weight:700; color:#8b5cf6; text-transform:uppercase; letter-spacing:0.04em;">
                            <i class="ph ph-handshake"></i> Datos del vendedor
                        </div>
                        <input id="tr-vend-empresa" type="text" maxlength="100" class="form-input"
                               placeholder="Empresa o marca que representa"
                               style="width:100%; box-sizing:border-box;">
                        <input id="tr-vend-telefono" type="tel" maxlength="20" class="form-input"
                               placeholder="Teléfono de contacto"
                               style="width:100%; box-sizing:border-box;">
                        <input id="tr-vend-productos" type="text" maxlength="200" class="form-input"
                               placeholder="¿Qué productos ofrece?"
                               style="width:100%; box-sizing:border-box;">
                    </div>

                    <textarea
                        id="tr-desc"
                        rows="3"
                        class="form-input"
                        placeholder="Detalle..."
                        style="width:100%; box-sizing:border-box; resize:vertical; min-height:70px;"></textarea>

                    <!-- Fotos -->
                    <div>
                        <button id="tr-btn-foto" style="display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border:2px dashed var(--border); border-radius:12px; background:var(--bg-main); color:var(--text-muted); font-size:0.88rem; cursor:pointer; transition:border-color 0.15s;">
                            <i class="ph ph-camera" style="font-size:1rem;"></i> Adjuntar Foto
                        </button>
                        <input id="tr-file-input" type="file" accept="image/*" capture="environment" style="display:none;" multiple>
                        <div id="tr-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;"></div>
                    </div>

                    <!-- Botón enviar -->
                    <button id="tr-submit-btn" class="btn btn-primary" style="width:100%; padding:12px; font-size:0.95rem; border-radius:12px;">
                        <i class="ph ph-paper-plane-tilt"></i> Enviar Reporte
                    </button>
                </div>
            </div>

            <!-- ── SECCIÓN B: LISTA DE REPORTES ── -->
            <div>
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:14px;">
                    Mis reportes enviados
                </div>
                <div id="tr-list" style="display:flex; flex-direction:column; gap:10px;">
                    <div style="text-align:center; padding:20px; color:var(--text-muted);">
                        <i class="ph ph-spinner ph-spin" style="font-size:1.5rem;"></i>
                    </div>
                </div>
            </div>
        </div>
        `;

        // ── BUG 1 FIX: helpers defined inside view scope to access `container` ──

        // ── Renderizar previews de fotos (formulario) ──
        function renderPreviews() {
            const previewEl = container.querySelector('#tr-photo-previews');
            if (!previewEl) return;
            if (_pendingFiles.length === 0) {
                previewEl.innerHTML = '';
                return;
            }
            previewEl.innerHTML = _pendingFiles.map((item, idx) => `
                <div style="position:relative; display:inline-block;">
                    <img src="${item.previewUrl}" alt="foto ${idx + 1}"
                         style="width:72px; height:72px; object-fit:cover; border-radius:10px; border:2px solid var(--border);">
                    <button data-remove-idx="${idx}"
                        style="position:absolute; top:-6px; right:-6px; background:#ef4444; color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:0.7rem; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;"
                        title="Quitar foto">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
            `).join('');

            previewEl.querySelectorAll('[data-remove-idx]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.removeIdx, 10);
                    URL.revokeObjectURL(_pendingFiles[idx]?.previewUrl);
                    _pendingFiles.splice(idx, 1);
                    renderPreviews();
                    updatePhotoBtn();
                });
            });
        }

        function updatePhotoBtn() {
            const btn = container.querySelector('#tr-btn-foto');
            if (!btn) return;
            const remaining = MAX_FOTOS - _pendingFiles.length;
            if (remaining <= 0) {
                btn.disabled = true;
                btn.innerHTML = `<i class="ph ph-image" style="font-size:1rem;"></i> Máx. ${MAX_FOTOS} fotos`;
            } else {
                btn.disabled = false;
                btn.innerHTML = `<i class="ph ph-camera" style="font-size:1rem;"></i> Adjuntar Foto${_pendingFiles.length > 0 ? ` (${_pendingFiles.length}/${MAX_FOTOS})` : ''}`;
            }
        }

        // ── Seleccionar tipo en formulario ──
        function selectType(type) {
            _selectedType = type;

            // Actualizar chips
            container.querySelectorAll('.tr-type-chip').forEach(chip => {
                const isActive = chip.dataset.type === type;
                const cfg = TIPOS[chip.dataset.type];
                chip.style.background = isActive ? cfg.color : 'var(--bg-card)';
                chip.style.color      = isActive ? '#fff'    : 'var(--text-primary)';
                chip.style.borderColor = isActive ? cfg.color : 'var(--border)';
                chip.style.fontWeight  = isActive ? '700' : '500';
                chip.style.boxShadow   = isActive ? `0 2px 8px ${cfg.color}40` : 'none';
            });

            // Mostrar/ocultar campo form y actualizar placeholders
            const formFields = container.querySelector('#tr-form-fields');
            if (formFields) {
                formFields.style.display = 'flex';
                const cfg = TIPOS[type];
                const titleInput = container.querySelector('#tr-title');
                const descInput  = container.querySelector('#tr-desc');
                if (titleInput) titleInput.placeholder = cfg.placeholder_title;
                if (descInput)  descInput.placeholder  = cfg.placeholder_desc;
            }

            // Campos extra vendedor
            const vendFields = container.querySelector('#tr-vendedor-fields');
            if (vendFields) vendFields.style.display = type === 'vendedor' ? 'flex' : 'none';
        }

        // ── Limpiar formulario ──
        function resetForm() {
            _selectedType = null;
            _pendingFiles = [];
            const titleInput = container.querySelector('#tr-title');
            const descInput  = container.querySelector('#tr-desc');
            if (titleInput) titleInput.value = '';
            if (descInput)  descInput.value  = '';

            // Limpiar campos vendedor
            ['tr-vend-empresa', 'tr-vend-telefono', 'tr-vend-productos'].forEach(id => {
                const el = container.querySelector('#' + id);
                if (el) el.value = '';
            });
            const vendFields = container.querySelector('#tr-vendedor-fields');
            if (vendFields) vendFields.style.display = 'none';

            container.querySelectorAll('.tr-type-chip').forEach(chip => {
                const cfg = TIPOS[chip.dataset.type];
                chip.style.background  = 'var(--bg-card)';
                chip.style.color       = 'var(--text-primary)';
                chip.style.borderColor = 'var(--border)';
                chip.style.fontWeight  = '500';
                chip.style.boxShadow   = 'none';
            });

            const formFields = container.querySelector('#tr-form-fields');
            if (formFields) formFields.style.display = 'none';

            renderPreviews();
            updatePhotoBtn();
        }

        // ── Enviar reporte ──
        async function submitReport() {
            if (!_selectedType) {
                window.showToast('Selecciona un tipo de reporte');
                return;
            }
            const titleEl = container.querySelector('#tr-title');
            const descEl  = container.querySelector('#tr-desc');
            const title   = titleEl?.value.trim() || '';
            if (!title) {
                window.showToast('Ingresa un título');
                titleEl?.focus();
                return;
            }

            const submitBtn = container.querySelector('#tr-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Enviando...';
            }

            try {
                // Subir fotos (si falla, guardar reporte sin fotos)
                let photoPaths = [];
                let photosFailed = false;
                if (_pendingFiles.length > 0) {
                    try {
                        photoPaths = await uploadFotos(_pendingFiles.map(f => f.file));
                    } catch (uploadErr) {
                        console.warn('Upload de fotos falló, guardando reporte sin fotos:', uploadErr);
                        photosFailed = true;
                    }
                }

                const tenantId = window.Auth.getTenantId();
                const userId   = window.Auth.session?.user?.id;

                const userEmail = window.Auth.session?.user?.email || '';

                // Datos extra para tipo vendedor
                let items = [];
                if (_selectedType === 'vendedor') {
                    const empresa   = container.querySelector('#tr-vend-empresa')?.value.trim() || '';
                    const telefono  = container.querySelector('#tr-vend-telefono')?.value.trim() || '';
                    const productos = container.querySelector('#tr-vend-productos')?.value.trim() || '';
                    items = [{ empresa, telefono, productos }];
                }

                const reportData = {
                    id:         crypto.randomUUID(),
                    tenant_id:  tenantId,
                    user_id:    userId,
                    user_email: userEmail,
                    type:       _selectedType,
                    title:      title,
                    description: descEl?.value.trim() || '',
                    photo_urls: photoPaths,
                    items:      items,
                    status:     'pendiente',
                    admin_response:       null,
                    admin_responded_at:   null,
                    admin_responded_by:   null,
                    created_at: new Date().toISOString(),
                    deleted:    false,
                    version:    1,
                };

                await window.DataManager.saveAndSync('team_reports', reportData);

                // Notificar al admin por push
                const tipoLabel = TIPOS[_selectedType]?.label || _selectedType;
                if (window.triggerPush) {
                    window.triggerPush('report', {
                        title: `Nuevo reporte: ${tipoLabel}`,
                        body: `${userEmail.split('@')[0]} — ${title}`,
                    }).catch(() => {});
                }

                window.showToast(photosFailed ? 'Reporte enviado (sin fotos — sin conexión)' : 'Reporte enviado correctamente');
                resetForm();
                await renderList();

            } catch (err) {
                console.error('Error enviando reporte:', err);
                window.showToast('Error al enviar el reporte. Intenta de nuevo.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Enviar Reporte';
                }
            }
        }

        // ── Render lista de reportes ──
        async function renderList() {
            const listEl = container.querySelector('#tr-list');
            if (!listEl) return;

            listEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">
                <i class="ph ph-spinner ph-spin" style="font-size:1.5rem;"></i>
            </div>`;

            try {
                const userId = window.Auth.session?.user?.id;
                const all    = await window.db.team_reports.toArray();
                const mine   = all
                    .filter(r => !r.deleted && r.user_id === userId)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                if (mine.length === 0) {
                    listEl.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                        <i class="ph ph-clipboard-text" style="font-size:2.5rem; display:block; margin-bottom:8px; opacity:0.4;"></i>
                        <p style="margin:0;">Aún no has enviado ningún reporte</p>
                    </div>`;
                    return;
                }

                const toShow = _showingAll ? mine : mine.slice(0, PAGE_SIZE);
                const cards  = await Promise.all(toShow.map(r => buildCardHTML(r)));

                let html = cards.join('');

                if (mine.length > PAGE_SIZE) {
                    if (!_showingAll) {
                        html += `<div style="text-align:center; margin-top:8px;">
                            <button id="tr-ver-mas" style="background:none; border:1px solid var(--border); border-radius:10px; padding:8px 22px; cursor:pointer; color:var(--text-muted); font-size:0.9rem;">
                                Ver más (${mine.length - PAGE_SIZE} restantes)
                            </button>
                        </div>`;
                    } else {
                        html += `<div style="text-align:center; margin-top:8px;">
                            <button id="tr-ver-menos" style="background:none; border:1px solid var(--border); border-radius:10px; padding:8px 22px; cursor:pointer; color:var(--text-muted); font-size:0.9rem;">
                                Ver menos
                            </button>
                        </div>`;
                    }
                }

                listEl.innerHTML = html;

                const verMasBtn   = listEl.querySelector('#tr-ver-mas');
                const verMenosBtn = listEl.querySelector('#tr-ver-menos');
                if (verMasBtn)   verMasBtn.addEventListener('click',   () => { _showingAll = true;  renderList(); });
                if (verMenosBtn) verMenosBtn.addEventListener('click', () => { _showingAll = false; renderList(); });

                // Cargar fotos de forma asíncrona (no bloquea render)
                toShow.forEach(r => {
                    if (r.photo_urls && r.photo_urls.length > 0) {
                        loadCardPhotos(r.id, r.photo_urls);
                    }
                });

            } catch (err) {
                console.error('Error cargando reportes:', err);
                listEl.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Error al cargar reportes.</p>`;
            }
        }

        // ── Event listeners ──

        // Chips de tipo
        container.querySelectorAll('.tr-type-chip').forEach(chip => {
            chip.addEventListener('click', () => selectType(chip.dataset.type));
        });

        // Botón adjuntar foto
        const btnFoto   = container.querySelector('#tr-btn-foto');
        const fileInput = container.querySelector('#tr-file-input');

        btnFoto.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files || []);
            const remaining = MAX_FOTOS - _pendingFiles.length;
            const toAdd = files.slice(0, remaining);
            toAdd.forEach(file => {
                _pendingFiles.push({ file, previewUrl: URL.createObjectURL(file) });
            });
            if (files.length > remaining) {
                window.showToast(`Solo puedes adjuntar hasta ${MAX_FOTOS} fotos`);
            }
            fileInput.value = '';
            renderPreviews();
            updatePhotoBtn();
        });

        // Botón enviar
        container.querySelector('#tr-submit-btn').addEventListener('click', submitReport);

        // Cargar lista inicial
        await renderList();

        // ── BUG 3 FIX: use _viewCleanup instead of custom _trSyncHandler ──
        const handler = () => {
            if (container.querySelector('#tr-list')) {
                renderList();
            }
        };
        window.addEventListener('sync-data-updated', handler);
        window._viewCleanup = () => {
            window.removeEventListener('sync-data-updated', handler);
        };
    };
})();
