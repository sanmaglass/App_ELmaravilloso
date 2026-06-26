// team_home.js — Inicio del Módulo Equipo (vista empleado)
window.Views = window.Views || {};

(function () {
    const TZ = 'America/Santiago';

    function chileNow() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    }

    function formatFechaChile(d) {
        return d.toLocaleDateString('es-CL', {
            timeZone: TZ,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function tiempoRelativo(isoStr) {
        const ahora = Date.now();
        const ts = new Date(isoStr).getTime();
        const diff = Math.floor((ahora - ts) / 1000);
        if (diff < 60) return 'hace un momento';
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
        const dias = Math.floor(diff / 86400);
        return dias === 1 ? 'ayer' : `hace ${dias} días`;
    }

    function nombreDesdeEmail(email) {
        if (!email) return 'Equipo';
        const parte = email.split('@')[0];
        return parte.charAt(0).toUpperCase() + parte.slice(1);
    }

    const TYPE_LABELS = {
        pedido: 'Pedido',
        merma: 'Merma',
        limpieza: 'Limpieza',
        reporte: 'Reporte',
        vendedor: 'Vendedor'
    };

    const STATUS_CONFIG = {
        pendiente: { label: 'Pendiente', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
        visto:     { label: 'Visto',     color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
        respondido:{ label: 'Respondido',color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
        resuelto:  { label: 'Resuelto',  color: '#16a34a', bg: 'rgba(22,163,74,0.12)' }
    };

    function saludoContextual() {
        const h = chileNow().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }

    // Checklist tareas — se cargan desde BD (checklist_templates), con fallback hardcodeado
    const FALLBACK_APERTURA = [
        { task: 'Contar caja inicial y anotar monto', icon: 'ph-fill ph-wallet' },
        { task: 'Trapear el piso', icon: 'ph-fill ph-broom' },
        { task: 'Aseo general (mesón, vitrinas, estantes)', icon: 'ph-fill ph-sparkle' },
        { task: 'Reponer vitrina y dejar cartones en su lugar', icon: 'ph-fill ph-package' },
        { task: 'Revisar que todos los productos tengan precio y cartulina', icon: 'ph-fill ph-tag' },
        { task: 'Revisar productos próximos a vencer', icon: 'ph-fill ph-calendar-check' }
    ];
    const FALLBACK_CIERRE = [
        { task: 'Cuadrar caja: contar efectivo + revisar tarjetas', icon: 'ph-fill ph-wallet' },
        { task: 'Anotar productos que se agotaron', icon: 'ph-fill ph-package' },
        { task: 'Registrar novedades (devoluciones, fiados, problemas)', icon: 'ph-fill ph-pencil-line' },
        { task: 'Botar basura y sacar cartones', icon: 'ph-fill ph-trash' },
        { task: 'Apagar luces de vitrina y letrero', icon: 'ph-fill ph-lightning' },
        { task: 'Cerrar bien (cortina, llaves)', icon: 'ph-fill ph-lock' }
    ];
    // Tarea extra de baño — solo aparece sábado y domingo (finde)
    const TAREA_BANO_FINDE = { task: 'Limpiar baño', icon: 'ph-fill ph-toilet' };

    function esFinDeSemana() {
        const day = chileNow().getDay(); // 0=dom, 6=sáb
        return day === 0 || day === 6;
    }

    async function loadChecklistTasks(type) {
        let tasks;
        try {
            const templates = await window.db.checklist_templates.toArray();
            const tpl = templates.find(t => t.checklist_type === type && !t.deleted && t.active);
            if (tpl && Array.isArray(tpl.tasks) && tpl.tasks.length > 0) tasks = [...tpl.tasks];
        } catch { /* tabla aún no existe, usar fallback */ }
        if (!tasks) tasks = type === 'apertura' ? [...FALLBACK_APERTURA] : [...FALLBACK_CIERRE];
        // Agregar tarea de baño solo en apertura los fines de semana
        if (type === 'apertura' && esFinDeSemana()) {
            const yaExiste = tasks.some(t => t.task.toLowerCase().includes('baño'));
            if (!yaExiste) tasks.push(TAREA_BANO_FINDE);
        }
        return tasks;
    }

    function getChecklistType() {
        const h = chileNow().getHours();
        return h < 15 ? 'apertura' : 'cierre';
    }

    function navTo(view) {
        // Preferir el router directo (funciona para vistas sin nav-item, ej. factura_upload).
        if (typeof window.navigateToView === 'function') {
            const labels = { factura_upload: 'Subir factura', announcements: 'Avisos', team_reports: 'Mis Reportes', caja_dia: 'Caja del Día', team_home: 'Inicio' };
            window.navigateToView(view, labels[view] || '');
            return;
        }
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) btn.click();
    }

    window.Views.team_home = async (container) => {
        const userId   = window.Auth?.session?.user?.id;
        const email    = window.Auth?.session?.user?.email || '';
        const nombre   = nombreDesdeEmail(email);
        const tenantId = window.Auth?.getTenantId();
        const hoy      = formatFechaChile(chileNow());

        // Esqueleto base — sin accesos rápidos (ya están en el bottom-nav)
        container.innerHTML = `
            <div style="max-width:680px; margin:0 auto; padding:0 16px 32px;">

                <!-- Saludo -->
                <div style="margin-bottom:24px;">
                    <p style="margin:0 0 2px; color:var(--text-muted); font-size:0.82rem; text-transform:capitalize;">
                        ${hoy}
                    </p>
                    <h1 style="margin:0; font-size:1.6rem; color:var(--text-primary); font-weight:800;">
                        ${saludoContextual()}, ${window.escapeHTML(nombre)}
                    </h1>
                </div>

                <!-- Checklist del turno -->
                <div style="margin-bottom:24px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                        <h3 style="margin:0; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                                   text-transform:uppercase; letter-spacing:0.8px;">
                            <i class="ph-fill ph-list-checks" style="margin-right:5px;"></i>${getChecklistType() === 'apertura' ? 'Apertura' : 'Cierre'}
                        </h3>
                        <span id="th-checklist-progress" style="font-size:0.78rem; color:var(--text-muted);"></span>
                    </div>
                    <div id="th-checklist" style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden;">
                        <div style="color:var(--text-muted); font-size:0.88rem; padding:16px;">Cargando...</div>
                    </div>
                </div>

                <!-- Subir factura de mercadería -->
                <div style="margin-bottom:24px;">
                    <button id="th-btn-factura"
                        style="width:100%; padding:18px 20px; background:linear-gradient(135deg, var(--primary), #2f6fe0);
                               color:#fff; border:none; border-radius:16px; cursor:pointer;
                               display:flex; align-items:center; gap:14px;
                               box-shadow:0 4px 16px rgba(76,141,255,0.28); transition:opacity 0.15s;">
                        <div style="width:46px; height:46px; background:rgba(255,255,255,0.18); border-radius:12px;
                                    display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="ph-fill ph-receipt" style="font-size:1.5rem;"></i>
                        </div>
                        <div style="text-align:left; flex:1;">
                            <div style="font-weight:800; font-size:1rem; margin-bottom:2px;">Subir factura</div>
                            <div style="font-size:0.82rem; opacity:0.85;">Fotografía la factura cuando llega mercadería</div>
                        </div>
                        <i class="ph ph-caret-right" style="font-size:1.2rem; opacity:0.7;"></i>
                    </button>
                </div>

                <!-- Promo del día -->
                <div id="th-promo-section" style="margin-bottom:24px; display:none;">
                    <h3 style="margin:0 0 10px; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                               text-transform:uppercase; letter-spacing:0.8px;">
                        <i class="ph-fill ph-sparkle" style="margin-right:5px;"></i>Promo vigente
                    </h3>
                    <div id="th-promo-card"></div>
                </div>

                <!-- Avisos recientes -->
                <div style="margin-bottom:24px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                        <h3 style="margin:0; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                                   text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:8px;">
                            <i class="ph-fill ph-chat-circle-dots" style="margin-right:2px;"></i>Avisos
                            <span id="th-avisos-badge" style="display:none; background:#2563eb; color:#fff; font-size:0.65rem;
                                  padding:2px 7px; border-radius:10px; font-weight:700;"></span>
                        </h3>
                        <button class="th-ver-mas" data-nav="announcements"
                            style="font-size:0.8rem; color:var(--primary); background:none; border:none; cursor:pointer; padding:0;">
                            Ver todos →
                        </button>
                    </div>
                    <div id="th-avisos-list">
                        <div style="color:var(--text-muted); font-size:0.88rem; padding:16px 0;">Cargando avisos…</div>
                    </div>
                </div>

                <!-- Mis reportes recientes -->
                <div>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                        <h3 style="margin:0; font-size:0.82rem; font-weight:700; color:var(--text-muted);
                                   text-transform:uppercase; letter-spacing:0.8px;">
                            <i class="ph-fill ph-clipboard-text" style="margin-right:5px;"></i>Mis reportes
                        </h3>
                        <button class="th-ver-mas" data-nav="team_reports"
                            style="font-size:0.8rem; color:var(--primary); background:none; border:none; cursor:pointer; padding:0;">
                            Ver todos →
                        </button>
                    </div>
                    <div id="th-reportes-list">
                        <div style="color:var(--text-muted); font-size:0.88rem; padding:16px 0;">Cargando reportes…</div>
                    </div>
                </div>

                <!-- Cerrar sesión -->
                <div style="margin-top:32px; padding-top:20px; border-top:1px solid var(--border);">
                    <button id="th-logout" style="width:100%; padding:14px; background:none; border:1px solid rgba(239,68,68,0.25);
                            border-radius:12px; color:#ef4444; font-size:0.9rem; font-weight:600; cursor:pointer;
                            display:flex; align-items:center; justify-content:center; gap:8px;
                            transition:background 0.15s;">
                        <i class="ph ph-sign-out"></i> Cerrar sesión
                    </button>
                </div>

            </div>
        `;

        // Botón subir factura
        const facturaBtn = container.querySelector('#th-btn-factura');
        if (facturaBtn) {
            facturaBtn.addEventListener('click', () => navTo('factura_upload'));
        }

        // Cerrar sesión
        const logoutBtn = container.querySelector('#th-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const ok = await window.showConfirmDialog('Cerrar sesión', '¿Segura que quieres cerrar sesión?');
                if (ok) window.Auth.logout();
            });
        }

        // "Ver todos" links y banner de avisos
        container.querySelectorAll('.th-ver-mas').forEach(btn => {
            btn.addEventListener('click', () => navTo(btn.dataset.nav));
        });

        // Cargar datos en paralelo
        try {
            const [announcements, reads, reports] = await Promise.all([
                window.db.announcements.toArray(),
                window.db.announcement_reads.toArray(),
                window.db.team_reports.toArray()
            ]);

            // — Badge de no leídos —
            const activos = announcements.filter(a => !a.deleted && a.active);
            const leidasPorMi = new Set(reads.filter(r => r.user_id === userId).map(r => r.announcement_id));
            const noLeidos = activos.filter(a => !leidasPorMi.has(a.id)).length;
            const badgeEl = container.querySelector('#th-avisos-badge');
            if (noLeidos > 0 && badgeEl) {
                badgeEl.textContent = noLeidos;
                badgeEl.style.display = 'inline-block';
            }

            // — Avisos recientes (últimos 3) —
            const avisosRecientes = activos
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                .slice(0, 3);

            const avisosEl = container.querySelector('#th-avisos-list');
            if (avisosRecientes.length === 0) {
                avisosEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.88rem; padding:12px 0;">Sin avisos por ahora.</p>`;
            } else {
                avisosEl.innerHTML = avisosRecientes.map(a => {
                    const noLeido = !leidasPorMi.has(a.id);
                    const esUrgente = a.priority === 'urgente';
                    return `
                    <div style="background:var(--bg-card); border:1px solid var(--border);
                                border-left:3px solid ${noLeido ? 'var(--primary)' : 'transparent'};
                                border-radius:12px; padding:14px 16px; margin-bottom:8px;
                                display:flex; align-items:flex-start; gap:12px; cursor:pointer;"
                         class="th-aviso-item" data-nav="announcements">
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                                ${esUrgente
                                    ? `<span style="font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:6px;
                                                background:rgba(239,68,68,0.15); color:#ef4444; text-transform:uppercase;">
                                           🔴 Urgente
                                       </span>`
                                    : ''}
                                ${noLeido
                                    ? `<span style="font-size:0.7rem; font-weight:700; color:var(--primary);">● Nuevo</span>`
                                    : ''}
                            </div>
                            <div style="font-weight:600; color:var(--text-primary); font-size:0.92rem; margin-bottom:2px;
                                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${window.escapeHTML(a.title || 'Sin título')}
                            </div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">
                                ${tiempoRelativo(a.created_at)}
                            </div>
                        </div>
                        <i class="ph ph-caret-right" style="color:var(--text-muted); flex-shrink:0; margin-top:2px;"></i>
                    </div>
                    `;
                }).join('');

                avisosEl.querySelectorAll('.th-aviso-item').forEach(el => {
                    el.addEventListener('click', () => navTo('announcements'));
                });
            }

            // — Mis reportes recientes (últimos 3) —
            const misReportes = reports
                .filter(r => !r.deleted && r.user_id === userId)
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                .slice(0, 3);

            const reportesEl = container.querySelector('#th-reportes-list');
            if (misReportes.length === 0) {
                reportesEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.88rem; padding:12px 0;">Aún no has enviado reportes.</p>`;
            } else {
                reportesEl.innerHTML = misReportes.map(r => {
                    const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendiente;
                    const tipoLabel = TYPE_LABELS[r.type] || r.type || 'Reporte';
                    return `
                    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px;
                                padding:14px 16px; margin-bottom:8px; display:flex; align-items:center; gap:12px;
                                cursor:pointer;" class="th-reporte-item">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; color:var(--text-primary); font-size:0.92rem; margin-bottom:4px;
                                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${window.escapeHTML(r.title || tipoLabel)}
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-size:0.75rem; color:var(--text-muted);">${tipoLabel}</span>
                                <span style="font-size:0.75rem; color:var(--text-muted);">·</span>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${tiempoRelativo(r.created_at)}</span>
                            </div>
                        </div>
                        <span style="font-size:0.72rem; font-weight:700; padding:3px 10px; border-radius:8px;
                                     background:${st.bg}; color:${st.color}; white-space:nowrap; flex-shrink:0;">
                            ${st.label}
                        </span>
                    </div>
                    `;
                }).join('');

                reportesEl.querySelectorAll('.th-reporte-item').forEach(el => {
                    el.addEventListener('click', () => navTo('team_reports'));
                });
            }

            // — Checklist diario —
            const clType = getChecklistType();
            const _cn = chileNow();
            const clDate = `${_cn.getFullYear()}-${String(_cn.getMonth()+1).padStart(2,'0')}-${String(_cn.getDate()).padStart(2,'0')}`;
            const clTasks = await loadChecklistTasks(clType);
            let checklist = null;
            try {
                const all = await window.db.team_checklists.toArray();
                checklist = all.find(c => c.user_id === userId && c.date === clDate && c.checklist_type === clType && !c.deleted);
            } catch (e) { /* tabla aún no existe en Dexie, silenciar */ }

            const savedItems = checklist?.items || [];
            const clEl = container.querySelector('#th-checklist');
            const progressEl = container.querySelector('#th-checklist-progress');

            function renderChecklist() {
                const doneCount = clTasks.filter((_, i) => savedItems[i]?.done).length;
                const allDone = doneCount === clTasks.length;
                progressEl.textContent = `${doneCount}/${clTasks.length}`;
                if (allDone) progressEl.style.color = 'var(--success)';

                clEl.innerHTML = clTasks.map((t, i) => {
                    const done = savedItems[i]?.done || false;
                    return `
                    <label style="display:flex; align-items:center; gap:12px; padding:14px 16px;
                                  ${i < clTasks.length - 1 ? 'border-bottom:1px solid var(--border);' : ''} cursor:pointer; transition:background 0.15s;
                                  ${done ? 'opacity:0.5;' : ''}"
                           data-cl-idx="${i}">
                        <input type="checkbox" ${done ? 'checked' : ''} data-cl-idx="${i}"
                               style="width:20px; height:20px; accent-color:var(--primary); cursor:pointer; flex-shrink:0;">
                        <i class="${t.icon}" style="font-size:1.1rem; color:${done ? 'var(--text-muted)' : 'var(--primary)'};"></i>
                        <span style="font-size:0.9rem; color:var(--text-primary); ${done ? 'text-decoration:line-through;' : ''}">${t.task}</span>
                    </label>`;
                }).join('') + (allDone ? `
                    <div style="padding:14px 16px; text-align:center; background:rgba(22,163,74,0.08);">
                        <span style="font-size:1rem;">✅</span>
                        <span style="font-size:0.88rem; color:var(--success); font-weight:600; margin-left:8px;">
                            ¡Todo listo! Buen trabajo
                        </span>
                    </div>` : '');

                clEl.querySelectorAll('input[data-cl-idx]').forEach(cb => {
                    cb.addEventListener('change', async (e) => {
                        const idx = parseInt(e.target.dataset.clIdx);
                        while (savedItems.length < clTasks.length) savedItems.push({ task: clTasks[savedItems.length].task, done: false });
                        savedItems[idx].done = e.target.checked;
                        savedItems[idx].completed_at = e.target.checked ? new Date().toISOString() : null;
                        const allNowDone = savedItems.every(it => it.done);
                        const data = {
                            id: checklist?.id || crypto.randomUUID(),
                            tenant_id: tenantId,
                            user_id: userId,
                            date: clDate,
                            checklist_type: clType,
                            items: savedItems,
                            completed: allNowDone,
                            created_at: checklist?.created_at || new Date().toISOString(),
                            deleted: false,
                            version: (checklist?.version || 0) + 1
                        };
                        try {
                            await window.DataManager.saveAndSync('team_checklists', data);
                            checklist = data;
                        } catch (err) { console.warn('[checklist] Error guardando:', err); }
                        renderChecklist();
                        if (allNowDone && navigator.vibrate) navigator.vibrate(100);
                    });
                });
            }
            renderChecklist();

            // — Promo del día —
            try {
                const promos = await window.db.promotions.toArray();
                const vigentes = promos.filter(p => !p.deleted);
                // Ordenar por updated_at_hlc desc para mostrar la más reciente
                vigentes.sort((a, b) => (b.updated_at_hlc || 0) - (a.updated_at_hlc || 0));
                if (vigentes.length > 0) {
                    const promo = vigentes[0];
                    const promoSection = container.querySelector('#th-promo-section');
                    const promoCard = container.querySelector('#th-promo-card');
                    promoSection.style.display = 'block';
                    promoCard.innerHTML = `
                        <div style="background:linear-gradient(135deg, rgba(234,88,12,0.1), rgba(239,68,68,0.05));
                                    border:1px solid var(--border); border-left:4px solid #ea580c;
                                    border-radius:14px; padding:18px 20px;">
                            <div style="font-weight:700; color:var(--text-primary); font-size:1rem; margin-bottom:6px;">
                                <i class="ph-fill ph-tag" style="color:#ea580c; margin-right:6px;"></i>
                                ${window.escapeHTML(promo.name || promo.title || 'Promoción')}
                            </div>
                            ${promo.description ? `<div style="font-size:0.88rem; color:var(--text-muted);">${window.escapeHTML(promo.description)}</div>` : ''}
                            ${promo.discount ? `<div style="font-size:1.4rem; font-weight:800; color:#ea580c; margin-top:8px;">${promo.discount}% OFF</div>` : ''}
                        </div>
                    `;
                }
            } catch (e) { /* sin promos, ok */ }

        } catch (err) {
            console.error('[team_home] Error cargando datos:', err);
            const msg = `<p style="color:var(--danger); font-size:0.88rem;">Error al cargar datos. Intenta recargar.</p>`;
            const av = container.querySelector('#th-avisos-list');
            const rp = container.querySelector('#th-reportes-list');
            if (av) av.innerHTML = msg;
            if (rp) rp.innerHTML = msg;
        }

        const style = document.createElement('style');
        style.textContent = `
            @keyframes th-fade-in {
                from { opacity:0; transform:translateY(-6px); }
                to { opacity:1; transform:translateY(0); }
            }
        `;
        container.appendChild(style);

        // Realtime auto-refresh
        const _handler = () => window.Views.team_home(container);
        window.addEventListener('sync-data-updated', _handler);
        window._viewCleanup = () => window.removeEventListener('sync-data-updated', _handler);
    };
})();
