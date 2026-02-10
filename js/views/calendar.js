// Calendar View
window.Views = window.Views || {};

window.Views.calendar = async (container) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    container.innerHTML = `
        <div class="calendar-header-mobile" style="margin-bottom:16px;">
            <div style="font-size:1.1rem; font-weight:700; color:var(--primary); text-transform:capitalize;">${window.Utils.formatDate(now, { month: 'long', year: 'numeric' })}</div>
        </div>
        
        <div class="calendar-grid">
            <!-- Headers -->
            ${['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => `<div class="calendar-header-day">${d}</div>`).join('')}
            
            <!-- Days injected here -->
            <div id="calendar-days" style="display:contents;"></div>
        </div>
    `;

    // Generate Days
    const daysContainer = document.getElementById('calendar-days');
    const logs = await window.db.workLogs.toArray(); // Optimization needed for real app

    let htmlDays = '';
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    for (let i = 0; i < firstDayIndex; i++) {
        htmlDays += `<div class="calendar-day-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Find logs for this day
        const dayLogs = logs.filter(l => l.date === dateStr);

        let indicators = '';
        if (dayLogs.length > 0) {
            indicators = `
                <div style="margin-top:4px; font-size:0.75rem;">
                    <div style="color:var(--accent);">${dayLogs.length} reg.</div>
                    <div class="money-sensitive" style="color:var(--text-muted);">${window.Utils.formatCurrency(dayLogs.reduce((acc, curr) => acc + (curr.payAmount || 0), 0))}</div>
                </div>
            `;
        }

        htmlDays += `
            <button class="calendar-day-btn" data-date="${dateStr}" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:6px; text-align:left; cursor:pointer; color:var(--text-primary); transition:all 0.2s; display:flex; flex-direction:column; justify-content:space-between;">
                <div style="font-weight:600; font-size:0.85rem;">${day}</div>
                ${indicators}
            </button>
        `;
    }

    daysContainer.innerHTML = htmlDays;

    // Add click events
    document.querySelectorAll('.calendar-day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openDayModal(e.currentTarget.dataset.date);
        });
    });
};

async function openDayModal(dateStr) {
    const modalContainer = document.getElementById('modal-container');
    const logs = await window.db.workLogs.where('date').equals(dateStr).toArray();
    const employees = await window.db.employees.toArray();

    // Helper to render
    const renderContent = () => {
        const empOptions = employees.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');

        // List HTML
        let listHtml = '';
        if (logs.length === 0) {
            listHtml = '<p style="font-size:0.9rem; color:var(--text-muted); padding:10px; text-align:center;">No hay registros hoy. ¡Agrega uno!</p>';
        } else {
            listHtml = logs.map(l => {
                const emp = employees.find(e => e.id == l.employeeId);
                return `
                    <div style="padding:12px; background:rgba(255,255,255,0.4); margin-bottom:8px; border-radius:12px; border:1px solid rgba(255,255,255,0.5); display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                        <div>
                            <div style="font-weight:600; color:var(--text-primary);">${emp?.name || 'Desconocido'}</div>
                            <div style="font-size:0.85rem; color:var(--text-secondary);">
                                <i class="ph ph-clock"></i> ${l.startTime} - ${l.endTime} (${l.totalHours}h)
                            </div>
                            <div style="font-size:0.9rem; font-weight:700; color:var(--primary);">
                                ${window.Utils.formatCurrency(l.payAmount)}
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="window.editLog(${l.id})" class="btn-icon" style="width:32px; height:32px; font-size:1rem;" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                            <button onclick="window.deleteLog(${l.id})" class="btn-icon" style="width:32px; height:32px; font-size:1rem; color:var(--danger); border-color:var(--danger);" title="Borrar"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>`;
            }).join('');
        }

        return `
        <div class="modal" style="max-width:550px; background:rgba(255,255,255,0.9); backdrop-filter:blur(20px);">
            <div class="modal-header" style="background: linear-gradient(135deg, var(--primary), #991b1b); color:white; border-radius:24px 24px 0 0;">
                <div>
                    <h3 class="modal-title" style="color:white !important;">${window.Utils.formatDate(dateStr)}</h3>
                    <div style="font-size:0.85rem; opacity:0.9;">Gestión de Jornadas</div>
                </div>
                <button class="modal-close" style="color:white;" onclick="document.getElementById('modal-container').classList.add('hidden')"><i class="ph ph-x"></i></button>
            </div>
            
            <div class="modal-body">
                <!-- LIST -->
                <div style="margin-bottom:24px; max-height:200px; overflow-y:auto; padding-right:4px;">
                    <h4 style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px; letter-spacing:1px;">Registros del Día</h4>
                    ${listHtml}
                </div>

                <!-- FORM -->
                <div style="border-top:1px solid var(--border); padding-top:20px;">
                    <h4 style="margin-bottom:12px; color:var(--primary); font-weight:700;" id="form-title">Nuevo Registro</h4>
                    <form id="log-form">
                        <input type="hidden" name="id" id="log-id">
                        <input type="hidden" name="date" value="${dateStr}">
                        
                        <div class="form-group">
                            <label class="form-label">Empleado</label>
                            <select name="employeeId" id="inp-employee" class="form-input" required>
                                <option value="">Seleccionar...</option>
                                ${empOptions}
                            </select>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                            <div class="form-group">
                                <label class="form-label">Entrada</label>
                                <input type="time" name="startTime" id="inp-start" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Salida</label>
                                <input type="time" name="endTime" id="inp-end" class="form-input" required>
                            </div>
                        </div>
                        
                         <div class="form-group">
                            <label class="form-label">Estado</label>
                            <select name="status" id="inp-status" class="form-input">
                                <option value="worked">Trabajado (Normal)</option>
                                <option value="half">Medio Día</option>
                                <option value="absent">Ausente</option>
                            </select>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                            <button type="button" class="btn btn-secondary" id="cancel-edit-btn" style="display:none;">Cancelar Edición</button>
                            <button type="submit" class="btn btn-primary" id="save-log-btn" style="width:100%; justify-content:center;">Guardar Registro</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        `;
    };

    modalContainer.innerHTML = renderContent();
    modalContainer.classList.remove('hidden');

    // --- ACTIONS ---

    // DELETE
    window.deleteLog = async (id) => {
        if (confirm('¿Seguro que deseas eliminar este registro?')) {
            try {
                // Delete from cloud first (if connected)
                if (window.Sync.client) {
                    const { error } = await window.Sync.client
                        .from('worklogs')  // lowercase 'worklogs'
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                }

                // Then delete locally
                await window.db.workLogs.delete(id);

                // Reload logs & Re-render
                const newLogs = await window.db.workLogs.where('date').equals(dateStr).toArray();
                logs.length = 0; logs.push(...newLogs);
                modalContainer.innerHTML = renderContent();

                // Refresh calendar view background
                const container = document.getElementById('view-container');
                if (window.Views.calendar) window.Views.calendar(container);
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
            }
        }
    };

    // EDIT PREPARE
    window.editLog = async (id) => {
        const log = logs.find(l => l.id === id);
        if (!log) return;

        document.getElementById('form-title').innerText = 'Editar Registro';
        document.getElementById('log-id').value = log.id;
        document.getElementById('inp-employee').value = log.employeeId;
        document.getElementById('inp-start').value = log.startTime;
        document.getElementById('inp-end').value = log.endTime;
        document.getElementById('inp-status').value = log.status || 'worked';

        const saveBtn = document.getElementById('save-log-btn');
        saveBtn.innerHTML = 'Actualizar Registro';
        saveBtn.classList.remove('btn-primary');
        saveBtn.style.background = 'var(--accent)';
        saveBtn.style.color = 'white';

        const cancelBtn = document.getElementById('cancel-edit-btn');
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.onclick = () => {
            document.getElementById('log-form').reset();
            document.getElementById('log-id').value = '';
            document.getElementById('form-title').innerText = 'Nuevo Registro';
            saveBtn.innerHTML = 'Guardar Registro';
            saveBtn.classList.add('btn-primary');
            saveBtn.style.background = '';
            cancelBtn.style.display = 'none';
        };
    };

    // SAVE / UPDATE
    document.getElementById('log-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const logId = formData.get('id'); // If present, update.

        const empId = Number(formData.get('employeeId'));
        const employee = employees.find(e => e.id === empId);

        const start = formData.get('startTime');
        const end = formData.get('endTime');
        const status = formData.get('status');

        let totalHours = 0;
        let payAmount = 0;

        if (status === 'worked' || status === 'half') {
            totalHours = window.Utils.calculateDuration(start, end);
            if (employee.hourlyRate > 0) {
                payAmount = totalHours * employee.hourlyRate;
            } else {
                payAmount = employee.dailyRate;
                if (status === 'half') payAmount = payAmount / 2;
            }
        }

        const logData = {
            employeeId: empId,
            date: dateStr,
            startTime: start,
            endTime: end,
            totalHours: Number(totalHours),
            payAmount: Number(payAmount),
            status: status
        };

        try {
            if (logId) {
                // Update
                await window.db.workLogs.update(Number(logId), logData);
            } else {
                // Create unique ID
                logData.id = Date.now() + Math.floor(Math.random() * 1000);
                await window.db.workLogs.add(logData);
            }

            // Sync Inmediato
            window.Sync.syncAll();

            // Refresh Modal List Intelligently
            const newLogs = await window.db.workLogs.where('date').equals(dateStr).toArray();
            logs.length = 0; logs.push(...newLogs);
            modalContainer.innerHTML = renderContent(); // Re-render modal to clear form and list

            // Refresh Background Calendar
            const container = document.getElementById('view-container');
            if (window.Views.calendar) window.Views.calendar(container);

        } catch (err) {
            alert('Error: ' + err.message);
        }
    });
}
