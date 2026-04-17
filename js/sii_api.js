/**
 * SII API Service — Consulta RCV vía BaseAPI.cl
 * Defaults hardcodeados para la cuenta principal.
 * Se pueden sobreescribir desde Settings (localStorage).
 */
window.SII_API = {

    // Defaults de la cuenta principal (sobreescribibles desde Settings)
    _defaults: {
        apiKey: 'sk_8bc5fa1e06cb022e94f09760069cedd3cb3709af8622ea46',
        rut: '14061423-8',
        password: 'Ubiobio56!'
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
     * @param {string} periodo - Formato YYYY-MM (ej: "2026-04")
     * @param {string} tipo - "compra" o "venta"
     * @returns {Object} { success, data: { totalRegistros, datos[], resumenPorTipo[] } }
     */
    async consultarRCV(periodo, tipo = 'compra') {
        const config = this.getConfig();
        if (!config.apiKey || !config.rut || !config.password) {
            throw new Error('Faltan credenciales SII. Configúralas en Ajustes → Integración SII.');
        }

        // Proxy via Vercel rewrite para evitar CORS
        const url = `/api/sii/rcv/${periodo}/${tipo}`;

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

        return await response.json();
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
     * Obtiene totales tributarios de ventas (RCV Ventas) para un período.
     * Caché inteligente:
     *   - Meses pasados → localStorage permanente (no cambian)
     *   - Mes actual → localStorage con TTL de 30 minutos
     * @param {string} periodo - Formato YYYY-MM
     * @param {boolean} forceRefresh - Forzar recarga desde API
     * @returns {Object} { neto, iva, exento, total, facturas, notasCredito }
     */
    async obtenerTotalesVentas(periodo, forceRefresh = false) {
        const cacheKey = `sii_ventas_v2_${periodo}`;
        const now = new Date();
        const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const esMesActual = periodo === mesActual;

        // Revisar caché
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                // Meses pasados: caché permanente
                if (!esMesActual) return data;
                // Mes actual: válido por 30 min
                if (data._ts && (Date.now() - data._ts) < 30 * 60 * 1000) return data;
            }
        }

        const result = await this.consultarRCV(periodo, 'venta');

        if (!result.success || !result.data?.datos) {
            return { neto: 0, iva: 0, exento: 0, total: 0, facturas: 0, notasCredito: 0 };
        }

        let neto = 0, iva = 0, exento = 0, total = 0, facturas = 0, notasCredito = 0;
        let boletas = 0, boletasTotal = 0;

        // Tipos DTE de venta:
        // 33=Factura, 34=Factura Exenta, 39=Boleta Electrónica, 41=Boleta Exenta
        // 56=Nota Débito, 61=Nota Crédito
        // También puede venir como resumen de boletas del día
        const tiposVenta = [33, 34, 39, 41, 56, 61];
        const tiposNC = [61]; // Notas de crédito restan

        // Log para diagnóstico (ver qué tipos trae la API)
        const tiposEncontrados = {};
        result.data.datos.forEach(doc => {
            const t = doc['Tipo Doc'];
            tiposEncontrados[t] = (tiposEncontrados[t] || 0) + 1;
        });
        console.log(`[SII Ventas ${periodo}] Tipos encontrados:`, tiposEncontrados, `Total docs: ${result.data.datos.length}`);

        for (const doc of result.data.datos) {
            if (!doc['Nro'] || doc['Nro'] === '') continue;
            const tipoDoc = parseInt(doc['Tipo Doc']);

            // Aceptar todos los tipos de venta conocidos
            if (!tiposVenta.includes(tipoDoc)) continue;

            const mNeto = parseInt(doc['Monto Neto']) || 0;
            const mIva = parseInt(doc['Monto IVA']) || parseInt(doc['Monto IVA Recuperable']) || 0;
            const mExento = parseInt(doc['Monto Exento']) || 0;
            const mTotal = parseInt(doc['Monto Total']) || 0;

            if (tiposNC.includes(tipoDoc)) {
                neto -= mNeto; iva -= mIva; exento -= mExento; total -= mTotal;
                notasCredito++;
            } else if (tipoDoc === 39 || tipoDoc === 41) {
                // Boletas: suman al total de ventas
                neto += mNeto; iva += mIva; exento += mExento; total += mTotal;
                boletas++;
                boletasTotal += mTotal;
            } else {
                neto += mNeto; iva += mIva; exento += mExento; total += mTotal;
                facturas++;
            }
        }

        const datos = { neto, iva, exento, total, facturas, notasCredito, boletas, boletasTotal, _ts: Date.now() };
        localStorage.setItem(cacheKey, JSON.stringify(datos));
        return datos;
    }
};
