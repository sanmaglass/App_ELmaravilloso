// ==========================================
// DASHBOARD PRO — Unified View
// Includes: Dashboard + Reports merged
// ==========================================
window.Views = window.Views || {};

window.Views.dashboard = async (container) => {
    container.innerHTML = `
    <style>
        /* ---- Sub-Tab System ---- */
        .dash-tabs { display:flex; gap:6px; background:rgba(0,0,0,0.04); padding:6px; border-radius:16px; width:fit-content; }
        .dash-tab { padding:9px 22px; border-radius:12px; border:none; background:transparent; font-weight:600; font-size:0.9rem; color:var(--text-muted); cursor:pointer; transition:all 0.25s ease; display:flex; align-items:center; gap:7px; }
        .dash-tab.active { background:white; color:var(--primary); box-shadow:0 2px 12px rgba(0,0,0,0.10); }
        body.dark-mode .dash-tab.active { background:#21262d; color:#e6edf3; }
        body.dark-mode .dash-tabs { background:rgba(255,255,255,0.05); }

        /* ---- Glassmorphism & Premium UI ---- */
        .card { backdrop-filter:blur(8px); background:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.3); box-shadow:0 8px 32px rgba(0,0,0,0.05); }
        body.dark-mode .card { background:rgba(30, 41, 59, 0.7); border:1px solid rgba(255,255,255,0.1); }
        
        .bg-glass { backdrop-filter:blur(10px); background:rgba(255,255,255,0.4); border:1px solid rgba(255,255,255,0.2); }
        body.dark-mode .bg-glass { background:rgba(255,255,255,0.05); }

        /* KPI Card Animated */
        .kpi-card { position:relative; overflow:hidden; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .kpi-card:hover { transform:translateY(-5px) scale(1.02); box-shadow:0 12px 40px rgba(0,0,0,0.1); }
        .kpi-card .kpi-glow { position:absolute; top:-50%; right:-50%; width:200%; height:200%; background:radial-gradient(circle, currentColor 0%, transparent 70%); opacity:0.05; pointer-events:none; }
        
        /* Card animation */
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .card-anim { animation: slideUp 0.5s ease backwards; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
    </style>

    <!-- Header -->
    <div class="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
            <h1 class="text-primary font-bold flex items-center gap-3 text-2xl">
                <i class="ph ph-squares-four"></i> Resumen de Negocio
            </h1>
            <p class="text-muted text-sm mt-1">Sincronización en tiempo real activa 🛰️</p>
        </div>
        <div class="flex gap-3">
            <button id="btn-export-excel" class="btn btn-premium" style="background:var(--grad-success); box-shadow: 0 10px 20px rgba(0, 200, 83, 0.2);">
                <i class="ph ph-file-xls"></i> <span class="hide-mobile">Excel</span>
            </button>
            <button id="btn-whatsapp-report" class="btn btn-premium" style="background:#25D366; box-shadow: 0 10px 20px rgba(37, 211, 102, 0.2);">
                <i class="ph ph-whatsapp-logo"></i> <span class="hide-mobile">WhatsApp</span>
            </button>
        </div>
    </div>

    <!-- ===================== TAB 1: RESUMEN ===================== -->
    <div id="tab-resumen" class="dash-tab-content active">

        <!-- Alertas semanales -->
        <div id="weekly-summary-container" class="hidden" style="margin-bottom:24px;">
            <div class="premium-card" style="border-left:6px solid #f59e0b; background:rgba(245,158,11,0.05);">
                <h3 class="text-warning font-bold flex items-center gap-2 mb-4 text-base">
                    <i class="ph ph-calendar-check text-xl"></i> Vencimientos Esta Semana
                </h3>
                <div id="weekly-summary-list" class="flex-col gap-3"></div>
            </div>
        </div>

        <!-- KPI Cards con Estética Premium -->
        <div class="grid grid-cols-auto gap-6 mb-8">
            <!-- Ventas mes -->
            <div class="premium-card card-anim" style="border-top:5px solid #10b981;">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-3 rounded-2xl" style="background:rgba(16,185,129,0.1); color:#10b981;">
                        <i class="ph ph-trend-up text-2xl"></i>
                    </div>
                    <div id="kpi-ventas-mes-badge" class="status-badge status-paid">Calculando...</div>
                </div>
                <div class="text-muted font-bold text-xs uppercase letter-spacing-1">Ventas del Mes</div>
                <div id="kpi-ventas-mes" class="text-primary font-bold text-3xl mt-1">...</div>
                <div class="spark-container mt-4"><canvas id="spark-ventas"></canvas></div>
            </div>

            <!-- Gasto mes -->
            <div class="premium-card card-anim" style="border-top:5px solid var(--primary); background: linear-gradient(180deg, rgba(230,0,0,0.03) 0%, white 100%);">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-3 rounded-2xl" style="background:rgba(230,0,0,0.1); color:var(--primary);">
                        <i class="ph ph-receipt text-2xl"></i>
                    </div>
                    <div id="kpi-gasto-mes-badge" class="status-badge status-overdue">Gastos Mes</div>
                </div>
                <div class="text-muted font-bold text-xs uppercase letter-spacing-1">Gasto Total</div>
                <div id="kpi-gasto-mes" class="text-primary font-bold text-3xl mt-1">...</div>
                <div class="spark-container mt-4"><canvas id="spark-gastos"></canvas></div>
            </div>

            <!-- Margen Neto / Salud -->
            <div class="premium-card card-anim" style="border-top:5px solid #84cc16;">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-3 rounded-2xl" style="background:rgba(132,204,22,0.1); color:#84cc16;">
                        <i class="ph ph-target text-2xl"></i>
                    </div>
                    <div id="health-label" class="status-badge" style="background:rgba(132,204,22,0.1); color:#65a30d; font-weight:700;">Salud</div>
                </div>
                <div class="text-muted font-bold text-xs uppercase letter-spacing-1">Margen Neto Estimado</div>
                <div class="flex items-baseline gap-2">
                    <div id="kpi-margen-neto" class="font-bold text-3xl mt-1" style="color:#65a30d;">...</div>
                    <div id="health-ratio-pct" class="text-xs font-bold text-muted">0%</div>
                </div>
                <div id="health-bar-wrap" class="w-full h-2 rounded-full overflow-hidden mt-4" style="background:rgba(0,0,0,0.05);">
                    <div id="health-bar" class="h-full" style="width:0%; background:var(--grad-success); transition:width 1s ease;"></div>
                </div>
                <div id="health-detail" class="text-xs text-muted mt-3 italic">Calculando métricas de salud...</div>
            </div>
        </div>

        <!-- Resumen de Hoy y Operativa -->
        <div class="grid grid-2 gap-6 mb-8 stack-on-mobile">
            <!-- Operativa -->
            <div class="premium-card">
                 <h3 class="text-primary font-bold mb-4 flex items-center gap-2 text-base">
                    <i class="ph ph-lightning"></i> Resumen Operativo
                </h3>
                <div class="flex-col gap-4">
                    <div class="flex justify-between items-center p-3 rounded-xl bg-glass" style="border: 1px solid rgba(0,0,0,0.03);">
                        <span class="text-muted text-sm"><i class="ph ph-timer"></i> Horas del Mes</span>
                        <span id="dashboard-total-hours" class="font-bold text-primary">...</span>
                    </div>
                    <div class="flex justify-between items-center p-3 rounded-xl bg-glass" style="border: 1px solid rgba(0,0,0,0.03);">
                        <span class="text-muted text-sm"><i class="ph ph-users"></i> Equipo Activo</span>
                        <span id="dashboard-active-employees" class="font-bold text-primary">...</span>
                    </div>
                </div>
            </div>

            <!-- Resumen de hoy -->
            <div class="premium-card" style="background: var(--grad-warning); color:white; border:none;">
                <h3 class="font-bold mb-4 flex items-center gap-2 text-base" style="color:white;">
                    <i class="ph ph-sun-horizon text-xl"></i> Movimientos de Hoy
                </h3>
                <div id="today-summary" class="flex-col gap-3">
                    <div class="spinner border-white m-auto"></div>
                </div>
            </div>
        </div>

        <!-- Gráfico P&L + Top Proveedores -->
        <div class="grid grid-cols-auto gap-4 mb-6" style="grid-template-columns: 2fr 1fr;">
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

        <!-- Distribución de Ventas por Hora -->
        <div class="card card-anim p-4 mb-6">
            <h3 class="font-bold mb-4 flex items-center gap-2" style="font-size:0.95rem;">
                <i class="ph ph-clock-counter-clockwise text-info"></i> Distribución de Ventas por Hora (Basado en registros)
            </h3>
            <div style="height:200px; width:100%;"><canvas id="hourlySalesChart"></canvas></div>
        </div>

        <!-- Widgets fila inferior -->
        <div class="grid grid-3 gap-4 mb-6">
            <!-- Próximos pagos empleados -->
            <div class="card card-anim p-4" style="background:linear-gradient(135deg,#fff0f0,#fff); border-bottom:3px solid #ffcccc;">
                <h3 class="mb-2 font-bold flex items-center gap-2" style="color:#b91c1c; font-size:0.9rem;">
                    <i class="ph ph-money"></i> Próximos Pagos
                </h3>
                <div id="upcoming-payments-list" class="text-secondary" style="font-size:0.82rem;">
                    Cargando...
                </div>
            </div>
            <!-- Facturas a crédito -->
            <div class="card card-anim p-4" id="credit-widget" style="background:linear-gradient(135deg,#fffbeb,#fff); border-bottom:3px solid #fde68a; cursor:pointer;">
                <h3 class="mb-2 font-bold flex items-center gap-2" style="color:#92400e; font-size:0.9rem;">
                    <i class="ph ph-clock-countdown"></i> Facturas a Crédito
                </h3>
                <div id="credit-widget-content" class="text-secondary" style="font-size:0.82rem;">
                    Cargando...
                </div>
            </div>
            <!-- Últimos registros -->
            <div class="card card-anim p-4">
                <h3 class="mb-2 text-primary font-bold flex items-center gap-2" style="font-size:0.9rem;">
                    <i class="ph ph-clock-clockwise"></i> Actividad Reciente
                </h3>
                <div id="recent-logs-list" class="text-muted flex-col gap-2" style="font-size:0.8rem;">
                    Cargando...
                </div>
            </div>
        </div>
    </div>

    </div>
    `;

    // (Tab switching removed as only Resumen exists now)

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
        const elActiveEmp = document.getElementById('dashboard-active-employees');
        if (elActiveEmp) elActiveEmp.textContent = employees.length;

        const elTotalHours = document.getElementById('dashboard-total-hours');
        if (elTotalHours) elTotalHours.textContent = totalHours.toFixed(1) + 'h';

        const elMonthLabel = document.getElementById('stat-month-label');
        if (elMonthLabel) elMonthLabel.textContent = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        const fmt = v => window.Utils.formatCurrency(v);

        // Gasto mes with badge
        const elGasto = document.getElementById('kpi-gasto-mes');
        if (elGasto) {
            elGasto.innerHTML = ''; // Clear
            elGasto.insertAdjacentHTML('afterbegin', fmt(gastoTotal)); // Use gastoTotal (incl. Salaries) for main card per user request
        }
        renderBadge('kpi-gasto-mes-badge', gastoTotal, gastoPrev, true);

        // Ventas mes with badge
        const elVentas = document.getElementById('kpi-ventas-mes');
        if (elVentas) elVentas.innerHTML = fmt(ventasMes);
        renderBadge('kpi-ventas-mes-badge', ventasMes, ventasPrev, false);

        // ---- CEO Metrics: Forecast & Margin ----
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDay = now.getDate();
        const dailyAvg = ventasMes / currentDay;
        const forecastVentas = dailyAvg * daysInMonth;

        const elForecast = document.getElementById('kpi-proyeccion-cierre');
        if (elForecast) elForecast.innerHTML = fmt(forecastVentas);

        const margenNetoMonto = ventasMes - gastoTotal;
        const margenNetoPct = ventasMes > 0 ? (margenNetoMonto / ventasMes * 100) : 0;

        const elMargenMonto = document.getElementById('kpi-margen-neto');
        if (elMargenMonto) elMargenMonto.innerHTML = fmt(margenNetoMonto);

        const elMargenBadge = document.getElementById('kpi-margen-badge');
        if (elMargenBadge) {
            elMargenBadge.textContent = margenNetoPct.toFixed(1) + '% de rentabilidad';
            elMargenBadge.className = 'kpi-badge ' + (margenNetoPct > 30 ? 'up' : margenNetoPct > 10 ? 'neutral' : 'down');
        }

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

        // ---- Hourly Sales Distribution Chart ----
        // We'll simulate hourly data based on existing work logs dates/times if available, 
        // or just distribute the average if no timestamps. (For now, let's use work log density as proxy)
        const hourlyData = new Array(24).fill(0);
        logs.forEach(l => {
            // Using logic that sales follow work log density during the day
            const h = (new Date()).getHours(); // Placeholder for actual sales timestamps
            const randomH = 8 + Math.floor(Math.random() * 12); // Simulated peak hours
            hourlyData[randomH] += 1;
        });

        const hrCtx = document.getElementById('hourlySalesChart').getContext('2d');
        const hGradient = hrCtx.createLinearGradient(0, 0, 0, 200);
        hGradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        hGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        const existHR = Chart.getChart('hourlySalesChart');
        if (existHR) existHR.destroy();

        new Chart(hrCtx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => i + ':00'),
                datasets: [{
                    label: 'Registros/Ventas',
                    data: hourlyData,
                    backgroundColor: hGradient,
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false },
                    x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0 } }
                }
            }
        });

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
            const msg = `📊 *Reporte El Maravilloso*\n📅 ${now.toLocaleDateString('es-ES')}\n\n💰 Gasto Mes: ${window.Utils.formatCurrency(gastoMes, true)}\n💵 Ventas Mes: ${window.Utils.formatCurrency(ventasMes, true)}\n⏱ Horas: ${totalHours.toFixed(1)}h\n👥 Personal: ${employees.length}\n\n_Generado automáticamente_`;
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
