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

        .premium-card { background:var(--bg-card); border-radius:18px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.05); transition:all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); border:1px solid rgba(0,0,0,0.02); }
        .premium-card:hover { transform: translateY(-4px); box-shadow: 0 15px 35px rgba(0,0,0,0.08); }

        /* KPI Card Animated */
        .kpi-card { position:relative; overflow:hidden; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .kpi-card:hover { transform:translateY(-5px) scale(1.02); box-shadow:0 12px 40px rgba(0,0,0,0.1); }
        
        .stat-value-mega { font-size: clamp(2.5rem, 5vw, 4rem); line-height: 1; font-weight: 900; letter-spacing: -2px; }
        .stat-label-premium { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 8px; }

        /* Card animation */
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .card-anim { animation: slideUp 0.5s ease backwards; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }

        /* ---- Dash Header responsive ---- */
        .dash-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem; }
        .dash-header-btns { display:flex; gap:0.75rem; }

        /* ---- PL Chart container ---- */
        .pl-chart-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        /* ---- Bottom 2-widget row ---- */
        .bottom-widgets-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        /* ---- MOBILE OVERRIDES ---- */
        @media (max-width: 768px) {
            .pl-chart-grid { grid-template-columns: 1fr; }
            .bottom-widgets-grid { grid-template-columns: 1fr; }
            .dash-header { margin-bottom: 1rem; }
            .premium-card, .card { padding: 16px !important; }
            .text-3xl { font-size: 1.5rem !important; }
            
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

        /* Live Sales Feed */
        .live-sales-scroller {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 10px 5px 20px 5px;
            scrollbar-width: thin;
            -ms-overflow-style: none;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            cursor: grab;
            /* Evitar que el contenido se expanda y rompa el layout */
            max-width: 100%;
            box-sizing: border-box;
        }
        .live-sales-scroller::-webkit-scrollbar { height: 4px; }
        .live-sales-scroller::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 2px; }
        .live-sales-scroller::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }
        .live-sales-scroller.dragging { cursor: grabbing; user-select: none; }
        
        .live-ticket-card { min-width: 200px; flex-shrink: 0; background: var(--bg-card); border-radius: 16px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--border); scroll-snap-align: start; position: relative; overflow: hidden; }
        .live-ticket-card.new { animation: pulseNew 2s infinite; border-color: #10b981; }
        @keyframes pulseNew { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        
        .live-ticket-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .live-ticket-icon { width: 32px; height: 32px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .live-ticket-profit { position: absolute; bottom: 10px; right: 10px; font-size: 1.5rem; opacity: 0.05; color: #10b981; transform: rotate(-15deg); }

        /* Estrellas del Negocio — scroll horizontal táctil y con ratón */
        #top-margin-list {
            display: flex;
            gap: 16px;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 12px;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            cursor: grab;
            max-width: 100%;
            box-sizing: border-box;
            scrollbar-width: thin;
        }
        #top-margin-list::-webkit-scrollbar { height: 4px; }
        #top-margin-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); border-radius: 2px; }
        #top-margin-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }
        #top-margin-list.dragging { cursor: grabbing; user-select: none; }

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

        /* Pista visual: indicador de scroll disponible en contenedores horizontales */
        @media (max-width: 768px) {
            .live-sales-scroller, #top-margin-list, .h-scroll-container {
                /* En móvil nunca mostrar cursor de escritorio */
                cursor: default;
            }
        }
    </style>

    <!-- Header -->
    <div class="dash-header">
        <div>
            <h1 class="text-primary font-bold flex items-center gap-3 text-2xl">
                <i class="ph ph-squares-four"></i> Resumen de Negocio
                <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.1); padding:4px 10px; border-radius:8px; border:1px solid rgba(16,185,129,0.2); margin-left:10px;">
                    <i class="ph ph-shield-check" style="color:#10b981; font-size:1rem;"></i>
                    <span style="font-size:0.65rem; color:#10b981; font-weight:800; letter-spacing:0.5px; text-transform:uppercase;">Protegido</span>
                </div>
            </h1>
            <p class="text-muted text-sm mt-1">Sincronización en tiempo real activa 🛰️</p>
        </div>
        <div class="dash-header-btns">
            <select id="dash-month-selector" class="btn bg-glass" style="border:1px solid rgba(0,0,0,0.1); font-weight:bold; cursor:pointer; color:var(--text-primary);">
                <option value="">Cargando...</option>
            </select>
            <button id="btn-export-excel" class="btn btn-premium" style="background:var(--grad-success); box-shadow: 0 10px 20px rgba(0, 200, 83, 0.2);">
                <i class="ph ph-file-xls"></i> <span class="hide-mobile">Excel</span>
            </button>
            <button id="btn-whatsapp-report" class="btn btn-premium" style="background:#25D366; box-shadow: 0 10px 20px rgba(37, 211, 102, 0.2);">
                <i class="ph ph-whatsapp-logo"></i> <span class="hide-mobile">WhatsApp</span>
            </button>
        </div>
    </div>

    <!-- Quick-access tabs (replaces sidebar items) -->
    <div style="display:flex; gap:0; background:var(--bg-input); border-radius:14px; padding:4px; margin-bottom:20px; width:fit-content; box-shadow:0 1px 4px rgba(0,0,0,0.07); flex-wrap:wrap;">
        <button id="dash-tab-resumen" onclick="window._switchDashTab('resumen')" style="padding:8px 18px; border:none; border-radius:10px; font-weight:600; font-size:0.85rem; cursor:pointer; transition:all 0.2s; background:var(--primary); color:white;">
            <i class="ph ph-squares-four"></i> Dashboard
        </button>
        <button id="dash-tab-reportes" onclick="window._switchDashTab('reportes')" style="padding:8px 18px; border:none; border-radius:10px; font-weight:600; font-size:0.85rem; cursor:pointer; transition:all 0.2s; background:transparent; color:var(--text-muted);">
            <i class="ph ph-chart-bar"></i> Historial
        </button>
        <button id="dash-tab-calc" onclick="window._switchDashTab('calc')" style="padding:8px 18px; border:none; border-radius:10px; font-weight:600; font-size:0.85rem; cursor:pointer; transition:all 0.2s; background:transparent; color:var(--text-muted);">
            <i class="ph ph-calculator"></i> Calculadora
        </button>
        <button id="dash-tab-marketing" onclick="window._switchDashTab('marketing')" style="padding:8px 18px; border:none; border-radius:10px; font-weight:600; font-size:0.85rem; cursor:pointer; transition:all 0.2s; background:transparent; color:var(--text-muted);">
            <i class="ph ph-megaphone"></i> Marketing
        </button>
    </div>

    <!-- Embedded sub-view (reports / calculator / marketing) -->
    <div id="dash-subview" style="display:none; margin-bottom:20px;"></div>

    <!-- ===================== TAB 1: RESUMEN ===================== -->
    <div id="tab-resumen" class="dash-tab-content active">

        <!-- Alertas semanales y Notificaciones Urgentes -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:24px;">
            <!-- Notificaciones Urgentes (Contadora) -->
            <div id="urgent-notifications-container" class="hidden">
                <div class="premium-card" style="border-left:6px solid #ef4444; background:rgba(239,68,68,0.05);">
                    <h3 class="text-danger font-bold flex items-center gap-2 mb-4 text-base">
                        <i class="ph ph-warning-circle text-xl pulse"></i> NOTIFICACIONES URGENTES
                    </h3>
                    <div id="urgent-notifications-list" class="flex-col gap-3"></div>
                </div>
            </div>

            <!-- Vencimientos semanales -->
            <div id="weekly-summary-container" class="hidden">
                <div class="premium-card" style="border-left:6px solid #f59e0b; background:rgba(245,158,11,0.05);">
                    <h3 class="text-warning font-bold flex items-center gap-2 mb-4 text-base">
                        <i class="ph ph-calendar-check text-xl"></i> Vencimientos Esta Semana
                    </h3>
                    <div id="weekly-summary-list" class="flex-col gap-3"></div>
                </div>
            </div>
        </div>

        <!-- KPI Cards con Estética Premium -->
        <div class="grid grid-cols-auto gap-6 mb-8">
            <!-- Ventas mes -->
            <div class="premium-card card-anim" style="border-top:5px solid #10b981; background: linear-gradient(180deg, rgba(16,185,129,0.05) 0%, white 100%);">
                <div class="flex justify-between items-start mb-6">
                    <div class="p-3 rounded-2xl" style="background:rgba(16,185,129,0.1); color:#10b981;">
                        <i class="ph ph-chart-line-up text-3xl"></i>
                    </div>
                    <div id="kpi-ventas-mes-badge" class="status-badge" style="background:rgba(16,185,129,0.1); color:#059669; border:1px solid rgba(16,185,129,0.2);">Calculando...</div>
                </div>
                <div class="stat-label-premium">Ventas del Mes</div>
                <div id="kpi-ventas-mes" class="stat-value-mega text-primary mt-1">...</div>
                <div class="spark-container mt-6"><canvas id="spark-ventas"></canvas></div>
            </div>

            <!-- Gasto mes -->
            <div class="premium-card card-anim delay-1" style="border-top:5px solid var(--primary); background: linear-gradient(180deg, rgba(230,0,0,0.03) 0%, white 100%);">
                <div class="flex justify-between items-start mb-6">
                    <div class="p-3 rounded-2xl" style="background:rgba(230,0,0,0.1); color:var(--primary);" title="Incluye: Sueldos de Yamileth/Personal y Gastos del Local. NO incluye facturas de mercadería.">
                        <i class="ph ph-hand-coins text-3xl"></i>
                    </div>
                    <div id="kpi-gasto-mes-badge" class="status-badge status-overdue">Fijos + Sueldos</div>
                </div>
                <div class="stat-label-premium text-primary">Gastos Operativos <i class="ph ph-info" title="No incluye facturas de compra/inventario. Solo gastos puros del local y nómina."></i></div>
                <div id="kpi-gasto-mes" class="stat-value-mega text-primary mt-1">...</div>
                <div class="spark-container mt-6"><canvas id="spark-gastos"></canvas></div>
            </div>

            <!-- Margen Neto / Salud -->
            <div class="premium-card card-anim delay-2" style="border-top:5px solid #84cc16; background: linear-gradient(180deg, rgba(132,204,22,0.05) 0%, white 100%);">
                <div class="flex justify-between items-start mb-6">
                    <div class="p-3 rounded-2xl" style="background:rgba(132,204,22,0.1); color:#84cc16;">
                        <i class="ph ph-heartbeat text-3xl"></i>
                    </div>
                    <div id="health-label" class="status-badge" style="background:rgba(132,204,22,0.1); color:#65a30d; font-weight:700;">Salud</div>
                </div>
                <div class="stat-label-premium">Rentabilidad</div>
                <div class="flex items-baseline gap-3">
                    <div id="kpi-margen-neto" class="stat-value-mega mt-1" style="color:#65a30d;">...</div>
                    <div id="health-ratio-pct" class="text-sm font-black text-muted">0%</div>
                </div>
                <div id="health-bar-wrap" class="w-full h-3 rounded-full overflow-hidden mt-6" style="background:rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.03);">
                    <div id="health-bar" class="h-full" style="width:0%; background:linear-gradient(90deg, #84cc16, #22c55e); transition:width 1s ease;"></div>
                </div>
                <div id="health-detail" class="text-xs text-muted mt-4 font-medium italic">Calculando métricas de salud...</div>
            </div>
        </div>

        <!-- 🧠 IA PREDICTIVE PANEL (Secondary Priority) -->
        <div id="prediction-container" class="hidden" style="margin-bottom:24px;">
            <div class="premium-card card-anim" style="background: var(--ia-panel-bg); color: var(--ia-panel-text); border: none; position: relative; overflow: hidden; padding: 18px;">
                <!-- Decorative background elements -->
                <div style="position: absolute; top: -30px; right: -30px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%); border-radius: 50%; filter: blur(40px);"></div>
                
                <div class="predict-header" style="gap: 8px;">
                    <div style="flex: 1;">
                        <div id="label-ia-title" style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 0.65rem; color: var(--ia-accent); font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                            <i class="ph ph-sparkle-fill"></i> Inteligencia Predictiva
                        </div>
                        <h2 class="predict-title" style="font-size: 1.8rem; margin-bottom: 4px;">
                            <span id="predict-total" style="background: linear-gradient(to right, var(--ia-panel-text), var(--ia-muted)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">...</span>
                            <span id="predict-month-label" style="font-size: 0.8rem; font-weight: 500; color: var(--ia-muted); opacity: 0.8;">est. Abril</span>
                        </h2>
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <div id="predict-comparison" style="font-size: 0.8rem; display: flex; align-items: center; gap: 6px;"></div>
                            <div id="predict-record" style="font-size: 0.7rem; color: var(--ia-muted); font-weight: 500;">
                                Récord: <span id="predict-record-value" style="color: #fbbf24; font-weight: 700;">...</span>
                            </div>
                        </div>
                    </div>
                    <div class="predict-badge-container" style="text-align: right; flex-shrink: 0;">
                        <div id="predict-confidence" class="predict-badge" style="font-size: 0.6rem; padding: 4px 10px;">
                            Calc...
                        </div>
                    </div>
                </div>

                <!-- AI Strategic Insight (Compact) -->
                <div id="predict-insight-box" style="margin-top: 16px; padding: 10px 14px; background: rgba(99, 102, 241, 0.06); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.1); display: flex; align-items: center; gap: 8px; position: relative; z-index: 1;">
                    <div id="predict-insight-dot" style="width: 5px; height: 5px; border-radius: 50%; background: #6366f1; box-shadow: 0 0 6px #6366f1;"></div>
                    <span id="predict-insight-text" style="color: var(--ia-panel-text); font-size: 0.8rem; font-weight: 600; line-height: 1.2;">Analizando datos...</span>
                </div>

                <!-- Growth Progress (Thin) -->
                <div style="margin-top: 16px; position: relative; z-index: 1;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--ia-muted); margin-bottom: 6px; font-weight: 700; letter-spacing: 0.5px;">
                        <span id="label-ia-meta">AVANCE MENSUAL</span>
                        <span id="predict-percent" style="color: var(--ia-accent); font-weight: 800;">0%</span>
                    </div>
                    <div style="height: 6px; background: var(--ia-glass); border-radius: 99px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03);">
                        <div id="predict-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1); background-size: 200% 100%; animation: shimmer 3s infinite linear; border-radius: 99px; transition: width 1.5s ease-out;"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="dash-header flex justify-between items-center mb-4 mt-8">
            <h3 class="text-primary font-bold text-lg flex items-center gap-2">
                <div class="pulsing-dot" style="width:10px;height:10px;background:#ef4444;border-radius:50%;box-shadow:0 0 10px #ef4444;"></div>
                Ventas en Directo (Caja)
            </h3>
            <button class="btn btn-secondary" onclick="document.querySelector('[data-view=\\'daily_sales\\']')?.click()" style="padding: 6px 12px; font-size: 0.85rem;">
                <i class="ph ph-calendar-check"></i> Ver Cierres de Caja Diarios
            </button>
        </div>
        <div class="card p-0 mb-8 overflow-hidden" style="border: 1px solid rgba(239, 68, 68, 0.2); background: transparent; backdrop-filter: none; box-shadow: none;">
            <div id="live-sales-feed" class="live-sales-scroller">
                <!-- Tarjetas cargadas por JS -->
            </div>
            <div class="p-3 bg-glass flex justify-between items-center text-sm" style="border-radius: 12px; margin-top: 10px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                <span class="text-muted" style="font-weight:600;">Tickets: <b id="live-sales-count" class="text-primary" style="font-size:1.1rem;">0</b></span>
                <span class="text-muted" style="font-weight:600;">Total Cajas: <b id="live-sales-total" style="color:#10b981; font-size:1.2rem;">$0</b></span>
            </div>
        </div>

        <!-- Top Productos -->
        <!-- Estrellas del Negocio (Mayor Margen Total) -->
        <div class="premium-card mb-8" style="background:linear-gradient(135deg, #022c22, #064e3b); color: white; border:1px solid #10b981; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.2);">
             <div class="flex flex-col mb-4">
                 <h3 class="font-bold flex items-center gap-2" style="color:#34d399; font-size:1.15rem;">
                     <i class="ph ph-crown text-2xl pulsing-dot"></i> Estrellas del Negocio
                 </h3>
                 <span style="font-size:0.75rem; color:#6ee7b7; opacity:0.8; margin-left:2rem;">Mayor volumen de dinero (ganancia neta) aportado este mes — deslizá para ver más →</span>
             </div>
             <div id="top-margin-list">
                 <div class="spinner m-auto border-white"></div>
             </div>
        </div>


        <div class="responsive-grid-2 gap-6 mb-8">
            <!-- Más Vendidos (Volumen) -->
            <div class="premium-card">
                <h3 class="font-bold mb-4 flex items-center gap-2" style="color:var(--primary); font-size:1.05rem;">
                    <i class="ph ph-shopping-cart text-xl"></i> Más Vendidos (Volumen)
                </h3>
                <div id="top-volume-list" class="flex-col gap-3"><div class="spinner m-auto"></div></div>
            </div>
            
            <!-- Productos Gancho (Alta rotación, Bajo margen real) -->
            <div class="premium-card" style="background:rgba(239, 68, 68, 0.05); border-left:4px solid #ef4444;">
                 <h3 class="font-bold flex items-center gap-2" style="color:#ef4444; font-size:1.05rem; margin-bottom:12px;">
                     <i class="ph ph-magnet text-xl"></i> Ganchos (Bajo Margen)
                 </h3>
                 <div id="low-margin-list" class="flex-col gap-3">
                     <div class="spinner m-auto"></div>
                 </div>
            </div>
        </div>

        <!-- Alerta Sin Margen / Error -->
        <div class="premium-card mb-8" style="background:linear-gradient(135deg, #1e293b, #0f172a); border-left:4px solid #fbbf24;">
             <h3 class="font-bold flex items-center gap-2" style="color:#fbbf24; font-size:1.05rem; margin-bottom:12px;">
                 <i class="ph ph-warning text-xl pulsing-dot" style="animation: none;"></i> Revisión Urgente: Productos Sin Ganancia (0%)
             </h3>
             <div id="zero-margin-list" class="flex gap-4 overflow-x-auto pb-2" style="scrollbar-width:thin;">
                 <div class="spinner m-auto" style="border-color:#fbbf24; border-top-color:transparent;"></div>
             </div>
             <p style="font-size:0.75rem; color:#94a3b8; margin-top:12px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                🚨 Estos productos dejaron ganancia cero (o negativa). Revisa en Eleventa si olvidaste ingresarles el costo unitario.
             </p>
        </div>

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
                <div style="height:250px; width:100%;"><canvas id="plChart"></canvas></div>
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
            <div class="card card-anim p-5" style="background:linear-gradient(135deg,#fff0f0,#fff); border-bottom:4px solid #ffcccc;">
                <h3 class="mb-3 font-bold flex items-center gap-2" style="color:#b91c1c; font-size:1rem;">
                    <i class="ph ph-money text-xl"></i> Próximos Pagos a Equipo
                </h3>
                <div id="upcoming-payments-list" class="text-secondary" style="font-size:0.85rem;">
                    <div class="spinner m-auto"></div>
                </div>
            </div>
            <!-- Facturas a crédito -->
            <div class="card card-anim p-5" id="credit-widget" style="background:linear-gradient(135deg,#fffbeb,#fff); border-bottom:4px solid #fde68a; cursor:pointer;" onclick="document.querySelector('[data-view=\\'purchase_invoices\\']')?.click()">
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
    } else {
        // Force update labels and structure if already rendered (Fixing "Old Labels/Icons" bug due to Smart Refresh)
        const elTitleIA = document.getElementById('label-ia-title');
        if (elTitleIA) elTitleIA.innerHTML = '<i class="ph ph-sparkle-fill"></i> IA';

        const elMetaIA = document.getElementById('label-ia-meta');
        if (elMetaIA) elMetaIA.textContent = 'META IA';

        const elRecordBox = document.getElementById('predict-record');
        if (elRecordBox) {
            const vSpan = document.getElementById('predict-record-value');
            elRecordBox.innerHTML = `Récord: <span id="predict-record-value" style="color: #fbbf24; font-weight: 700;">${vSpan?.innerHTML || '...'}</span>`;
        }

        // FORCE REDESIGN OF INSIGHT BOX (Removing lightbulb/rocket)
        const elInsightBox = document.getElementById('predict-insight-box');
        if (elInsightBox && !document.getElementById('predict-insight-dot')) {
            elInsightBox.style.cssText = "margin-top: 24px; padding: 12px 16px; background: rgba(99, 102, 241, 0.08); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.15); display: flex; align-items: center; gap: 10px; position: relative; z-index: 1;";
            elInsightBox.innerHTML = `
                <div id="predict-insight-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #6366f1; box-shadow: 0 0 8px #6366f1;"></div>
                <span id="predict-insight-text" style="color: var(--ia-panel-text); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.3px;">Actualizando...</span>
            `;
        }
    } // End if(!isAlreadyRendered)

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
        const [allEmployees, allLogs, allInvoices, allSuppliers, allDailySales, allProducts, allExpenses, allEleventaSales] = await Promise.all([
            window.db.employees.toArray(),
            window.db.workLogs.toArray(),
            window.db.purchase_invoices.toArray(),
            window.db.suppliers.toArray(),
            window.db.daily_sales.toArray(),
            window.db.products.toArray(),
            window.db.expenses.toArray(),
            window.db.eleventa_sales.toArray()
        ]);

        const employees = allEmployees.filter(e => !e.deleted);
        const logs = allLogs.filter(l => !l.deleted);
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

        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

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
        const nowLocal = new Date();
        const localYear = nowLocal.getFullYear();
        const localMonth = String(nowLocal.getMonth() + 1).padStart(2, '0');
        const localDay = String(nowLocal.getDate()).padStart(2, '0');
        const todayStrLocal = `${localYear}-${localMonth}-${localDay}`; // YYYY-MM-DD local

        const todayEleventa = eleventaSales.filter(v => {
            // v.date puede venir como "2026-03-09T18:00:00Z" (UTC) o con offset.
            // Al crear new Date(v.date), el navegador lo pasa a su zona local.
            const saleDate = new Date(v.date);
            const sYear = saleDate.getFullYear();
            const sMonth = String(saleDate.getMonth() + 1).padStart(2, '0');
            const sDay = String(saleDate.getDate()).padStart(2, '0');
            const saleStrLocal = `${sYear}-${sMonth}-${sDay}`;

            return saleStrLocal === todayStrLocal;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        const elFeed = document.getElementById('live-sales-feed');
        const validSales = todayEleventa.filter(v => v.total > 0);

        if (elFeed) {
            if (validSales.length === 0) {
                elFeed.innerHTML = '<div style="width:100%; text-align:center; padding: 40px 20px; color: var(--text-muted); background: var(--bg-glass); border-radius: 20px; border: 1px dashed rgba(0,0,0,0.1);"><i class="ph ph-receipt" style="font-size:2.5rem; opacity:0.5; margin-bottom:12px;"></i><br><span style="font-weight:600;">No hay ventas registradas aún</span></div>';
            } else {
                // Show up to 20 tickets maximum to keep memory footprint low
                const renderSales = validSales.slice(0, 20);
                elFeed.innerHTML = renderSales.map((v, index) => {
                    const dateObj = new Date(v.date);
                    const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    // Adding 'new' class to latest ticket for a pulsing effect
                    const isNew = index === 0 ? 'new' : '';

                    return `
                    <div class="live-ticket-card ${isNew}">
                        <div class="live-ticket-header">
                            <div class="live-ticket-icon">
                                <i class="ph ph-ticket"></i>
                            </div>
                            <div class="text-right">
                                <div class="font-bold text-sm text-primary">#${v.ticket_id || v.id}</div>
                                <div class="text-xs text-muted flex items-center justify-end gap-1 mt-1">
                                    <i class="ph ph-clock"></i> ${timeStr}
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 2px;">Venta Total</div>
                            <div class="font-bold" style="font-size: 1.4rem; color: #10b981;">
                                +${window.Utils.formatCurrency(v.total)}
                            </div>
                        </div>

                        <div style="margin-top: 15px; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center;">
                            <span class="text-xs" style="color: var(--text-muted); font-weight: 600;">${v.items_count || 1} artículos</span>
                            <div class="text-xs" style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 10px; border-radius: 8px; font-weight: 700;">
                                Ganancia: ${window.Utils.formatCurrency(v.profit)}
                            </div>
                        </div>
                        
                        <i class="ph ph-trend-up live-ticket-profit"></i>
                    </div>
                    `;
                }).join('');
            }
            document.getElementById('live-sales-count').textContent = validSales.length;
            const eleventaTotal = validSales.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
            document.getElementById('live-sales-total').innerHTML = window.Utils.formatCurrency(eleventaTotal);
        }

        // ---- KPI Calculations (True Profitability Engine) ----
        // 1. Sales (Total Revenue)
        const thisMonthSales = dailySales.filter(d => d.date && d.date.startsWith(currentMonthStr));
        const prevMonthSales = dailySales.filter(d => d.date && d.date.startsWith(prevMonthStr));
        const ventasMes = thisMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const ventasPrev = prevMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

        // 2. Gross Profit (From Eleventa API)
        const thisMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const prevMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(prevMonthStr));
        
        // Sumamos el Margen Directo de cada ticket (Venta - Costo)
        const gananciaBrutaMes = thisMonthEleventa.reduce((s, t) => s + (parseFloat(t.profit) || 0), 0);
        const gananciaBrutaPrev = prevMonthEleventa.reduce((s, t) => s + (parseFloat(t.profit) || 0), 0);

        // --- VALIDACIÓN DE COHERENCIA (Ventas Caja vs Tickets) ---
        const totalVentasEleventa = thisMonthEleventa.reduce((s, t) => s + (parseFloat(t.total) || 0), 0);
        const diffRatio = ventasMes > 0 ? (totalVentasEleventa / ventasMes) : 1;
        const isDataIncomplete = diffRatio < 0.85 && ventasMes > 500000; // Si falta más del 15% y hay ventas significativas

        // 3. Operational Expenses (Local Bills, etc.)
        // Separamos el Retiro del Dueño de los gastos generales para el desglose
        const thisMonthExpenses = allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(currentMonthStr));
        const prevMonthExpenses = allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(prevMonthStr));

        const gastosRetiroDueno = thisMonthExpenses
            .filter(e => e.category === 'Retiro del Due\u00f1o')
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        const gastosOperativosPrev = prevMonthExpenses
            .filter(e => e.category !== 'Retiro del Due\u00f1o')
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        // 4. PRORATEO DE RENTABILIDAD
        // Calculate the daily burn rate (Fixed expenses + Salaries)
        const burnRateInfo = await window.Utils.calculateDailyBurnRate(allExpenses, employees, now);
        
        // Carga prorrateada al día de hoy
        const currentDayOfMoth = Array.from(thisMonthSales).length > 0 ? now.getDate() : 1; 
        const gastoTotalProrrateado = burnRateInfo.dailyBurnRate * currentDayOfMoth;
        
        // Sumar también cualquier gasto operativo del mes *no fijo* (variable)
        const gastosVariablesMes = thisMonthExpenses
            .filter(e => !e.isFixed && e.category !== 'Retiro del Due\u00f1o')
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        // 5. CUENTA CORRIENTE DEL DUEÑO (Reparto vs Sueldo)
        const ownerEmployees = employees.filter(e => e.isOwner || (e.name && e.name.toLowerCase().includes('due\u00f1o')));
        const ownerPaymentsInfo = await window.Utils.calculateMonthlyPayments(ownerEmployees, logs, now);
        const sueldoBaseDuenoMensual = ownerPaymentsInfo.totalProjected || 0;
        
        // El negocio asume pagarte tu sueldo (Ya está prorrateado). 
        // Si retiras MÁS de tu sueldo base en el mes, eso es un Retiro de Utilidades y castiga la salud final.
        const ownerExtraDraw = Math.max(0, gastosRetiroDueno - sueldoBaseDuenoMensual);
        const ownerBalance = sueldoBaseDuenoMensual - gastosRetiroDueno;

        // console.log(`[Rentabilidad] G.Bruta: ${gananciaBrutaMes} | Retiros(Adelantos): ${gastosRetiroDueno} | Base Dueño: ${sueldoBaseDuenoMensual} | Prorrateo Hoy: ${gastoTotalProrrateado}`);

        // The *total* accumulated cost for the month so far is Prorated Fixed Costs + Variable Costs + Extra Draw (beyond base salary)
        const gastoTotal = gastoTotalProrrateado + gastosVariablesMes + ownerExtraDraw;
        const gastoPrev = gastosOperativosPrev;

        // 6. Invoices (Cashflow only, informational. Mercadería comprada)
        const thisMonthInvoices = invoices.filter(i => i.date && i.date.startsWith(currentMonthStr));
        const gastoInventarioMes = thisMonthInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        const currentMonthLogs = logs.filter(l => l.date && l.date.startsWith(currentMonthStr));
        const totalHours = currentMonthLogs.reduce((a, l) => a + (l.totalHours || 0), 0);

        // (Resumen Operativo eliminado — no hay datos de workLogs)

        const elMonthLabel = document.getElementById('stat-month-label');
        if (elMonthLabel) elMonthLabel.textContent = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

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
                    const confLabels = { high: 'Confianza Alta', medium: 'Confianza Media', low: 'Confianza Inicial' };
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
                            elPredictComparison.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">Esperando más historial para comparar</span>`;
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
                    if (elInsight) elInsight.textContent = "La IA necesita al menos 2 días de ventas para iniciar proyecciones.";
                }
            } catch (err) {
                console.error("Dashboard IA Error:", err);
            }
        }

        // ---- CEO Metrics: True Profitability (Utilidad Neta) ----
        // Utilidad Neta REAL = Ganancia Bruta (API) - Sueldos Personal - Retiro Dueño - Gastos Operativos
        const utilidadNetaMonto = gananciaBrutaMes - gastoTotal;
        const margenNetoPct = ventasMes > 0 ? (utilidadNetaMonto / ventasMes * 100) : 0;

        const elMargenMonto = document.getElementById('kpi-margen-neto');
        if (elMargenMonto) {
            window.Utils.animateNumber(elMargenMonto, 0, utilidadNetaMonto, 1000, true);
        }

        const elMargenBadge = document.getElementById('kpi-margen-badge');
        if (elMargenBadge) {
            elMargenBadge.textContent = margenNetoPct.toFixed(1) + '% de margen neto final';
            elMargenBadge.className = 'kpi-badge ' + (margenNetoPct > 15 ? 'up' : margenNetoPct > 5 ? 'neutral' : 'down');
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

            let balanceMsg = ownerBalance >= 0 
                ? `Te faltan percibir ${window.Utils.formatCurrency(ownerBalance)}`
                : `¡Cobraste de más! Sobregiro de ${window.Utils.formatCurrency(Math.abs(ownerBalance))}`;
            let balanceColor = ownerBalance >= 0 ? 'var(--text-muted)' : '#dc2626';

            // --- Generar sub-lista del Prorrateo ---
            const factorProrrateo = currentDayOfMoth / burnRateInfo.daysInMonth;
            const prorrateoItemsHtml = [
               ...(burnRateInfo.salariesDetails || []).map(s => `
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px; opacity:0.8;">
                        <span>• ${s.name}</span>
                        <span>-${window.Utils.formatCurrency(s.amount * factorProrrateo)}</span>
                    </div>`),
               ...(burnRateInfo.fixedExpensesDetails || []).map(e => `
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px; opacity:0.8;">
                        <span>• ${e.title}</span>
                        <span>-${window.Utils.formatCurrency(e.amount * factorProrrateo)}</span>
                    </div>`)
            ].join('');

            elHealthDetail.innerHTML = `
                <div style="margin-top:12px; background:rgba(0,0,0,0.02); border-radius:14px; padding:14px; font-family: var(--font-primary, Arial, sans-serif); border:1px solid rgba(0,0,0,0.03);">
                    
                    <!-- Resumen Principal -->
                    ${fmtRow('Ganancia Bruta (Cierre Caja)', gananciaBrutaMes, '#10b981', 'ph ph-coins')}
                    
                    ${burnRateInfo.dailyBurnRate > 0 ? `
                        <details style="margin: 4px 0;">
                            <summary style="list-style:none; cursor:pointer; outline:none;">
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0;">
                                    <span style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                                        <i class="ph ph-chart-line-down"></i> Gastos Fijos (Prorrateo) 
                                        <i class="ph ph-caret-down" style="font-size:0.7rem; opacity:0.5;"></i>
                                    </span>
                                    <span style="font-weight:700; font-size:0.9rem; color:#ef4444;">-${window.Utils.formatCurrency(gastoTotalProrrateado)}</span>
                                </div>
                            </summary>
                            <div style="padding: 8px 12px; background: rgba(239,68,68,0.03); border-radius:8px; font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">
                                <div style="font-weight:700; margin-bottom:6px; text-transform:uppercase; font-size:0.6rem; letter-spacing:0.5px; opacity:0.6;">Detalle de Prorrateo (${currentDayOfMoth} días)</div>
                                ${prorrateoItemsHtml}
                            </div>
                        </details>
                    ` : ''}

                    ${gastosVariablesMes > 0 ? fmtRow('Gastos Variables', -gastosVariablesMes, '#f59e0b', 'ph ph-receipt') : ''}
                    
                    <!-- Cuenta Dueño (Compacta) -->
                    ${ownerEmployees.length > 0 ? `
                    <details style="margin: 4px 0;">
                        <summary style="list-style:none; cursor:pointer; outline:none;">
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0;">
                                <span style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                                    <i class="ph ph-wallet"></i> Cuenta Anticipos Dueño 
                                    <i class="ph ph-caret-down" style="font-size:0.7rem; opacity:0.5;"></i>
                                </span>
                                <span style="font-weight:700; font-size:0.9rem; color:${ownerExtraDraw > 0 ? '#9333ea' : 'var(--text-muted)'};">
                                    ${ownerExtraDraw > 0 ? '-' + window.Utils.formatCurrency(ownerExtraDraw) : 'Al día'}
                                </span>
                            </div>
                        </summary>
                        <div style="padding: 10px; background: rgba(59,130,246,0.03); border-radius:10px; margin-bottom:8px; border:1px solid rgba(59,130,246,0.1);">
                           ${sueldoBaseDuenoMensual > 0 ? `
                           <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px;">
                               <span style="color:var(--text-muted);">Sueldo Base:</span>
                               <span style="font-weight:600;">${window.Utils.formatCurrency(sueldoBaseDuenoMensual)}</span>
                           </div>
                           <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px;">
                               <span style="color:var(--text-muted);">Anticipos tomados:</span>
                               <span style="font-weight:600;">${window.Utils.formatCurrency(gastosRetiroDueno)}</span>
                           </div>
                           <div style="font-size:0.7rem; color:${balanceColor}; font-weight:700; text-align:right; margin-top:6px; border-top:1px solid rgba(0,0,0,0.03); padding-top:6px;">
                                ${balanceMsg}
                           </div>
                           ` : `
                           <div style="font-size:0.75rem; color:var(--text-muted); text-align:center;">
                               No tienes un "Sueldo Fijo" configurado en Personal. Todo retiro será considerado Utilidad Extra.
                           </div>
                           <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:6px;">
                               <span style="color:var(--text-muted);">Retiros Acumulados:</span>
                               <span style="font-weight:600; color:#dc2626;">-${window.Utils.formatCurrency(gastosRetiroDueno)}</span>
                           </div>
                           `}
                        </div>
                    </details>` : ''}

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
            const burdenPct = Math.min(100, Math.max(0, (gastoTotal / gananciaBrutaMes) * 100));
            const margin = margenNetoPct.toFixed(1);

            setTimeout(() => { elHealthBar.style.width = burdenPct + '%'; }, 100);
            if (healthRatioPct) healthRatioPct.textContent = margin + '% final';

            if (isDataIncomplete) {
                healthEl.innerHTML = '🟠 Datos Incompletos';
                elHealthBar.style.background = '#f97316';
            } else if (burdenPct < 50) {
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

        // ---- Top Products and Margins (Data parsed from API Sync) ----
        const currentMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const productStats = {};
        let totalItemsFound = 0;

        currentMonthEleventa.forEach(sale => {
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const name = item.name || 'Desconocido';
                    if (!productStats[name]) {
                        productStats[name] = { qty: 0, profit: 0, revenue: 0, costUnit: 0, priceUnit: 0 };
                    }
                    const q = parseFloat(item.qty) || 1;

                    // Try to get cost from local products DB if Eleventa's profit is 0
                    let profitLine = parseFloat(item.profit) || 0;
                    let priceUnitValue = parseFloat(item.price_unit) || 0;
                    let costUnitValue = parseFloat(item.cost_unit) || 0;

                    // If profit is 0 or missing, try to calculate from local product DB
                    if (profitLine === 0 && priceUnitValue > 0) {
                        const localProduct = allProducts.find(p =>
                            p.name.toLowerCase().trim() === name.toLowerCase().trim()
                        );
                        if (localProduct) {
                            // Local product has: buyPrice (neto), units, isNeto flag, costUnit (already gross with IVA)
                            costUnitValue = localProduct.costUnit || 0;
                            priceUnitValue = parseFloat(item.price_unit) || (parseFloat(item.price) / q);
                            // Recalculate profit per unit
                            profitLine = (priceUnitValue - costUnitValue) * q;
                        }
                    }

                    productStats[name].qty += q;
                    productStats[name].profit += profitLine;
                    productStats[name].revenue += (parseFloat(item.price) || 0);
                    productStats[name].costUnit = costUnitValue;
                    productStats[name].priceUnit = priceUnitValue;
                    totalItemsFound++;
                });
            }
        });

        const allProductsArr = Object.entries(productStats);

        const topVolume = [...allProductsArr].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
        const topMargin = [...allProductsArr]
            .filter(x => x[1].qty >= 5 && x[1].revenue > 0) // Minimum 5 sales and valid revenue to show as star
            .sort((a, b) => b[1].profit - a[1].profit).slice(0, 5);

        // Hooks: At least 5 sold, lowest margin percentage, profit > 0 (to separate from errors)
        const hooks = [...allProductsArr]
            .filter(x => x[1].qty >= 5 && x[1].revenue > 0 && x[1].profit > 0)
            .sort((a, b) => (a[1].profit / a[1].revenue) - (b[1].profit / b[1].revenue))
            .slice(0, 5);

        // Zero Margin / Possible data entry errors (products with < 1% margin)
        const zeroMargin = [...allProductsArr]
            .filter(x => {
                if (x[1].qty < 1) return false;
                // Check if margin percentage is less than 1% or negative
                const marginPct = x[1].revenue > 0 ? (x[1].profit / x[1].revenue) : -1;
                return marginPct < 0.01; // Less than 1% margin
            })
            .sort((a, b) => b[1].qty - a[1].qty)
            .slice(0, 5);

        const elVol = document.getElementById('top-volume-list');
        if (elVol) {
            elVol.innerHTML = topVolume.length ? topVolume.map((p, idx) => `
                <div class="dash-list-item">
                    <div class="product-name-wrap">
                        <span class="product-rank">${idx + 1}</span>
                        <div class="product-info">
                            <span class="product-name" title="${p[0]}">${p[0]}</span>
                        </div>
                    </div>
                    <div class="product-stat text-primary">${p[1].qty} uds</div>
                </div>
            `).join('') : '<p class="text-muted text-sm text-center py-4">Faltan datos de productos detallados. La nueva API los traerá pronto.</p>';
        }

        const elMarg = document.getElementById('top-margin-list');
        if (elMarg) {
            elMarg.innerHTML = topMargin.length ? topMargin.map((p, idx) => {
                const marginPct = p[1].revenue > 0 ? ((p[1].profit / p[1].revenue) * 100).toFixed(0) : 0;
                if (idx === 0) {
                    // Golden Card #1
                    return `
                        <div style="min-width: 220px; flex-shrink: 0; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); border-radius: 16px; padding: 14px; color: #fff; position: relative; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.4);">
                            <div style="position: absolute; top: -10px; right: -10px; font-size: 5rem; opacity: 0.15;"><i class="ph ph-crown"></i></div>
                            <div style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; color: #fef3c7;">👑 Top #1 Oro</div>
                            <div style="font-size: 1.1rem; font-weight: 800; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="${p[0]}">${p[0]}</div>
                            <div style="font-size: 1.5rem; font-weight: 900; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${fmt(p[1].profit)}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700; color: #fff;">
                                <span>Rentabilidad:</span>
                                <span style="background: rgba(0,0,0,0.2); padding: 3px 10px; border-radius: 12px; font-size: 0.85rem;">${marginPct}%</span>
                            </div>
                        </div>
                    `;
                } else {
                    // Premium Glass Cards #2-#5
                    return `
                        <div style="min-width: 190px; flex-shrink: 0; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; position: relative; overflow: hidden;">
                            <div style="position: absolute; bottom: 0; left: 0; height: 4px; width: ${marginPct}%; background: #34d399; border-radius: 0 4px 0 0; transition: width 1s ease-out;"></div>
                            <div style="font-size: 0.75rem; font-weight: 600; color: #6ee7b7; margin-bottom: 4px;">RANK #${idx + 1}</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p[0]}">${p[0]}</div>
                            <div style="font-size: 1.25rem; font-weight: 800; color: #34d399; margin-bottom: 8px;">${fmt(p[1].profit)}</div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8;">
                                <span>Margen</span>
                                <span style="color:#fff; font-weight:700;">${marginPct}%</span>
                            </div>
                        </div>
                    `;
                }
            }).join('') : '<p style="color:#94a3b8; font-size:0.9rem; padding: 20px;">Necesitas un mínimo de 5 ventas recientes de un mismo producto en el mes para generar el Salón de la Fama.</p>';
        }

        const elHooks = document.getElementById('low-margin-list');
        if (elHooks) {
            elHooks.innerHTML = hooks.length ? hooks.map((p) => `
                <div class="dash-list-item" style="border: 1px solid rgba(239,68,68,0.1); padding-left:12px;">
                    <div class="product-name-wrap">
                        <span class="product-rank" style="background:#ef4444; color:white;"><i class="ph ph-warning"></i></span>
                        <div class="product-info">
                            <span class="product-name" title="${p[0]}">${p[0]}</span>
                            <span class="product-meta text-danger" style="font-weight:600;">Deja ${fmt(p[1].profit / p[1].qty)} x unid.</span>
                        </div>
                    </div>
                    <div class="badge-pct" style="background:rgba(239,68,68,0.1); color:#ef4444;">
                        ${(p[1].revenue > 0 ? (p[1].profit / p[1].revenue) * 100 : 0).toFixed(0)}%
                    </div>
                </div>
            `).join('') : '<p class="text-muted text-sm text-center py-4">Todo sano y equilibrado.</p>';
        }

        const elZero = document.getElementById('zero-margin-list');
        if (elZero) {
            elZero.className = "h-scroll-container";
            elZero.innerHTML = zeroMargin.length ? zeroMargin.map((p) => `
                <div class="h-product-card" style="border-color: rgba(251, 191, 36, 0.4); background: rgba(251, 191, 36, 0.03);">
                    <div class="h-product-name" style="color:#fff;">${p[0]}</div>
                    <div class="h-product-meta" style="color:#fbbf24;"><b>${p[1].qty} uds.</b> vendidas</div>
                    <div class="h-product-badge" style="background:rgba(251,191,36,0.1); color:#fbbf24;">
                        Sin Ganancia (0%)
                    </div>
                </div>
            `).join('') : '<p style="color:#10b981; font-size:0.85rem; padding:0 16px;">¡Todo en orden! Sin errores este mes.</p>';
        }

        // ---- Activar arrastre con ratón (escritorio) en contenedores horizontales ----
        // El scroll táctil en celular ya funciona via CSS (touch-action: pan-x)
        // Esta función solo añade la experiencia de arrastre adicional para el ratón en PC.
        if (window.Utils && window.Utils.setupHorizontalDragScroll) {
            window.Utils.setupHorizontalDragScroll(document.getElementById('live-sales-feed'));
            window.Utils.setupHorizontalDragScroll(document.getElementById('top-margin-list'));
            window.Utils.setupHorizontalDragScroll(document.getElementById('zero-margin-list'));
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
                        <span style="font-size:0.83rem;font-weight:600;color:var(--text-primary);">${supplierMap[id] || 'Desconocido'}</span>
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
        const months6Labels = [];
        const months6Sales = [];
        const months6Costs = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months6Labels.push(d.toLocaleDateString('es-ES', { month: 'short' }));
            months6Sales.push(dailySales.filter(s => s.date && s.date.startsWith(mStr)).reduce((s, d) => s + (parseFloat(d.total) || 0), 0));
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

        createSpark('spark-ventas', [10, 25, 15, 30, 45, 40, 35, 55], '#10b981');
        createSpark('spark-gastos', [40, 35, 30, 45, 50, 40, 45, 35], '#ef4444');

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
                return `<div style="padding:10px;border:1px solid rgba(0,0,0,0.05);border-radius:8px;display:flex;align-items:center;gap:10px;background:white;">
                    <i class="ph ${diff <= 7 ? 'ph-prohibit' : 'ph-clock-countdown'}" style="font-size:1.4rem;color:${col};"></i>
                    <div>
                        <div style="font-weight:700;font-size:0.88rem;">${p.name}</div>
                        <div style="font-size:0.75rem;color:${col};font-weight:600;">Vence en ${diff} días</div>
                    </div>
                </div>`;
            }).join('');
        }

        // ---- Notificaciones Urgentes (Pago Contadora) ----
        const accountantDueDay = 14;
        const currentYear = now.getFullYear();
        const currentMonthIdx = now.getMonth();

        let urgentHtml = '';

        // Check if current month's payment is already registered in expenses
        const currentMonthIntStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
        const hasPaidAccountant = allExpenses.some(e =>
            !e.deleted &&
            e.category === 'Contabilidad' &&
            e.date.startsWith(currentMonthIntStr)
        );

        if (!hasPaidAccountant) {
            const dueDate = new Date(currentYear, currentMonthIdx, accountantDueDay);
            const diffDays = Math.ceil((dueDate - today0) / 86400000);

            if (diffDays <= 5) { // Show from the 9th onwards
                const urgentIcon = diffDays <= 0 ? 'ph-warning-octagon' : 'ph-calendar-plus';
                const urgentMsg = diffDays < 0 ? 'Pago de Contadora ATRASADO' : diffDays === 0 ? 'Pago de Contadora HOY' : `Faltan ${diffDays} días para el pago de Contadora`;
                const urgentColor = diffDays <= 0 ? '#ef4444' : '#f97316';

                urgentHtml += `
                <div style="padding:14px; background:white; border-radius:12px; border:1px solid rgba(239,68,68,0.1); display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <i class="ph ${urgentIcon}" style="font-size:2rem; color:${urgentColor};"></i>
                        <div>
                            <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary);">${urgentMsg}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Fecha límite: 14 de ${now.toLocaleDateString('es-ES', { month: 'long' })}</div>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="window._showAccountantQuickPay()" style="width:100%; justify-content:center; margin-top:5px; background:${urgentColor};">
                        <i class="ph ph-hand-coins"></i> Registrar Pago Realizado
                    </button>
                </div>`;
            }
        }

        // History Summary Accountant
        const accountantExpenses = allExpenses.filter(e => !e.deleted && e.category === 'Contabilidad')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (accountantExpenses.length > 0) {
            const totalPaidAccountant = accountantExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            urgentHtml += `
            <div style="margin-top:10px; padding:10px; border-top:1px dashed var(--border);">
                <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600; display:flex; justify-content:space-between;">
                    <span>Historial Contabilidad</span>
                    <span>Total: ${fmt(totalPaidAccountant)}</span>
                </div>
                <div style="margin-top:5px; font-size:0.75rem; color:var(--text-primary);">
                    Último pago: ${fmt(accountantExpenses[0].amount)} (${window.Utils.formatDate(accountantExpenses[0].date)})
                </div>
            </div>`;
        }

        const urgentContainer = document.getElementById('urgent-notifications-container');
        if (urgentHtml) {
            urgentContainer.classList.remove('hidden');
            document.getElementById('urgent-notifications-list').innerHTML = urgentHtml;
        } else {
            urgentContainer.classList.add('hidden');
        }

        // Global function to quick-register accountant payment
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
                        alert('✅ Pago registrado correctamente.');
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
                const [emps, lgs, prods] = await Promise.all([window.db.employees.toArray(), window.db.workLogs.toArray(), window.db.products.toArray()]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(e => ({ ID: e.id, Nombre: e.name, Rol: e.role, Salario: e.baseSalary || 0 }))), 'Personal');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lgs.map(l => { const e = emps.find(x => x.id === l.employeeId); return { Empleado: e?.name, Fecha: l.date, Horas: l.totalHours, Pago: l.payAmount }; })), 'Asistencia');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prods.map(p => ({ Nombre: p.name, Costo: p.costUnit, Precio: p.salePrice, Stock: p.stock || 0 }))), 'Inventario');
                XLSX.writeFile(wb, `Reporte_ElMaravilloso_${todayStr}.xlsx`);
            } catch (err) { alert('Error: ' + err.message); }
            finally { btn.innerHTML = '<i class="ph ph-file-xls" style="font-size:1.1rem;"></i> <span class="hide-mobile">Exportar Excel</span>'; btn.disabled = false; }
        });

        // ---- WhatsApp Report ----
        document.getElementById('btn-whatsapp-report').addEventListener('click', () => {
            const msg = `📊 * Reporte El Maravilloso *\n📅 ${now.toLocaleDateString('es-ES')} \n\n💰 Gasto Mes: ${window.Utils.formatCurrency(gastoMes, true)} \n💵 Ventas Mes: ${window.Utils.formatCurrency(ventasMes, true)} \n⏱ Horas: ${totalHours.toFixed(1)} h\n👥 Personal: ${employees.length} \n\n_Generado automáticamente_`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });

    } catch (e) {
        console.error('Dashboard error:', e);
        if (container && container.isConnected) {
            container.innerHTML += `<p style="color:red;">Error cargando datos: ${e.message}</p>`;
        }
    }
};

// ===================== TAB 2: ANÁLISIS FINANCIERO =====================
async function renderReportsTab() {
    try {
        const period = document.getElementById('report-period')?.value || 'month';
        const now = new Date();

        const [purchases, sales, suppliers, expenses, employees, workLogs, dailySales] = await Promise.all([
            window.db.purchase_invoices.toArray(), window.db.sales_invoices.toArray(),
            window.db.suppliers.toArray(), window.db.expenses.toArray(),
            window.db.employees.toArray(), window.db.workLogs.toArray(),
            window.db.daily_sales.toArray()
        ]);

        const supplierMap = {};
        suppliers.filter(s => !s.deleted).forEach(s => supplierMap[s.id] = s.name);

        const activePurchases = purchases.filter(p => !p.deleted);
        const activeSales = sales.filter(s => !s.deleted);
        const activeDailySales = dailySales.filter(d => !d.deleted);
        const activeExpenses = expenses.filter(e => !e.deleted);
        const activeEmployees = employees.filter(e => !e.deleted);
        const activeLogs = workLogs.filter(l => !l.deleted);

        const filterDate = dateStr => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (period === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        };

        const fPurchases = activePurchases.filter(p => filterDate(p.date));
        const fSalesInv = activeSales.filter(s => filterDate(s.date));
        const fDailySales = activeDailySales.filter(d => filterDate(d.date));
        const fExpenses = activeExpenses.filter(e => filterDate(e.date));

        // ---- Previous Month Comparison Data ----
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const filterPrev = dStr => {
            if (!dStr) return false;
            const d = new Date(dStr);
            return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
        };

        const prevSales = activeDailySales.filter(d => filterPrev(d.date)).reduce((s, x) => s + (parseFloat(x.total) || 0), 0) +
            activeSales.filter(s => filterPrev(s.date)).reduce((s, x) => s + (parseFloat(x.total) || 0), 0);

        const prevPurchases = activePurchases.filter(p => filterPrev(p.date)).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const prevGenExp = activeExpenses.filter(e => filterPrev(e.date)).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

        // For salaries in prev month, simple log sum is enough for comparison
        let prevSalaries = activeLogs.filter(l => filterPrev(l.date)).reduce((s, l) => s + (l.payAmount || 0), 0);
        const prevCosts = prevPurchases + prevGenExp + prevSalaries;

        const totalDailySales = fDailySales.reduce((s, x) => s + (parseFloat(x.total) || 0), 0);
        const totalSalesInv = fSalesInv.reduce((s, x) => s + (parseFloat(x.total) || 0), 0);
        const totalSales = totalDailySales + totalSalesInv;

        const totalPurchases = fPurchases.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const totalGenExp = fExpenses.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

        let totalSalaries = 0;
        if (period === 'month') {
            const ms = await window.Utils.calculateMonthlyPayments(activeEmployees, activeLogs, now);
            totalSalaries = ms.totalPaid;
        } else {
            activeLogs.forEach(l => { if (filterDate(l.date)) totalSalaries += (l.payAmount || 0); });
        }

        const totalCosts = totalPurchases + totalGenExp + totalSalaries;
        const profit = totalSales - totalCosts;
        const fmt = v => window.Utils.formatCurrency(v);

        // Update KPIs
        // Update KPIs with count-up animation
        const elSales = document.getElementById('kpi-sales');
        if (elSales) window.Utils.animateNumber(elSales, 0, totalDailySales, 1000, true);

        const elCosts = document.getElementById('kpi-expenses');
        if (elCosts) window.Utils.animateNumber(elCosts, 0, totalCosts, 1000, true);

        const elSalesB2B = document.getElementById('kpi-sales-b2b');
        if (elSalesB2B) elSalesB2B.innerHTML = `Facturas: <b>${fmt(totalSalesInv)}</b>`;

        const elCostsDetail = document.getElementById('kpi-expenses-detail');
        if (elCostsDetail) elCostsDetail.innerHTML = `Compras: <b>${fmt(totalPurchases)}</b> · Gastos: <b>${fmt(totalGenExp)}</b> · Sueldos: <b>${fmt(totalSalaries)}</b>`;

        // Update Badges
        renderBadge('kpi-sales-badge', totalSales, prevSales, false);
        renderBadge('kpi-expenses-badge', totalCosts, prevCosts, true);

        const profEl = document.getElementById('kpi-profit');
        if (profEl) {
            window.Utils.animateNumber(profEl, 0, profit, 1000, true);
            profEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
        }

        const profMarginEl = document.getElementById('kpi-profit-margin');
        if (profMarginEl) {
            const margin = totalSales > 0 ? (profit / totalSales * 100).toFixed(1) : 0;
            profMarginEl.innerHTML = `Margen: <b>${margin}%</b>`;
        }

        // ---- INSIGHTS CALCULATIONS ----
        // 1. Avg Ticket
        const insightTicket = document.getElementById('insight-avg-ticket');
        if (insightTicket) {
            const dailyCount = fDailySales.length;
            const avg = dailyCount > 0 ? totalDailySales / dailyCount : 0;
            window.Utils.animateNumber(insightTicket, 0, avg, 1200, true);
        }

        // 2. Best Day
        const insightBest = document.getElementById('insight-best-day');
        if (insightBest) {
            const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const daySales = [0, 0, 0, 0, 0, 0, 0];
            fDailySales.forEach(s => daySales[new Date(s.date + 'T12:00:00').getDay()] += parseFloat(s.total) || 0);
            const bestDayIndex = daySales.indexOf(Math.max(...daySales));
            insightBest.textContent = daySales[bestDayIndex] > 0 ? weekdayNames[bestDayIndex] : '—';
        }

        // 3. Growth
        const insightGrowth = document.getElementById('insight-growth');
        if (insightGrowth) {
            // Simple logic for month growth vs prev month
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthStr = prevMonthDate.toISOString().substring(0, 7);
            const prevSalesArray = activeDailySales.filter(d => d.date && d.date.startsWith(prevMonthStr));
            const prevTotal = prevSalesArray.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

            if (prevTotal > 0) {
                const growth = ((totalDailySales - prevTotal) / prevTotal * 100).toFixed(1);
                insightGrowth.textContent = (growth >= 0 ? '+' : '') + growth + '%';
                insightGrowth.style.color = growth >= 0 ? '#10b981' : '#ef4444';
            } else {
                insightGrowth.textContent = '—';
            }
        }

        // ---- CHART: DAILY SALES TREND (PRO EDITION) ----
        // This replaces the Weekday Aggregation to show ACTUAL data points that match the user's list
        const sortedDailySales = [...fDailySales].sort((a, b) => new Date(a.date) - new Date(b.date));

        const trendLabels = sortedDailySales.map(s => {
            const d = new Date(s.date + 'T12:00:00');
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        });
        const trendData = sortedDailySales.map(s => parseFloat(s.total) || 0);

        const trendCtx = document.getElementById('chart-weekday').getContext('2d');
        const trendGradient = trendCtx.createLinearGradient(0, 0, 0, 300);
        trendGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        trendGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

        const existTrend = Chart.getChart('chart-weekday');
        if (existTrend) existTrend.destroy();

        new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Venta Diaria',
                    data: trendData,
                    backgroundColor: trendGradient,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(31, 41, 55, 0.95)',
                        titleFont: { size: 13, weight: 'bold' },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => ` Venta: ${window.Utils.formatCurrency(ctx.raw, true)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.03)' },
                        ticks: {
                            callback: (v) => '$' + (v / 1000).toFixed(0) + 'k',
                            font: { size: 10 }
                        }
                    },
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                }
            }
        });

        // ---- Pie chart: cost breakdown ----
        const costMap = { 'Proveedores': totalPurchases, 'Sueldos': totalSalaries };
        fExpenses.forEach(e => { costMap[e.category] = (costMap[e.category] || 0) + (parseFloat(e.amount) || 0); });
        const sorted = Object.entries(costMap).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);

        const pieCtx = document.getElementById('chart-suppliers').getContext('2d');
        const existPie = Chart.getChart('chart-suppliers');
        if (existPie) existPie.destroy();
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(([n]) => n),
                datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6'], borderWidth: 2, borderColor: 'white' }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { animateRotate: true, duration: 800 },
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } }
            }
        });

        // ---- Area chart: Trend (Balance) ----
        const barCtx = document.getElementById('chart-trend').getContext('2d');
        const balanceGradient = barCtx.createLinearGradient(0, 0, 0, 250);
        balanceGradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        balanceGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

        const existBar = Chart.getChart('chart-trend');
        if (existBar) existBar.destroy();
        new Chart(barCtx, {
            type: 'line',
            data: {
                labels: ['Cierres', 'Facturas', 'Gastos', 'Balance'],
                datasets: [{
                    label: 'Monto',
                    data: [totalDailySales, totalSalesInv, totalCosts, profit],
                    backgroundColor: balanceGradient,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        bodyFont: { size: 13 },
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${window.Utils.formatCurrency(ctx.raw, true)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.03)' },
                        ticks: { callback: (v) => '$' + (v / 1000).toFixed(0) + 'k' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // ---- Forecast 14 días ----
        const today0 = new Date(); today0.setHours(0, 0, 0, 0);
        const end14 = new Date(today0); end14.setDate(end14.getDate() + 14);
        const forecast = activePurchases
            .filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente' && i.dueDate)
            .filter(i => { const d = new Date(i.dueDate); return d >= today0 && d <= end14; })
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        const forecastEl = document.getElementById('forecast-list');
        if (forecast.length === 0) {
            forecastEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">✅ Sin vencimientos en los próximos 14 días</p>';
        } else {
            forecastEl.innerHTML = forecast.map(i => {
                const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0);
                const dl = Math.ceil((d - today0) / 86400000);
                const col = dl === 0 ? '#dc2626' : dl <= 3 ? '#ea580c' : dl <= 7 ? '#d97706' : '#6366f1';
                return `<div class="forecast-item">
                    <div class="forecast-dot" style="background:${col};"></div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">${supplierMap[i.supplierId] || 'Proveedor'}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">#${i.invoiceNumber || '—'} · Vence ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700;color:${col};font-size:0.88rem;">${fmt(parseFloat(i.amount) || 0)}</div>
                        <div style="font-size:0.75rem;background:${col};color:white;border-radius:8px;padding:1px 7px;font-weight:600;">${dl === 0 ? '¡HOY!' : `${dl}d`}</div>
                    </div>
                </div>`;
            }).join('');
        }

        // ---- Pending list ----
        const pending = fPurchases.filter(p => p.paymentStatus === 'Pendiente');
        const pendingEl = document.getElementById('pending-list');
        pendingEl.innerHTML = pending.length === 0
            ? '<div style="padding:20px;text-align:center;color:var(--text-muted);">¡Todo pagado! Sin deudas pendientes.</div>'
            : pending.map(p => `
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-weight:600;color:var(--text-primary);font-size:0.88rem;">${supplierMap[p.supplierId] || 'Desconocido'}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">Factura #${p.invoiceNumber || '—'} · ${p.date || ''}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span style="font-weight:700;color:#d97706;">${fmt(parseFloat(p.amount) || 0)}</span>
                        <button class="btn btn-icon" title="Marcar Pagado" onclick="window._markPaid(${p.id})">
                            <i class="ph ph-check-circle" style="color:#10b981;"></i>
                        </button>
                    </div>
                </div>
            `).join('');

        window._markPaid = async (id) => {
            if (confirm('¿Marcar factura como PAGADA?')) {
                try {
                    await window.DataManager.saveAndSync('purchase_invoices', { id, paymentStatus: 'Pagado' });
                    renderReportsTab();
                } catch (e) { alert('Error: ' + e.message); }
            }
        };

    } catch (e) {
        console.error('Reports tab error:', e);
    }
}

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

// --- DASHBOARD SUB-TAB SWITCHER ---
window._switchDashTab = async (tab) => {
    const resumenContent = document.getElementById('tab-resumen');
    const subview = document.getElementById('dash-subview');
    const tabs = ['resumen', 'reportes', 'calc', 'marketing'];

    // Update button styles
    tabs.forEach(t => {
        const btn = document.getElementById(`dash-tab-${t}`);
        if (btn) {
            btn.style.background = t === tab ? 'var(--primary)' : 'transparent';
            btn.style.color = t === tab ? 'white' : 'var(--text-muted)';
        }
    });

    if (tab === 'resumen') {
        if (resumenContent) resumenContent.style.display = '';
        if (subview) { subview.style.display = 'none'; subview.innerHTML = ''; }
        return;
    }

    // Hide dashboard content, show sub-view
    if (resumenContent) resumenContent.style.display = 'none';
    if (subview) subview.style.display = 'block';

    if (tab === 'reportes') {
        // Use _reportsReal if reports.js has stored it (avoids the dashboard alias)
        const fn = window.Views._reportsReal || window.Views.reports;
        if (fn) await fn(subview);
    } else if (tab === 'calc' && window.Views.calculator) {
        await window.Views.calculator(subview);
    } else if (tab === 'marketing' && window.Views.marketing) {
        await window.Views.marketing(subview);
    }
};
