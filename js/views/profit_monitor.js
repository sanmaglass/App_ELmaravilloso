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
            <button class="btn btn-secondary" id="profit-resync-btn">
                <i class="ph ph-arrows-clockwise"></i> Sincronizar Datos
            </button>
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
                    <tr><td colspan="6" style="padding: 20px; text-align: center;"><div class="spinner"></div> Analizando base de datos...</td></tr>
                </tbody>
            </table>
        </div>
        <div id="profit-empty-hint" style="display:none; margin-top:20px; padding:20px; background:rgba(59,130,246,0.05); border-radius:12px; border:1px dashed #3b82f6; text-align:center;">
             <p style="color:var(--text-muted); font-size:0.9rem;">
                <i class="ph ph-info" style="color:#3b82f6;"></i> No se encontraron productos en el catálogo manual. 
                Se están mostrando datos extraídos de tus ventas recientes de Eleventa.
             </p>
        </div>
    `;

    const renderProfits = async () => {
        const tbody = document.getElementById('profit-list-body');
        const emptyHint = document.getElementById('profit-empty-hint');
        if (!tbody) return;

        const search = document.getElementById('profit-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('profit-filter-status')?.value || 'all';

        try {
            // Priority 1: Manual Products Table
            const products = await window.db.products.toArray();
            let activeProducts = products.filter(p => !p.deleted);
            let isUsingSalesData = false;

            // Priority 2: Fallback to Sales Data if Products table is empty
            if (activeProducts.length === 0) {
                const sales = await window.db.eleventa_sales.toArray();
                const productMap = new Map();
                
                sales.forEach(sale => {
                    if (sale.items && Array.isArray(sale.items)) {
                        sale.items.forEach(item => {
                            if (!item.name) return;
                            const existing = productMap.get(item.name);
                            // We use the most recent sale price/profit as proxy for catalog
                            if (!existing) {
                                productMap.set(item.name, {
                                    name: item.name,
                                    category: 'Ventas Eleventa',
                                    costUnit: (parseFloat(item.price) || 0) - (parseFloat(item.profit) || 0),
                                    salePrice: parseFloat(item.price) || 0,
                                    margin: item.profit && item.price ? (item.profit / item.price) * 100 : 0
                                });
                            }
                        });
                    }
                });
                activeProducts = Array.from(productMap.values());
                isUsingSalesData = activeProducts.length > 0;
            }

            if (emptyHint) emptyHint.style.display = isUsingSalesData ? 'block' : 'none';

            let analyzedCount = 0;
            let totalMarginSum = 0;
            let dangerCount = 0;
            
            // Generate parsed list with field fallbacks
            const profitList = activeProducts.map(p => {
                // Support multiple property names
                const price = parseFloat(p.salePrice || p.precio || p.price || 0);
                const cost = parseFloat(p.costUnit || p.costo || p.buyPrice || 0);
                
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
            const elTotal = document.getElementById('profit-total-products');
            const elAvg = document.getElementById('profit-avg-margin');
            const elDanger = document.getElementById('profit-danger-count');
            
            if (elTotal) elTotal.textContent = analyzedCount;
            if (elAvg) elAvg.textContent = analyzedCount > 0 ? (totalMarginSum / analyzedCount).toFixed(1) + '%' : '0%';
            if (elDanger) elDanger.textContent = dangerCount;

            // Apply filters
            let filteredList = profitList.filter(p => {
                const matchSearch = p.name?.toLowerCase().includes(search) || p.category?.toLowerCase().includes(search);
                let matchStatus = true;
                
                if (statusFilter === 'danger') matchStatus = p.marginPct <= 5;
                if (statusFilter === 'acceptable') matchStatus = p.marginPct > 5 && p.marginPct <= 15;
                if (statusFilter === 'excellent') matchStatus = p.marginPct > 15;
                
                return matchSearch && matchStatus;
            });

            // Sort: lowest margin first
            filteredList.sort((a, b) => a.marginPct - b.marginPct);

            if (filteredList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: var(--text-muted);">
                    <i class="ph ph-warning-circle" style="font-size:2rem; display:block; margin:0 auto 10px; opacity:0.5;"></i>
                    No se encontraron productos en la base de datos.<br>
                    <small>Asegúrate de que tus productos estén sincronizados.</small>
                </td></tr>`;
                return;
            }

            const formatCurrency = window.Utils.formatCurrency;

            tbody.innerHTML = filteredList.map(p => {
                let badgeClass = '';
                let color = '';
                
                if (p.marginPct <= 5) {
                    badgeClass = 'status-overdue'; color = '#ef4444';
                } else if (p.marginPct <= 15) {
                    badgeClass = 'status-pending'; color = '#f59e0b';
                } else {
                    badgeClass = 'status-paid'; color = '#10b981';
                }

                const rowStyle = p.profit < 0 ? 'background: rgba(239, 68, 68, 0.05);' : '';

                return `
                    <tr style="border-bottom: 1px solid var(--border); ${rowStyle}">
                        <td style="padding: 12px 16px; max-width:250px;">
                            <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">
                                ${p.name || 'Sin nombre'}
                            </div>
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
                            <span class="status-badge ${badgeClass}" style="border: 1px solid ${color}40; color: ${color}; min-width:65px; justify-content:center;">
                                ${p.marginPct.toFixed(1)}%
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
    document.getElementById('profit-search')?.addEventListener('input', renderProfits);
    document.getElementById('profit-filter-status')?.addEventListener('change', renderProfits);
    document.getElementById('profit-resync-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('profit-resync-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-arrows-clockwise ph-spin"></i> Sincronizando...';
        await window.Sync.syncAll();
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Sincronizar Datos';
        renderProfits();
    });

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
