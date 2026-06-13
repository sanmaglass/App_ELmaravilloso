// ==========================================
// DASHBOARD PRO — Unified View
// Includes: Dashboard + Reports merged
// ==========================================
window.Views = window.Views || {};

// ── Helpers terminal: sparkline Unicode + delta ▲▼ + formato compacto ──
function wmSpark(arr) {
    const b = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const n = (arr || []).map(v => +v || 0);
    if (!n.length) return '';
    const max = Math.max(...n), min = Math.min(...n), r = (max - min) || 1;
    return n.map(v => b[Math.max(0, Math.min(7, Math.floor((v - min) / r * 7.999)))]).join('');
}
function wmCompact(n) {
    n = +n || 0; const a = Math.abs(n);
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2).replace('.', ',') + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
}
function wmDelta(cur, prev) {
    cur = +cur || 0; prev = +prev || 0;
    if (!prev) return { arrow: '·', pct: 's/d', up: null };
    const d = (cur - prev) / Math.abs(prev) * 100, up = d >= 0;
    return { arrow: up ? '▲' : '▼', pct: (up ? '+' : '') + d.toFixed(1).replace('.', ',') + '%', up };
}

// ── Umbrales de inteligencia (ajustables) ──
const MARGEN_OBJETIVO = 0.25;
const MARGEN_CRITICO  = 0.10;
const DIAS_SIN_MOV    = 18;
const STOCK_MIN       = 5;

function computeHealthScore(ctx) {
    // ctx: { ventasMes, ventasPrev, utilidadNetaMonto, gastoTotal, products, invoices, eleventaSales, currentMonthStr }
    const { ventasMes, ventasPrev, utilidadNetaMonto, gastoTotal, products, invoices, eleventaSales, currentMonthStr } = ctx;
    let score = 0;
    const factors = [];

    // 1. Ventas 0-25 (delta mes vs mes anterior)
    const deltaVentas = ventasPrev > 0 ? (ventasMes - ventasPrev) / ventasPrev : 0;
    const ptsVentas = Math.round(Math.min(25, Math.max(0, 12.5 + deltaVentas * 62.5)));
    factors.push({ nombre: 'Ventas', estado: ptsVentas >= 17 ? 'ok' : 'warn', pts: ptsVentas, max: 25 });
    score += ptsVentas;

    // 2. Rentabilidad 0-25 (utilidad/ventas %)
    const margenPct = ventasMes > 0 ? utilidadNetaMonto / ventasMes : 0;
    const ptsRent = Math.round(Math.min(25, Math.max(0, margenPct * 125)));
    factors.push({ nombre: 'Rentabilidad', estado: ptsRent >= 17 ? 'ok' : 'warn', pts: ptsRent, max: 25 });
    score += ptsRent;

    // 3. Caja 0-20 (caja cubre pagos pendientes)
    const pendingInv = (invoices || []).filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente');
    const pendingTotal = pendingInv.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const ptsCaja = pendingTotal === 0 ? 20 : ventasMes > pendingTotal ? 15 : ventasMes > pendingTotal * 0.5 ? 8 : 0;
    factors.push({ nombre: 'Caja', estado: ptsCaja >= 14 ? 'ok' : 'warn', pts: ptsCaja, max: 20 });
    score += ptsCaja;

    // 4. Inventario 0-15 (% productos con stock > STOCK_MIN)
    const activeProds = (products || []).filter(p => !p.deleted);
    const sanosCount = activeProds.filter(p => (p.stock || 0) >= STOCK_MIN).length;
    const ptsInv = activeProds.length > 0 ? Math.round((sanosCount / activeProds.length) * 15) : 15;
    factors.push({ nombre: 'Inventario', estado: ptsInv >= 10 ? 'ok' : 'warn', pts: ptsInv, max: 15 });
    score += ptsInv;

    // 5. Cobranza 0-15 (% crédito NO vencido)
    const today0 = new Date(); today0.setHours(0,0,0,0);
    const vencidas = pendingInv.filter(i => i.dueDate && new Date(i.dueDate) < today0).length;
    const ptsCobranza = pendingInv.length === 0 ? 15 : Math.round(Math.max(0, (1 - vencidas / pendingInv.length)) * 15);
    factors.push({ nombre: 'Cobranza', estado: ptsCobranza >= 10 ? 'ok' : 'warn', pts: ptsCobranza, max: 15 });
    score += ptsCobranza;

    return { score: Math.min(100, Math.max(0, score)), factors };
}

function computeRecommendations(products, eleventaSales, invoices) {
    const recs = [];
    const now = new Date();
    const cutoff18 = new Date(now); cutoff18.setDate(cutoff18.getDate() - DIAS_SIN_MOV);
    const cutoff18Str = cutoff18.toISOString().split('T')[0];
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // Build product sales stats for current month
    const salesQty = {}, salesRev = {};
    (eleventaSales || []).forEach(sale => {
        if (!sale.date || !sale.date.startsWith(currentMonthStr)) return;
        if (!sale.items || !Array.isArray(sale.items)) return;
        sale.items.forEach(item => {
            const name = (item.name || '').trim().toLowerCase();
            if (!name) return;
            salesQty[name] = (salesQty[name] || 0) + (parseFloat(item.qty) || 1);
            salesRev[name] = (salesRev[name] || 0) + (parseFloat(item.price) || 0);
        });
    });

    // Track last sale date per product
    const lastSaleDate = {};
    (eleventaSales || []).forEach(sale => {
        if (!sale.items || !Array.isArray(sale.items)) return;
        const dateStr = (sale.date_local || (sale.date || '').split('T')[0]);
        sale.items.forEach(item => {
            const name = (item.name || '').trim().toLowerCase();
            if (!name) return;
            if (!lastSaleDate[name] || dateStr > lastSaleDate[name]) lastSaleDate[name] = dateStr;
        });
    });

    const daysElapsed = Math.max(now.getDate(), 1);

    (products || []).filter(p => !p.deleted && p.name).forEach(p => {
        const key = p.name.trim().toLowerCase();
        const qty = salesQty[key] || 0;
        const rev = salesRev[key] || 0;
        const buyPrice = parseFloat(p.buyPrice || p.costUnit || p.cost || 0);
        const salePrice = parseFloat(p.salePrice || 0);
        const stock = parseFloat(p.stock || 0);
        const margin = salePrice > 0 ? (salePrice - buyPrice) / salePrice : 0;

        // REPONER: stock <= STOCK_MIN y tiene ventas este mes
        if (stock <= STOCK_MIN && qty > 0) {
            const dailyRate = qty / daysElapsed;
            const impacto = Math.round(dailyRate * 7 * salePrice * (1 - margin));
            recs.push({ tipo: 'REPONER', titulo: p.name, impacto, urgencia: stock <= 0 ? 'alta' : 'media', prioridad: impacto });
        }

        // SUBIR PRECIO: margen < objetivo Y volumen > 5 uds/mes
        if (margin < MARGEN_OBJETIVO && qty >= 5 && salePrice > 0) {
            const impacto = Math.round((MARGEN_OBJETIVO - margin) * salePrice * qty);
            recs.push({ tipo: 'SUBIR PRECIO', titulo: p.name, impacto, urgencia: margin < 0.10 ? 'alta' : 'media', prioridad: impacto });
        }

        // SIN MOVIMIENTO: 0 ventas en DIAS_SIN_MOV días + stock > 0
        const lastDate = lastSaleDate[key];
        const noMovimiento = !lastDate || lastDate < cutoff18Str;
        if (noMovimiento && stock > 0) {
            const impacto = Math.round(stock * buyPrice);
            recs.push({ tipo: 'SIN MOVIMIENTO', titulo: p.name, impacto, urgencia: 'baja', prioridad: impacto });
        }
    });

    return recs.sort((a, b) => b.prioridad - a.prioridad).slice(0, 10);
}

function computeActionableAlerts(products, eleventaSales) {
    const alerts = [];
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // Build qty & revenue per product this month
    const salesQty = {}, salesRev = {};
    (eleventaSales || []).forEach(sale => {
        if (!sale.date || !sale.date.startsWith(currentMonthStr)) return;
        if (!sale.items || !Array.isArray(sale.items)) return;
        sale.items.forEach(item => {
            const name = (item.name || '').trim().toLowerCase();
            salesQty[name] = (salesQty[name] || 0) + (parseFloat(item.qty) || 1);
            salesRev[name] = (salesRev[name] || 0) + (parseFloat(item.price) || 0);
        });
    });

    (products || []).filter(p => !p.deleted && p.name).forEach(p => {
        const key = p.name.trim().toLowerCase();
        const qty = salesQty[key] || 0;
        if (qty === 0) return;
        const salePrice = parseFloat(p.salePrice || 0);
        const buyPrice = parseFloat(p.buyPrice || p.costUnit || p.cost || 0);
        if (salePrice <= 0) return;
        const margin = (salePrice - buyPrice) / salePrice;
        if (margin < MARGEN_CRITICO) {
            const impacto = Math.round((MARGEN_CRITICO - margin) * salePrice * qty);
            alerts.push({
                nombre: p.name,
                margenPct: (margin * 100).toFixed(1),
                impacto,
                msg: `${p.name}: margen ${(margin*100).toFixed(1)}% → impacto -${wmCompact(impacto)}/mes`
            });
        }
    });

    return alerts.sort((a, b) => b.impacto - a.impacto);
}

