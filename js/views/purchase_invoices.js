// Purchase Invoices View (Compras)
window.Views = window.Views || {};

window.Views.purchase_invoices = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-receipt" style="color:var(--primary);"></i> Facturas de Compra
                </h1>
                <p style="color:var(--text-muted);">Registro de gastos y compras a proveedores</p>
            </div>
            <button class="btn btn-primary" id="btn-add-invoice">
                <i class="ph ph-plus-circle"></i> Nueva Factura
            </button>
        </div>

        <!-- 📊 ANALYTICS PANEL -->
        <div id="invoice-analytics" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
            <!-- Stats cards will be injected here -->
        </div>

        <!-- 🚨 PENDING DOCUMENTS ALERT PANEL -->
        <div id="pending-docs-alert" style="margin-bottom:20px;">
            <!-- Alert cards will be injected here -->
        </div>

        <!-- 💳 CREDIT INVOICES ALERT PANEL -->
        <div id="credit-alerts-panel" style="margin-bottom:20px;">
            <!-- Credit alert cards will be injected here -->
        </div>

        <!-- Filters -->
        <div style="display:grid; grid-template-columns: 1fr auto auto auto auto; gap:12px; margin-bottom:16px; align-items:center;">
             <div style="position:relative;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="invoice-search" class="form-input" placeholder="Buscar por proveedor o N° factura..." style="padding-left:36px; width:100%;">
            </div>
            <select id="filter-supplier" class="form-input" title="Filtrar por proveedor">
                <option value="all">Todos los Proveedores</option>
                <!-- Dynamic Suppliers will be injected here -->
            </select>
            <select id="filter-date" class="form-input">
                <option value="all">Todo el Historial</option>
                <!-- Dynamic Months will be injected here -->
            </select>
            <select id="filter-status" class="form-input">
                <option value="all">Todos los Estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Pagado">Pagado</option>
                <option value="Crédito">Crédito Pendiente</option>
            </select>
             <button class="btn btn-secondary" id="btn-export-excel">
                <i class="ph ph-file-xls"></i> Exportar
            </button>
        </div>

        <!-- Supplier History Panel (collapsible) -->
        <div id="supplier-history-panel" style="display:none; margin-bottom:20px;"></div>

        <!-- Invoices List -->
        <div id="invoices-list" style="display:flex; flex-direction:column; gap:12px; min-height: 200px;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando facturas...</p>
            </div>
        </div>

        <!-- Pagination Controls -->
        <div id="pagination-controls" style="display:flex; justify-content:center; gap:12px; margin-top:24px; align-items:center;">
            <!-- Buttons injected by JS -->
        </div>
    `;

    // State for Pagination
    window.state.invoicesPage = 1;
    window.state.invoicesPerPage = 10;

    // Initialize component
    await initDateFilter();
    await populateSupplierFilter();
    await renderAnalytics();
    await renderPendingDocuments();
    await renderCreditAlerts();
    renderInvoices();

    // Events
    document.getElementById('btn-add-invoice').addEventListener('click', () => showInvoiceModal());
    document.getElementById('invoice-search').addEventListener('input', () => { window.state.invoicesPage = 1; renderInvoices(); });
    document.getElementById('filter-status').addEventListener('change', () => { window.state.invoicesPage = 1; renderInvoices(); });
    document.getElementById('filter-date').addEventListener('change', () => { window.state.invoicesPage = 1; renderInvoices(); });
    document.getElementById('filter-supplier').addEventListener('change', () => { window.state.invoicesPage = 1; renderInvoices(); });
    document.getElementById('btn-export-excel').addEventListener('click', exportInvoicesToExcel);
};

// --- INIT FILTERS ---
async function initDateFilter() {
    const filter = document.getElementById('filter-date');
    if (!filter) return;

    try {
        const invoices = await window.db.purchase_invoices.toArray();
        const active = invoices.filter(i => !i.deleted);

        // Extract unique YYYY-MM
        const months = new Set();
        active.forEach(i => {
            if (i.date && i.date.length >= 7) {
                months.add(i.date.substring(0, 7));
            }
        });

        // Sort DESC
        const sortedMonths = Array.from(months).sort().reverse();

        // Populate
        sortedMonths.forEach(m => {
            const [y, monthNum] = m.split('-');
            const dateObj = new Date(y, monthNum - 1);
            const label = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

            const option = document.createElement('option');
            option.value = m;
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            filter.appendChild(option);
        });

        // Set Default to Current Month if exists
        const currentMonth = new Date().toISOString().substring(0, 7);
        if (months.has(currentMonth)) {
            filter.value = currentMonth;
        } else {
            filter.value = 'all';
        }

    } catch (e) { console.error("Error init date filter", e); }
}

// --- ANALYTICS PANEL ---
async function renderAnalytics() {
    const panel = document.getElementById('invoice-analytics');
    if (!panel) return;

    try {
        const invoices = await window.db.purchase_invoices.toArray();
        const active = invoices.filter(i => !i.deleted);

        const now = new Date();
        const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);
        const currentYear = now.getFullYear().toString();

        // Filter by periods
        const thisMonth = active.filter(i => i.date && i.date.startsWith(currentMonth));
        const prevMonth = active.filter(i => i.date && i.date.startsWith(lastMonth));
        const thisYear = active.filter(i => i.date && i.date.startsWith(currentYear));

        // Calculate metrics
        const monthCount = thisMonth.length;
        const monthTotal = thisMonth.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const monthPending = thisMonth.filter(i => i.paymentStatus === 'Pendiente');
        const monthPendingAmount = monthPending.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

        const yearTotal = thisYear.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const avgPerInvoice = monthCount > 0 ? monthTotal / monthCount : 0;

        // Credit totals (all-time, not just this month)
        const allCreditPending = active.filter(i => i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente');
        const creditPendingTotal = allCreditPending.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const creditOverdue = allCreditPending.filter(i => {
            if (!i.dueDate) return false;
            const due = new Date(i.dueDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return due < today;
        });

        // Comparison with last month
        const prevMonthCount = prevMonth.length;
        const countDiff = monthCount - prevMonthCount;
        const countDiffPercent = prevMonthCount > 0 ? ((countDiff / prevMonthCount) * 100).toFixed(0) : 0;
        const trendIcon = countDiff > 0 ? '📈' : countDiff < 0 ? '📉' : '➡️';
        const trendColor = countDiff > 0 ? '#f59e0b' : countDiff < 0 ? '#10b981' : '#6b7280';

        panel.innerHTML = `
            <div class="card" style="padding:16px; border-left:4px solid var(--primary);">
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Facturas del Mes</div>
                <div style="font-size:1.8rem; font-weight:700; color:var(--primary);">${monthCount}</div>
                <div style="font-size:0.75rem; color:${trendColor}; margin-top:4px;">
                    ${trendIcon} ${countDiff > 0 ? '+' : ''}${countDiff} vs mes anterior
                </div>
            </div>

            <div class="card" style="padding:16px; border-left:4px solid #10b981;">
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Total del Mes</div>
                <div style="font-size:1.5rem; font-weight:700; color:#10b981;">${formatCurrency(monthTotal)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                    Promedio: ${formatCurrency(avgPerInvoice)}
                </div>
            </div>

            <div class="card" style="padding:16px; border-left:4px solid #f59e0b;">
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Pendientes de Pago</div>
                <div style="font-size:1.5rem; font-weight:700; color:#f59e0b;">${monthPending.length}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                    ${formatCurrency(monthPendingAmount)}
                </div>
            </div>

            <div class="card" style="padding:16px; border-left:4px solid #d97706;">
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">💳 Crédito Pendiente</div>
                <div style="font-size:1.5rem; font-weight:700; color:#d97706;">${formatCurrency(creditPendingTotal)}</div>
                <div style="font-size:0.75rem; color:${creditOverdue.length > 0 ? '#dc2626' : 'var(--text-muted)'}; margin-top:4px; font-weight:${creditOverdue.length > 0 ? '700' : '400'};">
                    ${creditOverdue.length > 0 ? `🚨 ${creditOverdue.length} vencida${creditOverdue.length > 1 ? 's' : ''}` : `${allCreditPending.length} facturas`}
                </div>
            </div>

            <div class="card" style="padding:16px; border-left:4px solid #6366f1;">
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Total Año ${currentYear}</div>
                <div style="font-size:1.5rem; font-weight:700; color:#6366f1;">${formatCurrency(yearTotal)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                    ${thisYear.length} facturas
                </div>
            </div>
        `;

    } catch (e) {
        console.error("Error rendering analytics:", e);
        panel.innerHTML = `<div style="color:var(--error); padding:12px;">Error cargando estadísticas</div>`;
    }
}

// --- PENDING DOCUMENTS ALERT PANEL ---
async function renderPendingDocuments() {
    const panel = document.getElementById('pending-docs-alert');
    if (!panel) return;

    try {
        const invoices = await window.db.purchase_invoices.toArray();
        const suppliers = await window.db.suppliers.toArray();

        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

        // Filter: Active invoices where invoice number is missing/pending
        const pending = invoices.filter(i =>
            !i.deleted &&
            (!i.invoiceNumber ||
                i.invoiceNumber.trim() === '' ||
                i.invoiceNumber.toUpperCase() === 'PENDIENTE' ||
                i.invoiceNumber.toUpperCase() === 'SIN NÚMERO')
        );

        if (pending.length === 0) {
            panel.innerHTML = ''; // No alerts
            return;
        }

        // Sort by date (oldest first)
        pending.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate days since invoice date
        const getDaysAgo = (dateStr) => {
            const invoiceDate = new Date(dateStr);
            const today = new Date();
            const diff = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
            return diff;
        };

        panel.innerHTML = `
            <div style="background:#fee2e2; border:2px solid #dc2626; border-radius:12px; padding:16px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <i class="ph ph-warning-circle" style="font-size:2rem; color:#dc2626;"></i>
                    <div>
                        <h3 style="margin:0; color:#7f1d1d; font-size:1.1rem;">🚨 Facturas Pendientes de Crear (${pending.length})</h3>
                        <p style="margin:4px 0 0 0; font-size:0.85rem; color:#991b1b;">Registraste estas compras pero el proveedor aún NO te ha emitido la factura. Recuerda pedírsela.</p>
                    </div>
                </div>
                <div style="display:grid; gap:8px; max-height:300px; overflow-y:auto;">
                    ${pending.map(inv => {
            const supplierName = supplierMap[inv.supplierId] || 'Proveedor Desconocido';
            const daysAgo = getDaysAgo(inv.date);
            const urgency = daysAgo > 30 ? '🔴 MUY URGENTE' : daysAgo > 15 ? '🟠 URGENTE' : '🟡';
            const urgencyColor = daysAgo > 30 ? '#7f1d1d' : daysAgo > 15 ? '#c2410c' : '#ca8a04';

            return `
                            <div style="background:white; border-left:4px solid ${urgencyColor}; padding:12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight:600; color:#1f2937;">${supplierName}</div>
                                    <div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">
                                        <span style="color:#dc2626; font-weight:600;">SIN NÚMERO DE FACTURA</span> • ${formatDate(inv.date)} 
                                        <span style="color:${urgencyColor}; font-weight:600; margin-left:8px;">${urgency} (${daysAgo} días)</span>
                                    </div>
                                    <div style="font-size:0.85rem; color:#059669; margin-top:4px;">Monto: ${formatCurrency(inv.amount)}</div>
                                </div>
                                <button class="btn btn-secondary btn-edit-pending" data-id="${inv.id}" style="font-size:0.8rem; white-space:nowrap;">
                                    ✏️ Agregar N° Factura
                                </button>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        // Attach "Edit Pending" button events
        document.querySelectorAll('.btn-edit-pending').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.currentTarget.dataset.id);
                try {
                    const invoice = await window.db.purchase_invoices.get(id);
                    if (invoice) showInvoiceModal(invoice); // Open edit modal
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            });
        });

    } catch (e) {
        console.error("Error rendering pending documents:", e);
    }
}

// --- 💳 CREDIT ALERTS PANEL ---
async function renderCreditAlerts() {
    const panel = document.getElementById('credit-alerts-panel');
    if (!panel) return;

    try {
        const invoices = await window.db.purchase_invoices.toArray();
        const suppliers = await window.db.suppliers.toArray();
        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

        // Filter: Active credit invoices that are still pending
        const creditPending = invoices.filter(i =>
            !i.deleted &&
            i.paymentMethod === 'Crédito' &&
            i.paymentStatus === 'Pendiente' &&
            i.dueDate
        );

        if (creditPending.length === 0) {
            panel.innerHTML = '';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Categorize
        const overdue = [];
        const dueThisWeek = [];
        const dueSoon = [];
        const dueLater = [];

        creditPending.forEach(inv => {
            const due = new Date(inv.dueDate);
            const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
            inv._daysLeft = diff;
            inv._supplierName = supplierMap[inv.supplierId] || 'Proveedor Desconocido';

            if (diff < 0) overdue.push(inv);
            else if (diff <= 7) dueThisWeek.push(inv);
            else if (diff <= 15) dueSoon.push(inv);
            else dueLater.push(inv);
        });

        // Sort each group
        overdue.sort((a, b) => a._daysLeft - b._daysLeft);
        dueThisWeek.sort((a, b) => a._daysLeft - b._daysLeft);
        dueSoon.sort((a, b) => a._daysLeft - b._daysLeft);

        const totalPending = creditPending.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        const overdueTotal = overdue.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

        function renderCard(inv, color, icon) {
            const absDay = Math.abs(inv._daysLeft);
            const label = inv._daysLeft < 0 ? `${absDay} días atrasada` :
                inv._daysLeft === 0 ? '¡Vence HOY!' :
                    `${inv._daysLeft} días restantes`;
            return `
                <div style="background:white; border-left:4px solid ${color}; padding:12px 16px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; color:#1f2937; font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                            ${icon} ${inv._supplierName}
                        </div>
                        <div style="font-size:0.8rem; color:#6b7280; margin-top:3px; display:flex; gap:12px; flex-wrap:wrap;">
                            <span style="font-weight:700; color:${color};">${label}</span>
                            <span>📅 Vence: ${formatDate(inv.dueDate)}</span>
                            <span>💰 ${formatCurrency(inv.amount)}</span>
                        </div>
                        ${inv.invoiceNumber ? `<div style="font-size:0.75rem; color:#9ca3af; margin-top:2px;">#${inv.invoiceNumber} • ${inv.creditDays || '?'} días crédito</div>` : ''}
                    </div>
                    <button class="btn btn-credit-pay" data-id="${inv.id}" style="background:${color}; color:white; border:none; padding:6px 14px; border-radius:8px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.2s;">
                        💰 Pagada
                    </button>
                </div>
            `;
        }

        let html = `
            <div style="background:linear-gradient(135deg, #fffbeb, #fef3c7); border:2px solid #f59e0b; border-radius:16px; padding:20px; box-shadow:0 4px 12px rgba(245,158,11,0.15);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg, #f59e0b, #d97706); display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-clock-countdown" style="font-size:1.5rem; color:white;"></i>
                        </div>
                        <div>
                            <h3 style="margin:0; color:#78350f; font-size:1.1rem;">Facturas a Crédito Pendientes</h3>
                            <p style="margin:2px 0 0 0; font-size:0.85rem; color:#92400e;">${creditPending.length} facturas • Total: ${formatCurrency(totalPending)}</p>
                        </div>
                    </div>
                    ${overdue.length > 0 ? `
                        <div style="background:#dc2626; color:white; padding:6px 14px; border-radius:20px; font-size:0.85rem; font-weight:700; animation: pulse 2s infinite;">
                            🚨 ${overdue.length} VENCIDA${overdue.length > 1 ? 'S' : ''} (${formatCurrency(overdueTotal)})
                        </div>
                    ` : ''}
                </div>
                <div style="display:grid; gap:8px; max-height:350px; overflow-y:auto;">
        `;

        if (overdue.length > 0) {
            html += overdue.map(inv => renderCard(inv, '#dc2626', '🔴')).join('');
        }
        if (dueThisWeek.length > 0) {
            html += dueThisWeek.map(inv => renderCard(inv, '#ea580c', '🟠')).join('');
        }
        if (dueSoon.length > 0) {
            html += dueSoon.map(inv => renderCard(inv, '#ca8a04', '🟡')).join('');
        }
        if (dueLater.length > 0) {
            html += dueLater.map(inv => renderCard(inv, '#6b7280', '⚪')).join('');
        }

        html += `</div></div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        </style>`;

        panel.innerHTML = html;

        // "Mark Paid" button events
        document.querySelectorAll('.btn-credit-pay').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.currentTarget.dataset.id);
                if (confirm('¿Confirmar que esta factura fue pagada?')) {
                    try {
                        await window.db.purchase_invoices.update(id, { paymentStatus: 'Pagado' });
                        if (window.Sync?.client) {
                            await window.Sync.client.from('purchase_invoices').update({ paymentStatus: 'Pagado' }).eq('id', id);
                        }
                        await renderCreditAlerts();
                        await renderAnalytics();
                        renderInvoices();
                    } catch (err) { alert('Error: ' + err.message); }
                }
            });
        });

    } catch (e) {
        console.error("Error rendering credit alerts:", e);
    }
}

// --- RENDER LOGIC ---
async function renderInvoices() {
    const list = document.getElementById('invoices-list');
    const pagination = document.getElementById('pagination-controls');

    // Get Filter Values
    const search = document.getElementById('invoice-search').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const dateFilter = document.getElementById('filter-date').value;
    const supplierFilter = (document.getElementById('filter-supplier')?.value) || 'all';

    if (!list) return;

    try {
        const [invoices, suppliers] = await Promise.all([
            window.db.purchase_invoices.toArray(),
            window.db.suppliers.toArray()
        ]);

        // Map supplier names
        const supplierMap = {};
        if (suppliers) {
            suppliers.forEach(s => supplierMap[s.id] = s.name);
        }

        const activeInvoices = invoices.filter(i => !i.deleted);

        // Filter
        let filtered = activeInvoices.filter(i => {
            const nameFromMap = supplierMap[i.supplierId];
            const nameFromBackup = i.supplierName || 'Desconocido';
            const supplierName = (nameFromMap || nameFromBackup).toLowerCase();

            const matchesSearch = supplierName.includes(search) || (i.invoiceNumber || '').toLowerCase().includes(search);
            let matchesStatus = statusFilter === 'all' || i.paymentStatus === statusFilter;
            // Special filter: 'Crédito' shows credit invoices still pending
            if (statusFilter === 'Crédito') {
                matchesStatus = i.paymentMethod === 'Crédito' && i.paymentStatus === 'Pendiente';
            }

            let matchesDate = true;
            if (dateFilter !== 'all') {
                matchesDate = i.date && i.date.startsWith(dateFilter);
            }

            // Supplier filter
            const matchesSupplier = supplierFilter === 'all' || String(i.supplierId) === String(supplierFilter);

            return matchesSearch && matchesStatus && matchesDate && matchesSupplier;
        });

        // Render supplier history if a specific supplier is selected
        renderSupplierHistory(supplierFilter, activeInvoices, supplierMap);

        // Sort by Date DESC
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // --- PAGINATION LOGIC ---
        const page = window.state.invoicesPage || 1;
        const perPage = window.state.invoicesPerPage || 10;
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / perPage);

        // Slice logic
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginatedItems = filtered.slice(start, end);

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-receipt" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay facturas registradas</h3>
                </div>
            `;
            return;
        }

        // Totals (Calculate on filtered total, not just page)
        let totalAmount = 0;
        let totalPending = 0;

        // Calculate totals for ALL matches (not just visible page) to be useful
        filtered.forEach(inv => {
            const amount = parseFloat(inv.amount) || 0;
            totalAmount += amount;
            if (inv.paymentStatus === 'Pendiente') totalPending += amount;
        });

        const html = paginatedItems.map(inv => {
            let supplierName = supplierMap[inv.supplierId];

            // --- SELF-HEALING FALLBACK ---
            // If ID not found, try to find by name saved in record
            if (!supplierName && inv.supplierName) {
                const found = suppliers.find(s => s.name.toLowerCase() === inv.supplierName.toLowerCase() && !s.deleted);
                if (found) {
                    supplierName = found.name;
                    // Auto-fix ID in background (non-blocking)
                    window.db.purchase_invoices.update(inv.id, { supplierId: found.id });
                    console.log(`[Fix] Vinculando factura ${inv.invoiceNumber} al proveedor ${found.name} (ID recuperado)`);
                } else {
                    supplierName = inv.supplierName + ' (Sin ID)';
                }
            } else if (!supplierName) {
                supplierName = 'Proveedor Eliminado';
            }

            const isPending = inv.paymentStatus === 'Pendiente';
            const amount = parseFloat(inv.amount) || 0;

            return `
            <div class="card" style="padding:16px; display:grid; grid-template-columns: 1fr 1fr 1fr auto; align-items:center; gap:16px; border-left: 4px solid ${isPending ? (inv.paymentMethod === 'Crédito' ? '#d97706' : '#f59e0b') : '#10b981'};">
                
                <!-- Supplier & Invoice No -->
                <div>
                    <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary);">${supplierName}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); display:flex; gap:8px; flex-wrap:wrap;">
                        <span><i class="ph ph-hash"></i> ${inv.invoiceNumber}</span>
                        <span>•</span>
                        <span><i class="ph ph-calendar-blank"></i> ${formatDate(inv.date)}</span>
                    </div>
                    ${inv.paymentMethod === 'Crédito' && inv.dueDate ? (() => {
                    const due = new Date(inv.dueDate);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                    const isOverdue = diff < 0 && inv.paymentStatus === 'Pendiente';
                    const dueSoon = diff >= 0 && diff <= 7 && inv.paymentStatus === 'Pendiente';
                    const dueColor = isOverdue ? '#dc2626' : dueSoon ? '#ea580c' : '#6b7280';
                    const dueLabel = inv.paymentStatus === 'Pagado' ? '✅ Pagada' :
                        isOverdue ? `🔴 ${Math.abs(diff)}d atrasada` :
                            diff === 0 ? '🟠 ¡Vence HOY!' :
                                dueSoon ? `🟠 ${diff}d restantes` : `${diff}d restantes`;
                    return `<div style="font-size:0.75rem; margin-top:3px; display:flex; align-items:center; gap:6px;">
                            <span style="background:rgba(217,119,6,0.1); color:${dueColor}; padding:2px 8px; border-radius:10px; font-weight:700;">
                                ⏰ Crédito ${inv.creditDays || '?'}d • ${dueLabel}
                            </span>
                            <span style="color:#9ca3af;">Vence: ${formatDate(inv.dueDate)}</span>
                        </div>`;
                })() : ''}
                </div>

                <!-- Amount & Period -->
                <div>
                    <div style="font-weight:700; font-size:1.1rem; color:var(--text-primary);">${formatCurrency(amount)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${inv.period || 'Sin período'}</div>
                </div>

                <!-- Status -->
                <div>
                    <span style="padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:600; background:${isPending ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color:${isPending ? '#d97706' : '#059669'};">
                        ${inv.paymentStatus}
                    </span>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${inv.paymentMethod}</div>
                </div>

                <!-- Actions -->
                <div style="display:flex; gap:8px;">
                     <button class="btn btn-icon btn-edit-invoice" data-id="${inv.id}" title="Editar">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn btn-icon btn-delete-invoice" data-id="${inv.id}" title="Eliminar" style="color:var(--error);">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');

        list.innerHTML = html;


        // Render Pagination Controls
        if (totalPages > 1) {
            pagination.innerHTML = `
                <button class="btn btn-secondary" ${page === 1 ? 'disabled' : ''} onclick="window.changeInvoicePage(${page - 1})">
                    <i class="ph ph-caret-left"></i> Anterior
                </button>
                <span style="font-weight:600; color:var(--text-muted);">Página ${page} de ${totalPages}</span>
                <button class="btn btn-secondary" ${page === totalPages ? 'disabled' : ''} onclick="window.changeInvoicePage(${page + 1})">
                    Siguiente <i class="ph ph-caret-right"></i>
                </button>
            `;
        } else {
            pagination.innerHTML = '';
        }

        // Global function for pagination click
        window.changeInvoicePage = (newPage) => {
            window.state.invoicesPage = newPage;
            renderInvoices();
        };

        // Attach Events
        document.querySelectorAll('.btn-edit-invoice').forEach(btn =>
            btn.addEventListener('click', (e) => handleEditInvoice(Number(e.currentTarget.dataset.id)))
        );
        document.querySelectorAll('.btn-delete-invoice').forEach(btn =>
            btn.addEventListener('click', (e) => handleDeleteInvoice(Number(e.currentTarget.dataset.id)))
        );

    } catch (e) {
        console.error("Error in renderInvoices:", e);
        list.innerHTML = `<div style="color:red; padding:20px;">Error cargando datos: ${e.message}</div>`;
    }
}

// --- CRUD HANDLERS ---
async function handleDeleteInvoice(id) {
    if (confirm('¿Eliminar esta factura?')) {
        try {
            await window.db.purchase_invoices.update(id, { deleted: true });
            renderInvoices();
            // Cloud Sync
            if (window.Sync?.client) {
                await window.Sync.client.from('purchase_invoices').update({ deleted: true }).eq('id', id);
            }
        } catch (e) { alert('Error: ' + e.message); }
    }
}

async function handleEditInvoice(id) {
    const invoice = await window.db.purchase_invoices.get(id);
    if (invoice) showInvoiceModal(invoice);
}

// --- MODAL ---
async function showInvoiceModal(invoiceToEdit = null) {
    const isEdit = !!invoiceToEdit;

    // FETCH SUPPLIERS - Simple and Robust
    const allSuppliers = await window.db.suppliers.toArray();
    const suppliers = allSuppliers.filter(s => !s.deleted);
    suppliers.sort((a, b) => a.name.localeCompare(b.name));

    // DATALIST OPTIONS
    const supplierDatalist = suppliers.map(s =>
        `<option value="${s.name}"></option>`
    ).join('');

    // STARTING VALUE
    let currentSupplierName = '';
    if (isEdit) {
        const s = suppliers.find(sup => sup.id === invoiceToEdit.supplierId);
        if (s) currentSupplierName = s.name;
    }

    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="modal" style="max-width:600px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Editar Factura' : 'Registrar Compra'}</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <form id="invoice-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    
                    <div class="form-group" style="grid-column:1/-1;">
                        <label class="form-label">Proveedor *</label>
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="inv-supplier-input" class="form-input" list="supplier-list-dl" placeholder="Escribe para buscar..." value="${currentSupplierName}" autocomplete="off" required>
                            <datalist id="supplier-list-dl">
                                ${supplierDatalist}
                            </datalist>
                             <button type="button" class="btn btn-secondary" title="Nuevo Proveedor" id="btn-quick-supplier">
                                <i class="ph ph-plus"></i>
                            </button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">N° Factura / Documento</label>
                        <input type="text" id="inv-number" class="form-input" placeholder="Ej. 12345" value="${isEdit ? invoiceToEdit.invoiceNumber : ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Fecha de Emisión</label>
                        <input type="date" id="inv-date" class="form-input" value="${isEdit ? invoiceToEdit.date : today}">
                    </div>

                     <div class="form-group">
                        <label class="form-label">Período de Uso</label>
                        <input type="text" id="inv-period" class="form-input" placeholder="Ej. Enero 2026" value="${isEdit ? (invoiceToEdit.period || '') : ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Monto Total ($)</label>
                        <input type="number" id="inv-amount" class="form-input" placeholder="0" value="${isEdit ? invoiceToEdit.amount : ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Método de Pago</label>
                        <select id="inv-method" class="form-input">
                            <option value="Transferencia" ${isEdit && invoiceToEdit.paymentMethod === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                            <option value="Débito" ${isEdit && invoiceToEdit.paymentMethod === 'Débito' ? 'selected' : ''}>Débito</option>
                            <option value="Efectivo" ${isEdit && invoiceToEdit.paymentMethod === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                            <option value="Crédito" ${isEdit && invoiceToEdit.paymentMethod === 'Crédito' ? 'selected' : ''}>Crédito</option>
                             <option value="Pendiente" ${isEdit && invoiceToEdit.paymentMethod === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Estado de Pago</label>
                        <select id="inv-status" class="form-input">
                            <option value="Pagado" ${isEdit && invoiceToEdit.paymentStatus === 'Pagado' ? 'selected' : ''}>Pagado</option>
                            <option value="Pendiente" ${isEdit && invoiceToEdit.paymentStatus === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        </select>
                    </div>

                    <!-- 💳 CREDIT FIELDS (shown only when method = Crédito) -->
                    <div id="credit-fields-container" style="grid-column:1/-1; display:${(isEdit && invoiceToEdit.paymentMethod === 'Crédito') ? 'block' : 'none'}; background:linear-gradient(135deg, #fef3c7, #fffbeb); border:2px solid #f59e0b; border-radius:12px; padding:16px; transition:all 0.3s ease;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ph ph-clock-countdown" style="font-size:1.3rem; color:#d97706;"></i>
                            <span style="font-weight:700; color:#92400e; font-size:0.95rem;">Condiciones de Crédito</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <div class="form-group" style="margin:0;">
                                <label class="form-label" style="color:#92400e;">Días de Crédito</label>
                                <input type="number" id="inv-credit-days" class="form-input" placeholder="Ej. 30" min="1" value="${isEdit && invoiceToEdit.creditDays ? invoiceToEdit.creditDays : ''}">
                                <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                                    <button type="button" class="credit-preset-btn" data-days="15" style="padding:4px 10px; border-radius:20px; border:1px solid #d97706; background:white; color:#92400e; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.2s;">15d</button>
                                    <button type="button" class="credit-preset-btn" data-days="30" style="padding:4px 10px; border-radius:20px; border:1px solid #d97706; background:white; color:#92400e; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.2s;">30d</button>
                                    <button type="button" class="credit-preset-btn" data-days="45" style="padding:4px 10px; border-radius:20px; border:1px solid #d97706; background:white; color:#92400e; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.2s;">45d</button>
                                    <button type="button" class="credit-preset-btn" data-days="60" style="padding:4px 10px; border-radius:20px; border:1px solid #d97706; background:white; color:#92400e; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.2s;">60d</button>
                                    <button type="button" class="credit-preset-btn" data-days="90" style="padding:4px 10px; border-radius:20px; border:1px solid #d97706; background:white; color:#92400e; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.2s;">90d</button>
                                </div>
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label class="form-label" style="color:#92400e;">Fecha de Vencimiento</label>
                                <input type="date" id="inv-due-date" class="form-input" value="${isEdit && invoiceToEdit.dueDate ? invoiceToEdit.dueDate : ''}">
                                <div id="due-date-preview" style="margin-top:8px; font-size:0.8rem; color:#b45309; font-weight:600;"></div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="grid-column:1/-1;">
                        <label class="form-label">Observaciones</label>
                        <textarea id="inv-notes" class="form-input" style="height:60px;">${isEdit && invoiceToEdit.notes ? invoiceToEdit.notes : ''}</textarea>
                    </div>

                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btn-save-invoice" style="width:100%;">
                    ${isEdit ? 'Actualizar Factura' : 'Guardar Factura'}
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // --- CREDIT FIELDS LOGIC ---
    const creditContainer = document.getElementById('credit-fields-container');
    const methodSelect = document.getElementById('inv-method');
    const statusSelect = document.getElementById('inv-status');
    const creditDaysInput = document.getElementById('inv-credit-days');
    const dueDateInput = document.getElementById('inv-due-date');
    const dueDatePreview = document.getElementById('due-date-preview');

    // Function to calculate due date from invoice date + credit days
    function calcDueDate() {
        const baseDate = document.getElementById('inv-date').value;
        const days = parseInt(creditDaysInput.value);
        if (baseDate && days > 0) {
            const due = new Date(baseDate);
            due.setDate(due.getDate() + days);
            const dueStr = due.toISOString().split('T')[0];
            dueDateInput.value = dueStr;
            // Preview
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
            if (diff < 0) {
                dueDatePreview.innerHTML = `<span style="color:#dc2626;">⚠️ ¡Vencida hace ${Math.abs(diff)} días!</span>`;
            } else if (diff === 0) {
                dueDatePreview.innerHTML = `<span style="color:#dc2626;">⚠️ ¡Vence HOY!</span>`;
            } else if (diff <= 7) {
                dueDatePreview.innerHTML = `<span style="color:#ea580c;">⏰ Vence en ${diff} días</span>`;
            } else {
                dueDatePreview.innerHTML = `<span style="color:#16a34a;">✅ Vence en ${diff} días</span>`;
            }
        }
    }

    // Show/hide credit section based on payment method
    methodSelect.addEventListener('change', () => {
        const isCredit = methodSelect.value === 'Crédito';
        creditContainer.style.display = isCredit ? 'block' : 'none';
        if (isCredit) {
            statusSelect.value = 'Pendiente';
            if (!creditDaysInput.value) creditDaysInput.value = 30;
            calcDueDate();
        } else {
            creditDaysInput.value = '';
            dueDateInput.value = '';
            dueDatePreview.innerHTML = '';
        }
    });

    // Preset day buttons
    document.querySelectorAll('.credit-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            creditDaysInput.value = btn.dataset.days;
            // Highlight active preset
            document.querySelectorAll('.credit-preset-btn').forEach(b => {
                b.style.background = 'white';
                b.style.color = '#92400e';
            });
            btn.style.background = '#d97706';
            btn.style.color = 'white';
            calcDueDate();
        });
    });

    // Recalculate due date when days or invoice date changes
    creditDaysInput.addEventListener('input', calcDueDate);
    document.getElementById('inv-date').addEventListener('change', () => {
        if (methodSelect.value === 'Crédito') calcDueDate();
    });

    // If editing a credit invoice, show preview
    if (isEdit && invoiceToEdit.paymentMethod === 'Crédito' && invoiceToEdit.dueDate) {
        calcDueDate();
    }

    // Quick Add Supplier Event
    document.getElementById('btn-quick-supplier').addEventListener('click', async () => {
        const newName = prompt('Nombre del nuevo proveedor:');
        if (newName && newName.trim()) {
            try {
                // Add to DB
                await window.db.suppliers.add({
                    id: Date.now(),
                    name: newName.trim(),
                    deleted: false
                });
                // Reload Modal to refresh list
                showInvoiceModal(invoiceToEdit);
                // Pre-fill input
                setTimeout(() => {
                    const input = document.getElementById('inv-supplier-input');
                    if (input) input.value = newName.trim();
                }, 200);
            } catch (e) { alert('Error creando proveedor: ' + e.message); }
        }
    });

    // --- VALIDATION LOGIC ---
    async function isDuplicate(invoiceNumber) {
        if (!invoiceNumber) return false;
        const allInvoices = await window.db.purchase_invoices.toArray();
        const activeInvoices = allInvoices.filter(i => !i.deleted);

        // If editing, ignore the current invoice
        return activeInvoices.some(inv =>
            inv.invoiceNumber.toLowerCase() === invoiceNumber.toLowerCase() &&
            (!isEdit || inv.id !== invoiceToEdit.id)
        );
    }

    const numberInput = document.getElementById('inv-number');
    numberInput.addEventListener('blur', async () => {
        const val = numberInput.value.trim();
        if (await isDuplicate(val)) {
            alert(`❌ Ya existe una factura con el número "${val}".\n\nPor favor usa un número diferente.`);
        }
    });

    document.getElementById('btn-save-invoice').addEventListener('click', async () => {
        const supplierNameInput = document.getElementById('inv-supplier-input').value.trim();

        // ROBUST ID RESOLUTION
        // 1. Try exact match
        let supplierObj = suppliers.find(s => s.name.toLowerCase() === supplierNameInput.toLowerCase());

        // 2. If no match, check if user typed something valid but didn't select
        if (!supplierObj) {
            alert('El proveedor "' + supplierNameInput + '" no existe en la lista. Créalo con el botón (+) si es nuevo.');
            return;
        }

        const supplierId = supplierObj.id;
        const invoiceNumber = document.getElementById('inv-number').value.trim();
        const date = document.getElementById('inv-date').value;
        const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
        const period = document.getElementById('inv-period').value.trim();
        const paymentMethod = document.getElementById('inv-method').value;
        const paymentStatus = document.getElementById('inv-status').value;
        const notes = document.getElementById('inv-notes').value.trim();

        // Credit fields
        const creditDays = paymentMethod === 'Crédito' ? (parseInt(document.getElementById('inv-credit-days').value) || null) : null;
        const dueDate = paymentMethod === 'Crédito' ? (document.getElementById('inv-due-date').value || null) : null;

        // ✅ DUPLICATE CHECK: Verify invoice number doesn't already exist
        if (await isDuplicate(invoiceNumber)) {
            alert(`❌ Ya existe una factura con el número "${invoiceNumber}".\n\nPor favor usa un número diferente.`);
            return;
        }

        try {
            const invoiceData = {
                supplierId,
                supplierName: supplierObj.name, // Save name as backup
                invoiceNumber,
                date,
                amount,
                period,
                paymentMethod,
                paymentStatus,
                creditDays,
                dueDate,
                notes,
                deleted: false
            };

            if (isEdit) {
                await window.db.purchase_invoices.update(invoiceToEdit.id, invoiceData);
                if (window.Sync?.client) {
                    await window.Sync.client.from('purchase_invoices').update(invoiceData).eq('id', invoiceToEdit.id);
                }
            } else {
                invoiceData.id = Date.now();
                await window.db.purchase_invoices.add(invoiceData);
                if (window.Sync?.client) {
                    await window.Sync.client.from('purchase_invoices').insert([invoiceData]);
                }
            }

            modal.classList.add('hidden');
            // Reset to page 1 and reload date filter if new invoice added impacts list
            if (!isEdit) {
                await initDateFilter();
                window.state.invoicesPage = 1;
            }
            renderInvoices();
            await renderCreditAlerts();
        } catch (e) { alert('Error: ' + e.message); }
    });
}

// --- EXPORT TO EXCEL ---
async function exportInvoicesToExcel() {
    try {
        const invoices = await window.db.purchase_invoices.toArray();
        const activeInvoices = invoices.filter(i => !i.deleted);

        if (activeInvoices.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        // Get suppliers to map names
        const suppliers = await window.db.suppliers.toArray();
        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s.name);

        const data = activeInvoices.map(inv => ({
            Fecha: inv.date,
            Proveedor: supplierMap[inv.supplierId] || 'Desconocido',
            N_Factura: inv.invoiceNumber,
            Periodo: inv.period,
            Monto: inv.amount,
            Metodo_Pago: inv.paymentMethod,
            Estado: inv.paymentStatus,
            Dias_Credito: inv.creditDays || '',
            Fecha_Vencimiento: inv.dueDate || '',
            Notas: inv.notes
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Facturas Compra");
        XLSX.writeFile(wb, `Facturas_Compra_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
        console.error(e);
        alert('Error exportando: ' + e.message);
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

// --- SUPPLIER HISTORY PANEL ---
function renderSupplierHistory(supplierFilter, allInvoices, supplierMap) {
    const panel = document.getElementById('supplier-history-panel');
    if (!panel) return;

    if (supplierFilter === 'all') {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }

    const supplierName = supplierMap[supplierFilter] || 'Proveedor';
    const supplierInvoices = allInvoices
        .filter(i => String(i.supplierId) === String(supplierFilter))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalComprado = supplierInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const totalPendiente = supplierInvoices
        .filter(i => i.paymentStatus === 'Pendiente')
        .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const cantidadFacturas = supplierInvoices.length;
    const primerCompra = supplierInvoices.length > 0 ? supplierInvoices[supplierInvoices.length - 1].date : null;

    panel.style.display = 'block';
    panel.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--primary); padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                <h3 style="color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                    <i class="ph ph-buildings" style="color:var(--primary);"></i> Historial: ${supplierName}
                </h3>
                <span style="font-size:0.8rem; color:var(--text-muted);">
                    ${primerCompra ? `Primera compra: ${formatDate(primerCompra)}` : ''}
                </span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:16px; margin-bottom:16px;">
                <div style="text-align:center; padding:12px; background:rgba(0,0,0,0.03); border-radius:12px;">
                    <div style="font-size:1.4rem; font-weight:800; color:var(--primary);">${formatCurrency(totalComprado)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Total Comprado</div>
                </div>
                <div style="text-align:center; padding:12px; background:rgba(0,0,0,0.03); border-radius:12px;">
                    <div style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${cantidadFacturas}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Facturas</div>
                </div>
                <div style="text-align:center; padding:12px; background:${totalPendiente > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'}; border-radius:12px;">
                    <div style="font-size:1.4rem; font-weight:800; color:${totalPendiente > 0 ? '#d97706' : '#059669'};">${formatCurrency(totalPendiente)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Deuda Pendiente</div>
                </div>
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
                Últimas facturas
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto;">
                ${supplierInvoices.slice(0, 10).map(inv => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.02); border-radius:8px; font-size:0.85rem;">
                        <div>
                            <span style="font-weight:600; color:var(--text-primary);">${formatDate(inv.date)}</span>
                            <span style="color:var(--text-muted); margin-left:8px;">#${inv.invoiceNumber}</span>
                        </div>
                        <div style="display:flex; gap:12px; align-items:center;">
                            <span style="font-weight:700; color:var(--text-primary);">${formatCurrency(parseFloat(inv.amount) || 0)}</span>
                            <span style="padding:2px 8px; border-radius:8px; font-size:0.75rem; font-weight:600;
                                background:${inv.paymentStatus === 'Pagado' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'};
                                color:${inv.paymentStatus === 'Pagado' ? '#059669' : '#d97706'};">
                                ${inv.paymentStatus}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// --- POPULATE SUPPLIER FILTER SELECT ---
async function populateSupplierFilter() {
    const select = document.getElementById('filter-supplier');
    if (!select) return;

    const [invoices, suppliers] = await Promise.all([
        window.db.purchase_invoices.toArray(),
        window.db.suppliers.toArray()
    ]);

    const activeInvoices = invoices.filter(i => !i.deleted);
    const usedSupplierIds = [...new Set(activeInvoices.map(i => i.supplierId))];

    const supplierMap = {};
    suppliers.forEach(s => supplierMap[s.id] = s.name);

    // Sort suppliers alphabetically
    const supplierOptions = usedSupplierIds
        .filter(id => supplierMap[id])
        .map(id => ({ id, name: supplierMap[id] }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const currentValue = select.value;
    select.innerHTML = '<option value="all">Todos los Proveedores</option>' +
        supplierOptions.map(s => `<option value="${s.id}" ${String(s.id) === String(currentValue) ? 'selected' : ''}>${s.name}</option>`).join('');
}
