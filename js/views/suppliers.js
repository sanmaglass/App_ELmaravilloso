// Suppliers View
window.Views = window.Views || {};

window.Views.suppliers = async (container) => {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div>
                <h1 class="mb-2 text-primary flex items-center gap-2">
                    <i class="ph ph-package"></i> Proveedores
                </h1>
                <p class="text-muted">Gestión de distribuidores y empresas</p>
            </div>
            <button class="btn btn-primary" id="btn-add-supplier">
                <i class="ph ph-plus-circle"></i> Nuevo Proveedor
            </button>
        </div>

        <!-- Search Bar -->
        <div class="mb-4">
            <div class="w-full relative">
                <i class="ph ph-magnifying-glass absolute" style="left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="supplier-search" class="form-input" placeholder="Buscar proveedor..." style="padding-left:36px;">
            </div>
        </div>

        <!-- Suppliers List -->
        <div id="suppliers-list" class="grid-cols-auto gap-4">
            <div class="loading-state" style="grid-column:1/-1;">
                <div class="spinner"></div>
                <p>Cargando proveedores...</p>
            </div>
        </div>
    `;

    renderSuppliers();

    // Events
    document.getElementById('btn-add-supplier').addEventListener('click', showSupplierModal);
    document.getElementById('supplier-search').addEventListener('input', (e) => renderSuppliers(e.target.value));
};

// --- RENDER LOGIC ---
async function renderSuppliers(filterText = '') {
    const list = document.getElementById('suppliers-list');
    if (!list) return;

    try {
        const allSuppliers = await window.db.suppliers.toArray();
        const activeSuppliers = allSuppliers.filter(s => !s.deleted);

        let filtered = activeSuppliers;
        if (filterText) {
            const lowerFilter = filterText.toLowerCase();
            filtered = activeSuppliers.filter(s => s.name.toLowerCase().includes(lowerFilter));
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="p-6 text-center" style="grid-column: 1/-1; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-package mb-3 text-muted" style="font-size:3rem;"></i>
                    <h3 class="text-muted">No se encontraron proveedores</h3>
                </div>
            `;
            return;
        }

        // Sort alphabetically
        filtered.sort((a, b) => a.name.localeCompare(b.name));

        list.innerHTML = filtered.map(s => `
            <div class="card flex justify-between items-center p-4">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center font-bold text-primary" style="width:40px; height:40px; background:var(--bg-input); border-radius:50%;">
                        ${s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-primary" style="font-size:1.05rem;">${s.name}</div>
                        ${s.contact ? `<div class="text-muted" style="font-size:0.85rem;"><i class="ph ph-phone"></i> ${s.contact}</div>` : ''}
                    </div>
                </div>
                <div class="flex gap-2">
                     <button class="btn btn-icon btn-edit-supplier" data-id="${s.id}" title="Editar">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn btn-icon btn-delete-supplier text-danger" data-id="${s.id}" title="Eliminar">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach Event Listeners
        document.querySelectorAll('.btn-delete-supplier').forEach(btn =>
            btn.addEventListener('click', (e) => handleDeleteSupplier(Number(e.currentTarget.dataset.id)))
        );
        document.querySelectorAll('.btn-edit-supplier').forEach(btn =>
            btn.addEventListener('click', (e) => handleEditSupplier(Number(e.currentTarget.dataset.id)))
        );

    } catch (err) {
        console.error(err);
        list.innerHTML = `<div style="color:red;">Error cargando proveedores</div>`;
    }
}

// --- CRUD HANDLERS ---
async function handleDeleteSupplier(id) {
    if (confirm('¿Eliminar este proveedor?')) {
        try {
            await window.DataManager.deleteAndSync('suppliers', id);
            renderSuppliers(document.getElementById('supplier-search').value);
        } catch (e) { alert('Error: ' + e.message); }
    }
}

async function handleEditSupplier(id) {
    const supplier = await window.db.suppliers.get(id);
    if (supplier) showSupplierModal(supplier);
}

// --- MODAL & FORM ---
function showSupplierModal(supplierToEdit = null) {
    const modal = document.getElementById('modal-container');
    const isEdit = !!supplierToEdit;

    modal.innerHTML = `
        <div class="modal" style="max-width:500px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="p-6">
                <div class="form-group mb-4">
                    <label class="form-label">Nombre de Empresa *</label>
                    <input type="text" id="sup-name" class="form-input" required value="${isEdit ? supplierToEdit.name : ''}">
                </div>
                <div class="grid grid-2 gap-3 mb-4">
                    <div class="form-group">
                        <label class="form-label">RUT</label>
                        <input type="text" id="sup-rut" class="form-input" placeholder="12.345.678-9" value="${isEdit ? (supplierToEdit.rut || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Giro</label>
                        <input type="text" id="sup-giro" class="form-input" placeholder="Venta de..." value="${isEdit ? (supplierToEdit.giro || '') : ''}">
                    </div>
                </div>
                <div class="form-group mb-4">
                    <label class="form-label">Dirección</label>
                    <input type="text" id="sup-address" class="form-input" placeholder="Calle #123, Comuna" value="${isEdit ? (supplierToEdit.address || '') : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Contacto / Teléfono</label>
                    <input type="text" id="sup-contact" class="form-input" value="${isEdit ? (supplierToEdit.contact || '') : ''}">
                </div>
            </div>
            <div class="modal-footer p-6">
                <button class="btn btn-primary w-full" id="btn-save-supplier">
                    <i class="ph ph-floppy-disk"></i> ${isEdit ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('btn-save-supplier').addEventListener('click', async () => {
        const name = document.getElementById('sup-name').value.trim();
        const rut = document.getElementById('sup-rut').value.trim();
        const giro = document.getElementById('sup-giro').value.trim();
        const address = document.getElementById('sup-address').value.trim();
        const contact = document.getElementById('sup-contact').value.trim();

        if (!name) { alert('El nombre es obligatorio'); return; }

        try {
            const supplierData = { name, rut, giro, address, contact, deleted: false };
            if (isEdit) supplierData.id = supplierToEdit.id;

            await window.DataManager.saveAndSync('suppliers', supplierData);

            modal.classList.add('hidden');
            renderSuppliers();
        } catch (e) { alert('Error: ' + e.message); }
    });
}

