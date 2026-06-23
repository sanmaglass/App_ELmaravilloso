// team_admin.js — Panel de Administración del Módulo Equipo
// Solo accesible para owner/admin. Tabs: Reportes, Avisos, Lecturas.
window.Views = window.Views || {};

(function () {
    // ── Helpers compartidos ──────────────────────────────────────────────────
    function tiempoRelativo(isoStr) {
        if (!isoStr) return '—';
        const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
        if (diff < 60)    return 'hace un momento';
        if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
        const dias = Math.floor(diff / 86400);
        return dias === 1 ? 'ayer' : `hace ${dias} días`;
    }

    function fechaCorta(isoStr) {
        if (!isoStr) return '—';
        try {
            return new Date(isoStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return isoStr; }
    }

    const TYPE_LABELS = {
        pedido:    { label: 'Pedido',    color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
        merma:     { label: 'Merma',     color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
        limpieza:  { label: 'Limpieza',  color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
        reporte:   { label: 'Reporte',   color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
    };

    const STATUS_CONFIG = {
        pendiente:  { label: 'Pendiente',  color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
        visto:      { label: 'Visto',      color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
        respondido: { label: 'Respondido', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
        resuelto:   { label: 'Resuelto',   color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    };

    function badge(cfg) {
        if (!cfg) return '';
        return `<span style="font-size:0.72rem; font-weight:700; padding:3px 10px; border-radius:8px;
                             background:${cfg.bg}; color:${cfg.color}; white-space:nowrap;">${cfg.label}</span>`;
    }

    function tabBtnStyle(active) {
        return `padding:8px 18px; border:none; border-radius:10px; font-weight:600; font-size:0.85rem;
                cursor:pointer; transition:all 0.18s;
                background:${active ? 'var(--primary)' : 'transparent'};
                color:${active ? '#fff' : 'var(--text-muted)'};`;
    }

    // ── URL firmada para foto (bucket team-photos) ───────────────────────────
    async function signedUrl(path) {
        try {
            const client = window.SyncV2?.client;
            if (!client || !path) return null;
            const { data } = await client.storage.from('team-photos').createSignedUrl(path, 3600);
            return data?.signedUrl || null;
        } catch { return null; }
    }

    // ── Vista principal ──────────────────────────────────────────────────────
    window.Views.team_admin = async (container, _tab = 'reportes') => {
        const role = window.Auth?.getRole?.() || 'employee';

        // Guard: solo admin/owner
        if (role === 'employee') {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
                            min-height:300px; gap:16px; color:var(--text-muted); text-align:center; padding:40px;">
                    <i class="ph ph-lock" style="font-size:3rem; opacity:0.4;"></i>
                    <div>
                        <p style="font-weight:700; font-size:1rem; color:var(--text-primary); margin:0 0 6px;">Sin acceso</p>
                        <p style="font-size:0.88rem; margin:0;">Esta sección es solo para administradores.</p>
                    </div>
                </div>
            `;
            return;
        }

        const tabs = [
            { id: 'reportes', label: 'Reportes',  icon: 'ph-note-pencil' },
            { id: 'avisos',   label: 'Avisos',    icon: 'ph-megaphone' },
            { id: 'lecturas', label: 'Lecturas',  icon: 'ph-eye' },
        ];

        container.innerHTML = `
            <div style="max-width:760px; margin:0 auto; padding:0 0 40px;">

                <!-- Encabezado -->
                <div style="margin-bottom:20px;">
                    <div style="font-size:0.78rem; color:var(--primary); font-weight:700; letter-spacing:1.5px;
                                text-transform:uppercase; margin-bottom:4px;">El Maravilloso</div>
                    <h1 style="margin:0; font-size:1.5rem; color:var(--text-primary);">Panel del Equipo</h1>
                </div>

                <!-- Tab bar -->
                <div style="display:flex; gap:0; background:var(--bg-card); border:1px solid var(--border);
                            border-radius:14px; padding:4px; margin-bottom:24px; width:fit-content;">
                    ${tabs.map(t => `
                        <button class="ta-tab-btn" data-tab="${t.id}"
                                style="${tabBtnStyle(t.id === _tab)}">
                            <i class="${t.icon}" style="margin-right:5px;"></i>${t.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Contenido del tab -->
                <div id="ta-tab-content"></div>
            </div>
        `;

        // Wire tab buttons
        container.querySelectorAll('.ta-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.Views.team_admin(container, btn.dataset.tab);
            });
        });

        const content = container.querySelector('#ta-tab-content');
        const tenantId = window.Auth?.getTenantId?.();
        const userId   = window.Auth?.session?.user?.id;
        const userEmail = window.Auth?.session?.user?.email || '';

        if (_tab === 'reportes')   await renderReportes(content, tenantId, userId);
        else if (_tab === 'avisos') await renderAvisos(content, tenantId, userId, userEmail);
        else if (_tab === 'lecturas') await renderLecturas(content, tenantId);
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 1 — REPORTES
    // ═══════════════════════════════════════════════════════════════════════
    async function renderReportes(content, tenantId, adminUserId) {
        content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Cargando reportes…</div>`;

        let allReports = [];
        try {
            const all = await window.db.team_reports.toArray();
            allReports = all.filter(r => !r.deleted && (!tenantId || r.tenant_id === tenantId || !r.tenant_id))
                            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        } catch (err) {
            content.innerHTML = `<p style="color:var(--danger);">Error al cargar reportes: ${window.escapeHTML(err.message)}</p>`;
            return;
        }

        // Estado local de filtros
        let filterType   = 'todos';
        let filterStatus = 'todos';

        const TYPE_OPTS   = ['todos', 'pedido', 'merma', 'limpieza', 'reporte'];
        const STATUS_OPTS = ['todos', 'pendiente', 'visto', 'respondido', 'resuelto'];

        function chipStyle(active, color) {
            return `padding:6px 14px; border-radius:20px; border:1.5px solid ${active ? (color || 'var(--primary)') : 'var(--border)'};
                    background:${active ? (color ? color + '1a' : 'rgba(var(--primary-rgb),0.1)') : 'transparent'};
                    color:${active ? (color || 'var(--primary)') : 'var(--text-muted)'};
                    font-size:0.8rem; font-weight:${active ? '700' : '500'}; cursor:pointer; white-space:nowrap;
                    transition:all 0.15s;`;
        }

        function filteredReports() {
            return allReports.filter(r =>
                (filterType   === 'todos' || r.type === filterType) &&
                (filterStatus === 'todos' || r.status === filterStatus)
            );
        }

        function rerender() {
            const list = content.querySelector('#ta-report-list');
            if (!list) return;
            const reports = filteredReports();
            if (reports.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center; padding:40px; color:var(--text-muted);">
                        <i class="ph ph-note-blank" style="font-size:2.5rem; opacity:0.4; display:block; margin-bottom:10px;"></i>
                        <p style="font-size:0.9rem;">Sin reportes con estos filtros.</p>
                    </div>
                `;
                return;
            }
            list.innerHTML = reports.map(r => buildReportCard(r)).join('');
            wireReportCards(list, allReports, content, tenantId, adminUserId, rerender);
        }

        content.innerHTML = `
            <!-- Filtros tipo -->
            <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; margin-bottom:10px; scrollbar-width:none;">
                ${TYPE_OPTS.map(t => `
                    <button class="ta-filter-type" data-val="${t}"
                            style="${chipStyle(t === filterType)}">
                        ${t === 'todos' ? 'Todos' : TYPE_LABELS[t]?.label || t}
                    </button>
                `).join('')}
            </div>
            <!-- Filtros estado -->
            <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; margin-bottom:20px; scrollbar-width:none;">
                ${STATUS_OPTS.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return `<button class="ta-filter-status" data-val="${s}"
                                    style="${chipStyle(s === filterStatus, cfg?.color)}">
                        ${s === 'todos' ? 'Todos' : cfg?.label || s}
                    </button>`;
                }).join('')}
            </div>
            <!-- Lista -->
            <div id="ta-report-list"></div>
        `;

        // Wire filter chips
        content.querySelectorAll('.ta-filter-type').forEach(btn => {
            btn.addEventListener('click', () => {
                filterType = btn.dataset.val;
                content.querySelectorAll('.ta-filter-type').forEach(b => {
                    b.style.cssText = chipStyle(b.dataset.val === filterType);
                });
                rerender();
            });
        });
        content.querySelectorAll('.ta-filter-status').forEach(btn => {
            btn.addEventListener('click', () => {
                filterStatus = btn.dataset.val;
                content.querySelectorAll('.ta-filter-status').forEach(b => {
                    const cfg = STATUS_CONFIG[b.dataset.val];
                    b.style.cssText = chipStyle(b.dataset.val === filterStatus, cfg?.color);
                });
                rerender();
            });
        });

        rerender();
    }

    function buildReportCard(r) {
        const typeCfg   = TYPE_LABELS[r.type]   || { label: r.type || 'Reporte', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
        const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendiente;

        const hasPhotos = Array.isArray(r.photo_urls) && r.photo_urls.length > 0;
        const hasResponse = r.admin_response && r.status === 'respondido';

        return `
            <div class="ta-report-card" data-id="${r.id}"
                 style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px;
                        padding:16px; margin-bottom:12px;">

                <!-- Cabecera -->
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${badge(typeCfg)}
                        ${badge(statusCfg)}
                    </div>
                    <span style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap;">
                        ${tiempoRelativo(r.created_at)}
                    </span>
                </div>

                <!-- Email remitente -->
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">
                    <i class="ph ph-user" style="margin-right:4px;"></i>
                    ${window.escapeHTML(r.user_email || r.user_id || 'Equipo')}
                </div>

                <!-- Título y descripción -->
                <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:4px;">
                    ${window.escapeHTML(r.title || typeCfg.label)}
                </div>
                ${r.description ? `
                <div style="font-size:0.88rem; color:var(--text-muted); margin-bottom:10px; line-height:1.5;">
                    ${window.escapeHTML(r.description)}
                </div>` : ''}

                <!-- Fotos -->
                ${hasPhotos ? `
                <div class="ta-photos" data-id="${r.id}" data-urls='${JSON.stringify(r.photo_urls)}'
                     style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                    ${r.photo_urls.map(() => `
                        <div style="width:64px; height:64px; border-radius:10px; background:var(--bg-main);
                                    border:1px solid var(--border); display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-image" style="font-size:1.4rem; color:var(--text-muted);"></i>
                        </div>
                    `).join('')}
                </div>` : ''}

                <!-- Respuesta previa -->
                ${hasResponse ? `
                <div style="background:rgba(124,58,237,0.07); border-left:3px solid #7c3aed; border-radius:8px;
                            padding:10px 12px; margin-bottom:10px; font-size:0.85rem; color:var(--text-primary);">
                    <div style="font-weight:700; font-size:0.75rem; color:#7c3aed; margin-bottom:4px; text-transform:uppercase;">
                        Respuesta — ${fechaCorta(r.admin_responded_at)}
                    </div>
                    ${window.escapeHTML(r.admin_response)}
                </div>` : ''}

                <!-- Zona de respuesta inline (oculta) -->
                <div class="ta-reply-zone" data-id="${r.id}" style="display:none; margin-bottom:10px;">
                    <textarea class="ta-reply-text" placeholder="Escribe tu respuesta…"
                              style="width:100%; box-sizing:border-box; min-height:80px; padding:10px;
                                     background:var(--bg-main); border:1px solid var(--border); border-radius:10px;
                                     font-size:0.88rem; color:var(--text-primary); resize:vertical; margin-bottom:8px;"></textarea>
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="ta-reply-cancel" data-id="${r.id}"
                                style="padding:7px 16px; border:1px solid var(--border); border-radius:8px;
                                       background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.85rem;">
                            Cancelar
                        </button>
                        <button class="ta-reply-submit" data-id="${r.id}"
                                style="padding:7px 16px; background:var(--primary); color:#fff; border:none;
                                       border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:700;">
                            Enviar respuesta
                        </button>
                    </div>
                </div>

                <!-- Botones de acción -->
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${r.status === 'pendiente' ? `
                    <button class="ta-action-btn ta-marcar-visto" data-id="${r.id}"
                            style="padding:7px 14px; border:1px solid #2563eb; border-radius:8px; background:transparent;
                                   color:#2563eb; cursor:pointer; font-size:0.82rem; font-weight:600; transition:all 0.15s;">
                        <i class="ph ph-eye"></i> Marcar visto
                    </button>` : ''}
                    ${r.status !== 'respondido' && r.status !== 'resuelto' ? `
                    <button class="ta-action-btn ta-responder" data-id="${r.id}"
                            style="padding:7px 14px; border:1px solid #7c3aed; border-radius:8px; background:transparent;
                                   color:#7c3aed; cursor:pointer; font-size:0.82rem; font-weight:600; transition:all 0.15s;">
                        <i class="ph ph-chat-text"></i> Responder
                    </button>` : ''}
                    ${r.status !== 'resuelto' ? `
                    <button class="ta-action-btn ta-resolver" data-id="${r.id}"
                            style="padding:7px 14px; border:1px solid #16a34a; border-radius:8px; background:transparent;
                                   color:#16a34a; cursor:pointer; font-size:0.82rem; font-weight:600; transition:all 0.15s;">
                        <i class="ph ph-check-circle"></i> Resolver
                    </button>` : ''}
                </div>
            </div>
        `;
    }

    async function wireReportCards(list, allReports, content, tenantId, adminUserId, rerender) {
        // Cargar fotos firmadas asíncronamente
        list.querySelectorAll('.ta-photos').forEach(async (photosEl) => {
            const paths = JSON.parse(photosEl.dataset.urls || '[]');
            const thumbs = await Promise.all(paths.map(p => signedUrl(p)));
            photosEl.innerHTML = thumbs.map((url, i) => {
                if (url) {
                    return `<img src="${url}" alt="Foto ${i + 1}"
                                 data-open-url="${url.replace(/"/g, '&quot;')}"
                                 style="width:64px; height:64px; border-radius:10px; object-fit:cover;
                                        border:1px solid var(--border); cursor:pointer;">`;
                }
                return `<div style="width:64px; height:64px; border-radius:10px; background:var(--bg-main);
                                    border:1px solid var(--border); display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-image-broken" style="font-size:1.4rem; color:var(--text-muted);"></i>
                        </div>`;
            }).join('');
            photosEl.querySelectorAll('[data-open-url]').forEach(img => {
                img.addEventListener('click', () => window.open(img.dataset.openUrl, '_blank'));
            });
        });

        async function updateReport(id, changes) {
            const idx = allReports.findIndex(r => r.id === id);
            if (idx === -1) return;
            const updated = { ...allReports[idx], ...changes, updated_at_hlc: window.HLC?.now?.() || Date.now() };
            allReports[idx] = updated;
            try {
                await window.DataManager.saveAndSync('team_reports', updated);
                rerender();
            } catch (err) {
                window.showToast('Error al actualizar: ' + err.message, 'error');
            }
        }

        // Marcar visto
        list.querySelectorAll('.ta-marcar-visto').forEach(btn => {
            btn.addEventListener('click', async () => {
                await updateReport(btn.dataset.id, { status: 'visto' });
                window.showToast('Reporte marcado como visto.', 'success');
            });
        });

        // Responder — expande zona inline
        list.querySelectorAll('.ta-responder').forEach(btn => {
            btn.addEventListener('click', () => {
                const zone = list.querySelector(`.ta-reply-zone[data-id="${btn.dataset.id}"]`);
                if (zone) zone.style.display = zone.style.display === 'none' ? 'block' : 'none';
            });
        });

        // Cancelar respuesta
        list.querySelectorAll('.ta-reply-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                const zone = list.querySelector(`.ta-reply-zone[data-id="${btn.dataset.id}"]`);
                if (zone) zone.style.display = 'none';
            });
        });

        // Enviar respuesta
        list.querySelectorAll('.ta-reply-submit').forEach(btn => {
            btn.addEventListener('click', async () => {
                const zone  = list.querySelector(`.ta-reply-zone[data-id="${btn.dataset.id}"]`);
                const text  = zone?.querySelector('.ta-reply-text')?.value?.trim();
                if (!text) { window.showToast('Escribe una respuesta antes de enviar.', 'error'); return; }
                btn.disabled = true;
                await updateReport(btn.dataset.id, {
                    status: 'respondido',
                    admin_response: text,
                    admin_responded_at: new Date().toISOString(),
                    admin_responded_by: adminUserId,
                });
                window.showToast('Respuesta enviada.', 'success');
            });
        });

        // Resolver
        list.querySelectorAll('.ta-resolver').forEach(btn => {
            btn.addEventListener('click', async () => {
                await updateReport(btn.dataset.id, { status: 'resuelto' });
                window.showToast('Reporte marcado como resuelto.', 'success');
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 2 — AVISOS
    // ═══════════════════════════════════════════════════════════════════════
    async function renderAvisos(content, tenantId, userId, userEmail) {
        content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Cargando avisos…</div>`;

        let announcements = [];
        try {
            const all = await window.db.announcements.toArray();
            announcements = all
                .filter(a => !tenantId || a.tenant_id === tenantId || !a.tenant_id)
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        } catch (err) {
            content.innerHTML = `<p style="color:var(--danger);">Error al cargar avisos.</p>`;
            return;
        }

        function buildForm(a = null) {
            return `
                <div class="ta-aviso-form" style="background:var(--bg-card); border:1.5px solid var(--primary);
                            border-radius:16px; padding:18px; margin-bottom:16px;">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--primary); margin-bottom:14px; text-transform:uppercase; letter-spacing:0.5px;">
                        ${a ? 'Editar aviso' : 'Nuevo aviso'}
                    </div>
                    <input type="text" class="ta-aviso-titulo" placeholder="Título del aviso"
                           value="${a ? window.escapeHTML(a.title || '') : ''}"
                           style="width:100%; box-sizing:border-box; padding:11px 14px; border:1px solid var(--border);
                                  border-radius:10px; background:var(--bg-main); color:var(--text-primary);
                                  font-size:0.92rem; margin-bottom:10px; outline:none;">
                    <textarea class="ta-aviso-body" placeholder="Cuerpo del aviso…" rows="3"
                              style="width:100%; box-sizing:border-box; padding:11px 14px; border:1px solid var(--border);
                                     border-radius:10px; background:var(--bg-main); color:var(--text-primary);
                                     font-size:0.88rem; resize:vertical; margin-bottom:10px; outline:none;">${a ? window.escapeHTML(a.body || '') : ''}</textarea>

                    <!-- Toggle prioridad -->
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                        <span style="font-size:0.85rem; color:var(--text-muted);">Prioridad:</span>
                        <button class="ta-prio-btn" data-prio="normal"
                                style="padding:5px 14px; border-radius:8px; border:1.5px solid ${(!a || a.priority === 'normal') ? '#6b7280' : 'var(--border)'};
                                       background:${(!a || a.priority === 'normal') ? 'rgba(107,114,128,0.1)' : 'transparent'};
                                       color:${(!a || a.priority === 'normal') ? '#6b7280' : 'var(--text-muted)'};
                                       font-size:0.82rem; font-weight:600; cursor:pointer; transition:all 0.15s;">
                            Normal
                        </button>
                        <button class="ta-prio-btn" data-prio="urgente"
                                style="padding:5px 14px; border-radius:8px; border:1.5px solid ${a?.priority === 'urgente' ? '#dc2626' : 'var(--border)'};
                                       background:${a?.priority === 'urgente' ? 'rgba(220,38,38,0.1)' : 'transparent'};
                                       color:${a?.priority === 'urgente' ? '#dc2626' : 'var(--text-muted)'};
                                       font-size:0.82rem; font-weight:600; cursor:pointer; transition:all 0.15s;">
                            🔴 Urgente
                        </button>
                    </div>

                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="ta-aviso-cancel"
                                style="padding:8px 18px; border:1px solid var(--border); border-radius:8px;
                                       background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.88rem;">
                            Cancelar
                        </button>
                        <button class="ta-aviso-save" data-id="${a ? a.id : ''}"
                                style="padding:8px 18px; background:var(--primary); color:#fff; border:none;
                                       border-radius:8px; cursor:pointer; font-size:0.88rem; font-weight:700;">
                            ${a ? 'Guardar cambios' : 'Publicar aviso'}
                        </button>
                    </div>
                </div>
            `;
        }

        function buildAvisoCard(a) {
            const esUrgente = a.priority === 'urgente';
            const esActivo  = !!a.active;
            const borrado   = !!a.deleted;
            return `
                <div class="ta-aviso-card" data-id="${a.id}"
                     style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
                            padding:14px 16px; margin-bottom:10px; opacity:${borrado ? '0.45' : '1'};
                            ${borrado ? 'text-decoration:line-through;' : ''}">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            ${esUrgente ? `<span style="font-size:0.72rem; font-weight:700; padding:2px 9px; border-radius:8px;
                                                         background:rgba(220,38,38,0.1); color:#dc2626;">🔴 URGENTE</span>` : ''}
                            <span style="font-size:0.72rem; font-weight:700; padding:2px 9px; border-radius:8px;
                                         background:${esActivo ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)'};
                                         color:${esActivo ? '#16a34a' : '#6b7280'};">
                                ${esActivo ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                            ${!borrado ? `
                            <!-- Toggle activo -->
                            <button class="ta-toggle-activo" data-id="${a.id}" data-active="${a.active ? '1' : '0'}"
                                    title="${esActivo ? 'Desactivar' : 'Activar'}"
                                    style="padding:5px 10px; border-radius:8px; border:1px solid ${esActivo ? '#16a34a' : 'var(--border)'};
                                           background:${esActivo ? 'rgba(22,163,74,0.1)' : 'transparent'};
                                           color:${esActivo ? '#16a34a' : 'var(--text-muted)'};
                                           font-size:0.78rem; cursor:pointer; transition:all 0.15s;">
                                <i class="ph ${esActivo ? 'ph-toggle-right' : 'ph-toggle-left'}"></i>
                                ${esActivo ? 'Activo' : 'Activar'}
                            </button>
                            <button class="ta-edit-aviso" data-id="${a.id}"
                                    style="width:32px; height:32px; border-radius:8px; border:1px solid var(--border);
                                           background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i class="ph ph-pencil-simple" style="font-size:0.9rem; color:var(--text-muted);"></i>
                            </button>
                            <button class="ta-delete-aviso" data-id="${a.id}"
                                    style="width:32px; height:32px; border-radius:8px; border:1px solid var(--border);
                                           background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i class="ph ph-trash" style="font-size:0.9rem; color:var(--danger);"></i>
                            </button>` : `<span style="font-size:0.78rem; color:var(--text-muted);">Eliminado</span>`}
                        </div>
                    </div>
                    <!-- Título (clicable para editar) -->
                    <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:4px;
                                ${!borrado ? 'cursor:pointer;' : ''}" class="${!borrado ? 'ta-edit-aviso' : ''}" data-id="${a.id}">
                        ${window.escapeHTML(a.title || 'Sin título')}
                    </div>
                    <!-- Cuerpo (preview) -->
                    <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.5;
                                display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                        ${window.escapeHTML(a.body || '')}
                    </div>
                    <!-- Zona de edición inline (oculta) -->
                    <div class="ta-edit-zone" data-id="${a.id}" style="display:none; margin-top:14px;"></div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${tiempoRelativo(a.created_at)}</div>
                </div>
            `;
        }

        function renderAll() {
            const list = content.querySelector('#ta-avisos-list');
            if (!list) return;
            if (announcements.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center; padding:40px; color:var(--text-muted);">
                        <i class="ph ph-megaphone" style="font-size:2.5rem; opacity:0.4; display:block; margin-bottom:10px;"></i>
                        <p style="font-size:0.9rem;">Sin avisos aún. Crea el primero.</p>
                    </div>
                `;
                return;
            }
            list.innerHTML = announcements.map(a => buildAvisoCard(a)).join('');
            wireAvisoCards(list, announcements, tenantId, userId, userEmail, renderAll, content);
        }

        content.innerHTML = `
            <!-- Botón nuevo aviso -->
            <div style="margin-bottom:16px;">
                <button id="ta-btn-nuevo-aviso"
                        style="padding:10px 20px; background:var(--primary); color:#fff; border:none;
                               border-radius:12px; font-size:0.9rem; font-weight:700; cursor:pointer;
                               display:flex; align-items:center; gap:8px; transition:opacity 0.15s;">
                    <i class="ph ph-plus"></i> Nuevo Aviso
                </button>
            </div>
            <!-- Zona del formulario nuevo -->
            <div id="ta-nuevo-form-zone"></div>
            <!-- Lista -->
            <div id="ta-avisos-list"></div>
        `;

        // Wire botón nuevo
        let formVisible = false;
        content.querySelector('#ta-btn-nuevo-aviso').addEventListener('click', () => {
            const zone = content.querySelector('#ta-nuevo-form-zone');
            if (formVisible) {
                zone.innerHTML = '';
                formVisible = false;
                return;
            }
            zone.innerHTML = buildForm(null);
            formVisible = true;

            let selectedPrio = 'normal';
            wireFormPrioButtons(zone, selectedPrio, (p) => { selectedPrio = p; });

            zone.querySelector('.ta-aviso-cancel').addEventListener('click', () => {
                zone.innerHTML = '';
                formVisible = false;
            });

            zone.querySelector('.ta-aviso-save').addEventListener('click', async () => {
                const title = zone.querySelector('.ta-aviso-titulo').value.trim();
                const body  = zone.querySelector('.ta-aviso-body').value.trim();
                if (!title) { window.showToast('El título es obligatorio.', 'error'); return; }

                const now = new Date().toISOString();
                const newA = {
                    id: crypto.randomUUID(),
                    tenant_id: tenantId,
                    author_id: userId,
                    title,
                    body,
                    photo_urls: [],
                    priority: selectedPrio,
                    active: true,
                    created_at: now,
                    updated_at_hlc: window.HLC?.now?.() || Date.now(),
                    deleted: false,
                    version: 1,
                };
                try {
                    await window.DataManager.saveAndSync('announcements', newA);
                    announcements.unshift(newA);
                    zone.innerHTML = '';
                    formVisible = false;
                    renderAll();
                    window.showToast('Aviso publicado.', 'success');
                } catch (err) {
                    window.showToast('Error al guardar: ' + err.message, 'error');
                }
            });
        });

        renderAll();
    }

    function wireFormPrioButtons(container, selectedPrio, onChange) {
        let prio = selectedPrio;
        container.querySelectorAll('.ta-prio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                prio = btn.dataset.prio;
                onChange(prio);
                container.querySelectorAll('.ta-prio-btn').forEach(b => {
                    const isUrgente = b.dataset.prio === 'urgente';
                    const isActive  = b.dataset.prio === prio;
                    const activeColor = isUrgente ? '#dc2626' : '#6b7280';
                    b.style.borderColor   = isActive ? activeColor : 'var(--border)';
                    b.style.background    = isActive ? (isUrgente ? 'rgba(220,38,38,0.1)' : 'rgba(107,114,128,0.1)') : 'transparent';
                    b.style.color         = isActive ? activeColor : 'var(--text-muted)';
                });
            });
        });
    }

    function wireAvisoCards(list, announcements, tenantId, userId, userEmail, renderAll, content) {
        // Toggle activo
        list.querySelectorAll('.ta-toggle-activo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id       = btn.dataset.id;
                const isActive = btn.dataset.active === '1';
                const idx      = announcements.findIndex(a => a.id === id);
                if (idx === -1) return;
                const updated = { ...announcements[idx], active: !isActive, updated_at_hlc: window.HLC?.now?.() || Date.now() };
                announcements[idx] = updated;
                try {
                    await window.DataManager.saveAndSync('announcements', updated);
                    renderAll();
                    window.showToast(updated.active ? 'Aviso activado.' : 'Aviso desactivado.', 'success');
                } catch (err) {
                    window.showToast('Error: ' + err.message, 'error');
                }
            });
        });

        // Editar — expande zona inline
        list.querySelectorAll('.ta-edit-aviso').forEach(btn => {
            btn.addEventListener('click', () => {
                const id   = btn.dataset.id;
                const card = list.querySelector(`.ta-aviso-card[data-id="${id}"]`);
                const zone = card?.querySelector(`.ta-edit-zone[data-id="${id}"]`);
                if (!zone) return;
                if (zone.style.display !== 'none') { zone.style.display = 'none'; return; }

                const a = announcements.find(x => x.id === id);
                if (!a) return;

                // Construir mini-form dentro de la zona
                let editPrio = a.priority || 'normal';
                zone.innerHTML = `
                    <input type="text" class="ta-edit-titulo" value="${window.escapeHTML(a.title || '')}"
                           style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--border);
                                  border-radius:10px; background:var(--bg-main); color:var(--text-primary);
                                  font-size:0.9rem; margin-bottom:8px; outline:none;">
                    <textarea class="ta-edit-body" rows="3"
                              style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--border);
                                     border-radius:10px; background:var(--bg-main); color:var(--text-primary);
                                     font-size:0.85rem; resize:vertical; margin-bottom:8px; outline:none;">${window.escapeHTML(a.body || '')}</textarea>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <button class="ta-prio-btn" data-prio="normal"
                                style="padding:4px 12px; border-radius:8px; border:1.5px solid ${editPrio === 'normal' ? '#6b7280' : 'var(--border)'};
                                       background:${editPrio === 'normal' ? 'rgba(107,114,128,0.1)' : 'transparent'};
                                       color:${editPrio === 'normal' ? '#6b7280' : 'var(--text-muted)'};
                                       font-size:0.8rem; font-weight:600; cursor:pointer;">Normal</button>
                        <button class="ta-prio-btn" data-prio="urgente"
                                style="padding:4px 12px; border-radius:8px; border:1.5px solid ${editPrio === 'urgente' ? '#dc2626' : 'var(--border)'};
                                       background:${editPrio === 'urgente' ? 'rgba(220,38,38,0.1)' : 'transparent'};
                                       color:${editPrio === 'urgente' ? '#dc2626' : 'var(--text-muted)'};
                                       font-size:0.8rem; font-weight:600; cursor:pointer;">🔴 Urgente</button>
                    </div>
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="ta-edit-cancel"
                                style="padding:7px 14px; border:1px solid var(--border); border-radius:8px;
                                       background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.82rem;">
                            Cancelar
                        </button>
                        <button class="ta-edit-submit" data-id="${id}"
                                style="padding:7px 14px; background:var(--primary); color:#fff; border:none;
                                       border-radius:8px; cursor:pointer; font-size:0.82rem; font-weight:700;">
                            Guardar
                        </button>
                    </div>
                `;
                zone.style.display = 'block';

                wireFormPrioButtons(zone, editPrio, (p) => { editPrio = p; });

                zone.querySelector('.ta-edit-cancel').addEventListener('click', () => {
                    zone.style.display = 'none';
                });

                zone.querySelector('.ta-edit-submit').addEventListener('click', async () => {
                    const title = zone.querySelector('.ta-edit-titulo').value.trim();
                    const body  = zone.querySelector('.ta-edit-body').value.trim();
                    if (!title) { window.showToast('El título es obligatorio.', 'error'); return; }
                    const idx = announcements.findIndex(x => x.id === id);
                    if (idx === -1) return;
                    const updated = { ...announcements[idx], title, body, priority: editPrio, updated_at_hlc: window.HLC?.now?.() || Date.now() };
                    announcements[idx] = updated;
                    try {
                        await window.DataManager.saveAndSync('announcements', updated);
                        zone.style.display = 'none';
                        renderAll();
                        window.showToast('Aviso actualizado.', 'success');
                    } catch (err) {
                        window.showToast('Error: ' + err.message, 'error');
                    }
                });
            });
        });

        // Eliminar aviso
        list.querySelectorAll('.ta-delete-aviso').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!window.showConfirmDialog) {
                    if (!confirm('¿Eliminar este aviso?')) return;
                } else {
                    const ok = await window.showConfirmDialog('Eliminar aviso', '¿Seguro que deseas eliminar este aviso?');
                    if (!ok) return;
                }
                const id  = btn.dataset.id;
                const idx = announcements.findIndex(a => a.id === id);
                if (idx === -1) return;
                const updated = { ...announcements[idx], deleted: true, active: false, updated_at_hlc: window.HLC?.now?.() || Date.now() };
                announcements[idx] = updated;
                try {
                    await window.DataManager.saveAndSync('announcements', updated);
                    renderAll();
                    window.showToast('Aviso eliminado.', 'success');
                } catch (err) {
                    window.showToast('Error: ' + err.message, 'error');
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 3 — LECTURAS
    // ═══════════════════════════════════════════════════════════════════════
    async function renderLecturas(content, tenantId) {
        content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Cargando lecturas…</div>`;

        try {
            const [allAnnouncements, allReads] = await Promise.all([
                window.db.announcements.toArray(),
                window.db.announcement_reads.toArray(),
            ]);

            // Solo avisos activos del tenant
            const activeAnnouncements = allAnnouncements
                .filter(a => !a.deleted && a.active && (!tenantId || a.tenant_id === tenantId || !a.tenant_id))
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

            if (activeAnnouncements.length === 0) {
                content.innerHTML = `
                    <div style="text-align:center; padding:40px; color:var(--text-muted);">
                        <i class="ph ph-eye-slash" style="font-size:2.5rem; opacity:0.4; display:block; margin-bottom:10px;"></i>
                        <p style="font-size:0.9rem;">No hay avisos activos para mostrar lecturas.</p>
                    </div>
                `;
                return;
            }

            // Obtener lista de empleados del tenant vía Supabase
            let employees = [];
            try {
                const client = window.SyncV2?.client;
                if (client) {
                    const { data } = await client
                        .from('user_tenants')
                        .select('user_id, email, role')
                        .eq('tenant_id', tenantId);
                    employees = data || [];
                }
            } catch { /* Sin lista de empleados, solo mostrar quién leyó */ }

            // Construir mapa de lecturas por aviso
            const readsByAnn = {};
            for (const r of allReads) {
                if (!readsByAnn[r.announcement_id]) readsByAnn[r.announcement_id] = [];
                readsByAnn[r.announcement_id].push(r);
            }

            content.innerHTML = activeAnnouncements.map(a => {
                const reads  = readsByAnn[a.id] || [];
                const readIds = new Set(reads.map(r => r.user_id));

                const leidas = reads.sort((x, y) => (y.read_at || '').localeCompare(x.read_at || ''));
                const noLeidas = employees.filter(e => !readIds.has(e.user_id));

                const esUrgente = a.priority === 'urgente';

                return `
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px;
                                padding:16px; margin-bottom:16px;">

                        <!-- Cabecera aviso -->
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                            ${esUrgente ? `<span style="font-size:0.72rem; font-weight:700; padding:2px 9px; border-radius:8px;
                                                         background:rgba(220,38,38,0.1); color:#dc2626;">🔴 URGENTE</span>` : ''}
                            <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary); flex:1; min-width:0;">
                                ${window.escapeHTML(a.title || 'Sin título')}
                            </span>
                        </div>

                        <!-- Quién leyó -->
                        <div style="margin-bottom:10px;">
                            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;
                                        letter-spacing:0.5px; margin-bottom:8px;">
                                <i class="ph ph-check-circle" style="color:#16a34a;"></i>
                                Leído por (${leidas.length})
                            </div>
                            ${leidas.length === 0
                                ? `<p style="font-size:0.85rem; color:var(--text-muted); margin:0 0 0 16px;">Nadie ha leído este aviso aún.</p>`
                                : leidas.map(r => `
                                    <div style="display:flex; align-items:center; gap:8px; padding:6px 0;
                                                border-bottom:1px solid var(--border); margin-left:16px;">
                                        <i class="ph ph-user-circle" style="color:#16a34a; font-size:1rem;"></i>
                                        <span style="font-size:0.85rem; color:var(--text-primary); flex:1;">
                                            ${window.escapeHTML(r.user_email || r.user_id || 'Usuario')}
                                        </span>
                                        <span style="font-size:0.75rem; color:var(--text-muted);">
                                            ${tiempoRelativo(r.read_at)}
                                        </span>
                                    </div>
                                `).join('')
                            }
                        </div>

                        <!-- Quién NO leyó -->
                        ${employees.length > 0 ? `
                        <div>
                            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;
                                        letter-spacing:0.5px; margin-bottom:8px;">
                                <i class="ph ph-clock" style="color:#d97706;"></i>
                                Sin leer (${noLeidas.length})
                            </div>
                            ${noLeidas.length === 0
                                ? `<p style="font-size:0.85rem; color:#16a34a; margin:0 0 0 16px; font-weight:600;">¡Todos han leído este aviso!</p>`
                                : noLeidas.map(e => `
                                    <div style="display:flex; align-items:center; gap:8px; padding:6px 0;
                                                border-bottom:1px solid var(--border); margin-left:16px;">
                                        <i class="ph ph-user-circle" style="color:#d97706; font-size:1rem;"></i>
                                        <span style="font-size:0.85rem; color:var(--text-muted);">
                                            ${window.escapeHTML(e.email || e.user_id || 'Empleado')}
                                        </span>
                                    </div>
                                `).join('')
                            }
                        </div>` : ''}

                    </div>
                `;
            }).join('');

        } catch (err) {
            content.innerHTML = `<p style="color:var(--danger);">Error al cargar lecturas: ${window.escapeHTML(err.message)}</p>`;
        }
    }

})();
