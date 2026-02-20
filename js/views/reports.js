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
                <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:4px;">Total Egresos</div>
                <div style="font-size:1.8rem; font-weight:700; color:var(--text-primary);" id="kpi-expenses">$0</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;" id="kpi-expenses-detail">Compras + Gastos + Sueldos</div>
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

// --- RENDER REPORTS LOGIC ---
async function renderReports() {
    try {
        const period = document.getElementById('report-period').value;

        // Fetch Data
        const [purchases, sales, suppliers, expenses, employees, workLogs, dailySales] = await Promise.all([
            window.db.purchase_invoices.toArray(),
            window.db.sales_invoices.toArray(),
            window.db.suppliers.toArray(),
            window.db.expenses.toArray(),
            window.db.employees.toArray(),
            window.db.workLogs.toArray(),
            window.db.daily_sales.toArray()
        ]);

        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

        // Filter Deleted
        let activePurchases = purchases.filter(p => !p.deleted);
        let activeSales = sales.filter(s => !s.deleted); // Keep purely invoice based sales
        let activeDailySales = dailySales.filter(d => !d.deleted);
        let activeExpenses = expenses.filter(e => !e.deleted);
        let activeEmployees = employees.filter(e => !e.deleted);
        let activeLogs = workLogs.filter(l => !l.deleted);

        // --- FILTER BY PERIOD ---
        const now = new Date();
        const filterDate = (dateStr) => {
            const d = new Date(dateStr);
            if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (period === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        };

        // Filter Arrays
        const filteredPurchases = activePurchases.filter(p => filterDate(p.date));
        const filteredSalesInvoices = activeSales.filter(s => filterDate(s.date));
        const filteredDailySales = activeDailySales.filter(d => filterDate(d.date));
        const filteredExpenses = activeExpenses.filter(e => filterDate(e.date));

        // --- CALCULATE TOTALS ---

        // 1. Sales (Prioritize Daily Sales + Invoices if needed, but avoid double counting if user does both?)
        // Strategy: User explicitly asked for Daily Registry. We will SUM Daily Sales.
        // If they also use Invoices, we assume they are SEPARATE (e.g. B2B invoices vs POS daily total). 
        // We will sum BOTH for Total Revenue.
        const totalInvoiceSales = filteredSalesInvoices.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
        const totalDailySales = filteredDailySales.reduce((sum, d) => sum + (parseFloat(d.total) || 0), 0);

        const totalSales = totalInvoiceSales + totalDailySales;

        // 2. Purchase Invoices
        const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        // 3. General Expenses
        const totalGeneralExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        // 4. Salaries (Estimated for Period)
        let totalSalaries = 0;

        if (period === 'month') {
            // Precise estimation for current month using Utils
            const monthlyStats = await window.Utils.calculateMonthlyPayments(activeEmployees, activeLogs, now);
            totalSalaries = monthlyStats.totalPaid;
        } else if (period === 'year') {
            // Sum completed weekly cycles + daily logs for the year
            const weeksPassed = window.Utils.getWeekNumber ? window.Utils.getWeekNumber(now) : 52;
            activeEmployees.filter(e => e.paymentMode === 'salary').forEach(emp => {
                totalSalaries += (emp.baseSalary / 4) * weeksPassed;
            });
            activeLogs.forEach(log => {
                if (filterDate(log.date)) {
                    const emp = activeEmployees.find(e => e.id === log.employeeId);
                    if (emp && (!emp.paymentMode || emp.paymentMode === 'manual')) {
                        totalSalaries += (log.payAmount || 0);
                    }
                }
            });
        } else { // ALL TIME
            // Sum all manual daily logs
            activeLogs.forEach(log => {
                const emp = activeEmployees.find(e => e.id === log.employeeId);
                if (emp && (!emp.paymentMode || emp.paymentMode === 'manual')) {
                    totalSalaries += (log.payAmount || 0);
                }
            });
            // For salary employees: approximate total based on months active
            activeEmployees.filter(e => e.paymentMode === 'salary' && e.startDate && e.baseSalary).forEach(emp => {
                const start = new Date(emp.startDate);
                const monthsActive = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
                totalSalaries += emp.baseSalary * monthsActive;
            });
        }

        const totalCosts = totalPurchases + totalGeneralExpenses + totalSalaries;
        const profit = totalSales - totalCosts;

        // --- UPDATE KPIS ---
        document.getElementById('kpi-sales').textContent = formatCurrency(totalSales);
        document.getElementById('kpi-expenses').textContent = formatCurrency(totalCosts);
        // Show dynamic breakdown of costs
        const detailEl = document.getElementById('kpi-expenses-detail');
        if (detailEl) {
            detailEl.innerHTML = `
                Compras: <b>${formatCurrency(totalPurchases)}</b> •
                Gastos: <b>${formatCurrency(totalGeneralExpenses)}</b> •
                Sueldos: <b>${formatCurrency(totalSalaries)}</b>
            `;
        }
        document.getElementById('kpi-profit').textContent = formatCurrency(profit);

        // Color profit
        const pEl = document.getElementById('kpi-profit');
        pEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';


        // --- CHART: Expenses Breakdown (Pie) ---
        // Instead of just Suppliers, let's show Categories of COST:
        // "Proveedores", "Sueldos", "Servicios", "Arriendo", etc.
        const costBreakdown = {
            'Proveedores': totalPurchases,
            'Sueldos': totalSalaries
        };

        // Add General Expenses by Category
        filteredExpenses.forEach(e => {
            costBreakdown[e.category] = (costBreakdown[e.category] || 0) + (parseFloat(e.amount) || 0);
        });

        const sortedCosts = Object.entries(costBreakdown)
            .sort(([, a], [, b]) => b - a);

        renderPieChart('chart-suppliers', // Reusing canvas ID
            sortedCosts.map(([n]) => n),
            sortedCosts.map(([, v]) => v)
        );
        // Update Chart Title
        document.querySelector('#chart-suppliers').parentNode.previousElementSibling.textContent = "Desglose de Costos";


        // --- CHART: Trends (Ventas vs Costos Totales) ---
        renderLineChart('chart-trend',
            ['Ventas del Período', 'Costos del Período'],
            [totalSales],
            [totalCosts]
        );
        document.querySelector('#chart-trend').parentNode.previousElementSibling.textContent = "Balance del Período";


        // --- PENDING PAYMENTS (Same as before) ---
        const pending = filteredPurchases.filter(p => p.paymentStatus === 'Pendiente');
        // ... (Keep existing pending logic) ... 

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
                    // Sync with Supabase
                    if (window.Sync?.client) {
                        await window.Sync.client.from('purchase_invoices').update({ paymentStatus: 'Pagado' }).eq('id', id);
                    }
                    renderReports(); // Refresh
                }
            };
        }

    } catch (e) {
        console.error(e);
        document.getElementById('view-container').innerHTML += `<div style="color:red">Error en reporte: ${e.message}</div>`;
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
