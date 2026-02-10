// Calculator & Inventory View
window.Views = window.Views || {};

window.Views.calculator = async (container) => {
    container.innerHTML = `
        <div class="responsive-grid-2-1" style="align-items:start;">
            
            <!-- SECTION 1: CALCULATOR -->
            <div class="card">
                <h2 style="margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                    <i class="ph ph-calculator" style="color:var(--accent);"></i> Calculadora de Precios
                </h2>

                <form id="calc-form">
                    <!-- PRODUCTO BASICO -->
                    <div class="form-group">
                        <label class="form-label">Nombre del Producto (Opcional)</label>
                        <input type="text" id="calc-name" class="form-input" placeholder="Ej. Leche Entera 1L (Caja 12)">
                    </div>

                    <!-- COSTOS -->
                    <div class="responsive-grid-2" style="margin-bottom:16px;">
                        <div class="form-group">
                            <label class="form-label">Costo Pack</label>
                            <input type="number" id="calc-cost" class="form-input" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Unidades</label>
                            <input type="number" id="calc-units" class="form-input" value="1">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:24px;">
                        <label class="form-label" style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="calc-is-neto">
                            <span>El precio ingresado es NETO (Sin IVA)</span>
                        </label>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
                            * Si activas esto, se sumará el 19% automáticamente al costo.
                        </div>
                    </div>

                    <!-- INVENTORY FIELDS -->
                    <div class="responsive-grid-2" style="margin-bottom:24px; padding:16px; background:rgba(220,38,38,0.05); border-radius:8px; border:1px dashed var(--primary);">
                        <div class="form-group">
                            <label class="form-label" style="color:var(--primary); font-weight:700;">Stock</label>
                            <input type="number" id="calc-stock" class="form-input" placeholder="Ej. 50" value="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="color:var(--primary); font-weight:700;">Vencimiento</label>
                            <input type="date" id="calc-expiry" class="form-input">
                        </div>
                    </div>

                    <!-- RESULTADOS COSTO UNITARIO -->
                    <div style="background:rgba(255,255,255,0.03); padding:16px; border-radius:8px; margin-bottom:24px;">
                        <div style="font-size:0.85rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Costo Unitario Real</div>
                        <div style="display:flex; justify-content:space-between; align-items:end;">
                            <div>
                                <span style="font-size:2rem; font-weight:700; color:var(--text-primary);" id="display-unit-cost">$0</span>
                                <span style="font-size:0.9rem; color:var(--text-muted);"> c/u (IVA Inc.)</span>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.8rem; color:var(--text-muted);">Neto: <span id="display-unit-net">$0</span></div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">IVA: <span id="display-unit-tax">$0</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- MARGEN Y VENTA -->
                    <h3 style="margin-bottom:16px; color:var(--accent);">Estrategia de Venta</h3>
                    
                    <div class="form-group">
                        <label class="form-label">Margen de Ganancia Deseado (%)</label>
                        <div style="display:flex; gap:12px; align-items:center;">
                            <input type="range" id="calc-margin-slider" min="5" max="100" value="30" step="5" style="flex:1;">
                            <input type="number" id="calc-margin-input" value="30" style="width:70px; padding:8px; border-radius:4px; border:1px solid var(--border); background:var(--bg-input); color:var(--text-primary); text-align:center;">
                            <span style="font-weight:bold;">%</span>
                        </div>
                    </div>

                    <!-- RESULTADO FINAL -->
                    <!-- RESULTADO FINAL -->
                    <div style="background: white; border:2px solid var(--primary); padding:24px; border-radius:16px; margin-top:24px; box-shadow: 0 10px 30px -5px rgba(220, 38, 38, 0.15);">
                         <div style="text-align:center; margin-bottom:16px;">
                            <div style="font-size:0.95rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Precio de Venta Sugerido</div>
                            <div style="font-size:3.5rem; font-weight:800; color:var(--primary); line-height:1.1; margin:8px 0;" id="display-sale-price">$0</div>
                            <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:500;">(Redondeado al peso)</div>
                         </div>
                         
                         <div class="responsive-grid-2" style="border-top:1px dashed var(--border); padding-top:16px;">
                            <div style="text-align:center;">
                                <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Ganancia Unidad</div>
                                <div style="font-size:1.2rem; font-weight:700; color:var(--success);" id="display-profit-unit">$0</div>
                            </div>
                            <div style="text-align:center;">
                                <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Ganancia Pack</div>
                                <div style="font-size:1.2rem; font-weight:700; color:var(--success);" id="display-profit-pack">$0</div>
                            </div>
                         </div>
                    </div>

                    <div style="margin-top:24px;">
                        <button type="button" id="btn-save-product" class="btn btn-primary" style="width:100%; justify-content:center;">
                            <i class="ph ph-floppy-disk"></i> Guardar en Inventario
                        </button>
                    </div>

                </form>
            </div>

            <!-- SECTION 2: INVENTORY LIST (Mini) -->
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3>Inventario Rápido</h3>
                    <button class="btn btn-icon" id="refresh-inv"><i class="ph ph-arrows-clockwise"></i></button>
                </div>
                <div id="inventory-list-mini" style="display:flex; flex-direction:column; gap:12px; max-height:600px; overflow-y:auto;">
                    <p style="color:var(--text-muted); font-size:0.9rem;">Cargando productos...</p>
                </div>
            </div>
        </div>
    `;

    // --- LOGIC ---
    const inputs = {
        name: document.getElementById('calc-name'),
        cost: document.getElementById('calc-cost'),
        units: document.getElementById('calc-units'),
        isNeto: document.getElementById('calc-is-neto'),
        marginSlider: document.getElementById('calc-margin-slider'),
        marginInput: document.getElementById('calc-margin-input')
    };

    const displays = {
        unitCost: document.getElementById('display-unit-cost'),
        unitNet: document.getElementById('display-unit-net'),
        unitTax: document.getElementById('display-unit-tax'),
        salePrice: document.getElementById('display-sale-price'),
        profitUnit: document.getElementById('display-profit-unit'),
        profitPack: document.getElementById('display-profit-pack')
    };

    let calculatedState = {
        unitCostGross: 0,
        finalPrice: 0
    };

    // Calculate Function
    const calculate = () => {
        const totalCost = Number(inputs.cost.value) || 0;
        const units = Number(inputs.units.value) || 1;
        const isNeto = inputs.isNeto.checked;
        const marginPct = Number(inputs.marginInput.value) || 0;

        // 1. Determine Unit Cost (Gross)
        // If cost is NETO, add tax first
        const taxInfo = window.Utils.calculateTaxDetails(totalCost, isNeto);
        const totalGross = taxInfo.gross;

        const unitGross = totalGross / units;
        const unitNet = taxInfo.net / units;
        const unitTax = taxInfo.tax / units;

        calculatedState.unitCostGross = unitGross;

        // Display Cost Details
        displays.unitCost.innerHTML = window.Utils.formatCurrency(unitGross);
        displays.unitNet.innerHTML = window.Utils.formatCurrency(unitNet);
        displays.unitTax.innerHTML = window.Utils.formatCurrency(unitTax);

        // 2. Determine Sale Price
        // Using "Margin on Sale" formula: Price = Cost / (1 - Margin%)
        // We use Gross Cost because in Chile small retail usually thinks in Gross prices
        const rawSalePrice = window.Utils.calculateSalePrice(unitGross, marginPct);

        // 3. Smart Rounding
        const finalPrice = window.Utils.smartRound(rawSalePrice);
        calculatedState.finalPrice = finalPrice;

        displays.salePrice.innerHTML = window.Utils.formatCurrency(finalPrice);

        // 4. Calculate Profits
        const profitUnit = finalPrice - unitGross;
        const profitPack = profitUnit * units;

        displays.profitUnit.innerHTML = window.Utils.formatCurrency(profitUnit);
        displays.profitPack.innerHTML = window.Utils.formatCurrency(profitPack);
    };

    // Events
    ['input', 'change'].forEach(evt => {
        inputs.cost.addEventListener(evt, calculate);
        inputs.units.addEventListener(evt, calculate);
        inputs.isNeto.addEventListener(evt, calculate);
        inputs.marginInput.addEventListener(evt, calculate);
        inputs.marginSlider.addEventListener(evt, () => {
            inputs.marginInput.value = inputs.marginSlider.value;
            calculate();
        });
    });

    // Reverse sync slider
    inputs.marginInput.addEventListener('input', () => {
        inputs.marginSlider.value = inputs.marginInput.value;
    });

    // Initial Run
    calculate();
    loadInventory(document.getElementById('inventory-list-mini'));

    // Save Button
    document.getElementById('btn-save-product').addEventListener('click', async () => {
        const name = inputs.name.value.trim() || 'Producto Sin Nombre';

        const newProduct = {
            name: name,
            buyPrice: Number(inputs.cost.value),
            units: Number(inputs.units.value),
            isNeto: inputs.isNeto.checked,
            margin: Number(inputs.marginInput.value),
            costUnit: calculatedState.unitCostGross,
            salePrice: calculatedState.finalPrice,
            stock: Number(document.getElementById('calc-stock').value) || 0,
            expiryDate: document.getElementById('calc-expiry').value || null,
            createdAt: new Date().toISOString(),
            deleted: false  // Soft delete field
        };

        try {
            newProduct.id = Date.now() + Math.floor(Math.random() * 1000);
            await window.db.products.add(newProduct);
            // Reset crucial fields
            inputs.name.value = '';

            // Sync Inmediato
            window.Sync.syncAll();

            // Toast or visual feedback?
            alert(`¡"${name}" guardado!`);
            loadInventory(document.getElementById('inventory-list-mini'));
        } catch (e) {
            alert('Error al guardar: ' + e.message);
        }
    });

    document.getElementById('refresh-inv').addEventListener('click', () => {
        loadInventory(document.getElementById('inventory-list-mini'));
    });
};

async function loadInventory(container) {
    try {
        const products = await window.db.products.toArray();
        // Filter out deleted products
        const activeProducts = products.filter(p => !p.deleted);

        if (activeProducts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No hay productos guardados.</div>';
            return;
        }

        container.innerHTML = activeProducts.reverse().map(p => `
            <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                <div style="font-weight:600; margin-bottom:4px;">${p.name}</div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
                    <span style="color:var(--text-muted);">Costo: ${window.Utils.formatCurrency(p.costUnit)}</span>
                    <span style="color:var(--accent); font-weight:600;">Venta: ${window.Utils.formatCurrency(p.salePrice)}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Inv error", e);
    }
}
