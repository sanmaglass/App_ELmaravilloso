// Employees View
window.Views = window.Views || {};

window.Views.employees = async (container) => {
    // Check if Utils exists
    if (!window.Utils) {
        container.innerHTML = "<p>Error: Falta módulo de utilidades.</p>";
        return;
    }

    const employees = await window.db.employees.toArray();

    container.innerHTML = `
        <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1>Personal</h1>
                <p class="hide-mobile" style="color:var(--text-muted);">Gestión de equipo y tarifas</p>
            </div>
            <button class="btn btn-primary" onclick="window.showEmployeeModal()">
                <i class="ph ph-plus"></i> <span class="hide-mobile">Nuevo Empleado</span><span class="show-mobile-only" style="display:none;">Nuevo</span>
            </button>
        </div>
        
        <div class="grid-employees" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:24px;">
            ${employees.length === 0 ? '<p style="grid-column:1/-1; text-align:center; padding:40px;">No hay empleados registrados.</p>' : ''}
        </div>
    `;

    const grid = container.querySelector('.grid-employees');

    if (employees.length > 0) {
        grid.innerHTML = employees.map(emp => `
            <div class="card card-hover" style="position:relative;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div class="avatar" style="width:56px; height:56px; font-size:1.4rem; background:linear-gradient(135deg, var(--primary), #880000); box-shadow:0 4px 10px rgba(136,0,0,0.3);">
                            ${emp.avatar || emp.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:1.15rem; color:var(--text-primary);">${emp.name}</div>
                            <div style="color:var(--text-secondary); font-size:0.9rem; display:flex; align-items:center; gap:6px;">
                                <i class="ph ph-briefcase"></i> ${emp.role || 'Sin Cargo'}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.showEmployeeModal(${emp.id})" class="btn-icon" style="width:36px; height:36px; font-size:1.1rem;" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                        <button onclick="window.deleteEmployee(${emp.id})" class="btn-icon" style="width:36px; height:36px; font-size:1.1rem; color:var(--danger); border-color:var(--danger);" title="Borrar"><i class="ph ph-trash"></i></button>
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.03); padding:12px; border-radius:8px; margin-bottom:16px;">
                    <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Jornada Laboral</div>
                    <div class="responsive-grid-2">
                        <div style="font-size:0.9rem;"><i class="ph ph-clock"></i> <b>${emp.workHoursPerDay || 0}h</b> diarias</div>
                        <div style="font-size:0.9rem;"><i class="ph ph-coffee"></i> <b>${emp.breakMinutes || 0}m</b> colación</div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; padding-top:16px; border-top:1px solid var(--border);">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Valor Hora</div>
                        <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${window.Utils.formatCurrency(emp.hourlyRate)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">Valor Día (Est.)</div>
                        <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">${window.Utils.formatCurrency(window.Utils.calculateDailyPay(emp))}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- ACTIONS ---
    window.deleteEmployee = async (id) => {
        if (confirm('¿Eliminar este empleado? Se mantendrán sus registros históricos pero ya no aparecerá en nuevos turnos.')) {
            try {
                // Delete from cloud first (if connected)
                if (window.Sync.client) {
                    const { error } = await window.Sync.client
                        .from('employees')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                }

                // Then delete locally
                await window.db.employees.delete(id);

                // Refresh view immediately
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

                        <div class="form-group" style="background:rgba(220,38,38,0.05); padding:16px; border-radius:12px; border:1px solid var(--primary);">
                            <label class="form-label" style="color:var(--primary); font-weight:700;">📅 Fecha de Inicio</label>
                            <input type="date" name="startDate" class="form-input" required value="${emp?.startDate || new Date().toISOString().split('T')[0]}">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                                Esta fecha se usa para calcular automáticamente los días trabajados y pagos pendientes.
                            </p>
                        </div>

                        <div class="responsive-grid-2" style="margin:20px 0; background:rgba(255,0,0,0.03); padding:16px; border-radius:12px; border:1px dashed var(--primary);">
                            <div class="form-group">
                                <label class="form-label" style="color:var(--primary);">Jornada Diaria (Horas)</label>
                                <input type="number" name="workHoursPerDay" class="form-input" placeholder="Ej. 9" value="${emp?.workHoursPerDay || 9}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="color:var(--primary);">Tiempo Colación (Min)</label>
                                <input type="number" name="breakMinutes" class="form-input" placeholder="Ej. 60" value="${emp?.breakMinutes || 60}">
                            </div>
                        </div>

                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-muted); text-transform:uppercase;">Esquema de Remuneración</h4>
                        
                        <!-- Mode Selector -->
                        <div class="form-group" style="margin-bottom:16px;">
                            <label class="form-label">Modalidad de Pago</label>
                            <select name="paymentMode" id="inp-paymentMode" class="form-input" onchange="window.togglePaymentFields()">
                                <option value="manual" ${(!emp?.paymentMode || emp?.paymentMode === 'manual') ? 'selected' : ''}>Manual (Valor Hora/Día Fijo)</option>
                                <option value="salary" ${emp?.paymentMode === 'salary' ? 'selected' : ''}>Sueldo Fijo (Mensual/Semanal)</option>
                            </select>
                        </div>

                        <!-- Manual Fields -->
                        <div id="manual-fields" class="responsive-grid-2" style="display:${(!emp?.paymentMode || emp?.paymentMode === 'manual') ? 'grid' : 'none'};">
                            <div class="form-group">
                                <label class="form-label">Valor Hora ($)</label>
                                <input type="number" name="hourlyRate" class="form-input" placeholder="0" value="${emp?.hourlyRate || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Valor Día ($)</label>
                                <input type="number" name="dailyRate" class="form-input" placeholder="0" value="${emp?.dailyRate || ''}">
                            </div>
                        </div>

                        <!-- Salary Fields -->
                        <div id="salary-fields" style="display:${emp?.paymentMode === 'salary' ? 'block' : 'none'}; background:var(--bg-card); border:1px solid var(--primary); padding:16px; border-radius:12px;">
                            <div class="form-group">
                                <label class="form-label">Sueldo Base Mensual</label>
                                <input type="number" id="inp-baseSalary" name="baseSalary" class="form-input" placeholder="Ej. 580000" value="${emp?.baseSalary || ''}" oninput="window.calculateSalaryPreview()">
                            </div>
                            
                            <div class="form-group" style="margin-top:12px;">
                                <label class="form-label">Frecuencia de Pago</label>
                                <select name="paymentFrequency" id="inp-frequency" class="form-input" onchange="window.calculateSalaryPreview()">
                                    <option value="weekly" ${emp?.paymentFrequency === 'weekly' ? 'selected' : ''}>Semanal (cada 7 días)</option>
                                    <option value="biweekly" ${emp?.paymentFrequency === 'biweekly' ? 'selected' : ''}>Quincenal (2 veces al mes)</option>
                                    <option value="monthly" ${emp?.paymentFrequency === 'monthly' ? 'selected' : ''}>Mensual (1 vez al mes)</option>
                                </select>
                            </div>

                            <!-- Preview Result -->
                            <div id="salary-preview" style="margin-top:16px; padding:12px; background:rgba(255,255,255,0.5); border-radius:8px; font-size:0.9rem;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                    <span style="color:var(--text-muted);">Pago por Ciclo:</span>
                                    <strong id="preview-cyclePay">$0</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="color:var(--text-muted);">Valor Hora (Ref):</span>
                                    <strong id="preview-hourlyRef">$0</strong>
                                </div>
                                <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; font-style:italic;">
                                    *El valor hora se usa para descontar atrasos/faltas.
                                </p>
                            </div>
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
            const mode = formData.get('paymentMode');

            const employeeData = {
                name: formData.get('name'),
                role: formData.get('role'),
                startDate: formData.get('startDate'), // Capture from form
                workHoursPerDay: Number(formData.get('workHoursPerDay')) || 0,
                breakMinutes: Number(formData.get('breakMinutes')) || 0,
                avatar: formData.get('name').substring(0, 2).toUpperCase(),

                // New Fields
                paymentMode: mode,
                baseSalary: Number(formData.get('baseSalary')) || 0,
                paymentFrequency: formData.get('paymentFrequency'),
            };

            // Calculate Rates Logic
            if (mode === 'salary') {
                // Auto-calculate rates to ensure compatibility with existing log system
                const base = employeeData.baseSalary;
                const freq = employeeData.paymentFrequency;
                const hoursDay = employeeData.workHoursPerDay;
                // Assuming 6 days work week as standard distribution (can be refined)
                const weeklyHours = hoursDay * 6;

                let cyclePay = 0;
                if (freq === 'weekly') cyclePay = base / 4;
                else if (freq === 'biweekly') cyclePay = base / 2;
                else cyclePay = base;

                // Set Hourly Rate for deductions/partial calculations
                // Formula: CyclePay / HoursInCycle
                let hoursInCycle = 0;
                if (freq === 'weekly') hoursInCycle = weeklyHours;
                else if (freq === 'biweekly') hoursInCycle = weeklyHours * 2;
                else hoursInCycle = weeklyHours * 4;

                employeeData.hourlyRate = Math.round(cyclePay / hoursInCycle);

                // Daily Rate (Reference for full day)
                employeeData.dailyRate = Math.round(cyclePay / (freq === 'weekly' ? 6 : (freq === 'biweekly' ? 12 : 24)));
            } else {
                // Manual Mode
                employeeData.hourlyRate = Number(formData.get('hourlyRate')) || 0;
                employeeData.dailyRate = Number(formData.get('dailyRate')) || 0;
            }

            try {
                if (id) {
                    // Update: id can be string or numeric from old version
                    await window.db.employees.update(id, employeeData);
                } else {
                    // New: Create unique ID to avoid collisions in cloud
                    employeeData.id = Date.now() + Math.floor(Math.random() * 1000);
                    await window.db.employees.add(employeeData);
                }

                // Sync Inmediato
                window.Sync.syncAll();

                modalContainer.classList.add('hidden');
                window.Views.employees(container);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });

        // --- AUTOMATION FEATURE: HISTORICAL PROJECTION ---
        if (id && emp && emp.startDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            const startStr = emp.startDate.split('T')[0];

            // Solo si empezó antes de hoy
            if (startStr < todayStr) {
                const modalBody = modalContainer.querySelector('.modal-body');

                const projectionDiv = document.createElement('div');
                projectionDiv.style.marginTop = "20px";
                projectionDiv.style.background = "linear-gradient(135deg, #fff0f0, #ffecec)";
                projectionDiv.style.border = "1px solid var(--primary)";
                projectionDiv.style.borderRadius = "12px";
                projectionDiv.style.padding = "16px";
                projectionDiv.innerHTML = `
                    <h4 style="color:var(--primary); margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-magic-wand"></i> Automatización de Asistencia
                    </h4>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px;">
                        Este empleado inició el <b>${window.Utils.formatDate(startStr)}</b>. 
                        ¿Quieres generar su asistencia automáticamente hasta hoy?
                    </p>
                    <button id="btn-project-logs" type="button" class="btn btn-primary" style="width:100%; font-size:0.9rem;">
                        Calcular Deuda y Generar
                    </button>
                    <div id="projection-result" style="margin-top:12px; font-size:0.9rem; display:none;"></div>
                `;

                modalBody.appendChild(projectionDiv);

                document.getElementById('btn-project-logs').addEventListener('click', async () => {
                    const resultDiv = document.getElementById('projection-result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<span class="loader"></span> Calculando...';

                    // 1. Get Business Days
                    const businessDates = window.Utils.getBusinessDates(startStr, todayStr);

                    // 2. Check existing logs to avoid duplicates
                    const existingLogs = await window.db.workLogs.where('employeeId').equals(Number(id)).toArray();
                    const existingDates = new Set(existingLogs.map(l => l.date));

                    // 3. Filter missing dates
                    const missingDates = businessDates.filter(d => !existingDates.has(d));

                    if (missingDates.length === 0) {
                        resultDiv.innerHTML = `<span style="color:green;">¡Todo al día! No faltan registros.</span>`;
                        return;
                    }

                    // 4. Calculate Pay
                    const dailyPay = window.Utils.calculateDailyPay(emp);
                    const totalDebt = missingDates.length * dailyPay;
                    const hoursPerDay = emp.workHoursPerDay || 0;
                    const breakHours = (emp.breakMinutes || 0) / 60;
                    const effectiveHours = Math.max(0, hoursPerDay - breakHours);

                    // 5. Ask Confirmation
                    if (confirm(`Se generarán ${missingDates.length} registros (días hábiles faltantes).\nTotal a Pagar Estimado: ${window.Utils.formatCurrency(totalDebt)}\n\n¿Proceder?`)) {
                        const newLogs = missingDates.map(date => ({
                            employeeId: Number(id),
                            date: date,
                            startTime: '09:00', // Default start
                            endTime: '18:00',   // Default end (TODO: Calculate based on hours)
                            totalHours: effectiveHours,
                            payAmount: dailyPay,
                            status: 'worked-auto'
                        }));

                        await window.db.workLogs.bulkAdd(newLogs);
                        alert('¡Éxito! Registros generados. El calendario ahora está completo.');
                        modalContainer.classList.add('hidden');
                        window.Views.employees(container);
                    } else {
                        resultDiv.innerHTML = 'Operación cancelada.';
                    }
                });
            }
        }
        // --- HELPER FUNCTIONS FOR MODAL ---
        window.togglePaymentFields = () => {
            const mode = document.getElementById('inp-paymentMode').value;
            document.getElementById('manual-fields').style.display = mode === 'manual' ? 'grid' : 'none';
            document.getElementById('salary-fields').style.display = mode === 'salary' ? 'block' : 'none';
            if (mode === 'salary') window.calculateSalaryPreview();
        };

        window.calculateSalaryPreview = () => {
            const baseSalary = Number(document.getElementById('inp-baseSalary').value) || 0;
            const frequency = document.getElementById('inp-frequency').value;
            const hoursPerDay = Number(document.querySelector('input[name="workHoursPerDay"]').value) || 9; // Fallback
            // Get week hours roughly: hours * 6 days (assuming Mon-Sat from image)
            const weeklyHours = hoursPerDay * 6;

            let cyclePay = 0;
            let hourlyRef = 0;

            if (baseSalary > 0) {
                if (frequency === 'weekly') {
                    // Method from image: Base / 4 weeks
                    cyclePay = baseSalary / 4;
                    // Hourly Ref: CyclePay / WeeklyHours
                    hourlyRef = weeklyHours > 0 ? cyclePay / weeklyHours : 0;
                } else if (frequency === 'biweekly') {
                    cyclePay = baseSalary / 2;
                    hourlyRef = (baseSalary / 2) / (weeklyHours * 2);
                } else {
                    cyclePay = baseSalary;
                    hourlyRef = baseSalary / (weeklyHours * 4);
                }
            }

            document.getElementById('preview-cyclePay').innerHTML = window.Utils.formatCurrency(cyclePay);
            document.getElementById('preview-hourlyRef').innerHTML = window.Utils.formatCurrency(hourlyRef);

            // Auto-fill hidden values to be compatible with existing logic if user saves
            // We set the "official" hourlyRate to the calculated reference so partial works are calculated correctly
        };

        // Initialize preview if editing
        if (emp?.paymentMode === 'salary') {
            setTimeout(window.calculateSalaryPreview, 100);
        }
    };
};