window.Views.dashboard = async (container, selectedMonth = null) => {
    // 🔍 SMART REFRESH CHECK: If basic shell already exists, skip innerHTML overwrite
    const isAlreadyRendered = document.getElementById('tab-resumen') !== null;

    if (!isAlreadyRendered) {
        container.innerHTML = `
    <style>
        /* ── Editorial Dashboard — Sala de Control ── */

        /* Franja header metrics */
        .ed-header-band {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
            gap: 1px;                       /* divisores hairline vía gap */
            background: var(--border);      /* el gap muestra este color */
            border: 1px solid var(--border);
            border-radius: 16px;
            margin-bottom: 28px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        .ed-metric {
            padding: 18px 18px 16px;
            background: var(--bg-card);
            position: relative;
            min-width: 0;                   /* evita desborde del grid */
            border-top: 3px solid transparent;
            transition: background .2s;
        }
        .ed-metric:hover { background: var(--bg-elevated); }
        .acc-ventas { border-top-color: var(--primary); }
        .acc-gastos { border-top-color: var(--danger); }
        .acc-utilidad { border-top-color: var(--color-success); }
        .acc-caja { border-top-color: #14b8a6; }
        .acc-salud { border-top-color: var(--color-warning); }
        .ed-metric-label {
            font-size: 0.74rem;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 8px;
        }
        .ed-metric-value {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: clamp(1.6rem, 4vw, 2.5rem);
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1.05;
            letter-spacing: -0.5px;
            overflow-wrap: anywhere;
        }
        .ed-metric-delta {
            font-size: 0.85rem;
            font-weight: 700;
            margin-top: 7px;
        }
        .ed-delta-up   { color: var(--color-success); }
        .ed-delta-down { color: var(--danger); }
        .ed-delta-flat { color: var(--text-muted); }

        /* Section headings */
        .ed-section {
            margin-bottom: 32px;
        }
        .ed-section-head {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
        }
        .ed-section-title {
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--text-muted);
            white-space: nowrap;
        }
        .ed-section-line {
            flex: 1;
            height: 1px;
            background: var(--border);
        }

        /* Dash header */
        .dash-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:0.75rem; }
        .dash-header-btns { display:flex; gap:0.75rem; }

        /* Health score block */
        .ed-health-row {
            display: grid;
            grid-template-columns: 100px 1fr;
            gap: 24px;
            align-items: center;
        }
        .ed-score-circle {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 116px;
            height: 116px;
            border-radius: 50%;
            border: 3px solid var(--border);
            flex-shrink: 0;
        }
        .ed-score-num {
            font-family: var(--font-mono, monospace);
            font-size: 2.5rem;
            font-weight: 900;
            line-height: 1;
            color: var(--text-primary);
        }
        .ed-score-label {
            font-size: 0.6rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-top: 2px;
        }
        .ed-health-factors {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .ed-factor-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.98rem;
        }
        .ed-factor-icon { font-size: 1rem; flex-shrink: 0; }
        .ed-factor-name { color: var(--text-secondary); flex: 1; }
        .ed-factor-pts  { font-family: var(--font-mono, monospace); font-size: 0.92rem; color: var(--text-muted); }

        @media (max-width: 480px) {
            .ed-health-row { grid-template-columns: 1fr; }
            .ed-score-circle { width: 80px; height: 80px; }
        }

        /* Recommendations */
        .ed-rec-list { display: flex; flex-direction: column; gap: 8px; }
        .ed-rec-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: 10px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
        }
        .ed-rec-chip {
            font-size: 0.6rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 3px 7px;
            border-radius: 6px;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .ed-chip-alta   { background: rgba(240,85,106,0.15); color: var(--danger); }
        .ed-chip-media  { background: rgba(245,177,76,0.15); color: var(--color-warning); }
        .ed-chip-baja   { background: rgba(156,164,178,0.12); color: var(--text-muted); }
        .ed-rec-title   { font-size: 0.98rem; font-weight: 600; color: var(--text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ed-rec-impact  { font-family: var(--font-mono, monospace); font-size: 0.95rem; font-weight: 700; color: var(--color-success); white-space: nowrap; flex-shrink: 0; }
        .ed-rec-tipo    { font-size: 0.76rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

        /* Ventas y rentabilidad */
        .ed-sales-grid {
            display: grid;
            grid-template-columns: 1fr 280px;
            gap: 24px;
            align-items: start;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }
        @media (max-width: 768px) { .ed-sales-grid { grid-template-columns: 1fr; } }
        .ed-narrative {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 8px;
        }
        .ed-narrative-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
            font-size: 0.85rem;
        }
        .ed-narrative-row:last-child { border-bottom: none; }
        .ed-nar-label { color: var(--text-secondary); font-size: 0.98rem; }
        .ed-nar-val   { font-family: var(--font-mono, monospace); font-weight: 700; color: var(--text-primary); font-size: 1.15rem; }

        /* Caja y flujo */
        .ed-caja-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }
        .ed-caja-cell {
            padding: 18px 16px;
            border-right: 1px solid var(--border);
        }
        .ed-caja-cell:last-child { border-right: none; }
        .ed-caja-label { font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 7px; }
        .ed-caja-value { font-family: var(--font-mono, monospace); font-size: clamp(1.5rem, 3.5vw, 1.9rem); font-weight: 800; color: var(--text-primary); overflow-wrap: anywhere; }
        .ed-caja-sub   { font-size: 0.78rem; color: var(--text-muted); margin-top: 5px; }
        @media (max-width: 640px) { .ed-caja-grid { grid-template-columns: repeat(2, 1fr); } .ed-caja-cell:nth-child(2) { border-right: none; } .ed-caja-cell:nth-child(n+3) { border-top: 1px solid var(--border); } }

        /* Operación */
        .ed-ops-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        @media (max-width: 560px) { .ed-ops-grid { grid-template-columns: 1fr; } }
        .ed-ops-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }
        .ed-ops-head {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            margin-bottom: 12px;
        }
        .ed-ops-list { display: flex; flex-direction: column; gap: 5px; }
        .ed-ops-row  { display: flex; justify-content: space-between; align-items: center; font-size: 0.92rem; padding: 6px 0; border-bottom: 1px solid var(--border); }
        .ed-ops-row:last-child { border-bottom: none; }
        .ed-ops-name { color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
        .ed-ops-stat { font-family: var(--font-mono, monospace); font-size: 0.9rem; font-weight: 700; color: var(--text-muted); flex-shrink: 0; }

        /* Alertas */
        .ed-alert-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: var(--bg-elevated);
            font-size: 0.85rem;
            margin-bottom: 6px;
            cursor: pointer;
        }
        .ed-alert-item.sev-high { border-color: rgba(240,85,106,0.35); background: rgba(240,85,106,0.06); box-shadow: 0 0 12px rgba(240,85,106,0.12); }
        .ed-alert-item.sev-med  { border-color: rgba(245,177,76,0.35); background: rgba(245,177,76,0.05); }
        .ed-alert-item.sev-low  { border-color: var(--border); }
        .ed-alert-icon  { font-size: 1.1rem; flex-shrink: 0; }
        .ed-alert-text  { flex: 1; color: var(--text-primary); line-height: 1.4; }
        .ed-alert-meta  { font-size: 0.72rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; flex-shrink: 0; }
        .ed-alert-caret { color: var(--text-muted); font-size: 0.9rem; flex-shrink: 0; transition: transform 0.2s; }
        .ed-alert-item.open .ed-alert-caret { transform: rotate(180deg); }
        .ed-alert-details { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
        .ed-alert-details.open { max-height: 500px; overflow-y: auto; }
        .ed-alert-detail-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 14px; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
        .ed-alert-detail-row:last-child { border-bottom: none; }
        .cd-name { font-weight: 600; color: var(--text-primary); }
        .cd-sub  { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
        .cd-right { font-weight: 700; color: var(--text-primary); white-space: nowrap; }

        /* Proveedores */
        .ed-supplier-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .ed-supplier-row:last-child { border-bottom: none; }
        .ed-supplier-top { display: flex; justify-content: space-between; align-items: center; }
        .ed-supplier-name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
        .ed-supplier-amt  { font-family: var(--font-mono, monospace); font-size: 0.82rem; font-weight: 700; }
        .supplier-bar-bg  { height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; margin-top: 4px; }
        .supplier-bar-fill { height: 100%; width: 0%; border-radius: 99px; transition: width 0.8s ease; }

        /* Today / live feed */
        .ed-today-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .ed-today-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text-muted);
        }
        .ed-live-dot { width: 7px; height: 7px; background: var(--color-success); border-radius: 50%; box-shadow: 0 0 6px var(--color-success); flex-shrink: 0; }
        .ed-today-totals { display: flex; align-items: center; gap: 12px; font-size: 1rem; }

        .live-ticket-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
        .live-ticket-row:last-child { border-bottom: none; }
        .live-ticket-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .live-ticket-id { font-weight: 700; color: var(--text-primary); white-space: nowrap; }
        .live-ticket-time { color: var(--text-muted); font-size: 0.72rem; }
        .live-ticket-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .live-ticket-total { font-weight: 700; color: var(--color-success); font-family: var(--font-mono, monospace); }
        .live-ticket-profit { font-size: 0.72rem; color: var(--text-muted); }

        /* Payment donut area */
        .ed-payment-wrap { display: flex; align-items: center; gap: 16px; }
        .ed-payment-legend { display: flex; flex-direction: column; gap: 5px; font-size: 0.78rem; flex: 1; }
        .leg-row { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
        .leg-dot  { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .leg-label { display: flex; align-items: center; gap: 5px; font-weight: 600; color: var(--text-primary); }
        .leg-pct  { font-weight: 700; color: var(--text-muted); }

        /* Sparklines */
        .spark-container { height: 36px; }

        /* Projection (kept compact) */
        .ed-projection {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 20px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 28px;
        }
        .ed-proj-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
        .ed-proj-value { font-family: var(--font-mono, monospace); font-size: 1.5rem; font-weight: 900; color: var(--text-primary); line-height: 1; }
        .ed-proj-meta  { font-size: 0.75rem; color: var(--text-muted); margin-top: 3px; }
        .ed-proj-right { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

        /* Health desglose inside existing health-detail */
        .ed-desglose { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-top: 10px; }

        /* Dash sub-button */
        .dash-tab { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
        .ceo-delta { font-size: 0.75rem; font-weight: 700; }
        .ceo-delta.up   { color: var(--color-success); }
        .ceo-delta.down { color: var(--danger); }
        .ceo-delta.flat { color: var(--text-muted); }

        /* Acciones rápidas mobile */
        .mobile-only { display: none; }
        @media (max-width: 768px) { .mobile-only { display: grid; } }

        /* Alertas count badge */
        .ceo-alerts-count { background: var(--color-warning); color: #0a0c0f; border-radius: 99px; min-width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.78rem; padding: 0 7px; }
        .ceo-alerts-count.zero { background: var(--color-success); }

        /* Dark mode divider */
        body.dark-mode .ed-section-line { background: rgba(255,255,255,0.08); }

        /* Terminal ticker (kept hidden but functional) */
        .term-ticker-wrap { margin: 2px 0 18px; }
        .term-ticker { background:#050a07; border:1px solid rgba(0,255,102,0.22); border-radius:12px; overflow:hidden; font-family:'JetBrains Mono','Cascadia Code','Consolas',monospace; }
        .term-ticker-head { display:flex; justify-content:space-between; align-items:center; padding:7px 12px; border-bottom:1px solid rgba(0,255,102,0.14); font-size:0.6rem; letter-spacing:0.18em; color:#00ff66; text-transform:uppercase; }
        @keyframes wm-tblink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        .term-ticker-head .blink { animation: wm-tblink 1.1s step-end infinite; }
        .term-row { display:grid; grid-template-columns: 92px 1fr auto 78px; align-items:center; gap:10px; padding:11px 12px; border-bottom:1px solid rgba(0,255,102,0.06); }
        .term-row:last-child { border-bottom:none; }
        .term-label { font-size:0.6rem; letter-spacing:0.12em; color:#5f9c79; text-transform:uppercase; }
        .term-spark { font-size:1.05rem; line-height:1; color:#00ff66; letter-spacing:1px; white-space:nowrap; overflow:hidden; }
        .term-val { font-size:1.15rem; font-weight:700; color:#d8ffe6; white-space:nowrap; }
        .term-delta { font-size:0.78rem; font-weight:700; text-align:right; white-space:nowrap; }
        .term-delta.up { color:#00ff66; } .term-delta.down { color:#ff5a5a; } .term-delta.warn { color:#ffc233; } .term-delta.flat { color:#5f9c79; }
    </style>

    <!-- Header -->
    <div class="dash-header">
        <div>
            <h1 style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin:0; display:flex; align-items:center; gap:8px;">
                <i class="ph ph-squares-four"></i> Resumen
            </h1>
        </div>
        <div class="dash-header-btns">
            <select id="dash-month-selector" class="btn" style="height:38px; padding:0 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg-card); font-weight:600; cursor:pointer; color:var(--text-primary); font-size:0.85rem;">
                <option value="">Cargando...</option>
            </select>
            <button id="btn-export-excel" class="btn btn-premium" style="border-radius:10px; height:38px; padding:0 14px;">
                <i class="ph ph-file-xls"></i> <span class="hide-mobile">Excel</span>
            </button>
        </div>
    </div>

    <!-- ===================== TAB 1: RESUMEN ===================== -->
    <div id="tab-resumen">

        <!-- ① FRANJA HEADER: 5 métricas clave -->
        <div class="ed-header-band">
            <div class="ed-metric acc-ventas">
                <div class="ed-metric-label">Ventas</div>
                <div class="ed-metric-value" id="kpi-ventas-mes">…</div>
                <div class="ed-metric-delta" id="kpi-ventas-mes-badge"></div>
                <div class="spark-container" style="margin-top:8px;"><canvas id="spark-ventas"></canvas></div>
            </div>
            <div class="ed-metric acc-gastos">
                <div class="ed-metric-label">Gastos</div>
                <div class="ed-metric-value" id="kpi-gasto-mes">…</div>
                <div class="ed-metric-delta" id="kpi-gasto-mes-badge"></div>
                <div class="spark-container" style="margin-top:8px;"><canvas id="spark-gastos"></canvas></div>
            </div>
            <div class="ed-metric acc-utilidad">
                <div class="ed-metric-label">Utilidad</div>
                <div class="ed-metric-value" id="kpi-margen-neto">…</div>
                <div class="ed-metric-delta" id="health-ratio-pct" style="color:var(--text-muted); font-size:0.72rem; margin-top:4px;"></div>
            </div>
            <div class="ed-metric acc-caja">
                <div class="ed-metric-label">Caja Real</div>
                <div class="ed-metric-value" id="ceo-cash-net">…</div>
                <div class="ed-metric-delta" id="ceo-cash-sub" style="color:var(--text-muted); font-size:0.68rem; margin-top:4px;"></div>
            </div>
            <div class="ed-metric acc-salud">
                <div class="ed-metric-label">Salud</div>
                <div class="ed-metric-value" id="ed-health-score-header">—</div>
                <div id="health-label" style="font-size:0.72rem; color:var(--text-muted); margin-top:4px; font-weight:600;"></div>
            </div>
        </div>

        <!-- ⑤ VENTAS Y RENTABILIDAD -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-section-title">Ventas y Rentabilidad</span>
                <div class="ed-section-line"></div>
            </div>
            <div class="ed-sales-grid">
                <div>
                    <div style="height:340px; width:100%;"><canvas id="plChart"></canvas></div>
                    <div class="ed-narrative" id="ed-sales-narrative"></div>
                </div>
                <div>
                    <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); margin-bottom:10px;">Forma de Pago</div>
                    <div class="ed-payment-wrap">
                        <canvas id="paymentDonut" width="100" height="100"></canvas>
                        <div class="ed-payment-legend" id="ceo-payment-legend"></div>
                    </div>
                    <div style="margin-top:16px;">
                        <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); margin-bottom:8px;">Ticket Promedio</div>
                        <div style="font-family:var(--font-mono,monospace); font-size:1.4rem; font-weight:800; color:var(--text-primary);" id="ceo-avg-ticket">—</div>
                        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;" id="ceo-avg-ticket-sub"></div>
                        <div id="ceo-avg-ticket-foot" style="margin-top:4px;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Proyección (mantiene todos los IDs originales, presentación compacta) -->
        <div id="prediction-container" class="hidden">
            <div class="ed-projection">
                <div>
                    <div class="ed-proj-label"><i class="ph ph-chart-line-up"></i> Proyección Mes</div>
                    <div style="display:flex; align-items:baseline; gap:8px; margin-top:4px;">
                        <span id="predict-total" class="ed-proj-value">…</span>
                        <span id="predict-month-label" class="ed-proj-meta"></span>
                    </div>
                </div>
                <div class="ed-proj-right">
                    <span id="predict-confidence" style="font-size:0.72rem; color:var(--text-muted); font-weight:600;"></span>
                    <div id="predict-comparison" style="font-size:0.75rem;"></div>
                </div>
                <div id="predict-insight-box" style="display:none;"></div>
            </div>
            <div style="height:4px; background:var(--bg-elevated); border-radius:99px; overflow:hidden; margin:-20px 0 28px; position:relative; z-index:1;">
                <div id="predict-progress-bar" style="height:100%; width:0%; background:var(--primary); border-radius:99px; transition:width 1s ease;"></div>
            </div>
            <span id="predict-percent" style="display:none;"></span>
            <span id="predict-insight-text" style="display:none;"></span>
            <span id="predict-insight-dot" style="display:none;"></span>
            <span id="predict-record-value" style="display:none;"></span>
        </div>

        <!-- ② HOY (live feed) -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-today-label"><span class="ed-live-dot"></span> Hoy</span>
                <div class="ed-today-totals">
                    <span style="color:var(--text-muted);"><b id="live-sales-count">0</b> tickets</span>
                    <b id="live-sales-total" style="color:var(--color-success); font-family:var(--font-mono,monospace);">$0</b>
                </div>
                <div class="ed-section-line"></div>
            </div>
            <div id="live-sales-feed"></div>
        </div>

        <!-- ③ SALUD DEL NEGOCIO -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-section-title">Salud del Negocio</span>
                <div class="ed-section-line"></div>
            </div>
            <div class="ed-health-row">
                <div class="ed-score-circle" id="ed-health-circle">
                    <div class="ed-score-num" id="ed-health-score-num">—</div>
                    <div class="ed-score-label">/ 100</div>
                </div>
                <div>
                    <div class="ed-health-factors" id="ed-health-factors">
                        <div style="color:var(--text-muted); font-size:0.82rem;">Calculando…</div>
                    </div>
                    <!-- Rentabilidad desglose (mantiene health-detail, health-bar-wrap, health-bar) -->
                    <div id="health-bar-wrap" style="height:3px; border-radius:99px; overflow:hidden; margin-top:12px; background:var(--bg-elevated);">
                        <div id="health-bar" style="width:0%; height:100%; transition:width 1s ease;"></div>
                    </div>
                    <div id="health-detail"></div>
                </div>
            </div>
        </div>

        <!-- ④ ACCIONES RECOMENDADAS -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-section-title">Acciones Recomendadas</span>
                <div class="ed-section-line"></div>
            </div>
            <div class="ed-rec-list" id="ed-rec-list">
                <div style="color:var(--text-muted); font-size:0.82rem; padding:8px 0;">Calculando…</div>
            </div>
        </div>

        <!-- ⑥ CAJA Y FLUJO -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-section-title">Caja y Flujo</span>
                <div class="ed-section-line"></div>
            </div>
            <div class="ed-caja-grid">
                <div class="ed-caja-cell">
                    <div class="ed-caja-label">Caja disponible</div>
                    <div class="ed-caja-value" id="ed-caja-disp">—</div>
                    <div class="ed-caja-sub" id="ceo-cash-breakdown2"></div>
                </div>
                <div class="ed-caja-cell">
                    <div class="ed-caja-label">Ingresos esperados</div>
                    <div class="ed-caja-value" id="ed-ingresos-esp">—</div>
                    <div class="ed-caja-sub" id="ed-ingresos-sub"></div>
                </div>
                <div class="ed-caja-cell">
                    <div class="ed-caja-label">Pagos pendientes</div>
                    <div class="ed-caja-value" id="ed-pagos-pend">—</div>
                    <div class="ed-caja-sub" id="ed-pagos-sub"></div>
                </div>
                <div class="ed-caja-cell">
                    <div class="ed-caja-label">Liquidez 30d</div>
                    <div class="ed-caja-value" id="dec-cash-content">—</div>
                    <div class="ed-caja-sub" id="ed-liquidez-sub"></div>
                </div>
            </div>
            <!-- hidden breakdown for legacy population -->
            <div id="ceo-cash-breakdown" style="display:none;"></div>
        </div>

        <!-- ⑦ OPERACIÓN -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-section-title">Operación</span>
                <div class="ed-section-line"></div>
            </div>
            <div class="ed-ops-grid">
                <div class="ed-ops-card">
                    <div class="ed-ops-head"><i class="ph ph-shopping-cart" style="color:var(--primary);"></i> Qué reponer</div>
                    <div class="ed-ops-list" id="dec-buy-list"><span style="color:var(--text-muted); font-size:0.8rem;">Cargando…</span></div>
                </div>
                <div class="ed-ops-card">
                    <div class="ed-ops-head"><i class="ph ph-arrow-fat-up" style="color:var(--color-warning);"></i> Subir precio</div>
                    <div class="ed-ops-list" id="dec-price-list"><span style="color:var(--text-muted); font-size:0.8rem;">Cargando…</span></div>
                </div>
                <div class="ed-ops-card">
                    <div class="ed-ops-head"><i class="ph ph-calendar-x" style="color:var(--danger);"></i> Día más flojo</div>
                    <div id="dec-day-content" style="font-size:0.82rem;"><span style="color:var(--text-muted);">Cargando…</span></div>
                </div>
                <div class="ed-ops-card">
                    <div class="ed-ops-head"><i class="ph ph-money" style="color:var(--danger);"></i> Próximos pagos</div>
                    <div id="upcoming-payments-list" style="font-size:0.82rem; color:var(--text-secondary);"><div class="spinner m-auto"></div></div>
                </div>
            </div>
            <!-- CTA Márgenes -->
            <button id="ceo-margins-cta-btn" onclick="window._goToMargenes()" style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; width:100%; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:12px 16px; cursor:pointer; transition:border-color 0.2s; text-align:left;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                <span style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-secondary);"><i class="ph ph-chart-line-up" style="color:var(--primary);"></i> Ver análisis completo de márgenes</span>
                <i class="ph ph-arrow-right" style="color:var(--text-muted);"></i>
            </button>
        </div>

        <!-- ⑧ ALERTAS -->
        <div class="ed-section" id="ceo-alerts-card">
            <div class="ed-section-head">
                <span class="ed-section-title">Alertas</span>
                <span class="ceo-alerts-count" id="ceo-alerts-count" style="margin-left:4px;">0</span>
                <div class="ed-section-line"></div>
            </div>
            <div id="ceo-alerts-list">
                <div style="color:var(--text-muted); font-size:0.82rem; padding:8px 0;">Calculando…</div>
            </div>
            <!-- Alertas accionables con $ (computeActionableAlerts) -->
            <div id="ed-actionable-alerts" style="margin-top:8px;"></div>
            <!-- Vencimiento productos -->
            <div id="expiry-alerts-container" class="hidden" style="margin-top:8px;">
                <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); margin-bottom:8px;">Vencimientos</div>
                <div id="expiry-alerts-list"></div>
            </div>
        </div>

        <!-- ⑨ PROVEEDORES -->
        <div class="ed-section">
            <div class="ed-section-head">
                <span class="ed-section-title">Proveedores</span>
                <div class="ed-section-line"></div>
            </div>
            <div id="top-suppliers"><div class="spinner m-auto"></div></div>
            <!-- Facturas crédito -->
            <div id="credit-widget" style="margin-top:14px; padding:14px 16px; background:var(--bg-card); border:1px solid rgba(245,177,76,0.3); border-radius:10px; cursor:pointer;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--color-warning);">Facturas a crédito</span>
                    <i class="ph ph-arrow-right" style="color:var(--text-muted);"></i>
                </div>
                <div id="credit-widget-content" style="font-size:0.85rem; color:var(--text-secondary);"><div class="spinner m-auto"></div></div>
            </div>
        </div>

        <!-- Terminal ticker (hidden, mantiene IDs para el renderTerminalTicker) -->
        <div id="terminal-ticker" style="display:none;"></div>

        <!-- Legacy hidden IDs for remaining population code -->
        <div id="dec-buy" style="display:none;"></div>
        <div id="dec-price" style="display:none;"></div>
        <div id="dec-day" style="display:none;"></div>
        <div id="dec-cash" style="display:none;"></div>

    </div>
    `;
    } // End if(!isAlreadyRendered)

    // Helper global para navegación — evita escape de comillas en onclick inline
    window._goToMargenes = () => { document.querySelector('[data-view="profit_monitor"]')?.click(); };

    // (Tab switching removed as only Resumen exists now)

    // ===================== LOAD RESUMEN DATA =====================
    try {
        const msCurrent = document.getElementById('dash-month-selector');
        if (selectedMonth === null && msCurrent && msCurrent.value) {
            selectedMonth = msCurrent.value;
        }

        let now = new Date();
        const realToday = new Date();
        
        if (selectedMonth) {
            const [y, m] = selectedMonth.split('-');
            const reqY = parseInt(y);
            const reqM = parseInt(m) - 1;
            
            // Si el mes seleccionado es el actual, usamos el día de hoy
            if (reqY === realToday.getFullYear() && reqM === realToday.getMonth()) {
                now = new Date(realToday.getFullYear(), realToday.getMonth(), realToday.getDate(), 12, 0, 0);
            } else {
                // Si es un mes pasado, asumimos el mes entero (el último día del mes)
                now = new Date(reqY, reqM + 1, 0, 12, 0, 0); 
            }
        }
        
        // IMPORTANTE: Usar hora LOCAL (no UTC) para evitar desfase en Argentina (UTC-3)
        const todayStr = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`;
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Fetch all data in parallel
        // Nota: workLogs ya NO se trae aquí — era una variable "logs" que nunca se usaba en el dashboard.
        // El fetch de workLogs para el Excel se hace de forma lazy dentro del handler de exportación.
        const [allEmployees, allInvoices, allSuppliers, allDailySales, allProducts, allExpenses, allEleventaSales] = await Promise.all([
            window.db.employees.toArray(),
            window.db.purchase_invoices.toArray(),
            window.db.suppliers.toArray(),
            window.db.daily_sales.toArray(),
            window.db.products.toArray(),
            window.db.expenses.toArray(),
            window.db.eleventa_sales.toArray()
        ]);

        const employees = allEmployees.filter(e => !e.deleted);
        const invoices = allInvoices.filter(i => !i.deleted);
        const suppliers = allSuppliers.filter(s => !s.deleted);

        // --- FILTRADO ESTRICTO Y GUARDIA DE NEGOCIO ---
        // Excluimos registros marcados como borrados y aquellos con montos absurdos (TESTS)
        const dailySales = allDailySales.filter(d => {
            if (d.deleted) return false;
            const val = parseFloat(d.total) || 0;
            return val < 1000000000; // Máximo 1 Billon CLP (Guardia contra basura)
        });

        const products = allProducts.filter(p => !p.deleted);

        const supplierMap = window.Utils.createSupplierMap(suppliers);

        const eleventaSales = (allEleventaSales || []).filter(s => !s.deleted);

        // --- LLENAR SELECTOR DE MESES ---
        const ms = document.getElementById('dash-month-selector');
        if (ms) {
            const months = new Set();
            dailySales.forEach(s => { if (s.date) months.add(s.date.substring(0, 7)) });
            for (let i = 0; i < 12; i++) {
                const d = new Date(realToday.getFullYear(), realToday.getMonth() - i, 1);
                months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }
            ms.innerHTML = '';
            Array.from(months).sort().reverse().forEach(m_str => {
                const [y, mo] = m_str.split('-');
                const lbl = new Date(y, parseInt(mo) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                ms.insertAdjacentHTML('beforeend', `<option value="${m_str}">${lbl.charAt(0).toUpperCase() + lbl.slice(1)}</option>`);
            });
            ms.value = currentMonthStr; // Fijar mes actual

            if (!ms.dataset.listenerAdded) {
                ms.dataset.listenerAdded = '1';
                ms.addEventListener('change', (e) => {
                    window.Views.dashboard(container, e.target.value);
                });
            }
        }

        // ---- Módulo Ventas en Directo (Eleventa) ----
        // Mostrar TODAS las ventas del día completo
        const nowLocal = new Date();
        const localYear = nowLocal.getFullYear();
        const localMonth = String(nowLocal.getMonth() + 1).padStart(2, '0');
        const localDay = String(nowLocal.getDate()).padStart(2, '0');
        const todayStrLocal = `${localYear}-${localMonth}-${localDay}`; // YYYY-MM-DD local

        const todayEleventa = eleventaSales.filter(v => {
            // Usar date_local (fecha calendario local) si existe, si no extraer de date UTC
            let dateStr = v.date_local || String(v.date).split('T')[0];
            return dateStr === todayStrLocal;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        const elFeed = document.getElementById('live-sales-feed');
        const validSales = todayEleventa.filter(v => v.total > 0);

        // --- Meta diaria ---
        const META_DIARIA = 400000;

        if (elFeed) {
            if (validSales.length === 0) {
                elFeed.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.8rem;">Sin ventas hoy</div>';
            } else {
                const renderSales = validSales.slice(0, 5);
                elFeed.innerHTML = renderSales.map((v, index) => {
                    const dateObj = new Date(v.date);
                    const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    const profit = parseFloat(v.profit) || 0;
                    return `
                    <div class="live-ticket-row ${index === 0 ? 'new' : ''}">
                        <div class="live-ticket-left">
                            <span class="live-ticket-id">#${v.ticket_id || v.id}</span>
                            <span class="live-ticket-time">${timeStr}</span>
                        </div>
                        <div class="live-ticket-right">
                            <span class="live-ticket-profit">+${window.Utils.formatCurrency(profit)}</span>
                            <span class="live-ticket-total">${window.Utils.formatCurrency(v.total)}</span>
                        </div>
                    </div>`;
                }).join('');
            }
            document.getElementById('live-sales-count').textContent = validSales.length;
            const eleventaTotal = validSales.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
            document.getElementById('live-sales-total').innerHTML = window.Utils.formatCurrency(eleventaTotal);

            // Barra de progreso de meta diaria
            const META_DIARIA_FORMATTED = Math.round(META_DIARIA).toLocaleString('es-CL');
            const metaProgressHtml = `
                <div style="margin-top:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">
                        <span>Meta diaria</span>
                        <span>$${META_DIARIA_FORMATTED}</span>
                    </div>
                    <div style="height:6px; background:rgba(0,0,0,0.06); border-radius:99px; overflow:hidden;">
                        <div id="meta-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #00ff66, #00a849); border-radius:99px; transition:width 1s ease;"></div>
                    </div>
                </div>`;
            // Insertar barra antes del feed (debajo del header del widget Hoy)
            if (!document.getElementById('meta-progress-bar')) {
                elFeed.insertAdjacentHTML('beforebegin', metaProgressHtml);
            }

            // Animar barra de progreso
            const metaBar = document.getElementById('meta-progress-bar');
            if (metaBar) {
                const metaPct = Math.min(100, (eleventaTotal / META_DIARIA) * 100);
                setTimeout(() => { metaBar.style.width = metaPct + '%'; }, 300);
                if (metaPct >= 100) metaBar.style.background = 'linear-gradient(90deg, #ffc233, #f59e0b)';
            }

            // Notificación de meta superada (una sola vez por día)
            const metaKey = `wm_meta_notified_${now.toISOString().slice(0, 10)}`;
            if (eleventaTotal >= META_DIARIA && !localStorage.getItem(metaKey)) {
                localStorage.setItem(metaKey, '1');
                if (window.Sync && window.Sync.showToast) {
                    window.Sync.showToast(`Meta diaria superada! $${Math.round(eleventaTotal).toLocaleString('es-CL')}`, 'success');
                }
                if (window.AppNotify && window.AppNotify.playChime) {
                    window.AppNotify.playChime('success');
                }
            }
        }

        // ---- KPI Calculations (True Profitability Engine) ----
        // 1. Sales (Total Revenue) — directo desde Eleventa (fuente real)
        //    daily_sales se sigue cargando para la gráfica histórica (antes de Eleventa)
        const thisMonthSales = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const prevMonthSales = eleventaSales.filter(s => s.date && s.date.startsWith(prevMonthStr));
        const ventasMes  = thisMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const ventasPrev = prevMonthSales.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

        // 1b. Comisión MercadoPago (2% sobre ventas con tarjeta)
        const COMISION_MP = 0.02;
        const tarjetaMes = thisMonthSales.filter(s => {
            const f = (s.forma_pago || '').toLowerCase();
            return f.includes('tarjeta') || f.includes('debito');
        }).reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const comisionMPMes = Math.round(tarjetaMes * COMISION_MP);

        const tarjetaPrev = prevMonthSales.filter(s => {
            const f = (s.forma_pago || '').toLowerCase();
            return f.includes('tarjeta') || f.includes('debito');
        }).reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
        const comisionMPPrev = Math.round(tarjetaPrev * COMISION_MP);

        // 2. Gross Profit (From Eleventa API)
        const thisMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const prevMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(prevMonthStr));
        
        // Sumamos el Margen Directo de cada ticket (Venta - Costo)
        const gananciaBrutaMes = thisMonthEleventa.reduce((s, t) => s + (parseFloat(t.profit) || 0), 0);
        const gananciaBrutaPrev = prevMonthEleventa.reduce((s, t) => s + (parseFloat(t.profit) || 0), 0);

        // 3. Gastos del mes (suma directa de todo lo registrado)
        const thisMonthExpenses = allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(currentMonthStr));
        const prevMonthExpenses = allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(prevMonthStr));

        const gastosDelMes = thisMonthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const gastoTotal = gastosDelMes + comisionMPMes;

        const gastosDelMesPrev = prevMonthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const gastoPrev = gastosDelMesPrev + comisionMPPrev;

        // 6. Invoices (Cashflow only, informational. Mercadería comprada)
        // NOTA: purchase_invoices NO se restan aquí porque gananciaBrutaMes (Eleventa) ya tiene costo descontado.
        // Las compras solo se usan en el gráfico P&L histórico como referencia visual de cashflow.

        const fmt = v => window.Utils.formatCurrency(v);

        // Gasto mes with badge
        const elGasto = document.getElementById('kpi-gasto-mes');
        if (elGasto) {
            window.Utils.animateNumber(elGasto, 0, gastoTotal, 1000, true);
        }
        renderBadge('kpi-gasto-mes-badge', gastoTotal, gastoPrev, true);

        // Ventas mes with badge
        const elVentas = document.getElementById('kpi-ventas-mes');
        if (elVentas) {
            window.Utils.animateNumber(elVentas, 0, ventasMes, 1000, true);
        }
        renderBadge('kpi-ventas-mes-badge', ventasMes, ventasPrev, false);

        // ---- 🧠 IA PREDICTIVE ENGINE INTEGRATION ----
        const predContainer = document.getElementById('prediction-container');
        if (window.Utils && window.Utils.PredictionEngine && predContainer) {
            predContainer.classList.remove('hidden'); // Show it early with "Calculating" state

            try {
                const prediction = await window.Utils.PredictionEngine.getProjectedSales();

                if (prediction) {
                    const elPredictTotal = document.getElementById('predict-total');
                    const elPredictComparison = document.getElementById('predict-comparison');
                    const elPredictConfidence = document.getElementById('predict-confidence');
                    const elPredictProgress = document.getElementById('predict-progress-bar');
                    const elPredictPercent = document.getElementById('predict-percent');
                    const elPredictInsight = document.getElementById('predict-insight-text');
                    const elPredictInsightBox = document.getElementById('predict-insight-box');
                    const elPredictRecordValue = document.getElementById('predict-record-value');

                    // Set current month label
                    const now = new Date();
                    const currentMonthName = now.toLocaleDateString('es-ES', { month: 'long' });
                    const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
                    const estLabel = document.getElementById('predict-month-label');
                    if (estLabel) estLabel.textContent = `est. fin de ${capitalizedMonth}`;

                    // 1. Animate Number (Ensure it's a valid number)
                    const total = parseFloat(prediction.projectedTotal) || 0;
                    window.Utils.animateNumber(elPredictTotal, 0, total, 2000, true);

                    // 2. Update Confidence Badge (Removed Emojis)
                    const confLabels = { high: '+60 días datos', medium: '+20 días datos', low: 'Pocos datos aún' };
                    if (elPredictConfidence) {
                        elPredictConfidence.textContent = confLabels[prediction.confidence] || 'Analizando...';
                        elPredictConfidence.style.color = prediction.confidence === 'high' ? '#10b981' : prediction.confidence === 'medium' ? '#fbbf24' : '#f43f5e';
                    }

                    // 3. Update Record Daily
                    if (elPredictRecordValue) elPredictRecordValue.innerHTML = fmt(prediction.maxDaily || 0);

                    // 4. Update Strategic Insight (UI/UX Refined)
                    if (elPredictInsight) {
                        elPredictInsight.textContent = prediction.insight;
                        const elDot = document.getElementById('predict-insight-dot');
                        if (elDot) {
                            elDot.style.background = prediction.insightColor;
                            elDot.style.boxShadow = `0 0 8px ${prediction.insightColor}`;
                        }
                        if (elPredictInsightBox) {
                            elPredictInsightBox.style.background = `${prediction.insightColor}10`; // 0.1 opacity
                            elPredictInsightBox.style.borderColor = `${prediction.insightColor}30`; // 0.2 opacity
                        }
                    }

                    // 5. Update Comparison
                    if (elPredictComparison) {
                        if (prediction.prevMonthTotal > 0) {
                            const diffPct = ((total / prediction.prevMonthTotal - 1) * 100).toFixed(1);
                            const isUp = total >= prediction.prevMonthTotal;
                            elPredictComparison.innerHTML = `
                                <span style="color:${isUp ? '#10b981' : '#f43f5e'}; font-weight:800; background:rgba(${isUp ? '16,185,129' : '244,63,94'}, 0.15); padding:4px 10px; border-radius:8px; display:flex; align-items:center; gap:4px;">
                                    <i class="ph ph-trend-${isUp ? 'up' : 'down'}"></i> ${isUp ? '+' : ''}${diffPct}%
                                </span>
                                <span style="color:#64748b; font-size:0.85rem;">vs mes anterior (${fmt(prediction.prevMonthTotal)})</span>
                            `;
                        } else {
                            elPredictComparison.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">Sin mes anterior para comparar</span>`;
                        }
                    }

                    // 6. Update Progress Bar
                    const progressPct = total > 0 ? Math.min(100, (prediction.mtdTotal / total) * 100) : 0;
                    if (elPredictPercent) elPredictPercent.textContent = progressPct.toFixed(0) + '%';
                    setTimeout(() => {
                        if (elPredictProgress) elPredictProgress.style.width = progressPct + '%';
                    }, 600);
                } else {
                    // Si la IA no tiene suficientes datos (vuelve null)
                    const elInsight = document.getElementById('predict-insight-text');
                    if (elInsight) elInsight.textContent = "Faltan datos (mín. 2 días de ventas)";
                }
            } catch (err) {
                console.error("Dashboard IA Error:", err);
            }
        }

        // ---- Utilidad Neta = Ganancia Bruta - Gastos del Mes - Comisión Tarjeta ----
        const utilidadNetaMonto = gananciaBrutaMes - gastoTotal;
        const margenNetoPct = ventasMes > 0 ? (utilidadNetaMonto / ventasMes * 100) : 0;

        const elMargenMonto = document.getElementById('kpi-margen-neto');
        if (elMargenMonto) {
            window.Utils.animateNumber(elMargenMonto, 0, utilidadNetaMonto, 1000, true);
        }

        // ---- DESGLOSE RENTABILIDAD NETA (Nuevo widget de transparencia) ----
        const elHealthDetail = document.getElementById('health-detail');
        const elHealthBar = document.getElementById('health-bar');
        const healthEl = document.getElementById('health-label');
        const healthRatioPct = document.getElementById('health-ratio-pct');

        // Renderizar el desglose detallado siempre
        if (elHealthDetail) {
            const fmtRow = (label, value, color, iconClass) => {
                const isNeg = value < 0;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06);">
                    <span style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="${iconClass}"></i> ${label}</span>
                    <span style="font-weight:700; font-size:0.9rem; color:${color};">${isNeg ? '-' : ''}${window.Utils.formatCurrency(Math.abs(value))}</span>
                </div>`;
            };

            const netColor = utilidadNetaMonto >= 0 ? '#10b981' : '#dc2626';

            // Agrupar gastos por categoría para el desglose
            const gastosPorCategoria = {};
            thisMonthExpenses.forEach(e => {
                const cat = e.category || 'Otros';
                gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (parseFloat(e.amount) || 0);
            });

            const categoriasHtml = Object.entries(gastosPorCategoria)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => fmtRow(cat, -amount, '#ef4444', 'ph ph-minus-circle'))
                .join('');

            elHealthDetail.innerHTML = `
                <div style="margin-top:12px; background:rgba(0,0,0,0.02); border-radius:14px; padding:14px; font-family: var(--font-primary, Arial, sans-serif); border:1px solid rgba(0,0,0,0.03);">

                    <details>
                        <summary style="list-style:none; cursor:pointer; outline:none; padding:4px 0 8px; font-size:0.82rem; font-weight:700; color:var(--text-muted);">Ver desglose de gastos</summary>

                        ${fmtRow('Ganancia Bruta (Cierre Caja)', gananciaBrutaMes, '#10b981', 'ph ph-coins')}

                        ${categoriasHtml}

                        ${comisionMPMes > 0 ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06);">
                            <span style="font-size:0.82rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                                <i class="ph ph-credit-card"></i> Comisión Tarjeta (2%)
                                <span style="font-size:0.72rem; opacity:0.7;">sobre ${window.Utils.formatCurrency(tarjetaMes)}</span>
                            </span>
                            <span style="font-weight:700; font-size:0.9rem; color:#e11d48;">-${window.Utils.formatCurrency(comisionMPMes)}</span>
                        </div>` : ''}

                    </details>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0 2px; margin-top:8px; border-top:2px solid rgba(0,0,0,0.05);">
                        <span style="font-size:0.9rem; font-weight:800; color:var(--text-primary);">UTILIDAD NETA FINAL</span>
                        <span style="font-weight:900; font-size:1.4rem; color:${netColor}; letter-spacing:-0.5px;">${utilidadNetaMonto >= 0 ? '+' : ''}${window.Utils.formatCurrency(utilidadNetaMonto)}</span>
                    </div>
                </div>
            `;
        }

        // ---- Health Indicator (Based on Operative Health) ----
        if (!healthEl || !elHealthBar) return; // Guard against race condition

        if (gananciaBrutaMes === 0) {
            healthEl.textContent = '⚪ Sin datos de margen API';
            elHealthBar.style.width = '0%';
            if (healthRatioPct) healthRatioPct.textContent = '0%';
        } else {
            const burdenPct = Math.min(100, Math.max(0, (gastoTotal / ventasMes) * 100));
            const margin = margenNetoPct.toFixed(1);

            setTimeout(() => { elHealthBar.style.width = burdenPct + '%'; }, 100);
            if (healthRatioPct) healthRatioPct.textContent = margin + '% final';

            if (burdenPct < 50) {
                healthEl.innerHTML = '🟢 Muy Saludable';
                elHealthBar.style.background = 'linear-gradient(90deg, #00ff66, #00a849)';
            } else if (burdenPct < 75) {
                healthEl.innerHTML = '🟡 Aceptable';
                elHealthBar.style.background = 'linear-gradient(90deg, #ffc233, #f59e0b)';
            } else if (burdenPct < 100) {
                healthEl.innerHTML = '🟠 En riesgo';
                elHealthBar.style.background = 'linear-gradient(90deg, #ffc233, #f97316)';
            } else {
                healthEl.innerHTML = '🔴 Pérdida Neta';
                elHealthBar.style.background = 'linear-gradient(90deg, #ff5a5a, #dc2626)';
            }
        }

        // (Resumen Operativo eliminado — no hay datos de workLogs)

        // ============================================================
        // CEO COCKPIT — Cálculos unificados del mes en curso y mes previo
        // ============================================================
        const productByName = new Map(
            allProducts.filter(p => p.name).map(p => [p.name.toLowerCase().trim(), p])
        );
        const buildProductStats = (salesArr) => {
            const stats = {};
            salesArr.forEach(sale => {
                if (!sale.items || !Array.isArray(sale.items)) return;
                sale.items.forEach(item => {
                    const name = (item.name || 'Desconocido').trim();
                    if (!stats[name]) stats[name] = { qty: 0, profit: 0, revenue: 0, tickets: new Set() };
                    const q = parseFloat(item.qty) || 1;
                    let profitLine = parseFloat(item.profit) || 0;
                    let priceUnitValue = parseFloat(item.price_unit) || 0;
                    let costUnitValue = parseFloat(item.cost_unit) || 0;
                    if (profitLine === 0 && priceUnitValue > 0) {
                        const localProduct = productByName.get(name.toLowerCase());
                        if (localProduct) {
                            costUnitValue = localProduct.costUnit || 0;
                            priceUnitValue = parseFloat(item.price_unit) || (parseFloat(item.price) / q);
                            profitLine = (priceUnitValue - costUnitValue) * q;
                        }
                    }
                    stats[name].qty += q;
                    stats[name].profit += profitLine;
                    stats[name].revenue += (parseFloat(item.price) || 0);
                    if (sale.ticket_id) stats[name].tickets.add(sale.ticket_id);
                });
            });
            return stats;
        };

        const currentMonthEleventa = eleventaSales.filter(s => s.date && s.date.startsWith(currentMonthStr));
        const productStats     = buildProductStats(currentMonthEleventa);
        const prevProductStats = buildProductStats(prevMonthEleventa);

        const allProductsArr = Object.entries(productStats).map(([name, v]) => {
            const marginPct = v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0;
            const prev = prevProductStats[name];
            const prevProfit = prev ? prev.profit : 0;
            return {
                name,
                qty: v.qty,
                profit: v.profit,
                revenue: v.revenue,
                marginPct,
                prevProfit,
                deltaProfit: v.profit - prevProfit
            };
        });

        // (Radar de Productos eliminado — ver análisis completo en Márgenes)
        // allProductsArr permanece disponible para las Alertas Inteligentes abajo.



        // ============================================================
        // ALERTAS INTELIGENTES
        // ============================================================
        const alerts = [];

        // Productos con margen bajo (< 5%) y volumen relevante
        const lowMargin = allProductsArr.filter(p => p.qty >= 5 && p.revenue > 0 && p.marginPct < 5 && p.marginPct >= 0)
            .sort((a, b) => a.marginPct - b.marginPct);
        if (lowMargin.length) {
            alerts.push({
                sev: 'med',
                icon: 'ph-magnet',
                color: '#f59e0b',
                html: `<b>${lowMargin.length}</b> con margen &lt;5%`,
                meta: `Peor: ${lowMargin[0].marginPct.toFixed(1)}%`,
                details: {
                    type: 'products',
                    items: lowMargin.slice(0, 15).map(p => ({
                        name: p.name,
                        right: `${p.marginPct.toFixed(1)}% · ${p.qty} uds`,
                        sub: `Factura ${window.Utils.formatCurrency(p.revenue, true)} · gana ${window.Utils.formatCurrency(p.profit, true)}`
                    }))
                }
            });
        }

        // Productos sin ganancia (margen < 1%)
        const zeroMarginAlerts = allProductsArr.filter(p => p.qty >= 1 && p.marginPct < 1)
            .sort((a, b) => b.qty - a.qty);
        if (zeroMarginAlerts.length) {
            alerts.push({
                sev: 'high',
                icon: 'ph-warning',
                color: '#dc2626',
                html: `<b>${zeroMarginAlerts.length}</b> sin costo cargado`,
                meta: 'Revisar Eleventa',
                details: {
                    type: 'products',
                    items: zeroMarginAlerts.slice(0, 15).map(p => ({
                        name: p.name,
                        right: `${p.qty} uds`,
                        sub: `Factura ${window.Utils.formatCurrency(p.revenue, true)} · gana ${window.Utils.formatCurrency(p.profit, true)}`
                    }))
                }
            });
        }

        // Productos SIN ventas >30 días (de catálogo local que tenían ventas antes)
        const now30 = new Date();
        now30.setDate(now30.getDate() - 30);
        const cutoff30 = now30.toISOString().split('T')[0];
        const soldRecently = new Set();
        eleventaSales.forEach(s => {
            if (s.date >= cutoff30 && s.items && Array.isArray(s.items)) {
                s.items.forEach(it => { if (it.name) soldRecently.add(it.name.toLowerCase().trim()); });
            }
        });
        const productsInCatalog = (allProducts || []).filter(p => !p.deleted && p.name && p.stock !== 0);
        const staleProducts = productsInCatalog.filter(p =>
            p.name && !soldRecently.has(p.name.toLowerCase().trim())
        );
        if (staleProducts.length > 5) {
            alerts.push({
                sev: 'low',
                icon: 'ph-snowflake',
                color: 'var(--text-muted)',
                html: `<b>${staleProducts.length}</b> sin venta en 30 días`,
                meta: 'Ver detalle',
                details: {
                    type: 'products',
                    items: staleProducts.slice(0, 15).map(p => ({
                        name: p.name,
                        right: p.stock ? `stock ${p.stock}` : '',
                        sub: p.costUnit ? `costo unit. ${window.Utils.formatCurrency(p.costUnit, true)}` : ''
                    }))
                }
            });
        }

        // Pago de Contadora (vence día 14 de cada mes)
        const accountantDueDay = 14;
        const currentMonthIntStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const hasPaidAccountantMonth = (allExpenses || []).some(e =>
            !e.deleted && e.category === 'Contabilidad' && e.date && e.date.startsWith(currentMonthIntStr)
        );
        if (!hasPaidAccountantMonth) {
            const dueDate = new Date(now.getFullYear(), now.getMonth(), accountantDueDay);
            const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueDate - todayMidnight) / 86400000);
            if (diffDays <= 5) {
                const msg = diffDays < 0
                    ? `<b>Pago contadora atrasado</b> ${Math.abs(diffDays)} día${Math.abs(diffDays) > 1 ? 's' : ''} (venció el 14)`
                    : diffDays === 0
                        ? `<b>Pago contadora vence HOY</b> (día 14)`
                        : `<b>Pago contadora</b> en ${diffDays} día${diffDays > 1 ? 's' : ''}`;
                alerts.push({
                    sev: diffDays < 0 ? 'high' : 'med',
                    icon: diffDays < 0 ? 'ph-warning-octagon' : 'ph-calendar-plus',
                    color: diffDays < 0 ? '#dc2626' : '#f97316',
                    html: msg,
                    meta: `<a href="#" onclick="event.preventDefault(); window._showAccountantQuickPay && window._showAccountantQuickPay();" style="color:inherit; text-decoration:underline;">Registrar</a>`
                });
            }
        }

        // Días con caída — desde Eleventa (agrupado por fecha local)
        const eleventaByDay = new Map();
        eleventaSales.filter(s => (s.date_local || s.date || '').substring(0, 7) === currentMonthStr).forEach(s => {
            const d = s.date_local || s.date.split('T')[0];
            eleventaByDay.set(d, (eleventaByDay.get(d) || 0) + (parseFloat(s.total) || 0));
        });
        const currentMonthDaily = Array.from(eleventaByDay.entries()).map(([date, total]) => ({ date, total }));

        if (currentMonthDaily.length >= 3) {
            const totals = currentMonthDaily.map(d => parseFloat(d.total) || 0).filter(t => t > 0);
            const avg = totals.reduce((s, x) => s + x, 0) / (totals.length || 1);
            const lowDays = currentMonthDaily.filter(d => {
                const t = parseFloat(d.total) || 0;
                return t > 0 && avg > 0 && ((avg - t) / avg) > 0.2;
            });
            if (lowDays.length >= 2) {
                const sortedLow = [...lowDays].sort((a, b) => new Date(b.date) - new Date(a.date));
                alerts.push({
                    sev: 'med',
                    icon: 'ph-trend-down',
                    color: '#f59e0b',
                    html: `<b>${lowDays.length} día${lowDays.length > 1 ? 's' : ''}</b> bajo promedio (${fmt(avg)}/día)`,
                    meta: `Último: ${sortedLow[0].date.slice(5)}`,
                    details: {
                        type: 'days',
                        items: sortedLow.slice(0, 15).map(d => {
                            const t = parseFloat(d.total) || 0;
                            const dropPct = ((avg - t) / avg) * 100;
                            return {
                                name: new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' }),
                                right: `${fmt(t)}`,
                                sub: `caída -${dropPct.toFixed(0)}% vs. promedio`
                            };
                        })
                    }
                });
            }
        }

        // Si no hay alertas
        const alertsList = document.getElementById('ceo-alerts-list');
        const alertsCount = document.getElementById('ceo-alerts-count');
        if (alertsList) {
            if (alerts.length === 0) {
                alertsList.innerHTML = `
                    <div class="ed-alert-item sev-low" style="border-color:rgba(34,197,94,0.3); background:rgba(34,197,94,0.05);">
                        <span class="ed-alert-icon" style="color:var(--color-success);">✔</span>
                        <div class="ed-alert-text">Sin alertas activas</div>
                    </div>`;
                if (alertsCount) { alertsCount.textContent = '0'; alertsCount.classList.add('zero'); }
            } else {
                alertsList.innerHTML = alerts.map((a, idx) => {
                    const hasDetails = a.details && a.details.items && a.details.items.length > 0;
                    const detailRows = hasDetails ? a.details.items.map(it => `
                        <div class="ed-alert-detail-row">
                            <div class="cd-main">
                                <div class="cd-name">${window.Utils.escapeHTML(it.name)}</div>
                                ${it.sub ? `<div class="cd-sub">${window.Utils.escapeHTML(it.sub)}</div>` : ''}
                            </div>
                            ${it.right ? `<div class="cd-right">${it.right}</div>` : ''}
                        </div>`).join('') : '';
                    return `
                    <div>
                        <div class="ed-alert-item sev-${a.sev} ${hasDetails ? 'expandable' : ''}" data-alert-idx="${idx}">
                            <i class="ph ${a.icon} ed-alert-icon" style="color:${a.color};"></i>
                            <div class="ed-alert-text">${a.html}</div>
                            <div class="ed-alert-meta">${a.meta}</div>
                            ${hasDetails ? '<i class="ph ph-caret-down ed-alert-caret"></i>' : ''}
                        </div>
                        ${hasDetails ? `
                            <div class="ed-alert-details" data-alert-details="${idx}">
                                ${detailRows}
                            </div>` : ''}
                    </div>`;
                }).join('');
                if (alertsCount) { alertsCount.textContent = alerts.length; alertsCount.classList.remove('zero'); }

                // Toggle expandible
                alertsList.querySelectorAll('.ed-alert-item.expandable').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('a')) return; // No romper links internos
                        const idx = item.dataset.alertIdx;
                        const details = alertsList.querySelector(`[data-alert-details="${idx}"]`);
                        if (details) {
                            const open = details.classList.toggle('open');
                            item.classList.toggle('open', open);
                        }
                    });
                });
            }
            // CTA Márgenes al pie del panel de alertas — removed (now integrated in Operación section)
        }

        // ============================================================
        // PANEL DE DECISIONES (4 widgets compactos)
        // ============================================================
        try {

            // 1. QUÉ COMPRAR — basado en velocidad de venta actual vs mes anterior
            const daysElapsed = Math.max(now.getDate(), 1);
            const daysInPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
            const buyAnalysis = allProductsArr
                .filter(p => p.qty >= 3) // mínimo 3 vendidos para ser relevante
                .map(p => {
                    const dailyRate = p.qty / daysElapsed;
                    const prev = prevProductStats[p.name];
                    const prevQty = prev ? prev.qty : 0;
                    const prevDailyRate = daysInPrevMonth > 0 ? prevQty / daysInPrevMonth : 0;
                    // Proyección: cuánto necesitarás para el resto del mes
                    const daysRemaining = Math.max(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - daysElapsed, 0);
                    const projected = Math.ceil(dailyRate * daysRemaining);
                    // Aceleración: cuánto más rápido se vende vs mes pasado
                    const rawAcceleration = prevDailyRate > 0 ? ((dailyRate - prevDailyRate) / prevDailyRate) * 100 : (dailyRate > 0 ? 100 : 0);
                    const acceleration = Math.min(rawAcceleration, 200);
                    return { ...p, dailyRate, prevQty, prevDailyRate, projected, acceleration };
                })
                .sort((a, b) => {
                    // Prioridad: productos acelerando con alto volumen
                    const scoreA = a.dailyRate * (1 + Math.max(a.acceleration, 0) / 100);
                    const scoreB = b.dailyRate * (1 + Math.max(b.acceleration, 0) / 100);
                    return scoreB - scoreA;
                })
                .slice(0, 5);
            const decBuyEl = document.getElementById('dec-buy-list');
            if (decBuyEl) {
                decBuyEl.innerHTML = buyAnalysis.length ? buyAnalysis.map(p => {
                    let badge = '';
                    if (p.acceleration >= 200) {
                        badge = `<span style="color:#ef4444; font-weight:700; font-size:0.72rem;">🔥 x${(p.dailyRate / Math.max(p.prevDailyRate, 0.1)).toFixed(1)}</span>`;
                    } else if (p.acceleration > 30) {
                        badge = `<span style="color:#ef4444; font-weight:700; font-size:0.72rem;">↑${Math.round(p.acceleration)}%</span>`;
                    } else if (p.acceleration > 0) {
                        badge = `<span style="color:#f97316; font-weight:600; font-size:0.72rem;">↑${Math.round(p.acceleration)}%</span>`;
                    } else {
                        badge = `<span style="color:#6b7280; font-size:0.72rem;">${Math.round(p.dailyRate)}/día</span>`;
                    }
                    return `<div style="display:flex; justify-content:space-between; align-items:center;" title="Vendido: ${p.qty} uds (${Math.round(p.dailyRate)}/día) · Mes ant: ${p.prevQty} uds · Faltan ~${p.projected} uds para el mes">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;">${window.Utils.escapeHTML(p.name)}</span>
                        ${badge}
                    </div>`;
                }).join('') : '<span class="text-muted">Sin datos de ventas</span>';
            }

            // 2. SUBIR PRECIO — alto volumen + margen bajo (oportunidad)
            const priceUp = allProductsArr
                .filter(p => p.qty >= 5 && p.marginPct > 0 && p.marginPct < 15)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);
            const decPriceEl = document.getElementById('dec-price-list');
            if (decPriceEl) {
                decPriceEl.innerHTML = priceUp.length ? priceUp.map(p =>
                    `<div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;">${window.Utils.escapeHTML(p.name)}</span>
                        <span style="color:#f59e0b; font-weight:700;">${p.marginPct.toFixed(0)}%</span>
                    </div>`
                ).join('') : '<span class="text-muted">Todos sobre 15%</span>';
            }

            // 3. DÍA MÁS FLOJO — promedio por día de la semana
            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const dayTotals = [0,0,0,0,0,0,0], dayCounts = [0,0,0,0,0,0,0];
            eleventaSales.forEach(s => {
                if (!s.date) return;
                const d = window.Utils.parseLocalDate(s.date);
                if (d) {
                    const total = parseFloat(s.total) || 0;
                    if (total > 0) { dayTotals[d.getDay()] += total; dayCounts[d.getDay()]++; }
                }
            });
            const dayAvgs = dayTotals.map((t, i) => dayCounts[i] > 0 ? t / dayCounts[i] : 0);
            const bestDay = dayAvgs.indexOf(Math.max(...dayAvgs));
            const worstDay = dayAvgs.indexOf(Math.min(...dayAvgs.filter(a => a > 0)));
            const decDayEl = document.getElementById('dec-day-content');
            if (decDayEl && dayAvgs.some(a => a > 0)) {
                decDayEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#ef4444; font-weight:700; font-size:1.1rem;">${dayNames[worstDay]}</span>
                            <span>${fmt(Math.round(dayAvgs[worstDay]))}/día</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; opacity:0.7;">
                            <span style="color:#10b981; font-weight:600;">Mejor: ${dayNames[bestDay]}</span>
                            <span>${fmt(Math.round(dayAvgs[bestDay]))}/día</span>
                        </div>
                        <div style="display:flex; gap:2px; margin-top:4px;">
                            ${dayAvgs.map((avg, i) => {
                                const maxAvg = Math.max(...dayAvgs);
                                const pct = maxAvg > 0 ? (avg / maxAvg * 100) : 0;
                                const color = i === worstDay ? '#ef4444' : i === bestDay ? '#10b981' : '#cbd5e1';
                                return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                                    <div style="width:100%; height:30px; background:#f1f5f9; border-radius:3px; position:relative; overflow:hidden;">
                                        <div style="position:absolute; bottom:0; width:100%; height:${pct}%; background:${color}; border-radius:3px;"></div>
                                    </div>
                                    <span style="font-size:0.72rem; color:var(--text-muted);">${dayNames[i][0]}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>`;
            }

            // 4. FLUJO PRÓXIMO — caja neta proyectada (ventas promedio - pagos pendientes)
            const activeDays = dayAvgs.filter(a => a > 0).length || 1;
            const avgDailySales = dayAvgs.reduce((a, b) => a + b, 0) / activeDays;
            const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
            const projectedIncome = Math.round(avgDailySales * daysLeft);
            // Pagos pendientes: facturas crédito + sueldos estimados
            const pendingInvoices = invoices.filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente');
            const pendingTotal = pendingInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            const monthlyPayroll = employees.reduce((s, e) => s + (parseFloat(e.baseSalary) || 0), 0);
            const netFlow = projectedIncome - pendingTotal - monthlyPayroll;
            const decCashEl = document.getElementById('dec-cash-content');
            if (decCashEl) {
                decCashEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span>Ingreso est. (${daysLeft}d)</span>
                            <b style="color:#10b981;">${fmt(projectedIncome)}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Facturas pend.</span>
                            <b style="color:#ef4444;">-${fmt(pendingTotal)}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>Sueldos</span>
                            <b style="color:#ef4444;">-${fmt(monthlyPayroll)}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(0,0,0,0.1); padding-top:4px; margin-top:2px;">
                            <span style="font-weight:700;">Neto est.</span>
                            <b style="color:${netFlow >= 0 ? '#10b981' : '#ef4444'}; font-size:0.9rem;">${fmt(netFlow)}</b>
                        </div>
                    </div>`;
            }
        } catch (e) { console.warn('Error panel decisiones:', e); }

        // ============================================================
        // FORMA DE PAGO (Donut) — desde eleventa_sales del mes
        // ============================================================
        const pagoBuckets = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Crédito: 0, Mixto: 0 };
        let tarjetaBrutaDonut = 0;
        currentMonthEleventa.forEach(s => {
            const total = parseFloat(s.total) || 0;
            if (total <= 0) return;
            const forma = (s.forma_pago || '').toLowerCase();
            if (forma.includes('transfer')) pagoBuckets.Transferencia += total;
            else if (forma.includes('tarjeta') || forma.includes('debito')) { pagoBuckets.Tarjeta += total; tarjetaBrutaDonut += total; }
            else if (forma.includes('credito') || forma.includes('fiado') || forma.includes('vale')) pagoBuckets['Crédito'] += total;
            else if (forma.includes('mixto')) pagoBuckets.Mixto += total;
            else pagoBuckets.Efectivo += total;
        });
        // Descontar comisión MP del bucket Tarjeta para reflejar ingreso real
        const comisionDonut = Math.round(tarjetaBrutaDonut * COMISION_MP);
        pagoBuckets.Tarjeta = Math.max(0, pagoBuckets.Tarjeta - comisionDonut);
        const pagoTotal = Object.values(pagoBuckets).reduce((s, x) => s + x, 0) || 1;
        const pagoColors = {
            Efectivo: '#10b981',
            Tarjeta: '#3b82f6',
            Transferencia: '#8b5cf6',
            'Crédito': '#f59e0b',
            Mixto: '#6b7280'
        };

        const pagoLegend = document.getElementById('ceo-payment-legend');
        if (pagoLegend) {
            const entries = Object.entries(pagoBuckets)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a);
            if (entries.length === 0) {
                pagoLegend.innerHTML = '<span class="text-muted text-xs">Sin datos este mes</span>';
            } else {
                pagoLegend.innerHTML = entries.map(([k, v]) => {
                    const pct = (v / pagoTotal) * 100;
                    return `<div class="leg-row">
                        <span class="leg-label"><span class="leg-dot" style="background:${pagoColors[k]};"></span>${k}</span>
                        <span class="leg-pct">${pct.toFixed(0)}%</span>
                    </div>`;
                }).join('');
            }
        }

        // Donut con Chart.js
        const donutCtx = document.getElementById('paymentDonut');
        if (donutCtx) {
            const existing = Chart.getChart('paymentDonut');
            if (existing) existing.destroy();
            const entries = Object.entries(pagoBuckets).filter(([, v]) => v > 0);
            if (entries.length > 0) {
                new Chart(donutCtx, {
                    type: 'doughnut',
                    data: {
                        labels: entries.map(([k]) => k),
                        datasets: [{
                            data: entries.map(([, v]) => v),
                            backgroundColor: entries.map(([k]) => pagoColors[k]),
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: false,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)}`
                                }
                            }
                        }
                    }
                });
            }
        }

        // ============================================================
        // CAJA REAL DEL MES (Ingresos − Egresos)
        //   Ingresos = ventas efectivo/transferencia + entradas de flujo_caja
        //   Egresos  = salidas + devoluciones de flujo_caja
        // ============================================================
        let entradasTotal = 0, salidasTotal = 0, devolucionesTotal = 0;
        try {
            const syncClient = window.SyncV2?.client;
            if (syncClient) {
                const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
                const { data: flujoData } = await syncClient.from('eleventa_flujo_caja')
                    .select('fecha,monto,tipo')
                    .gte('fecha', `${currentMonthStr}-01`)
                    .lt('fecha', nextMonthStr);
                if (flujoData) {
                    flujoData.forEach(f => {
                        const monto = Math.abs(parseFloat(f.monto) || 0);
                        const tipo = (f.tipo || '').toLowerCase();
                        if (tipo === 'entrada') entradasTotal += monto;
                        else if (tipo === 'salida') salidasTotal += monto;
                        // Ignorar devoluciones/repasados: tickets cancelados cuyo total=0
                        // ya se excluye de ventas, no hay que restar nada adicional.
                        else if (tipo === 'repasado' || tipo === 'devolucion' || tipo === 'devolución') { /* ignorar */ }
                    });
                }
            }
        } catch (e) { console.warn('No se pudo cargar flujo_caja para caja real:', e); }

        const ingresosCash = pagoBuckets.Efectivo + pagoBuckets.Transferencia; // dinero que entra "real"
        const ingresosTotal = ingresosCash + entradasTotal;
        const egresosTotal = salidasTotal + devolucionesTotal;
        const cajaNeta = ingresosTotal - egresosTotal;

        const cashValEl = document.getElementById('ceo-cash-net');
        const cashBreakdown = document.getElementById('ceo-cash-breakdown');
        const cashSub = document.getElementById('ceo-cash-sub');
        if (cashValEl) {
            cashValEl.innerHTML = fmt(cajaNeta);
            cashValEl.style.color = cajaNeta >= 0 ? '#059669' : '#dc2626';
        }
        if (cashSub) cashSub.innerHTML = `${fmt(ingresosTotal)} ingresos − ${fmt(egresosTotal)} egresos`;
        if (cashBreakdown) {
            cashBreakdown.innerHTML = `
                <div class="row"><span class="text-muted">Ventas efectivo + transf.</span><b style="color:#059669;">${fmt(ingresosCash)}</b></div>
                <div class="row"><span class="text-muted">Entradas caja</span><b style="color:#059669;">${fmt(entradasTotal)}</b></div>
                <div class="row"><span class="text-muted">Salidas caja</span><b style="color:#dc2626;">−${fmt(salidasTotal)}</b></div>
            `;
        }

        // ============================================================
        // TICKET PROMEDIO + TENDENCIA
        // ============================================================
        const validToday = todayEleventa.filter(s => parseFloat(s.total) > 0);
        const avgToday = validToday.length > 0
            ? validToday.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) / validToday.length
            : 0;

        const validMonth = currentMonthEleventa.filter(s => parseFloat(s.total) > 0);
        const avgMonth = validMonth.length > 0
            ? validMonth.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) / validMonth.length
            : 0;

        const validPrev = prevMonthEleventa.filter(s => parseFloat(s.total) > 0);
        const avgPrev = validPrev.length > 0
            ? validPrev.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) / validPrev.length
            : 0;

        const avgTicketEl = document.getElementById('ceo-avg-ticket');
        const avgSubEl = document.getElementById('ceo-avg-ticket-sub');
        const avgFootEl = document.getElementById('ceo-avg-ticket-foot');
        if (avgTicketEl) avgTicketEl.innerHTML = fmt(avgMonth);
        if (avgSubEl) avgSubEl.innerHTML = `${validMonth.length} tickets este mes · hoy ${fmt(avgToday)}`;
        if (avgFootEl) {
            if (avgPrev > 0) {
                const delta = ((avgMonth - avgPrev) / avgPrev) * 100;
                const cls = Math.abs(delta) < 1 ? 'flat' : (delta > 0 ? 'up' : 'down');
                const arrow = Math.abs(delta) < 1 ? '=' : (delta > 0 ? '▲' : '▼');
                avgFootEl.innerHTML = `<span class="ceo-delta ${cls}">${arrow} ${Math.abs(delta).toFixed(1)}% vs ${prevMonthDate.toLocaleDateString('es-ES', { month: 'long' })}</span>`;
            } else {
                avgFootEl.innerHTML = `<span class="ceo-delta flat">sin histórico previo</span>`;
            }
        }

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
                        <span style="font-size:0.83rem;font-weight:600;color:var(--text-primary);">${Utils.escapeHTML(supplierMap[id] || 'Desconocido')}</span>
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
        // Pre-agrupar eleventa_sales por mes (una sola pasada)
        const elevByMonth = new Map();
        eleventaSales.forEach(s => {
            if (!s.date) return;
            const ms = s.date.substring(0, 7);
            elevByMonth.set(ms, (elevByMonth.get(ms) || 0) + (parseFloat(s.total) || 0));
        });

        // Pre-agrupar facturas por mes (una sola pasada, en vez de 6 filter+reduce)
        const invByMonth = new Map();
        invoices.forEach(inv => {
            if (!inv.date) return;
            const k = inv.date.substring(0, 7);
            invByMonth.set(k, (invByMonth.get(k) || 0) + (parseFloat(inv.amount) || 0));
        });

        const months6Labels = [];
        const months6Sales = [];
        const months6Costs = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months6Labels.push(d.toLocaleDateString('es-ES', { month: 'short' }));
            // Eleventa primero; fallback a daily_sales para meses históricos previos a Eleventa
            months6Sales.push(elevByMonth.get(mStr) || dailySales.filter(s => s.date && s.date.startsWith(mStr)).reduce((s, d) => s + (parseFloat(d.total) || 0), 0));
            months6Costs.push(invByMonth.get(mStr) || 0);
        }


        const plCtx = document.getElementById('plChart').getContext('2d');
        const plGradientV = plCtx.createLinearGradient(0, 0, 0, 250);
        plGradientV.addColorStop(0, 'rgba(76,141,255,0.30)');
        plGradientV.addColorStop(1, 'rgba(76,141,255,0)');

        const plGradientG = plCtx.createLinearGradient(0, 0, 0, 250);
        plGradientG.addColorStop(0, 'rgba(148,163,184,0.18)');
        plGradientG.addColorStop(1, 'rgba(148,163,184,0)');

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
                        borderColor: '#4c8dff',
                        backgroundColor: plGradientV,
                        fill: true, tension: 0.4, pointRadius: 4,
                        borderWidth: 3, pointBackgroundColor: '#0e1117',
                        pointBorderWidth: 2, pointBorderColor: '#4c8dff'
                    },
                    {
                        label: 'Compras',
                        data: months6Costs,
                        borderColor: '#94a3b8',
                        backgroundColor: plGradientG,
                        fill: true, tension: 0.4, pointRadius: 4,
                        borderWidth: 2, pointBackgroundColor: '#0e1117',
                        pointBorderWidth: 2, pointBorderColor: '#94a3b8'
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

        // (Gráfico de Distribución por Hora eliminado — usaba datos aleatorios, no reales)

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

        // Build real sparkline data from last 6 months
        const sparkMonths = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            sparkMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const sparkVentas = sparkMonths.map(m => elevByMonth.get(m) || 0);
        const sparkGastos = sparkMonths.map(m => {
            return allExpenses.filter(e => !e.deleted && e.date && e.date.startsWith(m))
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        });
        createSpark('spark-ventas', sparkVentas, '#4c8dff');
        createSpark('spark-gastos', sparkGastos, '#ef4444');

        // ── Terminal ticker (estilo Bloomberg): nº + delta ▲▼ + sparkline ──
        (function renderTerminalTicker() {
            const elT = document.getElementById('terminal-ticker');
            if (!elT) return;
            const resultado = sparkVentas.map((v, i) => v - (sparkGastos[i] || 0));
            const rows = [
                { k: 'VENTAS', s: sparkVentas, invert: false },
                { k: 'GASTOS', s: sparkGastos, invert: true },
                { k: 'RESULTADO', s: resultado, invert: false }
            ];
            let html = '<div class="term-ticker"><div class="term-ticker-head"><span>&#9679; MES EN CURSO &middot; 6M</span><span class="blink">_</span></div>';
            rows.forEach(r => {
                const cur = r.s[r.s.length - 1] || 0, prev = r.s[r.s.length - 2] || 0;
                const d = wmDelta(cur, prev);
                const cls = d.up === null ? 'flat' : (r.invert ? (d.up ? 'warn' : 'up') : (d.up ? 'up' : 'down'));
                html += `<div class="term-row"><span class="term-label">${r.k}</span><span class="term-spark">${wmSpark(r.s)}</span><span class="term-val">${wmCompact(cur)}</span><span class="term-delta ${cls}">${d.arrow} ${d.pct}</span></div>`;
            });
            html += '</div>';
            elT.innerHTML = html;
        })();

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
            creditEl.innerHTML = '<p style="color:#10b981;font-weight:600;">✅ Sin deudas a crédito</p>';
        } else {
            creditEl.innerHTML = `
                <div style="font-size:1.2rem;font-weight:700;color:#d97706;">${fmt(totalCredit)}</div>
                    <div style="font-size:0.82rem;color:var(--text-muted);">${creditPending.length} factura${creditPending.length > 1 ? 's' : ''} pendiente${creditPending.length > 1 ? 's' : ''}</div>
                ${overdue.length ? `<div style="color:#dc2626;font-weight:700;font-size:0.82rem;margin-top:4px;">🚨 ${overdue.length} vencida${overdue.length > 1 ? 's' : ''}</div>` : ''}
                ${dueSoon.length ? `<div style="color:#ea580c;font-size:0.8rem;margin-top:2px;">⏰ ${dueSoon.length} vence esta semana</div>` : ''}
            `;
        }
        document.getElementById('credit-widget').addEventListener('click', () => {
            document.querySelector('[data-view="purchase_invoices"]')?.click();
        });

        // ---- Expiry Alerts ----
        const expiringSoon = products.filter(p => {
            if (!p.expiryDate) return false;
            return (new Date(p.expiryDate) - now) / 86400000 <= 30;
        }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

        const expiryContainer = document.getElementById('expiry-alerts-container');
        if (expiryContainer && expiringSoon.length > 0) {
            expiryContainer.classList.remove('hidden');
            document.getElementById('expiry-alerts-list').innerHTML = expiringSoon.map(p => {
                const diff = Math.ceil((new Date(p.expiryDate) - now) / 86400000);
                const col = diff <= 7 ? 'var(--danger)' : '#f59e0b';
                return `<div style="padding:10px;border:1px solid rgba(0,0,0,0.05);border-radius:8px;display:flex;align-items:center;gap:10px;background:var(--bg-card);">
                    <i class="ph ${diff <= 7 ? 'ph-prohibit' : 'ph-clock-countdown'}" style="font-size:1.4rem;color:${col};"></i>
                    <div>
                        <div style="font-weight:700;font-size:0.88rem;">${window.Utils.escapeHTML(p.name)}</div>
                        <div style="font-size:0.75rem;color:${col};font-weight:600;">Vence en ${diff} días</div>
                    </div>
                </div>`;
            }).join('');
        }

        // Pago Contadora quick-register (usado por alerta en Alertas Inteligentes)
        window._showAccountantQuickPay = () => {
            const val = prompt('Ingresa el monto pagado a la contadora:', '0');
            const amount = parseFloat(val);
            if (!isNaN(amount) && amount > 0) {
                const today = new Date().toISOString().split('T')[0];
                window.DataManager.saveAndSync('expenses', {
                    title: 'Pago Contadora - ' + new Date().toLocaleDateString('es-ES', { month: 'long' }),
                    amount: amount,
                    category: 'Contabilidad',
                    date: today,
                    deleted: false
                }).then(res => {
                    if (res.success) {
                        window.showToast('Pago registrado correctamente.', 'success');
                        window.Views.dashboard(container); // Refresh
                    }
                });
            }
        };

        // ── NUEVAS SECCIONES EDITORIALES ──

        // ① Health Score (franja header + círculo)
        const healthCtx = {
            ventasMes, ventasPrev, utilidadNetaMonto, gastoTotal,
            products, invoices,
            eleventaSales, currentMonthStr
        };
        const healthResult = computeHealthScore(healthCtx);
        const hsNum = document.getElementById('ed-health-score-num');
        const hsHeader = document.getElementById('ed-health-score-header');
        const hsCircle = document.getElementById('ed-health-circle');
        const hsFactors = document.getElementById('ed-health-factors');
        if (hsNum) hsNum.textContent = healthResult.score;
        if (hsHeader) hsHeader.textContent = healthResult.score + '/100';
        const scoreColor = healthResult.score >= 75 ? 'var(--color-success)' : healthResult.score >= 50 ? 'var(--color-warning)' : 'var(--danger)';
        if (hsCircle) hsCircle.style.borderColor = scoreColor;
        if (hsNum) hsNum.style.color = scoreColor;
        if (hsFactors) {
            hsFactors.innerHTML = healthResult.factors.map(f => `
                <div class="ed-factor-row">
                    <span class="ed-factor-icon" style="color:${f.estado === 'ok' ? 'var(--color-success)' : 'var(--color-warning)'};">
                        ${f.estado === 'ok' ? '✔' : '⚠'}
                    </span>
                    <span class="ed-factor-name">${f.nombre}</span>
                    <span class="ed-factor-pts">${f.pts}/${f.max}</span>
                </div>`).join('');
        }

        // ④ Acciones recomendadas
        const recs = computeRecommendations(products, eleventaSales, invoices);
        const recList = document.getElementById('ed-rec-list');
        if (recList) {
            if (recs.length === 0) {
                recList.innerHTML = '<div style="color:var(--text-muted); font-size:0.82rem; padding:8px 0;">Sin acciones críticas detectadas.</div>';
            } else {
                recList.innerHTML = recs.map(r => `
                    <div class="ed-rec-item">
                        <span class="ed-rec-chip ed-chip-${r.urgencia}">${r.urgencia}</span>
                        <span class="ed-rec-title">${window.Utils.escapeHTML(r.titulo)}</span>
                        <span class="ed-rec-tipo">${r.tipo}</span>
                        <span class="ed-rec-impact">+${wmCompact(r.impacto)}</span>
                    </div>`).join('');
            }
        }

        // ⑤ Narrativa ventas inline (debajo del gráfico)
        const salesNarrative = document.getElementById('ed-sales-narrative');
        if (salesNarrative) {
            const deltaV = wmDelta(ventasMes, ventasPrev);
            const deltaG = wmDelta(gastoTotal, gastoPrev);
            const margenColor = margenNetoPct >= 15 ? 'var(--color-success)' : margenNetoPct >= 5 ? 'var(--color-warning)' : 'var(--danger)';
            salesNarrative.innerHTML = `
                <div class="ed-narrative-row">
                    <span class="ed-nar-label">Ventas del mes</span>
                    <span class="ed-nar-val">${fmt(ventasMes)} <span style="font-size:0.72rem; color:${deltaV.up ? 'var(--color-success)' : 'var(--danger)'};">${deltaV.arrow} ${deltaV.pct}</span></span>
                </div>
                <div class="ed-narrative-row">
                    <span class="ed-nar-label">Gastos</span>
                    <span class="ed-nar-val">${fmt(gastoTotal)} <span style="font-size:0.72rem; color:${deltaG.up ? 'var(--danger)' : 'var(--color-success)'};">${deltaG.arrow} ${deltaG.pct}</span></span>
                </div>
                <div class="ed-narrative-row">
                    <span class="ed-nar-label">Utilidad neta</span>
                    <span class="ed-nar-val" style="color:${margenColor};">${fmt(utilidadNetaMonto)} <span style="font-size:0.72rem;">(${margenNetoPct.toFixed(1)}%)</span></span>
                </div>`;
        }

        // ⑥ Caja y Flujo — llenar celdas editoriales
        const edCajaDisp = document.getElementById('ed-caja-disp');
        if (edCajaDisp) {
            edCajaDisp.innerHTML = fmt(cajaNeta);
            edCajaDisp.style.color = cajaNeta >= 0 ? 'var(--color-success)' : 'var(--danger)';
        }
        const edIngresosEsp = document.getElementById('ed-ingresos-esp');
        const edIngEspSub   = document.getElementById('ed-ingresos-sub');
        if (edIngresosEsp) edIngresosEsp.innerHTML = fmt(projectedIncome);
        if (edIngEspSub) edIngEspSub.textContent = `${daysLeft} días restantes`;

        const pendInvoicesEd = invoices.filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente');
        const pendTotalEd    = pendInvoicesEd.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const payrollEd      = employees.reduce((s, e) => s + (parseFloat(e.baseSalary) || 0), 0);
        const edPagosPend    = document.getElementById('ed-pagos-pend');
        const edPagosSub     = document.getElementById('ed-pagos-sub');
        if (edPagosPend) { edPagosPend.innerHTML = fmt(pendTotalEd + payrollEd); edPagosPend.style.color = 'var(--danger)'; }
        if (edPagosSub) edPagosSub.textContent = `${pendInvoicesEd.length} facturas + sueldos`;

        // ⑧ Alertas accionables con $
        const actionableAlerts = computeActionableAlerts(products, eleventaSales);
        const edActAlerts = document.getElementById('ed-actionable-alerts');
        if (edActAlerts && actionableAlerts.length > 0) {
            edActAlerts.innerHTML = actionableAlerts.slice(0, 5).map(a => `
                <div class="ed-alert-item sev-high">
                    <span class="ed-alert-icon" style="color:var(--danger);">⚠</span>
                    <span class="ed-alert-text">${window.Utils.escapeHTML(a.msg)}</span>
                    <span class="ed-alert-meta">${wmCompact(a.impacto)}/mes</span>
                </div>`).join('');
        }

        // ---- (Actividad Reciente removed) ----

        // ---- Export Excel ----
        document.getElementById('btn-export-excel').addEventListener('click', async () => {
            const btn = document.getElementById('btn-export-excel');
            btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Preparando...'; btn.disabled = true;
            try {
                await window.lazyLoadScript('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');
                const [allEmps, lgs, prods] = await Promise.all([window.db.employees.toArray(), window.db.workLogs.toArray(), window.db.products.toArray()]);
                const emps = allEmps.filter(e => !e.deleted);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(e => ({ ID: e.id, Nombre: e.name, Rol: e.role, Salario: e.baseSalary || 0 }))), 'Personal');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lgs.filter(l => !l.deleted).map(l => { const e = emps.find(x => x.id === l.employeeId); return { Empleado: e?.name || 'Eliminado', Fecha: l.date, Horas: l.totalHours, Pago: l.payAmount }; })), 'Asistencia');
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prods.map(p => ({ Nombre: p.name, Costo: p.costUnit, Precio: p.salePrice, Stock: p.stock || 0 }))), 'Inventario');
                XLSX.writeFile(wb, `Reporte_ElMaravilloso_${todayStr}.xlsx`);
            } catch (err) { window.showToast('Error: ' + err.message, 'error'); }
            finally { btn.innerHTML = '<i class="ph ph-file-xls" style="font-size:1.1rem;"></i> <span class="hide-mobile">Exportar Excel</span>'; btn.disabled = false; }
        });

        // ── LISTENER: Actualizar Dashboard en tiempo real cuando hay cambios en Supabase ──
        // Usa debounce de 500ms para no re-renderizar si llegan varios eventos seguidos

        // Limpiar listener anterior para evitar acumulación en visitas repetidas
        if (window._dashboardSyncHandler) {
            document.removeEventListener('sync-data-updated', window._dashboardSyncHandler);
            window._dashboardSyncHandler = null;
        }
        if (window._dashRefreshTimer) {
            clearTimeout(window._dashRefreshTimer);
            window._dashRefreshTimer = null;
        }
        if (window._dashboardObserver) {
            window._dashboardObserver.disconnect();
            window._dashboardObserver = null;
        }

        window._dashboardSyncHandler = (event) => {
            const changedTables = event.detail?.tables || [];
            // Si no hay tablas especificadas, no refrescar (evita renders vacíos)
            if (changedTables.length === 0) return;
            // Refrescar solo si cambiaron las tablas clave del dashboard
            const relevantTables = ['daily_sales', 'expenses', 'employees', 'products', 'workLogs', 'purchase_invoices', 'eleventa_sales', 'suppliers', 'reminders', 'loans'];
            if (!changedTables.some(t => relevantTables.includes(t))) return;

            // CRÍTICO: Verificar que el Dashboard es lo que está visible AHORA.
            // container (#view-container) siempre está en el DOM, así que solo verificar
            // con isConnected no es suficiente — hay que confirmar que el contenido
            // actual es el dashboard y no otra vista (ej. facturas).
            const isDashboardVisible = !!document.getElementById('kpi-ventas-mes') ||
                                       !!document.getElementById('tab-resumen');
            if (!isDashboardVisible) return;

            // Throttle: refrescar máximo cada 3s aunque sigan llegando datos en ráfaga.
            // El debounce puro (clearTimeout + setTimeout) nunca ejecuta si los eventos
            // llegan más rápido que el delay, dejando el dashboard congelado.
            const now = Date.now();
            const MIN_INTERVAL = 3000;
            if (!window._dashLastRefresh) window._dashLastRefresh = 0;

            if (now - window._dashLastRefresh >= MIN_INTERVAL) {
                // Ya pasó suficiente tiempo, refrescar inmediato
                window._dashLastRefresh = now;
                if (window._dashRefreshTimer) { clearTimeout(window._dashRefreshTimer); window._dashRefreshTimer = null; }
                window.Views.dashboard(container, selectedMonth);
            } else if (!window._dashRefreshTimer) {
                // Programar un refresh para cuando se cumpla el intervalo
                const delay = MIN_INTERVAL - (now - window._dashLastRefresh);
                window._dashRefreshTimer = setTimeout(() => {
                    window._dashRefreshTimer = null;
                    window._dashLastRefresh = Date.now();
                    if (!document.getElementById('kpi-ventas-mes') && !document.getElementById('tab-resumen')) return;
                    window.Views.dashboard(container, selectedMonth);
                }, delay);
            }
        };
        document.addEventListener('sync-data-updated', window._dashboardSyncHandler);

        // Cleanup: remover listener si el container cambia de vista
        const observerTarget = container.parentNode || document.body;
        window._dashboardObserver = new MutationObserver(() => {
            // Si los elementos del dashboard ya no están, cleanup
            if (!document.getElementById('kpi-ventas-mes') && !document.getElementById('tab-resumen')) {
                if (window._dashRefreshTimer) { clearTimeout(window._dashRefreshTimer); window._dashRefreshTimer = null; }
                if (window._dashboardSyncHandler) {
                    document.removeEventListener('sync-data-updated', window._dashboardSyncHandler);
                    window._dashboardSyncHandler = null;
                }
                if (window._dashboardObserver) {
                    window._dashboardObserver.disconnect();
                    window._dashboardObserver = null;
                }
            }
        });
        window._dashboardObserver.observe(container, { childList: true, subtree: false });

    } catch (e) {
        console.error('Dashboard error:', e);
        if (container && container.isConnected) {
            container.innerHTML += `<p style="color:red;">Error cargando datos: ${window.Utils.escapeHTML(e.message)}</p>`;
        }
    }
};

// ---- Helper: render % badge ----
function renderBadge(id, current, prev, invertGood) {
    const el = document.getElementById(id);
    if (!el) return;
    if (prev === 0) { el.className = 'status-badge status-paid'; el.innerHTML = 'Nuevos datos'; return; }
    const pct = ((current - prev) / prev * 100).toFixed(1);
    const isUp = current > prev;
    // invertGood=true means UP is BAD (gastos), false means UP is GOOD (ventas)
    const good = invertGood ? !isUp : isUp;
    el.className = `status-badge ${good ? 'status-paid' : 'status-overdue'}`;
    el.innerHTML = `<i class="ph ph-trend-${isUp ? 'up' : 'down'}"></i> ${isUp ? '+' : ''}${pct}% vs mes ant.`;
}


