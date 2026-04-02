// Utility Functions (Global Scope)

window.Utils = {
    // Escape HTML to prevent XSS attacks
    escapeHTML: (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            const escapeMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escapeMap[match];
        });
    },

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
        // Solo tomar la parte de la fecha YYYY-MM-DD
        const cleanDate = String(dateStr).split('T')[0].split(' ')[0];
        const parts = cleanDate.split('-').map(Number);
        if (parts.length !== 3) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
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
    getBusinessDates(startDateStr, endDateStr) {
        const dates = [];
        let current = this.parseLocalDate(startDateStr);
        const end = this.parseLocalDate(endDateStr);

        while (current <= end) {
            // 0 is Sunday
            if (current.getDay() !== 0) {
                dates.push(current.toISOString().split('T')[0]);
            }
            current.setDate(current.getDate() + 1);
        }
        return dates;
    },

    // --- MANEJO DE DEUDA DE HORAS ---
    calculateRecoveryPlan: (emp) => {
        if (!emp || !emp.owedMinutes || emp.owedMinutes <= 0 || !emp.recoveryRateMinutes || emp.recoveryRateMinutes <= 0) {
            return null;
        }

        const daysNeeded = Math.ceil(emp.owedMinutes / emp.recoveryRateMinutes);
        let daysCounted = 0;
        let currentDate = emp.recoveryStartDate ? window.Utils.parseLocalDate(emp.recoveryStartDate) : new Date();

        // Skip today if it's already past their default end time (only if start date is today)
        if (emp.defaultEndTime && (!emp.recoveryStartDate || emp.recoveryStartDate === new Date().toISOString().split('T')[0])) {
            const [endH, endM] = emp.defaultEndTime.split(':').map(Number);
            if (currentDate.getHours() > endH || (currentDate.getHours() === endH && currentDate.getMinutes() >= endM)) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        while (daysCounted < daysNeeded) {
            if (currentDate.getDay() !== 0) { // Skip sunday
                daysCounted++;
            }
            if (daysCounted < daysNeeded) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // Calculate the extended time for display
        let extendedTime = "N/A";
        if (emp.defaultEndTime) {
            const [h, m] = emp.defaultEndTime.split(':').map(Number);
            const totalMins = h * 60 + m + parseInt(emp.recoveryRateMinutes);
            const newH = Math.floor(totalMins / 60) % 24;
            const newM = totalMins % 60;
            extendedTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        }

        return {
            daysNeeded,
            targetDate: currentDate,
            targetDateStr: currentDate.toISOString().split('T')[0],
            extendedTime,
            remainingMinutesFinalDay: emp.owedMinutes % emp.recoveryRateMinutes || emp.recoveryRateMinutes
        };
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
            totalPaid: Math.round(totalEarned),
            totalProjected: Math.round(totalProjected),
            breakdown: {
                manual: Math.round(manualPayments),
                salaryEarned: Math.round(salaryEarned),
                salaryProjected: Math.round(salaryProjected)
            },
            pending: Math.round(totalProjected - totalEarned)
        };
    },

    animateNumber: (el, start, end, duration = 1000, isCurrency = false) => {
        if (!el) return;
        
        // --- BU GUARD: Evitar "saltos" si el valor objetivo no ha cambiado ---
        const targetVal = parseFloat(end) || 0;
        const currentTarget = parseFloat(el.dataset.targetValue);
        
        // Si ya estamos animando hacia este valor o ya terminamos en él, ignorar
        if (currentTarget === targetVal) {
            return; 
        }
        
        // Registrar nuevo objetivo
        el.dataset.targetValue = targetVal;
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (targetVal - start) + start);
            
            // Solo actualizar el DOM si el valor calculado es distinto al texto actual
            // (Pequeña optimización de renderizado)
            const formatted = isCurrency ? window.Utils.formatCurrency(value) : value.toLocaleString();
            if (el.innerHTML !== formatted) {
                el.innerHTML = formatted;
            }
            
            if (progress < 1) {
                // Verificar si durante la animación cambió el objetivo (otra llamada a animateNumber)
                if (parseFloat(el.dataset.targetValue) === targetVal) {
                    window.requestAnimationFrame(step);
                }
            } else {
                // Asegurar valor final exacto
                el.innerHTML = isCurrency ? window.Utils.formatCurrency(targetVal) : targetVal.toLocaleString();
            }
        };
        window.requestAnimationFrame(step);
    },

    // --- NOTIFICATION MANAGER ---
    NotificationManager: {
        async requestPermission() {
            if (!('Notification' in window)) {
                console.warn('Este navegador no soporta notificaciones.');
                return false;
            }

            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Permiso de notificaciones concedido.');
                return true;
            }
            return false;
        },

        async show(title, body, url = './index.html') {
            // Verificar si la app tiene permiso
            if (!('Notification' in window) || Notification.permission !== 'granted') return;

            // Si la aplicación está enfocada (en primer plano), opcionalmente NO mostrar notificación
            // para no duplicar con los Toasts internos. Pero para iPhone, a veces es mejor mostrarla.
            try {
                // serviceWorker.ready puede colgar indefinidamente si la app se abre como file://
                // Usamos un timeout para caer en la notificación nativa estándar
                const registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 3000))
                ]);
                registration.showNotification(title, options);
            } catch {
                // Fallback: notificación nativa sin service worker
                new Notification(title, options);
            }
        },

        isSupported() {
            return 'Notification' in window;
        },

        getPermissionState() {
            return window.Notification ? Notification.permission : 'not-supported';
        },

        // --- DEBOUNCED NOTIFICATIONS (Anti-Spam) ---
        _notifQueue: [],
        _notifTimeout: null,

        debouncedShow(title, body, url = './index.html') {
            if (document.visibilityState === 'visible') return; // Silence if app open

            this._notifQueue.push({ body });

            if (this._notifTimeout) clearTimeout(this._notifTimeout);

            this._notifTimeout = setTimeout(async () => {
                const count = this._notifQueue.length;
                let finalTitle = title;
                let finalBody = body;

                if (count > 1) {
                    finalTitle = 'El Maravilloso';
                    finalBody = `Tienes ${count} nuevas actualizaciones pendientes.`;
                }

                await this.show(finalTitle, finalBody, url);
                this._notifQueue = [];
                this._notifTimeout = null;
            }, 2000); // Wait 2 seconds of silence before firing
        }
    },

    // --- 🧠 PREDICTIVE ENGINE V2 (Regresión & Insights) ---
    PredictionEngine: {
        async getProjectedSales() {
            try {
                // Helper interno para estandarizar fechas a YYYY-MM-DD
                const toKey = (d) => {
                    if (!d) return null;
                    const dateObj = d instanceof Date ? d : window.Utils.parseLocalDate(d);
                    if (!dateObj || isNaN(dateObj.getTime())) return null;
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                };

                const [daily, eleventa] = await Promise.all([
                    window.db.daily_sales.toArray(),
                    window.db.eleventa_sales.toArray()
                ]);

                const salesMap = new Map();
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                // 1. Consolidación Robusta O(N)
                const manualEntries = daily.filter(s => !s.deleted && s.date);
                const closedDays = new Set();
                
                manualEntries.forEach(s => {
                    const key = toKey(s.date);
                    if (key) {
                        salesMap.set(key, parseFloat(s.total || 0) || 0);
                        closedDays.add(key);
                    }
                });

                eleventa.filter(s => !s.deleted && s.date).forEach(s => {
                    const key = toKey(s.date);
                    if (key && !closedDays.has(key)) {
                        const amount = parseFloat(s.total || s.cash || s.amount || 0) || 0;
                        salesMap.set(key, (salesMap.get(key) || 0) + amount);
                    }
                });

                const allSales = Array.from(salesMap.entries())
                    .map(([date, amount]) => ({ date, amount }))
                    .sort((a, b) => a.date.localeCompare(b.date));

                if (allSales.length < 2) return null;

                // 2. Regresión Lineal Multi-Mes (MoM Growth)
                const monthlyData = {};
                allSales.forEach(s => {
                    const mKey = s.date.substring(0, 7); // YYYY-MM
                    monthlyData[mKey] = (monthlyData[mKey] || 0) + s.amount;
                });

                const monthKeys = Object.keys(monthlyData).sort();
                const monthValues = monthKeys.map(k => monthlyData[k]);
                
                const regressionMonths = monthValues.slice(-6);
                let slope = 0; 
                if (regressionMonths.length >= 2) {
                    const n = regressionMonths.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    for (let i = 0; i < n; i++) {
                        sumX += i;
                        sumY += regressionMonths[i];
                        sumXY += i * regressionMonths[i];
                        sumXX += i * i;
                    }
                    const denom = (n * sumXX - sumX * sumX);
                    slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
                }

                if (isNaN(slope)) slope = 0;

                // 3. Estacionalidad Semanal
                const weekdayTotals = [0,0,0,0,0,0,0], weekdayCounts = [0,0,0,0,0,0,0];
                let maxDaily = 0;

                allSales.forEach(s => {
                    const d = window.Utils.parseLocalDate(s.date);
                    if (d) {
                        const day = d.getDay();
                        weekdayTotals[day] += s.amount;
                        weekdayCounts[day]++;
                        if (s.amount > maxDaily) maxDaily = s.amount;
                    }
                });

                const weekdayAverages = weekdayTotals.map((tot, i) => weekdayCounts[i] > 0 ? tot / weekdayCounts[i] : 0);
                const globalAvg = weekdayAverages.reduce((a, b) => a + b, 0) / 7;
                const weights = weekdayAverages.map(avg => globalAvg > 0 ? avg / globalAvg : 1);

                // 4. MTD y Proyección
                let mtdTotal = 0;
                allSales.forEach(s => {
                    const d = window.Utils.parseLocalDate(s.date);
                    if (d && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                        mtdTotal += s.amount;
                    }
                });

                const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                const todayNum = now.getDate();
                let projection = mtdTotal;
                
                const recentHistory = allSales.slice(-14);
                const recentAvg = (recentHistory.reduce((a, b) => a + b.amount, 0) / (recentHistory.length || 1)) || globalAvg;
                const dailyGrowthAdjust = slope / 30;
                let adjustedGlobalAvg = (globalAvg * 0.4) + (recentAvg * 0.6) + dailyGrowthAdjust;
                if (adjustedGlobalAvg < 0) adjustedGlobalAvg = globalAvg;

                for (let d = todayNum + 1; d <= lastDayOfMonth; d++) {
                    const dateObj = new Date(currentYear, currentMonth, d);
                    projection += Math.max(0, adjustedGlobalAvg * weights[dateObj.getDay()]);
                }

                // 5. Comparación
                const prevMonthTotal = monthlyData[monthKeys[monthKeys.length - 2]] || 0;
                const growthPct = prevMonthTotal > 0 ? ((projection / prevMonthTotal - 1) * 100) : 0;

                // 6. Insight Generator
                let insight = "Analizando tus datos para darte la mejor estrategia...";
                let color = "#94a3b8";

                if (allSales.length > 5) {
                    if (growthPct > 10) {
                        insight = `+${growthPct.toFixed(0)}% proyectado vs mes ant.`;
                        color = "#10b981";
                    } else if (growthPct < -5) {
                        insight = `${growthPct.toFixed(0)}% proyectado (Baja detectada)`;
                        color = "#f43f5e";
                    } else if (projection > Math.max(...monthValues.slice(0, -1), 0)) {
                        insight = "Récord histórico de facturación a la vista";
                        color = "#fbbf24";
                    } else {
                        insight = "Patrón de ventas estable detectado";
                        color = "#60a5fa";
                    }
                }

                return {
                    mtdTotal,
                    projectedTotal: Math.round(projection) || 0,
                    prevMonthTotal,
                    maxDaily,
                    insight,
                    insightColor: color,
                    confidence: allSales.length > 60 ? 'high' : allSales.length > 20 ? 'medium' : 'low'
                };

            } catch (e) {
                console.error("AI Engine Error:", e);
                return null;
            }
        }
    }
};

