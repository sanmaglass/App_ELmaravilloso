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

        <!-- Filters -->
        <div style="display:grid; grid-template-columns: 1fr auto auto auto; gap:12px; margin-bottom:24px; align-items:center;">
             <div style="position:relative;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="invoice-search" class="form-input" placeholder="Buscar por proveedor o N° factura..." style="padding-left:36px; width:100%;">
            </div>
            <select id="filter-date" class="form-input">
                <option value="all">Todo el Historial</option>
                <!-- Dynamic Months will be injected here -->
            </select>
            <select id="filter-status" class="form-input">
                <option value="all">Todos los Estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Pagado">Pagado</option>
            </select>
             <button class="btn btn-secondary" id="btn-export-excel">
                <i class="ph ph-file-xls"></i> Exportar
            </button>
        </div>

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
    await renderAnalytics();
    renderInvoices();

    // Events
    document.getElementById('btn-add-invoice').addEventListener('click', () => showInvoiceModal());
    document.getElementById('invoice-search').addEventListener('input', () => { window.state.invoicesPage = 1; renderInvoices(); });
    document.getElementById('filter-status').addEventListener('change', () => { window.state.invoicesPage = 1; renderInvoices(); });
    document.getElementById('filter-date').addEventListener('change', () => { window.state.invoicesPage = 1; renderInvoices(); });
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

        // Filter: Active invoices where documentReceived is false or undefined
        const pending = invoices.filter(i =>
            !i.deleted &&
            !i.documentReceived &&
            i.date // Has a date (not corrupted)
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
                        <h3 style="margin:0; color:#7f1d1d; font-size:1.1rem;">🚨 Facturas Sin Recibir (${pending.length})</h3>
                        <p style="margin:4px 0 0 0; font-size:0.85rem; color:#991b1b;">Estas facturas fueron registradas pero aún no has recibido el documento físico/digital del proveedor.</p>
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
                                        Factura #${inv.invoiceNumber} • ${formatDate(inv.date)} 
                                        <span style="color:${urgencyColor}; font-weight:600; margin-left:8px;">${urgency} (${daysAgo} días)</span>
                                    </div>
                                    <div style="font-size:0.85rem; color:#059669; margin-top:4px;">Monto: ${formatCurrency(inv.amount)}</div>
                                </div>
                                <button class="btn btn-secondary btn-mark-received" data-id="${inv.id}" style="font-size:0.8rem; white-space:nowrap;">
                                    ✅ Marcar Recibida
                                </button>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        // Attach "Mark Received" button events
        document.querySelectorAll('.btn-mark-received').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.currentTarget.dataset.id);
                try {
                    await window.db.purchase_invoices.update(id, { documentReceived: true });
                    if (window.Sync?.client) {
                        await window.Sync.client.from('purchase_invoices').update({ documentReceived: true }).eq('id', id);
                    }
                    renderPendingDocuments(); // Refresh panel
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            });
        });

    } catch (e) {
        console.error("Error rendering pending documents:", e);
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
            const supplierName = (supplierMap[i.supplierId] || 'Desconocido').toLowerCase();
            const matchesSearch = supplierName.includes(search) || i.invoiceNumber.toLowerCase().includes(search);
            const matchesStatus = statusFilter === 'all' || i.paymentStatus === statusFilter;

            let matchesDate = true;
            if (dateFilter !== 'all') {
                matchesDate = i.date.startsWith(dateFilter);
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

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
            const supplierName = supplierMap[inv.supplierId] || 'Proveedor Eliminado';
            const isPending = inv.paymentStatus === 'Pendiente';
            const amount = parseFloat(inv.amount) || 0;

            return `
            <div class="card" style="padding:16px; display:grid; grid-template-columns: 1fr 1fr 1fr auto; align-items:center; gap:16px; border-left: 4px solid ${isPending ? '#f59e0b' : '#10b981'};">
                
                <!-- Supplier & Invoice No -->
                <div>
                    <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary);">${supplierName}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); display:flex; gap:8px;">
                        <span><i class="ph ph-hash"></i> ${inv.invoiceNumber}</span>
                        <span>•</span>
                        <span><i class="ph ph-calendar-blank"></i> ${formatDate(inv.date)}</span>
                    </div>
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

        // Summary Header
        const summaryHtml = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
                <div class="card" style="padding:12px; background:var(--bg-card);">
                    <div style="font-size:0.8rem; color:var(--text-muted);">Total Registrado</div>
                    <div style="font-size:1.2rem; font-weight:700;">${formatCurrency(totalAmount)}</div>
                </div>
                <div class="card" style="padding:12px; background:var(--bg-card);">
                    <div style="font-size:0.8rem; color:var(--text-muted);">Por Pagar (Pendiente)</div>
                    <div style="font-size:1.2rem; font-weight:700; color:#d97706;">${formatCurrency(totalPending)}</div>
                </div>
            </div>
        `;

        list.innerHTML = summaryHtml + html;

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

                    <div class="form-group" style="grid-column:1/-1;">
                        <label class="form-label">Observaciones</label>
                        <textarea id="inv-notes" class="form-input" style="height:60px;">${isEdit && invoiceToEdit.notes ? invoiceToEdit.notes : ''}</textarea>
                    </div>

                    <div class="form-group" style="grid-column:1/-1; background:rgba(0,0,0,0.02); padding:12px; border-radius:8px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                            <input type="checkbox" id="inv-doc-received" ${isEdit && invoiceToEdit.documentReceived ? 'checked' : ''}>
                            <span>✅ Ya recibí el documento físico/digital de esta factura</span>
                        </label>
                        <p style="font-size:0.75rem; color:var(--text-muted); margin:8px 0 0 28px;">Si no lo marcas, aparecerá en las alertas como pendiente de recibir.</p>
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
        const documentReceived = document.getElementById('inv-doc-received').checked;

        // ✅ DUPLICATE CHECK: Verify invoice number doesn't already exist
        if (!isEdit) {
            const allInvoices = await window.db.purchase_invoices.toArray();
            const activeInvoices = allInvoices.filter(i => !i.deleted);
            const duplicateExists = activeInvoices.some(inv =>
                inv.invoiceNumber.toLowerCase() === invoiceNumber.toLowerCase()
            );

            if (duplicateExists) {
                alert(`❌ Ya existe una factura con el número "${invoiceNumber}".\n\nPor favor usa un número diferente.`);
                return;
            }
        }

        try {
            const invoiceData = {
                supplierId,
                invoiceNumber,
                date,
                amount,
                period,
                paymentMethod,
                paymentStatus,
                notes,
                documentReceived,
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

// --- HELPERS ---
function formatDate(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}
