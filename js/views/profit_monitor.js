// Profit Monitor View
window.Views = window.Views || {};

window.Views.profit_monitor = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h1 style="margin-bottom:4px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-chart-line-up" style="color:var(--primary);"></i> Control de Márgenes
                </h1>
                <p style="color:var(--text-muted);">Rentabilidad por producto · datos Eleventa</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" id="profit-export-btn">
                    <i class="ph ph-file-xls"></i> Exportar
                </button>
                <button class="btn btn-secondary" id="profit-resync-btn">
                    <i class="ph ph-arrows-clockwise"></i> Sincronizar
                </button>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters-bar" style="margin-bottom:16px;">
            <div style="position:relative; flex: 1 1 200px;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="profit-search" class="form-input" placeholder="Buscar producto..." style="padding-left:36px; width:100%;">
            </div>
            <select id="profit-filter-status" class="form-input" style="flex: 0 1 180px;">
                <option value="all">Todos los Márgenes</option>
                <option value="danger">En Riesgo (≤ 5%)</option>
                <option value="acceptable">Aceptable (6%–15%)</option>
                <option value="excellent">Excelente (> 15%)</option>
            </select>
            <select id="profit-filter-time" class="form-input" style="flex: 0 1 200px;">
                <option value="month" selected>Últimos 30 días</option>
                <option value="15days">Últimos 15 días</option>
                <option value="week">Últimos 7 días</option>
                <option value="stagnant">Inactivos > 30 días</option>
                <option value="all">Todo el Historial</option>
            </select>
        </div>

        <!-- KPI Cards -->
        <div class="grid-cols-auto gap-4 mb-6" style="margin-bottom:16px;">
            <div class="premium-card" style="padding:14px; border-left:4px solid #3b82f6;">
                <div style="font-size:0.8rem; color:var(--text-muted);" id="profit-kpi-label">Productos Activos</div>
                <div style="font-size:1.6rem; font-weight:800; color:#3b82f6;" id="profit-total-products">0</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #10b981;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Margen Promedio</div>
                <div style="font-size:1.6rem; font-weight:800; color:#10b981;" id="profit-avg-margin">0%</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #8b5cf6;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Ingresos del Período</div>
                <div style="font-size:1.4rem; font-weight:800; color:#8b5cf6;" id="profit-total-revenue">$0</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #f59e0b;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Ganancia Bruta</div>
                <div style="font-size:1.4rem; font-weight:800; color:#f59e0b;" id="profit-total-profit">$0</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #ef4444;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Bajo Margen (< 5%)</div>
                <div style="font-size:1.6rem; font-weight:800; color:#ef4444;" id="profit-danger-count">0</div>
            </div>
        </div>

        <!-- Destacados -->
        <div id="profit-destacados" style="margin-bottom:16px;"></div>

        <!-- Chart -->
        <div class="premium-card" style="padding:16px; margin-bottom:16px; display:none;" id="profit-chart-wrap">
            <div style="font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">
                Peores Márgenes — Top 10
            </div>
            <canvas id="profit-chart" style="max-height:220px;"></canvas>
        </div>

        <!-- Table -->
        <div class="table-container shadow-premium" style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; min-width:700px;">
                <thead>
                    <tr style="background:rgba(0,0,0,0.02); text-align:left; font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border);">Producto</th>
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border); cursor:pointer; user-select:none;" data-sort="price">Precio <span id="sort-price"></span></th>
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border);">Costo Est.</th>
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border); cursor:pointer; user-select:none;" data-sort="revenue">Ingresos <span id="sort-revenue"></span></th>
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border); cursor:pointer; user-select:none;" data-sort="profit">Ganancia <span id="sort-profit"></span></th>
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border); cursor:pointer; user-select:none;" data-sort="qty">Uds. <span id="sort-qty"></span></th>
                        <th style="padding:12px 16px; border-bottom:2px solid var(--border); cursor:pointer; user-select:none;" data-sort="margin">Margen % <span id="sort-margin">▲</span></th>
                    </tr>
                </thead>
                <tbody id="profit-list-body">
                    <tr><td colspan="7" style="padding:40px; text-align:center;"><div class="spinner"></div></td></tr>
                </tbody>
            </table>
        </div>
    `;

    const fmt = window.Utils.formatCurrency;
    let _chartInstance = null;
    let _sortKey = 'margin';
    let _sortAsc = true;
    let _catalog = [];
    let _rendering = false;
    let _syncDebounce = null;

    const renderTable = () => {
        const tbody = document.getElementById('profit-list-body');
        if (!tbody) return;

        const search = document.getElementById('profit-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('profit-filter-status')?.value || 'all';

        let list = _catalog.filter(p => {
            if (!p.name?.toLowerCase().includes(search)) return false;
            if (statusFilter === 'danger') return p.marginPct <= 5;
            if (statusFilter === 'acceptable') return p.marginPct > 5 && p.marginPct <= 15;
            if (statusFilter === 'excellent') return p.marginPct > 15;
            return true;
        });

        // Sort
        list.sort((a, b) => {
            const v = _sortAsc ? 1 : -1;
            return (a[_sortKey] - b[_sortKey]) * v;
        });

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:40px; text-align:center; color:var(--text-muted);">Sin resultados.</td></tr>`;
            return;
        }

        // Max revenue for bar scaling
        const maxRevenue = Math.max(...list.map(p => p.revenue), 1);

        tbody.innerHTML = list.map(p => {
            let color, icon;
            if (p.marginPct <= 5)       { color = '#ef4444'; icon = '<i class="ph ph-warning-octagon"></i>'; }
            else if (p.marginPct <= 15) { color = '#f59e0b'; icon = '<i class="ph ph-warning"></i>'; }
            else                        { color = '#10b981'; icon = '<i class="ph ph-check-circle"></i>'; }

            const barPct = Math.min(p.marginPct * 2, 100); // 50% margen = barra llena
            const revPct = Math.round((p.revenue / maxRevenue) * 100);

            return `
                <tr style="border-bottom:1px solid var(--border);" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:12px 16px; max-width:200px;">
                        <div style="font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Últ: ${p.latestDate.toLocaleDateString()}</div>
                    </td>
                    <td style="padding:12px 16px; font-weight:600;">${fmt(p.price)}</td>
                    <td style="padding:12px 16px; color:var(--text-muted);">${fmt(p.cost)}</td>
                    <td style="padding:12px 16px;">
                        <div style="font-weight:600; color:#8b5cf6; margin-bottom:3px;">${fmt(p.revenue)}</div>
                        <div style="height:3px; background:rgba(139,92,246,0.15); border-radius:2px; width:80px;">
                            <div style="height:3px; background:#8b5cf6; border-radius:2px; width:${revPct}%;"></div>
                        </div>
                    </td>
                    <td style="padding:12px 16px; font-weight:600; color:${p.profitTotal < 0 ? '#ef4444' : '#f59e0b'};">${fmt(p.profitTotal)}</td>
                    <td style="padding:12px 16px; color:var(--text-muted); font-size:0.85rem; white-space:nowrap;">${p.qty.toFixed(1)} uds</td>
                    <td style="padding:12px 16px; min-width:110px;">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                            <span style="font-weight:700; color:${color}; font-size:0.9rem;">${icon} ${p.marginPct.toFixed(1)}%</span>
                        </div>
                        <div style="height:4px; background:rgba(0,0,0,0.08); border-radius:2px; width:80px;">
                            <div style="height:4px; background:${color}; border-radius:2px; width:${barPct}%; transition:width 0.4s;"></div>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    };

    const updateSortIcons = () => {
        ['price','revenue','profit','qty','margin'].forEach(k => {
            const el = document.getElementById(`sort-${k}`);
            if (el) el.textContent = k === _sortKey ? (_sortAsc ? '▲' : '▼') : '';
        });
    };

    const renderChart = () => {
        const wrap = document.getElementById('profit-chart-wrap');
        const canvas = document.getElementById('profit-chart');
        if (!wrap || !canvas || _catalog.length === 0) return;

        // Top 10 worst margin
        const worst = [..._catalog].sort((a, b) => a.marginPct - b.marginPct).slice(0, 10);
        wrap.style.display = 'block';

        if (_chartInstance) _chartInstance.destroy();
        _chartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: worst.map(p => p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name),
                datasets: [{
                    label: 'Margen %',
                    data: worst.map(p => parseFloat(p.marginPct.toFixed(1))),
                    backgroundColor: worst.map(p => p.marginPct <= 5 ? '#ef444490' : p.marginPct <= 15 ? '#f59e0b90' : '#10b98190'),
                    borderRadius: 6,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { callback: v => v + '%' } }
                }
            }
        });
    };

    const renderProfits = async (showSpinner = true) => {
        if (_rendering) return; // anti-race guard
        _rendering = true;
        const tbody = document.getElementById('profit-list-body');
        if (!tbody) { _rendering = false; return; }
        if (showSpinner) tbody.innerHTML = `<tr><td colspan="7" style="padding:40px; text-align:center;"><div class="spinner"></div></td></tr>`;

        const timeFilter = document.getElementById('profit-filter-time')?.value || 'month';

        try {
            const now = new Date();
            const cutoffs = {
                week:    new Date(now.getTime() - 7  * 86400000),
                '15days':new Date(now.getTime() - 15 * 86400000),
                month:   new Date(now.getTime() - 30 * 86400000),
            };
            const cutoff = cutoffs[timeFilter] || null;
            const isStagnant = timeFilter === 'stagnant';

            const allSales = await window.db.eleventa_sales.toArray();
            const sales = allSales.filter(s => !s.deleted);

            // Map: latest price/cost per product (from most recent sale)
            const latestInfo = new Map(); // name → { price, cost, profit, latestDate }
            const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
            sorted.forEach(s => {
                if (!s.items) return;
                s.items.forEach(item => {
                    if (!item.name || latestInfo.has(item.name)) return;
                    const price = parseFloat(item.price) || 0;
                    const profit = parseFloat(item.profit) || 0;
                    latestInfo.set(item.name, { price, cost: price - profit, profit, latestDate: new Date(s.date) });
                });
            });

            // Accumulate qty, revenue, profit only within the selected period
            const periodTotals = new Map(); // name → { qty, revenue, profitTotal }

            sales.forEach(s => {
                if (!s.items) return;
                const saleDate = new Date(s.date);
                // For stagnant: skip sales from last 30 days (they'd be "active")
                if (isStagnant && saleDate >= cutoffs.month) return;
                // For period filters: skip sales outside window
                if (cutoff && !isStagnant && saleDate < cutoff) return;

                s.items.forEach(item => {
                    if (!item.name) return;
                    const qty = parseFloat(item.qty) || 0;
                    const price = parseFloat(item.price) || 0;
                    const profit = parseFloat(item.profit) || 0;
                    const existing = periodTotals.get(item.name);
                    if (existing) {
                        existing.qty += qty;
                        existing.revenue += price * qty;
                        existing.profitTotal += profit * qty;
                    } else {
                        periodTotals.set(item.name, { qty, revenue: price * qty, profitTotal: profit * qty });
                    }
                });
            });

            // Build catalog: only products that appear in the period
            // For stagnant: products in latestInfo but NOT in periodTotals (no sales in last 30d)
            _catalog = [];

            if (isStagnant) {
                latestInfo.forEach((info, name) => {
                    if (periodTotals.has(name)) return; // has recent sales → not stagnant
                    _catalog.push({
                        name,
                        ...info,
                        qty: 0, revenue: 0, profitTotal: 0,
                        marginPct: info.price > 0 ? (info.profit / info.price) * 100 : 0
                    });
                });
            } else {
                periodTotals.forEach((totals, name) => {
                    const info = latestInfo.get(name) || { price: 0, cost: 0, profit: 0, latestDate: new Date() };
                    _catalog.push({
                        name,
                        price: info.price,
                        cost: info.cost,
                        profit: info.profit,
                        latestDate: info.latestDate,
                        qty: totals.qty,
                        revenue: totals.revenue,
                        profitTotal: totals.profitTotal,
                        marginPct: info.price > 0 ? (info.profit / info.price) * 100 : 0
                    });
                });
            }

            // KPIs
            const totalRevenue = _catalog.reduce((s, p) => s + p.revenue, 0);
            const totalProfit  = _catalog.reduce((s, p) => s + p.profitTotal, 0);
            const avgMargin    = _catalog.length > 0 ? _catalog.reduce((s, p) => s + p.marginPct, 0) / _catalog.length : 0;
            const dangerCount  = _catalog.filter(p => p.marginPct <= 5).length;

            const kpiLabel = document.getElementById('profit-kpi-label');
            if (kpiLabel) kpiLabel.textContent = isStagnant ? 'Productos Inactivos' : timeFilter === 'all' ? 'Catálogo Histórico' : 'Productos Activos';

            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            const setHtml = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
            setText('profit-total-products', _catalog.length);
            setText('profit-avg-margin', avgMargin.toFixed(1) + '%');
            setHtml('profit-total-revenue', fmt(totalRevenue));
            setHtml('profit-total-profit', fmt(totalProfit));
            setText('profit-danger-count', dangerCount);

            // Destacados
            const byRevenue = [..._catalog].sort((a,b) => b.revenue - a.revenue)[0];
            const byMargin  = [..._catalog].filter(p => p.qty > 0).sort((a,b) => b.marginPct - a.marginPct)[0];
            const destEl = document.getElementById('profit-destacados');
            if (destEl && byRevenue && byMargin) {
                destEl.innerHTML = `
                    <div style="display:flex; gap:12px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:180px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2); border-radius:10px; padding:10px 14px;">
                            <div style="font-size:0.72rem; color:#8b5cf6; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                                <i class="ph ph-crown-simple"></i> Mayor Ingreso
                            </div>
                            <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${byRevenue.name}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${fmt(byRevenue.revenue)} · ${byRevenue.marginPct.toFixed(1)}% margen</div>
                        </div>
                        <div style="flex:1; min-width:180px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:10px; padding:10px 14px;">
                            <div style="font-size:0.72rem; color:#10b981; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                                <i class="ph ph-trend-up"></i> Mejor Margen
                            </div>
                            <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${byMargin.name}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${byMargin.marginPct.toFixed(1)}% · ${fmt(byMargin.revenue)} ingreso</div>
                        </div>
                    </div>`;
            }

            renderChart();
            renderTable();

        } catch (e) {
            console.error('Profit Monitor Error:', e);
            tbody.innerHTML = `<tr><td colspan="7" style="padding:40px; color:red;">Error: ${e.message}</td></tr>`;
        } finally {
            _rendering = false;
        }
    };

    // Sort click handlers
    ['price','revenue','profit','qty','margin'].forEach(key => {
        document.querySelectorAll(`[data-sort="${key}"]`).forEach(th => {
            th.addEventListener('click', () => {
                if (_sortKey === key) _sortAsc = !_sortAsc;
                else { _sortKey = key; _sortAsc = key !== 'margin'; }
                updateSortIcons();
                renderTable();
            });
        });
    });

    // Filter/search listeners
    document.getElementById('profit-search')?.addEventListener('input', renderTable);
    document.getElementById('profit-filter-status')?.addEventListener('change', renderTable);
    document.getElementById('profit-filter-time')?.addEventListener('change', renderProfits);

    // Resync
    document.getElementById('profit-resync-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('profit-resync-btn');
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-arrows-clockwise ph-spin"></i> Sincronizando...';
        await window.Sync.syncAll();
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Sincronizar';
        renderProfits();
    });

    // Export to Excel
    document.getElementById('profit-export-btn')?.addEventListener('click', () => {
        if (!_catalog.length) return;
        const rows = [..._catalog]
            .sort((a, b) => a.marginPct - b.marginPct)
            .map(p => ({
                Producto: p.name,
                'Últ. Precio': p.price,
                'Costo Est.': p.cost,
                'Ingresos Período': parseFloat(p.revenue.toFixed(0)),
                'Ganancia Período': parseFloat(p.profitTotal.toFixed(0)),
                'Unidades Vendidas': parseFloat(p.qty.toFixed(1)),
                'Margen %': parseFloat(p.marginPct.toFixed(2)),
                'Últ. Venta': p.latestDate.toLocaleDateString()
            }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Márgenes');
        XLSX.writeFile(wb, `margenes_${new Date().toISOString().slice(0,10)}.xlsx`);
    });

    // Real-time listener — debounced 2s, no spinner on background refresh
    if (window._profitSyncHandler) window.removeEventListener('sync-data-updated', window._profitSyncHandler);
    window._profitSyncHandler = () => {
        if (!document.getElementById('profit-list-body')) {
            window.removeEventListener('sync-data-updated', window._profitSyncHandler);
            return;
        }
        clearTimeout(_syncDebounce);
        _syncDebounce = setTimeout(() => renderProfits(false), 2000);
    };
    window.addEventListener('sync-data-updated', window._profitSyncHandler);

    renderProfits();
};
