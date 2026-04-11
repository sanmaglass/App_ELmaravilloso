// Expenses View (Gastos Generales)
window.Views = window.Views || {};

window.Views.expenses = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-coin" style="color:var(--primary);"></i> Gastos Generales
                </h1>
                <p style="color:var(--text-muted);">Registro de costos operativos (Luz, Agua, Arriendo, etc.)</p>
            </div>
            <button class="btn btn-primary" id="btn-add-expense">
                <i class="ph ph-plus-circle"></i> Nuevo Gasto
            </button>
        </div>

        <!-- Filters -->
        <div class="filters-bar">
             <div style="position:relative; flex: 1 1 200px;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="expense-search" class="form-input" placeholder="Buscar por título..." style="padding-left:36px; width:100%;">
            </div>
            <select id="filter-date" class="form-input">
                <option value="all">Todo el Historial</option>
                <!-- Dynamic Months -->
            </select>
            <select id="filter-category" class="form-input">
                <option value="all">Todas las Categorías</option>
                <option value="Retiro del Dueño">💼 Retiro del Dueño</option>
                <option value="Servicios">Servicios Básicos</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Contabilidad">Contabilidad</option>
                <option value="Transporte">Transporte</option>
                <option value="Insumos">Insumos</option>
                <option value="Marketing">Marketing</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Otros">Otros</option>
            </select>
        </div>

        <!-- Summary Cards -->
         <div class="grid-cols-auto gap-4 mb-6">
            <div class="premium-card" style="padding:16px; border-left:4px solid var(--primary);">
                <div style="font-size:0.9rem; color:var(--text-muted);">Total Gastos (Filtrado)</div>
                <div style="font-size:1.5rem; font-weight:700; color:var(--text-primary);" id="total-expenses-amount">$0</div>
            </div>
             <div class="premium-card" style="padding:16px; border-left:4px solid #f59e0b;">
                <div style="font-size:0.9rem; color:var(--text-muted);">Categoría Principal</div>
                <div style="font-size:1.2rem; font-weight:600; color:var(--text-primary);" id="top-category">-</div>
            </div>
        </div>

        <!-- Expenses List -->
        <div id="expenses-list" style="display:flex; flex-direction:column; gap:12px; min-height: 200px;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando gastos...</p>
            </div>
        </div>
    `;

    // Initialize
    await initDateFilter();
    renderExpenses();

    // Events
    document.getElementById('btn-add-expense').addEventListener('click', () => showExpenseModal());
    document.getElementById('expense-search').addEventListener('input', () => renderExpenses());
    document.getElementById('filter-date').addEventListener('change', () => renderExpenses());
    document.getElementById('filter-category').addEventListener('change', () => renderExpenses());

    // --- REALTIME REFRESH ---
    // Limpiar listener anterior para evitar acumulación en visitas repetidas
    if (window._expensesSyncHandler) {
        window.removeEventListener('sync-data-updated', window._expensesSyncHandler);
        window._expensesSyncHandler = null;
    }

    window._expensesSyncHandler = () => {
        if (document.getElementById('expenses-list')) {
            console.log("🔄 Sync update detected: refreshing expenses...");
            renderExpenses();
        } else {
            window.removeEventListener('sync-data-updated', window._expensesSyncHandler);
            window._expensesSyncHandler = null;
        }
    };
    window.addEventListener('sync-data-updated', window._expensesSyncHandler);
};

// --- INIT DATE FILTER ---
async function initDateFilter() {
    const filter = document.getElementById('filter-date');
    if (!filter) return;

    // Limpiar opciones dinámicas previas (mantener solo "Todo el Historial")
    while (filter.options.length > 1) filter.remove(1);

    try {
        const expenses = await window.db.expenses.toArray();
        const active = expenses.filter(e => !e.deleted);

        const monthsFromDB = new Set();
        active.forEach(e => {
            if (e.date && e.date.length >= 7) monthsFromDB.add(e.date.substring(0, 7));
        });

        // Siempre incluir los últimos 12 meses en hora LOCAL
        const now = new Date();
        const monthsSet = new Set(monthsFromDB);
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        Array.from(monthsSet).sort().reverse().forEach(m => {
            const [y, monthNum] = m.split('-');
            const label = new Date(Number(y), Number(monthNum) - 1, 1)
                .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            const option = document.createElement('option');
            option.value = m;
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            filter.appendChild(option);
        });

        // Seleccionar mes actual en hora LOCAL
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        filter.value = currentKey;

    } catch (e) { console.error('Error init date filter', e); }
}

// --- RENDER LOGIC ---
async function renderExpenses() {
    const list = document.getElementById('expenses-list');
    const search = document.getElementById('expense-search').value.toLowerCase();
    const dateFilter = document.getElementById('filter-date').value;
    const categoryFilter = document.getElementById('filter-category').value;

    if (!list) return;

    try {
        const expenses = await window.db.expenses.toArray();
        const activeExpenses = expenses.filter(e => !e.deleted);
        const formatCurrency = window.Utils.formatCurrency;

        // Filter
        let filtered = activeExpenses.filter(e => {
            const matchesSearch = e.title.toLowerCase().includes(search);

            let matchesDate = true;
            if (dateFilter !== 'all') {
                matchesDate = e.date.startsWith(dateFilter);
            }

            let matchesCategory = true;
            if (categoryFilter !== 'all') {
                matchesCategory = e.category === categoryFilter;
            }

            return matchesSearch && matchesDate && matchesCategory;
        });

        // Sort by Date DESC
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Update Summaries
        let total = 0;
        const categoryCounts = {};

        filtered.forEach(e => {
            const amount = parseFloat(e.amount) || 0;
            total += amount;
            categoryCounts[e.category] = (categoryCounts[e.category] || 0) + amount;
        });

        document.getElementById('total-expenses-amount').textContent = formatCurrency(total);

        // Find top category
        let topCat = '-';
        let maxAmount = 0;
        for (const [cat, amount] of Object.entries(categoryCounts)) {
            if (amount > maxAmount) {
                maxAmount = amount;
                topCat = cat;
            }
        }
        document.getElementById('top-category').textContent = topCat;


        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-coin" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay gastos registrados</h3>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(exp => `
            <div class="card" style="padding:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="flex: 1 1 180px; min-width:0;">
                    <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${exp.title}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:4px;">
                        <span><i class="ph ph-calendar-blank"></i> ${formatDate(exp.date)}</span>
                        <span>•</span>
                        <span style="color:var(--primary); background:rgba(255,0,0,0.05); padding:2px 8px; border-radius:4px;">${exp.category}</span>
                        ${exp.isFixed ? '<span style="color:#f59e0b; background:rgba(245,158,11,0.1); padding:2px 8px; border-radius:4px; font-weight:bold;"><i class="ph ph-push-pin"></i> Fijo Mensual</span>' : ''}
                    </div>
                </div>
                <div style="text-align:right; flex: 0 0 auto;">
                    <div style="font-weight:700; font-size:1.1rem; color:var(--text-primary); margin-bottom:4px;">${formatCurrency(exp.amount)}</div>
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="btn btn-icon btn-edit-expense" data-id="${exp.id}" title="Editar" style="width:32px; height:32px; font-size:1rem;">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button class="btn btn-icon btn-delete-expense" data-id="${exp.id}" title="Eliminar" style="width:32px; height:32px; font-size:1rem; color:var(--error);">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Attach Events
        document.querySelectorAll('.btn-edit-expense').forEach(btn =>
            btn.addEventListener('click', (e) => handleEditExpense(Number(e.currentTarget.dataset.id)))
        );
        document.querySelectorAll('.btn-delete-expense').forEach(btn =>
            btn.addEventListener('click', (e) => handleDeleteExpense(Number(e.currentTarget.dataset.id)))
        );

    } catch (e) {
        console.error("Error in renderExpenses:", e);
        list.innerHTML = `<div style="color:red;">Error: ${e.message}</div>`;
    }
}

