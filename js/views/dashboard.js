// ==========================================
// DASHBOARD PRO — Unified View
// Includes: Dashboard + Reports merged
// ==========================================
window.Views = window.Views || {};

window.Views.dashboard = async (container, selectedMonth = null) => {
    // 🔍 SMART REFRESH CHECK: If basic shell already exists, skip innerHTML overwrite
    const isAlreadyRendered = document.getElementById('tab-resumen') !== null;

    if (!isAlreadyRendered) {
        container.innerHTML = `
    <style>
        /* ---- Sub-Tab System ---- */
        .dash-tabs { display:flex; gap:6px; background:rgba(0,0,0,0.04); padding:6px; border-radius:16px; width:fit-content; }
        .dash-tab { padding:9px 22px; border-radius:12px; border:none; background:transparent; font-weight:600; font-size:0.9rem; color:var(--text-muted); cursor:pointer; transition:all 0.25s ease; display:flex; align-items:center; gap:7px; }
        .dash-tab.active { background:white; color:var(--primary); box-shadow:0 2px 12px rgba(0,0,0,0.10); }
        body.dark-mode .dash-tab.active { background:#21262d; color:#e6edf3; }
        body.dark-mode .dash-tabs { background:rgba(255,255,255,0.05); }

        /* ---- Glassmorphism & Premium UI ---- */
        .card { backdrop-filter:blur(10px); background:rgba(255,255,255,0.75); border:1px solid rgba(255,255,255,0.4); box-shadow:0 8px 24px rgba(0,0,0,0.04); transition:all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .card:hover { transform: translateY(-4px); box-shadow: 0 14px 28px rgba(0,0,0,0.08); border-color: rgba(255,255,255,0.6); }
        body.dark-mode .card { background:rgba(30, 41, 59, 0.75); border:1px solid rgba(255,255,255,0.1); }
        body.dark-mode .card:hover { border-color: rgba(255,255,255,0.2); box-shadow: 0 14px 28px rgba(0,0,0,0.3); }
        
        .bg-glass { backdrop-filter:blur(10px); background:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.3); }
        body.dark-mode .bg-glass { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.1); }

        .premium-card { background:var(--bg-card); border-radius:18px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,0.05); transition:all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); border:1px solid rgba(0,0,0,0.02); }
        .premium-card:hover { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(0,0,0,0.08); }

        /* KPI Card Animated */
        .kpi-card { position:relative; overflow:hidden; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .kpi-card:hover { transform:translateY(-2px) scale(1.01); box-shadow:0 12px 40px rgba(0,0,0,0.1); }
        
        .stat-value-mega { font-size: clamp(1.8rem, 4vw, 2.8rem); line-height: 1; font-weight: 900; letter-spacing: -1px; }
        .stat-label-premium { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 4px; }

        /* Card animation */
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .card-anim { animation: slideUp 0.5s ease backwards; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }

        /* ---- Dash Header responsive ---- */
        .dash-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem; }
        .dash-header-btns { display:flex; gap:0.75rem; }

        /* ---- PL Chart container ---- */
        .pl-chart-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        /* ---- Bottom 2-widget row ---- */
        .bottom-widgets-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        /* ---- MOBILE OVERRIDES ---- */
        @media (max-width: 768px) {
            .decision-grid { grid-template-columns: 1fr !important; }
            .pl-chart-grid { grid-template-columns: 1fr; }
            .bottom-widgets-grid { grid-template-columns: 1fr; }
            .dash-header { margin-bottom: 1rem; }
            .premium-card, .card { padding: 14px !important; }
            .text-3xl { font-size: 1.3rem !important; }
            
            /* AI Panel Mobile Adjustments */
            .predict-header { flex-direction: column; align-items: flex-start !important; gap: 16px; }
            .predict-title { font-size: 1.8rem !important; }
            .predict-badge-container { text-align: left !important; width: 100%; display: flex; justify-content: space-between; align-items: center; }
        }

        /* AI Panel Theme Variables */
        :root {
            --ia-panel-bg: linear-gradient(135deg, #1e293b 0%, #020617 100%);
            --ia-panel-text: #ffffff;
            --ia-accent: #818cf8;
            --ia-muted: #94a3b8;
            --ia-glass: rgba(255, 255, 255, 0.05);
        }

        body:not(.dark-mode) {
            --ia-panel-bg: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            --ia-panel-text: #1e293b;
            --ia-accent: #4f46e5;
            --ia-muted: #64748b;
            --ia-glass: rgba(0, 0, 0, 0.03);
        }

        .predict-header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
        .predict-title { margin: 0; font-size: 2.5rem; font-weight: 800; letter-spacing: -1.5px; display: flex; align-items: baseline; gap: 10px; }
        .predict-badge { background: var(--ia-glass); padding: 5px 14px; border-radius: 99px; font-size: 0.7rem; font-weight: 800; color: var(--ia-muted); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(5px); }
        body:not(.dark-mode) .predict-badge { border-color: rgba(0,0,0,0.05); color: var(--ia-accent); }

        /* Responsive Dashboard List Items */
        .dash-list-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed var(--border); transition: background 0.2s; }
        .dash-list-item:hover { background: rgba(0,0,0,0.02); }
        body.dark-mode .dash-list-item:hover { background: rgba(255,255,255,0.03); }
        
        .product-name-wrap { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .product-rank { font-weight: 800; color: var(--text-muted); width: 22px; flex-shrink: 0; font-size: 0.75rem; }
        .product-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .product-name { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }
        .product-meta { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
        .product-stat { font-weight: 800; flex-shrink: 0; padding-left: 12px; font-size: 0.9rem; }
        .badge-pct { padding: 4px 8px; border-radius: 8px; font-weight: 800; font-size: 0.72rem; flex-shrink: 0; margin-left: 10px; white-space: nowrap; }

        @media (max-width: 480px) {
            .product-name { font-size: 0.82rem; }
            .product-stat { font-size: 0.82rem; }
            .badge-pct { padding: 3px 6px; font-size: 0.68rem; margin-left: 6px; }
            .dash-list-item { padding: 8px 0; }
        }

        /* Live Sales Feed — Lista compacta responsive */
        .live-sales-scroller {
            display: flex;
            flex-direction: column;
            gap: 0;
            max-width: 100%;
        }

        .live-ticket-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-bottom: 1px solid rgba(0,0,0,0.04);
            font-size: 0.8rem;
        }
        .live-ticket-row:last-child { border-bottom: none; }
        .live-ticket-row.new { background: rgba(16,185,129,0.04); }

        .live-ticket-left { display:flex; align-items:center; gap:8px; min-width:0; }
        .live-ticket-id { font-weight:700; color:var(--text-primary); white-space:nowrap; }
        .live-ticket-time { color:var(--text-muted); font-size:0.7rem; }
        .live-ticket-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .live-ticket-total { font-weight:800; color:#10b981; }
        .live-ticket-profit { font-size:0.7rem; color:var(--text-muted); }

        /* Horizontal Product Cards (Hooks & Zero Margin) */
        .h-scroll-container {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 10px;
            scrollbar-width: thin;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            cursor: grab;
            max-width: 100%;
            box-sizing: border-box;
        }
        .h-scroll-container.dragging { cursor: grabbing; user-select: none; }
        .h-product-card { min-width: 200px; max-width: 200px; flex-shrink: 0; background: white; padding: 14px; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s; }
        .h-product-card:hover { transform: translateY(-3px); }
        body.dark-mode .h-product-card { background: rgba(255,255,255,0.05); }
        
        .h-product-name { font-weight: 800; font-size: 0.85rem; margin-bottom: 6px; height: 40px; overflow: hidden; color: var(--text-primary); text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2; }
        .h-product-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; }
        .h-product-badge { margin-top: 10px; display: inline-block; padding: 4px 8px; border-radius: 8px; font-weight: 800; font-size: 0.7rem; }

        /* Ajustes Mobile */
        @media (max-width: 768px) {
            .live-ticket-row { padding: 6px 8px; }
            .h-scroll-container { cursor: default; }
        }

        /* ============== CEO COCKPIT ============== */
        .ceo-row-3 { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; }
        @media (max-width: 900px) { .ceo-row-3 { grid-template-columns: 1fr; } }

        .ceo-mini { padding:12px 14px; display:flex; flex-direction:column; gap:3px; }
        .ceo-mini-label { font-size:0.72rem; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; color:var(--text-muted); display:flex; align-items:center; gap:6px; }
        .ceo-mini-value { font-size:1.5rem; font-weight:900; color:var(--text-primary); line-height:1.1; margin-top:4px; letter-spacing:-0.5px; }
        .ceo-mini-sub { font-size:0.78rem; color:var(--text-muted); font-weight:600; }
        .ceo-mini-foot { font-size:0.78rem; font-weight:700; margin-top:8px; }
        .ceo-cash-breakdown { margin-top:10px; display:flex; flex-direction:column; gap:4px; font-size:0.78rem; }
        .ceo-cash-breakdown .row { display:flex; justify-content:space-between; }
        .ceo-cash-breakdown .row b { font-weight:700; }

        .ceo-payment-wrap { display:flex; align-items:center; gap:14px; margin-top:6px; }
        .ceo-payment-wrap canvas { flex-shrink:0; }
        .ceo-payment-legend { display:flex; flex-direction:column; gap:5px; font-size:0.75rem; flex:1; min-width:0; }
        .ceo-payment-legend .leg-row { display:flex; align-items:center; gap:6px; justify-content:space-between; }
        .ceo-payment-legend .leg-dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
        .ceo-payment-legend .leg-label { display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ceo-payment-legend .leg-pct { font-weight:800; color:var(--text-primary); }

        .ceo-alerts-list { display:flex; flex-direction:column; gap:8px; }
        .ceo-alert-item { display:flex; align-items:center; gap:12px; padding:10px 12px; background:rgba(255,255,255,0.6); border-radius:10px; border-left:3px solid transparent; font-size:0.85rem; }
        body.dark-mode .ceo-alert-item { background:rgba(255,255,255,0.04); }
        .ceo-alert-item.sev-high { border-left-color:#dc2626; background:rgba(220,38,38,0.06); }
        .ceo-alert-item.sev-med  { border-left-color:#f59e0b; background:rgba(245,158,11,0.06); }
        .ceo-alert-item.sev-low  { border-left-color:#6366f1; background:rgba(99,102,241,0.06); }
        .ceo-alert-item i.main { font-size:1.3rem; flex-shrink:0; }
        .ceo-alert-text { flex:1; line-height:1.35; color:var(--text-primary); }
        .ceo-alert-text b { color:var(--text-primary); }
        .ceo-alert-meta { font-size:0.72rem; color:var(--text-muted); font-weight:700; }
        .ceo-alerts-count { background:#f97316; color:white; border-radius:99px; min-width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem; padding:0 9px; }
        .ceo-alerts-count.zero { background:#10b981; }

        .ceo-alert-wrap { display:flex; flex-direction:column; }
        .ceo-alert-item.expandable { cursor:pointer; user-select:none; position:relative; }
        .ceo-alert-item.expandable:hover { filter:brightness(0.98); }
        body.dark-mode .ceo-alert-item.expandable:hover { filter:brightness(1.1); }
        .ceo-alert-caret { color:var(--text-muted); font-size:1rem; transition:transform 0.2s; flex-shrink:0; margin-left:4px; }
        .ceo-alert-item.expandable.open .ceo-alert-caret { transform:rotate(180deg); }
        .ceo-alert-details { max-height:0; overflow:hidden; transition:max-height 0.3s ease; background:rgba(0,0,0,0.02); border-radius:0 0 10px 10px; margin-top:-2px; }
        body.dark-mode .ceo-alert-details { background:rgba(255,255,255,0.02); }
        .ceo-alert-details.open { max-height:500px; overflow-y:auto; padding:6px 0; border:1px solid var(--border); border-top:none; }
        .ceo-alert-detail-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 14px; border-bottom:1px solid var(--border); font-size:0.82rem; }
        .ceo-alert-detail-row:last-child { border-bottom:none; }
        .ceo-alert-detail-row .cd-main { flex:1; min-width:0; }
        .ceo-alert-detail-row .cd-name { font-weight:600; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ceo-alert-detail-row .cd-sub { font-size:0.72rem; color:var(--text-muted); margin-top:2px; }
        .ceo-alert-detail-row .cd-right { font-weight:800; font-variant-numeric:tabular-nums; color:var(--text-primary); font-size:0.82rem; white-space:nowrap; flex-shrink:0; }
        .ceo-alert-more { padding:8px 14px; text-align:center; }

        /* CTA Margen banner */
        .ceo-margins-cta { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 20px; background:linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%); border:1px solid rgba(99,102,241,0.18); border-radius:14px; cursor:pointer; transition:all 0.2s; text-decoration:none; }
        .ceo-margins-cta:hover { background:linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.1) 100%); border-color:rgba(99,102,241,0.32); transform:translateY(-1px); box-shadow:0 6px 20px rgba(99,102,241,0.12); }
        .ceo-margins-cta-left { display:flex; align-items:center; gap:12px; }
        .ceo-margins-cta-icon { width:40px; height:40px; border-radius:10px; background:rgba(99,102,241,0.12); display:flex; align-items:center; justify-content:center; font-size:1.3rem; color:#6366f1; flex-shrink:0; }
        .ceo-margins-cta-title { font-weight:800; color:var(--text-primary); font-size:0.95rem; margin-bottom:2px; }
        .ceo-margins-cta-sub { font-size:0.75rem; color:var(--text-muted); font-weight:600; }
        .ceo-margins-cta-arrow { font-size:1.4rem; color:#6366f1; opacity:0.7; transition:transform 0.2s; }
        .ceo-margins-cta:hover .ceo-margins-cta-arrow { transform:translateX(4px); opacity:1; }

        @media (max-width: 640px) {
            .ceo-hide-mobile { display:none; }
            .ceo-product-table td.name { max-width:150px; }
            .ceo-product-table td, .ceo-product-table th { padding:8px 8px; font-size:0.8rem; }
            .ceo-mini-value { font-size:1.3rem; }
            .ceo-payment-wrap canvas { width:90px !important; height:90px !important; }
        }

        /* Section dividers dark mode */
        body.dark-mode .section-divider-line { background:rgba(255,255,255,0.08) !important; }

        /* ---- Accesos Rápidos (solo mobile) ---- */
        .mobile-only { display: none; }
        @media (max-width: 768px) { .mobile-only { display: grid; } }

        .quick-access-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            padding: 8px 16px;
            margin-bottom: 16px;
        }

        @media (max-width: 400px) {
            .quick-access-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .quick-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            padding: 12px 6px;
            background: var(--bg-card, #fff);
            border: 1px solid var(--border, rgba(0,0,0,0.1));
            border-radius: 12px;
            color: var(--text-secondary);
            font-size: 10px;
            font-weight: 600;
            text-transform: none;
            letter-spacing: 0;
            cursor: pointer;
            transition: background 0.12s ease, transform 0.12s ease;
            -webkit-tap-highlight-color: transparent;
        }

        .quick-btn i {
            font-size: 20px;
            color: var(--text-secondary);
        }

        .quick-btn:active {
            background: var(--bg-input, rgba(0,0,0,0.05));
            transform: scale(0.95);
        }

        /* Dark mode */
        body.dark-mode .quick-btn {
            background: var(--bg-card);
            border-color: rgba(255,255,255,0.08);
            color: var(--text-secondary);
        }
        body.dark-mode .quick-btn i {
            color: var(--text-secondary);
        }
        body.dark-mode .quick-btn:active {
            background: var(--bg-input);
        }
    </style>

    <!-- Header -->
    <div class="dash-header">
        <div>
            <h1 class="text-primary font-bold flex items-center gap-2 text-xl">
                <i class="ph ph-squares-four"></i> Dashboard
            </h1>
        </div>
        <div class="dash-header-btns">
            <select id="dash-month-selector" class="btn bg-glass" style="border:1px solid rgba(0,0,0,0.1); font-weight:bold; cursor:pointer; color:var(--text-primary);">
                <option value="">Cargando...</option>
            </select>
            <button id="btn-export-excel" class="btn btn-premium" style="background:var(--grad-success); box-shadow: 0 10px 20px rgba(0, 200, 83, 0.2);">
                <i class="ph ph-file-xls"></i> <span class="hide-mobile">Excel</span>
            </button>
        </div>
    </div>

    <!-- Accesos Rápidos — solo mobile -->
    <div class="quick-access-grid mobile-only">
        <button class="quick-btn" onclick="window.navigateToView('cash_register', 'Arqueo')">
            <i class="ph ph-vault"></i>
            <span>Arqueo</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('profit_monitor', 'Márgenes')">
            <i class="ph ph-chart-line-up"></i>
            <span>Márgenes</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('purchase_invoices', 'Facturas')">
            <i class="ph ph-receipt"></i>
            <span>Facturas</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('employees', 'Personal')">
            <i class="ph ph-users"></i>
            <span>Personal</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('credits', 'Créditos')">
            <i class="ph ph-hand-holding-dollar"></i>
            <span>Créditos</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('suppliers', 'Proveedores')">
            <i class="ph ph-buildings"></i>
            <span>Proveedores</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('loans', 'Préstamos')">
            <i class="ph ph-hand-coins"></i>
            <span>Préstamos</span>
        </button>
        <button class="quick-btn" onclick="window.navigateToView('settings', 'Ajustes')">
            <i class="ph ph-gear"></i>
            <span>Ajustes</span>
        </button>
    </div>

    <!-- ===================== TAB 1: RESUMEN ===================== -->
    <div id="tab-resumen" class="dash-tab-content active">

        <!-- Vencimientos semanales (el widget de Contadora se movio a Alertas Inteligentes) -->
        <div id="weekly-summary-container" class="hidden" style="margin-bottom:24px;">
            <div class="premium-card" style="border-left:6px solid #f59e0b; background:rgba(245,158,11,0.05);">
                <h3 class="text-warning font-bold flex items-center gap-2 mb-4 text-base">
                    <i class="ph ph-calendar-check text-xl"></i> Vencimientos Esta Semana
                </h3>
                <div id="weekly-summary-list" class="flex-col gap-3"></div>
            </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin:20px 0 10px 0;">
            <div style="width:4px; height:22px; border-radius:4px; background:#10b981;"></div>
            <h2 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.3px;">Resumen del Mes</h2>
            <div class="section-divider-line" style="flex:1; height:1px; background:rgba(0,0,0,0.06);"></div>
        </div>
        <!-- KPI Cards con Estética Premium -->
        <div class="grid grid-cols-auto gap-4 mb-4">
            <!-- Ventas mes -->
            <div class="premium-card card-anim" style="border-top:4px solid #10b981; background: linear-gradient(180deg, rgba(16,185,129,0.05) 0%, var(--bg-card, white) 100%);">
                <div class="flex justify-between items-start mb-3">
                    <div class="p-2 rounded-2xl" style="background:rgba(16,185,129,0.1); color:#10b981;">
                        <i class="ph ph-chart-line-up text-xl"></i>
                    </div>
                    <div id="kpi-ventas-mes-badge" class="status-badge" style="background:rgba(16,185,129,0.1); color:#059669; border:1px solid rgba(16,185,129,0.2);">Calculando...</div>
                </div>
                <div class="stat-label-premium">Ventas del Mes</div>
                <div id="kpi-ventas-mes" class="stat-value-mega text-primary mt-1">...</div>
                <div class="spark-container mt-2" style="height:40px;"><canvas id="spark-ventas"></canvas></div>
            </div>

            <!-- Gasto mes -->
            <div class="premium-card card-anim delay-1" style="border-top:4px solid var(--primary); background: linear-gradient(180deg, rgba(230,0,0,0.03) 0%, var(--bg-card, white) 100%);">
                <div class="flex justify-between items-start mb-3">
                    <div class="p-2 rounded-2xl" style="background:rgba(230,0,0,0.1); color:var(--primary);" title="Suma de todos los gastos registrados este mes. No incluye mercadería.">
                        <i class="ph ph-hand-coins text-xl"></i>
                    </div>
                    <div id="kpi-gasto-mes-badge" class="status-badge status-overdue">Este Mes</div>
                </div>
                <div class="stat-label-premium text-primary">Gastos del Mes <i class="ph ph-info" title="Sueldos, servicios, contabilidad y otros gastos registrados."></i></div>
                <div id="kpi-gasto-mes" class="stat-value-mega text-primary mt-1">...</div>
                <div class="spark-container mt-2" style="height:40px;"><canvas id="spark-gastos"></canvas></div>
            </div>

            <!-- Margen Neto / Salud -->
            <div class="premium-card card-anim delay-2" style="border-top:4px solid #84cc16; background: linear-gradient(180deg, rgba(132,204,22,0.05) 0%, var(--bg-card, white) 100%);">
                <div class="flex justify-between items-start mb-3">
                    <div class="p-2 rounded-2xl" style="background:rgba(132,204,22,0.1); color:#84cc16;">
                        <i class="ph ph-heartbeat text-xl"></i>
                    </div>
                    <div id="health-label" class="status-badge" style="background:rgba(132,204,22,0.1); color:#65a30d; font-weight:700;">Salud</div>
                </div>
                <div class="stat-label-premium">Rentabilidad</div>
                <div class="flex items-baseline gap-3">
                    <div id="kpi-margen-neto" class="stat-value-mega mt-1" style="color:#65a30d;">...</div>
                    <div id="health-ratio-pct" class="text-sm font-black text-muted">0%</div>
                </div>
                <div id="health-bar-wrap" class="w-full h-3 rounded-full overflow-hidden mt-3" style="background:rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.03);">
                    <div id="health-bar" class="h-full" style="width:0%; background:linear-gradient(90deg, #84cc16, #22c55e); transition:width 1s ease;"></div>
                </div>
                <div id="health-detail" class="text-xs text-muted mt-2 font-medium italic">Calculando métricas de salud...</div>
            </div>
        </div>

        <!-- Proyección Mes -->
        <div id="prediction-container" class="hidden" style="margin-bottom:10px;">
            <div class="premium-card" style="background: var(--ia-panel-bg); color: var(--ia-panel-text); border: none; padding: 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div id="label-ia-title" style="font-size:0.65rem; color:var(--ia-accent); font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                            <i class="ph ph-chart-line-up"></i> Proyección Mes
                        </div>
                        <div style="display:flex; align-items:baseline; gap:8px;">
                            <span id="predict-total" style="font-size:1.6rem; font-weight:900; color:var(--ia-panel-text);">...</span>
                            <span id="predict-month-label" style="font-size:0.75rem; color:var(--ia-muted);">est.</span>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div id="predict-confidence" class="predict-badge" style="font-size:0.6rem; padding:3px 8px;">...</div>
                        <div id="predict-comparison" style="font-size:0.75rem; margin-top:4px;"></div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin-top:10px;">
                    <div style="flex:1; height:5px; background:var(--ia-glass); border-radius:99px; overflow:hidden;">
                        <div id="predict-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #6366f1, #a855f7); border-radius:99px; transition:width 1s ease;"></div>
                    </div>
                    <span id="predict-percent" style="font-size:0.7rem; font-weight:800; color:var(--ia-accent);">0%</span>
                </div>
                <div id="predict-insight-box" style="margin-top:8px; display:flex; align-items:center; gap:6px;">
                    <div id="predict-insight-dot" style="width:5px; height:5px; border-radius:50%; background:#6366f1;"></div>
                    <span id="predict-insight-text" style="font-size:0.75rem; font-weight:600; color:var(--ia-muted);">Calculando...</span>
                </div>
                <span id="label-ia-meta" style="display:none;">AVANCE MENSUAL</span>
            </div>
        </div>

        <div class="premium-card mb-4" style="padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h3 style="font-weight:700; font-size:0.9rem; display:flex; align-items:center; gap:6px; margin:0;">
                    <div style="width:7px;height:7px;background:#ef4444;border-radius:50%;box-shadow:0 0 6px #ef4444;"></div>
                    Hoy
                </h3>
                <div style="display:flex; align-items:center; gap:12px; font-size:0.8rem;">
                    <span class="text-muted"><b id="live-sales-count">0</b> tickets</span>
                    <b id="live-sales-total" style="color:#10b981; font-size:0.95rem;">$0</b>
                </div>
            </div>
            <div id="live-sales-feed" class="live-sales-scroller"></div>
        </div>

        <!-- ============================================================
             CEO COCKPIT — Widgets inteligentes (mes en curso)
             ============================================================ -->

        <div style="display:flex; align-items:center; gap:10px; margin:20px 0 10px 0;">
            <div style="width:4px; height:22px; border-radius:4px; background:#6366f1;"></div>
            <h2 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.3px;">Indicadores Clave</h2>
            <div class="section-divider-line" style="flex:1; height:1px; background:rgba(0,0,0,0.06);"></div>
        </div>
        <!-- FILA: Ticket promedio · Resumen caja · Forma de pago -->
        <div class="ceo-row-3 mb-4">
            <!-- Ticket promedio + Tendencia -->
            <div class="premium-card ceo-mini">
                <div class="ceo-mini-label"><i class="ph ph-receipt"></i> Ticket Promedio</div>
                <div class="ceo-mini-value" id="ceo-avg-ticket">—</div>
                <div class="ceo-mini-sub" id="ceo-avg-ticket-sub">Calculando…</div>
                <div class="ceo-mini-foot" id="ceo-avg-ticket-foot"></div>
            </div>

            <!-- Resumen caja real -->
            <div class="premium-card ceo-mini" style="border-left:4px solid #10b981;">
                <div class="ceo-mini-label"><i class="ph ph-vault"></i> Caja Real del Mes</div>
                <div class="ceo-mini-value" id="ceo-cash-net">—</div>
                <div class="ceo-mini-sub" id="ceo-cash-sub">Ingresos − Egresos</div>
                <div class="ceo-cash-breakdown" id="ceo-cash-breakdown"></div>
            </div>

            <!-- Forma de pago breakdown -->
            <div class="premium-card ceo-mini">
                <div class="ceo-mini-label"><i class="ph ph-wallet"></i> Formas de Pago</div>
                <div class="ceo-payment-wrap">
                    <canvas id="paymentDonut" width="110" height="110"></canvas>
                    <div class="ceo-payment-legend" id="ceo-payment-legend"></div>
                </div>
            </div>
        </div>

        <!-- ALERTAS INTELIGENTES -->
        <div class="premium-card mb-4" id="ceo-alerts-card" style="background:linear-gradient(135deg, rgba(249,115,22,0.06), var(--bg-card, #fff)); border-left:4px solid #f97316;">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold flex items-center gap-2" style="color:#c2410c; font-size:1.05rem;">
                    <i class="ph ph-siren text-xl"></i> Alertas
                </h3>
                <span class="ceo-alerts-count" id="ceo-alerts-count">0</span>
            </div>
            <div id="ceo-alerts-list" class="ceo-alerts-list">
                <div class="spinner m-auto"></div>
            </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin:20px 0 10px 0;">
            <div style="width:4px; height:22px; border-radius:4px; background:#3b82f6;"></div>
            <h2 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.3px;">Decisiones</h2>
            <div class="section-divider-line" style="flex:1; height:1px; background:rgba(0,0,0,0.06);"></div>
        </div>
        <!-- PANEL DECISIONES -->
        <div class="decision-grid" style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:14px;">
            <div class="premium-card" style="padding:14px;" id="dec-buy">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                    <i class="ph ph-shopping-cart" style="color:#3b82f6; font-size:1.1rem;"></i>
                    <span style="font-weight:700; font-size:0.8rem;">Qué reponer</span>
                </div>
                <div id="dec-buy-list" style="font-size:0.75rem; display:flex; flex-direction:column; gap:4px;">
                    <span class="text-muted">Cargando...</span>
                </div>
            </div>
            <div class="premium-card" style="padding:14px;" id="dec-price">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                    <i class="ph ph-arrow-fat-up" style="color:#f59e0b; font-size:1.1rem;"></i>
                    <span style="font-weight:700; font-size:0.8rem;">Subir precio</span>
                </div>
                <div id="dec-price-list" style="font-size:0.75rem; display:flex; flex-direction:column; gap:4px;">
                    <span class="text-muted">Cargando...</span>
                </div>
            </div>
            <div class="premium-card" style="padding:14px;" id="dec-day">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                    <i class="ph ph-calendar-x" style="color:#ef4444; font-size:1.1rem;"></i>
                    <span style="font-weight:700; font-size:0.8rem;">Día más flojo</span>
                </div>
                <div id="dec-day-content" style="font-size:0.75rem;">
                    <span class="text-muted">Cargando...</span>
                </div>
            </div>
            <div class="premium-card" style="padding:14px;" id="dec-cash">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                    <i class="ph ph-piggy-bank" style="color:#10b981; font-size:1.1rem;"></i>
                    <span style="font-weight:700; font-size:0.8rem;">Flujo próximo</span>
                </div>
                <div id="dec-cash-content" style="font-size:0.75rem;">
                    <span class="text-muted">Cargando...</span>
                </div>
            </div>
        </div>

        <!-- CTA → Márgenes -->
        <button class="ceo-margins-cta mb-4" id="ceo-margins-cta-btn" onclick="window._goToMargenes()" style="padding:12px 16px;">
            <div class="ceo-margins-cta-left">
                <div>
                    <div class="ceo-margins-cta-title" style="font-size:0.85rem;">Márgenes por Producto</div>
                </div>
            </div>
            <i class="ph ph-arrow-right ceo-margins-cta-arrow"></i>
        </button>

        <!-- Gráfico P&L + Top Proveedores -->
        <div class="pl-chart-grid">
            <!-- Gráfico P&L 6 meses -->
            <div class="card card-anim p-4">
                <div class="card-header">
                    <h3 class="font-bold flex items-center gap-2" style="font-size:0.95rem;">
                        <i class="ph ph-trend-up text-success"></i> Ventas vs Gastos
                    </h3>
                    <div class="text-muted" style="font-size:0.75rem;">Últimos 6 meses</div>
                </div>
                <div style="height:200px; width:100%;"><canvas id="plChart"></canvas></div>
            </div>
            <!-- Top 3 proveedores -->
            <div class="card card-anim p-4">
                <h3 class="font-bold mb-4 flex items-center gap-2" style="font-size:0.95rem;">
                    <i class="ph ph-buildings" style="color:#f97316;"></i> Top Proveedores
                </h3>
                <div id="top-suppliers" class="flex-col gap-4">
                    <div class="spinner m-auto"></div>
                </div>
            </div>
        </div>

        <!-- Widgets fila inferior -->
        <div class="bottom-widgets-grid">
            <!-- Próximos pagos empleados -->
            <div class="card card-anim p-4" style="background:linear-gradient(135deg, rgba(239,68,68,0.05), var(--bg-card, #fff)); border-bottom:4px solid #ffcccc;">
                <h3 class="mb-3 font-bold flex items-center gap-2" style="color:#b91c1c; font-size:1rem;">
                    <i class="ph ph-money text-xl"></i> Próximos Pagos a Equipo
                </h3>
                <div id="upcoming-payments-list" class="text-secondary" style="font-size:0.85rem;">
                    <div class="spinner m-auto"></div>
                </div>
            </div>
            <!-- Facturas a crédito -->
            <div class="card card-anim p-4" id="credit-widget" style="background:linear-gradient(135deg, rgba(245,158,11,0.05), var(--bg-card, #fff)); border-bottom:4px solid #fde68a; cursor:pointer;">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-bold flex items-center gap-2" style="color:#92400e; font-size:1rem;">
                        <i class="ph ph-clock-countdown text-xl"></i> Facturas por Pagar (Crédito)
                    </h3>
                    <i class="ph ph-arrow-right text-muted"></i>
                </div>
                <div id="credit-widget-content" class="text-secondary" style="font-size:0.85rem;">
                    <div class="spinner m-auto"></div>
                </div>
            </div>
        </div>
    </div>
    `;
    } // End if(!isAlreadyRendered)

    // Helper global para navegación — evita escape de comillas en onclick inline
    window._goToMargenes = () => { document.querySelector('[data-view="profit_monitor"]')?.click(); };

    // (Tab switching removed as only Resumen exists now)

    // ===================== LOAD RESUMEN DATA =====================
    try {
        const msCurrent = document.getElementById('dash-month-selector');
        if (selectedMonth === null && msCurrent && msCurrent.value) {
            selectedMonth = msCurrent.value;
        }

        let now = new Date();
        const realToday = new Date();
        
        if (selectedMonth) {
            const [y, m] = selectedMonth.split('-');
            const reqY = parseInt(y);
            const reqM = parseInt(m) - 1;
            
            // Si el mes seleccionado es el actual, usamos el día de hoy
            if (reqY === realToday.getFullYear() && reqM === realToday.getMonth()) {
                now = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate(), 12, 0, 0);
            } else {
                // Si es un mes pasado, asumimos el mes entero (el último día del mes)
                now = new Date(reqY, reqM + 1, 0, 12, 0, 0); 
            }
        }
        
        // IMPORTANTE: Usar hora LOCAL (no UTC) para evitar desfase en Argentina (UTC-3)
        const todayStr = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`;
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Fetch all data in parallel
        // Nota: workLogs ya NO se trae aquí — era una variable "logs" que nunca se usaba en el dashboard.
        // El fetch de workLogs para el Excel se hace de forma lazy dentro del handler de exportación.
        const [allEmployees, allInvoices, allSuppliers, allDailySales, allProducts, allExpenses, allEleventaSales] = await Promise.all([
            window.db.employees.toArray(),
            window.db.purchase_invoices.toArray(),
            window.db.suppliers.toArray(),
            window.db.daily_sales.toArray(),
            window.db.products.toArray(),
            window.db.expenses.toArray(),
            window.db.eleventa_sales.toArray()
        ]);

        const employees = allEmployees.filter(e => !e.deleted);
        const invoices = allInvoices.filter(i => !i.deleted);
        const suppliers = allSuppliers.filter(s => !s.deleted);

        // --- FILTRADO ESTRICTO Y GUARDIA DE NEGOCIO ---
        // Excluimos registros marcados como borrados y aquellos con montos absurdos (TESTS)
        const dailySales = allDailySales.filter(d => {
            if (d.deleted === true) return false;
            const val = parseFloat(d.total) || 0;
            return val < 1000000000; // Máximo 1 Billon CLP (Guardia contra basura)
        });

        const products = allProducts.filter(p => !p.deleted);

        const supplierMap = window.Utils.createSupplierMap(suppliers);

        const eleventaSales = (allEleventaSales || []).filter(s => !s.deleted);

        // --- LLENAR SELECTOR DE MESES ---
        const ms = document.getElementById('dash-month-selector');
        if (ms) {
            const months = new Set();
            dailySales.forEach(s => { if (s.date) months.add(s.date.substring(0, 7)) });
            for (let i = 0; i < 12; i++) {
                const d = new Date(realToday.getFullYear(), realToday.getMonth() - i, 1);
                months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }
            ms.innerHTML = '';
            Array.from(months).sort().reverse().forEach(m_str => {
                const [y, mo] = m_str.split('-');
                const lbl = new Date(y, parseInt(mo) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                ms.insertAdjacentHTML('beforeend', `<option value="${m_str}">${lbl.charAt(0).toUpperCase() + lbl.slice(1)}</option>`);
            });
            ms.value = currentMonthStr; // Fijar mes actual

            ms.addEventListener('change', (e) => {
                window.Views.dashboard(container, e.target.value);
            });
        }

        // ---- Módulo Ventas en Directo (Eleventa) ----
        // Mostrar TODAS las ventas del día completo
        const nowLocal = new Date();
        const localYear = nowLocal.getFullYear();
        const localMonth = String(nowLocal.getMonth() + 1).padStart(2, '0');
        const localDay = String(nowLocal.getDate()).padStart(2, '0');
        const todayStrLocal = `${localYear}-${localMonth}-${localDay}`; // YYYY-MM-DD local

        const todayEleventa = eleventaSales.filter(v => {
            // Usar date_local (fecha calendario local) si existe, si no extraer de date UTC
            let dateStr = v.date_local || String(v.date).split('T')[0];
            return dateStr === todayStrLocal;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        const elFeed = document.getElementById('live-sales-feed');
        const validSales = todayEleventa.filter(v => v.total > 0);

        // --- Meta diaria ---
        const META_DIARIA = 400000;

        if (elFeed) {
            if (validSales.length === 0) {
                elFeed.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.8rem;">Sin ventas hoy</div>';
            } else {
                const renderSales = validSales.slice(0, 5);
                elFeed.innerHTML = renderSales.map((v, index) => {
                    const dateObj = new Date(v.date);
                    const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    const profit = parseFloat(v.profit) || 0;
                    return `
                    <div class="live-ticket-row ${index === 0 ? 'new' : ''}">
                        <div class="live-ticket-left">
                            <span class="live-ticket-id">#${v.ticket_id || v.id}</span>
                            <span class="live-ticket-time">${timeStr}</span>
                        </div>
                        <div class="live-ticket-right">
                            <span class="live-ticket-profit">+${window.Utils.formatCurrency(profit)}</span>
                            <span class="live-ticket-total">${window.Utils.formatCurrency(v.total)}</span>
                        </div>
                    </div>`;
                }).join('');
            }
            document.getElementById('live-sales-count').textContent = validSales.length;
            const eleventaTotal = validSales.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
            document.getElementById('live-sales-total').innerHTML = window.Utils.formatCurrency(eleventaTotal);

            // Barra de progreso de meta diaria
            const META_DIARIA_FORMATTED = Math.round(META_DIARIA).toLocaleString('es-CL');
            const metaProgressHtml = `
                <div style="margin-top:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">
                        <span>Meta diaria</span>
                        <span>$${META_DIARIA_FORMATTED}</span>
                    </div>
                    <div style="height:6px; background:rgba(0,0,0,0.06); border-radius:99px; overflow:hidden;">
                        <div id="meta-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #10b981, #059669); border-radius:99px; transition:width 1s ease;"></div>
                    </div>
                </div>`;
            // Insertar barra antes del feed (debajo del header del widget Hoy)
            if (!document.getElementById('meta-progress-bar')) {
                elFeed.insertAdjacentHTML('beforebegin', metaProgressHtml);
            }

            // Animar barra de progreso
            const metaBar = document.getElementById('meta-progress-bar');
            if (metaBar) {
                const metaPct = Math.min(100, (eleventaTotal / META_DIARIA) * 100);
                setTimeout(() => { metaBar.style.width = metaPct + '%'; }, 300);
                if (metaPct >= 100) metaBar.style.background = 'linear-gradient(90deg, #f59e0b, #eab308)';
            }

            // Notificación de meta superada (una sola vez por día)
            const metaKey = `wm_meta_notified_${now.toISOString().slice(0, 10)}`;
            if (eleventaTotal >= META_DIARIA && !localStorage.getItem(metaKey)) {
                localStorage.setItem(metaKey, '1');
                if (window.Sync && window.Sync.showToast) {
                    window.Sync.showToast(`Meta diaria superada! $${Math.round(eleventaTotal).toLocaleString('es-CL')}`, 'success');
                }
                if (window.AppNotify && window.AppNotify.playChime) {
                    window.AppNotify.playChime('success');
                }
            }
        }

        // ---- KPI Calculations (True Profitability Engine) ----
        // 1. Sales (Total Revenue) — directo desde Eleventa (fuente real)
        //    daily_sales se sigue cargando para la gráfica histórica (antes de Eleventa)
        const thisMonthSales = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const prevMonthSales = eleventaSales.filter(s => s.date && s.date.startsWith(prevMonthStr));
        const ventasMes  = thisMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const ventasPrev = prevMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

        // 1b. Comisión MercadoPago (2% sobre ventas con tarjeta)
        const COMISION_MP = 0.02;
        const tarjetaMes = thisMonthSales.filter(s => {
            const f = (s.forma_pago || '').toLowerCase();
            return f.includes('tarjeta') || f.includes('debito');
        }).reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const comisionMPMes = Math.round(tarjetaMes * COMISION_MP);

        const tarjetaPrev = prevMonthSales.filter(s => {
            const f = (s.forma_pago || '').toLowerCase();
            return f.includes('tarjeta') || f.includes('debito');
        }).reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const comisionMPPrev = Math.round(tarjetaPrev * COMISION_MP);

        // 2. Gross Profit (From Eleventa API)
        const thisMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const prevMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(prevMonthStr));
        
        // Sumamos el Margen Directo de cada ticket (Venta - Costo)
        const gananciaBrutaMes = thisMonthEleventa.reduce((s, t) => s + (parseFloat(t.profit) || 0), 0);
        const gananciaBrutaPrev = prevMonthEleventa.reduce((s, t) => s + (parseFloat(t.profit) || 0), 0);

        // 3. Gastos del mes (suma directa de todo lo registrado)
        const thisMonthExpenses = allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(currentMonthStr));
        const prevMonthExpenses = allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(prevMonthStr));

        const gastosDelMes = thisMonthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const gastoTotal = gastosDelMes + comisionMPMes;

        const gastosDelMesPrev = prevMonthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const gastoPrev = gastosDelMesPrev + comisionMPPrev;

        // 6. Invoices (Cashflow only, informational. Mercadería comprada)
        // NOTA: purchase_invoices NO se restan aquí porque gananciaBrutaMes (Eleventa) ya tiene costo descontado.
        // Las compras solo se usan en el gráfico P&L histórico como referencia visual de cashflow.

        const fmt = v => window.Utils.formatCurrency(v);

        // Gasto mes with badge
        const elGasto = document.getElementById('kpi-gasto-mes');
        if (elGasto) {
            window.Utils.animateNumber(elGasto, 0, gastoTotal, 1000, true);
        }
        renderBadge('kpi-gasto-mes-badge', gastoTotal, gastoPrev, true);

        // Ventas mes with badge
        const elVentas = document.getElementById('kpi-ventas-mes');
        if (elVentas) {
            window.Utils.animateNumber(elVentas, 0, ventasMes, 1000, true);
        }
        renderBadge('kpi-ventas-mes-badge', ventasMes, ventasPrev, false);

        // ---- 🧠 IA PREDICTIVE ENGINE INTEGRATION ----
        const predContainer = document.getElementById('prediction-container');
        if (window.Utils && window.Utils.PredictionEngine && predContainer) {
            predContainer.classList.remove('hidden'); // Show it early with "Calculating" state

            try {
                const prediction = await window.Utils.PredictionEngine.getProjectedSales();

                if (prediction) {
                    const elPredictTotal = document.getElementById('predict-total');
                    const elPredictComparison = document.getElementById('predict-comparison');
                    const elPredictConfidence = document.getElementById('predict-confidence');
                    const elPredictProgress = document.getElementById('predict-progress-bar');
                    const elPredictPercent = document.getElementById('predict-percent');
                    const elPredictInsight = document.getElementById('predict-insight-text');
                    const elPredictInsightBox = document.getElementById('predict-insight-box');
                    const elPredictRecordValue = document.getElementById('predict-record-value');

                    // Set current month label
                    const now = new Date();
                    const currentMonthName = now.toLocaleDateString('es-ES', { month: 'long' });
                    const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
                    const estLabel = document.getElementById('predict-month-label');
                    if (estLabel) estLabel.textContent = `est. fin de ${capitalizedMonth}`;

                    // 1. Animate Number (Ensure it's a valid number)
                    const total = parseFloat(prediction.projectedTotal) || 0;
                    window.Utils.animateNumber(elPredictTotal, 0, total, 2000, true);

                    // 2. Update Confidence Badge (Removed Emojis)
                    const confLabels = { high: '+60 días datos', medium: '+20 días datos', low: 'Pocos datos aún' };
                    if (elPredictConfidence) {
                        elPredictConfidence.textContent = confLabels[prediction.confidence] || 'Analizando...';
                        elPredictConfidence.style.color = prediction.confidence === 'high' ? '#10b981' : prediction.confidence === 'medium' ? '#fbbf24' : '#f43f5e';
                    }

                    // 3. Update Record Daily
                    if (elPredictRecordValue) elPredictRecordValue.innerHTML = fmt(prediction.maxDaily || 0);

                    // 4. Update Strategic Insight (UI/UX Refined)
                    if (elPredictInsight) {
                        elPredictInsight.textContent = prediction.insight;
                        const elDot = document.getElementById('predict-insight-dot');
                        if (elDot) {
                            elDot.style.background = prediction.insightColor;
                            elDot.style.boxShadow = `0 0 8px ${prediction.insightColor}`;
                        }
                        if (elPredictInsightBox) {
                            elPredictInsightBox.style.background = `${prediction.insightColor}10`; // 0.1 opacity
                            elPredictInsightBox.style.borderColor = `${prediction.insightColor}30`; // 0.2 opacity
                        }
                    }

                    // 5. Update Comparison
                    if (elPredictComparison) {
                        if (prediction.prevMonthTotal > 0) {
                            const diffPct = ((total / prediction.prevMonthTotal - 1) * 100).toFixed(1);
                            const isUp = total >= prediction.prevMonthTotal;
                            elPredictComparison.innerHTML = `
                                <span style="color:${isUp ? '#10b981' : '#f43f5e'}; font-weight:800; background:rgba(${isUp ? '16,185,129' : '244,63,94'}, 0.15); padding:4px 10px; border-radius:8px; display:flex; align-items:center; gap:4px;">
                                    <i class="ph ph-trend-${isUp ? 'up' : 'down'}"></i> ${isUp ? '+' : ''}${diffPct}%
                                </span>
                                <span style="color:#64748b; font-size:0.85rem;">vs mes anterior (${fmt(prediction.prevMonthTotal)})</span>
                            `;
                        } else {
                            elPredictComparison.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">Sin mes anterior para comparar</span>`;
                        }
                    }

                    // 6. Update Progress Bar
                    const progressPct = total > 0 ? Math.min(100, (prediction.mtdTotal / total) * 100) : 0;
                    if (elPredictPercent) elPredictPercent.textContent = progressPct.toFixed(0) + '%';
                    setTimeout(() => {
                        if (elPredictProgress) elPredictProgress.style.width = progressPct + '%';
                    }, 600);
                } else {
                    // Si la IA no tiene suficientes datos (vuelve null)
                    const elInsight = document.getElementById('predict-insight-text');
                    if (elInsight) elInsight.textContent = "Faltan datos (mín. 2 días de ventas)";
                }
            } catch (err) {
                console.error("Dashboard IA Error:", err);
            }
        }

        // ---- Utilidad Neta = Ganancia Bruta - Gastos del Mes - Comisión Tarjeta ----
        const utilidadNetaMonto = gananciaBrutaMes - gastoTotal;
        const margenNetoPct = ventasMes > 0 ? (utilidadNetaMonto / ventasMes * 100) : 0;

        const elMargenMonto = document.getElementById('kpi-margen-neto');
        if (elMargenMonto) {
            window.Utils.animateNumber(elMargenMonto, 0, utilidadNetaMonto, 1000, true);
        }

        // ---- DESGLOSE RENTABILIDAD NETA (Nuevo widget de transparencia) ----
        const elHealthDetail = document.getElementById('health-detail');
        const elHealthBar = document.getElementById('health-bar');
        const healthEl = document.getElementById('health-label');
        const healthRatioPct = document.getElementById('health-ratio-pct');

        // Renderizar el desglose detallado siempre
        if (elHealthDetail) {
            const fmtRow = (label, value, color, iconClass) => {
                const isNeg = value < 0;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06);">
                    <span style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="${iconClass}"></i> ${label}</span>
                    <span style="font-weight:700; font-size:0.9rem; color:${color};">${isNeg ? '-' : ''}${window.Utils.formatCurrency(Math.abs(value))}</span>
                </div>`;
            };

            const netColor = utilidadNetaMonto >= 0 ? '#16a34a' : '#dc2626';

            // Agrupar gastos por categoría para el desglose
            const gastosPorCategoria = {};
            thisMonthExpenses.forEach(e => {
                const cat = e.category || 'Otros';
                gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (parseFloat(e.amount) || 0);
            });

            const categoriasHtml = Object.entries(gastosPorCategoria)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => fmtRow(cat, -amount, '#ef4444', 'ph ph-minus-circle'))
                .join('');

            elHealthDetail.innerHTML = `
                <div style="margin-top:12px; background:rgba(0,0,0,0.02); border-radius:14px; padding:14px; font-family: var(--font-primary, Arial, sans-serif); border:1px solid rgba(0,0,0,0.03);">

                    <details>
                        <summary style="list-style:none; cursor:pointer; outline:none; padding:4px 0 8px; font-size:0.82rem; font-weight:700; color:var(--text-muted);">Ver desglose de gastos</summary>

                        ${fmtRow('Ganancia Bruta (Cierre Caja)', gananciaBrutaMes, '#10b981', 'ph ph-coins')}

                        ${categoriasHtml}

                        ${comisionMPMes > 0 ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06);">
                            <span style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                                <i class="ph ph-credit-card"></i> Comisión Tarjeta (2%)
                                <span style="font-size:0.65rem; opacity:0.6;">sobre ${window.Utils.formatCurrency(tarjetaMes)}</span>
                            </span>
                            <span style="font-weight:700; font-size:0.9rem; color:#e11d48;">-${window.Utils.formatCurrency(comisionMPMes)}</span>
                        </div>` : ''}

                    </details>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0 2px; margin-top:8px; border-top:2px solid rgba(0,0,0,0.05);">
                        <span style="font-size:0.9rem; font-weight:800; color:var(--text-primary);">UTILIDAD NETA FINAL</span>
                        <span style="font-weight:900; font-size:1.4rem; color:${netColor}; letter-spacing:-0.5px;">${utilidadNetaMonto >= 0 ? '+' : ''}${window.Utils.formatCurrency(utilidadNetaMonto)}</span>
                    </div>
                </div>
            `;
        }

        // ---- Health Indicator (Based on Operative Health) ----
        if (!healthEl || !elHealthBar) return; // Guard against race condition

        if (gananciaBrutaMes === 0) {
            healthEl.textContent = '⚪ Sin datos de margen API';
            elHealthBar.style.width = '0%';
            if (healthRatioPct) healthRatioPct.textContent = '0%';
        } else {
            const burdenPct = Math.min(100, Math.max(0, (gastoTotal / ventasMes) * 100));
            const margin = margenNetoPct.toFixed(1);

            setTimeout(() => { elHealthBar.style.width = burdenPct + '%'; }, 100);
            if (healthRatioPct) healthRatioPct.textContent = margin + '% final';

            if (burdenPct < 50) {
                healthEl.innerHTML = '🟢 Muy Saludable';
                elHealthBar.style.background = '#10b981';
            } else if (burdenPct < 75) {
                healthEl.innerHTML = '🟡 Aceptable';
                elHealthBar.style.background = '#f59e0b';
            } else if (burdenPct < 100) {
                healthEl.innerHTML = '🟠 En riesgo';
                elHealthBar.style.background = '#f97316';
            } else {
                healthEl.innerHTML = '🔴 Pérdida Neta';
                elHealthBar.style.background = '#ef4444';
            }
        }

        // (Resumen Operativo eliminado — no hay datos de workLogs)

        // ============================================================
        // CEO COCKPIT — Cálculos unificados del mes en curso y mes previo
        // ============================================================
        const buildProductStats = (salesArr) => {
            const stats = {};
            salesArr.forEach(sale => {
                if (!sale.items || !Array.isArray(sale.items)) return;
                sale.items.forEach(item => {
                    const name = (item.name || 'Desconocido').trim();
                    if (!stats[name]) stats[name] = { qty: 0, profit: 0, revenue: 0, tickets: new Set() };
                    const q = parseFloat(item.qty) || 1;
                    let profitLine = parseFloat(item.profit) || 0;
                    let priceUnitValue = parseFloat(item.price_unit) || 0;
                    let costUnitValue = parseFloat(item.cost_unit) || 0;
                    if (profitLine === 0 && priceUnitValue > 0) {
                        const localProduct = allProducts.find(p =>
                            p.name && p.name.toLowerCase().trim() === name.toLowerCase()
                        );
                        if (localProduct) {
                            costUnitValue = localProduct.costUnit || 0;
                            priceUnitValue = parseFloat(item.price_unit) || (parseFloat(item.price) / q);
                            profitLine = (priceUnitValue - costUnitValue) * q;
                        }
                    }
                    stats[name].qty += q;
                    stats[name].profit += profitLine;
                    stats[name].revenue += (parseFloat(item.price) || 0);
                    if (sale.ticket_id) stats[name].tickets.add(sale.ticket_id);
                });
            });
            return stats;
        };

        const currentMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const productStats     = buildProductStats(currentMonthEleventa);
        const prevProductStats = buildProductStats(prevMonthEleventa);

        const allProductsArr = Object.entries(productStats).map(([name, v]) => {
            const marginPct = v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0;
            const prev = prevProductStats[name];
            const prevProfit = prev ? prev.profit : 0;
            return {
                name,
                qty: v.qty,
                profit: v.profit,
                revenue: v.revenue,
                marginPct,
                prevProfit,
                deltaProfit: v.profit - prevProfit
            };
        });

        // (Radar de Productos eliminado — ver análisis completo en Márgenes)
        // allProductsArr permanece disponible para las Alertas Inteligentes abajo.



        // ============================================================
        // ALERTAS INTELIGENTES
        // ============================================================
        const alerts = [];

        // Productos con margen bajo (< 5%) y volumen relevante
        const lowMargin = allProductsArr.filter(p => p.qty >= 5 && p.revenue > 0 && p.marginPct < 5 && p.marginPct >= 0)
            .sort((a, b) => a.marginPct - b.marginPct);
        if (lowMargin.length) {
            alerts.push({
                sev: 'med',
                icon: 'ph-magnet',
                color: '#f59e0b',
                html: `<b>${lowMargin.length}</b> con margen &lt;5%`,
                meta: `Peor: ${lowMargin[0].marginPct.toFixed(1)}%`,
                details: {
                    type: 'products',
                    items: lowMargin.slice(0, 15).map(p => ({
                        name: p.name,
                        right: `${p.marginPct.toFixed(1)}% · ${p.qty} uds`,
                        sub: `Factura ${window.Utils.formatCurrency(p.revenue, true)} · gana ${window.Utils.formatCurrency(p.profit, true)}`
                    }))
                }
            });
        }

        // Productos sin ganancia (margen < 1%)
        const zeroMarginAlerts = allProductsArr.filter(p => p.qty >= 1 && p.marginPct < 1)
            .sort((a, b) => b.qty - a.qty);
        if (zeroMarginAlerts.length) {
            alerts.push({
                sev: 'high',
                icon: 'ph-warning',
                color: '#dc2626',
                html: `<b>${zeroMarginAlerts.length}</b> sin costo cargado`,
                meta: 'Revisar Eleventa',
                details: {
                    type: 'products',
                    items: zeroMarginAlerts.slice(0, 15).map(p => ({
                        name: p.name,
                        right: `${p.qty} uds`,
                        sub: `Factura ${window.Utils.formatCurrency(p.revenue, true)} · gana ${window.Utils.formatCurrency(p.profit, true)}`
                    }))
                }
            });
        }

        // Productos SIN ventas >30 días (de catálogo local que tenían ventas antes)
        const now30 = new Date();
        now30.setDate(now30.getDate() - 30);
        const cutoff30 = now30.toISOString().split('T')[0];
        const soldRecently = new Set();
        eleventaSales.forEach(s => {
            if (s.date >= cutoff30 && s.items && Array.isArray(s.items)) {
                s.items.forEach(it => { if (it.name) soldRecently.add(it.name.toLowerCase().trim()); });
            }
        });
        const productsInCatalog = (allProducts || []).filter(p => !p.deleted && p.name && p.stock !== 0);
        const staleProducts = productsInCatalog.filter(p =>
            p.name && !soldRecently.has(p.name.toLowerCase().trim())
        );
        if (staleProducts.length > 5) {
            alerts.push({
                sev: 'low',
                icon: 'ph-snowflake',
                color: '#6366f1',
                html: `<b>${staleProducts.length}</b> sin venta en 30 días`,
                meta: 'Ver detalle',
                details: {
                    type: 'products',
                    items: staleProducts.slice(0, 15).map(p => ({
                        name: p.name,
                        right: p.stock ? `stock ${p.stock}` : '',
                        sub: p.costUnit ? `costo unit. ${window.Utils.formatCurrency(p.costUnit, true)}` : ''
                    }))
                }
            });
        }

        // Pago de Contadora (vence día 14 de cada mes)
        const accountantDueDay = 14;
        const currentMonthIntStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const hasPaidAccountantMonth = (allExpenses || []).some(e =>
            !e.deleted && e.category === 'Contabilidad' && e.date && e.date.startsWith(currentMonthIntStr)
        );
        if (!hasPaidAccountantMonth) {
            const dueDate = new Date(now.getFullYear(), now.getMonth(), accountantDueDay);
            const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueDate - todayMidnight) / 86400000);
            if (diffDays <= 5) {
                const msg = diffDays < 0
                    ? `<b>Pago contadora atrasado</b> ${Math.abs(diffDays)} día${Math.abs(diffDays) > 1 ? 's' : ''} (venció el 14)`
                    : diffDays === 0
                        ? `<b>Pago contadora vence HOY</b> (día 14)`
                        : `<b>Pago contadora</b> en ${diffDays} día${diffDays > 1 ? 's' : ''}`;
                alerts.push({
                    sev: diffDays < 0 ? 'high' : 'med',
                    icon: diffDays < 0 ? 'ph-warning-octagon' : 'ph-calendar-plus',
                    color: diffDays < 0 ? '#dc2626' : '#f97316',
                    html: msg,
                    meta: `<a href="#" onclick="event.preventDefault(); window._showAccountantQuickPay && window._showAccountantQuickPay();" style="color:inherit; text-decoration:underline;">Registrar</a>`
                });
            }
        }

        // Días con caída — desde Eleventa (agrupado por fecha local)
        const eleventaByDay = new Map();
        eleventaSales.filter(s => (s.date_local || s.date || '').substring(0, 7) === currentMonthStr).forEach(s => {
            const d = s.date_local || s.date.split('T')[0];
            eleventaByDay.set(d, (eleventaByDay.get(d) || 0) + (parseFloat(s.total) || 0));
        });
        const currentMonthDaily = Array.from(eleventaByDay.entries()).map(([date, total]) => ({ date, total }));

        if (currentMonthDaily.length >= 3) {
            const totals = currentMonthDaily.map(d => parseFloat(d.total) || 0).filter(t => t > 0);
            const avg = totals.reduce((s, x) => s + x, 0) / (totals.length || 1);
            const lowDays = currentMonthDaily.filter(d => {
                const t = parseFloat(d.total) || 0;
                return t > 0 && avg > 0 && ((avg - t) / avg) > 0.2;
            });
            if (lowDays.length >= 2) {
                const sortedLow = [...lowDays].sort((a, b) => new Date(b.date) - new Date(a.date));
                alerts.push({
                    sev: 'med',
                    icon: 'ph-trend-down',
                    color: '#f59e0b',
                    html: `<b>${lowDays.length} día${lowDays.length > 1 ? 's' : ''}</b> bajo promedio (${fmt(avg)}/día)`,
                    meta: `Último: ${sortedLow[0].date.slice(5)}`,
                    details: {
                        type: 'days',
                        items: sortedLow.slice(0, 15).map(d => {
                            const t = parseFloat(d.total) || 0;
                            const dropPct = ((avg - t) / avg) * 100;
                            return {
                                name: new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' }),
                                right: `${fmt(t)}`,
                                sub: `caída -${dropPct.toFixed(0)}% vs. promedio`
                            };
                        })
                    }
                });
            }
        }

        // Si no hay alertas
        const alertsList = document.getElementById('ceo-alerts-list');
        const alertsCount = document.getElementById('ceo-alerts-count');
        if (alertsList) {
            if (alerts.length === 0) {
                alertsList.innerHTML = `
                    <div class="ceo-alert-item sev-low" style="border-left-color:#10b981; background:rgba(16,185,129,0.06);">
                        <i class="ph ph-check-circle main" style="color:#10b981;"></i>
                        <div class="ceo-alert-text">Sin alertas</div>
                    </div>`;
                if (alertsCount) { alertsCount.textContent = '0'; alertsCount.classList.add('zero'); }
            } else {
                alertsList.innerHTML = alerts.map((a, idx) => {
                    const hasDetails = a.details && a.details.items && a.details.items.length > 0;
                    const detailRows = hasDetails ? a.details.items.map(it => `
                        <div class="ceo-alert-detail-row">
                            <div class="cd-main">
                                <div class="cd-name">${window.Utils.escapeHTML(it.name)}</div>
                                ${it.sub ? `<div class="cd-sub">${window.Utils.escapeHTML(it.sub)}</div>` : ''}
                            </div>
                            ${it.right ? `<div class="cd-right">${it.right}</div>` : ''}
                        </div>`).join('') : '';
                    return `
                    <div class="ceo-alert-wrap">
                        <div class="ceo-alert-item sev-${a.sev} ${hasDetails ? 'expandable' : ''}" data-alert-idx="${idx}">
                            <i class="ph ${a.icon} main" style="color:${a.color};"></i>
                            <div class="ceo-alert-text">${a.html}</div>
                            <div class="ceo-alert-meta">${a.meta}</div>
                            ${hasDetails ? '<i class="ph ph-caret-down ceo-alert-caret"></i>' : ''}
                        </div>
                        ${hasDetails ? `
                            <div class="ceo-alert-details" data-alert-details="${idx}">
                                ${detailRows}
                                ${a.details.items.length < (a.details.total || a.details.items.length) ? `<div class="ceo-alert-more text-muted text-xs">Mostrando primeros ${a.details.items.length}.</div>` : ''}
                            </div>` : ''}
                    </div>`;
                }).join('');
                if (alertsCount) { alertsCount.textContent = alerts.length; alertsCount.classList.remove('zero'); }

                // Toggle expandible
                alertsList.querySelectorAll('.ceo-alert-item.expandable').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('a')) return; // No romper links internos
                        const idx = item.dataset.alertIdx;
                        const details = alertsList.querySelector(`[data-alert-details="${idx}"]`);
                        if (details) {
                            const open = details.classList.toggle('open');
                            item.classList.toggle('open', open);
                        }
                    });
                });
            }
            // CTA Márgenes al pie del panel de alertas
            const alertsCard = document.getElementById('ceo-alerts-card');
            if (alertsCard && !alertsCard.querySelector('.ceo-alerts-cta-link')) {
                const ctaDiv = document.createElement('div');
                ctaDiv.className = 'ceo-alerts-cta-link';
                ctaDiv.style.cssText = 'margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.07); display:flex; justify-content:flex-end;';
                ctaDiv.innerHTML = `<button onclick="window._goToMargenes()" style="display:flex; align-items:center; gap:6px; background:none; border:none; font-size:0.8rem; font-weight:700; color:#6366f1; cursor:pointer; padding:4px 0; opacity:0.85; transition:opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"><i class="ph ph-chart-line-up"></i> Ver análisis completo en Márgenes <i class="ph ph-arrow-right"></i></button>`;
                alertsCard.appendChild(ctaDiv);
            }
        }

        // ============================================================
        // PANEL DE DECISIONES (4 widgets compactos)
        // ============================================================
        try {

            // 1. QUÉ COMPRAR — basado en velocidad de venta actual vs mes anterior
            const daysElapsed = Math.max(now.getDate(), 1);
            const daysInPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
            const buyAnalysis = allProductsArr
                .filter(p => p.qty >= 3) // mínimo 3 vendidos para ser relevante
                .map(p => {
                    const dailyRate = p.qty / daysElapsed;
                    const prev = prevProductStats[p.name];
                    const prevQty = prev ? prev.qty : 0;
                    const prevDailyRate = daysInPrevMonth > 0 ? prevQty / daysInPrevMonth : 0;
                    // Proyección: cuánto necesitarás para el resto del mes
                    const daysRemaining = Math.max(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysElapsed, 0);
                    const projected = Math.ceil(dailyRate * daysRemaining);
                    // Aceleración: cuánto más rápido se vende vs mes pasado
                    const rawAcceleration = prevDailyRate > 0 ? ((dailyRate - prevDailyRate) / prevDailyRate) * 100 : (dailyRate > 0 ? 100 : 0);
                    const acceleration = Math.min(rawAcceleration, 200);
                    return { ...p, dailyRate, prevQty, prevDailyRate, projected, acceleration };
                })
                .sort((a, b) => {
                    // Prioridad: productos acelerando con alto volumen
                    const scoreA = a.dailyRate * (1 + Math.max(a.acceleration, 0) / 100);
                    const scoreB = b.dailyRate * (1 + Math.max(b.acceleration, 0) / 100);
                    return scoreB - scoreA;
                })
                .slice(0, 5);
            const decBuyEl = document.getElementById('dec-buy-list');
            if (decBuyEl) {
                decBuyEl.innerHTML = buyAnalysis.length ? buyAnalysis.map(p => {
                    let badge = '';
                    if (p.acceleration >= 200) {
                        badge = `<span style="color:#ef4444; font-weight:700; font-size:0.65rem;">🔥 x${(p.dailyRate / Math.max(p.prevDailyRate, 0.1)).toFixed(1)}</span>`;
                    } else if (p.acceleration > 30) {
                        badge = `<span style="color:#ef4444; font-weight:700; font-size:0.65rem;">↑${Math.round(p.acceleration)}%</span>`;
                    } else if (p.acceleration > 0) {
                        badge = `<span style="color:#f97316; font-weight:600; font-size:0.65rem;">↑${Math.round(p.acceleration)}%</span>`;
                    } else {
                        badge = `<span style="color:#6b7280; font-size:0.65rem;">${Math.round(p.dailyRate)}/día</span>`;
                    }
                    return `<div style="display:flex; justify-content:space-between; align-items:center;" title="Vendido: ${p.qty} uds (${Math.round(p.dailyRate)}/día) · Mes ant: ${p.prevQty} uds · Faltan ~${p.projected} uds para el mes">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;">${window.Utils.escapeHTML(p.name)}</span>
                        ${badge}
                    </div>`;
                }).join('') : '<span class="text-muted">Sin datos de ventas</span>';
            }

            // 2. SUBIR PRECIO — alto volumen + margen bajo (oportunidad)
            const priceUp = allProductsArr
                .filter(p => p.qty >= 5 && p.marginPct > 0 && p.marginPct < 15)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);
            const decPriceEl = document.getElementById('dec-price-list');
            if (decPriceEl) {
                decPriceEl.innerHTML = priceUp.length ? priceUp.map(p =>
                    `<div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;">${window.Utils.escapeHTML(p.name)}</span>
                        <span style="color:#f59e0b; font-weight:700;">${p.marginPct.toFixed(0)}%</span>
                    </div>`
                ).join('') : '<span class="text-muted">Todos sobre 15%</span>';
            }

            // 3. DÍA MÁS FLOJO — promedio por día de la semana
            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const dayTotals = [0,0,0,0,0,0,0], dayCounts = [0,0,0,0,0,0,0];
            eleventaSales.forEach(s => {
                if (!s.date) return;
                const d = window.Utils.parseLocalDate(s.date);
                if (d) {
                    const total = parseFloat(s.total) || 0;
                    if (total > 0) { dayTotals[d.getDay()] += total; dayCounts[d.getDay()]++; }
                }
            });
            const dayAvgs = dayTotals.map((t, i) => dayCounts[i] > 0 ? t / dayCounts[i] : 0);
            const bestDay = dayAvgs.indexOf(Math.max(...dayAvgs));
            const worstDay = dayAvgs.indexOf(Math.min(...dayAvgs.filter(a => a > 0)));
            const decDayEl = document.getElementById('dec-day-content');
            if (decDayEl && dayAvgs.some(a => a > 0)) {
                decDayEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#ef4444; font-weight:700; font-size:1.1rem;">${dayNames[worstDay]}</span>
                            <span>${fmt(Math.round(dayAvgs[worstDay]))}/día</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; opacity:0.7;">
                            <span style="color:#10b981; font-weight:600;">Mejor: ${dayNames[bestDay]}</span>
                            <span>${fmt(Math.round(dayAvgs[bestDay]))}/día</span>
                        </div>
                        <div style="display:flex; gap:2px; margin-top:4px;">
                            ${dayAvgs.map((avg, i) => {
                                const maxAvg = Math.max(...dayAvgs);
                                const pct = maxAvg > 0 ? (avg / maxAvg * 100) : 0;
                                const color = i === worstDay ? '#ef4444' : i === bestDay ? '#10b981' : '#cbd5e1';
                                return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                                    <div style="width:100%; height:30px; background:#f1f5f9; border-radius:3px; position:relative; overflow:hidden;">
                                        <div style="position:absolute; bottom:0; width:100%; height:${pct}%; background:${color}; border-radius:3px;"></div>
                                    </div>
                                    <span style="font-size:0.6rem; color:var(--text-muted);">${dayNames[i][0]}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>`;
            }

            // 4. FLUJO PRÓXIMO — caja neta proyectada (ventas promedio - pagos pendientes)
            const activeDays = dayAvgs.filter(a => a > 0).length || 1;
            const avgDailySales = dayAvgs.reduce((a, b) => a + b, 0) / activeDays;
            const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
            const projectedIncome = Math.round(avgDailySales * daysLeft);
            // Pagos pendientes: facturas crédito + sueldos estimados
            const pendingInvoices = invoices.filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente');
            const pendingTotal = pendingInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            const monthlyPayroll = employees.reduce((s, e) => s + (parseFloat(e.baseSalary) || 0), 0);
            const netFlow = projectedIncome - pendingTotal - monthlyPayroll;
            const decCashEl = document.getElementById('dec-cash-content');
            if (decCashEl) {
                decCashEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span>Ingreso est. (${daysLeft}d)</span>
                            <b style="color:#10b981;">${fmt(projectedIncome)}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Facturas pend.</span>
                            <b style="color:#ef4444;">-${fmt(pendingTotal)}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Sueldos</span>
                            <b style="color:#ef4444;">-${fmt(monthlyPayroll)}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(0,0,0,0.1); padding-top:4px; margin-top:2px;">
                            <span style="font-weight:700;">Neto est.</span>
                            <b style="color:${netFlow >= 0 ? '#10b981' : '#ef4444'}; font-size:0.9rem;">${fmt(netFlow)}</b>
                        </div>
                    </div>`;
            }
        } catch (e) { console.warn('Error panel decisiones:', e); }

        // ============================================================
        // FORMA DE PAGO (Donut) — desde eleventa_sales del mes
        // ============================================================
        const pagoBuckets = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Crédito: 0, Mixto: 0 };
        let tarjetaBrutaDonut = 0;
        currentMonthEleventa.forEach(s => {
            const total = parseFloat(s.total) || 0;
            if (total <= 0) return;
            const forma = (s.forma_pago || '').toLowerCase();
            if (forma.includes('transfer')) pagoBuckets.Transferencia += total;
            else if (forma.includes('tarjeta') || forma.includes('debito')) { pagoBuckets.Tarjeta += total; tarjetaBrutaDonut += total; }
            else if (forma.includes('credito') || forma.includes('fiado') || forma.includes('vale')) pagoBuckets['Crédito'] += total;
            else if (forma.includes('mixto')) pagoBuckets.Mixto += total;
            else pagoBuckets.Efectivo += total;
        });
        // Descontar comisión MP del bucket Tarjeta para reflejar ingreso real
        const comisionDonut = Math.round(tarjetaBrutaDonut * COMISION_MP);
        pagoBuckets.Tarjeta = Math.max(0, pagoBuckets.Tarjeta - comisionDonut);
        const pagoTotal = Object.values(pagoBuckets).reduce((s, x) => s + x, 0) || 1;
        const pagoColors = {
            Efectivo: '#10b981',
            Tarjeta: '#3b82f6',
            Transferencia: '#8b5cf6',
            'Crédito': '#f59e0b',
            Mixto: '#6b7280'
        };

        const pagoLegend = document.getElementById('ceo-payment-legend');
        if (pagoLegend) {
            const entries = Object.entries(pagoBuckets)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a);
            if (entries.length === 0) {
                pagoLegend.innerHTML = '<span class="text-muted text-xs">Sin datos este mes</span>';
            } else {
                pagoLegend.innerHTML = entries.map(([k, v]) => {
                    const pct = (v / pagoTotal) * 100;
                    return `<div class="leg-row">
                        <span class="leg-label"><span class="leg-dot" style="background:${pagoColors[k]};"></span>${k}</span>
                        <span class="leg-pct">${pct.toFixed(0)}%</span>
                    </div>`;
                }).join('');
            }
        }

        // Donut con Chart.js
        const donutCtx = document.getElementById('paymentDonut');
        if (donutCtx) {
            const existing = Chart.getChart('paymentDonut');
            if (existing) existing.destroy();
            const entries = Object.entries(pagoBuckets).filter(([, v]) => v > 0);
            if (entries.length > 0) {
                new Chart(donutCtx, {
                    type: 'doughnut',
                    data: {
                        labels: entries.map(([k]) => k),
                        datasets: [{
                            data: entries.map(([, v]) => v),
                            backgroundColor: entries.map(([k]) => pagoColors[k]),
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)}`
                                }
                            }
                        }
                    }
                });
            }
        }

        // ============================================================
        // CAJA REAL DEL MES (Ingresos − Egresos)
        //   Ingresos = ventas efectivo/transferencia + entradas de flujo_caja
        //   Egresos  = salidas + devoluciones de flujo_caja
        // ============================================================
        let entradasTotal = 0, salidasTotal = 0, devolucionesTotal = 0;
        try {
            const syncClient = window.SyncV2?.client;
            if (syncClient) {
                const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
                const { data: flujoData } = await syncClient.from('eleventa_flujo_caja')
                    .select('fecha,monto,tipo')
                    .gte('fecha', `${currentMonthStr}-01`)
                    .lt('fecha', nextMonthStr);
                if (flujoData) {
                    flujoData.forEach(f => {
                        const monto = Math.abs(parseFloat(f.monto) || 0);
                        const tipo = (f.tipo || '').toLowerCase();
                        if (tipo === 'entrada') entradasTotal += monto;
                        else if (tipo === 'salida') salidasTotal += monto;
                        // Ignorar devoluciones/repasados: tickets cancelados cuyo total=0
                        // ya se excluye de ventas, no hay que restar nada adicional.
                        else if (tipo === 'repasado' || tipo === 'devolucion' || tipo === 'devolución') { /* ignorar */ }
                    });
                }
            }
        } catch (e) { console.warn('No se pudo cargar flujo_caja para caja real:', e); }

        const ingresosCash = pagoBuckets.Efectivo + pagoBuckets.Transferencia; // dinero que entra "real"
        const ingresosTotal = ingresosCash + entradasTotal;
        const egresosTotal = salidasTotal + devolucionesTotal;
        const cajaNeta = ingresosTotal - egresosTotal;

        const cashValEl = document.getElementById('ceo-cash-net');
        const cashBreakdown = document.getElementById('ceo-cash-breakdown');
        const cashSub = document.getElementById('ceo-cash-sub');
        if (cashValEl) {
            cashValEl.innerHTML = fmt(cajaNeta);
            cashValEl.style.color = cajaNeta >= 0 ? '#059669' : '#dc2626';
        }
        if (cashSub) cashSub.innerHTML = `${fmt(ingresosTotal)} ingresos − ${fmt(egresosTotal)} egresos`;
        if (cashBreakdown) {
            cashBreakdown.innerHTML = `
                <div class="row"><span class="text-muted">Ventas efectivo + transf.</span><b style="color:#059669;">${fmt(ingresosCash)}</b></div>
                <div class="row"><span class="text-muted">Entradas caja</span><b style="color:#059669;">${fmt(entradasTotal)}</b></div>
                <div class="row"><span class="text-muted">Salidas caja</span><b style="color:#dc2626;">−${fmt(salidasTotal)}</b></div>
            `;
        }

        // ============================================================
        // TICKET PROMEDIO + TENDENCIA
        // ============================================================
        const validToday = todayEleventa.filter(s => parseFloat(s.total) > 0);
        const avgToday = validToday.length > 0
            ? validToday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) / validToday.length
            : 0;

        const validMonth = currentMonthEleventa.filter(s => parseFloat(s.total) > 0);
        const avgMonth = validMonth.length > 0
            ? validMonth.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) / validMonth.length
            : 0;

        const validPrev = prevMonthEleventa.filter(s => parseFloat(s.total) > 0);
        const avgPrev = validPrev.length > 0
            ? validPrev.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) / validPrev.length
            : 0;

        const avgTicketEl = document.getElementById('ceo-avg-ticket');
        const avgSubEl = document.getElementById('ceo-avg-ticket-sub');
        const avgFootEl = document.getElementById('ceo-avg-ticket-foot');
        if (avgTicketEl) avgTicketEl.innerHTML = fmt(avgMonth);
        if (avgSubEl) avgSubEl.innerHTML = `${validMonth.length} tickets este mes · hoy ${fmt(avgToday)}`;
        if (avgFootEl) {
            if (avgPrev > 0) {
                const delta = ((avgMonth - avgPrev) / avgPrev) * 100;
                const cls = Math.abs(delta) < 1 ? 'flat' : (delta > 0 ? 'up' : 'down');
                const arrow = Math.abs(delta) < 1 ? '=' : (delta > 0 ? '▲' : '▼');
                avgFootEl.innerHTML = `<span class="ceo-delta ${cls}">${arrow} ${Math.abs(delta).toFixed(1)}% vs ${prevMonthDate.toLocaleDateString('es-ES', { month: 'long' })}</span>`;
            } else {
                avgFootEl.innerHTML = `<span class="ceo-delta flat">sin histórico previo</span>`;
            }
        }

        // ---- Top Proveedores ----

        const supplierSpend = {};
        invoices.forEach(i => {
            if (!i.supplierId) return;
            supplierSpend[i.supplierId] = (supplierSpend[i.supplierId] || 0) + (parseFloat(i.amount) || 0);
        });
        const topSuppliers = Object.entries(supplierSpend)
            .sort(([, a], [, b]) => b - a).slice(0, 4);
        const maxSpend = topSuppliers[0]?.[1] || 1;
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981'];

        document.getElementById('top-suppliers').innerHTML = topSuppliers.length === 0
            ? '<p style="color:var(--text-muted);font-size:0.85rem;">Sin datos de proveedores</p>'
            : topSuppliers.map(([id, amount], idx) => `
                    <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                        <span style="font-size:0.83rem;font-weight:600;color:var(--text-primary);">${Utils.escapeHTML(supplierMap[id] || 'Desconocido')}</span>
                        <span style="font-size:0.8rem;font-weight:700;color:${colors[idx]};">${fmt(amount)}</span>
                    </div>
                    <div class="supplier-bar-bg">
                        <div class="supplier-bar-fill" style="width:0%;background:${colors[idx]};" data-width="${(amount / maxSpend * 100).toFixed(1)}"></div>
                    </div>
                </div>
                    `).join('');

        // Animate supplier bars
        setTimeout(() => {
            document.querySelectorAll('.supplier-bar-fill').forEach(b => {
                b.style.width = b.dataset.width + '%';
            });
        }, 200);

        // ---- P&L 6 Months Chart (PRO EDITION) ----
        // Pre-agrupar eleventa_sales por mes (una sola pasada)
        const elevByMonth = new Map();
        eleventaSales.forEach(s => {
            if (!s.date) return;
            const ms = s.date.substring(0, 7);
            elevByMonth.set(ms, (elevByMonth.get(ms) || 0) + (parseFloat(s.total) || 0));
        });

        const months6Labels = [];
        const months6Sales = [];
        const months6Costs = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months6Labels.push(d.toLocaleDateString('es-ES', { month: 'short' }));
            // Eleventa primero; fallback a daily_sales para meses históricos previos a Eleventa
            months6Sales.push(elevByMonth.get(mStr) || dailySales.filter(s => s.date && s.date.startsWith(mStr)).reduce((s, d) => s + (parseFloat(d.total) || 0), 0));
            months6Costs.push(invoices.filter(inv => inv.date && inv.date.startsWith(mStr)).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0));
        }


        const plCtx = document.getElementById('plChart').getContext('2d');
        const plGradientV = plCtx.createLinearGradient(0, 0, 0, 250);
        plGradientV.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        plGradientV.addColorStop(1, 'rgba(16, 185, 129, 0)');

        const plGradientG = plCtx.createLinearGradient(0, 0, 0, 250);
        plGradientG.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        plGradientG.addColorStop(1, 'rgba(239, 68, 68, 0)');

        const existPL = Chart.getChart('plChart');
        if (existPL) existPL.destroy();

        new Chart(plCtx, {
            type: 'line',
            data: {
                labels: months6Labels,
                datasets: [
                    {
                        label: 'Ventas',
                        data: months6Sales,
                        borderColor: '#10b981',
                        backgroundColor: plGradientV,
                        fill: true, tension: 0.4, pointRadius: 4,
                        borderWidth: 3, pointBackgroundColor: '#fff',
                        pointBorderWidth: 2, pointBorderColor: '#10b981'
                    },
                    {
                        label: 'Compras',
                        data: months6Costs,
                        borderColor: '#ef4444',
                        backgroundColor: plGradientG,
                        fill: true, tension: 0.4, pointRadius: 4,
                        borderWidth: 3, pointBackgroundColor: '#fff',
                        pointBorderWidth: 2, pointBorderColor: '#ef4444'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { weight: '600' } } },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12, cornerRadius: 10,
                        titleFont: { size: 14, weight: '700' },
                        bodyFont: { size: 13 },
                        displayColors: true
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
            }
        });

        // (Gráfico de Distribución por Hora eliminado — usaba datos aleatorios, no reales)

        // ---- Sparklines for KPIs ----
        const createSpark = (id, data, color) => {
            const canvas = document.getElementById(id);
            if (!canvas) return;
            // Destroy any existing chart on this canvas before recreating
            const existing = Chart.getChart(canvas);
            if (existing) existing.destroy();
            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map((_, i) => i),
                    datasets: [{
                        data: data,
                        borderColor: color,
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
        };

        // Build real sparkline data from last 6 months
        const sparkMonths = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            sparkMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const sparkVentas = sparkMonths.map(m => elevByMonth.get(m) || 0);
        const sparkGastos = sparkMonths.map(m => {
            return allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(m))
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        });
        createSpark('spark-ventas', sparkVentas, '#10b981');
        createSpark('spark-gastos', sparkGastos, '#ef4444');

        // ---- Payments widget ----
        try {
            document.getElementById('upcoming-payments-list').innerHTML = await window.Utils.calculateNextPayments(employees);
        } catch { document.getElementById('upcoming-payments-list').innerHTML = '<p style="color:var(--text-muted);">No disponible</p>'; }

        // ---- Credit widget ----
        const creditPending = invoices.filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente' && i.dueDate);
        const totalCredit = creditPending.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const today0 = new Date(); today0.setHours(0, 0, 0, 0);
        const overdue = creditPending.filter(i => new Date(i.dueDate) < today0);
        const dueSoon = creditPending.filter(i => { const d = new Date(i.dueDate); const diff = Math.ceil((d - today0) / 86400000); return diff >= 0 && diff <= 7; });

        const creditEl = document.getElementById('credit-widget-content');
        if (creditPending.length === 0) {
            creditEl.innerHTML = '<p style="color:#16a34a;font-weight:600;">✅ Sin deudas a crédito</p>';
        } else {
            creditEl.innerHTML = `
                <div style="font-size:1.2rem;font-weight:700;color:#92400e;">${fmt(totalCredit)}</div>
                    <div style="font-size:0.82rem;color:#78350f;">${creditPending.length} factura${creditPending.length > 1 ? 's' : ''} pendiente${creditPending.length > 1 ? 's' : ''}</div>
                ${overdue.length ? `<div style="color:#dc2626;font-weight:700;font-size:0.82rem;margin-top:4px;">🚨 ${overdue.length} vencida${overdue.length > 1 ? 's' : ''}</div>` : ''}
                ${dueSoon.length ? `<div style="color:#ea580c;font-size:0.8rem;margin-top:2px;">⏰ ${dueSoon.length} vence esta semana</div>` : ''}
            `;
        }
        document.getElementById('credit-widget').addEventListener('click', () => {
            document.querySelector('[data-view="purchase_invoices"]')?.click();
        });

        // ---- Weekly overdue summary ----
        const end7 = new Date(today0); end7.setDate(end7.getDate() + 7);
        const dueThisWeek = creditPending.filter(i => { const d = new Date(i.dueDate); return d >= today0 && d <= end7; })
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        if (dueThisWeek.length > 0) {
            document.getElementById('weekly-summary-container').classList.remove('hidden');
            document.getElementById('weekly-summary-list').innerHTML = dueThisWeek.map(i => {
                const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0);
                const dl = Math.ceil((d - today0) / 86400000);
                const col = dl === 0 ? '#dc2626' : dl <= 2 ? '#ea580c' : '#d97706';
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:rgba(255,255,255,0.6);border-radius:8px;border:1px solid rgba(217,119,6,0.2);">
                    <span style="font-weight:700;color:var(--text-primary);font-size:0.88rem;">${supplierMap[i.supplierId] || '?'} <span style="color:var(--text-muted);font-weight:400;">#${i.invoiceNumber || ''}</span></span>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <span style="font-weight:700;">${fmt(parseFloat(i.amount) || 0)}</span>
                        <span style="background:${col};color:white;padding:2px 8px;border-radius:10px;font-size:0.78rem;font-weight:700;">${dl === 0 ? '¡HOY!' : dl + 'd'}</span>
                    </div>
                </div>`;
            }).join('');
        }

        // ---- Expiry Alerts ----
        const expiringSoon = products.filter(p => {
            if (!p.expiryDate) return false;
            return (new Date(p.expiryDate) - now) / 86400000 <= 30;
        }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

        const expiryContainer = document.getElementById('expiry-alerts-container');
        if (expiryContainer && expiringSoon.length > 0) {
            expiryContainer.classList.remove('hidden');
            document.getElementById('expiry-alerts-list').innerHTML = expiringSoon.map(p => {
                const diff = Math.ceil((new Date(p.expiryDate) - now) / 86400000);
                const col = diff <= 7 ? 'var(--danger)' : '#f59e0b';
                return `<div style="padding:10px;border:1px solid rgba(0,0,0,0.05);border-radius:8px;display:flex;align-items:center;gap:10px;background:var(--bg-card);">
                    <i class="ph ${diff <= 7 ? 'ph-prohibit' : 'ph-clock-countdown'}" style="font-size:1.4rem;color:${col};"></i>
                    <div>
                        <div style="font-weight:700;font-size:0.88rem;">${window.Utils.escapeHTML(p.name)}</div>
                        <div style="font-size:0.75rem;color:${col};font-weight:600;">Vence en ${diff} días</div>
                    </div>
                </div>`;
            }).join('');
        }

        // Pago Contadora quick-register (usado por alerta en Alertas Inteligentes)
        window._showAccountantQuickPay = () => {
            const val = prompt('Ingresa el monto pagado a la contadora:', '0');
            const amount = parseFloat(val);
            if (!isNaN(amount) && amount > 0) {
                const today = new Date().toISOString().split('T')[0];
                window.DataManager.saveAndSync('expenses', {
                    title: 'Pago Contadora - ' + new Date().toLocaleDateString('es-ES', { month: 'long' }),
                    amount: amount,
                    category: 'Contabilidad',
                    date: today,
                    deleted: false
                }).then(res => {
                    if (res.success) {
                        window.showToast('Pago registrado correctamente.', 'success');
                        window.Views.dashboard(container); // Refresh
                    }
                });
            }
        };

        // ---- (Actividad Reciente removed) ----

        // ---- Export Excel ----
        document.getElementById('btn-export-excel').addEventListener('click', async () => {
            const btn = document.getElementById('btn-export-excel');
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Preparando...'; btn.disabled = true;
            try {
                const [allEmps, lgs, prods] = await Promise.all([window.db.employees.toArray(), window.db.workLogs.toArray(), window.db.products.toArray()]);
                const emps = allEmps.filter(e => !e.deleted);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(e => ({ ID: e.id, Nombre: e.name, Rol: e.role, Salario: e.baseSalary || 0 }))), 'Personal');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lgs.filter(l => !l.deleted).map(l => { const e = emps.find(x => x.id === l.employeeId); return { Empleado: e?.name || 'Eliminado', Fecha: l.date, Horas: l.totalHours, Pago: l.payAmount }; })), 'Asistencia');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prods.map(p => ({ Nombre: p.name, Costo: p.costUnit, Precio: p.salePrice, Stock: p.stock || 0 }))), 'Inventario');
                XLSX.writeFile(wb, `Reporte_ElMaravilloso_${todayStr}.xlsx`);
            } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
            finally { btn.innerHTML = '<i class="ph ph-file-xls" style="font-size:1.1rem;"></i> <span class="hide-mobile">Exportar Excel</span>'; btn.disabled = false; }
        });

        // ── LISTENER: Actualizar Dashboard en tiempo real cuando hay cambios en Supabase ──
        // Usa debounce de 500ms para no re-renderizar si llegan varios eventos seguidos

        // Limpiar listener anterior para evitar acumulación en visitas repetidas
        if (window._dashboardSyncHandler) {
            document.removeEventListener('sync-data-updated', window._dashboardSyncHandler);
            window._dashboardSyncHandler = null;
        }
        if (window._dashRefreshTimer) {
            clearTimeout(window._dashRefreshTimer);
            window._dashRefreshTimer = null;
        }
        if (window._dashboardObserver) {
            window._dashboardObserver.disconnect();
            window._dashboardObserver = null;
        }

        window._dashboardSyncHandler = (event) => {
            const changedTables = event.detail?.tables || [];
            // Si no hay tablas especificadas, no refrescar (evita renders vacíos)
            if (changedTables.length === 0) return;
            // Refrescar solo si cambiaron las tablas clave del dashboard
            const relevantTables = ['daily_sales', 'expenses', 'employees', 'products', 'workLogs', 'purchase_invoices', 'eleventa_sales', 'suppliers', 'reminders', 'loans'];
            if (!changedTables.some(t => relevantTables.includes(t))) return;

            // CRÍTICO: Verificar que el Dashboard es lo que está visible AHORA.
            // container (#view-container) siempre está en el DOM, así que solo verificar
            // con isConnected no es suficiente — hay que confirmar que el contenido
            // actual es el dashboard y no otra vista (ej. facturas).
            const isDashboardVisible = !!document.getElementById('kpi-ventas-mes') ||
                                       !!document.getElementById('tab-resumen');
            if (!isDashboardVisible) return;

            // Throttle: refrescar máximo cada 3s aunque sigan llegando datos en ráfaga.
            // El debounce puro (clearTimeout + setTimeout) nunca ejecuta si los eventos
            // llegan más rápido que el delay, dejando el dashboard congelado.
            const now = Date.now();
            const MIN_INTERVAL = 3000;
            if (!window._dashLastRefresh) window._dashLastRefresh = 0;

            if (now - window._dashLastRefresh >= MIN_INTERVAL) {
                // Ya pasó suficiente tiempo, refrescar inmediato
                window._dashLastRefresh = now;
                if (window._dashRefreshTimer) { clearTimeout(window._dashRefreshTimer); window._dashRefreshTimer = null; }
                window.Views.dashboard(container, selectedMonth);
            } else if (!window._dashRefreshTimer) {
                // Programar un refresh para cuando se cumpla el intervalo
                const delay = MIN_INTERVAL - (now - window._dashLastRefresh);
                window._dashRefreshTimer = setTimeout(() => {
                    window._dashRefreshTimer = null;
                    window._dashLastRefresh = Date.now();
                    if (!document.getElementById('kpi-ventas-mes') && !document.getElementById('tab-resumen')) return;
                    window.Views.dashboard(container, selectedMonth);
                }, delay);
            }
        };
        document.addEventListener('sync-data-updated', window._dashboardSyncHandler);

        // Cleanup: remover listener si el container cambia de vista
        const observerTarget = container.parentNode || document.body;
        window._dashboardObserver = new MutationObserver(() => {
            // Si los elementos del dashboard ya no están, cleanup
            if (!document.getElementById('kpi-ventas-mes') && !document.getElementById('tab-resumen')) {
                if (window._dashRefreshTimer) { clearTimeout(window._dashRefreshTimer); window._dashRefreshTimer = null; }
                if (window._dashboardSyncHandler) {
                    document.removeEventListener('sync-data-updated', window._dashboardSyncHandler);
                    window._dashboardSyncHandler = null;
                }
                if (window._dashboardObserver) {
                    window._dashboardObserver.disconnect();
                    window._dashboardObserver = null;
                }
            }
        });
        window._dashboardObserver.observe(container, { childList: true, subtree: false });

    } catch (e) {
        console.error('Dashboard error:', e);
        if (container && container.isConnected) {
            container.innerHTML += `<p style="color:red;">Error cargando datos: ${window.Utils.escapeHTML(e.message)}</p>`;
        }
    }
};

// ---- Helper: render % badge ----
function renderBadge(id, current, prev, invertGood) {
    const el = document.getElementById(id);
    if (!el) return;
    if (prev === 0) { el.className = 'status-badge status-paid'; el.innerHTML = 'Nuevos datos'; return; }
    const pct = ((current - prev) / prev * 100).toFixed(1);
    const isUp = current > prev;
    // invertGood=true means UP is BAD (gastos), false means UP is GOOD (ventas)
    const good = invertGood ? !isUp : isUp;
    el.className = `status-badge ${good ? 'status-paid' : 'status-overdue'}`;
    el.innerHTML = `<i class="ph ph-trend-${isUp ? 'up' : 'down'}"></i> ${isUp ? '+' : ''}${pct}% vs mes ant.`;
}

// Alias to keep compatibility if any nav still references reports
window.Views.reports = (container) => {
    window.Views.dashboard(container);
};


