/**
 * money-calculations.test.js
 * Tests exhaustivos para las funciones PURAS de cálculo financiero en js/utils.js.
 *
 * Funciones cubiertas (todas son puras: entrada → salida, sin DOM ni DB):
 *   - Utils.sumMoney(...values)          — suma anti–floating point
 *   - Utils.calculateTaxDetails(amount, isNet) — IVA 19% Chile
 *   - Utils.calculateDuration(start, end)    — horas entre dos strings HH:MM
 *   - Utils.calculateSalePrice(cost, margin) — precio de venta con margen sobre venta
 *   - Utils.smartRound(value)                — redondeo psicológico
 *   - Utils.calculateDailyPay(employee)      — pago diario según config empleado
 *   - Utils.getPaymentCycleAmount(employee)  — monto bruto por ciclo de pago
 *   - Utils.getPaymentStatus(employee)       — estado del próximo pago
 */

// ── Configuración de entorno mínimo (utils.js necesita window global) ─────────
// Utils.formatCurrency usa Intl.NumberFormat (ya disponible en Node/jsdom).
// Algunos métodos acceden a window.db (async), pero los que testeamos aquí son puros.
global.window = {
    Utils: undefined,
    db: undefined, // No necesario para funciones puras
    // Mocks de DOM que utils.js podría necesitar al cargarse
    addEventListener:      jest.fn(),
    dispatchEvent:         jest.fn(),
    requestAnimationFrame: jest.fn(),
};

// Algunos getters de Utils usan Notification global
global.Notification = { permission: 'default' };

// Cargar utils.js — registra window.Utils
require('../js/utils.js');

