// Dashboard View
window.Views = window.Views || {};

window.Views.dashboard = async (container) => {
    // Basic Layout
    container.innerHTML = `
        <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
             <!-- Header Title Placeholder -->
             <div class="hide-mobile" style="font-size:1.5rem; font-weight:bold; color:var(--text-primary);">Resumen General</div>
             
             <div style="display:flex; gap:12px;">
                <button id="btn-export-excel" class="btn" style="background:var(--success); color:white; border:none; display:flex; gap:8px; align-items:center; box-shadow:0 4px 6px rgba(0, 200, 83, 0.2); flex:1;">
                    <i class="ph ph-file-xls" style="font-size:1.2rem;"></i> 
                    <span class="hide-mobile">Exportar Excel</span>
                </button>
                <button id="btn-whatsapp-report" class="btn" style="background:#25D366; color:white; border:none; display:flex; gap:8px; align-items:center; box-shadow:0 4px 6px rgba(37, 211, 102, 0.3); flex:1;">
                    <i class="ph ph-whatsapp-logo" style="font-size:1.2rem;"></i> 
                    <span class="hide-mobile">WhatsApp</span>
                </button>
             </div>
        </div>

        <!-- TOP ALERTS (EXPIRY) -->
        <div id="expiry-alerts-container" class="hidden" style="margin-bottom:24px;">
            <div class="card" style="border-left: 5px solid var(--danger); background: rgba(255,23,68,0.05);">
                <h3 style="color:var(--danger); display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <i class="ph ph-warning-octagon"></i> Alerta de Vencimientos
                </h3>
                <div id="expiry-alerts-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:12px;">
                    <!-- Dynamic Alerts -->
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="card stat-card">
                <span class="stat-title">Gasto Mensual</span>
                <span class="stat-value" id="dashboard-total-spent">Cargando...</span>
                <span class="stat-trend trend-up" id="stat-month-label">Mes Actual</span>
            </div>
            <div class="card stat-card">
                <span class="stat-title">Horas Trabajadas</span>
                <span class="stat-value" id="dashboard-total-hours">...</span>
            </div>
            <div class="card stat-card">
                <span class="stat-title">Empleados Activos</span>
                <span class="stat-value" id="dashboard-active-employees">...</span>
            </div>
        </div>
        
        <div class="responsive-grid-2-1" style="margin-top: 32px;">
            <div class="card">
                <h3 style="margin-bottom:16px; color:var(--text-primary);">Tendencia de Gastos (Anual)</h3>
                <div style="height:200px; width:100%;">
                    <canvas id="expenseChart"></canvas>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:24px;">
                <!-- NEW: UPCOMING PAYMENTS WIDGET -->
                <div class="card" style="background:linear-gradient(135deg, #fff0f0, #fff); border:1px solid #ffcccc;">
                     <h3 style="margin-bottom:12px; color:#b91c1c; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-money"></i> Próximos Pagos
                     </h3>
                     <div id="upcoming-payments-list" style="font-size:0.9rem; color:var(--text-secondary);">
                        <span class="loader"></span> Calculando...
                     </div>
                </div>

                <!-- NEW: CREDIT INVOICES WIDGET -->
                <div class="card" id="credit-widget" style="background:linear-gradient(135deg, #fffbeb, #fef9e7); border:1px solid #fde68a; cursor:pointer; transition:all 0.2s;" title="Ir a Facturas de Compra">
                     <h3 style="margin-bottom:12px; color:#92400e; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-clock-countdown"></i> Facturas a Crédito
                     </h3>
                     <div id="credit-widget-content" style="font-size:0.9rem; color:var(--text-secondary);">
                        <span class="loader"></span> Calculando...
                     </div>
                </div>

                <div class="card">
                     <h3 style="margin-bottom:16px; color:var(--text-primary);">Ultimos Registros</h3>
                     <div id="recent-logs-list" style="font-size:0.9rem; color:var(--text-muted); display:flex; flex-direction:column; gap:8px;">
                        Cargando...
                     </div>
                </div>
            </div>
        </div>
    `;

    // --- PAYMENTS LOGIC ---
    // Moved to Utils for reusability
    const calculateNextPayments = window.Utils.calculateNextPayments;

    // Load Data
    try {
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

        // 1. Employees Count
        const allEmployees = await window.db.employees.toArray();
        const employees = allEmployees.filter(e => !e.deleted);
        document.getElementById('dashboard-active-employees').textContent = employees.length;

        // Populate Payments Widget with error handling
        try {
            const paymentsHTML = await window.Utils.calculateNextPayments(employees);
            document.getElementById('upcoming-payments-list').innerHTML = paymentsHTML;
        } catch (paymentError) {
            console.error('Error calculating next payments:', paymentError);
            document.getElementById('upcoming-payments-list').innerHTML =
                '<p style="color: var(--danger); font-size: 0.85rem;">⚠️ Error calculando pagos. Revisa la configuración de empleados.</p>';
        }

        // 2. Expiry Alerts Logic
        const allProducts = await window.db.products.toArray();
        const products = allProducts.filter(p => !p.deleted);
        const expiryList = document.getElementById('expiry-alerts-list');
        const alertContainer = document.getElementById('expiry-alerts-container');

        const expiringSoon = products.filter(p => {
            if (!p.expiryDate) return false;
            const expiry = new Date(p.expiryDate);
            const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
            return diffDays <= 30; // 30 days threshold
        }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

        if (expiringSoon.length > 0) {
            alertContainer.classList.remove('hidden');
            expiryList.innerHTML = expiringSoon.map(p => {
                const expiry = new Date(p.expiryDate);
                const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                const color = diffDays <= 7 ? 'var(--danger)' : '#f59e0b'; // Red if < 7 days, Orange if < 30
                const icon = diffDays <= 7 ? 'ph-prohibit' : 'ph-clock-countdown';

                return `
                    <div style="padding:12px; border:1px solid rgba(0,0,0,0.05); border-radius:8px; display:flex; align-items:center; gap:12px; background:white;">
                        <i class="ph ${icon}" style="font-size:1.5rem; color:${color};"></i>
                        <div>
                            <div style="font-weight:700; font-size:0.9rem;">${p.name}</div>
                            <div style="font-size:0.75rem; color:${color}; font-weight:600;">
                                Vence en ${diffDays} días (${window.Utils.formatDate(p.expiryDate)})
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            alertContainer.classList.add('hidden');
        }

        // 2b. Credit Invoices Widget
        try {
            const allInvoices = await window.db.purchase_invoices.toArray();
            const allSuppliers = await window.db.suppliers.toArray();
            const supplierMap = {};
            allSuppliers.forEach(s => supplierMap[s.id] = s.name);

            const creditPending = allInvoices.filter(i =>
                !i.deleted && i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente' && i.dueDate
            );
            const totalCredit = creditPending.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const overdue = creditPending.filter(i => new Date(i.dueDate) < todayDate);
            const dueSoon = creditPending.filter(i => {
                const d = new Date(i.dueDate);
                const diff = Math.ceil((d - todayDate) / (1000 * 60 * 60 * 24));
                return diff >= 0 && diff <= 7;
            });

            const creditEl = document.getElementById('credit-widget-content');
            if (creditPending.length === 0) {
                creditEl.innerHTML = '<p style="color:#16a34a; font-weight:600;">✅ Sin deudas a crédito pendientes</p>';
            } else {
                let creditHTML = `<div style="font-size:1.3rem; font-weight:700; color:#92400e; margin-bottom:8px;">${window.Utils.formatCurrency(totalCredit)}</div>`;
                creditHTML += `<div style="font-size:0.85rem; color:#78350f;">${creditPending.length} factura${creditPending.length > 1 ? 's' : ''} pendiente${creditPending.length > 1 ? 's' : ''}</div>`;
                if (overdue.length > 0) {
                    creditHTML += `<div style="margin-top:6px; color:#dc2626; font-weight:700; font-size:0.85rem;">🚨 ${overdue.length} vencida${overdue.length > 1 ? 's' : ''}</div>`;
                }
                if (dueSoon.length > 0) {
                    creditHTML += `<div style="margin-top:4px; color:#ea580c; font-weight:600; font-size:0.8rem;">⏰ ${dueSoon.length} vence${dueSoon.length > 1 ? 'n' : ''} esta semana</div>`;
                }
                creditEl.innerHTML = creditHTML;
            }

            // Click to navigate to purchase invoices
            document.getElementById('credit-widget').addEventListener('click', () => {
                const navBtn = document.querySelector('[data-view="purchase_invoices"]');
                if (navBtn) navBtn.click();
            });
        } catch (creditErr) {
            console.error('Error loading credit widget:', creditErr);
            document.getElementById('credit-widget-content').innerHTML =
                '<p style="color:var(--text-muted); font-size:0.85rem;">No disponible</p>';
        }

        // 3. Work Logs + Payment Calculations
        const allLogs = await window.db.workLogs.toArray();
        const logs = allLogs.filter(l => !l.deleted);

        // NEW: Calculate total payments for the month including completed payment cycles
        const monthlyPayments = await window.Utils.calculateMonthlyPayments(employees, logs, now);

        // Filter Current Month logs for hours calculation
        const currentMonthLogs = logs.filter(l => l.date.startsWith(currentMonthStr));
        const totalHours = currentMonthLogs.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

        // Update DOM with new calculation
        document.getElementById('dashboard-total-spent').innerHTML = window.Utils.formatCurrency(monthlyPayments.totalPaid);
        document.getElementById('dashboard-total-hours').textContent = totalHours.toFixed(1) + 'h';
        document.getElementById('stat-month-label').textContent = window.Utils.formatDate(now, { month: 'long' });

        // 3. Recent Logs List (Last 5)
        const recentLogs = logs.sort((a, b) => b.id - a.id).slice(0, 5);
        const logsContainer = document.getElementById('recent-logs-list');

        if (recentLogs.length === 0) {
            logsContainer.innerHTML = 'Sin actividad reciente.';
        } else {
            logsContainer.innerHTML = recentLogs.map(l => {
                const emp = employees.find(e => e.id === l.employeeId);
                return `
                    <div style="padding:12px; background:var(--bg-app); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text-primary);">${emp ? emp.name : 'Desc.'}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${window.Utils.formatDate(l.date)}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="color:var(--accent); font-weight:600;">${window.Utils.formatCurrency(l.payAmount)}</div>
                            <div style="font-size:0.75rem;">${l.totalHours}h</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 4. Setup Chart.js (Monthly Aggregation) - Updated colors for Light Theme
        const monthlyData = Array(12).fill(0);
        logs.forEach(l => {
            const date = new Date(l.date);
            if (date.getFullYear() === now.getFullYear()) {
                monthlyData[date.getMonth()] += (l.payAmount || 0);
            }
        });

        const ctx = document.getElementById('expenseChart').getContext('2d');
        const canvas = document.getElementById('expenseChart');

        // FIX: Robust check for ANY existing chart on this canvas (Chart.js v3+)
        // This handles race conditions better than just checking the variable
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        // Double check our manual variable just in case
        if (window.myDashboardChart && window.myDashboardChart !== existingChart) {
            try { window.myDashboardChart.destroy(); } catch (e) { }
        }

        window.myDashboardChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                datasets: [{
                    label: 'Gasto Mensual',
                    data: monthlyData,
                    borderColor: '#3b82f6', // Blue 500
                    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light Blue Fill
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        grid: { color: 'rgba(0,0,0,0.05)' }, // Dark grid for light theme
                        ticks: { color: '#64748b' } // Slate 500
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' }
                    }
                }
            }
        });

        // 5. WhatsApp Button Logic
        document.getElementById('btn-whatsapp-report').addEventListener('click', () => {
            const dateStr = window.Utils.formatDate(now);
            const msg = `📊 *Reporte El Maravilloso*\n📅 ${dateStr}\n\n💰 Gasto Mes: ${window.Utils.formatCurrency(totalSpent)}\n⏱ Horas Mes: ${totalHours.toFixed(1)}h\n👥 Personal: ${employees.length}\n\n_Generado automáticamente_`;

            const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        });

        // 6. Export to Excel Logic
        document.getElementById('btn-export-excel').addEventListener('click', async () => {
            const btn = document.getElementById('btn-export-excel');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Preparando...';
            btn.disabled = true;

            try {
                // Fetch All Data
                const [emps, lgs, prods] = await Promise.all([
                    window.db.employees.toArray(),
                    window.db.workLogs.toArray(),
                    window.db.products.toArray()
                ]);

                // Create Workbook
                const wb = XLSX.utils.book_new();

                // 1. Sheet: Employees
                const wsEmps = XLSX.utils.json_to_sheet(emps.map(e => ({
                    ID: e.id,
                    Nombre: e.name,
                    Rol: e.role,
                    Modo_Pago: e.paymentMode,
                    Salario_Base: e.baseSalary || 0,
                    Pago_Hora: e.hourlyRate,
                    Pago_Dia: e.dailyRate,
                    Inicio: e.startDate
                })));
                XLSX.utils.book_append_sheet(wb, wsEmps, "Personal");

                // 2. Sheet: Work Logs
                const wsLogs = XLSX.utils.json_to_sheet(lgs.map(l => {
                    const e = emps.find(emp => emp.id === l.employeeId);
                    return {
                        ID: l.id,
                        Empleado: e ? e.name : 'Unknown',
                        Fecha: l.date,
                        Entrada: l.startTime,
                        Salida: l.endTime,
                        Horas: l.totalHours,
                        Pago: l.payAmount,
                        Tipo: l.status
                    };
                }));
                XLSX.utils.book_append_sheet(wb, wsLogs, "Asistencia");

                // 3. Sheet: Products
                const wsProds = XLSX.utils.json_to_sheet(prods.map(p => ({
                    ID: p.id,
                    Nombre: p.name,
                    Costo_Unit: p.costUnit,
                    Precio_Venta: p.salePrice,
                    Vencimiento: p.expiryDate || 'N/A',
                    Stock: p.stock || 0
                })));
                XLSX.utils.book_append_sheet(wb, wsProds, "Inventario");

                // Generate and Download
                const fileName = `Reporte_El_Maravilloso_${now.toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);

            } catch (err) {
                console.error("Export error", err);
                alert("Error al exportar: " + err.message);
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        });

    } catch (e) {
        console.error("Dashboard error", e);
        container.innerHTML += `<p style="color:red">Error cargando datos: ${e.message}</p>`;
    }
};
