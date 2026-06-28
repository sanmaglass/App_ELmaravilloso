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
            const labels = { factura_upload: 'Subir factura', announcements: 'Avisos', team_reports: 'Mis Reportes', caja_dia: 'Caja del Día', team_home: 'Inicio', suggestions: 'Mejoras' };
            window.navigateToView(view, labels[view] || '');
            return;
        }
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) btn.click();
    }

    // Mapa de íconos a paleta pastel (v1 cálido)
    function iconChipStyle(icon) {
        if (icon.includes('wallet'))          return 'background:#fff0e8; color:#f08a5d;';
        if (icon.includes('broom'))           return 'background:#eafaf0; color:#4cae7a;';
        if (icon.includes('sparkle'))         return 'background:#fef3f2; color:#e8654e;';
        if (icon.includes('package'))         return 'background:#f3eefc; color:#9b6dd6;';
        if (icon.includes('tag'))             return 'background:#fff8e1; color:#e6a817;';
        if (icon.includes('calendar'))        return 'background:#e8f5e9; color:#43a05b;';
        if (icon.includes('pencil'))          return 'background:#fff3e0; color:#ef8c2c;';
        if (icon.includes('trash'))           return 'background:#fce4ec; color:#d95577;';
        if (icon.includes('lightning'))       return 'background:#fffde7; color:#c8a800;';
        if (icon.includes('lock'))            return 'background:#ede7f6; color:#7b52c7;';
        if (icon.includes('toilet'))          return 'background:#e8f5e9; color:#43a05b;';
        return 'background:#f3eefc; color:#9b6dd6;';
    }

    window.Views.team_home = async (container) => {
        const userId   = window.Auth?.session?.user?.id;
        const email    = window.Auth?.session?.user?.email || '';
        const nombre   = nombreDesdeEmail(email);
        const tenantId = window.Auth?.getTenantId();
        const hoy      = formatFechaChile(chileNow());
        const clTypeLabel = getChecklistType() === 'apertura' ? 'Apertura' : 'Cierre';

        // Esqueleto base — estilo pulido v2 (Fraunces + anillo héroe 78px)
        const inicial = nombre.charAt(0).toUpperCase();
        const svgGradId = 'th-ring-grad';
        container.innerHTML = `
            <div style="
                max-width:680px; margin:0 auto; padding:26px 20px 96px;
                min-height:100vh;
                background:
                    radial-gradient(120% 80% at 100% 0%,#ffe9da 0%,rgba(255,233,218,0) 55%),
                    radial-gradient(120% 70% at 0% 8%,#ffe1ea 0%,rgba(255,225,234,0) 50%),
                    linear-gradient(178deg,#fff7f0 0%,#fdeef0 46%,#f6eefb 100%);
            ">

                <!-- Saludo -->
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:7px;">
                    <div>
                        <div style="font-size:12.5px; color:#bb8e74; font-weight:700; letter-spacing:.3px; text-transform:capitalize;">
                            ${hoy}
                        </div>
                        <div style="font-family:'Fraunces',serif; font-size:33px; font-weight:600; color:#3a2a28;
                                    line-height:1.05; letter-spacing:-.5px; margin-top:3px;">
                            ${saludoContextual()},<br><span style="font-style:italic; color:#e8654e;">${window.escapeHTML(nombre)}</span>
                        </div>
                    </div>
                    <div style="width:42px; height:42px; border-radius:14px;
                                background:linear-gradient(135deg,#ff9e7d,#ff7a98);
                                display:flex; align-items:center; justify-content:center;
                                color:#fff; font-weight:800; font-size:16px;
                                font-family:'Fraunces',serif;
                                box-shadow:0 6px 16px rgba(255,122,152,.34); flex-shrink:0;">
                        ${inicial}
                    </div>
                </div>
                <div style="font-size:14px; color:#a18a7e; font-weight:600; margin-bottom:22px;">Que tengas un lindo turno ✨</div>

                <!-- Anillo héroe -->
                <div id="th-ring" style="
                    background:linear-gradient(135deg,#fff,#fff6f1);
                    border-radius:26px; padding:20px;
                    display:flex; align-items:center; gap:18px;
                    box-shadow:0 10px 30px rgba(190,110,80,.13),inset 0 0 0 1px rgba(255,255,255,.7);
                    margin-bottom:26px;
                ">
                    <div style="position:relative; width:78px; height:78px; flex-shrink:0;">
                        <svg width="78" height="78" viewBox="0 0 78 78" style="transform:rotate(-90deg);">
                            <circle cx="39" cy="39" r="33" fill="none" stroke="#f6e2d8" stroke-width="9"/>
                            <circle id="th-ring-arc" cx="39" cy="39" r="33" fill="none"
                                    stroke="url(#${svgGradId})" stroke-width="9" stroke-linecap="round"
                                    stroke-dasharray="207.3" stroke-dashoffset="207.3"
                                    style="transition:stroke-dashoffset 0.5s ease;"/>
                            <defs>
                                <linearGradient id="${svgGradId}" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0" stop-color="#ff9e72"/>
                                    <stop offset="1" stop-color="#ee6a47"/>
                                </linearGradient>
                            </defs>
                        </svg>
                        <div style="position:absolute; inset:0; display:flex; flex-direction:column;
                                    align-items:center; justify-content:center;">
                            <b id="th-ring-frac" style="font-family:'Fraunces',serif; font-size:21px;
                                                        color:#3a2a28; line-height:1;">0/0</b>
                            <span style="font-size:9.5px; color:#bb8e74; font-weight:700;
                                         text-transform:uppercase; letter-spacing:.5px;">tareas</span>
                        </div>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <h4 style="font-family:'Fraunces',serif; font-size:18px; font-weight:600;
                                   color:#3a2a28; margin:0 0 3px;">
                            ${clTypeLabel} en marcha
                        </h4>
                        <p id="th-ring-text" style="font-size:13.5px; color:#a18a7e; font-weight:600; margin:0 0 9px;">Cargando…</p>
                        <span id="th-ring-pill" style="display:inline-flex; align-items:center; gap:5px;
                              background:#fff0e8; color:#e8654e; font-size:11.5px; font-weight:800;
                              padding:4px 11px; border-radius:20px;"></span>
                    </div>
                </div>

                <!-- Checklist del turno -->
                <div style="margin-bottom:22px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin:0 4px 12px;">
                        <span style="display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800;
                                     color:#c08566; text-transform:uppercase; letter-spacing:1px;">
                            <i class="ph-fill ph-list-checks"></i>Tareas de ${clTypeLabel.toLowerCase()}
                        </span>
                        <span id="th-checklist-progress" style="font-size:12px; color:#e8654e; font-weight:700;"></span>
                    </div>
                    <div id="th-checklist" style="
                        background:#fffdfb; border-radius:22px; padding:6px;
                        box-shadow:0 8px 24px rgba(190,110,80,.10),inset 0 0 0 1px rgba(255,240,232,.9);
                    ">
                        <div style="color:#9a8478; font-size:0.88rem; padding:18px 13px;">Cargando…</div>
                    </div>
                </div>

                <!-- Subir factura de mercadería -->
                <div style="margin-bottom:22px;">
                    <button id="th-btn-factura"
                        style="width:100%; padding:18px 19px;
                               background:linear-gradient(135deg,#ff9e72,#f0683f);
                               color:#fff; border:none; border-radius:22px; cursor:pointer;
                               display:flex; align-items:center; gap:15px; position:relative; overflow:hidden;
                               box-shadow:0 14px 30px rgba(240,104,63,.34); transition:opacity 0.15s;">
                        <div style="width:48px; height:48px; background:rgba(255,255,255,0.22); border-radius:15px;
                                    display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:23px;">
                            <i class="ph-fill ph-receipt"></i>
                        </div>
                        <div style="text-align:left; flex:1;">
                            <div style="font-weight:800; font-size:16.5px; letter-spacing:-.2px; margin-bottom:2px;">Subir factura</div>
                            <div style="font-size:13px; opacity:0.92; font-weight:600;">Fotografía cuando llegue mercadería</div>
                        </div>
                        <i class="ph ph-caret-right" style="font-size:20px; opacity:0.85; margin-left:auto;"></i>
                    </button>
                </div>

                <!-- Promo del día -->
                <div id="th-promo-section" style="margin-bottom:22px; display:none;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin:0 4px 12px;">
                        <span style="display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800;
                                     color:#c08566; text-transform:uppercase; letter-spacing:1px;">
                            <i class="ph-fill ph-sparkle"></i>Promo vigente
                        </span>
                    </div>
                    <div id="th-promo-card"></div>
                </div>

                <!-- Avisos recientes -->
                <div style="margin-bottom:22px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin:0 4px 12px;">
                        <span style="display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800;
                                     color:#c08566; text-transform:uppercase; letter-spacing:1px;">
                            <i class="ph-fill ph-megaphone"></i>Avisos
                            <span id="th-avisos-badge" style="display:none; background:#ee7a59; color:#fff; font-size:0.65rem;
                                  padding:2px 8px; border-radius:10px; font-weight:800;"></span>
                        </span>
                        <button class="th-ver-mas" data-nav="announcements"
                            style="font-size:12.5px; color:#e8654e; background:none; border:none; cursor:pointer; padding:0; font-weight:700;">
                            Ver todos →
                        </button>
                    </div>
                    <div id="th-avisos-list">
                        <div style="color:#9a8478; font-size:0.88rem; padding:16px 0;">Cargando avisos…</div>
                    </div>
                </div>

                <!-- Mis reportes recientes -->
                <div style="margin-bottom:22px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin:0 4px 12px;">
                        <span style="display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800;
                                     color:#c08566; text-transform:uppercase; letter-spacing:1px;">
                            <i class="ph-fill ph-clipboard-text"></i>Mis reportes
                        </span>
                        <button class="th-ver-mas" data-nav="team_reports"
                            style="font-size:12.5px; color:#e8654e; background:none; border:none; cursor:pointer; padding:0; font-weight:700;">
                            Ver todos →
                        </button>
                    </div>
                    <div id="th-reportes-list">
                        <div style="color:#9a8478; font-size:0.88rem; padding:16px 0;">Cargando reportes…</div>
                    </div>
                </div>

                <!-- Sugerir mejoras -->
                <div style="margin-bottom:16px;">
                    <button id="th-btn-mejoras"
                        style="width:100%; padding:16px 18px; background:#fffdfb;
                               border:none; border-radius:22px; cursor:pointer;
                               display:flex; align-items:center; gap:14px;
                               box-shadow:0 8px 22px rgba(190,110,80,.09),inset 0 0 0 1px rgba(255,240,232,.9);
                               transition:opacity 0.15s;">
                        <div style="width:40px; height:40px; background:#f3eefc;
                                    border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="ph-fill ph-lightbulb" style="font-size:1.25rem; color:#9b6dd6;"></i>
                        </div>
                        <div style="text-align:left; flex:1;">
                            <div style="font-weight:800; font-size:14.5px; color:#3a2a28;">Ideas y Mejoras</div>
                            <div style="font-size:12.5px; color:#a18a7e; font-weight:600; margin-top:2px;">Sugiere funciones nuevas para la app</div>
                        </div>
                        <i class="ph ph-caret-right" style="font-size:1.1rem; color:#c9b5ae;"></i>
                    </button>
                </div>

                <!-- Cerrar sesión -->
                <div style="padding-top:4px;">
                    <button id="th-logout" style="width:100%; padding:14px; background:#fffdfb;
                            border:none; border-radius:22px;
                            box-shadow:0 8px 22px rgba(190,110,80,.09),inset 0 0 0 1px rgba(255,240,232,.9);
                            color:#e05050; font-size:0.9rem; font-weight:700; cursor:pointer;
                            display:flex; align-items:center; justify-content:center; gap:8px;
                            transition:opacity 0.15s;">
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

        // Botón mejoras
        const mejorasBtn = container.querySelector('#th-btn-mejoras');
        if (mejorasBtn) {
            mejorasBtn.addEventListener('click', () => navTo('suggestions'));
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
                avisosEl.innerHTML = `<p style="color:#9a8478; font-size:0.88rem; padding:12px 0;">Sin avisos por ahora.</p>`;
            } else {
                avisosEl.innerHTML = avisosRecientes.map((a, idx) => {
                    const noLeido = !leidasPorMi.has(a.id);
                    const esUrgente = a.priority === 'urgente';
                    return `
                    <div style="
                        background:#fffdfb; border-radius:20px; padding:15px 16px;
                        display:flex; gap:13px; align-items:flex-start; cursor:pointer;
                        box-shadow:0 8px 22px rgba(190,110,80,.09),inset 0 0 0 1px rgba(255,240,232,.9);
                        ${idx > 0 ? 'margin-top:9px;' : ''}"
                         class="th-aviso-item" data-nav="announcements">
                        <div style="width:40px; height:40px; border-radius:13px;
                                    background:${esUrgente ? '#ffe6e1' : '#ffe1da'};
                                    color:${esUrgente ? '#e8443a' : '#e8654e'};
                                    display:flex; align-items:center; justify-content:center;
                                    font-size:19px; flex-shrink:0;">
                            <i class="ph-fill ph-megaphone"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            ${esUrgente
                                ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800;
                                              color:#fff; background:linear-gradient(135deg,#ff6b5e,#e8443a);
                                              padding:3px 10px; border-radius:8px; text-transform:uppercase; letter-spacing:.4px;
                                              box-shadow:0 3px 8px rgba(232,68,58,.3); margin-bottom:5px;">
                                       <i class="ph-fill ph-warning-circle"></i> Urgente
                                   </span>`
                                : (noLeido ? `<span style="font-size:0.7rem; font-weight:800; color:#ee7a59; display:block; margin-bottom:3px;">● Nuevo</span>` : '')}
                            <div style="font-size:14.5px; color:#3a2a28; font-weight:800; line-height:1.25; margin-top:${esUrgente ? '0' : '5px'};
                                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${window.escapeHTML(a.title || 'Sin título')}
                            </div>
                            <small style="color:#b3a298; font-size:12px; font-weight:600;">${tiempoRelativo(a.created_at)}</small>
                        </div>
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
                reportesEl.innerHTML = `<p style="color:#9a8478; font-size:0.88rem; padding:12px 0;">Aún no has enviado reportes.</p>`;
            } else {
                reportesEl.innerHTML = misReportes.map((r, idx) => {
                    const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendiente;
                    const tipoLabel = TYPE_LABELS[r.type] || r.type || 'Reporte';
                    return `
                    <div style="background:#fffdfb; border-radius:20px;
                                padding:14px 16px; display:flex; align-items:center; gap:12px;
                                cursor:pointer;
                                box-shadow:0 8px 22px rgba(190,110,80,.09),inset 0 0 0 1px rgba(255,240,232,.9);
                                ${idx > 0 ? 'margin-top:9px;' : ''}"
                         class="th-reporte-item">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:14.5px; color:#3a2a28; font-weight:800;
                                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${window.escapeHTML(r.title || tipoLabel)}
                            </div>
                            <div style="font-size:12px; color:#a18a7e; font-weight:600; margin-top:2px;">
                                ${tipoLabel} · ${tiempoRelativo(r.created_at)}
                            </div>
                        </div>
                        <span style="font-size:11px; font-weight:800; padding:4px 11px; border-radius:9px;
                                     background:${st.bg}; color:${st.color}; white-space:nowrap; flex-shrink:0; margin-left:auto;">
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

            // Helper para actualizar el anillo motivador
            function updateRing(doneCount, total) {
                const ringArc  = container.querySelector('#th-ring-arc');
                const ringFrac = container.querySelector('#th-ring-frac');
                const ringText = container.querySelector('#th-ring-text');
                const ringPill = container.querySelector('#th-ring-pill');
                if (!ringArc || !ringFrac || !ringText) return;
                const circumference = 2 * Math.PI * 33; // r=33 → 207.3
                const pct = total > 0 ? doneCount / total : 0;
                ringArc.style.strokeDashoffset = circumference * (1 - pct);
                ringFrac.textContent = `${doneCount}/${total}`;
                const pending = total - doneCount;
                if (pending === 0) {
                    ringText.textContent = '¡Todo listo! 🎉';
                    ringText.style.color = '#46b07a';
                    if (ringPill) { ringPill.innerHTML = '✅ ¡Completado!'; ringPill.style.background = '#e9f8ef'; ringPill.style.color = '#46b07a'; }
                } else {
                    ringText.textContent = 'Vas bien, sigue así';
                    ringText.style.color = '#a18a7e';
                    if (ringPill) { ringPill.innerHTML = `<i class="ph-fill ph-fire"></i> Te faltan ${pending}`; ringPill.style.background = '#fff0e8'; ringPill.style.color = '#e8654e'; }
                }
            }

            function renderChecklist() {
                const doneCount = clTasks.filter((_, i) => savedItems[i]?.done).length;
                const allDone = doneCount === clTasks.length;
                progressEl.textContent = `${doneCount}/${clTasks.length}`;
                if (allDone) progressEl.style.color = '#4cae7a';
                else progressEl.style.color = '#e08f7e';

                // Actualizar anillo motivador
                updateRing(doneCount, clTasks.length);

                clEl.innerHTML = clTasks.map((t, i) => {
                    const done = savedItems[i]?.done || false;
                    const chipStyle = iconChipStyle(t.icon);
                    return `
                    <div role="button" style="display:flex; align-items:center; gap:13px; padding:13px 13px;
                                  border-radius:16px; cursor:pointer; transition:background 0.15s;
                                  ${i > 0 ? 'border-top:1px solid #fbf0ea;' : ''}
                                  ${done ? 'opacity:.78;' : ''}"
                           data-cl-idx="${i}">
                        <div style="width:25px; height:25px; border-radius:9px; flex-shrink:0;
                                    display:flex; align-items:center; justify-content:center;
                                    ${done
                                        ? 'background:linear-gradient(135deg,#67c98f,#46b07a); color:#fff; font-size:14px; box-shadow:0 3px 8px rgba(70,176,122,.32);'
                                        : 'border:2.5px solid #f1d6cb; background:transparent;'}">
                            ${done ? '<i class="ph-fill ph-check"></i>' : ''}
                            <input type="checkbox" ${done ? 'checked' : ''} data-cl-idx="${i}"
                                   style="position:absolute; opacity:0; width:0; height:0; pointer-events:none;">
                        </div>
                        <div style="width:36px; height:36px; border-radius:12px; flex-shrink:0;
                                    display:flex; align-items:center; justify-content:center; font-size:18px;
                                    ${chipStyle}">
                            <i class="${t.icon}"></i>
                        </div>
                        <span style="font-size:14.5px; color:${done ? '#bcaaa0' : '#46352f'}; font-weight:700; line-height:1.25;
                                     ${done ? 'text-decoration:line-through; text-decoration-color:#e3cabe;' : ''}">${window.escapeHTML(t.task)}</span>
                    </div>`;
                }).join('') + (allDone ? `
                    <div style="padding:14px 16px; text-align:center; background:rgba(103,201,143,0.08); border-radius:0 0 16px 16px;">
                        <span style="font-size:0.88rem; color:#46b07a; font-weight:700;">✅ ¡Todo listo! Buen trabajo</span>
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

                // Toggle al tocar la fila (div, sin <label> nativo → un solo toggle)
                clEl.querySelectorAll('div[data-cl-idx]').forEach(label => {
                    label.addEventListener('click', (e) => {
                        if (e.target.tagName === 'INPUT') return;
                        const idx = label.dataset.clIdx;
                        const cb = label.querySelector(`input[data-cl-idx="${idx}"]`);
                        if (cb) {
                            cb.checked = !cb.checked;
                            cb.dispatchEvent(new Event('change', { bubbles: true }));
                        }
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
                        <div style="background:#fffdfb; border-radius:20px; padding:16px 18px;
                                    box-shadow:0 8px 22px rgba(190,110,80,.09),inset 0 0 0 1px rgba(255,240,232,.9);">
                            <div style="font-size:14.5px; font-weight:800; color:#3a2a28; margin-bottom:5px;
                                        display:flex; align-items:center; gap:8px;">
                                <i class="ph-fill ph-tag" style="color:#e8654e;"></i>
                                ${window.escapeHTML(promo.name || promo.title || 'Promoción')}
                            </div>
                            ${promo.description ? `<div style="font-size:13px; color:#a18a7e; font-weight:600;">${window.escapeHTML(promo.description)}</div>` : ''}
                            ${promo.discount ? `<div style="font-size:22px; font-weight:800; color:#e8654e; margin-top:6px;">${promo.discount}% OFF</div>` : ''}
                        </div>
                    `;
                }
            } catch (e) { /* sin promos, ok */ }

        } catch (err) {
            console.error('[team_home] Error cargando datos:', err);
            const msg = `<p style="color:#e05050; font-size:0.88rem;">Error al cargar datos. Intenta recargar.</p>`;
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
            #th-btn-factura:active, #th-btn-mejoras:active, #th-logout:active { opacity:0.8; }
            #th-btn-factura:hover { opacity:0.93; }
            .th-aviso-item:hover, .th-reporte-item:hover { opacity:0.85; }
        `;
        container.appendChild(style);

        // Realtime auto-refresh
        const _handler = () => window.Views.team_home(container);
        window.addEventListener('sync-data-updated', _handler);
        window._viewCleanup = () => window.removeEventListener('sync-data-updated', _handler);
    };
})();
