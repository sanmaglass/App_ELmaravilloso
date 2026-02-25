// Electronic Invoices View (SII Integration)
window.Views = window.Views || {};

window.Views.electronic_invoices = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-file-arrow-up" style="color:var(--primary);"></i> Facturas Electrónicas SII
                </h1>
                <p style="color:var(--text-muted);">Emisión automática de DTE a proveedores/clientes</p>
            </div>
            <button class="btn btn-primary" id="btn-new-dte">
                <i class="ph ph-plus-circle"></i> Nueva Factura (DTE)
            </button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
            <div class="card" style="padding:16px;">
                <h3 style="font-size:1rem; margin-bottom:12px;">Estado API SII</h3>
                <div id="api-status" style="display:flex; align-items:center; gap:8px; color:var(--text-muted);">
                    <i class="ph ph-circle-fill" style="color:#fbbf24;"></i> Configurando...
                </div>
            </div>
            <div class="card" style="padding:16px;">
                <h3 style="font-size:1rem; margin-bottom:12px;">Resumen Mes</h3>
                <div style="font-size:1.5rem; font-weight:bold; color:var(--primary);" id="total-month-dte">$0</div>
            </div>
        </div>

        <div id="dte-list" style="display:flex; flex-direction:column; gap:12px;">
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
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-file-text" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay facturas emitidas</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem;">Las facturas enviadas al SII aparecerán aquí.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = dtes.reverse().map(dte => `
            <div class="card" style="padding:16px; display:grid; grid-template-columns: 1fr 1fr auto auto; align-items:center; gap:16px;">
                <div>
                    <div style="font-weight:600;">${dte.receiverName}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${dte.receiverRut} • ${dte.date}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:var(--primary);">${window.Utils.formatCurrency(dte.total)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">Folio: ${dte.folio || 'Pendiente'}</div>
                </div>
                <div style="padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold; background:${dte.status === 'Enviado' ? '#dcfce7' : '#fee2e2'}; color:${dte.status === 'Enviado' ? '#166534' : '#991b1b'};">
                    ${dte.status}
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-icon" title="Ver PDF" onclick="window.open('${dte.pdfUrl}', '_blank')"><i class="ph ph-file-pdf"></i></button>
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
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
                
                <div class="card" style="background:#f8fafc; padding:12px;">
                    <label class="form-label">Seleccionar Empresa / Proveedor</label>
                    <select id="dte-supplier-select" class="form-input">
                        <option value="">-- Nuevo o Seleccionar --</option>
                        ${activeSuppliers.map(s => `<option value="${s.id}" data-rut="${s.rut || ''}" data-giro="${s.giro || ''}" data-address="${s.address || ''}">${s.name}</option>`).join('')}
                    </select>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label class="form-label">Razón Social Receptora</label>
                        <input type="text" id="dte-name" class="form-input" placeholder="Nombre de la empresa">
                    </div>
                    <div class="form-group">
                        <label class="form-label">RUT Receptora</label>
                        <input type="text" id="dte-rut" class="form-input" placeholder="12.345.678-9">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label class="form-label">Giro</label>
                        <input type="text" id="dte-giro" class="form-input" placeholder="Giro Comercial">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Dirección</label>
                        <input type="text" id="dte-address" class="form-input" placeholder="Calle #123, Comuna">
                    </div>
                </div>

                <hr style="border:none; border-top:1px solid var(--border);">

                <div style="background:var(--bg-input); padding:16px; border-radius:8px;">
                    <h4 style="margin-bottom:12px; font-size:0.9rem;">Detalle de Factura</h4>
                    <div style="display:flex; gap:8px; margin-bottom:12px;">
                        <input type="text" id="item-name" class="form-input" placeholder="Descripción del producto" style="flex:2;">
                        <input type="number" id="item-price" class="form-input" placeholder="Precio Neto" style="flex:1;">
                        <button class="btn btn-secondary" id="btn-add-dte-item"><i class="ph ph-plus"></i></button>
                    </div>
                    <table style="width:100%; font-size:0.85rem;" id="dte-items-table">
                        <tbody id="dte-items-body"></tbody>
                        <tfoot>
                            <tr>
                                <td style="padding-top:12px; font-weight:bold;">TOTAL NETO:</td>
                                <td id="dte-neto" style="padding-top:12px; text-align:right;">$0</td>
                            </tr>
                            <tr>
                                <td style="color:var(--text-muted);">IVA (19%):</td>
                                <td id="dte-iva" style="text-align:right; color:var(--text-muted);">$0</td>
                            </tr>
                            <tr style="font-size:1.1rem; font-weight:bold; color:var(--primary);">
                                <td>TOTAL:</td>
                                <td id="dte-total">$0</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            </div>
            <div class="modal-footer" style="gap:12px;">
                <button class="btn btn-secondary" id="btn-copy-dte-data" title="Copia datos para el SII manual">
                    <i class="ph ph-copy"></i> Copiar Datos
                </button>
                <button class="btn btn-primary" id="btn-emit-dte" style="flex:1;">
                    <i class="ph ph-paper-plane-tilt"></i> EMITIR FACTURA (SII)
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

    // Logic: Copy to clipboard
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
            // 1. Guardar proveedor si es nuevo o ha cambiado
            const suppliers = await window.db.suppliers.toArray();
            const existing = suppliers.find(s => s.rut === rut);
            if (!existing) {
                const newSup = { id: Date.now(), name, rut, giro, address, deleted: false };
                await window.db.suppliers.add(newSup);
                console.log("Nuevo proveedor guardado automáticamente");
            } else if (existing.giro !== giro || existing.address !== address) {
                await window.db.suppliers.update(existing.id, { giro, address });
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
                        id: Date.now(),
                        date: today,
                        receiverName: name,
                        receiverRut: rut,
                        total: items.reduce((sum, i) => sum + i.price, 0) * 1.19,
                        status: 'Enviado',
                        folio: result.folio,
                        pdfUrl: result.pdfUrl
                    };
                    await window.db.electronic_invoices.add(dteEntry);

                    alert(`¡Factura Folio ${result.folio} emitida con éxito!`);
                    modal.classList.add('hidden');
                    renderDTEs();
                }
            } catch (err) {
                alert('Error al emitir: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> EMITIR FACTURA (SII)';
            }

        } catch (e) {
            alert('Error: ' + e.message);
            btn.disabled = false;
        }
    });
};
