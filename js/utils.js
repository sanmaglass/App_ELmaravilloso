// Utility Functions (Global Scope)

window.Utils = {
    // Cache Intl instances for performance
    _currencyFormatter: new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
    }),

    formatCurrency: (amount, plain = false) => {
        // Optimized: Use cached formatter
        const formatted = window.Utils._currencyFormatter.format(amount);
        if (plain) return formatted;
        // Privacy: Wrap in span to allow global blur toggle
        return `<span class="money-sensitive" title="Monto Oculto">${formatted}</span>`;
    },

    // Helper to parse date string as local instead of UTC
    parseLocalDate: (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    formatDate: (dateString, options = {}) => {
        if (!dateString) return '';
        const date = dateString instanceof Date ? dateString : window.Utils.parseLocalDate(dateString);
        return new Intl.DateTimeFormat('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            ...options
        }).format(date);
    },

    generateId: () => {
        return Math.random().toString(36).substr(2, 9);
    },

    calculateDuration: (start, end) => {
        if (!start || !end) return 0;
        const startTime = new Date(`1970-01-01T${start}`);
        const endTime = new Date(`1970-01-01T${end}`);
        const diff = (endTime - startTime) / 1000 / 60 / 60; // hours
        return Math.max(0, diff.toFixed(2));
    },

    // --- Funciones Comerciales (Distribuidora) ---

    // Calcula desglose de IVA (19% Chile)
    // Retorna { net: number, tax: number, gross: number }
    calculateTaxDetails: (amount, isNet) => {
        const TAX_RATE = 0.19;
        let net, tax, gross;

        if (isNet) {
            net = Number(amount);
            tax = net * TAX_RATE;
            gross = net + tax;
        } else {
            gross = Number(amount);
            net = gross / (1 + TAX_RATE);
            tax = gross - net;
        }
        return { net, tax, gross };
    },

    // Calcula precio venta sugerido base a costo y margen %
    // Margen sobre venta: (Precio - Costo) / Precio = Margen%
    // Esto asegura que si quiero ganar el 30%, realmente me quede el 30% del ticket.
    calculateSalePrice: (cost, marginPercent) => {
        if (marginPercent >= 100) return cost * 2; // Evitar división por cero o negativos absurdos
        return cost / (1 - (marginPercent / 100));
    },

    // Redondeo Inteligente (Psicológico)
    // Ej: 1432 -> 1450, 1980 -> 1990
    smartRound: (value) => {
        let rounded = Math.ceil(value);

        // Estrategia: Redondear a la decena superior mas atractiva
        // Si termina en 1-9, pasar a 10.
        // Preferir terminaciones en 50, 90, 00.

        if (rounded < 1000) {
            // Redondear a 10
            return Math.ceil(rounded / 10) * 10;
        } else {
            // Redondear a 50 o 100
            // Ej: 1120 -> 1150. 1160 -> 1190 or 1200? 
            // Regla simple CL: Multiplo de 10
            return Math.ceil(rounded / 10) * 10;
        }
    },
    // --- AUTOMATIZACION DE NOMINA ---

    // Obtener días hábiles (Lunes a Sábado) entre dos fechas
    // Retorna array de strings 'YYYY-MM-DD'
    getBusinessDates: (startDateStr, endDateStr) => {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        const dates = [];
        let current = new Date(start);

        while (current <= end) {
            const dayOfWeek = current.getDay(); // 0 = Sunday
            if (dayOfWeek !== 0) { // Excluir Domingos (Configurable)
                dates.push(current.toISOString().split('T')[0]);
            }
            current.setDate(current.getDate() + 1);
        }
        return dates;
    },

    // Calcular pago diario estándar basado en configuración
    calculateDailyPay: (employee) => {
        // Prioridad 1: Valor Día Fijo
        if (employee.dailyRate > 0) return employee.dailyRate;

        // Prioridad 2: Valor Hora * (Jornada - Colacion)
        if (employee.hourlyRate > 0 && employee.workHoursPerDay > 0) {
            const breakHours = (employee.breakMinutes || 0) / 60;
            const effectiveHours = Math.max(0, employee.workHoursPerDay - breakHours);
            return effectiveHours * employee.hourlyRate;
        }

        return 0;
    },

    // --- PAYMENT TRACKING UTILITIES ---

    // Get configured week start day (0=Sunday, 1=Monday, etc.)
    getWeekStartDay: async () => {
        try {
            const setting = await window.db.settings.get('weekStartDay');
            return setting ? setting.value : 1; // Default to Monday
        } catch (e) {
            return 1;
        }
    },

    // Set week start day
    setWeekStartDay: async (day) => {
        try {
            await window.db.settings.put({ key: 'weekStartDay', value: day });
        } catch (e) {
            console.error('Error saving week start day:', e);
        }
    },

    // Get week periods for a given month
    // Returns array of { startDay, endDay, weekNumber }
    getWeekPeriods: (month, year, weekStartDay) => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        const periods = [];
        let currentWeekStart = 1;
        let weekNumber = 1;

        // Find first occurrence of weekStartDay in the month
        let firstWeekStart = 1;
        const firstDayOfWeek = firstDay.getDay();

        if (firstDayOfWeek !== weekStartDay) {
            firstWeekStart = 1 + ((weekStartDay - firstDayOfWeek + 7) % 7);
        }

        // If month doesn't start on week start day, create partial first week
        if (firstWeekStart > 1) {
            periods.push({
                startDay: 1,
                endDay: firstWeekStart - 1,
                weekNumber: weekNumber++
            });
            currentWeekStart = firstWeekStart;
        }

        // Create full 7-day periods
        while (currentWeekStart <= daysInMonth) {
            const weekEnd = Math.min(currentWeekStart + 6, daysInMonth);
            periods.push({
                startDay: currentWeekStart,
                endDay: weekEnd,
                weekNumber: weekNumber++
            });
            currentWeekStart = weekEnd + 1;
        }

        return periods;
    },

    // Get the start date of the week for a given date
    getWeekStartDate: (date, weekStartDay) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day - weekStartDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    // Calculate next payments for employees (moved from dashboard for reusability)
    calculateNextPayments: async (employees) => {
        const salaryEmps = employees.filter(e => e.paymentMode === 'salary');
        if (salaryEmps.length === 0) return '<p style="font-style:italic; opacity:0.7;">No hay pagos fijos configurados.</p>';

        const weekStartDay = await window.Utils.getWeekStartDay();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nextPayments = salaryEmps.map(emp => {
            let nextDate = new Date();
            let amount = 0;
            let label = '';

            if (emp.paymentFrequency === 'weekly') {
                // Align with configured Week Start Day
                // Payment occurs on the next occurrence of weekStartDay
                nextDate = new Date(today);

                // If today is the payment day and it's already past some criteria? 
                // Usually we show the NEXT one if today is the day or if we want clarity.
                // Let's find the next occurrence of weekStartDay.
                const currentDay = today.getDay();
                let daysUntilNext = (weekStartDay - currentDay + 7) % 7;

                // If today is the day, show next week? 
                // The user said "if she started on Jan 2 (Fri)... next day should be 9th (Mon)".
                // If today is Feb 2 (Mon) and week starts on Mon (1).
                // daysUntilNext = (1 - 1 + 7) % 7 = 0.
                // If it's 0, should we show today or next week?
                // User says "next day the 9th", so they want the future one.
                if (daysUntilNext === 0) daysUntilNext = 7;

                nextDate.setDate(today.getDate() + daysUntilNext);

                amount = emp.baseSalary / 4;
                label = 'Semanal (7 días)';
            } else if (emp.paymentFrequency === 'biweekly') {
                // ... rest remains same but with better date handling
                const currentDay = today.getDate();
                if (currentDay <= 15) {
                    nextDate = new Date(today.getFullYear(), today.getMonth(), 15);
                } else {
                    nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                }
                amount = emp.baseSalary / 2;
                label = 'Quincenal';
            } else {
                nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                amount = emp.baseSalary;
                label = 'Mensual';
            }

            return {
                name: emp.name,
                date: nextDate,
                amount: Math.round(amount),
                label: label
            };
        });

        nextPayments.sort((a, b) => a.date - b.date);

        return nextPayments.map(p => {
            const isToday = p.date.toDateString() === today.toDateString();
            const dateDisplay = isToday ? 'HOY' : window.Utils.formatDate(p.date, { weekday: 'short', day: 'numeric' });

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed rgba(0,0,0,0.1);">
                    <div>
                        <div style="font-weight:700; color:#991b1b;">${p.name}</div>
                        <div style="font-size:0.8rem;">${p.label} • ${dateDisplay}</div>
                    </div>
                    <div style="font-weight:700; font-size:1rem; color:#b91c1c;">
                        ${window.Utils.formatCurrency(p.amount)}
                    </div>
                </div>
             `;
        }).join('') + `<div style="text-align:center; font-size:0.8rem; margin-top:8px;"><a href="#" onclick="document.querySelector('[data-view=employees]').click()" style="color:var(--primary);">Configurar</a></div>`;
    },

    // --- DATABASE SYNC UTILITIES ---

    // Export all Dexie tables to a single JSON file
    exportDatabase: async () => {
        try {
            const data = {
                version: 1,
                timestamp: new Date().toISOString(),
                tables: {}
            };

            const tableNames = [
                'employees', 'workLogs', 'settings', 'products', 'promotions',
                'suppliers', 'purchase_invoices', 'sales_invoices', 'expenses', 'daily_sales'
            ];
            for (const name of tableNames) {
                data.tables[name] = await window.db[name].toArray();
            }

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Copia_El_Maravilloso_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (e) {
            console.error('Export error:', e);
            throw e;
        }
    },

    // Import data from a JSON file (Overwrites existing data)
    importDatabase: async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // Basic validation
                    if (!data.tables || !data.version) {
                        throw new Error("El archivo no es una copia de seguridad válida.");
                    }

                    if (!confirm("Esto sobrescribirá todos tus datos actuales de forma permanente. ¿Continuar?")) {
                        return resolve(false);
                    }

                    // Clear and Populate
                    for (const tableName in data.tables) {
                        if (window.db[tableName]) {
                            await window.db[tableName].clear();
                            await window.db[tableName].bulkAdd(data.tables[tableName]);
                        }
                    }

                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Error leyendo el archivo."));
            reader.readAsText(file);
        });
    },

    // Calculate total payments for a given month
    // NOW: Only counts COMPLETED/EARNED payments up to TODAY (not projected to end of month)
    // Returns detailed breakdown with projections
    calculateMonthlyPayments: async (employees, logs, referenceDate) => {
        const month = referenceDate.getMonth();
        const year = referenceDate.getFullYear();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let totalEarned = 0;
        let totalProjected = 0;
        let salaryEarned = 0;
        let salaryProjected = 0;

        // Method 1: Sum up all work logs with payAmount (for manual/hourly employees)
        const monthLogs = logs.filter(l => l.date.startsWith(monthStr));

        // Add manual employee payments from work logs
        const manualPayments = monthLogs
            .filter(l => {
                const emp = employees.find(e => e.id === l.employeeId);
                return emp && (!emp.paymentMode || emp.paymentMode === 'manual');
            })
            .reduce((sum, log) => sum + (log.payAmount || 0), 0);

        totalEarned += manualPayments;
        totalProjected += manualPayments; // For manual, earned = projected (already happened)

        // Method 2: Calculate completed payment cycles for salary employees
        const salaryEmployees = employees.filter(e => e.paymentMode === 'salary');

        for (const emp of salaryEmployees) {
            if (!emp.startDate || !emp.baseSalary) continue;

            const startDate = new Date(emp.startDate);
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);

            // Only count if employee started before or during this month
            if (startDate > monthEnd) continue;

            const freq = emp.paymentFrequency || 'monthly';
            const cycleAmount = freq === 'weekly' ? (emp.baseSalary / 4) :
                freq === 'biweekly' ? (emp.baseSalary / 2) :
                    emp.baseSalary;

            let cyclesCompleted = 0; // Up to TODAY
            let cyclesProjected = 0; // Total for the month


            if (freq === 'weekly') {
                // Count completed weeks within the month
                const weekStartDay = await window.Utils.getWeekStartDay();

                // Find all week start dates in the month
                let currentDate = new Date(monthStart);
                while (currentDate <= monthEnd) {
                    const dayOfWeek = currentDate.getDay();

                    // If this is a week start day AND after employee started
                    if (dayOfWeek === weekStartDay && currentDate >= startDate) {
                        // This week started in the month
                        cyclesProjected++;

                        // Calculate week end (6 days after start)
                        const weekEnd = new Date(currentDate);
                        weekEnd.setDate(currentDate.getDate() + 6);

                        // Only count as COMPLETED if week end has PASSED
                        if (weekEnd <= today) {
                            cyclesCompleted++;
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            } else if (freq === 'biweekly') {
                // Biweekly: 15th and end of month
                const mid = new Date(year, month, 15);
                const end = new Date(year, month + 1, 0);

                // Check 15th payment
                if (mid >= startDate && mid >= monthStart && mid <= monthEnd) {
                    cyclesProjected++;
                    if (mid <= today) cyclesCompleted++;
                }

                // Check end of month payment
                if (end >= startDate) {
                    cyclesProjected++;
                    if (end <= today) cyclesCompleted++;
                }
            } else {
                // Monthly: one payment at end of month
                if (monthEnd >= startDate) {
                    cyclesProjected = 1;
                    if (monthEnd <= today) cyclesCompleted = 1;
                }
            }

            const earned = cyclesCompleted * cycleAmount;
            const projected = cyclesProjected * cycleAmount;

            salaryEarned += earned;
            salaryProjected += projected;
            totalEarned += earned;
            totalProjected += projected;
        }

        return {
            totalPaid: Math.round(totalEarned), // What's been EARNED up to today
            totalProjected: Math.round(totalProjected), // What will be paid by end of month
            breakdown: {
                manual: Math.round(manualPayments),
                salaryEarned: Math.round(salaryEarned),
                salaryProjected: Math.round(salaryProjected)
            },
            pending: Math.round(totalProjected - totalEarned) // What's still to be earned
        };
    }
};
