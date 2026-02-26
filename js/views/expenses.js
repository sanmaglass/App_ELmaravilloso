// Expenses View (Gastos Generales)
window.Views = window.Views || {};

window.Views.expenses = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
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
                <option value="Servicios">Servicios Básicos</option>
                <option value="Alquiler">Alquiler</option>
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
    const syncHandler = () => {
        if (document.getElementById('expenses-list')) {
            console.log("🔄 Sync update detected: refreshing expenses...");
            renderExpenses();
        } else {
            window.removeEventListener('sync-data-updated', syncHandler);
        }
    };
    window.addEventListener('sync-data-updated', syncHandler);
};

// --- INIT DATE FILTER (Reused logic) ---
async function initDateFilter() {
    const filter = document.getElementById('filter-date');
    if (!filter) return;

    try {
        const expenses = await window.db.expenses.toArray();
        const active = expenses.filter(e => !e.deleted);

        const months = new Set();
        active.forEach(e => {
            if (e.date && e.date.length >= 7) {
                months.add(e.date.substring(0, 7));
            }
        });

        const sortedMonths = Array.from(months).sort().reverse();

        sortedMonths.forEach(m => {
            const [y, monthNum] = m.split('-');
            const dateObj = new Date(y, monthNum - 1);
            const label = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

            const option = document.createElement('option');
            option.value = m;
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            filter.appendChild(option);
        });

        const currentMonth = new Date().toISOString().substring(0, 7);
        if (months.has(currentMonth)) {
            filter.value = currentMonth;
        } else {
            filter.value = 'all';
        }

    } catch (e) { console.error("Error init date filter", e); }
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
            <div class="card" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary);">${exp.title}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); display:flex; gap:8px;">
                        <span><i class="ph ph-calendar-blank"></i> ${formatDate(exp.date)}</span>
                        <span>•</span>
                        <span style="color:var(--primary); background:rgba(255,0,0,0.05); padding:2px 8px; border-radius:4px;">${exp.category}</span>
                    </div>
                </div>
                <div style="text-align:right;">
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
                            <option value="Servicios" ${isEdit && expenseToEdit.category === 'Servicios' ? 'selected' : ''}>Servicios Básicos</option>
                            <option value="Alquiler" ${isEdit && expenseToEdit.category === 'Alquiler' ? 'selected' : ''}>Alquiler</option>
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
