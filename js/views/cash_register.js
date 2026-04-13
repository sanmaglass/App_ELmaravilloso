// Cash Register View (Arqueo de Caja)
window.Views = window.Views || {};

window.Views.cash_register = async (container) => {
    container.innerHTML = `
        <style>
            .caja-kpi-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:24px; }
            .caja-kpi { padding:18px; border-radius:16px; position:relative; overflow:hidden; transition:all 0.3s ease; }
            .caja-kpi:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.1); }
            .caja-kpi-label { font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
            .caja-kpi-value { font-size:1.6rem; font-weight:800; line-height:1.2; }
            .caja-kpi-sub { font-size:0.75rem; margin-top:6px; opacity:0.8; }
            .caja-movement { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border); transition:all 0.2s; gap:12px; flex-wrap:wrap; }
            .caja-movement:hover { transform:translateX(4px); border-color:rgba(0,0,0,0.1); box-shadow:0 4px 12px rgba(0,0,0,0.05); }
            .caja-badge { padding:3px 10px; border-radius:20px; font-size:0.72rem; font-weight:700; white-space:nowrap; }
            .caja-icon-wrap { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }
            .caja-arqueo-card { background:linear-gradient(135deg, #1e293b, #0f172a); color:white; border-radius:20px; padding:24px; margin-bottom:24px; border:1px solid rgba(255,255,255,0.1); }
            .caja-arqueo-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.9rem; }
            .caja-arqueo-row:last-child { border-bottom:none; }
            .caja-diff-ok { color:#10b981; }
            .caja-diff-bad { color:#ef4444; }
            @media (max-width: 600px) {
                .caja-kpi-grid { grid-template-columns: 1fr 1fr; gap:10px; }
                .caja-kpi-value { font-size:1.2rem; }
                .caja-kpi { padding:14px; }
            }
        </style>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-vault" style="color:var(--primary);"></i> Arqueo de Caja
                </h1>
                <p style="color:var(--text-muted);">Control de efectivo: entradas, salidas, extracciones y cuadre</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary" id="btn-cash-extraction">
                    <i class="ph ph-arrow-square-out"></i> Registrar Extracción
                </button>
                <button class="btn btn-secondary" id="btn-cash-arqueo" style="background:linear-gradient(135deg, #1e293b, #334155); color:white; border:none;">
                    <i class="ph ph-scales"></i> Hacer Arqueo
                </button>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters-bar" style="margin-bottom:20px;">
            <select id="caja-filter-date" class="form-input">
                <option value="all">Todo el Historial</option>
            </select>
            <select id="caja-filter-type" class="form-input">
                <option value="all">Todos los Tipos</option>
                <option value="entrada">🟢 Entradas</option>
                <option value="salida_proveedor">📦 Pago a Proveedor</option>
                <option value="salida_gasto">🔧 Gasto de Caja Chica</option>
                <option value="salida_sueldo">👷 Pago a Trabajador</option>
                <option value="salida_retiro">💼 Retiro del Dueño</option>
                <option value="arqueo">📊 Arqueos</option>
            </select>
        </div>

        <!-- KPI Cards -->
        <div class="caja-kpi-grid" id="caja-kpis">
            <!-- Injected by JS -->
        </div>

        <!-- Last Arqueo Card -->
        <div id="caja-last-arqueo"></div>

        <!-- Movements List -->
        <h3 style="color:var(--text-primary); font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <i class="ph ph-list-bullets" style="color:var(--primary);"></i> Movimientos de Caja
        </h3>
        <div id="caja-movements-list" style="display:flex; flex-direction:column; gap:10px; min-height:200px;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando movimientos...</p>
            </div>
        </div>
    `;

    // Init
    await initCajaDateFilter();
    renderCajaView();

    // Events
    document.getElementById('btn-cash-extraction').addEventListener('click', () => showExtractionModal());
    document.getElementById('btn-cash-arqueo').addEventListener('click', () => showArqueoModal());
    document.getElementById('caja-filter-date').addEventListener('change', () => renderCajaView());
    document.getElementById('caja-filter-type').addEventListener('change', () => renderCajaView());

    // Realtime sync handler
    if (window._cashRegisterSyncHandler) {
        window.removeEventListener('sync-data-updated', window._cashRegisterSyncHandler);
        window._cashRegisterSyncHandler = null;
    }
    window._cashRegisterSyncHandler = () => {
        if (document.getElementById('caja-movements-list')) {
            console.log("🔄 Sync update detected: refreshing cash register...");
            renderCajaView();
        } else {
            window.removeEventListener('sync-data-updated', window._cashRegisterSyncHandler);
            window._cashRegisterSyncHandler = null;
        }
    };
    window.addEventListener('sync-data-updated', window._cashRegisterSyncHandler);
};