const U = window.Utils;

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1: sumMoney — Suma anti–floating point
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.sumMoney — Suma monetaria sin errores de flotante', () => {

    test('suma básica exacta: 0.1 + 0.2 = 0.3 (no 0.30000000000000004)', () => {
        expect(U.sumMoney(0.1, 0.2)).toBe(0.3);
    });

    test('suma de enteros chilenos típicos', () => {
        expect(U.sumMoney(10000, 5000, 3000)).toBe(18000);
    });

    test('suma con decimales de precio', () => {
        expect(U.sumMoney(1.5, 2.5)).toBe(4);
    });

    test('suma con valores grandes (millones)', () => {
        expect(U.sumMoney(1000000, 2500000, 750000)).toBe(4250000);
    });

    test('valores negativos (descuentos)', () => {
        expect(U.sumMoney(10000, -2000)).toBe(8000);
    });

    test('mezcla de positivos y negativos que dan cero', () => {
        expect(U.sumMoney(5000, -5000)).toBe(0);
    });

    test('strings numéricos son parseados correctamente', () => {
        expect(U.sumMoney('1000', '500')).toBe(1500);
    });

    test('string no numérico ("abc") se trata como 0', () => {
        expect(U.sumMoney(1000, 'abc')).toBe(1000);
    });

    test('undefined se trata como 0', () => {
        expect(U.sumMoney(500, undefined)).toBe(500);
    });

    test('null se trata como 0', () => {
        expect(U.sumMoney(500, null)).toBe(500);
    });

    test('sin argumentos retorna 0', () => {
        expect(U.sumMoney()).toBe(0);
    });

    test('un solo argumento retorna ese valor', () => {
        expect(U.sumMoney(9999)).toBe(9999);
    });

    test('suma de muchos valores pequeños (acumulación de error flotante sin protección)', () => {
        // 0.1 sumado 10 veces debe dar 1.0, no 0.9999999999999999
        const result = U.sumMoney(...Array(10).fill(0.1));
        expect(result).toBe(1.0);
    });

    test('montos decimales reales en Chile (pesos con centavos de dólar)', () => {
        // Aunque CLP no tiene decimales en uso, la función debe manejarlos
        expect(U.sumMoney(1234.56, 789.44)).toBe(2024);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 2: calculateTaxDetails — IVA 19% Chile
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.calculateTaxDetails — IVA 19% Chile', () => {

    // ── isNet = true: partir del NETO ────────────────────────────────────────
    describe('isNet = true (el monto es neto)', () => {

        test('neto 10.000 → tax 1.900 → bruto 11.900', () => {
            const { net, tax, gross } = U.calculateTaxDetails(10000, true);
            expect(net).toBe(10000);
            expect(tax).toBe(1900);
            expect(gross).toBe(11900);
        });

        test('neto 0 → todos en cero', () => {
            const { net, tax, gross } = U.calculateTaxDetails(0, true);
            expect(net).toBe(0);
            expect(tax).toBe(0);
            expect(gross).toBe(0);
        });

        test('tasa de IVA es exactamente 19%', () => {
            const { net, tax } = U.calculateTaxDetails(100, true);
            expect(tax / net).toBeCloseTo(0.19, 10);
        });

        test('gross = net + tax (integridad)', () => {
            const { net, tax, gross } = U.calculateTaxDetails(50000, true);
            expect(gross).toBeCloseTo(net + tax, 10);
        });

        test('neto 100.000 → bruto 119.000', () => {
            const { gross } = U.calculateTaxDetails(100000, true);
            expect(gross).toBe(119000);
        });

        test('neto típico factura: 840.336 → bruto 999.999,84 (redondeo nativo JS)', () => {
            // 840336 * 1.19 = 999999.84 — verificar que la aritmética es correcta
            const { gross } = U.calculateTaxDetails(840336, true);
            expect(gross).toBeCloseTo(999999.84, 1);
        });
    });

    // ── isNet = false: partir del BRUTO ─────────────────────────────────────
    describe('isNet = false (el monto es bruto con IVA incluido)', () => {

        test('bruto 11.900 → neto 10.000 → tax 1.900', () => {
            const { net, tax, gross } = U.calculateTaxDetails(11900, false);
            expect(gross).toBe(11900);
            expect(net).toBeCloseTo(10000, 1);
            expect(tax).toBeCloseTo(1900, 1);
        });

        test('bruto 0 → todos en cero', () => {
            const { net, tax, gross } = U.calculateTaxDetails(0, false);
            expect(gross).toBe(0);
            expect(net).toBe(0);
            expect(tax).toBe(0);
        });

        test('tasa efectiva resultante es 19%', () => {
            const { net, tax } = U.calculateTaxDetails(11900, false);
            expect(tax / net).toBeCloseTo(0.19, 5);
        });

        test('gross = net + tax (integridad)', () => {
            const { net, tax, gross } = U.calculateTaxDetails(59500, false);
            expect(gross).toBeCloseTo(net + tax, 10);
        });

        test('bruto 119.000 → neto 100.000', () => {
            const { net } = U.calculateTaxDetails(119000, false);
            expect(net).toBeCloseTo(100000, 2);
        });

        test('ida y vuelta: neto → bruto → neto recupera el original', () => {
            const original = 50000;
            const { gross } = U.calculateTaxDetails(original, true);
            const { net: recovered } = U.calculateTaxDetails(gross, false);
            expect(recovered).toBeCloseTo(original, 2);
        });
    });

    // ── Casos borde ──────────────────────────────────────────────────────────
    test('string numérico como amount es convertido correctamente', () => {
        const { net, gross } = U.calculateTaxDetails('10000', true);
        expect(net).toBe(10000);
        expect(gross).toBe(11900);
    });

    test('monto negativo (nota de crédito) funciona con isNet=true', () => {
        const { net, tax, gross } = U.calculateTaxDetails(-10000, true);
        expect(net).toBe(-10000);
        expect(tax).toBe(-1900);
        expect(gross).toBe(-11900);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3: calculateDuration — Horas entre dos tiempos HH:MM
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.calculateDuration — Cálculo de horas trabajadas', () => {

    test('08:00 a 17:00 = 9 horas', () => {
        expect(Number(U.calculateDuration('08:00', '17:00'))).toBe(9);
    });

    test('09:00 a 18:30 = 9.5 horas', () => {
        expect(Number(U.calculateDuration('09:00', '18:30'))).toBeCloseTo(9.5, 2);
    });

    test('08:00 a 08:00 = 0 horas (mismo horario)', () => {
        expect(Number(U.calculateDuration('08:00', '08:00'))).toBe(0);
    });

    test('fin antes que inicio retorna 0 (no negativo)', () => {
        // calculateDuration usa Math.max(0, diff), garantizado por el código
        expect(Number(U.calculateDuration('18:00', '08:00'))).toBe(0);
    });

    test('start vacío retorna 0', () => {
        expect(Number(U.calculateDuration('', '17:00'))).toBe(0);
    });

    test('end vacío retorna 0', () => {
        expect(Number(U.calculateDuration('09:00', ''))).toBe(0);
    });

    test('ambos vacíos retorna 0', () => {
        expect(Number(U.calculateDuration('', ''))).toBe(0);
    });

    test('null / undefined retorna 0', () => {
        expect(Number(U.calculateDuration(null, null))).toBe(0);
        expect(Number(U.calculateDuration(undefined, undefined))).toBe(0);
    });

    test('jornada media: 08:00 a 13:00 = 5 horas', () => {
        expect(Number(U.calculateDuration('08:00', '13:00'))).toBe(5);
    });

    test('1 hora exacta', () => {
        expect(Number(U.calculateDuration('10:00', '11:00'))).toBe(1);
    });

    test('30 minutos = 0.5 horas', () => {
        expect(Number(U.calculateDuration('10:00', '10:30'))).toBeCloseTo(0.5, 2);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 4: calculateSalePrice — Precio de venta con margen sobre venta
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.calculateSalePrice — Precio de venta con margen', () => {

    test('margen 0% = precio igual al costo', () => {
        expect(U.calculateSalePrice(1000, 0)).toBe(1000);
    });

    test('margen 50% sobre venta: costo 500 → precio 1000', () => {
        // Precio = 500 / (1 - 0.5) = 1000
        expect(U.calculateSalePrice(500, 50)).toBe(1000);
    });

    test('margen 20% sobre venta: costo 800 → precio 1000', () => {
        // Precio = 800 / (1 - 0.2) = 1000
        expect(U.calculateSalePrice(800, 20)).toBeCloseTo(1000, 2);
    });

    test('margen 30%: verificar fórmula (precio - costo) / precio = 30%', () => {
        const cost = 700;
        const price = U.calculateSalePrice(cost, 30);
        const actualMargin = (price - cost) / price;
        expect(actualMargin).toBeCloseTo(0.3, 5);
    });

    test('margen >= 100% no causa división por cero (retorna cost * 2)', () => {
        expect(U.calculateSalePrice(1000, 100)).toBe(2000);
        expect(U.calculateSalePrice(1000, 150)).toBe(2000);
    });

    test('margen negativo (precio por debajo del costo)', () => {
        // margen -20%: precio = 1000 / (1 - (-0.2)) = 1000 / 1.2 ≈ 833.33
        const price = U.calculateSalePrice(1000, -20);
        expect(price).toBeCloseTo(1000 / 1.2, 2);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 5: smartRound — Redondeo psicológico
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.smartRound — Redondeo psicológico a múltiplo de 10', () => {

    test('valor ya en múltiplo de 10 no cambia', () => {
        expect(U.smartRound(1000)).toBe(1000);
        expect(U.smartRound(500)).toBe(500);
    });

    test('redondea hacia arriba al próximo múltiplo de 10 (< 1000)', () => {
        expect(U.smartRound(432)).toBe(440);
        expect(U.smartRound(1)).toBe(10);
        expect(U.smartRound(9)).toBe(10);
        expect(U.smartRound(11)).toBe(20);
    });

    test('redondea hacia arriba al próximo múltiplo de 10 (>= 1000)', () => {
        expect(U.smartRound(1001)).toBe(1010);
        expect(U.smartRound(1432)).toBe(1440);
        expect(U.smartRound(9991)).toBe(10000);
    });

    test('valor 0 retorna 0', () => {
        expect(U.smartRound(0)).toBe(0);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 6: calculateDailyPay — Pago diario de empleado
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.calculateDailyPay — Cálculo de pago diario', () => {

    test('prioridad 1: usa dailyRate si es > 0', () => {
        const emp = { dailyRate: 25000, hourlyRate: 2000, workHoursPerDay: 8, breakMinutes: 60 };
        expect(U.calculateDailyPay(emp)).toBe(25000);
    });

    test('prioridad 2: usa hourlyRate * horas efectivas (sin colación)', () => {
        // 8 horas - 1 hora colación = 7 horas efectivas × $2.000 = $14.000
        const emp = { dailyRate: 0, hourlyRate: 2000, workHoursPerDay: 8, breakMinutes: 60 };
        expect(U.calculateDailyPay(emp)).toBe(14000);
    });

    test('sin colación: hourlyRate * workHoursPerDay completo', () => {
        const emp = { dailyRate: 0, hourlyRate: 1500, workHoursPerDay: 9, breakMinutes: 0 };
        expect(U.calculateDailyPay(emp)).toBe(13500);
    });

    test('retorna 0 si no hay dailyRate ni hourlyRate', () => {
        const emp = { dailyRate: 0, hourlyRate: 0, workHoursPerDay: 8 };
        expect(U.calculateDailyPay(emp)).toBe(0);
    });

    test('colación mayor que jornada no da negativo (Math.max(0, ...))', () => {
        const emp = { dailyRate: 0, hourlyRate: 1000, workHoursPerDay: 4, breakMinutes: 300 };
        // 4h - 5h = -1h → Math.max(0, -1) = 0
        expect(U.calculateDailyPay(emp)).toBe(0);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 7: getPaymentCycleAmount — Monto por ciclo de pago
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.getPaymentCycleAmount — Monto por ciclo de pago', () => {

    test('mensual: retorna el sueldo base completo', () => {
        const emp = { baseSalary: 400000, paymentFrequency: 'monthly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(400000);
    });

    test('semanal: retorna baseSalary / 4 (redondeado)', () => {
        const emp = { baseSalary: 400000, paymentFrequency: 'weekly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(100000);
    });

    test('quincenal: retorna baseSalary / 2 (redondeado)', () => {
        const emp = { baseSalary: 400000, paymentFrequency: 'biweekly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(200000);
    });

    test('frecuencia desconocida cae en mensual', () => {
        const emp = { baseSalary: 300000, paymentFrequency: 'annually' };
        expect(U.getPaymentCycleAmount(emp)).toBe(300000);
    });

    test('sueldo como string es parseado', () => {
        const emp = { baseSalary: '360000', paymentFrequency: 'weekly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(90000);
    });

    test('sueldo inválido retorna 0', () => {
        const emp = { baseSalary: 'abc', paymentFrequency: 'monthly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(0);
    });

    test('sueldo undefined retorna 0', () => {
        const emp = { paymentFrequency: 'weekly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(0);
    });

    test('redondeo: sueldo impar dividido por 4', () => {
        // 350000 / 4 = 87500 (exacto)
        const emp = { baseSalary: 350000, paymentFrequency: 'weekly' };
        expect(U.getPaymentCycleAmount(emp)).toBe(87500);
    });
});


// ══════════════════════════════════════════════════════════════════════════════
// SUITE 8: getPaymentStatus — Estado del próximo pago
// ══════════════════════════════════════════════════════════════════════════════
describe('Utils.getPaymentStatus — Estado del próximo pago', () => {

    // Usamos un empleado sin startDate ni lastPaymentDate para aislar la lógica de fechas.
    // La función calcula nextDate y la compara con "hoy".

    test('retorna objeto con status, label, daysUntil, nextDate', () => {
        const emp = { paymentFrequency: 'monthly' };
        const result = U.getPaymentStatus(emp);
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('daysUntil');
        expect(result).toHaveProperty('nextDate');
        expect(result.nextDate instanceof Date).toBe(true);
    });

    test('status válido es uno de: ok, upcoming, due_today, overdue', () => {
        const emp = { paymentFrequency: 'monthly' };
        const { status } = U.getPaymentStatus(emp);
        expect(['ok', 'upcoming', 'due_today', 'overdue']).toContain(status);
    });

    test('empleado mensual: nextDate es el último día del mes actual o próximo', () => {
        const emp = { paymentFrequency: 'monthly' };
        const { nextDate } = U.getPaymentStatus(emp);
        const today = new Date();
        // El último día del mes tiene getDate() entre 28 y 31
        expect(nextDate.getDate()).toBeGreaterThanOrEqual(28);
        expect(nextDate.getFullYear()).toBeGreaterThanOrEqual(today.getFullYear());
    });

    test('daysUntil es un número', () => {
        const emp = { paymentFrequency: 'monthly' };
        const { daysUntil } = U.getPaymentStatus(emp);
        expect(typeof daysUntil).toBe('number');
    });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * PENDIENTES: funciones de cálculo que NO son puras (requieren DOM o DB)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Las siguientes funciones tienen lógica de cálculo valiosa pero están
 * embebidas en operaciones asíncronas que dependen de window.db o window.Utils.getWeekStartDay()
 * (que a su vez hace await window.db.settings.get(...)). Para testearlas habría que
 * pasar primero window.db mockeado o usar fake-indexeddb.
 *
 * PENDIENTE: calculateMonthlyPayments(employees, logs, referenceDate)
 *   — Calcula pagos ganados/proyectados del mes. Usa await Utils.getWeekStartDay()
 *     que accede a window.db.settings. Requiere mock de db.settings.get().
 *
 * PENDIENTE: calculateDailyBurnRate(expenses, employees, referenceDate)
 *   — Calcula burn rate diario desde gastos fijos. Es casi pura (recibe arrays),
 *     pero retorna Promise. Podría testearse sin DB mockeando los arrays.
 *     TODO: extraer la parte síncrona de reducción de arrays a función pura separada.
 *
 * PENDIENTE: PredictionEngine.getProjectedSales()
 *   — Regresión lineal + estacionalidad. Lógica de ML pura, pero hace
 *     await window.db.daily_sales.toArray() y await window.db.eleventa_sales.toArray().
 *     TODO: extraer la lógica de regresión a una función pura que reciba los arrays.
 *
 * PENDIENTE: calculateNextPayments(employees)
 *   — Genera HTML de próximos pagos. Mezcla cálculo de fechas con renderizado HTML.
 *     TODO: extraer la lógica de cálculo de nextDate a función pura y testearla.
 *
 * PENDIENTE: calculateRecoveryPlan(emp)
 *   — Calcula plan de recuperación de horas adeudadas. Es casi pura (recibe emp).
 *     Usa Utils.parseLocalDate() que es pura. Podría testearse directamente.
 *     TODO: agregar tests si se expande el módulo de recuperación de horas.
 */
