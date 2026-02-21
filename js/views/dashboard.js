// ==========================================
// DASHBOARD PRO — Unified View
// Includes: Dashboard + Reports merged
// ==========================================
window.Views = window.Views || {};

window.Views.dashboard = async (container) => {
    container.innerHTML = `
    <style>
        /* ---- Sub-Tab System ---- */
        .dash-tabs { display:flex; gap:6px; background:rgba(0,0,0,0.04); padding:6px; border-radius:16px; width:fit-content; margin-bottom:28px; }
        .dash-tab { padding:9px 22px; border-radius:12px; border:none; background:transparent; font-weight:600; font-size:0.9rem; color:var(--text-muted); cursor:pointer; transition:all 0.25s ease; display:flex; align-items:center; gap:7px; }
        .dash-tab.active { background:white; color:var(--primary); box-shadow:0 2px 12px rgba(0,0,0,0.10); }
        body.dark-mode .dash-tab.active { background:#21262d; color:#e6edf3; }
        body.dark-mode .dash-tabs { background:rgba(255,255,255,0.05); }

        /* ---- KPI Card Animated ---- */
        .kpi-card { position:relative; overflow:hidden; transition:transform 0.2s, box-shadow 0.2s; }
        .kpi-card:hover { transform:translateY(-3px); box-shadow:0 8px 30px rgba(0,0,0,0.12); }
        .kpi-card .kpi-glow { position:absolute; top:-30px; right:-30px; width:100px; height:100px; border-radius:50%; opacity:0.12; }
        .kpi-badge { display:inline-flex; align-items:center; gap:3px; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:10px; margin-top:4px; }
        .kpi-badge.up { background:rgba(16,185,129,0.12); color:#059669; }
        .kpi-badge.down { background:rgba(239,68,68,0.12); color:#dc2626; }
        .kpi-badge.neutral { background:rgba(100,116,139,0.12); color:#64748b; }

        /* ---- Health Indicator ---- */
        .health-bar-wrap { height:10px; background:rgba(0,0,0,0.07); border-radius:10px; overflow:hidden; margin:8px 0; }
        .health-bar { height:100%; border-radius:10px; transition:width 1.2s cubic-bezier(.4,0,.2,1); }

        /* ---- Counter Animation ---- */
        @keyframes countUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .animated-val { animation: countUp 0.5s ease forwards; }

        /* ---- Tab content ---- */
        .dash-tab-content { display:none; }
        .dash-tab-content.active { display:block; animation: fadeInTab 0.3s ease; }
        @keyframes fadeInTab { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }

        /* ---- Forecast timeline ---- */
        .forecast-item { display:flex; align-items:center; gap:14px; padding:10px 0; border-bottom:1px solid var(--border); }
        .forecast-item:last-child { border-bottom:none; }
        .forecast-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }

        /* ---- Top supplier bar ---- */
        .supplier-bar-bg { height:6px; background:rgba(0,0,0,0.07); border-radius:6px; margin-top:4px; overflow:hidden; }
        .supplier-bar-fill { height:100%; border-radius:6px; background:linear-gradient(90deg, var(--primary), #f97316); transition:width 1s ease; }

        /* ---- Card fade-in ---- */
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .card-anim { animation: slideUp 0.4s ease both; }
        .card-anim:nth-child(1){animation-delay:0.05s}
        .card-anim:nth-child(2){animation-delay:0.12s}
        .card-anim:nth-child(3){animation-delay:0.19s}
        .card-anim:nth-child(4){animation-delay:0.26s}
    </style>

    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div class="dash-tabs">
            <button class="dash-tab active" id="tab-btn-resumen">
                <i class="ph ph-squares-four"></i> Resumen
            </button>
            <button class="dash-tab" id="tab-btn-financiero">
                <i class="ph ph-chart-line-up"></i> Análisis Financiero
            </button>
        </div>
        <div style="display:flex; gap:10px;">
            <button id="btn-export-excel" class="btn" style="background:var(--success);color:white;border:none;display:flex;gap:8px;align-items:center;">
                <i class="ph ph-file-xls" style="font-size:1.1rem;"></i>
                <span class="hide-mobile">Exportar Excel</span>
            </button>
            <button id="btn-whatsapp-report" class="btn" style="background:#25D366;color:white;border:none;display:flex;gap:8px;align-items:center;">
                <i class="ph ph-whatsapp-logo" style="font-size:1.1rem;"></i>
                <span class="hide-mobile">WhatsApp</span>
            </button>
        </div>
    </div>

    <!-- ===================== TAB 1: RESUMEN ===================== -->
    <div id="tab-resumen" class="dash-tab-content active">

        <!-- Alertas semanales -->
        <div id="weekly-summary-container" class="hidden" style="margin-bottom:16px;">
            <div class="card" style="border-left:5px solid #d97706;background:rgba(251,191,36,0.05);padding:16px;">
                <h3 style="color:#92400e;display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:1rem;">
                    <i class="ph ph-calendar-check"></i> Vencimientos Esta Semana
                </h3>
                <div id="weekly-summary-list" style="display:flex;flex-direction:column;gap:8px;"></div>
            </div>
        </div>

        <!-- Alertas de vencimiento de productos -->
        <div id="expiry-alerts-container" class="hidden" style="margin-bottom:20px;">
            <div class="card" style="border-left:5px solid var(--danger);background:rgba(255,23,68,0.05);padding:16px;">
                <h3 style="color:var(--danger);display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <i class="ph ph-warning-octagon"></i> Vencimiento de Productos
                </h3>
                <div id="expiry-alerts-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;"></div>
            </div>
        </div>

        <!-- KPI Cards principales -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
            <!-- Gasto mes -->
            <div class="card kpi-card card-anim" style="padding:20px;border-left:4px solid var(--primary);">
                <div class="kpi-glow" style="background:var(--primary);"></div>
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Gasto Mensual</div>
                <div id="kpi-gasto-mes" style="font-size:1.7rem;font-weight:800;color:var(--text-primary);margin:6px 0;" class="animated-val">...</div>
                <div id="kpi-gasto-mes-badge" class="kpi-badge neutral">— vs mes anterior</div>
            </div>
            <!-- Ventas mes -->
            <div class="card kpi-card card-anim" style="padding:20px;border-left:4px solid #10b981;">
                <div class="kpi-glow" style="background:#10b981;"></div>
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Ventas del Mes</div>
                <div id="kpi-ventas-mes" style="font-size:1.7rem;font-weight:800;color:var(--text-primary);margin:6px 0;" class="animated-val">...</div>
                <div id="kpi-ventas-mes-badge" class="kpi-badge neutral">— vs mes anterior</div>
            </div>
            <!-- Horas trabajadas -->
            <div class="card kpi-card card-anim" style="padding:20px;border-left:4px solid #3b82f6;">
                <div class="kpi-glow" style="background:#3b82f6;"></div>
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Horas este Mes</div>
                <div id="dashboard-total-hours" style="font-size:1.7rem;font-weight:800;color:var(--text-primary);margin:6px 0;" class="animated-val">...</div>
                <div style="font-size:0.8rem;color:var(--text-muted);" id="stat-month-label">Mes Actual</div>
            </div>
            <!-- Empleados activos -->
            <div class="card kpi-card card-anim" style="padding:20px;border-left:4px solid #8b5cf6;">
                <div class="kpi-glow" style="background:#8b5cf6;"></div>
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Empleados Activos</div>
                <div id="dashboard-active-employees" style="font-size:1.7rem;font-weight:800;color:var(--text-primary);margin:6px 0;" class="animated-val">...</div>
                <div style="font-size:0.8rem;color:var(--text-muted);">Personal en nómina</div>
            </div>
        </div>

        <!-- Salud del negocio + Resumen de Hoy -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
            <!-- Salud financiera -->
            <div class="card card-anim" style="padding:20px;">
                <h3 style="font-size:0.95rem;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <i class="ph ph-activity" style="color:var(--primary);"></i> Salud Financiera del Mes
                </h3>
                <div id="health-label" style="font-size:1.1rem;font-weight:800;margin-bottom:6px;">Calculando...</div>
                <div class="health-bar-wrap"><div id="health-bar" class="health-bar" style="width:0%;background:#10b981;"></div></div>
                <div id="health-detail" style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">—</div>
                <div style="margin-top:12px;" id="health-ratio-wrap">
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">
                        <span>Ingresos usados en gastos</span>
                        <span id="health-ratio-pct">—</span>
                    </div>
                </div>
            </div>
            <!-- Resumen de hoy -->
            <div class="card card-anim" style="padding:20px;">
                <h3 style="font-size:0.95rem;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <i class="ph ph-sun-horizon" style="color:#f59e0b;"></i> Resumen de Hoy
                </h3>
                <div id="today-summary" style="display:flex;flex-direction:column;gap:10px;">
                    <div class="spinner" style="margin:auto;"></div>
                </div>
            </div>
        </div>

        <!-- Gráfico P&L + Top Proveedores -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px;">
            <!-- Gráfico P&L 6 meses -->
            <div class="card card-anim" style="padding:20px;">
                <h3 style="margin-bottom:16px;color:var(--text-primary);font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px;">
                    <i class="ph ph-trend-up" style="color:#10b981;"></i> Ventas vs Gastos (6 meses)
                </h3>
                <div style="height:200px;width:100%;"><canvas id="plChart"></canvas></div>
            </div>
            <!-- Top 3 proveedores -->
            <div class="card card-anim" style="padding:20px;">
                <h3 style="margin-bottom:16px;color:var(--text-primary);font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px;">
                    <i class="ph ph-buildings" style="color:#f97316;"></i> Top Proveedores
                </h3>
                <div id="top-suppliers" style="display:flex;flex-direction:column;gap:12px;">
                    <div class="spinner" style="margin:auto;"></div>
                </div>
            </div>
        </div>

        <!-- Widgets fila inferior -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
            <!-- Próximos pagos empleados -->
            <div class="card card-anim" style="background:linear-gradient(135deg,#fff0f0,#fff);border:1px solid #ffcccc;padding:18px;">
                <h3 style="margin-bottom:10px;color:#b91c1c;display:flex;align-items:center;gap:7px;font-size:0.9rem;">
                    <i class="ph ph-money"></i> Próximos Pagos
                </h3>
                <div id="upcoming-payments-list" style="font-size:0.85rem;color:var(--text-secondary);">
                    <span class="loader"></span> Calculando...
                </div>
            </div>
            <!-- Facturas a crédito -->
            <div class="card card-anim" id="credit-widget" style="background:linear-gradient(135deg,#fffbeb,#fef9e7);border:1px solid #fde68a;cursor:pointer;transition:all 0.2s;padding:18px;" title="Ir a Facturas de Compra">
                <h3 style="margin-bottom:10px;color:#92400e;display:flex;align-items:center;gap:7px;font-size:0.9rem;">
                    <i class="ph ph-clock-countdown"></i> Facturas a Crédito
                </h3>
                <div id="credit-widget-content" style="font-size:0.85rem;color:var(--text-secondary);">
                    <span class="loader"></span> Calculando...
                </div>
            </div>
            <!-- Últimos registros -->
            <div class="card card-anim" style="padding:18px;">
                <h3 style="margin-bottom:10px;color:var(--text-primary);display:flex;align-items:center;gap:7px;font-size:0.9rem;">
                    <i class="ph ph-clock-clockwise"></i> Últimos Registros
                </h3>
                <div id="recent-logs-list" style="font-size:0.85rem;color:var(--text-muted);display:flex;flex-direction:column;gap:6px;">
                    Cargando...
                </div>
            </div>
        </div>
    </div>

    <!-- ===================== TAB 2: ANÁLISIS FINANCIERO ===================== -->
    <div id="tab-financiero" class="dash-tab-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="margin:0;color:var(--text-primary);font-size:1.1rem;">Análisis Financiero</h2>
                <p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 0;">Ventas, egresos y rentabilidad del período</p>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
                <select id="report-period" class="form-input" style="width:auto;">
                    <option value="month">Este Mes</option>
                    <option value="year">Este Año</option>
                    <option value="all">Todo el Historial</option>
                </select>
                <button class="btn btn-secondary" id="btn-refresh-report">
                    <i class="ph ph-arrow-clockwise"></i> Actualizar
                </button>
            </div>
        </div>

        <!-- KPI Financieros -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
            <div class="card card-anim" style="padding:20px;border-left:4px solid #10b981;">
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px;">Ventas Totales</div>
                <div id="kpi-sales" style="font-size:1.6rem;font-weight:800;color:var(--text-primary);">$0</div>
            </div>
            <div class="card card-anim" style="padding:20px;border-left:4px solid #f59e0b;">
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px;">Total Egresos</div>
                <div id="kpi-expenses" style="font-size:1.6rem;font-weight:800;color:var(--text-primary);">$0</div>
                <div id="kpi-expenses-detail" style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Compras + Gastos + Sueldos</div>
            </div>
            <div class="card card-anim" style="padding:20px;border-left:4px solid #8b5cf6;">
                <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px;">Ganancia Estimada</div>
                <div id="kpi-profit" style="font-size:1.6rem;font-weight:800;color:#10b981;">$0</div>
            </div>
        </div>

        <!-- Charts row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
            <div class="card card-anim" style="padding:20px;">
                <h3 style="margin-bottom:16px;font-size:0.95rem;font-weight:700;">Desglose de Costos</h3>
                <div style="height:260px;position:relative;"><canvas id="chart-suppliers"></canvas></div>
            </div>
            <div class="card card-anim" style="padding:20px;">
                <h3 style="margin-bottom:16px;font-size:0.95rem;font-weight:700;">Balance del Período</h3>
                <div style="height:260px;position:relative;"><canvas id="chart-trend"></canvas></div>
            </div>
        </div>

        <!-- Forecast 14 días + Pagos Pendientes -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
            <!-- Forecast -->
            <div class="card card-anim" style="padding:20px;">
                <h3 style="margin-bottom:16px;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:8px;">
                    <i class="ph ph-calendar-dots" style="color:#6366f1;"></i> Forecast 14 Días
                </h3>
                <div id="forecast-list" style="max-height:280px;overflow-y:auto;">
                    <div class="spinner" style="margin:auto;display:block;"></div>
                </div>
            </div>
            <!-- Pagos pendientes -->
            <div class="card card-anim" style="padding:0;overflow:hidden;">
                <div style="padding:14px 20px;border-bottom:1px solid var(--border);background:var(--bg-input);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="font-size:0.95rem;margin:0;color:#d97706;display:flex;align-items:center;gap:6px;">
                        <i class="ph ph-warning-circle"></i> Pagos Pendientes a Proveedores
                    </h3>
                </div>
                <div id="pending-list" style="max-height:300px;overflow-y:auto;">
                    <div class="loading-state"><div class="spinner"></div></div>
                </div>
            </div>
        </div>
    </div>
    `;

    // ---- TAB SWITCHING ----
    const tabResumen = document.getElementById('tab-resumen');
    const tabFinanciero = document.getElementById('tab-financiero');
    const btnResumen = document.getElementById('tab-btn-resumen');
    const btnFinanciero = document.getElementById('tab-btn-financiero');

    let financieroLoaded = false;

    btnResumen.addEventListener('click', () => {
        btnResumen.classList.add('active'); btnFinanciero.classList.remove('active');
        tabResumen.classList.add('active'); tabFinanciero.classList.remove('active');
    });
    btnFinanciero.addEventListener('click', () => {
        btnFinanciero.classList.add('active'); btnResumen.classList.remove('active');
        tabFinanciero.classList.add('active'); tabResumen.classList.remove('active');
        if (!financieroLoaded) { renderReportsTab(); financieroLoaded = true; }
    });
    document.getElementById('btn-refresh-report')?.addEventListener('click', () => {
        financieroLoaded = false; renderReportsTab(); financieroLoaded = true;
    });
    document.getElementById('report-period')?.addEventListener('change', () => {
        renderReportsTab();
    });

    // ===================== LOAD RESUMEN DATA =====================
    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonthStr = todayStr.substring(0, 7);
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Fetch all data in parallel
        const [allEmployees, allLogs, allInvoices, allSuppliers, allDailySales, allProducts, allExpenses] = await Promise.all([
            window.db.employees.toArray(),
            window.db.workLogs.toArray(),
            window.db.purchase_invoices.toArray(),
            window.db.suppliers.toArray(),
            window.db.daily_sales.toArray(),
            window.db.products.toArray(),
            window.db.expenses.toArray()
        ]);

        const employees = allEmployees.filter(e => !e.deleted);
        const logs = allLogs.filter(l => !l.deleted);
        const invoices = allInvoices.filter(i => !i.deleted);
        const suppliers = allSuppliers.filter(s => !s.deleted);
        const dailySales = allDailySales.filter(d => !d.deleted);
        const products = allProducts.filter(p => !p.deleted);

        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

        // ---- KPI Calculations ----
        const thisMonthInvoices = invoices.filter(i => i.date && i.date.startsWith(currentMonthStr));
        const prevMonthInvoices = invoices.filter(i => i.date && i.date.startsWith(prevMonthStr));
        const thisMonthSales = dailySales.filter(d => d.date && d.date.startsWith(currentMonthStr));
        const prevMonthSales = dailySales.filter(d => d.date && d.date.startsWith(prevMonthStr));

        const gastoMes = thisMonthInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const gastoPrev = prevMonthInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const ventasMes = thisMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const ventasPrev = prevMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

        const monthlyPayments = await window.Utils.calculateMonthlyPayments(employees, logs, now);
        const gastoTotal = gastoMes + (monthlyPayments.totalPaid || 0);

        const currentMonthLogs = logs.filter(l => l.date && l.date.startsWith(currentMonthStr));
        const totalHours = currentMonthLogs.reduce((a, l) => a + (l.totalHours || 0), 0);

        // ---- Update KPI DOM ----
        document.getElementById('dashboard-active-employees').textContent = employees.length;
        document.getElementById('dashboard-total-hours').textContent = totalHours.toFixed(1) + 'h';
        document.getElementById('stat-month-label').textContent = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        const fmt = v => window.Utils.formatCurrency(v);

        // Gasto mes with badge
        document.getElementById('kpi-gasto-mes').innerHTML = fmt(gastoMes);
        renderBadge('kpi-gasto-mes-badge', gastoMes, gastoPrev, true);

        // Ventas mes with badge
        document.getElementById('kpi-ventas-mes').innerHTML = fmt(ventasMes);
        renderBadge('kpi-ventas-mes-badge', ventasMes, ventasPrev, false);

        // ---- Health Indicator ----
        const healthRatio = ventasMes > 0 ? (gastoTotal / ventasMes) : null;
        const healthEl = document.getElementById('health-label');
        const healthBar = document.getElementById('health-bar');
        const healthDetail = document.getElementById('health-detail');
        const healthRatioPct = document.getElementById('health-ratio-pct');

        if (ventasMes === 0) {
            healthEl.textContent = '⚪ Sin datos de ventas';
            healthBar.style.width = '0%';
            healthDetail.textContent = 'Registra ventas para ver el indicador';
        } else {
            const pct = Math.min(100, (gastoTotal / ventasMes) * 100);
            const margin = ((ventasMes - gastoTotal) / ventasMes * 100).toFixed(1);
            setTimeout(() => { healthBar.style.width = pct + '%'; }, 100);

            if (pct < 60) {
                healthEl.innerHTML = '🟢 Muy Saludable';
                healthBar.style.background = '#10b981';
                healthDetail.textContent = `Margen estimado: ${margin}% — Excelente control de costos`;
            } else if (pct < 80) {
                healthEl.innerHTML = '🟡 Aceptable';
                healthBar.style.background = '#f59e0b';
                healthDetail.textContent = `Margen estimado: ${margin}% — Monitorea los gastos`;
            } else if (pct < 100) {
                healthEl.innerHTML = '🟠 En riesgo';
                healthBar.style.background = '#f97316';
                healthDetail.textContent = `Margen estimado: ${margin}% — Gastos muy altos vs ventas`;
            } else {
                healthEl.innerHTML = '🔴 Pérdida';
                healthBar.style.background = '#ef4444';
                healthDetail.textContent = `Los gastos superan las ventas este mes`;
            }
            if (healthRatioPct) healthRatioPct.textContent = pct.toFixed(1) + '%';
        }

        // ---- Resumen de Hoy ----
        const todayLogs = logs.filter(l => l.date === todayStr);
        const todaySales = dailySales.filter(d => d.date === todayStr);
        const todayTotal = todaySales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

        document.getElementById('today-summary').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="color:var(--text-muted);font-size:0.85rem;"><i class="ph ph-receipt"></i> Ventas hoy</span>
                <span style="font-weight:700;color:#10b981;font-size:0.9rem;">${fmt(todayTotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="color:var(--text-muted);font-size:0.85rem;"><i class="ph ph-user-check"></i> Empleados hoy</span>
                <span style="font-weight:700;color:var(--text-primary);font-size:0.9rem;">${todayLogs.length} registros</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="color:var(--text-muted);font-size:0.85rem;"><i class="ph ph-timer"></i> Horas hoy</span>
                <span style="font-weight:700;color:#3b82f6;font-size:0.9rem;">${todayLogs.reduce((s, l) => s + (l.totalHours || 0), 0).toFixed(1)}h</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
                <span style="color:var(--text-muted);font-size:0.85rem;"><i class="ph ph-calendar-blank"></i> Fecha</span>
                <span style="font-weight:600;color:var(--text-muted);font-size:0.85rem;">${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
        `;

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

        // ---- P&L 6 Months Chart ----
        const months6Labels = [];
        const months6Sales = [];
        const months6Costs = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('es-ES', { month: 'short' });
            months6Labels.push(label);
            const mSales = dailySales.filter(s => s.date && s.date.startsWith(mStr)).reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
            const mCosts = invoices.filter(inv => inv.date && inv.date.startsWith(mStr)).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
            months6Sales.push(mSales);
            months6Costs.push(mCosts);
        }

        const plCtx = document.getElementById('plChart').getContext('2d');
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
                        backgroundColor: 'rgba(16,185,129,0.08)',
                        fill: true, tension: 0.4, pointRadius: 5,
                        pointBackgroundColor: '#10b981'
                    },
                    {
                        label: 'Compras',
                        data: months6Costs,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.08)',
                        fill: true, tension: 0.4, pointRadius: 5,
                        pointBackgroundColor: '#ef4444'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 900, easing: 'easeInOutQuart' },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b', font: { size: 11 } } },
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } }
                }
            }
        });

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

        if (expiringSoon.length > 0) {
            document.getElementById('expiry-alerts-container').classList.remove('hidden');
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

        // ---- Recent Logs ----
        const recentLogs = [...logs].sort((a, b) => b.id - a.id).slice(0, 5);
        document.getElementById('recent-logs-list').innerHTML = recentLogs.length === 0
            ? 'Sin actividad reciente.'
            : recentLogs.map(l => {
                const emp = employees.find(e => e.id === l.employeeId);
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg-app);border-radius:6px;">
                    <div>
                        <div style="font-weight:600;font-size:0.85rem;">${emp ? emp.name : 'Desc.'}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">${window.Utils.formatDate(l.date)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:var(--accent);font-weight:700;font-size:0.85rem;">${fmt(l.payAmount)}</div>
                        <div style="font-size:0.72rem;">${l.totalHours}h</div>
                    </div>
                </div>`;
            }).join('');

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
            const msg = `📊 *Reporte El Maravilloso*\n📅 ${now.toLocaleDateString('es-ES')}\n\n💰 Gasto Mes: ${fmt(gastoMes)}\n💵 Ventas Mes: ${fmt(ventasMes)}\n⏱ Horas: ${totalHours.toFixed(1)}h\n👥 Personal: ${employees.length}\n\n_Generado automáticamente_`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });

    } catch (e) {
        console.error('Dashboard error:', e);
        container.innerHTML += `<p style="color:red;">Error cargando datos: ${e.message}</p>`;
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

        const totalSales = fSalesInv.reduce((s, x) => s + (parseFloat(x.total) || 0), 0) + fDailySales.reduce((s, x) => s + (parseFloat(x.total) || 0), 0);
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
        document.getElementById('kpi-sales').innerHTML = fmt(totalSales);
        document.getElementById('kpi-expenses').innerHTML = fmt(totalCosts);
        document.getElementById('kpi-expenses-detail').innerHTML = `Compras: <b>${fmt(totalPurchases)}</b> • Gastos: <b>${fmt(totalGenExp)}</b> • Sueldos: <b>${fmt(totalSalaries)}</b>`;
        const profEl = document.getElementById('kpi-profit');
        profEl.innerHTML = fmt(profit);
        profEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';

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

        // ---- Bar chart: balance ----
        const barCtx = document.getElementById('chart-trend').getContext('2d');
        const existBar = Chart.getChart('chart-trend');
        if (existBar) existBar.destroy();
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Ventas', 'Costos', 'Ganancia'],
                datasets: [{
                    data: [totalSales, totalCosts, Math.abs(profit)],
                    backgroundColor: [
                        'rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)',
                        profit >= 0 ? 'rgba(99,102,241,0.8)' : 'rgba(239,68,68,0.5)'
                    ],
                    borderRadius: 8, borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 800 },
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
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
                await window.db.purchase_invoices.update(id, { paymentStatus: 'Pagado' });
                if (window.Sync?.client) await window.Sync.client.from('purchase_invoices').update({ paymentStatus: 'Pagado' }).eq('id', id);
                renderReportsTab();
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
    if (prev === 0) { el.className = 'kpi-badge neutral'; el.textContent = '— sin datos anteriores'; return; }
    const pct = ((current - prev) / prev * 100).toFixed(1);
    const isUp = current > prev;
    // invertGood=true means UP is BAD (gastos), false means UP is GOOD (ventas)
    const good = invertGood ? !isUp : isUp;
    el.className = `kpi-badge ${isUp ? (good ? 'up' : 'down') : (good ? 'up' : 'down')}`;
    el.innerHTML = `${isUp ? '▲' : '▼'} ${Math.abs(pct)}% vs mes anterior`;
}

// Alias to keep compatibility if any nav still references reports
window.Views.reports = (container) => {
    window.Views.dashboard(container);
};
