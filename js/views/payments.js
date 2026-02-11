// Payments View - Visual Payment Tracking
window.Views = window.Views || {};

window.Views.payments = async (container) => {
    // Get current settings
    const weekStartDay = await window.Utils.getWeekStartDay();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    container.innerHTML = `
        <div class="stack-on-mobile" style="justify-content:space-between; align-items:center; margin-bottom:24px;">
            <div>
                <h1 style="margin:0; display:flex; align-items:center; gap:12px;">
                    <i class="ph ph-wallet" style="color:var(--primary);"></i>
                    <span class="hide-mobile">Gestión de</span> Pagos
                </h1>
                <p style="color:var(--text-muted); margin-top:4px;">Control de períodos y planillas</p>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
                <select id="week-start-selector" class="form-input" style="width:auto; padding:8px 16px;">
                    <option value="0" ${weekStartDay === 0 ? 'selected' : ''}>Dom</option>
                    <option value="1" ${weekStartDay === 1 ? 'selected' : ''}>Lun</option>
                </select>
            </div>
        </div>

        <div class="responsive-grid-2-1">
            <!-- Calendar Section -->
            <div class="card" style="background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%); border: 2px solid var(--primary); box-shadow: 0 10px 40px rgba(220, 38, 38, 0.15);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid rgba(220, 38, 38, 0.1);">
                    <h2 style="margin:0; color:var(--primary); display:flex; align-items:center; gap:10px;">
                        <i class="ph ph-calendar-dots" style="font-size:1.5rem;"></i>
                        <span id="calendar-month-title">Cargando...</span>
                    </h2>
                    <div style="display:flex; gap:8px;">
                        <button id="prev-month" class="btn btn-icon" style="width:36px; height:36px;">
                            <i class="ph ph-caret-left"></i>
                        </button>
                        <button id="next-month" class="btn btn-icon" style="width:36px; height:36px;">
                            <i class="ph ph-caret-right"></i>
                        </button>
                    </div>
                </div>

                <!-- Calendar Grid -->
                <div id="calendar-container"></div>

                <!-- Week Legend -->
                <div style="margin-top:20px; padding-top:16px; border-top:1px solid rgba(0,0,0,0.1);">
                    <div style="font-size:0.85rem; font-weight:600; color:var(--text-muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">
                        Leyenda de Períodos
                    </div>
                    <div id="week-legend" style="display:flex; flex-wrap:wrap; gap:12px;"></div>
                </div>
            </div>

            <!-- Payments Summary Section -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- Next Payments Card -->
                <div class="card" style="background:linear-gradient(135deg, #fff0f0, #fff); border:1px solid #ffcccc;">
                    <h3 style="margin:0 0 16px 0; color:#b91c1c; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-money"></i> Próximos Pagos
                    </h3>
                    <div id="upcoming-payments-list" style="font-size:0.9rem; color:var(--text-secondary);">
                        <span class="loader"></span> Calculando...
                    </div>
                </div>

                <!-- Current Week Summary -->
                <div class="card" style="background:linear-gradient(135deg, #f0f9ff, #fff); border:1px solid #bfdbfe;">
                    <h3 style="margin:0 0 16px 0; color:#1e40af; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-calendar-check"></i> Semana Actual
                    </h3>
                    <div id="current-week-summary" style="font-size:0.9rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="color:var(--text-muted);">Período:</span>
                            <strong id="current-week-range">-</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="color:var(--text-muted);">Días transcurridos:</span>
                            <strong id="current-week-days">-</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.1);">
                            <span style="color:var(--text-muted);">Pago estimado:</span>
                            <strong style="color:#1e40af; font-size:1.1rem;" id="current-week-payment">$0</strong>
                        </div>
                    </div>
                </div>

                <!-- Month Summary -->
                <div class="card" style="background:linear-gradient(135deg, #f0fdf4, #fff); border:1px solid #bbf7d0;">
                    <h3 style="margin:0 0 16px 0; color:#15803d; display:flex; align-items:center; gap:8px;">
                        <i class="ph ph-chart-line"></i> Resumen del Mes
                    </h3>
                    <div style="font-size:0.9rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="color:var(--text-muted);">Total pagado:</span>
                            <strong style="color:#15803d;" id="month-total-paid">$0</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="color:var(--text-muted);">Días trabajados:</span>
                            <strong id="month-days-worked">0</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">Empleados activos:</span>
                            <strong id="month-active-employees">0</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // State
    let currentDisplayMonth = currentMonth;
    let currentDisplayYear = currentYear;

    // Render Calendar Function
    const renderCalendar = async () => {
        const weekStart = await window.Utils.getWeekStartDay();
        const firstDay = new Date(currentDisplayYear, currentDisplayMonth, 1);
        const lastDay = new Date(currentDisplayYear, currentDisplayMonth + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Calculate which day of week the month starts on (adjusted for week start)
        let startDayOfWeek = firstDay.getDay() - weekStart;
        if (startDayOfWeek < 0) startDayOfWeek += 7;

        // Update title
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('calendar-month-title').textContent =
            `${monthNames[currentDisplayMonth]} ${currentDisplayYear}`;

        // Get week periods
        const weekPeriods = window.Utils.getWeekPeriods(currentDisplayMonth, currentDisplayYear, weekStart);

        // Day names (adjusted for week start)
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const adjustedDayNames = [];
        for (let i = 0; i < 7; i++) {
            adjustedDayNames.push(dayNames[(weekStart + i) % 7]);
        }

        // Build calendar HTML
        let calendarHTML = `
            <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:8px;">
                ${adjustedDayNames.map(day => `
                    <div style="text-align:center; font-weight:700; font-size:0.85rem; color:var(--text-muted); padding:8px; text-transform:uppercase; letter-spacing:0.5px;">
                        ${day}
                    </div>
                `).join('')}
        `;

        // Empty cells before month starts
        for (let i = 0; i < startDayOfWeek; i++) {
            calendarHTML += `<div style="aspect-ratio:1; border-radius:8px;"></div>`;
        }

        // Color palette for weeks
        const weekColors = [
            { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#991b1b' },
            { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#1e3a8a' },
            { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#065f46' },
            { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#92400e' },
            { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6', text: '#5b21b6' },
            { bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899', text: '#831843' }
        ];

        // Days of month
        const today = new Date();
        const isCurrentMonth = currentDisplayMonth === today.getMonth() && currentDisplayYear === today.getFullYear();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDisplayYear, currentDisplayMonth, day);
            const isToday = isCurrentMonth && day === today.getDate();
            const isPast = date < today && !isToday;

            // Find which week this day belongs to
            let weekIndex = -1;
            for (let i = 0; i < weekPeriods.length; i++) {
                if (day >= weekPeriods[i].startDay && day <= weekPeriods[i].endDay) {
                    weekIndex = i;
                    break;
                }
            }

            const weekColor = weekIndex >= 0 ? weekColors[weekIndex % weekColors.length] : weekColors[0];

            calendarHTML += `
                <div style="
                    aspect-ratio:1; 
                    border-radius:12px; 
                    background:${weekColor.bg}; 
                    border:2px solid ${isToday ? weekColor.border : 'transparent'};
                    display:flex; 
                    flex-direction:column;
                    align-items:center; 
                    justify-content:center;
                    position:relative;
                    transition: all 0.2s ease;
                    ${isPast ? 'opacity:0.6;' : ''}
                    ${isToday ? 'box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: scale(1.05);' : ''}
                    cursor:pointer;
                " onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)';" 
                   onmouseout="this.style.transform='${isToday ? 'scale(1.05)' : 'scale(1)'}'; this.style.boxShadow='${isToday ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'}';">
                    <div style="font-size:1.2rem; font-weight:700; color:${weekColor.text};">
                        ${day}
                    </div>
                    ${isToday ? `<div style="font-size:0.65rem; font-weight:600; color:${weekColor.border}; text-transform:uppercase; margin-top:2px;">Hoy</div>` : ''}
                    ${isPast ? `<div style="position:absolute; top:4px; right:4px; width:6px; height:6px; border-radius:50%; background:#10b981;"></div>` : ''}
                </div>
            `;
        }

        calendarHTML += `</div>`;
        document.getElementById('calendar-container').innerHTML = calendarHTML;

        // Render legend
        let legendHTML = weekPeriods.map((period, idx) => {
            const color = weekColors[idx % weekColors.length];
            const startDate = new Date(currentDisplayYear, currentDisplayMonth, period.startDay);
            const endDate = new Date(currentDisplayYear, currentDisplayMonth, period.endDay);

            return `
                <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:${color.bg}; border:1px solid ${color.border}; border-radius:8px;">
                    <div style="width:16px; height:16px; border-radius:4px; background:${color.border};"></div>
                    <div style="font-size:0.85rem; color:${color.text}; font-weight:600;">
                        Semana ${idx + 1}: ${period.startDay}-${period.endDay}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('week-legend').innerHTML = legendHTML;

        // Update current week summary
        await updateCurrentWeekSummary();
        await updateMonthSummary();
    };

    // Update current week summary
    const updateCurrentWeekSummary = async () => {
        const weekStart = await window.Utils.getWeekStartDay();
        const today = new Date();

        // Calculate current week range
        const currentWeekStart = window.Utils.getWeekStartDate(today, weekStart);
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

        // Format dates
        const formatShort = (date) => {
            const day = date.getDate();
            const month = date.getMonth() + 1;
            return `${day}/${month}`;
        };

        document.getElementById('current-week-range').textContent =
            `${formatShort(currentWeekStart)} - ${formatShort(currentWeekEnd)}`;

        // Calculate days elapsed in current week
        // Count which day number we're on (1-7)
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysDiff = (today - currentWeekStart) / msPerDay;
        const daysElapsed = Math.floor(daysDiff) + 1;

        document.getElementById('current-week-days').textContent = `${daysElapsed} de 7`;

        // Calculate estimated payment for current week
        const employees = await window.db.employees.toArray();
        const weeklyEmployees = employees.filter(e => e.paymentMode === 'salary' && e.paymentFrequency === 'weekly');
        const totalWeeklyPayment = weeklyEmployees.reduce((sum, emp) => sum + (emp.baseSalary / 4), 0);

        document.getElementById('current-week-payment').innerHTML = window.Utils.formatCurrency(totalWeeklyPayment);
    };

    // Update month summary
    const updateMonthSummary = async () => {
        const monthStr = `${currentDisplayYear}-${String(currentDisplayMonth + 1).padStart(2, '0')}`;
        const logs = await window.db.workLogs.toArray();
        const monthLogs = logs.filter(l => l.date.startsWith(monthStr));

        const totalPaid = monthLogs.reduce((sum, log) => sum + (log.payAmount || 0), 0);
        const uniqueDays = new Set(monthLogs.map(l => l.date)).size;
        const uniqueEmployees = new Set(monthLogs.map(l => l.employeeId)).size;

        document.getElementById('month-total-paid').innerHTML = window.Utils.formatCurrency(totalPaid);
        document.getElementById('month-days-worked').textContent = uniqueDays;
        document.getElementById('month-active-employees').textContent = uniqueEmployees;
    };

    // Update upcoming payments
    const updateUpcomingPayments = async () => {
        const employees = await window.db.employees.toArray();
        const html = await window.Utils.calculateNextPayments(employees);
        document.getElementById('upcoming-payments-list').innerHTML = html;
    };

    // Event Listeners
    document.getElementById('week-start-selector').addEventListener('change', async (e) => {
        await window.Utils.setWeekStartDay(Number(e.target.value));
        await renderCalendar();
    });

    document.getElementById('prev-month').addEventListener('click', async () => {
        currentDisplayMonth--;
        if (currentDisplayMonth < 0) {
            currentDisplayMonth = 11;
            currentDisplayYear--;
        }
        await renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', async () => {
        currentDisplayMonth++;
        if (currentDisplayMonth > 11) {
            currentDisplayMonth = 0;
            currentDisplayYear++;
        }
        await renderCalendar();
    });

    // Initial render
    await renderCalendar();
    await updateUpcomingPayments();
};
