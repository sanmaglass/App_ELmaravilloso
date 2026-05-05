// Employees View — Semi-automatizado con pagos confirmados
window.Views = window.Views || {};

// Limpieza única: borrar empleados y workLogs antiguos (local + Supabase)
async function _cleanLegacyPersonal() {
    const flag = 'clean_personal_v1052';
    if (localStorage.getItem(flag)) return;
    try {
        // Borrar local
        const emps = await window.db.employees.toArray();
        for (const emp of emps) {
            emp.deleted = true;
            await window.db.employees.put(emp);
        }
        const logs = await window.db.workLogs.toArray();
        for (const log of logs) {
            log.deleted = true;
            await window.db.workLogs.put(log);
        }
        // Borrar en Supabase
        const client = window.SyncV2?.client || window.Sync?.client;
        if (client) {
            await client.from('employees').update({ deleted: true }).neq('id', 0);
            await client.from('worklogs').update({ deleted: true }).neq('id', 0);
        }
        localStorage.setItem(flag, Date.now().toString());
        console.log('✅ Personal limpio: todos los empleados y workLogs eliminados');
    } catch (e) {
        console.error('Error limpiando personal:', e);
    }
}

window.Views.employees = async (container, _tab = 'equipo') => {
    if (!window.Utils) {
        container.innerHTML = "<p>Error: Falta módulo de utilidades.</p>";
        return;
    }

    // Ejecutar limpieza de datos legacy (una sola vez)
    await _cleanLegacyPersonal();

    const tabBarHTML = `
        <div style="display:flex; gap:0; background:var(--bg-input); border-radius:14px; padding:4px; margin-bottom:24px; width:fit-content; box-shadow:0 1px 4px rgba(0,0,0,0.07);">
            <button onclick="window.Views.employees(document.getElementById('view-container'), 'equipo')" style="padding:8px 20px; border:none; border-radius:10px; font-weight:600; font-size:0.88rem; cursor:pointer; transition:all 0.2s; background:${_tab==='equipo'?'var(--primary)':'transparent'}; color:${_tab==='equipo'?'white':'var(--text-muted)'};">
                <i class="ph ph-users"></i> Equipo
            </button>
            <button onclick="window.Views.employees(document.getElementById('view-container'), 'pagos')" style="padding:8px 20px; border:none; border-radius:10px; font-weight:600; font-size:0.88rem; cursor:pointer; transition:all 0.2s; background:${_tab==='pagos'?'var(--primary)':'transparent'}; color:${_tab==='pagos'?'white':'var(--text-muted)'};">
                <i class="ph ph-wallet"></i> Pagos
            </button>
        </div>
    `;

    if (_tab === 'pagos') {
        container.innerHTML = tabBarHTML + '<div id="empleados-tab-content"></div>';
        await renderPagosTab(document.getElementById('empleados-tab-content'));
        return;
    }

    // === TAB: EQUIPO ===
    const employees = await window.db.employees.toArray();
    const activeEmployees = employees.filter(e => !e.deleted);

    container.innerHTML = tabBarHTML + `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1>Personal</h1>
                <p class="hide-mobile" style="color:var(--text-muted);">Gestión de equipo y tarifas</p>
            </div>
            <button class="btn btn-primary" onclick="window.showEmployeeModal()">
                <i class="ph ph-plus"></i> <span class="hide-mobile">Nuevo Empleado</span><span class="show-mobile-only" style="display:none;">Nuevo</span>
            </button>
        </div>

        <div class="grid-employees grid-cols-auto gap-4">
            ${activeEmployees.length === 0 ? '<p style="grid-column:1/-1; text-align:center; padding:40px;">No hay empleados registrados.</p>' : ''}
        </div>
    `;

    const grid = container.querySelector('.grid-employees');

    if (activeEmployees.length > 0) {
        grid.innerHTML = activeEmployees.map(emp => {
            const freq = emp.paymentFrequency || 'monthly';
            const freqLabel = freq === 'weekly' ? 'Semanal' : freq === 'biweekly' ? 'Quincenal' : 'Mensual';
            const cycleAmount = window.Utils.getPaymentCycleAmount(emp);

            return `
            <div class="card card-hover" style="position:relative;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div class="avatar" style="width:56px; height:56px; font-size:1.4rem; background:${emp.isOwner ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, var(--primary), #880000)'}; box-shadow:0 4px 10px ${emp.isOwner ? 'rgba(245,158,11,0.3)' : 'rgba(136,0,0,0.3)'}; position:relative;">
                            ${emp.avatar || Utils.escapeHTML(emp.name.substring(0, 2).toUpperCase())}
                            ${emp.isOwner ? '<span style="position:absolute; top:-6px; right:-6px; background:#f59e0b; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.55rem; border:2px solid white;">👑</span>' : ''}
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:1.15rem; color:var(--text-primary);">${Utils.escapeHTML(emp.name)}</div>
                            <div style="color:var(--text-secondary); font-size:0.9rem; display:flex; align-items:center; gap:6px;">
                                <i class="ph ph-briefcase"></i> ${emp.isOwner ? '👑 Dueño' : Utils.escapeHTML(emp.role || 'Sin Cargo')}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.showEmployeeModal(${emp.id})" class="btn-icon" style="width:36px; height:36px; font-size:1.1rem;" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                        <button onclick="window.deleteEmployee(${emp.id})" class="btn-icon" style="width:36px; height:36px; font-size:1.1rem; color:var(--danger); border-color:var(--danger);" title="Borrar"><i class="ph ph-trash"></i></button>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid var(--border);">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Sueldo Base</div>
                        <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${window.Utils.formatCurrency(emp.baseSalary || 0)}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">Frecuencia</div>
                        <div style="font-weight:600; font-size:0.95rem;">${freqLabel}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">Por Ciclo</div>
                        <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${window.Utils.formatCurrency(cycleAmount)}</div>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    // --- ACTIONS ---
    window.deleteEmployee = async (id) => {
        if (confirm('¿Eliminar este empleado?')) {
            try {
                await window.DataManager.deleteAndSync('employees', id);
                window.Views.employees(container);
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
            }
        }
    };

    window.showEmployeeModal = async (id = null) => {
        let emp = null;
        if (id) {
            emp = await window.db.employees.get(id);
        }

        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = `
            <div class="modal" style="max-width:600px;">
                <div class="modal-header">
                    <h3 class="modal-title">${id ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
                </div>
                <div class="modal-body">
                    <form id="employee-form">
                        <input type="hidden" name="id" value="${id || ''}">

                        <div class="form-group">
                            <label class="form-label">Nombre Completo</label>
                            <input type="text" name="name" class="form-input" required placeholder="Ej. Juan Pérez" value="${emp?.name || ''}">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Cargo / Rol</label>
                            <input type="text" name="role" class="form-input" placeholder="Ej. Vendedor, Bodeguero" value="${emp?.role || ''}">
                        </div>

                        <!-- Tipo de Empleado -->
                        <div class="form-group" style="background:rgba(99,102,241,0.05); padding:14px 16px; border-radius:12px; border:1px solid rgba(99,102,241,0.2);">
                            <label class="form-label" style="color:#4f46e5; font-weight:700; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                                <i class="ph ph-identification-badge"></i> Tipo de Empleado
                            </label>
                            <div style="display:flex; gap:8px;">
                                <label style="flex:1; cursor:pointer;">
                                    <input type="radio" name="employeeType" value="worker" ${!emp?.isOwner ? 'checked' : ''} style="display:none;" onchange="window.updateTypeSelection(this)">
                                    <div id="type-worker-btn" style="text-align:center; padding:10px; border-radius:10px; border:2px solid ${!emp?.isOwner ? '#4f46e5' : 'var(--border)'}; background:${!emp?.isOwner ? 'rgba(99,102,241,0.1)' : 'transparent'}; font-weight:600; font-size:0.85rem; color:${!emp?.isOwner ? '#4f46e5' : 'var(--text-muted)'}; transition:all 0.2s;">
                                        <i class="ph ph-user"></i> Trabajador
                                    </div>
                                </label>
                                <label style="flex:1; cursor:pointer;">
                                    <input type="radio" name="employeeType" value="owner" ${emp?.isOwner ? 'checked' : ''} style="display:none;" onchange="window.updateTypeSelection(this)">
                                    <div id="type-owner-btn" style="text-align:center; padding:10px; border-radius:10px; border:2px solid ${emp?.isOwner ? '#f59e0b' : 'var(--border)'}; background:${emp?.isOwner ? 'rgba(245,158,11,0.1)' : 'transparent'}; font-weight:600; font-size:0.85rem; color:${emp?.isOwner ? '#d97706' : 'var(--text-muted)'}; transition:all 0.2s;">
                                        <i class="ph ph-crown"></i> Dueño
                                    </div>
                                </label>
                            </div>
                        </div>

                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-muted); text-transform:uppercase;">Remuneración</h4>

                        <div class="form-group">
                            <label class="form-label">Sueldo Base Mensual ($)</label>
                            <input type="number" name="baseSalary" class="form-input" required placeholder="Ej. 580000" value="${emp?.baseSalary || ''}">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Frecuencia de Pago</label>
                            <select name="paymentFrequency" class="form-input">
                                <option value="weekly" ${emp?.paymentFrequency === 'weekly' ? 'selected' : ''}>Semanal</option>
                                <option value="biweekly" ${emp?.paymentFrequency === 'biweekly' ? 'selected' : ''}>Quincenal</option>
                                <option value="monthly" ${(!emp?.paymentFrequency || emp?.paymentFrequency === 'monthly') ? 'selected' : ''}>Mensual</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                    <button class="btn btn-primary" id="save-emp-btn">${id ? 'Actualizar' : 'Guardar'}</button>
                </div>
            </div>
        `;

        modalContainer.classList.remove('hidden');

        document.getElementById('save-emp-btn').addEventListener('click', async () => {
            const form = document.getElementById('employee-form');
            if (!form.reportValidity()) return;

            const formData = new FormData(form);
            const name = formData.get('name').trim();
            if (!name) { alert('El nombre es obligatorio.'); return; }

            const baseSalary = Number(formData.get('baseSalary')) || 0;
            if (baseSalary <= 0) { alert('El sueldo base debe ser mayor a 0.'); return; }

            const employeeData = {
                name,
                role: formData.get('role'),
                isOwner: formData.get('employeeType') === 'owner',
                baseSalary,
                paymentFrequency: formData.get('paymentFrequency') || 'monthly',
                paymentMode: 'salary',
                deleted: false,
                avatar: name.substring(0, 2).toUpperCase(),
            };

            // Preservar campos existentes
            if (emp) {
                employeeData.lastPaymentDate = emp.lastPaymentDate || null;
                employeeData.startDate = emp.startDate || new Date().toISOString().split('T')[0];
                employeeData.workHoursPerDay = emp.workHoursPerDay || 9;
                employeeData.breakMinutes = emp.breakMinutes || 60;
                employeeData.defaultStartTime = emp.defaultStartTime || '09:00';
                employeeData.defaultEndTime = emp.defaultEndTime || '18:00';
            } else {
                employeeData.startDate = new Date().toISOString().split('T')[0];
                employeeData.lastPaymentDate = null;
                employeeData.workHoursPerDay = 9;
                employeeData.breakMinutes = 60;
                employeeData.defaultStartTime = '09:00';
                employeeData.defaultEndTime = '18:00';
            }

            try {
                if (id) {
                    const numericId = Number(id);
                    employeeData.id = numericId;
                    await window.DataManager.saveAndSync('employees', employeeData);
                } else {
                    employeeData.id = Date.now() + Math.floor(Math.random() * 1000);
                    employeeData.createdAt = new Date().toISOString();
                    await window.DataManager.saveAndSync('employees', employeeData);
                }

                modalContainer.classList.add('hidden');
                window.Views.employees(container);
            } catch (err) {
                alert('Error al guardar: ' + err.message);
            }
        });

        // Helper para botones de tipo
        window.updateTypeSelection = (radio) => {
            const isOwner = radio.value === 'owner';
            const workerBtn = document.getElementById('type-worker-btn');
            const ownerBtn = document.getElementById('type-owner-btn');
            if (!workerBtn || !ownerBtn) return;
            workerBtn.style.border = `2px solid ${!isOwner ? '#4f46e5' : 'var(--border)'}`;
            workerBtn.style.background = !isOwner ? 'rgba(99,102,241,0.1)' : 'transparent';
            workerBtn.style.color = !isOwner ? '#4f46e5' : 'var(--text-muted)';
            ownerBtn.style.border = `2px solid ${isOwner ? '#f59e0b' : 'var(--border)'}`;
            ownerBtn.style.background = isOwner ? 'rgba(245,158,11,0.1)' : 'transparent';
            ownerBtn.style.color = isOwner ? '#d97706' : 'var(--text-muted)';
        };
    };

    // === TAB: PAGOS ===
    async function renderPagosTab(tabContainer) {
        const allEmployees = await window.db.employees.toArray();
        const employees = allEmployees.filter(e => !e.deleted && !e.isOwner);

        if (employees.length === 0) {
            tabContainer.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
                    <i class="ph ph-users" style="font-size:3rem; margin-bottom:16px; display:block;"></i>
                    <p>No hay empleados registrados. Ve a la pestaña <b>Equipo</b> para agregar uno.</p>
                </div>
            `;
            return;
        }

        // Cargar adelantos pendientes para todos
        const allAdvances = await window.db.advances.toArray();
        const pendingAdvances = allAdvances.filter(a => !a.deleted && a.status === 'pending');

        // Cargar pagos confirmados del mes actual
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const allExpenses = await window.db.expenses.toArray();
        const sueldosMes = allExpenses.filter(e => !e.deleted && e.category === 'Sueldos' && e.date && e.date.startsWith(monthStr));
        const adelantosMes = allExpenses.filter(e => !e.deleted && e.category === 'Adelantos' && e.date && e.date.startsWith(monthStr));

        const totalSueldosMes = sueldosMes.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const totalAdelantosMes = adelantosMes.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        tabContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <h1 style="margin:0;">Pagos de Personal</h1>
            </div>

            <!-- Resumen del mes -->
            <div class="responsive-grid-2" style="margin-bottom:24px;">
                <div class="card" style="background:linear-gradient(135deg, #f0fdf4, #fff); border:1px solid #bbf7d0;">
                    <div style="font-size:0.8rem; color:#15803d; font-weight:600; text-transform:uppercase;">Sueldos Pagados (${now.toLocaleString('es-CL', { month: 'long' })})</div>
                    <div style="font-size:1.8rem; font-weight:700; color:#15803d; margin-top:4px;">${window.Utils.formatCurrency(totalSueldosMes)}</div>
                </div>
                <div class="card" style="background:linear-gradient(135deg, #fff7ed, #fff); border:1px solid #fed7aa;">
                    <div style="font-size:0.8rem; color:#c2410c; font-weight:600; text-transform:uppercase;">Adelantos Entregados (${now.toLocaleString('es-CL', { month: 'long' })})</div>
                    <div style="font-size:1.8rem; font-weight:700; color:#c2410c; margin-top:4px;">${window.Utils.formatCurrency(totalAdelantosMes)}</div>
                </div>
            </div>

            <!-- Tarjetas por empleado -->
            <div id="pagos-cards" class="grid-cols-auto gap-4"></div>
        `;

        const cardsContainer = document.getElementById('pagos-cards');

        // Ordenar: vencidos primero, luego por días hasta pago
        const employeesWithStatus = employees.map(emp => ({
            emp,
            payment: window.Utils.getPaymentStatus(emp),
            advances: pendingAdvances.filter(a => a.employeeId === emp.id),
        }));
        employeesWithStatus.sort((a, b) => a.payment.daysUntil - b.payment.daysUntil);

        cardsContainer.innerHTML = employeesWithStatus.map(({ emp, payment, advances }) => {
            const cycleAmount = window.Utils.getPaymentCycleAmount(emp);
            const totalAdvances = advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
            const netAmount = cycleAmount - totalAdvances;
            const freq = emp.paymentFrequency || 'monthly';
            const freqLabel = freq === 'weekly' ? 'Semanal' : freq === 'biweekly' ? 'Quincenal' : 'Mensual';

            const statusColors = {
                overdue: { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', text: 'white' },
                due_today: { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', text: 'white' },
                upcoming: { bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb', text: 'white' },
                ok: { bg: '#f9fafb', border: '#e5e7eb', badge: '#6b7280', text: 'white' }
            };
            const sc = statusColors[payment.status] || statusColors.ok;

            const nextDateStr = payment.nextDate.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

            return `
                <div class="card" style="background:${sc.bg}; border:2px solid ${sc.border}; position:relative;">
                    <!-- Badge de estado -->
                    <div style="position:absolute; top:12px; right:12px; background:${sc.badge}; color:${sc.text}; font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:20px;">
                        ${payment.label}
                    </div>

                    <!-- Cabecera -->
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                        <div class="avatar" style="width:44px; height:44px; font-size:1.1rem; background:linear-gradient(135deg, var(--primary), #880000);">
                            ${Utils.escapeHTML(emp.name.substring(0, 2).toUpperCase())}
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:1.05rem;">${Utils.escapeHTML(emp.name)}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${freqLabel} · Próximo: ${nextDateStr}</div>
                        </div>
                    </div>

                    <!-- Desglose -->
                    <div style="background:rgba(255,255,255,0.7); border-radius:10px; padding:12px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:var(--text-muted); font-size:0.88rem;">Sueldo por ciclo</span>
                            <strong>${window.Utils.formatCurrency(cycleAmount)}</strong>
                        </div>
                        ${totalAdvances > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#c2410c;">
                            <span style="font-size:0.88rem;">- Adelantos (${advances.length})</span>
                            <strong>-${window.Utils.formatCurrency(totalAdvances)}</strong>
                        </div>` : ''}
                        <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.1);">
                            <span style="font-weight:700; font-size:0.95rem;">Neto a pagar</span>
                            <strong style="font-size:1.1rem; color:var(--primary);">${window.Utils.formatCurrency(Math.max(0, netAmount))}</strong>
                        </div>
                    </div>

                    <!-- Botones -->
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.showConfirmPaymentModal(${emp.id})" class="btn btn-primary" style="flex:1; font-size:0.85rem; padding:10px;">
                            <i class="ph ph-check-circle"></i> Confirmar Pago
                        </button>
                        <button onclick="window.showAdvanceModal(${emp.id})" class="btn btn-secondary" style="flex:1; font-size:0.85rem; padding:10px;">
                            <i class="ph ph-hand-coins"></i> Adelanto
                        </button>
                    </div>

                    ${advances.length > 0 ? `
                    <!-- Detalle adelantos -->
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.06);">
                        <div style="font-size:0.75rem; font-weight:600; color:#c2410c; margin-bottom:6px; text-transform:uppercase;">Adelantos Pendientes</div>
                        ${advances.map(a => `
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; padding:4px 0;">
                                <span style="color:var(--text-muted);">${window.Utils.formatDate(a.date)} ${a.note ? '· ' + Utils.escapeHTML(a.note) : ''}</span>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <strong style="color:#c2410c;">${window.Utils.formatCurrency(a.amount)}</strong>
                                    <button onclick="window.deleteAdvance(${a.id})" class="btn-icon" style="width:22px; height:22px; font-size:0.8rem; color:var(--danger);" title="Eliminar"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>` : ''}
                </div>
            `;
        }).join('');

        // --- MODAL: CONFIRMAR PAGO ---
        window.showConfirmPaymentModal = async (empId) => {
            const emp = await window.db.employees.get(Number(empId));
            if (!emp) return;

            const cycleAmount = window.Utils.getPaymentCycleAmount(emp);
            const advances = await window.Utils.getPendingAdvances(empId);
            const totalAdvances = advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
            const suggestedNet = Math.max(0, cycleAmount - totalAdvances);
            const freq = emp.paymentFrequency || 'monthly';
            const freqLabel = freq === 'weekly' ? 'Semanal' : freq === 'biweekly' ? 'Quincenal' : 'Mensual';

            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = `
                <div class="modal" style="max-width:480px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="ph ph-check-circle" style="color:#15803d;"></i> Confirmar Pago</h3>
                        <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align:center; margin-bottom:20px;">
                            <div class="avatar" style="width:56px; height:56px; font-size:1.3rem; background:linear-gradient(135deg, var(--primary), #880000); margin:0 auto 8px;">
                                ${Utils.escapeHTML(emp.name.substring(0, 2).toUpperCase())}
                            </div>
                            <div style="font-weight:700; font-size:1.2rem;">${Utils.escapeHTML(emp.name)}</div>
                            <div style="color:var(--text-muted); font-size:0.85rem;">Pago ${freqLabel}</div>
                        </div>

                        <div style="background:var(--bg-input); border-radius:12px; padding:16px; margin-bottom:16px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <span>Sueldo por ciclo</span>
                                <strong>${window.Utils.formatCurrency(cycleAmount)}</strong>
                            </div>
                            ${totalAdvances > 0 ? `
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px; color:#c2410c;">
                                <span>Adelantos a descontar (${advances.length})</span>
                                <strong>-${window.Utils.formatCurrency(totalAdvances)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.15); font-weight:700;">
                                <span>Neto sugerido</span>
                                <span style="color:#15803d;">${window.Utils.formatCurrency(suggestedNet)}</span>
                            </div>` : ''}
                        </div>

                        <div class="form-group">
                            <label class="form-label">Monto Final a Pagar ($)</label>
                            <input type="number" id="pay-final-amount" class="form-input" value="${suggestedNet}" style="font-size:1.2rem; font-weight:700; text-align:center;">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Puedes ajustar el monto si necesitas.</p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Método de Pago</label>
                            <select id="pay-method" class="form-input">
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia" selected>Transferencia</option>
                                <option value="Débito">Débito</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                        <button class="btn btn-primary" id="confirm-pay-btn" style="background:#15803d; border-color:#15803d;">
                            <i class="ph ph-check"></i> Confirmar Pago
                        </button>
                    </div>
                </div>
            `;
            modalContainer.classList.remove('hidden');

            document.getElementById('confirm-pay-btn').addEventListener('click', async () => {
                const finalAmount = Number(document.getElementById('pay-final-amount').value) || 0;
                if (finalAmount <= 0) { alert('El monto debe ser mayor a 0.'); return; }
                const payMethod = document.getElementById('pay-method').value;

                try {
                    // 1. Crear expense de sueldo
                    const expenseData = {
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        title: `Sueldo - ${emp.name}`,
                        amount: finalAmount,
                        category: 'Sueldos',
                        paymentMethod: payMethod,
                        date: new Date().toISOString().split('T')[0],
                        isFixed: false,
                        deleted: false,
                    };
                    await window.DataManager.saveAndSync('expenses', expenseData);

                    // 2. Marcar adelantos como descontados
                    if (advances.length > 0) {
                        for (const adv of advances) {
                            adv.status = 'deducted';
                            adv.deductedInExpenseId = expenseData.id;
                            await window.DataManager.saveAndSync('advances', adv);
                        }
                    }

                    // 3. Actualizar lastPaymentDate del empleado
                    emp.lastPaymentDate = new Date().toISOString().split('T')[0];
                    await window.DataManager.saveAndSync('employees', emp);

                    modalContainer.classList.add('hidden');
                    alert(`Pago de ${window.Utils.formatCurrency(finalAmount)} a ${emp.name} registrado.`);
                    await renderPagosTab(tabContainer);
                } catch (err) {
                    alert('Error al registrar pago: ' + err.message);
                }
            });
        };

        // --- MODAL: REGISTRAR ADELANTO ---
        window.showAdvanceModal = async (empId) => {
            const emp = await window.db.employees.get(Number(empId));
            if (!emp) return;

            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = `
                <div class="modal" style="max-width:420px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="ph ph-hand-coins" style="color:#c2410c;"></i> Registrar Adelanto</h3>
                        <button class="modal-close" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align:center; margin-bottom:16px;">
                            <div style="font-weight:700; font-size:1.1rem;">${Utils.escapeHTML(emp.name)}</div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Monto del Adelanto ($)</label>
                            <input type="number" id="adv-amount" class="form-input" required placeholder="Ej. 50000" style="font-size:1.1rem; text-align:center;">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Nota (opcional)</label>
                            <input type="text" id="adv-note" class="form-input" placeholder="Ej. Para emergencia médica">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Método de Pago</label>
                            <select id="adv-method" class="form-input">
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia" selected>Transferencia</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                        <button class="btn btn-primary" id="save-adv-btn" style="background:#c2410c; border-color:#c2410c;">
                            <i class="ph ph-check"></i> Registrar Adelanto
                        </button>
                    </div>
                </div>
            `;
            modalContainer.classList.remove('hidden');

            document.getElementById('save-adv-btn').addEventListener('click', async () => {
                const amount = Number(document.getElementById('adv-amount').value) || 0;
                if (amount <= 0) { alert('El monto debe ser mayor a 0.'); return; }
                const note = document.getElementById('adv-note').value.trim();
                const payMethod = document.getElementById('adv-method').value;
                const today = new Date().toISOString().split('T')[0];

                try {
                    // 1. Crear registro de adelanto
                    const advanceData = {
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        employeeId: emp.id,
                        amount,
                        date: today,
                        note: note || null,
                        status: 'pending',
                        deductedInExpenseId: null,
                        deleted: false,
                    };
                    await window.DataManager.saveAndSync('advances', advanceData);

                    // 2. Crear expense para que impacte rentabilidad
                    const expenseData = {
                        id: Date.now() + Math.floor(Math.random() * 100) + 1000,
                        title: `Adelanto - ${emp.name}${note ? ' (' + note + ')' : ''}`,
                        amount,
                        category: 'Adelantos',
                        paymentMethod: payMethod,
                        date: today,
                        isFixed: false,
                        deleted: false,
                    };
                    await window.DataManager.saveAndSync('expenses', expenseData);

                    modalContainer.classList.add('hidden');
                    alert(`Adelanto de ${window.Utils.formatCurrency(amount)} registrado para ${emp.name}.`);
                    await renderPagosTab(tabContainer);
                } catch (err) {
                    alert('Error al registrar adelanto: ' + err.message);
                }
            });
        };

        // --- ELIMINAR ADELANTO ---
        window.deleteAdvance = async (advId) => {
            if (!confirm('¿Eliminar este adelanto?')) return;
            try {
                await window.DataManager.deleteAndSync('advances', advId);
                await renderPagosTab(tabContainer);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        };
    }
};
