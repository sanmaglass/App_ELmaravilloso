// ==========================================
// INTELIGENCIA — Reporte Diario Analytics
// Llama RPC intelligence_report() de Supabase
// ==========================================
window.Views = window.Views || {};

window.Views.intelligence = async (container) => {
    console.log('[INTEL] Vista intelligence iniciada, container:', !!container);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const fmt = (n) => {
        if (typeof window.Utils !== 'undefined' && window.Utils.formatCurrency) {
            return window.Utils.formatCurrency(n);
        }
        n = +n || 0;
        const a = Math.abs(n);
        if (a >= 1e6) return '$' + (n / 1e6).toFixed(2).replace('.', ',') + 'M';
        if (a >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('es-CL') + 'K';
        return '$' + Math.round(a).toLocaleString('es-CL');
    };

    const fmtPct = (n) => {
        n = +n || 0;
        return (n >= 0 ? '+' : '') + n.toFixed(1).replace('.', ',') + '%';
    };

    const fmtDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    };

    const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const hoyCapitalizado = hoy.charAt(0).toUpperCase() + hoy.slice(1);

    // ── Estado de carga ───────────────────────────────────────────────────────
    container.innerHTML = `
        <style>
            /* ── Intelligence View ── */
            .intel-wrap { max-width: 720px; margin: 0 auto; padding: 0 0 60px 0; }

            .intel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
                flex-wrap: wrap;
                gap: 10px;
            }
            .intel-header h1 {
                margin: 0 0 2px 0;
                font-size: 1.15rem;
                font-weight: 800;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 8px;
                letter-spacing: -0.02em;
            }
            .intel-header h1 i { color: #818cf8; font-size: 1.1rem; }
            .intel-header p { margin: 0; color: var(--text-muted); font-size: 0.78rem; }
            .intel-btn-refresh {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                border: 1px solid var(--border);
                background: var(--bg-card);
                color: var(--text-primary);
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
                transition: all 0.15s;
                white-space: nowrap;
            }
            .intel-btn-refresh:hover {
                background: var(--bg-elevated);
                border-color: #818cf8;
                color: #818cf8;
            }
            .intel-btn-refresh.loading i { animation: intel-spin 0.8s linear infinite; }
            @keyframes intel-spin { to { transform: rotate(360deg); } }

            /* ── Grid layouts ── */
            .intel-grid-2 {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 12px;
            }
            @media (max-width: 640px) {
                .intel-grid-2 { grid-template-columns: 1fr; }
            }

            /* ── Cards base ── */
            .intel-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                animation: intel-fadeIn 0.3s ease both;
            }
            @keyframes intel-fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .intel-card-full { grid-column: 1 / -1; }

            .intel-card-title {
                font-size: 0.7rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--text-muted);
                margin: 0 0 10px 0;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .intel-card-title i { font-size: 0.9rem; }

            /* ── Métricas grandes ── */
            .intel-metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
            @media (max-width: 700px) { .intel-metric-grid { grid-template-columns: repeat(2, 1fr); } }

            .intel-metric {
                background: var(--bg-elevated);
                border-radius: 8px;
                padding: 10px 12px;
            }
            .intel-metric-label {
                font-size: 0.65rem;
                color: var(--text-muted);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 3px;
            }
            .intel-metric-val {
                font-size: 1.15rem;
                font-weight: 800;
                color: var(--text-primary);
                font-variant-numeric: tabular-nums;
                letter-spacing: -0.02em;
                line-height: 1.1;
            }
            .intel-metric-sub {
                font-size: 0.68rem;
                color: var(--text-muted);
                margin-top: 2px;
            }

            /* ── Badges ── */
            .intel-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 8px;
                border-radius: 20px;
                font-size: 0.72rem;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }
            .intel-badge-green  { background: rgba(16,185,129,0.12); color: #10b981; }
            .intel-badge-red    { background: rgba(239,68,68,0.12);  color: #ef4444; }
            .intel-badge-yellow { background: rgba(245,158,11,0.12); color: #f59e0b; }
            .intel-badge-blue   { background: rgba(99,102,241,0.12); color: #6366f1; }
            .intel-badge-muted  { background: var(--bg-elevated);    color: var(--text-muted); }

            /* ── Barra de progreso ── */
            .intel-progress-wrap { margin: 10px 0 6px; }
            .intel-progress-track {
                height: 8px;
                background: var(--bg-elevated);
                border-radius: 99px;
                overflow: hidden;
            }
            .intel-progress-bar {
                height: 100%;
                border-radius: 99px;
                transition: width 0.8s cubic-bezier(0.23, 1, 0.32, 1);
            }
            .intel-progress-label {
                display: flex;
                justify-content: space-between;
                font-size: 0.72rem;
                color: var(--text-muted);
                margin-top: 5px;
                font-variant-numeric: tabular-nums;
            }

            /* ── Listas de productos ── */
            .intel-product-list { display: flex; flex-direction: column; gap: 5px; }
            .intel-product-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                background: var(--bg-elevated);
                border-radius: 8px;
                transition: background 0.12s;
            }
            .intel-product-row:hover { background: var(--bg-card); filter: brightness(1.05); }
            .intel-product-rank {
                width: 22px;
                text-align: center;
                font-size: 0.72rem;
                font-weight: 800;
                color: var(--text-muted);
                flex-shrink: 0;
            }
            .intel-product-name {
                flex: 1;
                font-size: 0.78rem;
                font-weight: 600;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .intel-product-meta {
                font-size: 0.72rem;
                color: var(--text-muted);
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .intel-product-bar-wrap {
                width: 60px;
                height: 4px;
                background: var(--bg-elevated);
                border-radius: 99px;
                overflow: hidden;
                flex-shrink: 0;
            }
            .intel-product-bar {
                height: 100%;
                border-radius: 99px;
                background: #6366f1;
            }

            /* ── Alertas ── */
            .intel-alert-card {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid rgba(239,68,68,0.2);
                background: rgba(239,68,68,0.03);
                margin-bottom: 6px;
            }
            .intel-alert-card i { color: #ef4444; font-size: 0.95rem; flex-shrink: 0; margin-top: 1px; }
            .intel-alert-card .intel-product-name { font-size: 0.78rem; }

            /* ── Cross-selling ── */
            .intel-cross-card {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: var(--bg-elevated);
                border-radius: 8px;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }
            .intel-cross-name {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-primary);
                flex: 1;
                min-width: 70px;
            }
            .intel-cross-link { color: #6366f1; font-size: 0.9rem; flex-shrink: 0; }
            .intel-cross-pct {
                font-size: 0.75rem;
                font-weight: 700;
                color: #6366f1;
                white-space: nowrap;
            }
            .intel-cross-desc {
                font-size: 0.72rem;
                color: var(--text-muted);
                width: 100%;
                padding-top: 2px;
            }

            /* ── Muertos ── */
            .intel-dead-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                background: var(--bg-elevated);
                border-radius: 9px;
                margin-bottom: 6px;
                opacity: 0.85;
            }
            .intel-dead-row i { color: #6b7280; flex-shrink: 0; }

            /* ── Tip del día ── */
            .intel-tip-card {
                background: linear-gradient(135deg, #312e81 0%, #4c1d95 50%, #1e1b4b 100%);
                border: 1px solid rgba(129,140,248,0.25);
                border-radius: 12px;
                padding: 14px 16px;
                margin-bottom: 12px;
                display: flex;
                gap: 12px;
                align-items: flex-start;
                animation: intel-fadeIn 0.3s ease both;
            }
            body:not(.dark-mode) .intel-tip-card {
                background: linear-gradient(135deg, #4338ca 0%, #6d28d9 50%, #3730a3 100%);
            }
            .intel-tip-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: rgba(255,255,255,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .intel-tip-icon i { color: #fde68a; font-size: 1.1rem; }
            .intel-tip-label {
                font-size: 0.62rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: rgba(255,255,255,0.55);
                margin-bottom: 4px;
            }
            .intel-tip-text {
                font-size: 0.82rem;
                color: #fff;
                line-height: 1.5;
                font-weight: 500;
            }

            /* ── Empty/ok states ── */
            .intel-empty {
                text-align: center;
                padding: 20px 16px;
                color: var(--text-muted);
                font-size: 0.85rem;
            }
            .intel-ok-state {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #10b981;
                font-size: 0.85rem;
                font-weight: 600;
                padding: 10px 0;
            }
            .intel-ok-state i { font-size: 1.1rem; }

            /* ── Tendencia semanal ── */
            .intel-compare-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .intel-compare-col { text-align: center; flex: 1; }
            .intel-compare-val {
                font-size: 1.05rem;
                font-weight: 800;
                font-variant-numeric: tabular-nums;
                color: var(--text-primary);
            }
            .intel-compare-lbl {
                font-size: 0.7rem;
                color: var(--text-muted);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-top: 2px;
            }
            .intel-compare-arrow {
                font-size: 1.6rem;
                font-weight: 900;
                flex: 0 0 auto;
                padding: 0 8px;
            }

            /* ── Spinner carga ── */
            .intel-loader {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 80px 0;
                gap: 14px;
                color: var(--text-muted);
                font-size: 0.9rem;
            }
            .intel-spinner {
                width: 36px;
                height: 36px;
                border: 3px solid var(--border);
                border-top-color: #818cf8;
                border-radius: 50%;
                animation: intel-spin 0.7s linear infinite;
            }

            /* ── Error ── */
            .intel-error {
                text-align: center;
                padding: 60px 24px;
            }
            .intel-error i { font-size: 2.5rem; color: #ef4444; margin-bottom: 12px; display: block; }
            .intel-error h3 { color: var(--text-primary); margin: 0 0 6px; }
            .intel-error p { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 18px; }
            .intel-btn-retry {
                padding: 9px 20px;
                background: #6366f1;
                color: #fff;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.85rem;
                transition: background 0.15s;
            }
            .intel-btn-retry:hover { background: #4f46e5; }
        </style>

        <div class="intel-wrap">
            <div class="intel-header">
                <div>
                    <h1><i class="ph ph-brain"></i> Inteligencia</h1>
                    <p>${hoyCapitalizado}</p>
                    <p id="intel-cache-ts" style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Refrescos: 10:00 · 13:00 · 19:00</p>
                </div>
                <button class="intel-btn-refresh" id="intel-refresh-btn">
                    <i class="ph ph-arrows-clockwise"></i> Actualizar
                </button>
            </div>
            <div id="intel-body">
                <div class="intel-loader">
                    <div class="intel-spinner"></div>
                    <span>Cargando reporte de inteligencia…</span>
                </div>
            </div>
        </div>
    `;

    // ── Caché por ventanas horarias (10:00, 13:00, 19:00) ────────────────
    // Solo consulta Supabase cuando se cruza la siguiente ventana.
    // Entre ventanas muestra datos cacheados en localStorage.
    const CACHE_KEY = 'intel_report_cache';
    const VENTANAS = [10, 13, 19]; // horas de refresco (Chile local)

    function getVentanaActual() {
        const h = new Date().getHours();
        // Buscar la última ventana que ya pasó
        for (let i = VENTANAS.length - 1; i >= 0; i--) {
            if (h >= VENTANAS[i]) return { ventana: VENTANAS[i], index: i };
        }
        // Antes de las 10 → usar ventana de las 19 del día anterior
        return { ventana: 19, index: VENTANAS.length - 1 };
    }

    function necesitaRefrescar() {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (!cached || !cached._ts || !cached._ventana) return true;

            const ahora = new Date();
            const cacheDate = new Date(cached._ts);
            const { ventana } = getVentanaActual();

            // Si la ventana actual es distinta a la cacheada → refrescar
            if (cached._ventana !== ventana) return true;

            // Si el caché es de otro día → refrescar
            if (cacheDate.toDateString() !== ahora.toDateString()) {
                // Excepción: si estamos antes de las 10 y el caché es de las 19 de ayer, OK
                if (ahora.getHours() < 10 && cached._ventana === 19) return false;
                return true;
            }

            return false;
        } catch { return true; }
    }

    function leerCache() {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (cached && cached.data) return cached.data;
        } catch { /* corrupto */ }
        return null;
    }

    function guardarCache(data) {
        const { ventana } = getVentanaActual();
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                _ts: new Date().toISOString(),
                _ventana: ventana
            }));
        } catch { /* quota */ }
    }

    // ── Función de render principal ────────────────────────────────────────
    async function loadAndRender(forceRefresh = false) {
        console.log('[INTEL] loadAndRender llamado, forceRefresh:', forceRefresh);
        const body = document.getElementById('intel-body');
        const btn  = document.getElementById('intel-refresh-btn');
        if (!body) { console.error('[INTEL] intel-body NO encontrado en DOM'); return; }

        // ¿Tenemos caché válido?
        if (!forceRefresh && !necesitaRefrescar()) {
            const cached = leerCache();
            if (cached) {
                const { ventana } = getVentanaActual();
                const proxVentana = VENTANAS.find(v => v > new Date().getHours()) || VENTANAS[0];
                body.innerHTML = renderIntelligence(cached);
                // Mostrar hora del último refresco
                const tsEl = document.getElementById('intel-cache-ts');
                if (tsEl) tsEl.textContent = `Actualizado a las ${ventana}:00 · Próximo a las ${proxVentana}:00`;
                document.getElementById('intel-refresh-btn')?.addEventListener('click', () => loadAndRender(true));
                return;
            }
        }

        // Estado cargando
        body.innerHTML = `<div class="intel-loader"><div class="intel-spinner"></div><span>Consultando datos frescos…</span></div>`;
        if (btn) { btn.classList.add('loading'); btn.disabled = true; }

        let data, err;
        try {
            const client = window.SyncV2?.client || window.Sync?.client || null;
            console.log('[INTEL] Cliente Supabase:', client ? 'encontrado' : 'NULL — creando nuevo');
            const sb = client || window.supabase.createClient(window.AppConfig.supabaseUrl, window.AppConfig.supabaseKey);
            console.log('[INTEL] Llamando RPC intelligence_report...');
            const res = await sb.rpc('intelligence_report');
            console.log('[INTEL] RPC respuesta:', { data: !!res.data, error: res.error });
            data = res.data;
            err  = res.error;
        } catch (e) {
            console.error('[INTEL] Excepción en RPC:', e);
            err = e;
        }

        if (btn) { btn.classList.remove('loading'); btn.disabled = false; }

        if (err || !data) {
            // Si falló pero hay caché viejo, mostrar eso
            const fallback = leerCache();
            if (fallback) {
                body.innerHTML = renderIntelligence(fallback);
                const tsEl = document.getElementById('intel-cache-ts');
                if (tsEl) tsEl.textContent = '⚠ Datos cacheados (falló la actualización)';
                document.getElementById('intel-refresh-btn')?.addEventListener('click', () => loadAndRender(true));
                return;
            }
            body.innerHTML = `
                <div class="intel-error">
                    <i class="ph ph-warning-circle"></i>
                    <h3>No se pudo cargar el reporte</h3>
                    <p>${err?.message || 'Error al llamar intelligence_report().'}</p>
                    <button class="intel-btn-retry" id="intel-retry-btn">
                        <i class="ph ph-arrows-clockwise"></i> Reintentar
                    </button>
                </div>`;
            document.getElementById('intel-retry-btn')?.addEventListener('click', () => loadAndRender(true));
            return;
        }

        // Guardar en caché y renderizar
        guardarCache(data);
        body.innerHTML = renderIntelligence(data);
        const { ventana } = getVentanaActual();
        const proxVentana = VENTANAS.find(v => v > new Date().getHours()) || VENTANAS[0];
        const tsEl = document.getElementById('intel-cache-ts');
        if (tsEl) tsEl.textContent = `Actualizado ahora (${ventana}:00) · Próximo a las ${proxVentana}:00`;
        document.getElementById('intel-refresh-btn')?.addEventListener('click', () => loadAndRender(true));
    }

    // ── Render del contenido ───────────────────────────────────────────────
    function renderIntelligence(d) {
        const p   = d.pulso_ayer         || {};
        const mes = d.acumulado_mes      || {};
        const mrg = d.margen_actual      || {};
        const met = d.meta_hoy           || {};
        const sem = d.comparacion_semanal|| {};
        const top5         = d.top5_ayer         || [];
        const alertas      = d.alertas_margen    || [];
        const subiendo     = d.productos_subiendo|| [];
        const cayendo      = d.productos_cayendo || [];
        const cross        = d.cross_selling     || [];
        const muertos      = d.productos_muertos || [];
        const tip          = d.tip_del_dia       || '';

        // ── helpers locales ──
        const signBadge = (pct, invertir = false) => {
            const v = +pct || 0;
            const pos = invertir ? v < 0 : v >= 0;
            const cls = pos ? 'intel-badge-green' : 'intel-badge-red';
            const ico = pos ? 'ph-trend-up' : 'ph-trend-down';
            return `<span class="intel-badge ${cls}"><i class="ph ${ico}"></i>${fmtPct(v)}</span>`;
        };

        const progressColor = (pct) => {
            if (pct >= 80) return '#10b981';
            if (pct >= 50) return '#f59e0b';
            return '#ef4444';
        };

        // ── 1. Pulso de ayer ────────────────────────────────────────────────
        const vsProm = +p.vs_promedio_pct || 0;
        const secPulso = `
        <div class="intel-card" style="animation-delay:0.04s">
            <p class="intel-card-title"><i class="ph ph-heartbeat" style="color:#f43f5e;"></i> Pulso de Ayer</p>
            <div class="intel-metric-grid" style="margin-bottom:14px;">
                <div class="intel-metric">
                    <div class="intel-metric-label">Venta</div>
                    <div class="intel-metric-val">${fmt(p.venta)}</div>
                    <div class="intel-metric-sub">${signBadge(vsProm)} vs prom. 30d</div>
                </div>
                <div class="intel-metric">
                    <div class="intel-metric-label">Ganancia</div>
                    <div class="intel-metric-val">${fmt(p.ganancia)}</div>
                    <div class="intel-metric-sub" style="color:var(--text-muted);">Margen ${(+p.margen_pct||0).toFixed(1)}%</div>
                </div>
                <div class="intel-metric">
                    <div class="intel-metric-label">Tickets</div>
                    <div class="intel-metric-val">${+p.tickets||0}</div>
                    <div class="intel-metric-sub" style="color:var(--text-muted);">boletas</div>
                </div>
                <div class="intel-metric">
                    <div class="intel-metric-label">Ticket Prom.</div>
                    <div class="intel-metric-val">${fmt(p.ticket_promedio)}</div>
                    <div class="intel-metric-sub" style="color:var(--text-muted);">por venta</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:0.78rem; color:var(--text-muted);">Promedio 30 días:</span>
                <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums;">${fmt(p.promedio_30d)}</span>
                ${signBadge(vsProm)}
            </div>
        </div>`;

        // ── 2. Meta de Hoy ──────────────────────────────────────────────────
        const metaPct   = Math.min(100, +met.pct_avance || 0);
        const metaColor = progressColor(metaPct);
        const secMeta = `
        <div class="intel-card" style="animation-delay:0.08s">
            <p class="intel-card-title"><i class="ph ph-target" style="color:#f59e0b;"></i> Meta de Hoy</p>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; flex-wrap:wrap; gap:8px;">
                <div>
                    <span style="font-size:1.4rem; font-weight:900; color:${metaColor}; font-variant-numeric:tabular-nums;">${fmt(met.vendido_hoy)}</span>
                    <span style="font-size:0.78rem; color:var(--text-muted);"> / ${fmt(met.meta)}</span>
                </div>
                <span class="intel-badge" style="background:${metaColor}22; color:${metaColor}; font-size:0.85rem; font-weight:800; padding:4px 10px;">
                    ${metaPct.toFixed(0)}%
                </span>
            </div>
            <div class="intel-progress-wrap">
                <div class="intel-progress-track">
                    <div class="intel-progress-bar" style="width:${metaPct}%; background:${metaColor};"></div>
                </div>
                <div class="intel-progress-label">
                    <span>Vendido hoy</span>
                    <span style="color:${+met.faltan > 0 ? '#ef4444' : '#10b981'}">
                        ${+met.faltan > 0 ? 'Faltan ' + fmt(met.faltan) : '¡Meta superada!'}
                    </span>
                </div>
            </div>
        </div>`;

        // ── 3. Acumulado del Mes ────────────────────────────────────────────
        const diasMes   = (+mes.dias_transcurridos || 0) + (+mes.dias_restantes || 0) || 30;
        const mesPct    = Math.min(100, Math.round(((+mes.dias_transcurridos || 0) / diasMes) * 100));
        const secAcum = `
        <div class="intel-card" style="animation-delay:0.12s">
            <p class="intel-card-title"><i class="ph ph-calendar-check" style="color:#6366f1;"></i> Acumulado del Mes</p>
            <div class="intel-grid-2" style="margin-bottom:12px; gap:10px;">
                <div class="intel-metric">
                    <div class="intel-metric-label">Venta acumulada</div>
                    <div class="intel-metric-val">${fmt(mes.venta)}</div>
                </div>
                <div class="intel-metric">
                    <div class="intel-metric-label">Proyección cierre</div>
                    <div class="intel-metric-val" style="color:#6366f1;">${fmt(mes.proyeccion_cierre)}</div>
                </div>
                <div class="intel-metric">
                    <div class="intel-metric-label">Ganancia mes</div>
                    <div class="intel-metric-val">${fmt(mes.ganancia)}</div>
                </div>
                <div class="intel-metric">
                    <div class="intel-metric-label">Días restantes</div>
                    <div class="intel-metric-val">${+mes.dias_restantes || 0}</div>
                    <div class="intel-metric-sub">Meta diaria: ${fmt(mes.meta_diaria)}</div>
                </div>
            </div>
            <div class="intel-progress-wrap">
                <div class="intel-progress-track">
                    <div class="intel-progress-bar" style="width:${mesPct}%; background:#6366f1;"></div>
                </div>
                <div class="intel-progress-label">
                    <span>Día ${+mes.dias_transcurridos||0}</span>
                    <span>Día ${diasMes}</span>
                </div>
            </div>
        </div>`;

        // ── 4. Comparación semanal ──────────────────────────────────────────
        const semDelta   = +sem.delta_pct || 0;
        const semArrow   = semDelta >= 0 ? '↑' : '↓';
        const semColor   = semDelta >= 0 ? '#10b981' : '#ef4444';
        const secSemanal = `
        <div class="intel-card" style="animation-delay:0.14s">
            <p class="intel-card-title"><i class="ph ph-chart-bar" style="color:#0ea5e9;"></i> Esta Semana vs Anterior</p>
            <div class="intel-compare-row">
                <div class="intel-compare-col">
                    <div class="intel-compare-val">${fmt(sem.venta_anterior)}</div>
                    <div class="intel-compare-lbl">Semana anterior</div>
                </div>
                <div class="intel-compare-arrow" style="color:${semColor};">${semArrow}</div>
                <div class="intel-compare-col">
                    <div class="intel-compare-val" style="color:${semColor};">${fmt(sem.venta_esta)}</div>
                    <div class="intel-compare-lbl">Esta semana</div>
                </div>
            </div>
            <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap; padding-top:8px; border-top:1px solid var(--border);">
                <div style="text-align:center;">
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:2px;">VENTAS DELTA</div>
                    <span class="intel-badge" style="background:${semColor}1a; color:${semColor}; font-weight:800;">${semArrow} ${Math.abs(semDelta).toFixed(1)}%</span>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:2px;">GANANCIA ESTA</div>
                    <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">${fmt(sem.ganancia_esta)}</span>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:2px;">GANANCIA ANT.</div>
                    <span style="font-size:0.85rem; font-weight:700; color:var(--text-muted);">${fmt(sem.ganancia_anterior)}</span>
                </div>
            </div>
        </div>`;

        // ── 5. Margen Actual ────────────────────────────────────────────────
        const mrgActual   = +mrg.margen_7d || 0;
        const mrgAnterior = +mrg.margen_7d_anterior || 0;
        const mrgDelta    = mrgActual - mrgAnterior;
        const mrgColor    = mrgDelta >= 0 ? '#10b981' : '#ef4444';
        const mrgIco      = mrgDelta >= 0 ? 'ph-trend-up' : 'ph-trend-down';
        const secMargen = `
        <div class="intel-card" style="animation-delay:0.16s">
            <p class="intel-card-title"><i class="ph ph-percent" style="color:#a78bfa;"></i> Margen Últimos 7 Días</p>
            <div style="display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
                <span style="font-size:1.6rem; font-weight:900; color:${mrgColor}; font-variant-numeric:tabular-nums;">${mrgActual.toFixed(1)}%</span>
                <span class="intel-badge" style="background:${mrgColor}1a; color:${mrgColor};">
                    <i class="ph ${mrgIco}"></i> vs ${mrgAnterior.toFixed(1)}%
                </span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted);">
                Ganancia 7d: <strong style="color:var(--text-primary); font-variant-numeric:tabular-nums;">${fmt(mrg.ganancia_7d)}</strong>
                &nbsp;·&nbsp; Tendencia: <strong style="color:${mrgColor};">${mrg.tendencia || (mrgDelta>=0?'subiendo':'bajando')}</strong>
            </div>
        </div>`;

        // ── 6. Top 5 de Ayer ────────────────────────────────────────────────
        const maxRevTop5  = Math.max(...top5.map(t => +t.revenue||0), 1);
        const rowsTop5    = top5.length === 0
            ? `<div class="intel-empty">Sin ventas ayer registradas.</div>`
            : top5.map((t, i) => {
                const pct = Math.round(((+t.revenue||0) / maxRevTop5) * 100);
                const mColor = +t.margen_pct >= 20 ? '#10b981' : +t.margen_pct >= 10 ? '#f59e0b' : '#ef4444';
                return `
                <div class="intel-product-row" style="animation-delay:${0.04*i}s">
                    <span class="intel-product-rank" style="color:${i===0?'#f59e0b':i===1?'#94a3b8':'var(--text-muted)'};">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                    <span class="intel-product-name">${t.producto || '—'}</span>
                    <div class="intel-product-bar-wrap"><div class="intel-product-bar" style="width:${pct}%; background:#6366f1;"></div></div>
                    <span class="intel-product-meta">${fmt(t.revenue)}</span>
                    <span class="intel-badge" style="background:${mColor}1a; color:${mColor}; flex-shrink:0;">${(+t.margen_pct||0).toFixed(0)}%</span>
                </div>`;
            }).join('');

        const secTop5 = `
        <div class="intel-card" style="animation-delay:0.18s">
            <p class="intel-card-title"><i class="ph ph-trophy" style="color:#f59e0b;"></i> Top 5 de Ayer</p>
            <div class="intel-product-list">${rowsTop5}</div>
        </div>`;

        // ── 7. Alertas de Margen ─────────────────────────────────────────────
        const rowsAlertas = alertas.length === 0
            ? `<div class="intel-ok-state"><i class="ph ph-check-circle"></i> Sin alertas de margen. ¡Todo bien!</div>`
            : alertas.map(a => `
                <div class="intel-alert-card">
                    <i class="ph ph-warning"></i>
                    <div style="flex:1;">
                        <div class="intel-product-name" style="margin-bottom:3px;">${a.producto || '—'}</div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <span class="intel-badge intel-badge-red">Margen ${(+a.margen_pct||0).toFixed(1)}%</span>
                            <span class="intel-badge intel-badge-muted">Rev. ${fmt(a.revenue_7d)}</span>
                            <span class="intel-badge intel-badge-muted">${+a.tickets||0} tickets</span>
                        </div>
                    </div>
                </div>`).join('');

        const secAlertas = `
        <div class="intel-card" style="animation-delay:0.20s; border-color:${alertas.length ? 'rgba(239,68,68,0.3)' : 'var(--border)'};">
            <p class="intel-card-title"><i class="ph ph-siren" style="color:#ef4444;"></i> Alertas de Margen</p>
            ${rowsAlertas}
        </div>`;

        // ── 8. Subiendo ──────────────────────────────────────────────────────
        const rowsSubiendo = subiendo.length === 0
            ? `<div class="intel-empty">Sin datos de subida de productos.</div>`
            : subiendo.map((s, i) => `
                <div class="intel-product-row" style="animation-delay:${0.03*i}s">
                    <i class="ph ph-trend-up" style="color:#10b981; flex-shrink:0;"></i>
                    <span class="intel-product-name">${s.producto || '—'}</span>
                    <span class="intel-badge intel-badge-green">+${+s.delta||0} tickets</span>
                    <span class="intel-product-meta">${fmt(s.revenue_ahora)}</span>
                </div>`).join('');

        const secSubiendo = `
        <div class="intel-card" style="animation-delay:0.22s">
            <p class="intel-card-title"><i class="ph ph-rocket-launch" style="color:#10b981;"></i> Productos Subiendo</p>
            <div class="intel-product-list">${rowsSubiendo}</div>
        </div>`;

        // ── 9. Cayendo ───────────────────────────────────────────────────────
        const rowsCayendo = cayendo.length === 0
            ? `<div class="intel-empty">Sin productos en caída detectada.</div>`
            : cayendo.map((c, i) => `
                <div class="intel-product-row" style="animation-delay:${0.03*i}s; background:rgba(239,68,68,0.04);">
                    <i class="ph ph-trend-down" style="color:#ef4444; flex-shrink:0;"></i>
                    <span class="intel-product-name">${c.producto || '—'}</span>
                    <span class="intel-badge intel-badge-red">${+c.delta||0} tickets</span>
                    <span class="intel-product-meta" style="color:#ef4444;">${fmt(c.revenue_perdido)} perdido</span>
                </div>`).join('');

        const secCayendo = `
        <div class="intel-card" style="animation-delay:0.24s; border-color:${cayendo.length ? 'rgba(239,68,68,0.2)' : 'var(--border)'};">
            <p class="intel-card-title"><i class="ph ph-arrow-fat-down" style="color:#ef4444;"></i> Productos Cayendo</p>
            <div class="intel-product-list">${rowsCayendo}</div>
        </div>`;

        // ── 10. Cross-selling ─────────────────────────────────────────────────
        const rowsCross = cross.length === 0
            ? `<div class="intel-empty">Sin patrones de combos detectados aún.</div>`
            : cross.map((c, i) => `
                <div class="intel-cross-card" style="animation-delay:${0.03*i}s">
                    <span class="intel-cross-name">${c.producto_a || '—'}</span>
                    <i class="ph ph-link intel-cross-link"></i>
                    <span class="intel-cross-name" style="text-align:right;">${c.producto_b || '—'}</span>
                    <span class="intel-cross-pct">${+c.veces||0}×</span>
                    <span class="intel-cross-desc">
                        ${+c.pct_a ? Math.round(+c.pct_a) + '% de quienes compran ' + (c.producto_a||'A') + ' también llevan ' + (c.producto_b||'B') : ''}
                    </span>
                </div>`).join('');

        const secCross = `
        <div class="intel-card" style="animation-delay:0.26s">
            <p class="intel-card-title"><i class="ph ph-shopping-cart-simple" style="color:#f59e0b;"></i> Combos Frecuentes</p>
            ${rowsCross}
        </div>`;

        // ── 11. Productos Muertos ─────────────────────────────────────────────
        const rowsMuertos = muertos.length === 0
            ? `<div class="intel-ok-state"><i class="ph ph-check-circle"></i> Sin productos inactivos. ¡Catálogo vivo!</div>`
            : muertos.map((m, i) => `
                <div class="intel-dead-row" style="animation-delay:${0.03*i}s">
                    <i class="ph ph-skull"></i>
                    <span class="intel-product-name">${m.producto || '—'}</span>
                    <div style="text-align:right; flex-shrink:0;">
                        <div class="intel-product-meta">Última venta: ${fmtDate(m.ultima_venta)}</div>
                        <div class="intel-product-meta">${+m.tickets_historicos||0} tickets · ${fmt(m.revenue_historico)}</div>
                    </div>
                </div>`).join('');

        const secMuertos = `
        <div class="intel-card" style="animation-delay:0.28s">
            <p class="intel-card-title"><i class="ph ph-skull" style="color:#6b7280;"></i> Productos Muertos</p>
            <div class="intel-product-list">${rowsMuertos}</div>
        </div>`;

        // ── 12. Tip del día ───────────────────────────────────────────────────
        const secTip = tip ? `
        <div class="intel-tip-card" style="animation-delay:0.30s">
            <div class="intel-tip-icon"><i class="ph ph-lightbulb"></i></div>
            <div>
                <div class="intel-tip-label">Tip del Día</div>
                <div class="intel-tip-text">${tip}</div>
            </div>
        </div>` : '';

        // ── Composición final ─────────────────────────────────────────────────
        return `
            ${secTip}
            ${secPulso}
            <div class="intel-grid-2">
                ${secMeta}
                ${secMargen}
            </div>
            ${secAcum}
            ${secSemanal}
            ${secTop5}
            <div class="intel-grid-2">
                ${secSubiendo}
                ${secCayendo}
            </div>
            ${secAlertas}
            ${secCross}
            ${secMuertos}
        `;
    }

    // ── Arranque ──────────────────────────────────────────────────────────────
    await loadAndRender();
};
