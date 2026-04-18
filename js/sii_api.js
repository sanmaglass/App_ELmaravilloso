/**
 * SII API Service — Consulta RCV vía BaseAPI.cl
 * Defaults hardcodeados para la cuenta principal.
 * Se pueden sobreescribir desde Settings (localStorage).
 */
// Limpiar caché viejo de ventas (v3 no leía resumenPorTipo → datos vacíos)
// Se ejecuta una vez, luego el flag impide que se repita
(function() {
    const FLAG = 'sii_ventas_cache_v4_migrated';
    if (localStorage.getItem(FLAG)) return;
    // Borrar todas las claves sii_ventas_v3_* para forzar recarga desde API
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sii_ventas_v3_')) toDelete.push(key);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
    if (toDelete.length > 0) console.log(`🧹 Caché ventas v3 limpiado: ${toDelete.length} períodos borrados (se recargarán con resumenPorTipo)`);
    localStorage.setItem(FLAG, Date.now().toString());
})();

window.SII_API = {

    // Defaults de la cuenta principal (sobreescribibles desde Settings)
    _defaults: {
        apiKey: 'sk_8bc5fa1e06cb022e94f09760069cedd3cb3709af8622ea46',
        rut: '14061423-8',
        password: 'Ubiobio56!'
    },

    // --- Rate Limiter: max 5 req/min = 1 cada 13s ---
    _queue: [],
    _queueRunning: false,
    _lastRequestTime: 0,
    _MIN_INTERVAL: 13000, // 13 segundos entre requests (5/min con margen)

    /** Encola una llamada a la API y la ejecuta respetando el rate limit */
    _enqueue(fn) {
        return new Promise((resolve, reject) => {
            this._queue.push({ fn, resolve, reject });
            this._processQueue();
        });
    },

    async _processQueue() {
        if (this._queueRunning) return;
        this._queueRunning = true;

        while (this._queue.length > 0) {
            const { fn, resolve, reject } = this._queue.shift();
            const elapsed = Date.now() - this._lastRequestTime;
            const wait = Math.max(0, this._MIN_INTERVAL - elapsed);

            if (wait > 0) {
                console.log(`⏳ Rate limiter: esperando ${Math.ceil(wait / 1000)}s antes de siguiente request...`);
                await new Promise(r => setTimeout(r, wait));
            }

            try {
                this._lastRequestTime = Date.now();
                const result = await fn();
                resolve(result);
            } catch (err) {
                // Si es 429, esperar 60s y reintentar una vez
                if (err.message && err.message.includes('429')) {
                    console.warn('🚫 429 recibido, esperando 60s para reintentar...');
                    await new Promise(r => setTimeout(r, 60000));
                    try {
                        this._lastRequestTime = Date.now();
                        const result = await fn();
                        resolve(result);
                    } catch (retryErr) {
                        reject(retryErr);
                    }
                } else {
                    reject(err);
                }
            }
        }

        this._queueRunning = false;
    },

    getConfig() {
        return {
            apiKey: localStorage.getItem('sii_baseapi_key') || this._defaults.apiKey,
            rut: localStorage.getItem('sii_rut') || this._defaults.rut,
            password: localStorage.getItem('sii_password') || this._defaults.password
        };
    },

    isConfigured() {
        const c = this.getConfig();
        return !!(c.apiKey && c.rut && c.password);
    },

    /**
     * Consulta el Registro de Compras y Ventas (RCV) del SII
     * Todas las llamadas pasan por un rate limiter (max 5 req/min).
     * @param {string} periodo - Formato YYYY-MM (ej: "2026-04")
     * @param {string} tipo - "compra" o "venta"
     * @returns {Object} { success, data: { totalRegistros, datos[], resumenPorTipo[] } }
     */
    async consultarRCV(periodo, tipo = 'compra') {
        const config = this.getConfig();
        if (!config.apiKey || !config.rut || !config.password) {
            throw new Error('Faltan credenciales SII. Configúralas en Ajustes → Integración SII.');
        }

        // Cada request pasa por la cola rate-limited
        return this._enqueue(async () => {
            const url = `/api/sii/rcv/${periodo}/${tipo}`;
            console.log(`📡 SII API: consultando ${tipo} ${periodo}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey
                },
                body: JSON.stringify({
                    rut: config.rut,
                    password: config.password
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Error BaseAPI (${response.status}): ${text}`);
            }

            const data = await response.json();
            console.log(`✅ SII API: ${tipo} ${periodo} OK`);
            return data;
        });
    },

    /**
     * Importa facturas del RCV a la BD local.
     * SII es la fuente de verdad: RUT identifica al proveedor, nombre viene del SII.
     * @param {string} periodo - Formato YYYY-MM
     * @returns {Object} { imported, skipped, newSuppliers, updatedSuppliers, errors }
     */
    async importarFacturas(periodo) {
        const result = await this.consultarRCV(periodo, 'compra');

        if (!result.success || !result.data?.datos) {
            throw new Error('No se pudieron obtener datos del SII');
        }

        const datos = result.data.datos;
        const stats = { imported: 0, skipped: 0, newSuppliers: 0, updatedSuppliers: 0, errors: [] };

        // Cargar proveedores y facturas existentes
        const [existingSuppliers, existingInvoices] = await Promise.all([
            window.db.suppliers.toArray(),
            window.db.purchase_invoices.toArray()
        ]);

        const activeInvoices = existingInvoices.filter(i => !i.deleted);

        // Índice de facturas por folio+rut para evitar duplicados
        const invoiceIndex = new Set();
        activeInvoices.forEach(inv => {
            if (inv.invoiceNumber && inv.siiRutProveedor) {
                invoiceIndex.add(`${inv.invoiceNumber}_${inv.siiRutProveedor}`);
            }
        });

        // Índice de proveedores por RUT — el RUT es el identificador único
        const supplierByRut = {};
        existingSuppliers.filter(s => !s.deleted).forEach(s => {
            if (s.rut) supplierByRut[s.rut.toUpperCase()] = s;
        });

        for (const factura of datos) {
            try {
                // Saltar filas sin Nro (son sub-líneas de impuestos adicionales)
                if (!factura['Nro'] || factura['Nro'] === '') continue;

                const tipoDoc = parseInt(factura['Tipo Doc']);
                if (![33, 34, 61].includes(tipoDoc)) continue;

                const folio = factura['Folio'];
                const rutProveedor = (factura['RUT Proveedor'] || '').toUpperCase();
                const razonSocial = (factura['Razon Social'] || '').trim();

                // Verificar si ya existe por folio+rut
                const key = `${folio}_${rutProveedor}`;
                if (invoiceIndex.has(key)) {
                    stats.skipped++;
                    continue;
                }

                // --- PROVEEDOR: RUT es la clave, nombre del SII es la verdad ---
                let supplier = supplierByRut[rutProveedor];

                if (supplier) {
                    // Existe: actualizar nombre al del SII (ellos saben el nombre correcto)
                    if (razonSocial && supplier.name !== razonSocial) {
                        await window.DataManager.saveAndSync('suppliers', {
                            ...supplier,
                            name: razonSocial,
                            rut: rutProveedor
                        });
                        supplier.name = razonSocial;
                        stats.updatedSuppliers++;
                    }
                } else if (rutProveedor) {
                    // No existe: crear con datos del SII
                    await window.DataManager.saveAndSync('suppliers', {
                        name: razonSocial || rutProveedor,
                        rut: rutProveedor,
                        deleted: false
                    });
                    const allSup = await window.db.suppliers.toArray();
                    supplier = allSup.find(s => s.rut === rutProveedor && !s.deleted);
                    if (supplier) supplierByRut[rutProveedor] = supplier;
                    stats.newSuppliers++;
                }

                // Parsear montos
                const montoNeto = parseInt(factura['Monto Neto']) || 0;
                const montoIva = parseInt(factura['Monto IVA Recuperable']) || 0;
                const montoExento = parseInt(factura['Monto Exento']) || 0;
                const montoTotal = parseInt(factura['Monto Total']) || 0;

                // Parsear fecha (viene como DD/MM/YYYY)
                const fechaParts = (factura['Fecha Docto'] || '').split('/');
                const fechaISO = fechaParts.length === 3
                    ? `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}`
                    : periodo + '-01';

                const tipoDocNombre = tipoDoc === 33 ? 'Factura'
                    : tipoDoc === 34 ? 'Factura Exenta'
                    : tipoDoc === 61 ? 'Nota de Crédito' : `DTE ${tipoDoc}`;

                const [y, m] = periodo.split('-');
                const periodoLabel = new Date(Number(y), Number(m) - 1, 1)
                    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

                const invoiceData = {
                    supplierId: supplier?.id || null,
                    supplierName: razonSocial,
                    invoiceNumber: String(folio),
                    date: fechaISO,
                    amount: tipoDoc === 61 ? -montoTotal : montoTotal,
                    period: periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1),
                    paymentMethod: 'Pendiente',
                    paymentStatus: 'Pendiente',
                    paidAmount: 0,
                    notes: `${tipoDocNombre} · Neto: $${montoNeto.toLocaleString('es-CL')} · IVA: $${montoIva.toLocaleString('es-CL')}${montoExento > 0 ? ` · Exento: $${montoExento.toLocaleString('es-CL')}` : ''}`,
                    deleted: false,
                    siiTipoDoc: tipoDoc,
                    siiRutProveedor: rutProveedor,
                    siiFolio: folio,
                    siiMontoNeto: montoNeto,
                    siiMontoIva: montoIva,
                    siiMontoExento: montoExento,
                    siiImportado: true,
                    siiImportDate: new Date().toISOString()
                };

                await window.DataManager.saveAndSync('purchase_invoices', invoiceData);
                invoiceIndex.add(key);
                stats.imported++;

            } catch (err) {
                stats.errors.push(`Folio ${factura['Folio']}: ${err.message}`);
            }
        }

        return stats;
    },

    /**
     * Importa múltiples períodos de una vez
     * @param {number} meses - Cantidad de meses hacia atrás
     * @param {Function} onProgress - Callback de progreso (periodo, index, total)
     */
    async importarMultiplesPeriodos(meses = 2, onProgress = null) {
        const results = [];
        const now = new Date();

        for (let i = 0; i < meses; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            if (onProgress) onProgress(periodo, i + 1, meses);

            try {
                const stats = await this.importarFacturas(periodo);
                results.push({ periodo, ...stats });
            } catch (err) {
                results.push({ periodo, error: err.message });
            }
        }

        return results;
    },

    /**
     * Primera sincronización completa: importa últimos 12 meses
     * Solo se ejecuta una vez (guarda flag en localStorage)
     */
    async importarHistorico(onProgress = null) {
        const flag = localStorage.getItem('sii_historico_importado');
        if (flag) return null; // Ya se hizo

        const results = await this.importarMultiplesPeriodos(12, onProgress);
        localStorage.setItem('sii_historico_importado', new Date().toISOString());
        return results;
    },

    /**
     * Limpieza: elimina facturas manuales (no-SII) y proveedores sin RUT.
     * SII es la fuente de verdad — todo lo manual queda como deleted.
     * Se ejecuta una sola vez (flag en localStorage).
     * @returns {Object} { invoicesDeleted, suppliersDeleted }
     */
    async limpiarDatosManuales() {
        const FLAG = 'sii_limpieza_manuales_v1';
        if (localStorage.getItem(FLAG)) return null;

        const stats = { invoicesDeleted: 0, suppliersDeleted: 0 };

        // 1. Soft-delete facturas que NO vienen del SII
        const invoices = await window.db.purchase_invoices.toArray();
        for (const inv of invoices) {
            if (inv.deleted) continue;
            if (inv.siiImportado) continue; // Es del SII, se queda
            // Es manual → borrar
            await window.DataManager.saveAndSync('purchase_invoices', {
                ...inv,
                deleted: true
            });
            stats.invoicesDeleted++;
        }

        // 2. Soft-delete proveedores sin RUT (fueron creados manualmente)
        const suppliers = await window.db.suppliers.toArray();
        for (const sup of suppliers) {
            if (sup.deleted) continue;
            if (sup.rut && sup.rut.trim()) continue; // Tiene RUT (del SII), se queda
            // Sin RUT → manual → borrar
            await window.DataManager.saveAndSync('suppliers', {
                ...sup,
                deleted: true
            });
            stats.suppliersDeleted++;
        }

        localStorage.setItem(FLAG, new Date().toISOString());
        console.log(`🧹 Limpieza SII: ${stats.invoicesDeleted} facturas manuales eliminadas, ${stats.suppliersDeleted} proveedores sin RUT eliminados`);
        return stats;
    },

    /**
     * Diagnóstico: muestra qué devuelve la API para un período y tipo.
     * Ejecutar desde consola: SII_API.diagnostico('2026-04', 'venta')
     */
    async diagnostico(periodo, tipo = 'venta') {
        console.log(`🔍 Consultando RCV ${tipo} para ${periodo}...`);
        try {
            const result = await this.consultarRCV(periodo, tipo);
            console.log('📦 Respuesta completa:', result);
            console.log('✅ success:', result.success);

            if (result.data) {
                console.log('📊 totalRegistros:', result.data.totalRegistros);
                console.log('📋 resumenPorTipo:', result.data.resumenPorTipo);

                if (result.data.datos && result.data.datos.length > 0) {
                    // Contar tipos de documento
                    const tipos = {};
                    result.data.datos.forEach(d => {
                        const t = d['Tipo Doc'] || 'SIN_TIPO';
                        tipos[t] = (tipos[t] || 0) + 1;
                    });
                    console.log('📄 Tipos de documento encontrados:', tipos);
                    console.log('📝 Primer documento de ejemplo:', result.data.datos[0]);
                    console.log('📝 Campos disponibles:', Object.keys(result.data.datos[0]));
                    console.log(`📑 Total documentos: ${result.data.datos.length}`);
                } else {
                    console.log('⚠️ datos vacío o no existe');
                    console.log('🔑 Claves en data:', Object.keys(result.data));
                }
            } else {
                console.log('⚠️ No hay campo data en la respuesta');
                console.log('🔑 Claves en respuesta:', Object.keys(result));
            }
            return result;
        } catch (e) {
            console.error('❌ Error:', e.message);
            return null;
        }
    },

    /**
     * Procesa el resultado crudo del RCV ventas y devuelve totales.
     * Usa DOS fuentes:
     *   1) datos[] — registros individuales (facturas, NC). Las boletas NO vienen aquí.
     *   2) resumenPorTipo[] — totales mensuales por tipo de DTE. Las BOLETAS sí vienen aquí.
     */
    _parsearVentas(datos, resumenPorTipo) {
        let neto = 0, iva = 0, exento = 0, total = 0, facturas = 0, notasCredito = 0, boletas = 0, boletasTotal = 0;

        // 1) Registros individuales (facturas y NC — las boletas NO aparecen aquí)
        if (datos && datos.length > 0) {
            for (const doc of datos) {
                if (!doc['Nro'] || doc['Nro'] === '') continue;
                const tipoDoc = parseInt(doc['Tipo Doc']);
                // Solo facturas (33,34) y NC (61) vienen como registros individuales
                if (![33, 34, 56, 61].includes(tipoDoc)) continue;

                const mNeto = parseInt(doc['Monto Neto']) || 0;
                const mIva = parseInt(doc['Monto IVA']) || parseInt(doc['Monto IVA Recuperable']) || 0;
                const mExento = parseInt(doc['Monto Exento']) || 0;
                const mTotal = parseInt(doc['Monto Total']) || 0;

                if (tipoDoc === 61) {
                    neto -= mNeto; iva -= mIva; exento -= mExento; total -= mTotal; notasCredito++;
                } else {
                    neto += mNeto; iva += mIva; exento += mExento; total += mTotal; facturas++;
                }
            }
        }

        // 2) Resumen por tipo: boletas y otros DTE que solo vienen como resumen mensual
        if (resumenPorTipo && resumenPorTipo.length > 0) {
            for (const res of resumenPorTipo) {
                const tipo = res.codigoTipoDoc || parseInt(res.tipoDocumento) || 0;
                const rNeto = res.montoNeto || 0;
                const rIva = res.montoIva || 0;
                const rExento = res.montoExento || 0;
                const rTotal = res.montoTotal || 0;
                const rCount = res.totalDocumentos || 0;

                if (tipo === 39 || tipo === 41) {
                    // Boletas electrónicas — solo vienen en resumen
                    neto += rNeto; iva += rIva; exento += rExento; total += rTotal;
                    boletas += rCount; boletasTotal += rTotal;
                } else if (tipo === 48) {
                    // Comprobante de Pago Electrónico — también suma a ventas
                    neto += rNeto; iva += rIva; exento += rExento; total += rTotal;
                    facturas += rCount;
                }
                // Tipos 33, 34, 61 ya se procesaron arriba desde datos[]
            }
        }

        return { neto, iva, exento, total, facturas, notasCredito, boletas, boletasTotal };
    },

    /**
     * Obtiene totales de ventas para un período.
     * Caché en localStorage: meses pasados = permanente, mes actual = 30 min.
     */
    async obtenerTotalesVentas(periodo, forceRefresh = false) {
        const cacheKey = `sii_ventas_v3_${periodo}`;
        const now = new Date();
        const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const esMesActual = periodo === mesActual;

        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                if (!esMesActual) return data;
                if (data._ts && (Date.now() - data._ts) < 30 * 60 * 1000) return data;
            }
        }

        const result = await this.consultarRCV(periodo, 'venta');
        if (!result.success || !result.data) {
            return { neto: 0, iva: 0, exento: 0, total: 0, facturas: 0, notasCredito: 0, boletas: 0, boletasTotal: 0 };
        }

        // Pasar AMBAS fuentes: datos individuales + resumen por tipo
        const datos = {
            ...this._parsearVentas(result.data.datos || [], result.data.resumenPorTipo || []),
            _ts: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(datos));
        return datos;
    },

    /**
     * Precarga ventas de múltiples períodos secuencialmente.
     * Respeta el rate limiter global. Solo llama a la API para los que NO tienen caché.
     * Prioriza mes actual y anterior, luego carga el resto en background.
     * @param {string[]} periodos - Lista de períodos YYYY-MM
     * @param {Function} onProgress - Callback opcional
     * @param {number} maxPeriodos - Máximo de períodos a cargar (default 3, para no bloquear la cola)
     */
    async precargarVentas(periodos, onProgress = null, maxPeriodos = 3) {
        const now = new Date();
        const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const faltantes = [];

        for (const p of periodos) {
            const cacheKey = `sii_ventas_v3_${p}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                if (p !== mesActual) continue;
                if (data._ts && (Date.now() - data._ts) < 30 * 60 * 1000) continue;
            }
            faltantes.push(p);
        }

        if (faltantes.length === 0) return;

        // Priorizar: mes actual primero, luego mes anterior, luego el resto
        faltantes.sort((a, b) => {
            if (a === mesActual) return -1;
            if (b === mesActual) return 1;
            return b.localeCompare(a); // Más reciente primero
        });

        // Limitar cuántos cargamos para no saturar la cola
        const toLoad = faltantes.slice(0, maxPeriodos);
        console.log(`📦 Precargando ventas: ${toLoad.length} de ${faltantes.length} períodos faltantes`);

        for (let i = 0; i < toLoad.length; i++) {
            const p = toLoad[i];
            if (onProgress) onProgress(p, i + 1, toLoad.length);
            try {
                await this.obtenerTotalesVentas(p, true);
            } catch (e) {
                console.warn(`Error precargando ventas ${p}:`, e.message);
            }
        }
    }
};
