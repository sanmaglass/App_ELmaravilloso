// announcements.js — Tablero de Avisos del Equipo
window.Views = window.Views || {};

(function () {

    function tiempoRelativo(isoStr) {
        if (!isoStr) return '';
        const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
        if (diff < 60) return 'hace un momento';
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
        const dias = Math.floor(diff / 86400);
        return dias === 1 ? 'ayer' : `hace ${dias} días`;
    }

    function nombreDesdeEmail(email) {
        if (!email) return email || '—';
        return email.split('@')[0];
    }

    // ── Sonido + vibración para avisos urgentes ────────────────────────────────
    let _lastKnownAnnCount = 0;
    function playUrgentAlert() {
        try {
            // Vibración (móvil)
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
            // Sonido corto generado por AudioContext (sin archivo externo)
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'triangle'; osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(); osc.stop(ctx.currentTime + 0.5);
        } catch (e) { /* silencio si no hay audio */ }
    }

    function checkNewUrgent(announcements) {
        const urgentes = announcements.filter(a => !a.deleted && a.active && a.priority === 'urgente');
        if (urgentes.length > _lastKnownAnnCount && _lastKnownAnnCount > 0) {
            playUrgentAlert();
        }
        _lastKnownAnnCount = urgentes.length;
    }

    // ── Vista empleado ─────────────────────────────────────────────────────────

    async function renderEmpleado(container, announcements, reads, userId, tenantId) {
        const activos = announcements
            .filter(a => !a.deleted && a.active)
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

        const leidasPorMi = new Set(reads.filter(r => r.user_id === userId).map(r => r.announcement_id));

        container.innerHTML = `
            <div style="max-width:680px; margin:0 auto; padding-bottom:32px;">
                <div style="margin-bottom:24px;">
                    <div style="font-size:0.78rem; color:var(--primary); font-weight:700; letter-spacing:1.5px;
                                text-transform:uppercase; margin-bottom:4px;">Módulo Equipo</div>
                    <h1 style="margin:0 0 4px; font-size:1.6rem; color:var(--text-primary);">
                        <i class="ph ph-megaphone" style="margin-right:8px;"></i>Avisos
                    </h1>
                    <p style="margin:0; color:var(--text-muted); font-size:0.88rem;">
                        Novedades y comunicados del equipo
                    </p>
                </div>
                <div id="ann-list">
                    ${activos.length === 0
                        ? `<div style="text-align:center; padding:48px 16px; color:var(--text-muted);">
                               <i class="ph ph-megaphone" style="font-size:2.5rem; display:block; margin-bottom:12px; opacity:0.4;"></i>
                               Sin avisos por ahora.
                           </div>`
                        : activos.map(a => renderCardEmpleado(a, leidasPorMi)).join('')
                    }
                </div>
            </div>
        `;

        // Auto-marcar como leído con IntersectionObserver
        if (activos.length > 0) {
            const observer = new IntersectionObserver(async (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const annId = entry.target.dataset.annId;
                    if (!annId || leidasPorMi.has(annId)) continue;
                    leidasPorMi.add(annId);
                    // Quitar acento de no leído visualmente
                    entry.target.style.borderLeftColor = 'transparent';
                    entry.target.querySelector('.ann-badge-nuevo')?.remove();
                    observer.unobserve(entry.target);
                    try {
                        await window.DataManager.saveAndSync('announcement_reads', {
                            id: crypto.randomUUID(),
                            announcement_id: annId,
                            user_id: userId,
                            tenant_id: tenantId,
                            read_at: new Date().toISOString()
                        });
                    } catch (e) {
                        console.warn('[announcements] No se pudo marcar como leído:', e);
                    }
                }
            }, { threshold: 0.5 });

            container.querySelectorAll('.ann-card[data-ann-id]').forEach(card => {
                observer.observe(card);
            });

            // Expand/collapse al hacer click
            container.querySelectorAll('.ann-card').forEach(card => {
                card.addEventListener('click', () => {
                    const body = card.querySelector('.ann-body-text');
                    const toggle = card.querySelector('.ann-toggle');
                    if (!body) return;
                    const expanded = card.dataset.expanded === 'true';
                    body.style.webkitLineClamp = expanded ? '4' : 'unset';
                    body.style.display = 'block';
                    if (toggle) toggle.textContent = expanded ? 'Leer más' : 'Mostrar menos';
                    card.dataset.expanded = expanded ? 'false' : 'true';
                });
            });
        }
    }

    function renderCardEmpleado(a, leidasPorMi) {
        const noLeido = !leidasPorMi.has(a.id);
        const esUrgente = a.priority === 'urgente';
        const bodyText = a.body || '';
        const necesitaTruncado = bodyText.length > 200;

        return `
        <div class="ann-card" data-ann-id="${window.escapeHTML(a.id)}" data-expanded="false"
            style="background:var(--bg-card); border:1px solid var(--border);
                   border-left:3px solid ${noLeido ? 'var(--primary)' : 'transparent'};
                   border-radius:14px; padding:18px 20px; margin-bottom:12px; cursor:pointer;
                   transition:border-color 0.3s;">
            <!-- Cabecera -->
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${esUrgente ? `
                    <span style="font-size:0.7rem; font-weight:700; padding:3px 9px; border-radius:6px;
                                 background:rgba(239,68,68,0.15); color:#ef4444; text-transform:uppercase;">
                        🔴 Urgente
                    </span>` : `
                    <span style="font-size:0.7rem; font-weight:600; padding:3px 9px; border-radius:6px;
                                 background:rgba(76,141,255,0.12); color:var(--primary); text-transform:uppercase;">
                        Aviso
                    </span>`}
                    ${noLeido ? `<span class="ann-badge-nuevo" style="font-size:0.72rem; font-weight:700; color:var(--primary);">● Nuevo</span>` : ''}
                </div>
                <span style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">
                    ${tiempoRelativo(a.created_at)}
                </span>
            </div>
            <!-- Título -->
            <div style="font-weight:700; font-size:1rem; color:var(--text-primary); margin-bottom:8px;">
                ${window.escapeHTML(a.title || 'Sin título')}
            </div>
            <!-- Cuerpo -->
            <div class="ann-body-text"
                style="font-size:0.88rem; color:var(--text-muted); line-height:1.6;
                       display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:4; overflow:hidden;">
                ${window.escapeHTML(bodyText)}
            </div>
            ${necesitaTruncado ? `
            <div style="margin-top:8px;">
                <span class="ann-toggle" style="font-size:0.8rem; color:var(--primary); font-weight:600;">Leer más</span>
            </div>` : ''}
            <!-- Pie -->
            <div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border);
                        font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                <i class="ph ph-user"></i>
                ${window.escapeHTML(nombreDesdeEmail(a.author_id || ''))}
            </div>
        </div>
        `;
    }

    // ── Vista admin/owner ──────────────────────────────────────────────────────

    async function renderAdmin(container, announcements, reads, userId, tenantId) {
        // Contar lecturas únicas por aviso
        const readsByAnn = {};
        for (const r of reads) {
            if (!readsByAnn[r.announcement_id]) readsByAnn[r.announcement_id] = new Set();
            readsByAnn[r.announcement_id].add(r.user_id);
        }

        const activos = announcements
            .filter(a => !a.deleted)
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

        container.innerHTML = `
            <div style="max-width:720px; margin:0 auto; padding-bottom:32px;">
                <!-- Header -->
                <div style="display:flex; align-items:flex-start; justify-content:space-between;
                            flex-wrap:wrap; gap:12px; margin-bottom:24px;">
                    <div>
                        <div style="font-size:0.78rem; color:var(--primary); font-weight:700;
                                    letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">
                            Módulo Equipo
                        </div>
                        <h1 style="margin:0 0 4px; font-size:1.6rem; color:var(--text-primary);">
                            <i class="ph ph-megaphone" style="margin-right:8px;"></i>Avisos
                        </h1>
                        <p style="margin:0; color:var(--text-muted); font-size:0.88rem;">
                            Gestión de comunicados para el equipo
                        </p>
                    </div>
                    <button id="ann-btn-nuevo"
                        style="padding:10px 18px; background:var(--primary); color:#fff; border:none;
                               border-radius:10px; font-weight:700; font-size:0.9rem; cursor:pointer;
                               display:flex; align-items:center; gap:6px; transition:opacity 0.15s;">
                        <i class="ph ph-plus"></i> Nuevo Aviso
                    </button>
                </div>

                <!-- Formulario inline (oculto) -->
                <div id="ann-form-wrap" style="display:none; background:var(--bg-card); border:1px solid var(--border);
                     border-radius:16px; padding:20px; margin-bottom:20px;">
                    <h3 style="margin:0 0 16px; font-size:1rem; color:var(--text-primary);">
                        <span id="ann-form-title-label">Nuevo Aviso</span>
                    </h3>
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; color:var(--text-muted);
                                      margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Título *</label>
                        <input id="ann-f-titulo" type="text" maxlength="120" placeholder="Título del aviso…"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; background:var(--bg-main);
                                   border:1px solid var(--border); border-radius:10px; color:var(--text-primary);
                                   font:inherit; font-size:0.92rem; outline:none;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; color:var(--text-muted);
                                      margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Mensaje *</label>
                        <textarea id="ann-f-body" rows="4" maxlength="2000" placeholder="Escribe el mensaje aquí…"
                            style="width:100%; box-sizing:border-box; padding:10px 14px; background:var(--bg-main);
                                   border:1px solid var(--border); border-radius:10px; color:var(--text-primary);
                                   font:inherit; font-size:0.92rem; resize:vertical; outline:none;"></textarea>
                    </div>
                    <div style="margin-bottom:18px;">
                        <label style="display:block; font-size:0.82rem; font-weight:600; color:var(--text-muted);
                                      margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Prioridad</label>
                        <div style="display:flex; gap:8px;">
                            <button class="ann-priority-btn" data-value="normal"
                                style="padding:7px 18px; border-radius:8px; font-weight:600; font-size:0.85rem;
                                       cursor:pointer; border:2px solid var(--primary); background:var(--primary);
                                       color:#fff; transition:all 0.15s;">
                                Normal
                            </button>
                            <button class="ann-priority-btn" data-value="urgente"
                                style="padding:7px 18px; border-radius:8px; font-weight:600; font-size:0.85rem;
                                       cursor:pointer; border:2px solid var(--border); background:transparent;
                                       color:var(--text-muted); transition:all 0.15s;">
                                🔴 Urgente
                            </button>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <button id="ann-f-submit"
                            style="padding:10px 22px; background:var(--primary); color:#fff; border:none;
                                   border-radius:10px; font-weight:700; font-size:0.9rem; cursor:pointer;">
                            <span id="ann-f-submit-label">Publicar Aviso</span>
                        </button>
                        <button id="ann-f-cancel"
                            style="padding:10px 18px; background:transparent; color:var(--text-muted);
                                   border:1px solid var(--border); border-radius:10px; font-size:0.9rem; cursor:pointer;">
                            Cancelar
                        </button>
                    </div>
                </div>

                <!-- Lista -->
                <div id="ann-admin-list">
                    ${activos.length === 0
                        ? `<div style="text-align:center; padding:48px 16px; color:var(--text-muted);">
                               <i class="ph ph-megaphone" style="font-size:2.5rem; display:block; margin-bottom:12px; opacity:0.4;"></i>
                               No hay avisos publicados. Crea el primero.
                           </div>`
                        : activos.map(a => renderCardAdmin(a, readsByAnn)).join('')
                    }
                </div>
            </div>
        `;

        // ─ Estado del formulario ─
        let editingId = null;
        let selectedPriority = 'normal';

        const formWrap   = container.querySelector('#ann-form-wrap');
        const fTitulo    = container.querySelector('#ann-f-titulo');
        const fBody      = container.querySelector('#ann-f-body');
        const fSubmit    = container.querySelector('#ann-f-submit');
        const fSubmitLbl = container.querySelector('#ann-f-submit-label');
        const fFormLbl   = container.querySelector('#ann-form-title-label');
        const fCancel    = container.querySelector('#ann-f-cancel');
        const btnNuevo   = container.querySelector('#ann-btn-nuevo');

        function setPriority(val) {
            selectedPriority = val;
            container.querySelectorAll('.ann-priority-btn').forEach(b => {
                const active = b.dataset.value === val;
                if (b.dataset.value === 'urgente') {
                    b.style.border      = active ? '2px solid #ef4444' : '2px solid var(--border)';
                    b.style.background  = active ? '#ef4444' : 'transparent';
                    b.style.color       = active ? '#fff' : 'var(--text-muted)';
                } else {
                    b.style.border      = active ? '2px solid var(--primary)' : '2px solid var(--border)';
                    b.style.background  = active ? 'var(--primary)' : 'transparent';
                    b.style.color       = active ? '#fff' : 'var(--text-muted)';
                }
            });
        }

        function abrirFormulario(aviso = null) {
            editingId = aviso ? aviso.id : null;
            fTitulo.value = aviso ? (aviso.title || '') : '';
            fBody.value   = aviso ? (aviso.body  || '') : '';
            setPriority(aviso ? (aviso.priority || 'normal') : 'normal');
            fFormLbl.textContent    = aviso ? 'Editar Aviso' : 'Nuevo Aviso';
            fSubmitLbl.textContent  = aviso ? 'Guardar cambios' : 'Publicar Aviso';
            formWrap.style.display  = 'block';
            fTitulo.focus();
            formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cerrarFormulario() {
            formWrap.style.display = 'none';
            editingId = null;
            fTitulo.value = '';
            fBody.value   = '';
            setPriority('normal');
        }

        container.querySelectorAll('.ann-priority-btn').forEach(b => {
            b.addEventListener('click', () => setPriority(b.dataset.value));
        });

        btnNuevo.addEventListener('click', () => abrirFormulario());
        fCancel.addEventListener('click', cerrarFormulario);

        // ─ Guardar aviso (crear o editar) ─
        fSubmit.addEventListener('click', async () => {
            const titulo = fTitulo.value.trim();
            const cuerpo = fBody.value.trim();
            if (!titulo) { window.showToast('El título es obligatorio', 'error'); fTitulo.focus(); return; }
            if (!cuerpo) { window.showToast('El mensaje no puede estar vacío', 'error'); fBody.focus(); return; }

            fSubmit.disabled = true;
            fSubmitLbl.textContent = 'Guardando…';

            try {
                const now = new Date().toISOString();
                if (editingId) {
                    // Editar existente — cargar y actualizar
                    const existing = await window.db.announcements.get(editingId);
                    if (existing) {
                        await window.DataManager.saveAndSync('announcements', {
                            ...existing,
                            title:    titulo,
                            body:     cuerpo,
                            priority: selectedPriority
                        });
                    }
                    window.showToast('Aviso actualizado', 'success');
                } else {
                    // Crear nuevo
                    await window.DataManager.saveAndSync('announcements', {
                        id:            crypto.randomUUID(),
                        tenant_id:     tenantId,
                        author_id:     userId,
                        title:         titulo,
                        body:          cuerpo,
                        photo_urls:    [],
                        priority:      selectedPriority,
                        active:        true,
                        created_at:    now,
                        deleted:       false,
                        version:       1
                    });
                    window.showToast('Aviso publicado', 'success');
                }
                cerrarFormulario();
                // Recargar vista
                const [newAnn, newReads] = await Promise.all([
                    window.db.announcements.toArray(),
                    window.db.announcement_reads.toArray()
                ]);
                await renderAdmin(container, newAnn, newReads, userId, tenantId);
            } catch (e) {
                console.error('[announcements] Error guardando aviso:', e);
                window.showToast('Error al guardar el aviso', 'error');
                fSubmit.disabled = false;
                fSubmitLbl.textContent = editingId ? 'Guardar cambios' : 'Publicar Aviso';
            }
        });

        // ─ Botones editar / eliminar en lista ─
        container.querySelector('#ann-admin-list')?.addEventListener('click', async (e) => {
            const btnEdit = e.target.closest('.ann-btn-edit');
            const btnDel  = e.target.closest('.ann-btn-delete');

            if (btnEdit) {
                const annId = btnEdit.dataset.annId;
                const aviso = await window.db.announcements.get(annId);
                if (aviso) abrirFormulario(aviso);
                return;
            }

            if (btnDel) {
                const annId = btnDel.dataset.annId;
                const ok = await window.showConfirm?.('¿Eliminar este aviso?', 'Esta acción no se puede deshacer.') ?? true;
                if (!ok) return;
                try {
                    const aviso = await window.db.announcements.get(annId);
                    if (aviso) {
                        await window.DataManager.saveAndSync('announcements', { ...aviso, deleted: true });
                    }
                    window.showToast('Aviso eliminado', 'success');
                    const [newAnn, newReads] = await Promise.all([
                        window.db.announcements.toArray(),
                        window.db.announcement_reads.toArray()
                    ]);
                    await renderAdmin(container, newAnn, newReads, userId, tenantId);
                } catch (e2) {
                    console.error('[announcements] Error eliminando:', e2);
                    window.showToast('Error al eliminar el aviso', 'error');
                }
            }
        });
    }

    function renderCardAdmin(a, readsByAnn) {
        const esUrgente  = a.priority === 'urgente';
        const eliminado  = !!a.deleted;
        const leidoPor   = readsByAnn[a.id] ? readsByAnn[a.id].size : 0;

        return `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
                    padding:18px 20px; margin-bottom:12px; opacity:${eliminado ? '0.5' : '1'};">
            <!-- Cabecera -->
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${esUrgente ? `
                    <span style="font-size:0.7rem; font-weight:700; padding:3px 9px; border-radius:6px;
                                 background:rgba(239,68,68,0.15); color:#ef4444; text-transform:uppercase;">
                        🔴 Urgente
                    </span>` : `
                    <span style="font-size:0.7rem; font-weight:600; padding:3px 9px; border-radius:6px;
                                 background:rgba(76,141,255,0.12); color:var(--primary); text-transform:uppercase;">
                        Normal
                    </span>`}
                    ${eliminado ? `<span style="font-size:0.7rem; color:var(--danger); font-weight:600;">● Eliminado</span>` : ''}
                </div>
                <span style="font-size:0.78rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">
                    ${tiempoRelativo(a.created_at)}
                </span>
            </div>
            <!-- Título -->
            <div style="font-weight:700; font-size:1rem; color:var(--text-primary); margin-bottom:8px;">
                ${window.escapeHTML(a.title || 'Sin título')}
            </div>
            <!-- Cuerpo -->
            <div style="font-size:0.88rem; color:var(--text-muted); line-height:1.6; margin-bottom:12px;">
                ${window.escapeHTML(a.body || '')}
            </div>
            <!-- Pie: lecturas + acciones -->
            <div style="display:flex; align-items:center; justify-content:space-between;
                        flex-wrap:wrap; gap:10px; padding-top:10px; border-top:1px solid var(--border);">
                <div style="display:flex; align-items:center; gap:6px; font-size:0.78rem; color:var(--text-muted);">
                    <i class="ph ph-eye"></i>
                    <span>Leído por <strong style="color:var(--text-primary);">${leidoPor}</strong> persona${leidoPor !== 1 ? 's' : ''}</span>
                </div>
                ${!eliminado ? `
                <div style="display:flex; gap:8px;">
                    <button class="ann-btn-edit" data-ann-id="${window.escapeHTML(a.id)}"
                        style="padding:6px 14px; font-size:0.8rem; font-weight:600; border-radius:8px; cursor:pointer;
                               background:transparent; border:1px solid var(--border); color:var(--text-primary);
                               display:flex; align-items:center; gap:5px; transition:all 0.15s;">
                        <i class="ph ph-pencil"></i> Editar
                    </button>
                    <button class="ann-btn-delete" data-ann-id="${window.escapeHTML(a.id)}"
                        style="padding:6px 14px; font-size:0.8rem; font-weight:600; border-radius:8px; cursor:pointer;
                               background:transparent; border:1px solid var(--danger); color:var(--danger);
                               display:flex; align-items:center; gap:5px; transition:all 0.15s;">
                        <i class="ph ph-trash"></i> Eliminar
                    </button>
                </div>` : ''}
            </div>
        </div>
        `;
    }

    // ── Entry point ───────────────────────────────────────────────────────────

    window.Views.announcements = async (container) => {
        const userId   = window.Auth?.session?.user?.id;
        const tenantId = window.Auth?.getTenantId();
        const role     = window.Auth?.getRole() || 'employee';
        const isAdmin  = role === 'owner' || role === 'admin';

        // Skeleton mientras carga
        container.innerHTML = `
            <div style="max-width:680px; margin:0 auto; padding:40px 0; text-align:center; color:var(--text-muted);">
                <i class="ph ph-circle-notch" style="font-size:2rem; animation:spin 1s linear infinite;"></i>
                <p style="margin-top:12px;">Cargando avisos…</p>
            </div>
            <style>@keyframes spin { from { transform:rotate(0) } to { transform:rotate(360deg) } }</style>
        `;

        async function loadAndRender() {
            try {
                const [announcements, reads] = await Promise.all([
                    window.db.announcements.toArray(),
                    window.db.announcement_reads.toArray()
                ]);
                checkNewUrgent(announcements);
                if (isAdmin) {
                    await renderAdmin(container, announcements, reads, userId, tenantId);
                } else {
                    await renderEmpleado(container, announcements, reads, userId, tenantId);
                }
            } catch (err) {
                console.error('[announcements] Error cargando datos:', err);
                container.innerHTML = `
                    <div style="max-width:680px; margin:0 auto; padding:32px 16px;">
                        <p style="color:var(--danger);">
                            <i class="ph ph-warning"></i> Error al cargar los avisos. Intenta recargar la página.
                        </p>
                    </div>
                `;
            }
        }

        await loadAndRender();

        // Realtime: re-render cuando llegan datos nuevos
        const _realtimeHandler = () => loadAndRender();
        window.addEventListener('sync-data-updated', _realtimeHandler);
        // Cleanup al salir de la vista
        window._viewCleanup = () => {
            window.removeEventListener('sync-data-updated', _realtimeHandler);
            _lastKnownAnnCount = 0;
        };
    };
})();
