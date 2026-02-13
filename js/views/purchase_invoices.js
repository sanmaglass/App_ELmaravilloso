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

        <!-- Filters -->
        <div style="display:grid; grid-template-columns: 1fr auto auto; gap:12px; margin-bottom:24px; align-items:center;">
             <div style="position:relative;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="invoice-search" class="form-input" placeholder="Buscar por proveedor o N° factura..." style="padding-left:36px; width:100%;">
            </div>
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
        <div id="invoices-list" style="display:flex; flex-direction:column; gap:12px;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando facturas...</p>
            </div>
        </div>
    `;

    renderInvoices();

    // Events
    document.getElementById('btn-add-invoice').addEventListener('click', () => showInvoiceModal());
    document.getElementById('invoice-search').addEventListener('input', () => renderInvoices());
    document.getElementById('filter-status').addEventListener('change', () => renderInvoices());
    document.getElementById('btn-export-excel').addEventListener('click', exportInvoicesToExcel);
};

// --- RENDER LOGIC ---
async function renderInvoices() {
    const list = document.getElementById('invoices-list');
    const search = document.getElementById('invoice-search').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;

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
            return matchesSearch && matchesStatus;
        });

        // Sort by Date DESC
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-receipt" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay facturas registradas</h3>
                </div>
            `;
            return;
        }

        // Totals
        let totalAmount = 0;
        let totalPending = 0;

        const html = filtered.map(inv => {
            const supplierName = supplierMap[inv.supplierId] || 'Proveedor Eliminado';
            const isPending = inv.paymentStatus === 'Pendiente';
            const amount = parseFloat(inv.amount) || 0;

            totalAmount += amount;
            if (isPending) totalPending += amount;

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