// --- Utilidad: Arrastre Horizontal con el Mouse (solo escritorio) ---
// Llamar con: window.Utils.setupHorizontalDragScroll(elemento)
// En celulares con táctil, el scroll nativo (touch-action: pan-x) ya lo gestiona el navegador.
window.Utils.setupHorizontalDragScroll = (el) => {
    if (!el) return;

    let isDragging = false;
    let startX = 0;
    let scrollStart = 0;
    let movedDistance = 0;

    el.addEventListener('mousedown', (e) => {
        // Solo activar con el botón izquierdo del ratón
        if (e.button !== 0) return;
        isDragging = true;
        movedDistance = 0;
        startX = e.pageX - el.offsetLeft;
        scrollStart = el.scrollLeft;
        el.classList.add('dragging');
        e.preventDefault(); // Evita selección de texto al arrastrar
    });

    el.addEventListener('mouseleave', () => {
        isDragging = false;
        el.classList.remove('dragging');
    });

    el.addEventListener('mouseup', () => {
        isDragging = false;
        el.classList.remove('dragging');
    });

    el.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5; // Multiplicador para velocidad de desplazamiento
        movedDistance = Math.abs(walk);
        el.scrollLeft = scrollStart - walk;
    });

    // Evitar que un "click accidental" durante el arrastre active links/botones internos
    el.addEventListener('click', (e) => {
        if (movedDistance > 5) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
};

// --- GLOBAL SHORTCUTS ---
window.formatCurrency = (amount, plain = false) => window.Utils.formatCurrency(amount, plain);
window.formatDate = (dateString, options = {}) => window.Utils.formatDate(dateString, options);
window.generateId = () => window.Utils.generateId();
window.escapeHTML = (str) => window.Utils.escapeHTML(str);
