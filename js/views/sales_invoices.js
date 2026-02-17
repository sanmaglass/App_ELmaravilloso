// Sales Invoices View (Ventas)
window.Views = window.Views || {};

window.Views.sales_invoices = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-file-text" style="color:var(--primary);"></i> Facturas de Venta
                </h1>
                <p style="color:var(--text-muted);">Emisión de documentos a clientes</p>
            </div>
            <button class="btn btn-primary" id="btn-new-sale">
                <i class="ph ph-plus-circle"></i> Nueva Venta
            </button>
        </div>

        <!-- Filters -->
         <div style="display:grid; grid-template-columns: 1fr auto; gap:12px; margin-bottom:24px;">
             <div style="position:relative;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="sale-search" class="form-input" placeholder="Buscar cliente o N° factura..." style="padding-left:36px; width:100%;">
            </div>
             <button class="btn btn-secondary" id="btn-export-sales">
                <i class="ph ph-file-xls"></i> Exportar
            </button>
        </div>

        <!-- Sales List -->
        <div id="sales-list" style="display:flex; flex-direction:column; gap:12px;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando ventas...</p>
            </div>
        </div>
    `;

    renderSales();

    // Events
    document.getElementById('btn-new-sale').addEventListener('click', () => showSaleModal());
    document.getElementById('sale-search').addEventListener('input', () => renderSales());
    document.getElementById('btn-export-sales').addEventListener('click', exportSalesToExcel);
};

// --- RENDER LOGIC ---
async function renderSales() {
    const list = document.getElementById('sales-list');
    const search = document.getElementById('sale-search').value.toLowerCase();

    if (!list) return;

    try {
        const sales = await window.db.sales_invoices.toArray();
        const activeSales = sales.filter(s => !s.deleted);

        // Filter
        let filtered = activeSales.filter(s => {
            return s.clientName.toLowerCase().includes(search) ||
                s.invoiceNumber.toString().includes(search);
        });

        // Sort by Date DESC
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-file-text" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay ventas registradas</h3>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(sale => `
            <div class="card" style="padding:16px; display:grid; grid-template-columns: 1fr 1fr auto; align-items:center; gap:16px;">
                <div>
                    <div style="font-weight:600; font-size:1.05rem;">${sale.clientName}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">
                        <i class="ph ph-hash"></i> ${sale.invoiceNumber} • ${formatDate(sale.date)}
                    </div>
                </div>
                <div>
                    <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${formatCurrency(sale.total)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Items: ${sale.items.length}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary btn-pdf-sale" data-id="${sale.id}" title="Descargar PDF" style="font-size:0.8rem;">
                        <i class="ph ph-file-pdf"></i> PDF
                    </button>
                    <button class="btn btn-icon btn-delete-sale" data-id="${sale.id}" title="Eliminar" style="color:var(--error);">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach Events
        document.querySelectorAll('.btn-delete-sale').forEach(btn =>
            btn.addEventListener('click', (e) => handleDeleteSale(Number(e.currentTarget.dataset.id)))
        );
        document.querySelectorAll('.btn-pdf-sale').forEach(btn =>
            btn.addEventListener('click', (e) => generateInvoicePDF(Number(e.currentTarget.dataset.id)))
        );

    } catch (e) {
        console.error(e);
        list.innerHTML = `<div style="color:red">Error cargando ventas</div>`;
    }
}

// --- CRUD ---
async function handleDeleteSale(id) {
    if (confirm('¿Eliminar esta venta?')) {
        try {
            await window.db.sales_invoices.update(id, { deleted: true });
            renderSales();
            // Cloud Sync
            if (window.Sync?.client) {
                await window.Sync.client.from('sales_invoices').update({ deleted: true }).eq('id', id);
            }
        } catch (e) { alert('Error: ' + e.message); }
    }
}

