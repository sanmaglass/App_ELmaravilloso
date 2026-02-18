// Suppliers View
window.Views = window.Views || {};

window.Views.suppliers = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-package" style="color:var(--primary);"></i> Proveedores
                </h1>
                <p style="color:var(--text-muted);">Gestión de distribuidores y empresas</p>
            </div>
            <button class="btn btn-primary" id="btn-add-supplier">
                <i class="ph ph-plus-circle"></i> Nuevo Proveedor
            </button>
        </div>

        <!-- Search Bar -->
        <div style="margin-bottom:20px;">
            <div style="position:relative;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="supplier-search" class="form-input" placeholder="Buscar proveedor..." style="padding-left:36px; width:100%;">
            </div>
        </div>

        <!-- Suppliers List -->
        <div id="suppliers-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            <div class="loading-state" style="grid-column:1/-1;">
                <div class="spinner"></div>
                <p>Cargando proveedores...</p>
            </div>
        </div>
    `;

    // Auto-seed if empty (protected by localStorage flag)
    await seedSuppliersIfNeeded();

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
                <div style="grid-column: 1/-1; text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-package" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No se encontraron proveedores</h3>
                </div>
            `;
            return;
        }

        // Sort alphabetically
        filtered.sort((a, b) => a.name.localeCompare(b.name));

        list.innerHTML = filtered.map(s => `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:16px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:40px; height:40px; background:var(--bg-input); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--primary);">
                        ${s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:1.05rem;">${s.name}</div>
                        ${s.contact ? `<div style="font-size:0.85rem; color:var(--text-muted);"><i class="ph ph-phone"></i> ${s.contact}</div>` : ''}
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                     <button class="btn btn-icon btn-edit-supplier" data-id="${s.id}" title="Editar">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn btn-icon btn-delete-supplier" data-id="${s.id}" title="Eliminar" style="color:var(--error);">
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
            await window.db.suppliers.update(id, { deleted: true });
            renderSuppliers(document.getElementById('supplier-search').value);

            // Sync if available
            if (window.Sync?.client) {
                await window.Sync.client.from('suppliers').update({ deleted: true }).eq('id', id);
            }
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
            <div class="modal-body">
                <form id="supplier-form">
                    <div class="form-group">
                        <label class="form-label">Nombre de Empresa *</label>
                        <input type="text" id="sup-name" class="form-input" required value="${isEdit ? supplierToEdit.name : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Contacto / Teléfono</label>
                        <input type="text" id="sup-contact" class="form-input" value="${isEdit ? (supplierToEdit.contact || '') : ''}">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btn-save-supplier" style="width:100%;">
                    ${isEdit ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('btn-save-supplier').addEventListener('click', async () => {
        const name = document.getElementById('sup-name').value.trim();
        const contact = document.getElementById('sup-contact').value.trim();

        if (!name) { alert('El nombre es obligatorio'); return; }

        try {
            if (isEdit) {
                await window.db.suppliers.update(supplierToEdit.id, { name, contact });
                // Cloud Sync
                if (window.Sync?.client) {
                    await window.Sync.client.from('suppliers').update({ name, contact }).eq('id', supplierToEdit.id);
                }
            } else {
                const newSup = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    name,
                    contact,
                    deleted: false
                };
                await window.db.suppliers.add(newSup);
                // Cloud Sync
                if (window.Sync?.client) {
                    await window.Sync.client.from('suppliers').insert([newSup]);
                }
            }
            modal.classList.add('hidden');
            renderSuppliers();
        } catch (e) { alert('Error: ' + e.message); }
    });
}

// --- SEEDING LOGIC ---
async function seedSuppliersIfNeeded() {
    try {
        const count = await window.db.suppliers.count();

        // Si hay datos locales, no hacer nada
        if (count > 0) return;

        // Si hay conexión a Supabase, intentar cargar desde la nube primero
        if (window.Sync?.client) {
            console.log("[Suppliers] Intentando cargar desde Supabase...");
            const { data, error } = await window.Sync.client
                .from('suppliers')
                .select('*')
                .eq('deleted', false);

            if (!error && data && data.length > 0) {
                console.log(`[Suppliers] Restaurando ${data.length} proveedores desde la nube.`);
                await window.db.suppliers.bulkPut(data);
                return; // Datos restaurados desde la nube, no sembrar datos de fábrica
            }
        }

        // Solo sembrar datos iniciales si NUNCA se ha hecho antes
        // (protegido por bandera en localStorage para evitar re-siembra accidental)
        const alreadySeeded = localStorage.getItem('wm_suppliers_seeded') === 'true';
        if (alreadySeeded) {
            console.log("[Suppliers] Ya se sembró antes. No se insertan datos de fábrica.");
            return;
        }

        console.log("[Suppliers] Primera vez: sembrando proveedores iniciales...");
        const initialSuppliers = [
            "Distribuidora Kiwan",
            "El Mesón Mayorista",
            "BioÑuble",
            "Minuto Verde",
            "Coca Cola",
            "Comercial CCU",
            "Soprole",
            "Comercial Río Maullin",
            "Doña María",
            "Central Mayorista",
            "ICB",
            "La Veneciana",
            "Nestlé Chile S.A",
            "Distribuidora AEDOS",
            "ARCOR",
            "RAFUÑCO",
            "XFood Spa"
        ];

        const batch = initialSuppliers.map((name, index) => ({
            id: Date.now() + index,
            name: name,
            contact: "",
            deleted: false
        }));

        await window.db.suppliers.bulkAdd(batch);

        // Marcar que ya se sembró para no volver a hacerlo nunca
        localStorage.setItem('wm_suppliers_seeded', 'true');
        console.log("[Suppliers] Siembra inicial completada y protegida.");

    } catch (e) {
        console.error("Error seeding suppliers:", e);
    }
}