// ── DATE FILTER ────────────────────────────────────────────────
async function initCajaDateFilter() {
    const filter = document.getElementById('caja-filter-date');
    if (!filter) return;

    while (filter.options.length > 1) filter.remove(1);

    try {
        const records = await window.db.cash_register.toArray();
        const active = records.filter(r => !r.deleted);

        const monthsFromDB = new Set();
        active.forEach(r => { if (r.date && r.date.length >= 7) monthsFromDB.add(r.date.substring(0, 7)); });

        const now = new Date();
        const monthsSet = new Set(monthsFromDB);
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        Array.from(monthsSet).sort().reverse().forEach(m => {
            const [y, monthNum] = m.split('-');
            const label = new Date(Number(y), Number(monthNum) - 1, 1)
                .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            const option = document.createElement('option');
            option.value = m;
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            filter.appendChild(option);
        });

        filter.value = 'all';
    } catch (e) { console.error('Error init caja date filter', e); }
}

// ── MAIN RENDER ────────────────────────────────────────────────
async function renderCajaView() {
    const list = document.getElementById('caja-movements-list');
    const kpiContainer = document.getElementById('caja-kpis');
    const arqueoContainer = document.getElementById('caja-last-arqueo');
    const dateFilter = document.getElementById('caja-filter-date')?.value || 'all';
    const typeFilter = document.getElementById('caja-filter-type')?.value || 'all';

    if (!list) return;

    try {
        const formatCurrency = window.Utils.formatCurrency;

        // Load all data sources to compute cash flow
        const [cajaRecords, dailySales, invoices, expenses, allSuppliers] = await Promise.all([
            window.db.cash_register.toArray(),
            window.db.daily_sales.toArray(),
            window.db.purchase_invoices.toArray(),
            window.db.expenses.toArray(),
            window.db.suppliers.toArray()
        ]);

        const activeRecords = cajaRecords.filter(r => !r.deleted);
        const supplierMap = window.Utils.createSupplierMap(allSuppliers);

        // ── Build unified movement timeline ───────────────────────
        const movements = [];

        // 1. Entradas : from daily_sales (cash portion only)
        dailySales.filter(s => !s.deleted).forEach(sale => {
            const cashIn = parseFloat(sale.cash) || 0;
            if (cashIn > 0) {
                movements.push({
                    id: `ds-${sale.id}`,
                    date: sale.date,
                    type: 'entrada',
                    category: 'Venta del Día',
                    amount: cashIn,
                    description: `Cierre de caja — Efectivo`,
                    icon: 'ph ph-cash-register',
                    color: '#10b981',
                    bg: 'rgba(16,185,129,0.1)',
                    source: 'daily_sales',
                    sourceId: sale.id
                });
            }
        });

        // 2. Salidas: from purchase_invoices (cash payments)
        invoices.filter(i => !i.deleted && i.paymentMethod === 'Efectivo').forEach(inv => {
            let cashOut = 0;
            if (inv.paymentStatus === 'Pagado') cashOut = parseFloat(inv.amount) || 0;
            else if (inv.paymentStatus === 'Abonado') cashOut = parseFloat(inv.paidAmount) || 0;

            if (cashOut > 0) {
                // Get supplier name from map
                const supplierName = supplierMap[inv.supplierId] || inv.supplierName || 'Proveedor';
                movements.push({
                    id: `inv-${inv.id}`,
                    date: inv.date,
                    type: 'salida_proveedor',
                    category: 'Pago Proveedor',
                    amount: -cashOut,
                    description: `${supplierName}${inv.invoiceNumber ? ' — Fact. #' + inv.invoiceNumber : ''}`,
                    icon: 'ph ph-package',
                    color: '#f59e0b',
                    bg: 'rgba(245,158,11,0.1)',
                    source: 'purchase_invoices',
                    sourceId: inv.id
                });
            }
        });

        // 3. Salidas: from expenses (cash payments)
        expenses.filter(e => !e.deleted && e.paymentMethod === 'Efectivo').forEach(exp => {
            const cashOut = parseFloat(exp.amount) || 0;
            if (cashOut > 0) {
                const isOwnerDraw = exp.category === 'Retiro del Dueño';
                const isSalary = exp.category === 'Sueldos';

                let type = 'salida_gasto';
                let icon = 'ph ph-wrench';
                let color = '#8b5cf6';
                let bg = 'rgba(139,92,246,0.1)';

                if (isOwnerDraw) {
                    type = 'salida_retiro';
                    icon = 'ph ph-briefcase';
                    color = '#ef4444';
                    bg = 'rgba(239,68,68,0.1)';
                } else if (isSalary) {
                    type = 'salida_sueldo';
                    icon = 'ph ph-user-circle';
                    color = '#0ea5e9';
                    bg = 'rgba(14,165,233,0.1)';
                }

                movements.push({
                    id: `exp-${exp.id}`,
                    date: exp.date,
                    type: type,
                    category: exp.category || 'Gasto',
                    amount: -cashOut,
                    description: exp.title,
                    icon: icon,
                    color: color,
                    bg: bg,
                    source: 'expenses',
                    sourceId: exp.id
                });
            }
        });

        // 4. Manual cash_register entries (arqueos and manual extractions)
        activeRecords.forEach(rec => {
            const isArqueo = rec.type === 'arqueo';
            movements.push({
                id: `cr-${rec.id}`,
                date: rec.date,
                type: rec.type,
                category: rec.category || (isArqueo ? 'Arqueo' : rec.type),
                amount: parseFloat(rec.amount) || 0,
                description: rec.description || (isArqueo ? 'Arqueo de caja' : 'Movimiento manual'),
                icon: isArqueo ? 'ph ph-scales' : (rec.amount >= 0 ? 'ph ph-arrow-square-in' : 'ph ph-arrow-square-out'),
                color: isArqueo ? '#6366f1' : (rec.amount >= 0 ? '#10b981' : '#ef4444'),
                bg: isArqueo ? 'rgba(99,102,241,0.1)' : (rec.amount >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'),
                source: 'cash_register',
                sourceId: rec.id,
                notes: rec.notes,
                realCash: rec.realCash,
                expectedCash: rec.expectedCash,
                difference: rec.difference
            });
        });

        // ── Filter ───────────────────────────────────────────────
        let filtered = movements.filter(m => {
            const matchesDate = dateFilter === 'all' || m.date.startsWith(dateFilter);
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            return matchesDate && matchesType;
        });

        // Sort by date DESC
        filtered.sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            // Within same day: entries first, then exits
            if (a.amount >= 0 && b.amount < 0) return -1;
            if (a.amount < 0 && b.amount >= 0) return 1;
            return 0;
        });

        // ── KPIs ─────────────────────────────────────────────────
        let totalEntradas = 0;
        let totalSalidas = 0;
        let totalProveedores = 0;
        let totalGastos = 0;
        let totalRetiros = 0;
        let totalSueldos = 0;
        let arqueoCount = 0;

        filtered.forEach(m => {
            if (m.type === 'arqueo') { arqueoCount++; return; }
            if (m.amount > 0) totalEntradas += m.amount;
            if (m.amount < 0) totalSalidas += Math.abs(m.amount);
            if (m.type === 'salida_proveedor') totalProveedores += Math.abs(m.amount);
            if (m.type === 'salida_gasto') totalGastos += Math.abs(m.amount);
            if (m.type === 'salida_retiro') totalRetiros += Math.abs(m.amount);
            if (m.type === 'salida_sueldo') totalSueldos += Math.abs(m.amount);
        });

        const saldoCaja = totalEntradas - totalSalidas;

        if (kpiContainer) {
            kpiContainer.innerHTML = `
                <div class="caja-kpi" style="background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02)); border:1px solid rgba(16,185,129,0.2);">
                    <div class="caja-kpi-label" style="color:#059669;">💵 Entradas Efectivo</div>
                    <div class="caja-kpi-value" style="color:#10b981;">${formatCurrency(totalEntradas)}</div>
                    <div class="caja-kpi-sub" style="color:#6ee7b7;">De cierres de caja</div>
                </div>
                <div class="caja-kpi" style="background:linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02)); border:1px solid rgba(239,68,68,0.2);">
                    <div class="caja-kpi-label" style="color:#dc2626;">🔻 Salidas Totales</div>
                    <div class="caja-kpi-value" style="color:#ef4444;">${formatCurrency(totalSalidas)}</div>
                    <div class="caja-kpi-sub" style="color:#fca5a5;">Proveedores + Sueldos + Gastos + Retiros</div>
                </div>
                <div class="caja-kpi" style="background:linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02)); border:1px solid rgba(59,130,246,0.2);">
                    <div class="caja-kpi-label" style="color:#2563eb;">🏦 Saldo en Caja</div>
                    <div class="caja-kpi-value" style="color:${saldoCaja >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(saldoCaja)}</div>
                    <div class="caja-kpi-sub" style="color:#93c5fd;">Entradas − Salidas</div>
                </div>
                <div class="caja-kpi" style="background:linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02)); border:1px solid rgba(245,158,11,0.2);">
                    <div class="caja-kpi-label" style="color:#d97706;">📊 Desglose Salidas</div>
                    <div class="caja-kpi-value" style="color:#f59e0b;">${formatCurrency(totalProveedores)}</div>
                    <div class="caja-kpi-sub" style="color:#fcd34d;">
                        📦 Prov. · 👷 Sueldos: ${formatCurrency(totalSueldos)} · 🔧 Gastos: ${formatCurrency(totalGastos)} · 💼 Retiros: ${formatCurrency(totalRetiros)}
                    </div>
                </div>
            `;
        }

        // ── Last arqueo ─ ────────────────────────────────────────
        const lastArqueo = activeRecords
            .filter(r => r.type === 'arqueo')
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (arqueoContainer) {
            if (lastArqueo) {
                const diff = parseFloat(lastArqueo.difference) || 0;
                const diffClass = Math.abs(diff) < 1 ? 'caja-diff-ok' : 'caja-diff-bad';
                const diffIcon = Math.abs(diff) < 1 ? '✅' : (diff > 0 ? '📈 Sobrante' : '📉 Faltante');

                arqueoContainer.innerHTML = `
                    <div class="caja-arqueo-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:44px; height:44px; border-radius:14px; background:linear-gradient(135deg, #6366f1, #4f46e5); display:flex; align-items:center; justify-content:center;">
                                    <i class="ph ph-scales" style="font-size:1.4rem; color:white;"></i>
                                </div>
                                <div>
                                    <h3 style="margin:0; font-size:1rem; color:white;">Último Arqueo de Caja</h3>
                                    <span style="font-size:0.8rem; color:#94a3b8;">${formatDate(lastArqueo.date)}</span>
                                </div>
                            </div>
                            <span class="caja-badge ${diffClass}" style="background:${Math.abs(diff) < 1 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; padding:6px 14px; font-size:0.8rem;">
                                ${diffIcon} ${formatCurrency(Math.abs(diff))}
                            </span>
                        </div>
                        <div class="caja-arqueo-row">
                            <span style="color:#94a3b8;">Efectivo contado (real)</span>
                            <strong style="color:white;">${formatCurrency(lastArqueo.realCash || 0)}</strong>
                        </div>
                        <div class="caja-arqueo-row">
                            <span style="color:#94a3b8;">Efectivo esperado (sistema)</span>
                            <strong style="color:white;">${formatCurrency(lastArqueo.expectedCash || 0)}</strong>
                        </div>
                        <div class="caja-arqueo-row" style="border-bottom:none; padding-top:12px; border-top:1px solid rgba(255,255,255,0.1);">
                            <span style="color:#94a3b8; font-weight:600;">Diferencia</span>
                            <strong class="${diffClass}" style="font-size:1.1rem;">${diff >= 0 ? '+' : ''}${formatCurrency(diff)}</strong>
                        </div>
                        ${lastArqueo.notes ? `<div style="margin-top:12px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; font-size:0.8rem; color:#cbd5e1;"><i class="ph ph-note-pencil"></i> ${escapeHTML(lastArqueo.notes)}</div>` : ''}
                    </div>
                `;
            } else {
                arqueoContainer.innerHTML = `
                    <div style="background:rgba(99,102,241,0.05); border:1px dashed rgba(99,102,241,0.3); border-radius:16px; padding:20px; text-align:center; margin-bottom:24px;">
                        <i class="ph ph-scales" style="font-size:2rem; color:#6366f1; margin-bottom:8px;"></i>
                        <p style="color:var(--text-muted); margin:0; font-size:0.9rem;">Aún no has hecho ningún arqueo. Hacer uno te permite cuadrar el efectivo físico con lo que dice el sistema.</p>
                    </div>
                `;
            }
        }

        // ── Movements List ───────────────────────────────────────
        const movementsOnly = filtered.filter(m => m.type !== 'arqueo');

        if (movementsOnly.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-vault" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay movimientos de caja</h3>
                </div>
            `;
            return;
        }

        // Group by date
        const grouped = new Map();
        movementsOnly.forEach(m => {
            if (!grouped.has(m.date)) grouped.set(m.date, []);
            grouped.get(m.date).push(m);
        });

        let html = '';
        for (const [date, items] of grouped) {
            const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
            const dayTotal = items.reduce((s, m) => s + m.amount, 0);

            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; margin-top:8px;">
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:capitalize;">${dayLabel}</span>
                    <span style="font-size:0.8rem; font-weight:700; color:${dayTotal >= 0 ? '#10b981' : '#ef4444'};">${dayTotal >= 0 ? '+' : ''}${formatCurrency(dayTotal)}</span>
                </div>
            `;

            items.forEach(m => {
                const isPositive = m.amount >= 0;
                const absAmount = Math.abs(m.amount);
                const typeLabel = {
                    'entrada': '🟢 Entrada',
                    'salida_proveedor': '📦 Proveedor',
                    'salida_gasto': '🔧 Gasto',
                    'salida_sueldo': '👷 Sueldo',
                    'salida_retiro': '💼 Retiro',
                }[m.type] || m.type;

                html += `
                    <div class="caja-movement">
                        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                            <div class="caja-icon-wrap" style="background:${m.bg}; color:${m.color};">
                                <i class="${m.icon}"></i>
                            </div>
                            <div style="min-width:0; flex:1;">
                                <div style="font-weight:600; font-size:0.9rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(m.description)}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:2px;">
                                    <span class="caja-badge" style="background:${m.bg}; color:${m.color};">${typeLabel}</span>
                                    <span>${m.category}</span>
                                </div>
                            </div>
                        </div>
                        <div style="text-align:right; flex-shrink:0;">
                            <div style="font-weight:800; font-size:1rem; color:${isPositive ? '#10b981' : '#ef4444'};">
                                ${isPositive ? '+' : '-'}${formatCurrency(absAmount)}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        list.innerHTML = html;

    } catch (e) {
        console.error("Error in renderCajaView:", e);
        list.innerHTML = `<div style="color:red;">Error: ${e.message}</div>`;
    }
}

// ── EXTRACTION MODAL ───────────────────────────────────────────
async function showExtractionModal() {
    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];
    const formatCurrency = window.Utils.formatCurrency;

    // Load suppliers for dropdown
    const allSuppliers = await window.db.suppliers.toArray();
    const suppliers = allSuppliers.filter(s => !s.deleted);
    const supplierOptions = suppliers.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');

    modal.innerHTML = `
        <div class="modal" style="max-width:520px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-arrow-square-out" style="color:var(--primary);"></i> Registrar Extracción de Caja</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <form id="extraction-form" style="display:flex; flex-direction:column; gap:16px;">

                    <!-- Type Selection -->
                    <div class="form-group">
                        <label class="form-label">¿Para qué sacas el dinero?</label>
                        <div id="ext-type-selector" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                            <button type="button" class="ext-type-btn active" data-type="proveedor" style="padding:14px; border-radius:12px; border:2px solid var(--primary); background:rgba(220,38,38,0.05); cursor:pointer; text-align:center; transition:all 0.2s; font-weight:600;">
                                <i class="ph ph-package" style="font-size:1.5rem; color:var(--primary); display:block; margin-bottom:4px;"></i>
                                Proveedor
                            </button>
                            <button type="button" class="ext-type-btn" data-type="sueldo" style="padding:14px; border-radius:12px; border:2px solid var(--border); background:transparent; cursor:pointer; text-align:center; transition:all 0.2s; font-weight:600; color:var(--text-muted);">
                                <i class="ph ph-user-circle" style="font-size:1.5rem; color:var(--text-muted); display:block; margin-bottom:4px;"></i>
                                Trabajador
                            </button>
                            <button type="button" class="ext-type-btn" data-type="gasto" style="padding:14px; border-radius:12px; border:2px solid var(--border); background:transparent; cursor:pointer; text-align:center; transition:all 0.2s; font-weight:600; color:var(--text-muted);">
                                <i class="ph ph-wrench" style="font-size:1.5rem; color:var(--text-muted); display:block; margin-bottom:4px;"></i>
                                Gasto
                            </button>
                        </div>
                    </div>

                    <!-- Supplier (shown for proveedor) -->
                    <div class="form-group" id="ext-supplier-group">
                        <label class="form-label">Proveedor</label>
                        <select id="ext-supplier" class="form-input">
                            <option value="">Seleccionar proveedor...</option>
                            ${supplierOptions}
                            <option value="__other">+ Otro (escribir nombre)</option>
                        </select>
                    </div>
                    <div class="form-group" id="ext-supplier-name-group" style="display:none;">
                        <label class="form-label">Nombre del Proveedor</label>
                        <input type="text" id="ext-supplier-name" class="form-input" placeholder="Ej. Distribuidora XYZ">
                    </div>

                    <!-- Employee (shown for sueldo) -->
                    <div class="form-group" id="ext-employee-group" style="display:none;">
                        <label class="form-label">Trabajador</label>
                        <select id="ext-employee" class="form-input">
                            <option value="">Seleccionar trabajador...</option>
                        </select>
                    </div>

                    <!-- Category (shown for gasto) -->
                    <div class="form-group" id="ext-category-group" style="display:none;">
                        <label class="form-label">Categoría del Gasto</label>
                        <select id="ext-category" class="form-input">
                            <option value="Insumos">🧹 Insumos / Limpieza</option>
                            <option value="Transporte">🚗 Transporte</option>
                            <option value="Mantenimiento">🔧 Mantenimiento</option>
                            <option value="Otros">📁 Otros</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Descripción</label>
                        <input type="text" id="ext-description" class="form-input" placeholder="Ej. Pago mercadería semana 15" required>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label class="form-label">Monto ($)</label>
                            <input type="number" id="ext-amount" class="form-input" placeholder="0" min="1" required style="font-size:1.1rem; font-weight:700;">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fecha</label>
                            <input type="date" id="ext-date" class="form-input" value="${today}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Referencia / N° Factura (opcional)</label>
                        <input type="text" id="ext-reference" class="form-input" placeholder="Ej. Factura #4521">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notas (opcional)</label>
                        <textarea id="ext-notes" class="form-input" style="height:50px;" placeholder="Alguna nota adicional..."></textarea>
                    </div>

                    <!-- Documental reminder -->
                    <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:12px; padding:14px; font-size:0.8rem; color:#92400e;">
                        <strong>📋 Recuerda guardar:</strong>
                        <ul style="margin:6px 0 0 16px; padding:0; line-height:1.6;">
                            <li>Factura o boleta del proveedor (foto)</li>
                            <li>Recibo firmado de que entregaste el dinero</li>
                            <li>Nota de entrega / remito</li>
                        </ul>
                    </div>

                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btn-save-extraction" style="width:100%; background:linear-gradient(135deg, var(--primary), #b91c1c);">
                    <i class="ph ph-check-circle"></i> Registrar Extracción
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Type selector logic
    let selectedType = 'proveedor';
    document.querySelectorAll('.ext-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ext-type-btn').forEach(b => {
                b.style.borderColor = 'var(--border)';
                b.style.background = 'transparent';
                b.style.color = 'var(--text-muted)';
                b.classList.remove('active');
            });
            btn.style.borderColor = 'var(--primary)';
            btn.style.background = 'rgba(220,38,38,0.05)';
            btn.style.color = 'var(--text-primary)';
            btn.classList.add('active');
            selectedType = btn.dataset.type;

            // Toggle visibility
            document.getElementById('ext-supplier-group').style.display = selectedType === 'proveedor' ? '' : 'none';
            document.getElementById('ext-supplier-name-group').style.display = 'none';
            document.getElementById('ext-employee-group').style.display = selectedType === 'sueldo' ? '' : 'none';
            document.getElementById('ext-category-group').style.display = selectedType === 'gasto' ? '' : 'none';
        });
    });

    // Populate employee dropdown
    try {
        const allEmployees = await window.db.employees.toArray();
        const activeEmployees = allEmployees.filter(e => !e.deleted);
        const empSelect = document.getElementById('ext-employee');
        activeEmployees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            empSelect.appendChild(option);
        });
    } catch(e) { console.error('Error loading employees:', e); }

    // Supplier "other" toggle
    document.getElementById('ext-supplier').addEventListener('change', (e) => {
        document.getElementById('ext-supplier-name-group').style.display = e.target.value === '__other' ? '' : 'none';
    });

    // Save
    document.getElementById('btn-save-extraction').addEventListener('click', async () => {
        const amount = parseFloat(document.getElementById('ext-amount').value) || 0;
        const description = document.getElementById('ext-description').value.trim();
        const date = document.getElementById('ext-date').value;
        const reference = document.getElementById('ext-reference').value.trim();
        const notes = document.getElementById('ext-notes').value.trim();

        if (amount <= 0) { alert('Ingresa un monto mayor a 0.'); return; }
        if (!description) { alert('Ingresa una descripción.'); return; }

        try {
            if (selectedType === 'proveedor') {
                // Register as purchase invoice + cash_register entry
                const supplierId = document.getElementById('ext-supplier').value;
                let supplierName = '';

                if (supplierId === '__other') {
                    supplierName = document.getElementById('ext-supplier-name').value.trim();
                    if (!supplierName) { alert('Ingresa el nombre del proveedor.'); return; }
                } else if (supplierId) {
                    const sup = await window.db.suppliers.get(Number(supplierId));
                    supplierName = sup ? sup.name : 'Proveedor';
                } else {
                    alert('Selecciona un proveedor.'); return;
                }

                // Create purchase invoice
                const invoiceData = {
                    supplierId: supplierId === '__other' ? null : Number(supplierId),
                    supplierName: supplierName,
                    invoiceNumber: reference || 'PENDIENTE',
                    date: date,
                    amount: amount,
                    paymentMethod: 'Efectivo',
                    paymentStatus: 'Pagado',
                    paidAmount: amount,
                    notes: notes || `Extracción de caja — ${description}`,
                    deleted: false
                };
                await window.DataManager.saveAndSync('purchase_invoices', invoiceData);

                // Register cash movement
                const cashData = {
                    date: date,
                    type: 'salida_proveedor',
                    category: 'Pago Proveedor',
                    amount: -amount,
                    description: `${supplierName} — ${description}`,
                    paymentMethod: 'Efectivo',
                    reference: reference,
                    notes: notes,
                    deleted: false
                };
                await window.DataManager.saveAndSync('cash_register', cashData);

            } else if (selectedType === 'sueldo') {
                // Register as expense (Sueldos) + cash_register entry
                const employeeSelect = document.getElementById('ext-employee');
                const employeeName = employeeSelect.options[employeeSelect.selectedIndex]?.text || 'Trabajador';

                const expenseData = {
                    title: `Pago a ${employeeName} — ${description}`,
                    amount: amount,
                    category: 'Sueldos',
                    paymentMethod: 'Efectivo',
                    date: date,
                    isFixed: false,
                    deleted: false
                };
                await window.DataManager.saveAndSync('expenses', expenseData);

                const cashData = {
                    date: date,
                    type: 'salida_sueldo',
                    category: 'Sueldos',
                    amount: -amount,
                    description: `Pago a ${employeeName} — ${description}`,
                    paymentMethod: 'Efectivo',
                    reference: reference,
                    notes: notes,
                    deleted: false
                };
                await window.DataManager.saveAndSync('cash_register', cashData);

            } else {
                // Register as expense + cash_register entry
                const category = document.getElementById('ext-category').value;

                const expenseData = {
                    title: description,
                    amount: amount,
                    category: category,
                    paymentMethod: 'Efectivo',
                    date: date,
                    isFixed: false,
                    deleted: false
                };
                await window.DataManager.saveAndSync('expenses', expenseData);

                const cashData = {
                    date: date,
                    type: 'salida_gasto',
                    category: category,
                    amount: -amount,
                    description: description,
                    paymentMethod: 'Efectivo',
                    reference: reference,
                    notes: notes,
                    deleted: false
                };
                await window.DataManager.saveAndSync('cash_register', cashData);
            }

            modal.classList.add('hidden');
            renderCajaView();

            // Show success toast
            if (window.Sync?.showToast) {
                window.Sync.showToast(`✅ Extracción de ${window.Utils.formatCurrency(amount)} registrada`, 'success');
            }

        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
}

// ── ARQUEO MODAL ───────────────────────────────────────────────
async function showArqueoModal() {
    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];
    const formatCurrency = window.Utils.formatCurrency;

    // Calculate expected cash in register
    const [dailySales, invoices, expenses] = await Promise.all([
        window.db.daily_sales.toArray(),
        window.db.purchase_invoices.toArray(),
        window.db.expenses.toArray()
    ]);

    let totalCashIn = 0;
    let totalCashOut = 0;

    dailySales.filter(s => !s.deleted).forEach(s => {
        totalCashIn += parseFloat(s.cash) || 0;
    });

    invoices.filter(i => !i.deleted && i.paymentMethod === 'Efectivo').forEach(i => {
        if (i.paymentStatus === 'Pagado') totalCashOut += parseFloat(i.amount) || 0;
        else if (i.paymentStatus === 'Abonado') totalCashOut += parseFloat(i.paidAmount) || 0;
    });

    expenses.filter(e => !e.deleted && e.paymentMethod === 'Efectivo').forEach(e => {
        totalCashOut += parseFloat(e.amount) || 0;
    });

    const expectedCash = totalCashIn - totalCashOut;

    modal.innerHTML = `
        <div class="modal" style="max-width:480px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="ph ph-scales" style="color:#6366f1;"></i> Arqueo de Caja</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <div style="background:linear-gradient(135deg, #1e293b, #0f172a); border-radius:16px; padding:20px; margin-bottom:20px; color:white;">
                    <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:8px;">
                        Efectivo esperado según el sistema
                    </div>
                    <div style="font-size:2rem; font-weight:800; color:${expectedCash >= 0 ? '#10b981' : '#ef4444'};" id="arqueo-expected-display">
                        ${formatCurrency(expectedCash)}
                    </div>
                    <div style="display:flex; gap:16px; margin-top:12px; font-size:0.8rem; color:#94a3b8;">
                        <span>📥 Entradas: ${formatCurrency(totalCashIn)}</span>
                        <span>📤 Salidas: ${formatCurrency(totalCashOut)}</span>
                    </div>
                </div>

                <form id="arqueo-form" style="display:flex; flex-direction:column; gap:16px;">
                    <div class="form-group">
                        <label class="form-label" style="font-size:1rem; font-weight:700;">¿Cuánto efectivo contaste en la caja? ($)</label>
                        <input type="number" id="arqueo-real" class="form-input" placeholder="0" min="0" required
                            style="font-size:1.5rem; font-weight:800; text-align:center; padding:16px; border:2px solid var(--primary); border-radius:14px;">
                    </div>

                    <!-- Live difference display -->
                    <div id="arqueo-diff-display" style="background:rgba(0,0,0,0.03); border-radius:14px; padding:16px; text-align:center; border:1px solid var(--border);">
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Diferencia</div>
                        <div id="arqueo-diff-value" style="font-size:1.8rem; font-weight:800; color:var(--text-muted);">$0</div>
                        <div id="arqueo-diff-label" style="font-size:0.8rem; margin-top:4px; color:var(--text-muted);">Ingresa el monto contado</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Fecha del Arqueo</label>
                        <input type="date" id="arqueo-date" class="form-input" value="${today}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notas (opcional)</label>
                        <textarea id="arqueo-notes" class="form-input" style="height:50px;" placeholder="Ej. Faltaron $500 — posible error de vuelto"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btn-save-arqueo" style="width:100%; background:linear-gradient(135deg, #6366f1, #4f46e5);">
                    <i class="ph ph-scales"></i> Guardar Arqueo
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Live difference calculation
    const realInput = document.getElementById('arqueo-real');
    const diffValue = document.getElementById('arqueo-diff-value');
    const diffLabel = document.getElementById('arqueo-diff-label');
    const diffDisplay = document.getElementById('arqueo-diff-display');

    realInput.addEventListener('input', () => {
        const real = parseFloat(realInput.value) || 0;
        const diff = real - expectedCash;

        diffValue.innerHTML = `${diff >= 0 ? '+' : ''}${formatCurrency(diff)}`;

        if (Math.abs(diff) < 1) {
            diffValue.style.color = '#10b981';
            diffLabel.textContent = '✅ ¡Caja cuadrada perfectamente!';
            diffLabel.style.color = '#10b981';
            diffDisplay.style.borderColor = 'rgba(16,185,129,0.3)';
            diffDisplay.style.background = 'rgba(16,185,129,0.05)';
        } else if (diff > 0) {
            diffValue.style.color = '#f59e0b';
            diffLabel.textContent = '📈 Hay dinero de más (sobrante)';
            diffLabel.style.color = '#f59e0b';
            diffDisplay.style.borderColor = 'rgba(245,158,11,0.3)';
            diffDisplay.style.background = 'rgba(245,158,11,0.05)';
        } else {
            diffValue.style.color = '#ef4444';
            diffLabel.textContent = '📉 Falta dinero (faltante)';
            diffLabel.style.color = '#ef4444';
            diffDisplay.style.borderColor = 'rgba(239,68,68,0.3)';
            diffDisplay.style.background = 'rgba(239,68,68,0.05)';
        }
    });

    // Save
    document.getElementById('btn-save-arqueo').addEventListener('click', async () => {
        const realCash = parseFloat(document.getElementById('arqueo-real').value);
        const date = document.getElementById('arqueo-date').value;
        const notes = document.getElementById('arqueo-notes').value.trim();

        if (isNaN(realCash) || realCash < 0) { alert('Ingresa el monto contado en caja.'); return; }

        const difference = realCash - expectedCash;

        try {
            const arqueoData = {
                date: date,
                type: 'arqueo',
                category: 'Arqueo de Caja',
                amount: difference,
                description: `Arqueo: ${formatCurrency(realCash)} contado vs ${formatCurrency(expectedCash)} esperado`,
                realCash: realCash,
                expectedCash: expectedCash,
                difference: difference,
                notes: notes,
                deleted: false
            };

            await window.DataManager.saveAndSync('cash_register', arqueoData);

            modal.classList.add('hidden');
            renderCajaView();

            if (window.Sync?.showToast) {
                const emoji = Math.abs(difference) < 1 ? '✅' : (difference > 0 ? '📈' : '📉');
                window.Sync.showToast(`${emoji} Arqueo registrado — Diferencia: ${formatCurrency(difference)}`, Math.abs(difference) < 1 ? 'success' : 'warning');
            }

        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
}

// ── HELPERS ────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
}

function escapeHTML(str) {
    if (window.Utils?.escapeHTML) return window.Utils.escapeHTML(str);
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