// --- MODAL ---
async function showSaleModal() {
    const products = await window.db.products.toArray();
    const activeProducts = products.filter(p => !p.deleted);

    // Auto-generate invoice number (next available)
    const sales = await window.db.sales_invoices.toArray();
    const lastNum = sales.length > 0 ? Math.max(...sales.map(s => parseInt(s.invoiceNumber) || 0)) : 0;
    const nextNum = lastNum + 1;

    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="modal" style="max-width:800px;">
            <div class="modal-header">
                <h3 class="modal-title">Nueva Venta</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
                    <div class="form-group">
                        <label class="form-label">Cliente</label>
                        <input type="text" id="sale-client" class="form-input" placeholder="Nombre del cliente" required>
                    </div>
                     <div class="form-group">
                        <label class="form-label">Fecha</label>
                        <input type="date" id="sale-date" class="form-input" value="${today}">
                    </div>
                </div>

                <div style="background:var(--bg-input); padding:16px; border-radius:8px; margin-bottom:20px;">
                    <h4 style="margin-bottom:12px; font-size:0.9rem;">Agregar Productos</h4>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="prod-search" class="form-input" placeholder="Buscar producto..." list="product-list-datalist" style="flex:1;">
                        <datalist id="product-list-datalist">
                            ${activeProducts.map(p => `<option value="${p.name}" data-price="${p.salePrice}">$${p.salePrice}</option>`).join('')}
                        </datalist>
                        <input type="number" id="prod-qty" class="form-input" placeholder="Cant." value="1" style="width:80px;">
                        <button class="btn btn-secondary" id="btn-add-item"><i class="ph ph-plus"></i></button>
                    </div>
                </div>

                <!-- Items Table -->
                <table style="width:100%; font-size:0.85rem; border-collapse:collapse;" id="sale-items-table">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); text-align:left;">
                            <th style="padding:8px;">Producto</th>
                            <th style="padding:8px; width:60px;">Cant.</th>
                            <th style="padding:8px; width:80px;">Precio</th>
                            <th style="padding:8px; width:80px;">Total</th>
                            <th style="padding:8px; width:40px;"></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                    <tfoot>
                        <tr style="border-top:2px solid var(--border); font-weight:bold;">
                            <td colspan="3" style="padding:12px; text-align:right;">Total:</td>
                            <td style="padding:12px;" id="sale-total-display">$0</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>

            </div>
            <div class="modal-footer">
                <div style="flex:1; font-size:0.85rem; color:var(--text-muted);">
                    N° Factura: <b>${nextNum}</b>
                </div>
                <button class="btn btn-primary" id="btn-save-sale">Generar Venta</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Cart Logic
    const cart = [];
    const tbody = document.querySelector('#sale-items-table tbody');
    const totalDisplay = document.getElementById('sale-total-display');
    const prodInput = document.getElementById('prod-search');

    const updateCart = () => {
        tbody.innerHTML = cart.map((item, index) => `
            <tr style="border-bottom:1px solid var(--bg-input);">
                <td style="padding:8px;">${item.name}</td>
                <td style="padding:8px;">${item.qty}</td>
                <td style="padding:8px;">${formatCurrency(item.price)}</td>
                <td style="padding:8px;">${formatCurrency(item.price * item.qty)}</td>
                <td style="padding:8px;">
                    <i class="ph ph-trash" style="cursor:pointer; color:var(--error);" onclick="removeCartItem(${index})"></i>
                </td>
            </tr>
        `).join('');

        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        totalDisplay.textContent = formatCurrency(total);
        totalDisplay.dataset.value = total;

        // Expose remove function globally for onclick
        window.removeCartItem = (idx) => {
            cart.splice(idx, 1);
            updateCart();
        };
    };

    document.getElementById('btn-add-item').addEventListener('click', () => {
        const name = prodInput.value;
        const qty = parseInt(document.getElementById('prod-qty').value) || 1;

        const product = activeProducts.find(p => p.name === name);
        let price = product ? parseFloat(product.salePrice) : 0;

        if (!product) {
            // Manual entry? Ask for price
            const manualPrice = prompt("Producto no encontrado. Ingresa el precio:", "0");
            if (manualPrice === null) return;
            price = parseFloat(manualPrice);
        }

        if (name && qty > 0) {
            cart.push({ name, qty, price });
            updateCart();
            prodInput.value = '';
            prodInput.focus();
        }
    });

    document.getElementById('btn-save-sale').addEventListener('click', async () => {
        const clientName = document.getElementById('sale-client').value.trim();
        const date = document.getElementById('sale-date').value;
        const total = parseFloat(totalDisplay.dataset.value) || 0;

        if (!clientName || cart.length === 0) {
            alert('Falta cliente o productos');
            return;
        }

        // ✅ DUPLICATE CHECK: Verify invoice number doesn't already exist
        const allSales = await window.db.sales_invoices.toArray();
        const activeSales = allSales.filter(s => !s.deleted);
        const duplicateExists = activeSales.some(sale =>
            sale.invoiceNumber.toString() === nextNum.toString()
        );

        if (duplicateExists) {
            alert(`❌ Ya existe una factura de venta con el número "${nextNum}".\n\nEsto no debería pasar (error en auto-numeración). Contacta soporte.`);
            return;
        }

        try {
            const saleData = {
                id: Date.now(),
                invoiceNumber: nextNum,
                clientName,
                date,
                items: cart,
                total,
                paymentStatus: 'Pagado',
                deleted: false
            };

            await window.db.sales_invoices.add(saleData);

            // Deduct stock (Advanced: Implementing later/simplified now)
            // For now just recording sale

            // Cloud Sync
            if (window.Sync?.client) {
                await window.Sync.client.from('sales_invoices').insert([saleData]);
            }

            modal.classList.add('hidden');
            renderSales();

            if (confirm('Venta guardada. ¿Generar PDF?')) {
                generateInvoicePDF(saleData.id);
            }

        } catch (e) { alert('Error: ' + e.message); }
    });
}

// --- PDF GENERATION ---
async function generateInvoicePDF(id) {
    const sale = await window.db.sales_invoices.get(id);
    if (!sale) return;

    if (!window.jspdf) {
        alert('Cargando librería PDF, intenta en 5 segundos...');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38); // Red
    doc.text('EL MARAVILLOSO', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Factura de Venta', 14, 26);

    // Info
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Cliente: ${sale.clientName}`, 14, 40);
    doc.text(`Fecha: ${formatDate(sale.date)}`, 14, 46);

    doc.text(`N° Documento: ${String(sale.invoiceNumber).padStart(6, '0')}`, 150, 40);

    // Table
    const tableData = sale.items.map(item => [
        item.name,
        item.qty,
        formatCurrency(item.price),
        formatCurrency(item.price * item.qty)
    ]);

    doc.autoTable({
        startY: 55,
        head: [['Producto', 'Cant.', 'Precio', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] },
        foot: [['', '', 'TOTAL:', formatCurrency(sale.total)]]
    });

    // Save
    doc.save(`Factura_${sale.invoiceNumber}_${sale.clientName}.pdf`);
}

async function exportSalesToExcel() {
    try {
        const sales = await window.db.sales_invoices.toArray();
        const activeSales = sales.filter(s => !s.deleted);

        const data = activeSales.map(s => ({
            Fecha: s.date,
            N_Factura: s.invoiceNumber,
            Cliente: s.clientName,
            Total: s.total,
            Items: s.items.length
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");
        XLSX.writeFile(wb, `Ventas_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
        alert('Error: ' + e.message);
    }
}
