// Loans View (Préstamos a Proveedores)
window.Views = window.Views || {};

window.Views.loans = async (container, filterSupplierId = null) => {
    try {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="mb-2 text-primary flex items-center gap-2">
                        <i class="ph ph-hand-coins"></i> Préstamos a Proveedores
                    </h1>
                    <p class="text-muted">Control de insumos y dinero prestado</p>
                </div>
                <button class="btn btn-primary" id="btn-add-loan">
                    <i class="ph ph-plus-circle"></i> Nuevo Préstamo
                </button>
            </div>

            <!-- 📊 LOANS ANALYTICS -->
            <div id="loans-analytics" class="grid-cols-auto gap-4 mb-6" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <!-- Stats cards will be injected here -->
            </div>

            <div class="filters-bar mb-4">
                <div style="position:relative; flex: 2 1 300px;">
                    <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                    <input type="text" id="loan-search" class="form-input" placeholder="Buscar por ítem o proveedor..." style="padding-left:36px; width:100%;">
                </div>
                <select id="filter-loan-supplier" class="form-input">
                    <option value="all">Todos los Proveedores</option>
                </select>
                <select id="filter-loan-status" class="form-input">
                    <option value="Pendiente">Pendientes</option>
                    <option value="Pagado">Historial (Pagados)</option>
                    <option value="all">Todos</option>
                </select>
                <select id="filter-loan-direction" class="form-input">
                    <option value="all">Cualquier Dirección</option>
                    <option value="to_supplier">Yo presté 📤</option>
                    <option value="from_supplier">Me prestaron 📥</option>
                </select>
            </div>

            <div id="loans-list" class="flex flex-col gap-4">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Cargando préstamos...</p>
                </div>
            </div>
        `;

        // State for the view
        const viewState = {
            supplierId: filterSupplierId,
            status: 'Pendiente',
            direction: 'all'
        };

        if (filterSupplierId) {
            document.getElementById('filter-loan-supplier').value = filterSupplierId;
        }

        // Initialize View
        await populateLoanSuppliers();
        await renderLoans();

        // Events
        document.getElementById('btn-add-loan').addEventListener('click', () => showLoanModal());
        document.getElementById('loan-search').addEventListener('input', () => renderLoans());
        document.getElementById('filter-loan-supplier').addEventListener('change', (e) => {
            viewState.supplierId = e.target.value === 'all' ? null : Number(e.target.value);
            renderLoans();
        });
        document.getElementById('filter-loan-status').addEventListener('change', (e) => {
            viewState.status = e.target.value;
            renderLoans();
        });
        document.getElementById('filter-loan-direction').addEventListener('change', (e) => {
            viewState.direction = e.target.value;
            renderLoans();
        });

        // Real-time listener
        const syncHandler = () => {
            if (!document.getElementById('loans-list')) {
                window.removeEventListener('sync-data-updated', syncHandler);
                return;
            }
            renderLoans();
        };
        window.addEventListener('sync-data-updated', syncHandler);

        // --- INTERNAL FUNCTIONS ---

    async function populateLoanSuppliers() {
        const select = document.getElementById('filter-loan-supplier');
        const suppliers = await window.db.suppliers.toArray();
        const activeSuppliers = suppliers.filter(s => !s.deleted).sort((a,b) => a.name.localeCompare(b.name));
        
        activeSuppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (viewState.supplierId == s.id) opt.selected = true;
            select.appendChild(opt);
        });
    }

    async function renderLoans() {
        const list = document.getElementById('loans-list');
        const searchTerm = document.getElementById('loan-search').value.toLowerCase();
        const statusFilter = document.getElementById('filter-loan-status').value;
        const supplierFilter = document.getElementById('filter-loan-supplier').value;
        const directionFilter = document.getElementById('filter-loan-direction').value;

        try {
            const [loans, suppliers] = await Promise.all([
                window.db.loans.toArray(),
                window.db.suppliers.toArray()
            ]);

            const supplierMap = window.Utils.createSupplierMap(suppliers);

            // Filter
            let filtered = loans.filter(l => !l.deleted);

            if (statusFilter !== 'all') {
                filtered = filtered.filter(l => l.status === statusFilter);
            }

            if (supplierFilter !== 'all') {
                filtered = filtered.filter(l => l.supplierId !== null && String(l.supplierId) === supplierFilter);
            }

            if (directionFilter !== 'all') {
                filtered = filtered.filter(l => l.direction === directionFilter);
            }

            if (searchTerm) {
                filtered = filtered.filter(l => {
                    const supName = (supplierMap[l.supplierId] || '').toLowerCase();
                    const item = (l.item || '').toLowerCase();
                    return supName.includes(searchTerm) || item.includes(searchTerm);
                });
            }

            // Sort by date DESC
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Analytics
            renderLoansAnalytics(filtered.filter(l => l.status === 'Pendiente'));

            if (filtered.length === 0) {
                list.innerHTML = `
                    <div class="card p-10 text-center text-muted border-dashed">
                        <i class="ph ph-hand-coins mb-2" style="font-size:3rem; opacity:0.3;"></i>
                        <p>No se encontraron préstamos registrados</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = filtered.map(l => {
                const isPaid = l.status === 'Pagado';
                const isToSupplier = l.direction === 'to_supplier';
                const color = isPaid ? 'var(--success)' : (isToSupplier ? 'var(--warning)' : 'var(--info)');
                const directionIcon = isToSupplier ? '📤' : '📥';
                const directionText = isToSupplier ? 'Yo presté' : 'Me prestaron';
                const supplierName = l.borrowerName || supplierMap[l.supplierId] || 'Persona Desconocida';
                
                return `
                    <div class="card p-4 flex justify-between items-center border-left-4" style="border-left-color: ${color}">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="badge" style="background:${isPaid ? 'rgba(16,185,129,0.1)' : (isToSupplier ? 'rgba(245,158,11,0.1)' : 'rgba(14,165,233,0.1)')}; color:${color}">
                                    ${directionIcon} ${directionText}
                                </span>
                                <span class="badge" style="background:${isPaid ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.05)'}; color:${isPaid ? 'var(--success)' : 'var(--text-muted)'}">
                                    ${isPaid ? 'Pagado' : 'Pendiente'}
                                </span>
                                <span class="text-muted text-xs">${formatDate(l.date)}</span>
                            </div>
                            <div class="font-bold text-lg">${Utils.escapeHTML(l.item)}</div>
                            <div class="text-sm text-muted">
                                <i class="ph ph-buildings"></i> ${Utils.escapeHTML(supplierName)} • 
                                <i class="ph ph-hash"></i> ${l.quantity} unidades • 
                                <i class="ph ph-money"></i> ${formatCurrency(l.total)}
                            </div>
                            ${isPaid ? `
                                <div class="mt-2 text-xs font-semibold py-1 px-2 bg-gray-100 rounded inline-flex items-center gap-1">
                                    <i class="ph ph-check-circle text-success"></i> 
                                    ${isToSupplier ? 'Devuelto' : 'Devolví'} por: <b>${l.repaymentType === 'Dinero' ? 'Dinero 💵' : 'Producto 📦'}</b> 
                                    el ${formatDate(l.repaymentDate)}
                                </div>
                            ` : ''}
                        </div>
                        <div class="flex gap-2">
                            ${!isPaid ? `
                                <button class="btn btn-success btn-sm btn-repay-loan" data-id="${l.id}" title="Marcar como pagado">
                                    <i class="ph ph-check"></i> Liquidar
                                </button>
                                <button class="btn btn-icon btn-edit-loan" data-id="${l.id}">
                                    <i class="ph ph-pencil-simple"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-icon btn-delete-loan text-danger" data-id="${l.id}">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Events
            document.querySelectorAll('.btn-repay-loan').forEach(btn => 
                btn.addEventListener('click', () => handleRepayLoan(Number(btn.dataset.id)))
            );
            document.querySelectorAll('.btn-edit-loan').forEach(btn => 
                btn.addEventListener('click', () => handleEditLoan(Number(btn.dataset.id)))
            );
            document.querySelectorAll('.btn-delete-loan').forEach(btn => 
                btn.addEventListener('click', () => handleDeleteLoan(Number(btn.dataset.id)))
            );

        } catch (err) {
            console.error(err);
            list.innerHTML = `<div class="error-state">Error cargando préstamos</div>`;
        }
    }

    function renderLoansAnalytics(pendingLoans) {
        const analytics = document.getElementById('loans-analytics');
        if (!analytics) return;

        const lentByMe = pendingLoans.filter(l => l.direction === 'to_supplier');
        const lentToMe = pendingLoans.filter(l => l.direction === 'from_supplier');

        const totalLentByMe = lentByMe.reduce((sum, l) => sum + (Number(l.total) || 0), 0);
        const totalLentToMe = lentToMe.reduce((sum, l) => sum + (Number(l.total) || 0), 0);

        analytics.innerHTML = `
            <div class="card p-4 border-left-4" style="border-left-color: var(--warning)">
                <div class="text-muted text-xs uppercase font-bold mb-1">Deben (Yo presté)</div>
                <div class="text-2xl font-bold" style="color:var(--warning)">${formatCurrency(totalLentByMe)}</div>
                <div class="text-xs text-muted">${lentByMe.length} registros</div>
            </div>
            <div class="card p-4 border-left-4" style="border-left-color: var(--info)">
                <div class="text-muted text-xs uppercase font-bold mb-1">Debo (Me prestaron)</div>
                <div class="text-2xl font-bold" style="color:var(--info)">${formatCurrency(totalLentToMe)}</div>
                <div class="text-xs text-muted">${lentToMe.length} registros</div>
            </div>
            <div class="card p-4 border-left-4" style="border-left-color: var(--primary)">
                <div class="text-muted text-xs uppercase font-bold mb-1">Total Pendientes</div>
                <div class="text-2xl font-bold">${pendingLoans.length}</div>
                <div class="text-xs text-muted">A través de ${new Set(pendingLoans.map(l => l.supplierId)).size} proveedores</div>
            </div>
        `;
    }

    async function showLoanModal(loanToEdit = null) {
        const suppliers = await window.db.suppliers.toArray();
        const activeSuppliers = suppliers.filter(s => !s.deleted).sort((a,b) => a.name.localeCompare(b.name));
        
        const modal = document.getElementById('modal-container');
        const isEdit = !!loanToEdit;
        const loanType = isEdit ? (loanToEdit.type || (loanToEdit.quantity === 1 && loanToEdit.unitPrice === loanToEdit.total ? 'Dinero' : 'Producto')) : 'Producto';

        modal.innerHTML = `
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3 class="modal-title">${isEdit ? 'Editar Préstamo' : 'Nuevo Préstamo'}</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="p-6">
                    <div class="form-group mb-4">
                        <label class="form-label">Dirección del Préstamo *</label>
                        <div class="flex gap-2">
                            <label class="flex-1 cursor-pointer">
                                <input type="radio" name="loan-direction" value="to_supplier" class="hidden peer" ${!isEdit || loanToEdit.direction === 'to_supplier' ? 'checked' : ''}>
                                <div class="p-3 border rounded text-center peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary transition-all">
                                    <i class="ph ph-export mb-1" style="font-size:1.2rem;"></i>
                                    <div class="text-xs font-boldUppercase">Yo presté</div>
                                </div>
                            </label>
                            <label class="flex-1 cursor-pointer">
                                <input type="radio" name="loan-direction" value="from_supplier" class="hidden peer" ${isEdit && loanToEdit.direction === 'from_supplier' ? 'checked' : ''}>
                                <div class="p-3 border rounded text-center peer-checked:border-info peer-checked:bg-info-light peer-checked:text-info transition-all">
                                    <i class="ph ph-import mb-1" style="font-size:1.2rem;"></i>
                                    <div class="text-xs font-boldUppercase">Me prestaron</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-group mb-4">
                        <label class="form-label">Tipo de Préstamo *</label>
                        <select id="loan-type" class="form-input">
                            <option value="Producto" ${loanType === 'Producto' ? 'selected' : ''}>📦 Producto / Insumo</option>
                            <option value="Dinero" ${loanType === 'Dinero' ? 'selected' : ''}>💵 Dinero (Efectivo/Transf.)</option>
                        </select>
                    </div>

                    <div class="form-group mb-4">
                        <label class="form-label">¿A quién va dirigido? *</label>
                        <div class="flex gap-2">
                            <label class="flex-1 cursor-pointer">
                                <input type="radio" name="loan-entity-type" value="supplier" class="hidden peer" ${!isEdit || loanToEdit.supplierId !== null ? 'checked' : ''}>
                                <div class="p-2 border rounded text-center peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary transition-all text-sm">
                                    Proveedor
                                </div>
                            </label>
                            <label class="flex-1 cursor-pointer">
                                <input type="radio" name="loan-entity-type" value="person" class="hidden peer" ${isEdit && loanToEdit.supplierId === null ? 'checked' : ''}>
                                <div class="p-2 border rounded text-center peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary transition-all text-sm">
                                    Persona
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-group mb-4" id="group-supplier" style="display: ${!isEdit || loanToEdit.supplierId !== null ? 'block' : 'none'};">
                        <label class="form-label">Proveedor *</label>
                        <select id="loan-supplier-id" class="form-input">
                            <option value="">Seleccionar proveedor...</option>
                            ${activeSuppliers.map(s => `
                                <option value="${s.id}" ${isEdit && loanToEdit.supplierId == s.id ? 'selected' : (viewState.supplierId == s.id ? 'selected' : '')}>
                                    ${Utils.escapeHTML(s.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group mb-4" id="group-person" style="display: ${isEdit && loanToEdit.supplierId === null ? 'block' : 'none'};">
                        <label class="form-label">Nombre de la Persona *</label>
                        <input type="text" id="loan-borrower-name" class="form-input" placeholder="Ej: Juan Pérez" value="${isEdit ? (loanToEdit.borrowerName || '') : ''}">
                    </div>

                    <div class="form-group mb-4">
                        <label class="form-label" id="label-item">Ítem / Descripción *</label>
                        <input type="text" id="loan-item" class="form-input" placeholder="Ej: Mangas de sushi" required value="${isEdit ? loanToEdit.item : ''}">
                    </div>

                    <!-- Fields for Product -->
                    <div id="fields-product" class="responsive-grid-2 gap-3 mb-4" style="display: ${loanType === 'Producto' ? 'grid' : 'none'};">
                        <div class="form-group">
                            <label class="form-label">Cantidad *</label>
                            <input type="number" id="loan-quantity" class="form-input" placeholder="0" value="${isEdit ? loanToEdit.quantity : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Precio Unit. (Est.)</label>
                            <input type="number" id="loan-unit-price" class="form-input" placeholder="0" value="${isEdit ? loanToEdit.unitPrice : ''}">
                        </div>
                    </div>

                    <!-- Fields for Money -->
                    <div id="fields-money" class="form-group mb-4" style="display: ${loanType === 'Dinero' ? 'block' : 'none'};">
                        <label class="form-label">Monto Total ($) *</label>
                        <input type="number" id="loan-total-money" class="form-input" placeholder="0" value="${isEdit ? loanToEdit.total : ''}">
                    </div>

                    <div class="form-group mb-4">
                        <label class="form-label">Fecha</label>
                        <input type="date" id="loan-date" class="form-input" value="${isEdit ? loanToEdit.date : new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notas / Observaciones</label>
                        <textarea id="loan-notes" class="form-input" style="min-height:80px;">${isEdit ? (loanToEdit.notes || '') : ''}</textarea>
                    </div>
                </div>
                <div class="modal-footer p-6">
                    <button class="btn btn-primary w-full" id="btn-save-loan">
                        <i class="ph ph-floppy-disk"></i> ${isEdit ? 'Actualizar Registro' : 'Guardar Préstamo'}
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');

        // Logic to toggle fields
        const typeSelect = document.getElementById('loan-type');
        const fieldsProduct = document.getElementById('fields-product');
        const fieldsMoney = document.getElementById('fields-money');
        const labelItem = document.getElementById('label-item');
        const entityTypeRadios = document.querySelectorAll('input[name="loan-entity-type"]');
        const groupSupplier = document.getElementById('group-supplier');
        const groupPerson = document.getElementById('group-person');

        entityTypeRadios.forEach(r => {
            r.addEventListener('change', () => {
                if (r.value === 'supplier') {
                    groupSupplier.style.display = 'block';
                    groupPerson.style.display = 'none';
                } else {
                    groupSupplier.style.display = 'none';
                    groupPerson.style.display = 'block';
                }
            });
        });

        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'Dinero') {
                fieldsProduct.style.display = 'none';
                fieldsMoney.style.display = 'block';
                labelItem.textContent = 'Descripción del Préstamo *';
                document.getElementById('loan-item').placeholder = 'Ej: Préstamo para caja chica';
            } else {
                fieldsProduct.style.display = 'grid';
                fieldsMoney.style.display = 'none';
                labelItem.textContent = 'Ítem / Producto *';
                document.getElementById('loan-item').placeholder = 'Ej: Mangas de sushi';
            }
        });

        document.getElementById('btn-save-loan').addEventListener('click', async () => {
            const direction = document.querySelector('input[name="loan-direction"]:checked').value;
            const entityType = document.querySelector('input[name="loan-entity-type"]:checked').value;
            const type = typeSelect.value;
            const supplierId = entityType === 'supplier' ? Number(document.getElementById('loan-supplier-id').value) : null;
            const borrowerName = entityType === 'person' ? document.getElementById('loan-borrower-name').value.trim() : null;
            const item = document.getElementById('loan-item').value.trim();
            const date = document.getElementById('loan-date').value;
            const notes = document.getElementById('loan-notes').value.trim();

            let quantity, unitPrice, total;

            if (type === 'Dinero') {
                total = Number(document.getElementById('loan-total-money').value);
                quantity = 1;
                unitPrice = total;
            } else {
                quantity = Number(document.getElementById('loan-quantity').value);
                unitPrice = Number(document.getElementById('loan-unit-price').value) || 0;
                total = quantity * unitPrice;
            }

            if ((entityType === 'supplier' && !supplierId) || (entityType === 'person' && !borrowerName) || !item || (type === 'Producto' && !quantity) || (type === 'Dinero' && !total)) {
                alert('Por favor completa los campos obligatorios (*)');
                return;
            }

            try {
                const loanData = {
                    supplierId,
                    borrowerName,
                    item,
                    quantity,
                    unitPrice,
                    total,
                    date,
                    notes,
                    direction,
                    type,
                    status: isEdit ? loanToEdit.status : 'Pendiente',
                    deleted: false
                };

                if (isEdit) {
                    loanData.id = loanToEdit.id;
                    if (loanToEdit.repaymentType) loanData.repaymentType = loanToEdit.repaymentType;
                    if (loanToEdit.repaymentDate) loanData.repaymentDate = loanToEdit.repaymentDate;
                }

                await window.DataManager.saveAndSync('loans', loanData);
                modal.classList.add('hidden');
                renderLoans();
            } catch (e) {
                alert('Error: ' + e.message);
            }
        });
    }

    async function handleRepayLoan(id) {
        const loan = await window.db.loans.get(id);
        if (!loan) return;

        const isToSupplier = loan.direction === 'to_supplier';

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal" style="max-width:400px;">
                <div class="modal-header">
                    <h3 class="modal-title">Liquidar Préstamo</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')">
                        <i class="ph ph-x"></i>
                    </button>
                </div>
                <div class="p-6">
                    <p class="mb-4 text-sm">${isToSupplier ? `¿Cómo te devolvieron el préstamo de <b>${Utils.escapeHTML(loan.item)}</b>?` : `¿Cómo devolviste el préstamo de <b>${Utils.escapeHTML(loan.item)}</b>?`}</p>
                    
                    <div class="flex flex-col gap-3">
                        <button class="btn btn-secondary w-full flex justify-between items-center p-4 hover:bg-success-light" id="btn-repay-money">
                            <span class="flex items-center gap-2"><i class="ph ph-money text-success" style="font-size:1.5rem;"></i> Dinero en efectivo / Transferencia</span>
                            <i class="ph ph-caret-right"></i>
                        </button>
                        <button class="btn btn-secondary w-full flex justify-between items-center p-4 hover:bg-info-light" id="btn-repay-product">
                            <span class="flex items-center gap-2"><i class="ph ph-package text-info" style="font-size:1.5rem;"></i> Se devolvieron los productos</span>
                            <i class="ph ph-caret-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');

        const completeRepayment = async (type) => {
            try {
                await window.DataManager.saveAndSync('loans', {
                    ...loan,
                    status: 'Pagado',
                    repaymentType: type,
                    repaymentDate: new Date().toISOString().split('T')[0]
                });
                modal.classList.add('hidden');
                renderLoans();
                window.Sync.showToast(`Préstamo liquidado (${type})`, 'success');
            } catch (e) {
                alert('Error: ' + e.message);
            }
        };

        document.getElementById('btn-repay-money').addEventListener('click', () => completeRepayment('Dinero'));
        document.getElementById('btn-repay-product').addEventListener('click', () => completeRepayment('Producto'));
    }

    async function handleEditLoan(id) {
        const loan = await window.db.loans.get(id);
        if (loan) showLoanModal(loan);
    }

    async function handleDeleteLoan(id) {
        if (confirm('¿Eliminar este registro de préstamo?')) {
            try {
                await window.DataManager.deleteAndSync('loans', id);
                renderLoans();
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
    }
    } catch (err) {
        console.error('Error loading loans view:', err);
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--danger);">
                <p>Error al cargar los préstamos</p>
                <small>${err.message}</small>
            </div>
        `;
    }
};
