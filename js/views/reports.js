// Reports View — Historial Mensual
window.Views = window.Views || {};

window.Views.reports = async (container) => {
    // Save the real function to avoid dashboard alias recursion
    window.Views._reportsReal = window.Views.reports;

    container.innerHTML = `
    <style>
        .month-card {
            background: rgba(255,255,255,0.75);
            border: 1px solid rgba(255,255,255,0.4);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            transition: box-shadow 0.2s ease;
        }
        body.dark-mode .month-card {
            background: rgba(22,27,34,0.95);
            border-color: rgba(255,255,255,0.08);
        }
        .month-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            cursor: pointer;
            user-select: none;
            flex-wrap: wrap;
            gap: 10px;
        }
        .month-card-header:hover { background: rgba(0,0,0,0.02); }
        .month-card-body {
            display: none;
            padding: 0 20px 20px;
            border-top: 1px solid rgba(0,0,0,0.05);
        }
        body.dark-mode .month-card-body { border-top-color: rgba(255,255,255,0.06); }
        .month-card-body.open { display: block; }
        .month-stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 9px 0;
            border-bottom: 1px solid rgba(0,0,0,0.04);
            font-size: 0.88rem;
        }
        body.dark-mode .month-stat-row { border-bottom-color: rgba(255,255,255,0.05); }
        .month-stat-row:last-child { border-bottom: none; }
        .profit-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 10px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.8rem;
        }
        .month-toggle-icon { transition: transform 0.25s ease; font-size: 1.1rem; }
        .month-toggle-icon.open { transform: rotate(180deg); }
    </style>

    <div class="flex-between flex-wrap gap-3 mb-24">
        <div>
            <h1 class="flex items-center gap-2 mb-6-px text-primary">
                <i class="ph ph-calendar-dots text-primary"></i> Historial Mensual
            </h1>
            <p class="text-muted text-sm">Resumen de ventas, gastos y utilidad por mes</p>
        </div>
        <button class="btn btn-secondary" id="btn-expand-all">
            <i class="ph ph-caret-double-down"></i> Expandir Todo
        </button>
    </div>

    <!-- Gráfico comparativo -->
    <div class="card p-4 mb-24">
        <div class="flex-between flex-wrap gap-2 mb-16">
            <h3 class="flex items-center gap-2 text-base font-bold">
                <i class="ph ph-chart-bar text-info"></i> Comparativo Mensual
            </h3>
            <span class="text-xs text-muted">Últimos 12 meses</span>
        </div>
        <div style="height:220px; width:100%;"><canvas id="reportBarChart"></canvas></div>
    </div>

    <!-- Lista de meses -->
    <div id="months-list" class="flex flex-col gap-3">
        <div class="loading-state"><div class="spinner"></div><p>Calculando historial...</p></div>
    </div>
    `;

    try {
        const now = new Date();
        const fmt = v => window.Utils.formatCurrency(v);
        const monthLabel = mStr => {
            const [y, m] = mStr.split('-');
            const d = new Date(y, m - 1);
            const lbl = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            return lbl.charAt(0).toUpperCase() + lbl.slice(1);
        };

        // Cargar todas las tablas de una vez
        const [allDailySales, allExpenses, allPurchases, allSalesInv] = await Promise.all([
            window.db.daily_sales.toArray(),
            window.db.expenses.toArray(),
            window.db.purchase_invoices.toArray(),
            window.db.sales_invoices.toArray()
        ]);

        const dailySales = allDailySales.filter(r => !r.deleted && (parseFloat(r.total) || 0) < 1e9);
        const expenses = allExpenses.filter(r => !r.deleted);
        const purchases = allPurchases.filter(r => !r.deleted);
        const salesInvoices = allSalesInv.filter(r => !r.deleted);

        // Recoger todos los meses que aparecen en cualquier tabla
        const monthsSet = new Set();
        const addMonth = r => { if (r.date && r.date.length >= 7) monthsSet.add(r.date.substring(0, 7)); };
        [...dailySales, ...expenses, ...purchases, ...salesInvoices].forEach(addMonth);

        // Generar los últimos 12 meses aunque no haya datos (para el gráfico)
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        const sortedMonths = Array.from(monthsSet).sort().reverse();

        // Calcular totales por mes
        const monthData = sortedMonths.map(mStr => {
            const inMonth = r => r.date && r.date.startsWith(mStr);
            const ventas = dailySales.filter(inMonth).reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
            const facturadas = salesInvoices.filter(inMonth).reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
            const compras = purchases.filter(inMonth).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const gastosG = expenses.filter(inMonth).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const totalVentas = ventas + facturadas;
            const totalGastos = compras + gastosG;
            const nCierres = dailySales.filter(inMonth).length;
            const nGastos = expenses.filter(inMonth).length;
            const nCompras = purchases.filter(inMonth).length;
            return { mStr, ventas, facturadas, compras, gastosG, totalVentas, totalGastos, nCierres, nGastos, nCompras };
        });

        // Renderizar gráfico (últimos 6 meses, orden ascendente)
        const chart6 = monthData.slice(0, 6).reverse();
        const chartLabels = chart6.map(m => monthLabel(m.mStr).split(' ')[0]);
        const chartVentas = chart6.map(m => m.totalVentas);
        const chartGastos = chart6.map(m => m.totalGastos);

        const ctx = document.getElementById('reportBarChart').getContext('2d');
        const existing = Chart.getChart('reportBarChart');
        if (existing) existing.destroy();

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Ventas',
                        data: chartVentas,
                        backgroundColor: 'rgba(16,185,129,0.75)',
                        borderColor: '#10b981',
                        borderWidth: 2,
                        borderRadius: 6
                    },
                    {
                        label: 'Gastos',
                        data: chartGastos,
                        backgroundColor: 'rgba(239,68,68,0.65)',
                        borderColor: '#ef4444',
                        borderWidth: 2,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { weight: '600' } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${window.Utils.formatCurrency(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: { font: { size: 10 }, callback: v => '$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v) }
                    },
                    x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } }
                }
            }
        });

        // Renderizar cards de meses
        const monthsList = document.getElementById('months-list');

        if (monthData.every(m => m.totalVentas === 0 && m.totalGastos === 0)) {
            monthsList.innerHTML = `
                <div class="text-center p-6 bg-glass border-dashed border rounded-lg">
                    <i class="ph ph-calendar-x text-muted text-4xl"></i>
                    <h3 class="text-muted mt-2">No hay historial aún</h3>
                    <p class="text-muted text-sm mt-1">Empieza registrando ventas diarias o gastos.</p>
                </div>`;
            return;
        }

        monthsList.innerHTML = monthData.map((m, idx) => {
            const utilidad = m.totalVentas - m.totalGastos;
            const margen = m.totalVentas > 0 ? (utilidad / m.totalVentas * 100).toFixed(1) : null;
            const pillColor = utilidad >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
            const pillText = utilidad >= 0 ? '#065f46' : '#991b1b';
            const pillIcon = utilidad >= 0 ? 'ph-trend-up' : 'ph-trend-down';

            // Mes actual: abrir por defecto
            const isCurrentMonth = m.mStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            return `
            <div class="month-card" data-month="${m.mStr}">
                <div class="month-card-header" onclick="this.nextElementSibling.classList.toggle('open'); this.querySelector('.month-toggle-icon').classList.toggle('open');">
                    <!-- Mes -->
                    <div style="display:flex; align-items:center; gap:12px; flex:1 1 160px; min-width:0;">
                        <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg,var(--primary),#b30000); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="ph ph-calendar-blank" style="color:white; font-size:1.2rem;"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:1rem; color:var(--text-primary);">
                                ${monthLabel(m.mStr)}${isCurrentMonth ? ' <span style="background:rgba(230,0,0,0.1);color:var(--primary);font-size:0.7rem;padding:2px 7px;border-radius:20px;font-weight:700;vertical-align:middle;">ACTUAL</span>' : ''}
                            </div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">${m.nCierres} cierre${m.nCierres !== 1 ? 's' : ''} · ${m.nGastos} gasto${m.nGastos !== 1 ? 's' : ''} · ${m.nCompras} compra${m.nCompras !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <!-- Resumen compacto -->
                    <div class="flex items-center gap-3 flex-wrap">
                        <div class="text-right">
                            <div class="text-xs text-muted font-bold uppercase tracking-wider">Ventas</div>
                            <div class="text-base font-bold text-success">${fmt(m.totalVentas)}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-muted font-bold uppercase tracking-wider">Gastos</div>
                            <div class="text-base font-bold text-primary">${fmt(m.totalGastos)}</div>
                        </div>
                        <div class="profit-pill" style="background:${pillColor}; color:${pillText};">
                            <i class="ph ${pillIcon}"></i>
                            ${fmt(utilidad)}${margen !== null ? ` <span class="opacity-70 font-normal">(${margen}%)</span>` : ''}
                        </div>
                        <i class="ph ph-caret-down month-toggle-icon${isCurrentMonth ? ' open' : ''}"></i>
                    </div>
                </div>
                <div class="month-card-body${isCurrentMonth ? ' open' : ''}">
                    <div style="padding-top:14px;">
                        <div class="month-stat-row">
                            <span style="color:var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="ph ph-currency-dollar" style="color:#10b981;"></i> Cierres Diarios</span>
                            <span style="font-weight:700; color:#10b981;">${fmt(m.ventas)}</span>
                        </div>
                        ${m.facturadas > 0 ? `
                        <div class="month-stat-row">
                            <span style="color:var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="ph ph-file-text" style="color:#3b82f6;"></i> Facturas Emitidas</span>
                            <span style="font-weight:700; color:#3b82f6;">${fmt(m.facturadas)}</span>
                        </div>` : ''}
                        <div class="month-stat-row">
                            <span style="color:var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="ph ph-receipt" style="color:var(--primary);"></i> Facturas de Compra</span>
                            <span style="font-weight:700; color:var(--primary);">- ${fmt(m.compras)}</span>
                        </div>
                        <div class="month-stat-row">
                            <span style="color:var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="ph ph-coin" style="color:#f59e0b;"></i> Gastos Generales</span>
                            <span style="font-weight:700; color:#f59e0b;">- ${fmt(m.gastosG)}</span>
                        </div>
                        <div class="month-stat-row" style="border-top: 2px solid rgba(0,0,0,0.08); margin-top:6px; padding-top:10px;">
                            <span style="font-weight:700; color:var(--text-primary);">Utilidad Neta Estimada</span>
                            <span style="font-weight:800; font-size:1.05rem; color:${utilidad >= 0 ? '#10b981' : '#ef4444'};">
                                ${utilidad >= 0 ? '+' : ''}${fmt(utilidad)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Botón expandir todo
        let expanded = false;
        document.getElementById('btn-expand-all').addEventListener('click', () => {
            expanded = !expanded;
            document.querySelectorAll('.month-card-body').forEach(b => b.classList.toggle('open', expanded));
            document.querySelectorAll('.month-toggle-icon').forEach(i => i.classList.toggle('open', expanded));
            document.getElementById('btn-expand-all').innerHTML = expanded
                ? '<i class="ph ph-caret-double-up"></i> Colapsar Todo'
                : '<i class="ph ph-caret-double-down"></i> Expandir Todo';
        });

    } catch (e) {
        console.error('Reports error:', e);
        document.getElementById('months-list').innerHTML = `<div style="color:red;">Error: ${window.Utils.escapeHTML(e.message)}</div>`;
    }
};
