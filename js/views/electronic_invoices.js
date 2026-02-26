// Electronic Invoices View (SII Integration)
window.Views = window.Views || {};

window.Views.electronic_invoices = async (container) => {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div>
                <h1 class="mb-2 text-primary flex items-center gap-2">
                    <i class="ph ph-file-arrow-up"></i> Facturas Electrónicas SII
                </h1>
                <p class="text-muted">Emisión automática de DTE a proveedores/clientes</p>
            </div>
            <button class="btn btn-primary" id="btn-new-dte">
                <i class="ph ph-plus-circle"></i> Nueva Factura (DTE)
            </button>
        </div>

        <div class="grid grid-2 gap-4 mb-6">
            <div class="card p-4">
                <h3 class="font-bold mb-3 text-sm flex items-center gap-2"><i class="ph ph-broadcast"></i> ESTADO API SII</h3>
                <div id="api-status" class="flex items-center gap-2 text-muted">
                    <i class="ph ph-circle-fill" style="color:#fbbf24;"></i> Configurando...
                </div>
            </div>
            <div class="card p-4">
                <h3 class="font-bold mb-3 text-sm flex items-center gap-2"><i class="ph ph-chart-pie"></i> RESUMEN MES</h3>
                <div class="text-2xl font-bold text-primary" id="total-month-dte">$0</div>
            </div>
        </div>

        <div id="dte-list" class="flex-col gap-3">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando registros...</p>
            </div>
        </div>
    `;

    renderDTEs();

    document.getElementById('btn-new-dte').addEventListener('click', () => showDTEModal());
};

async function renderDTEs() {
    const list = document.getElementById('dte-list');
    if (!list) return;

    try {
        const dtes = await window.db.electronic_invoices.toArray();
        if (dtes.length === 0) {
            list.innerHTML = `
                <div class="p-8 text-center" style="background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-file-text mb-3 text-muted" style="font-size:3rem;"></i>
                    <h3 class="text-muted">No hay facturas emitidas</h3>
                    <p class="text-muted text-sm">Las facturas enviadas al SII aparecerán aquí.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = dtes.reverse().map(dte => `
            <div class="card p-4 flex flex-col gap-4">
                <div class="flex justify-between items-start gap-3">
                    <div style="flex:1;">
                        <div class="font-bold text-primary" style="font-size:1.1rem;">${dte.receiverName}</div>
                        <div class="text-xs text-muted mt-1">
                            <i class="ph ph-identification-card"></i> ${dte.receiverRut} 
                            <span style="margin:0 6px;">•</span> 
                            <i class="ph ph-calendar-blank"></i> ${dte.date}
                        </div>
                    </div>
                    <div class="badge ${dte.status === 'Enviado' ? 'badge-up' : 'badge-down'}" style="padding:4px 10px; font-weight:700;">
                        ${dte.status}
                    </div>
                </div>

                <div class="flex justify-between items-center pt-3" style="border-top: 1px dashed var(--border);">
                    <div>
                        <div class="text-xs text-muted uppercase font-bold letter-spacing-1">Folio: ${dte.folio || 'Pendiente'}</div>
                        <div class="text-xl font-bold text-primary mt-1">${window.Utils.formatCurrency(dte.total)}</div>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-icon btn-secondary" style="width:40px; height:40px;" title="Ver PDF" onclick="window.open('${dte.pdfUrl}', '_blank')"><i class="ph ph-file-pdf"></i></button>
                        ${dte.status !== 'Enviado' ? `<button class="btn btn-icon btn-primary" style="width:40px; height:40px;" title="Reintentar"> <i class="ph ph-arrows-clockwise"></i> </button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (e) { list.innerHTML = 'Error cargando DTEs'; }
}

async function showDTEModal() {
    const suppliers = await window.db.suppliers.toArray();
    const activeSuppliers = suppliers.filter(s => !s.deleted);

    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="modal" style="max-width:700px;">
            <div class="modal-header">
                <h3 class="modal-title">Emisión de Factura SII</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="p-6 flex-col gap-4">
                
                <div class="card p-3" style="background:var(--bg-input);">
                    <label class="form-label font-bold mb-1">Empresa / Proveedor Destino</label>
                    <select id="dte-supplier-select" class="form-input">
                        <option value="">-- Nuevo o Seleccionar --</option>
                        ${activeSuppliers.map(s => `<option value="${s.id}" data-rut="${s.rut || ''}" data-giro="${s.giro || ''}" data-address="${s.address || ''}">${s.name}</option>`).join('')}
                    </select>
                </div>

                <div class="grid grid-2 gap-3">
                    <div class="form-group">
                        <label class="form-label">Razón Social Receptora</label>
                        <input type="text" id="dte-name" class="form-input" placeholder="Nombre completo">
                    </div>
                    <div class="form-group">
                        <label class="form-label">RUT Receptora</label>
                        <input type="text" id="dte-rut" class="form-input" placeholder="12.345.678-9">
                    </div>
                </div>

                <div class="grid grid-2 gap-3">
                    <div class="form-group">
                        <label class="form-label">Giro</label>
                        <input type="text" id="dte-giro" class="form-input" placeholder="Giro Comercial">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Dirección</label>
                        <input type="text" id="dte-address" class="form-input" placeholder="Calle #123, Comuna">
                    </div>
                </div>

                <div class="divider"></div>

                <div class="p-4 rounded-lg" style="background:rgba(0,0,0,0.02); border:1px solid var(--border);">
                    <h4 class="mb-3 font-bold text-sm">DETALLE DE FACTURA</h4>
                    <div class="flex gap-2 mb-4">
                        <input type="text" id="item-name" class="form-input" placeholder="Descripción..." style="flex:2;">
                        <input type="number" id="item-price" class="form-input" placeholder="Neto $" style="flex:1;">
                        <button class="btn btn-primary" id="btn-add-dte-item"><i class="ph ph-plus"></i></button>
                    </div>
                    <table class="w-full text-sm" id="dte-items-table">
                        <tbody id="dte-items-body"></tbody>
                        <tfoot class="font-bold">
                            <tr>
                                <td class="pt-3">TOTAL NETO:</td>
                                <td id="dte-neto" class="pt-3 text-right">$0</td>
                            </tr>
                            <tr class="text-muted">
                                <td>IVA (19%):</td>
                                <td id="dte-iva" class="text-right">$0</td>
                            </tr>
                            <tr class="text-xl text-primary font-bold">
                                <td class="pt-2">TOTAL BRUTO:</td>
                                <td id="dte-total" class="pt-2 text-right">$0</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            </div>
            <div class="modal-footer p-6 gap-3">
                <button class="btn btn-secondary flex-1" id="btn-copy-dte-data">
                    <i class="ph ph-copy"></i> Copiar Datos
                </button>
                <button class="btn btn-primary" id="btn-emit-dte" style="flex:2;">
                    <i class="ph ph-paper-plane-tilt"></i> EMITIR FACTURA ELECTRÓNICA
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Logic: Auto-fill from select
    const select = document.getElementById('dte-supplier-select');
    select.addEventListener('change', () => {
        const opt = select.options[select.selectedIndex];
        if (!opt.value) return;
        document.getElementById('dte-name').value = opt.text;
        document.getElementById('dte-rut').value = opt.dataset.rut;
        document.getElementById('dte-giro').value = opt.dataset.giro;
        document.getElementById('dte-address').value = opt.dataset.address;
    });

    // Logic: Items & Totals
    const items = [];
    const updateTotals = () => {
        const neto = items.reduce((sum, i) => sum + i.price, 0);
        const iva = Math.round(neto * 0.19);
        const total = neto + iva;

        document.getElementById('dte-neto').textContent = window.Utils.formatCurrency(neto);
        document.getElementById('dte-iva').textContent = window.Utils.formatCurrency(iva);
        document.getElementById('dte-total').textContent = window.Utils.formatCurrency(total);

        document.getElementById('dte-items-body').innerHTML = items.map((it, idx) => `
            <tr>
                <td>${it.name}</td>
                <td style="text-align:right;">${window.Utils.formatCurrency(it.price)} <i class="ph ph-trash" style="color:var(--error); cursor:pointer;" onclick="removeItem(${idx})"></i></td>
            </tr>
        `).join('');

        window.removeItem = (idx) => { items.splice(idx, 1); updateTotals(); };
    };

    document.getElementById('btn-add-dte-item').addEventListener('click', () => {
        const n = document.getElementById('item-name').value;
        const p = parseInt(document.getElementById('item-price').value);
        if (n && p > 0) {
            items.push({ name: n, price: p });
            updateTotals();
            document.getElementById('item-name').value = '';
            document.getElementById('item-price').value = '';
        }
    });

    document.getElementById('btn-copy-dte-data').addEventListener('click', () => {
        const text = `FACTURA PARA: ${document.getElementById('dte-name').value}\nRUT: ${document.getElementById('dte-rut').value}\nGIRO: ${document.getElementById('dte-giro').value}\nTOTAL: ${document.getElementById('dte-total').textContent}`;
        navigator.clipboard.writeText(text);
        alert('Datos copiados al portapapeles');
    });

    // Logic: EMIT
    document.getElementById('btn-emit-dte').addEventListener('click', async () => {
        const name = document.getElementById('dte-name').value.trim();
        const rut = document.getElementById('dte-rut').value.trim();
        const giro = document.getElementById('dte-giro').value.trim();
        const address = document.getElementById('dte-address').value.trim();

        if (!name || !rut || items.length === 0) {
            alert('Falta nombre, RUT o productos');
            return;
        }

        const btn = document.getElementById('btn-emit-dte');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Emitiendo...';

        try {
            // 1. Guardar proveedor si es nuevo o ha cambiado (Usando DataManager)
            const suppliers = await window.db.suppliers.toArray();
            const existing = suppliers.find(s => s.rut === rut);
            if (!existing) {
                await window.DataManager.saveAndSync('suppliers', { name, rut, giro, address, deleted: false });
                console.log("Nuevo proveedor guardado automáticamente");
            } else if (existing.giro !== giro || existing.address !== address) {
                await window.DataManager.saveAndSync('suppliers', { id: existing.id, giro, address });
            }

            // 2. Envío Real usando SII_API
            try {
                const result = await window.SII_API.emitirFactura({
                    receiverName: name,
                    receiverRut: rut,
                    receiverGiro: giro,
                    receiverAddress: address,
                    items: items
                });

                if (result.success) {
                    const dteEntry = {
                        date: today,
                        receiverName: name,
                        receiverRut: rut,
                        total: items.reduce((sum, i) => sum + i.price, 0) * 1.19,
                        status: 'Enviado',
                        folio: result.folio,
                        pdfUrl: result.pdfUrl
                    };
                    await window.DataManager.saveAndSync('electronic_invoices', dteEntry);

                    alert(`¡Factura Folio ${result.folio} emitida con éxito!`);
                    modal.classList.add('hidden');
                    renderDTEs();
                }
            } catch (err) {
                alert('Error al emitir: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> EMITIR FACTURA ELECTRÓNICA';
            }

        } catch (e) {
            alert('Error: ' + e.message);
            btn.disabled = false;
        }
    });
};
