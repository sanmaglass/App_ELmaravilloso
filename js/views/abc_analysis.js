// ABC Analysis View — Análisis de Pareto 80/20 por producto
window.Views = window.Views || {};

window.Views.abc_analysis = async (container) => {
    container.innerHTML = `
        <style>
            .abc-cards-row {
                display: flex;
                gap: 16px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            .abc-summary-card {
                flex: 1 1 180px;
                background: var(--card-bg);
                border-radius: 12px;
                padding: 16px 20px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .abc-summary-card .abc-class-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 0.85rem;
                font-weight: 700;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .abc-summary-card .abc-count {
                font-size: 2rem;
                font-weight: 800;
                font-family: 'JetBrains Mono', 'Fira Mono', monospace;
                line-height: 1;
            }
            .abc-summary-card .abc-pct {
                font-size: 0.85rem;
                color: var(--text-muted);
                font-family: 'JetBrains Mono', 'Fira Mono', monospace;
            }
            .abc-pareto-bar {
                height: 28px;
                border-radius: 10px;
                overflow: hidden;
                display: flex;
                margin-bottom: 8px;
                background: var(--card-bg);
            }
            .abc-pareto-bar .seg {
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 700;
                color: #fff;
                transition: flex 0.4s ease;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .abc-table-wrap {
                background: var(--card-bg);
                border-radius: 12px;
                overflow: hidden;
            }
            .abc-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.875rem;
            }
            .abc-table thead th {
                padding: 12px 14px;
                text-align: left;
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--text-muted);
                border-bottom: 1px solid rgba(128,128,128,0.15);
                white-space: nowrap;
            }
            .abc-table thead th.num { text-align: right; }
            .abc-table tbody tr {
                border-bottom: 1px solid rgba(128,128,128,0.08);
                transition: background 0.15s;
            }
            .abc-table tbody tr:hover { background: rgba(128,128,128,0.05); }
            .abc-table tbody tr:last-child { border-bottom: none; }
            .abc-table td {
                padding: 11px 14px;
                color: var(--text);
                vertical-align: middle;
            }
            .abc-table td.num {
                text-align: right;
                font-family: 'JetBrains Mono', 'Fira Mono', monospace;
                font-size: 0.82rem;
            }
            .abc-badge {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .abc-badge-A { background: rgba(34,197,94,0.15);  color: #16a34a; }
            .abc-badge-B { background: rgba(245,158,11,0.15); color: #d97706; }
            .abc-badge-C { background: rgba(239,68,68,0.15);  color: #dc2626; }
            .abc-rank {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                font-size: 0.75rem;
                font-weight: 700;
                background: rgba(128,128,128,0.1);
                color: var(--text-muted);
                font-family: 'JetBrains Mono', 'Fira Mono', monospace;
            }
            .abc-rank-top { background: rgba(34,197,94,0.15); color: #16a34a; }
            .abc-empty {
                text-align: center;
                padding: 48px 24px;
                color: var(--text-muted);
            }
            .abc-empty i { font-size: 3rem; display: block; margin-bottom: 12px; opacity: 0.4; }
            @media (max-width: 600px) {
                .abc-cards-row { flex-direction: column; }
                .abc-table thead th:nth-child(4),
                .abc-table tbody td:nth-child(4) { display: none; }
            }
        </style>

        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h1 style="margin-bottom:4px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-chart-pie-slice" style="color:var(--primary);"></i> Análisis ABC
                </h1>
                <p style="color:var(--text-muted);">¿Qué productos generan tu ingreso?</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <select id="abc-period-select" class="form-input" style="flex: 0 0 auto; min-width:170px;">
                    <option value="30">Últimos 30 días</option>
                    <option value="60">Últimos 60 días</option>
                    <option value="90" selected>Últimos 90 días</option>
                </select>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="abc-cards-row" id="abc-summary-cards">
            <div class="abc-summary-card" style="border-left:4px solid #22c55e;">
                <div class="abc-class-badge" style="color:#22c55e;">
                    <i class="ph ph-crown"></i> Clase A
                </div>
                <div class="abc-count" style="color:#22c55e;" id="abc-count-a">—</div>
                <div class="abc-pct" id="abc-pct-a">productos · —% del ingreso</div>
            </div>
            <div class="abc-summary-card" style="border-left:4px solid #f59e0b;">
                <div class="abc-class-badge" style="color:#f59e0b;">
                    <i class="ph ph-star"></i> Clase B
                </div>
                <div class="abc-count" style="color:#f59e0b;" id="abc-count-b">—</div>
                <div class="abc-pct" id="abc-pct-b">productos · —% del ingreso</div>
            </div>
            <div class="abc-summary-card" style="border-left:4px solid #ef4444;">
                <div class="abc-class-badge" style="color:#ef4444;">
                    <i class="ph ph-package"></i> Clase C
                </div>
                <div class="abc-count" style="color:#ef4444;" id="abc-count-c">—</div>
                <div class="abc-pct" id="abc-pct-c">productos · —% del ingreso</div>
            </div>
        </div>

        <!-- Pareto Bar -->
        <div style="background:var(--card-bg); border-radius:12px; padding:16px 20px; margin-bottom:20px;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
                <i class="ph ph-chart-bar" style="margin-right:4px;"></i> Distribución del Ingreso Total
            </div>
            <div class="abc-pareto-bar" id="abc-pareto-bar">
                <div class="seg" id="abc-seg-a" style="background:#22c55e; flex:80;"> A</div>
                <div class="seg" id="abc-seg-b" style="background:#f59e0b; flex:15;"> B</div>
                <div class="seg" id="abc-seg-c" style="background:#ef4444; flex:5;"> C</div>
            </div>
            <div style="display:flex; gap:20px; font-size:0.78rem; color:var(--text-muted);">
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#22c55e;margin-right:4px;"></span>A — 80% del ingreso</span>
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f59e0b;margin-right:4px;"></span>B — 80–95%</span>
                <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#ef4444;margin-right:4px;"></span>C — 95–100%</span>
            </div>
        </div>

        <!-- Product Table -->
        <div class="abc-table-wrap">
            <div style="padding:14px 20px; border-bottom:1px solid rgba(128,128,128,0.12); display:flex; align-items:center; gap:8px;">
                <i class="ph ph-list-bullets" style="color:var(--primary);"></i>
                <span style="font-weight:700; font-size:0.95rem; color:var(--text);">Productos ordenados por ingreso</span>
            </div>
            <div id="abc-table-container">
                <div class="abc-empty">
                    <i class="ph ph-spinner" style="animation: spin 1s linear infinite;"></i>
                    Cargando datos...
                </div>
            </div>
        </div>

        <style>
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        </style>
    `;

    // --- Lógica de datos ---
    async function loadAndRender() {
        const days = parseInt(document.getElementById('abc-period-select').value, 10);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        // Leer ventas del período
        let sales = [];
        try {
            sales = await window.db.eleventa_sales.toArray();
        } catch (e) {
            console.error('[ABC] Error leyendo eleventa_sales:', e);
            showEmpty('No se pudo leer la base de datos.');
            return;
        }

        // Filtrar: no eliminadas y dentro del período
        sales = sales.filter(s => {
            if (s.deleted === 1) return false;
            const ts = s.date ? new Date(s.date).getTime() : 0;
            return ts >= cutoff;
        });

        if (!sales.length) {
            showEmpty('Sin ventas en el período seleccionado.');
            resetCards();
            return;
        }

        // Acumular por nombre de producto
        const map = new Map(); // name → { name, qty, revenue, profit }
        for (const sale of sales) {
            if (!Array.isArray(sale.items)) continue;
            for (const item of sale.items) {
                const name = (item.name || '(sin nombre)').trim();
                const qty = parseFloat(item.qty) || 0;
                const rev = (parseFloat(item.price) || 0) * qty;
                const prof = (parseFloat(item.profit) || 0) * qty;
                if (!map.has(name)) {
                    map.set(name, { name, qty: 0, revenue: 0, profit: 0 });
                }
                const acc = map.get(name);
                acc.qty += qty;
                acc.revenue += rev;
                acc.profit += prof;
            }
        }

        let products = Array.from(map.values());

        // Ordenar por revenue descendente
        products.sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
        if (totalRevenue <= 0) {
            showEmpty('Los productos del período no tienen ingreso registrado.');
            resetCards();
            return;
        }

        // Asignar clase ABC y % acumulado
        let accum = 0;
        for (const p of products) {
            accum += p.revenue;
            p.accumPct = totalRevenue > 0 ? (accum / totalRevenue) * 100 : 0;
            if (p.accumPct <= 80) {
                p.class = 'A';
            } else if (p.accumPct <= 95) {
                p.class = 'B';
            } else {
                p.class = 'C';
            }
            p.revenuePct = (p.revenue / totalRevenue) * 100;
        }

        // Stats por clase
        const classA = products.filter(p => p.class === 'A');
        const classB = products.filter(p => p.class === 'B');
        const classC = products.filter(p => p.class === 'C');

        const pctA = classA.reduce((s, p) => s + p.revenuePct, 0);
        const pctB = classB.reduce((s, p) => s + p.revenuePct, 0);
        const pctC = classC.reduce((s, p) => s + p.revenuePct, 0);

        // Actualizar tarjetas resumen
        document.getElementById('abc-count-a').textContent = classA.length;
        document.getElementById('abc-pct-a').textContent = `productos · ${pctA.toFixed(1)}% del ingreso`;
        document.getElementById('abc-count-b').textContent = classB.length;
        document.getElementById('abc-pct-b').textContent = `productos · ${pctB.toFixed(1)}% del ingreso`;
        document.getElementById('abc-count-c').textContent = classC.length;
        document.getElementById('abc-pct-c').textContent = `productos · ${pctC.toFixed(1)}% del ingreso`;

        // Actualizar barra Pareto
        const segA = document.getElementById('abc-seg-a');
        const segB = document.getElementById('abc-seg-b');
        const segC = document.getElementById('abc-seg-c');
        segA.style.flex = String(Math.max(pctA, 0.5));
        segB.style.flex = String(Math.max(pctB, 0.5));
        segC.style.flex = String(Math.max(pctC, 0.5));
        segA.textContent = pctA >= 8 ? ` A ${pctA.toFixed(0)}%` : '';
        segB.textContent = pctB >= 5 ? ` B ${pctB.toFixed(0)}%` : '';
        segC.textContent = pctC >= 5 ? ` C ${pctC.toFixed(0)}%` : '';

        // Renderizar tabla
        renderTable(products, totalRevenue);
    }

    function fmt(val) {
        if (window.Utils && typeof window.Utils.formatCurrency === 'function') {
            return window.Utils.formatCurrency(val);
        }
        return '$' + Math.round(val).toLocaleString('es-CL');
    }

    function renderTable(products, totalRevenue) {
        const container = document.getElementById('abc-table-container');
        if (!products.length) {
            showEmpty('Sin productos para mostrar.');
            return;
        }

        const rows = products.map((p, i) => {
            const rank = i + 1;
            const rankClass = rank <= 3 ? 'abc-rank abc-rank-top' : 'abc-rank';
            const badgeClass = `abc-badge abc-badge-${p.class}`;
            const profitSign = p.profit >= 0 ? '' : '−';
            return `
            <tr>
                <td><span class="${rankClass}">${rank}</span></td>
                <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escHtml(p.name)}">${escHtml(p.name)}</td>
                <td class="num">${Math.round(p.qty).toLocaleString('es-CL')}</td>
                <td class="num">${fmt(p.revenue)}</td>
                <td class="num">${profitSign}${fmt(Math.abs(p.profit))}</td>
                <td class="num">${p.accumPct.toFixed(1)}%</td>
                <td><span class="${badgeClass}">${p.class}</span></td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="overflow-x:auto;">
                <table class="abc-table">
                    <thead>
                        <tr>
                            <th style="width:44px;">#</th>
                            <th>Producto</th>
                            <th class="num">Cant.</th>
                            <th class="num">Ingreso</th>
                            <th class="num">Ganancia</th>
                            <th class="num">% Acum.</th>
                            <th>Clase</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <div style="padding:10px 20px; font-size:0.78rem; color:var(--text-muted); text-align:right; border-top:1px solid rgba(128,128,128,0.1);">
                ${products.length} productos · Ingreso total: <strong style="color:var(--text); font-family:monospace;">${fmt(totalRevenue)}</strong>
            </div>
        `;
    }

    function showEmpty(msg) {
        document.getElementById('abc-table-container').innerHTML = `
            <div class="abc-empty">
                <i class="ph ph-chart-pie-slice"></i>
                ${msg}
            </div>
        `;
    }

    function resetCards() {
        ['a', 'b', 'c'].forEach(cls => {
            document.getElementById(`abc-count-${cls}`).textContent = '—';
            document.getElementById(`abc-pct-${cls}`).textContent = 'productos · —% del ingreso';
        });
        const segA = document.getElementById('abc-seg-a');
        const segB = document.getElementById('abc-seg-b');
        const segC = document.getElementById('abc-seg-c');
        if (segA) { segA.style.flex = '80'; segA.textContent = ' A'; }
        if (segB) { segB.style.flex = '15'; segB.textContent = ' B'; }
        if (segC) { segC.style.flex = '5';  segC.textContent = ' C'; }
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Listener del selector de período
    document.getElementById('abc-period-select').addEventListener('change', loadAndRender);

    // Carga inicial
    await loadAndRender();
};
