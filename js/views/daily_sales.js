// Daily Sales View (Cierre Diario)
window.Views = window.Views || {};

window.Views.daily_sales = async (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
                <h1 style="margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
                    <i class="ph ph-currency-dollar" style="color:var(--primary);"></i> Ventas Diarias
                </h1>
                <p style="color:var(--text-muted);">Registro de cierre de caja (Efectivo, Transferencia, Débito)</p>
            </div>
            <button class="btn btn-primary" id="btn-add-daily-sale">
                <i class="ph ph-plus-circle"></i> Nuevo Cierre
            </button>
        </div>

        <!-- Filters -->
        <div class="filters-bar">
            <div style="position:relative; flex: 1 1 200px;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="daily-search" class="form-input" placeholder="Buscar por fecha..." style="padding-left:36px; width:100%;">
            </div>
            <select id="daily-filter-month" class="form-input">
                <option value="all">Todo el Historial</option>
                <!-- Dynamic Months -->
            </select>
            <button class="btn btn-secondary" id="btn-export-daily" style="flex: 0 1 auto; min-width: 120px;">
                <i class="ph ph-file-xls"></i> Exportar
            </button>
        </div>

        <!-- Summary Card -->
        <div class="grid-cols-auto gap-4 mb-6">
            <div class="premium-card" style="padding:14px; border-left:4px solid var(--primary);">
                <div style="font-size:0.85rem; color:var(--text-muted);">Total Ventas (Filtrado)</div>
                <div style="font-size:1.4rem; font-weight:700; color:var(--text-primary);" id="daily-total-amount">$0</div>
            </div>
            <div class="premium-card" style="padding:14px; border-left:4px solid #10b981;">
                <div style="font-size:0.85rem; color:var(--text-muted);">Cierres registrados</div>
                <div style="font-size:1.4rem; font-weight:700; color:#10b981;" id="daily-count">0</div>
            </div>
        </div>

        <!-- Sales History List -->
        <div id="daily-sales-list" style="display:flex; flex-direction:column; gap:12px; min-height: 200px;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando historial...</p>
            </div>
        </div>
    `;

    await initDailyMonthFilter();
    renderDailySales();

    // Events
    document.getElementById('btn-add-daily-sale').addEventListener('click', () => showDailySaleModal());
    document.getElementById('daily-search').addEventListener('input', () => renderDailySales());
    document.getElementById('daily-filter-month').addEventListener('change', () => renderDailySales());
    document.getElementById('btn-export-daily').addEventListener('click', exportDailySalesToExcel);

    // --- REALTIME REFRESH ---
    const syncHandler = () => {
        if (document.getElementById('daily-sales-list')) {
            console.log("🔄 Sync update detected: refreshing daily sales...");
            renderDailySales();
        } else {
            window.removeEventListener('sync-data-updated', syncHandler);
        }
    };
    window.addEventListener('sync-data-updated', syncHandler);
};

// --- INIT MONTH FILTER ---
async function initDailyMonthFilter() {
    const filter = document.getElementById('daily-filter-month');
    if (!filter) return;
    try {
        const sales = await window.db.daily_sales.toArray();
        const active = sales.filter(s => !s.deleted);
        const months = new Set();
        active.forEach(s => { if (s.date && s.date.length >= 7) months.add(s.date.substring(0, 7)); });
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
        if (months.has(currentMonth)) filter.value = currentMonth;
    } catch (e) { console.error('Error init daily month filter', e); }
}

async function renderDailySales() {
    const list = document.getElementById('daily-sales-list');
    const search = document.getElementById('daily-search')?.value.toLowerCase() || '';
    const monthFilter = document.getElementById('daily-filter-month')?.value || 'all';

    if (!list) return;

    try {
        const dailySales = await window.db.daily_sales.toArray();

        // --- SANITY CHECK: Limpiar basura local y sincronizar borrado ---
        // Buscamos registros irreales (ej. $8 Billones de prueba) que NO estén ya borrados
        const anomalous = dailySales.filter(s => !s.deleted && (parseFloat(s.total) || 0) > 1000000000);
        if (anomalous.length > 0) {
            console.warn("🧹 Limpiando registros anómalos y sincronizando:", anomalous);
            for (const s of anomalous) {
                await window.DataManager.deleteAndSync('daily_sales', s.id);
            }
            // Re-fetch clean data and return
            return renderDailySales();
        }

        const activeSales = dailySales.filter(s => !s.deleted);

        // Filter by month and search
        let filtered = activeSales.filter(s => {
            const matchesSearch = s.date.includes(search);
            const matchesMonth = monthFilter === 'all' ? true : s.date.startsWith(monthFilter);
            return matchesSearch && matchesMonth;
        });

        // Sort by Date DESC
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Update summary cards
        const totalAmount = filtered.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
        const totalEl = document.getElementById('daily-total-amount');
        const countEl = document.getElementById('daily-count');
        if (totalEl) totalEl.innerHTML = window.Utils.formatCurrency(totalAmount);
        if (countEl) countEl.textContent = filtered.length;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px; background:rgba(0,0,0,0.02); border-radius:12px; border:1px dashed var(--border);">
                    <i class="ph ph-calendar-x" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <h3 style="color:var(--text-muted);">No hay cierres registrados</h3>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(sale => `
            <div class="card" style="padding:16px;">
                <!-- Fila principal: igual que expenses -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <!-- Izquierda: fecha -->
                    <div style="flex:1 1 160px; min-width:0;">
                        <div style="font-weight:600; font-size:1.05rem; color:var(--text-primary); text-transform:capitalize; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${new Date(sale.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">${sale.date}</div>
                    </div>
                    <!-- Derecha: total + botones -->
                    <div style="text-align:right; flex:0 0 auto; display:flex; align-items:center; gap:12px;">
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Total Día</div>
                            <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${formatCurrency(sale.total)}</div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-icon btn-edit-daily" data-id="${sale.id}" title="Editar" style="width:32px; height:32px; font-size:1rem;">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="btn btn-icon btn-delete-daily" data-id="${sale.id}" title="Eliminar" style="width:32px; height:32px; font-size:1rem; color:var(--error);">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <!-- Fila de badges (desglose) -->
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.06); font-size:0.8rem;">
                    <span style="background:rgba(16,185,129,0.1); padding:3px 10px; border-radius:20px; color:#065f46; white-space:nowrap;">
                        <i class="ph ph-money"></i> Efec: ${formatCurrency(sale.cash || 0)}
                    </span>
                    <span style="background:rgba(59,130,246,0.1); padding:3px 10px; border-radius:20px; color:#1e3a8a; white-space:nowrap;">
                        <i class="ph ph-bank"></i> Trans: ${formatCurrency(sale.transfer || 0)}
                    </span>
                    <span style="background:rgba(245,158,11,0.1); padding:3px 10px; border-radius:20px; color:#92400e; white-space:nowrap;">
                        <i class="ph ph-credit-card"></i> Déb: ${formatCurrency(sale.debit || 0)}
                    </span>
                    ${sale.credit ? `<span style="background:rgba(139,92,246,0.1); padding:3px 10px; border-radius:20px; color:#5b21b6; white-space:nowrap;">
                        <i class="ph ph-star"></i> Créd: ${formatCurrency(sale.credit)}
                    </span>` : ''}
                </div>
            </div>
        `).join('');

        // Attach Events
        document.querySelectorAll('.btn-edit-daily').forEach(btn =>
            btn.addEventListener('click', (e) => handleEditDailySale(Number(e.currentTarget.dataset.id)))
        );
        document.querySelectorAll('.btn-delete-daily').forEach(btn =>
            btn.addEventListener('click', (e) => handleDeleteDailySale(Number(e.currentTarget.dataset.id)))
        );

    } catch (e) {
        console.error("Error in renderDailySales:", e);
        list.innerHTML = `<div style="color:red;">Error: ${e.message}</div>`;
    }
}

// --- CRUD ---
async function handleDeleteDailySale(id) {
    if (confirm('¿Eliminar este registro diario?')) {
        try {
            await window.DataManager.deleteAndSync('daily_sales', id);
            renderDailySales();
        } catch (e) { alert('Error: ' + e.message); }
    }
}

async function handleEditDailySale(id) {
    const sale = await window.db.daily_sales.get(id);
    if (sale) showDailySaleModal(sale);
}

// --- MODAL ---
function showDailySaleModal(saleToEdit = null) {
    const isEdit = !!saleToEdit;
    const modal = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="modal" style="max-width:500px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Editar Cierre' : 'Nuevo Cierre Diario'}</h3>
                <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            <div class="modal-body">
                <form id="daily-sale-form" style="display:flex; flex-direction:column; gap:16px;">
                    
                    <div class="form-group">
                        <label class="form-label">Fecha del Cierre</label>
                        <input type="date" id="ds-date" class="form-input" value="${isEdit ? saleToEdit.date : today}">
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label class="form-label">Efectivo ($)</label>
                            <input type="number" id="ds-cash" class="form-input calc-input" placeholder="0" value="${isEdit ? saleToEdit.cash : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Transferencia ($)</label>
                            <input type="number" id="ds-transfer" class="form-input calc-input" placeholder="0" value="${isEdit ? saleToEdit.transfer : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Débito ($)</label>
                            <input type="number" id="ds-debit" class="form-input calc-input" placeholder="0" value="${isEdit ? saleToEdit.debit : ''}">
                        </div>
                         <div class="form-group">
                            <label class="form-label">Crédito ($)</label>
                            <input type="number" id="ds-credit" class="form-input calc-input" placeholder="0" value="${isEdit ? saleToEdit.credit : ''}">
                        </div>
                    </div>

                    <div class="card" style="background:var(--bg-input); padding:12px; text-align:center;">
                        <div style="font-size:0.9rem; color:var(--text-muted);">Total Calculado</div>
                        <div style="font-size:1.5rem; font-weight:700; color:var(--primary);" id="ds-total-preview">$0</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notas (Opcional)</label>
                        <textarea id="ds-notes" class="form-input" style="height:60px;">${isEdit && saleToEdit.notes ? saleToEdit.notes : ''}</textarea>
                    </div>

                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btn-save-daily" style="width:100%;">
                    ${isEdit ? 'Actualizar Cierre' : 'Guardar Cierre'}
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Auto-calc Total
    const inputs = document.querySelectorAll('.calc-input');
    const totalPreview = document.getElementById('ds-total-preview');

    const calcTotal = () => {
        let total = 0;
        inputs.forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        totalPreview.textContent = formatCurrency(total);
        return total;
    };

    // Init calc
    calcTotal();

    inputs.forEach(input => input.addEventListener('input', calcTotal));

    document.getElementById('btn-save-daily').addEventListener('click', async () => {
        const date = document.getElementById('ds-date').value;
        const cash = parseFloat(document.getElementById('ds-cash').value) || 0;
        const transfer = parseFloat(document.getElementById('ds-transfer').value) || 0;
        const debit = parseFloat(document.getElementById('ds-debit').value) || 0;
        const credit = parseFloat(document.getElementById('ds-credit').value) || 0;
        const notes = document.getElementById('ds-notes').value.trim();

        const total = cash + transfer + debit + credit;

        if (total <= 0) {
            alert('El total debe ser mayor a 0');
            return;
        }

        try {
            // Check for duplicate date (filter in memory, no index needed)
            const allSales = await window.db.daily_sales.toArray();
            const existing = allSales.find(s => s.date === date && !s.deleted);
            if (existing && !existing.deleted && (!isEdit || existing.id !== saleToEdit.id)) {
                if (!confirm(`Ya existe un cierre para la fecha ${date}. ¿Deseas guardar otro registro para este día?`)) {
                    return;
                }
            }

            const dailyData = {
                date,
                cash,
                transfer,
                debit,
                credit,
                total,
                notes,
                deleted: false
            };

            if (isEdit) {
                await window.DataManager.saveAndSync('daily_sales', { id: saleToEdit.id, ...dailyData });
            } else {
                await window.DataManager.saveAndSync('daily_sales', dailyData);
            }

            modal.classList.add('hidden');
            renderDailySales();
        } catch (e) { alert('Error: ' + e.message); }
    });
}

// --- EXPORT TO EXCEL ---
async function exportDailySalesToExcel() {
    try {
        const sales = await window.db.daily_sales.toArray();
        const activeSales = sales.filter(s => !s.deleted);

        if (activeSales.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const data = activeSales.map(s => ({
            Fecha: s.date,
            Efectivo: s.cash,
            Transferencia: s.transfer,
            Debito: s.debit,
            Credito: s.credit,
            Total: s.total,
            Notas: s.notes
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas Diarias");
        XLSX.writeFile(wb, `Ventas_Diarias_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
        console.error(e);
        alert('Error exportando: ' + e.message);
    }
}