// --- CRUD ---
async function handleDeleteExpense(id) {
    if (confirm('¿Eliminar este gasto?')) {
        try {
            await window.DataManager.deleteAndSync('expenses', id);
            renderExpenses();
        } catch (e) { alert('Error: ' + e.message); }
    }
}

async function handleEditExpense(id) {
    const expense = await window.db.expenses.get(id);
    if (expense) showExpenseModal(expense);
}

// --- MODAL ---
function showExpenseModal(expenseToEdit = null) {
    const isEdit = !!expenseToEdit;
    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="modal" style="max-width:500px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Editar Gasto' : 'Registrar Gasto'}</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <form id="expense-form" style="display:flex; flex-direction:column; gap:16px;">
                    
                    <div class="form-group">
                        <label class="form-label">Título del Gasto</label>
                        <input type="text" id="exp-title" class="form-input" placeholder="Ej. Pago de Luz" value="${isEdit ? expenseToEdit.title : ''}" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Monto ($)</label>
                        <input type="number" id="exp-amount" class="form-input" placeholder="0" value="${isEdit ? expenseToEdit.amount : ''}" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <select id="exp-category" class="form-input">
                            <option value="Retiro del Dueño" ${isEdit && expenseToEdit.category === 'Retiro del Dueño' ? 'selected' : ''}>💼 Retiro del Dueño (tu sueldo)</option>
                            <option value="Servicios" ${isEdit && expenseToEdit.category === 'Servicios' ? 'selected' : ''}>Servicios Básicos</option>
                            <option value="Alquiler" ${isEdit && expenseToEdit.category === 'Alquiler' ? 'selected' : ''}>Alquiler</option>
                            <option value="Contabilidad" ${isEdit && expenseToEdit.category === 'Contabilidad' ? 'selected' : ''}>Contabilidad</option>
                            <option value="Transporte" ${isEdit && expenseToEdit.category === 'Transporte' ? 'selected' : ''}>Transporte</option>
                            <option value="Insumos" ${isEdit && expenseToEdit.category === 'Insumos' ? 'selected' : ''}>Insumos</option>
                            <option value="Marketing" ${isEdit && expenseToEdit.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
                            <option value="Mantenimiento" ${isEdit && expenseToEdit.category === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
                             <option value="Otros" ${isEdit && expenseToEdit.category === 'Otros' ? 'selected' : ''}>Otros</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Fecha</label>
                        <input type="date" id="exp-date" class="form-input" value="${isEdit ? expenseToEdit.date : today}">
                    </div>

                    <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:8px; padding:12px; background:rgba(245,158,11,0.05); border-radius:8px; border:1px solid rgba(245,158,11,0.2);">
                        <input type="checkbox" id="exp-isfixed" style="width:18px; height:18px; cursor:pointer;" ${isEdit && expenseToEdit.isFixed ? 'checked' : ''}>
                        <div style="display:flex; flex-direction:column;">
                            <label for="exp-isfixed" style="font-weight:600; cursor:pointer; color:var(--text-primary); margin:0;">¿Es un Gasto Fijo Mensual?</label>
                            <span style="font-size:0.75rem; color:var(--text-muted);">El sistema usará este valor para calcular tu costo diario de operación (Prorrateo).</span>
                        </div>
                    </div>

                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btn-save-expense" style="width:100%;">
                    ${isEdit ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('btn-save-expense').addEventListener('click', async () => {
        const title = document.getElementById('exp-title').value.trim();
        const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
        const category = document.getElementById('exp-category').value;
        const date = document.getElementById('exp-date').value;
        const isFixed = document.getElementById('exp-isfixed').checked;

        if (!title || amount <= 0) {
            alert('Por favor ingresa un título y un monto válido.');
            return;
        }

        try {
            const expenseData = {
                title,
                amount,
                category,
                date,
                isFixed,
                deleted: false
            };

            if (isEdit) {
                await window.DataManager.saveAndSync('expenses', { id: expenseToEdit.id, ...expenseData });
            } else {
                await window.DataManager.saveAndSync('expenses', expenseData);
            }

            modal.classList.add('hidden');
            if (!isEdit) await initDateFilter(); // Refresh filters if new date
            renderExpenses();
        } catch (e) { alert('Error: ' + e.message); }
    });
}
