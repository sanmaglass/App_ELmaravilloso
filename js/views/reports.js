// Reports View (Reportes Financieros)
window.Views = window.Views || {};

window.Views.reports = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-chart-line-up" style="color:var(--primary);"></i> Reportes Financieros
                </h1>
                <p style="color:var(--text-muted);">Análisis de gastos, ventas y márgenes</p>
            </div>
             <div style="display:flex; gap:12px;">
                <select id="report-period" class="form-input" style="width:auto;">
                    <option value="all">Todo el Historial</option>
                    <option value="month">Este Mes</option>
                    <option value="year">Este Año</option>
                </select>
                <button class="btn btn-secondary" onclick="window.Views.reports(document.getElementById('view-container'))">
                    <i class="ph ph-arrow-clockwise"></i> Actualizar
                </button>
            </div>
        </div>

        <!-- KPI Cards -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:20px; margin-bottom:32px;">
            <div class="card" style="padding:20px; border-left:4px solid var(--primary);">
                <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:4px;">Ventas Totales</div>
                <div style="font-size:1.8rem; font-weight:700; color:var(--text-primary);" id="kpi-sales">$0</div>
            </div>
            <div class="card" style="padding:20px; border-left:4px solid #f59e0b;">
                <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:4px;">Gastos (Compras)</div>
                <div style="font-size:1.8rem; font-weight:700; color:var(--text-primary);" id="kpi-expenses">$0</div>
            </div>
             <div class="card" style="padding:20px; border-left:4px solid #10b981;">
                <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:4px;">Ganancia Estimada</div>
                <div style="font-size:1.8rem; font-weight:700; color:#10b981;" id="kpi-profit">$0</div>
            </div>
        </div>

        <!-- Charts Row 1 -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:24px; margin-bottom:32px;">
            
            <!-- Spending by Supplier -->
            <div class="card" style="padding:20px;">
                <h3 style="margin-bottom:20px; font-size:1.1rem;">Gastos por Proveedor</h3>
                <div style="height:300px; position:relative;">
                    <canvas id="chart-suppliers"></canvas>
                </div>
            </div>

            <!-- Monthly Trend -->
            <div class="card" style="padding:20px;">
                <h3 style="margin-bottom:20px; font-size:1.1rem;">Tendencia (Ventas vs Compras)</h3>
                <div style="height:300px; position:relative;">
                    <canvas id="chart-trend"></canvas>
                </div>
            </div>
        </div>

        <!-- Pendings Section -->
        <div class="card" style="padding:0; overflow:hidden;">
            <div style="padding:16px; border-bottom:1px solid var(--border); background:var(--bg-input); display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:1rem; margin:0; color:#d97706;"><i class="ph ph-warning-circle"></i> Pagos Pendientes a Proveedores</h3>
            </div>
            <div id="pending-list" style="max-height:300px; overflow-y:auto;">
                 <div class="loading-state"><div class="spinner"></div></div>
            </div>
        </div>
    `;

    renderReports();

    document.getElementById('report-period').addEventListener('change', () => renderReports());
};

async function renderReports() {
    try {
        const period = document.getElementById('report-period').value;

        // Fetch Data
        const [purchases, sales, suppliers] = await Promise.all([
            window.db.purchase_invoices.toArray(),
            window.db.sales_invoices.toArray(),
            window.db.suppliers.toArray()
        ]);

        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

        // Filter Deleted
        let activePurchases = purchases.filter(p => !p.deleted);
        let activeSales = sales.filter(s => !s.deleted);

        // Filter by Period (Basic)
        // TODO: Implement proper date filtering logic based on 'period'
        // For now, assuming 'all' for simplicity or implement simple filter
        if (period !== 'all') {
            const now = new Date();
            activePurchases = activePurchases.filter(p => {
                const d = new Date(p.date);
                if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                if (period === 'year') return d.getFullYear() === now.getFullYear();
                return true;
            });
            activeSales = activeSales.filter(s => {
                const d = new Date(s.date);
                if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                if (period === 'year') return d.getFullYear() === now.getFullYear();
                return true;
            });
        }

        // --- KPIS ---
        const totalSales = activeSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
        const totalExpenses = activePurchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const profit = totalSales - totalExpenses;

        document.getElementById('kpi-sales').textContent = formatCurrency(totalSales);
        document.getElementById('kpi-expenses').textContent = formatCurrency(totalExpenses);
        document.getElementById('kpi-profit').textContent = formatCurrency(profit);

        // --- CHART: Suppliers ---
        const supplierTotals = {};
        activePurchases.forEach(p => {
            const name = supplierMap[p.supplierId] || 'Desconocido';
            supplierTotals[name] = (supplierTotals[name] || 0) + (parseFloat(p.amount) || 0);
        });

        const sortedSuppliers = Object.entries(supplierTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8); // Top 8

        renderPieChart('chart-suppliers',
            sortedSuppliers.map(([n]) => n),
            sortedSuppliers.map(([, v]) => v)
        );

        // --- CHART: Trends (By Month) ---
        // Group by YYYY-MM
        const months = {};
        [...activePurchases, ...activeSales].forEach(item => {
            const m = item.date.substring(0, 7); // YYYY-MM
            if (!months[m]) months[m] = { sales: 0, expenses: 0 };
        });

        activePurchases.forEach(p => {
            const m = p.date.substring(0, 7);
            months[m].expenses += (parseFloat(p.amount) || 0);
        });
        activeSales.forEach(s => {
            const m = s.date.substring(0, 7);
            months[m].sales += (parseFloat(s.total) || 0);
        });

        const sortedMonths = Object.keys(months).sort();
        renderLineChart('chart-trend',
            sortedMonths,
            sortedMonths.map(m => months[m].sales),
            sortedMonths.map(m => months[m].expenses)
        );

        // --- PENDING PAYMENTS ---
        const pending = activePurchases
            .filter(p => p.paymentStatus === 'Pendiente')
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // Oldest first

        const pendingList = document.getElementById('pending-list');
        if (pending.length === 0) {
            pendingList.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">¡Todo pagado! No hay deudas pendientes.</div>`;
        } else {
            pendingList.innerHTML = pending.map(p => `
                <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600; color:var(--text-primary);">${supplierMap[p.supplierId] || 'Desconocido'}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Vence: ${formatDate(p.date)} • Factura #${p.invoiceNumber}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700; color:#d97706;">${formatCurrency(p.amount)}</div>
                        <button class="btn btn-icon" title="Marcar Pagado" onclick="markAsPaid(${p.id})">
                             <i class="ph ph-check-circle" style="color:#10b981;"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            window.markAsPaid = async (id) => {
                if (confirm('¿Marcar factura como PAGADA?')) {
                    await window.db.purchase_invoices.update(id, { paymentStatus: 'Pagado' });
                    renderReports(); // Refresh
                }
            };
        }

    } catch (e) {
        console.error(e);
    }
}

// --- CHART HELPERS ---
function renderPieChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // Destroy existing if any (simple way: check property)
    if (window[canvasId] instanceof Chart) window[canvasId].destroy();

    window[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderLineChart(canvasId, labels, dataSales, dataExpenses) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    if (window[canvasId] instanceof Chart) window[canvasId].destroy();

    window[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ventas',
                    data: dataSales,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Gastos',
                    data: dataExpenses,
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
