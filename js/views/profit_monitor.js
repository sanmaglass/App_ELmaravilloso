// Profit Monitor View (Monitoreo de Márgenes)
window.Views = window.Views || {};

window.Views.profit_monitor = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-chart-line-up" style="color:var(--primary);"></i> Control de Márgenes
                </h1>
                <p style="color:var(--text-muted);">Monitoreo de rentabilidad por producto en el inventario</p>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters-bar">
            <div style="position:relative; flex: 1 1 200px;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="profit-search" class="form-input" placeholder="Buscar producto..." style="padding-left:36px; width:100%;">
            </div>
            <select id="profit-filter-status" class="form-input" style="flex: 0 1 200px;">
                <option value="all">Todos los Márgenes</option>
                <option value="danger">En Riesgo (<= 5%)</option>
                <option value="acceptable">Aceptable (6% - 15%)</option>
                <option value="excellent">Excelente (> 15%)</option>
            </select>
        </div>

        <!-- Summary Dashboard -->
        <div class="grid-cols-auto gap-4 mb-6">
            <div class="premium-card" style="padding:14px; border-left:4px solid #3b82f6;">
                <div style="font-size:0.85rem; color:var(--text-muted);">Productos Analizados</div>
                <div style="font-size:1.6rem; font-weight:800; color:#3b82f6;" id="profit-total-products">0</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #10b981;">
                <div style="font-size:0.85rem; color:var(--text-muted);">Margen Promedio</div>
                <div style="font-size:1.6rem; font-weight:800; color:#10b981;" id="profit-avg-margin">0%</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #ef4444;">
                <div style="font-size:0.85rem; color:var(--text-muted);">Alertas (< 5%)</div>
                <div style="font-size:1.6rem; font-weight:800; color:#ef4444;" id="profit-danger-count">0</div>
            </div>
        </div>

        <!-- Profit List -->
        <div class="table-container">
            <table style="width:100%; border-collapse: collapse; min-width: 600px;">
                <thead>
                    <tr style="background: rgba(0,0,0,0.02); text-align: left; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">
                        <th style="padding: 12px 16px; border-bottom: 2px solid var(--border);">Producto</th>
                        <th style="padding: 12px 16px; border-bottom: 2px solid var(--border);">Categoría</th>
                        <th style="padding: 12px 16px; border-bottom: 2px solid var(--border);">Costo Unit.</th>
                        <th style="padding: 12px 16px; border-bottom: 2px solid var(--border);">Precio Venta</th>
                        <th style="padding: 12px 16px; border-bottom: 2px solid var(--border);">Ganancia</th>
                        <th style="padding: 12px 16px; border-bottom: 2px solid var(--border);">Margen %</th>
                    </tr>
                </thead>
                <tbody id="profit-list-body">
                    <tr><td colspan="6" style="padding: 20px; text-align: center;"><div class="spinner"></div> Cargando...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    const renderProfits = async () => {
        const tbody = document.getElementById('profit-list-body');
        if (!tbody) return;

        const search = document.getElementById('profit-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('profit-filter-status')?.value || 'all';

        try {
            const products = await window.db.products.toArray();
            const activeProducts = products.filter(p => !p.deleted);

            let analyzedCount = 0;
            let totalMarginSum = 0;
            let dangerCount = 0;
            
            // Generate parsed list
            const profitList = activeProducts.map(p => {
                const cost = parseFloat(p.costUnit) || 0;
                const price = parseFloat(p.salePrice) || 0;
                const profit = price - cost;
                const marginPct = price > 0 ? (profit / price) * 100 : 0;
                
                return {
                    ...p,
                    cost,
                    price,
                    profit,
                    marginPct
                };
            });

            // Calculate KPIs over the COMPLETE active set
            profitList.forEach(p => {
                analyzedCount++;
                totalMarginSum += p.marginPct;
                if (p.marginPct <= 5) dangerCount++;
            });

            // Update KPI cards
            document.getElementById('profit-total-products').textContent = analyzedCount;
            document.getElementById('profit-avg-margin').textContent = analyzedCount > 0 ? (totalMarginSum / analyzedCount).toFixed(1) + '%' : '0%';
            document.getElementById('profit-danger-count').textContent = dangerCount;

            // Apply filters
            let filteredList = profitList.filter(p => {
                const matchSearch = p.name?.toLowerCase().includes(search) || p.category?.toLowerCase().includes(search);
                let matchStatus = true;
                
                if (statusFilter === 'danger') matchStatus = p.marginPct <= 5;
                if (statusFilter === 'acceptable') matchStatus = p.marginPct > 5 && p.marginPct <= 15;
                if (statusFilter === 'excellent') matchStatus = p.marginPct > 15;
                
                return matchSearch && matchStatus;
            });

            // Sort: default to showing lowest margin first (to spot errors)
            filteredList.sort((a, b) => a.marginPct - b.marginPct);

            if (filteredList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: var(--text-muted);">No se encontraron productos que coincidan.</td></tr>`;
                return;
            }

            const formatCurrency = window.Utils.formatCurrency;

            tbody.innerHTML = filteredList.map(p => {
                let badgeClass = '';
                let icon = '';
                let color = '';
                
                if (p.marginPct <= 5) {
                    badgeClass = 'status-overdue'; 
                    icon = '<i class="ph ph-warning-octagon"></i>';
                    color = '#ef4444';
                } else if (p.marginPct <= 15) {
                    badgeClass = 'status-pending'; // default orange/acceptable in style.css or a neutral color
                    icon = '<i class="ph ph-check-circle"></i>';
                    color = '#f59e0b';
                } else {
                    // Excellent margin > 15
                    badgeClass = 'status-paid';
                    icon = '<i class="ph ph-star"></i>';
                    color = '#10b981';
                }

                // If profit is negative, extra warning
                const rowStyle = p.profit < 0 ? 'background: rgba(239, 68, 68, 0.05);' : '';

                return `
                    <tr style="border-bottom: 1px solid var(--border); ${rowStyle}">
                        <td style="padding: 12px 16px;">
                            <div style="font-weight: 600; color: var(--text-primary);">${p.name || 'Sin nombre'}</div>
                            ${p.profit < 0 ? '<div style="font-size:0.75rem; color:#ef4444; font-weight:700;">Margen en pérdida</div>' : ''}
                        </td>
                        <td style="padding: 12px 16px; color: var(--text-muted); font-size: 0.9rem;">
                            ${p.category || '—'}
                        </td>
                        <td style="padding: 12px 16px; font-weight: 500;">
                            ${formatCurrency(p.cost)}
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: var(--text-primary);">
                            ${formatCurrency(p.price)}
                        </td>
                        <td style="padding: 12px 16px; font-weight: 600; color: ${p.profit < 0 ? '#ef4444' : 'var(--text-primary)'};">
                            ${formatCurrency(p.profit)}
                        </td>
                        <td style="padding: 12px 16px;">
                            <span class="status-badge ${badgeClass}" style="border: 1px solid ${color}40; color: ${color};">
                                ${icon} ${p.marginPct.toFixed(1)}%
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error("Error rendering profit monitor:", e);
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; color: red;">Error: ${e.message}</td></tr>`;
        }
    };

    renderProfits();

    // Event Listeners
    document.getElementById('profit-search').addEventListener('input', renderProfits);
    document.getElementById('profit-filter-status').addEventListener('change', renderProfits);

    // Sync handler
    const syncHandler = () => {
        if (document.getElementById('profit-list-body')) {
            renderProfits();
        } else {
            window.removeEventListener('sync-data-updated', syncHandler);
        }
    };
    window.addEventListener('sync-data-updated', syncHandler);
};
