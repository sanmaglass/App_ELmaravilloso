/**
 * SII API Service — Consulta RCV vía BaseAPI.cl
 * Credenciales en localStorage (misma pattern que Supabase config)
 */
window.SII_API = {

    // Credenciales (almacenadas en localStorage desde Settings)
    getConfig() {
        return {
            apiKey: localStorage.getItem('sii_baseapi_key') || '',
            rut: localStorage.getItem('sii_rut') || '',
            password: localStorage.getItem('sii_password') || ''
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

        const url = `https://api.baseapi.cl/api/v1/sii/rcv/${periodo}/${tipo}`;

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
     * Importa facturas del RCV a la BD local, auto-crea proveedores
     * @param {string} periodo - Formato YYYY-MM
     * @returns {Object} { imported, skipped, newSuppliers, errors }
     */
    async importarFacturas(periodo) {
        const result = await this.consultarRCV(periodo, 'compra');

        if (!result.success || !result.data?.datos) {
            throw new Error('No se pudieron obtener datos del SII');
        }

        const datos = result.data.datos;
        const stats = { imported: 0, skipped: 0, newSuppliers: 0, errors: [] };

        // Cargar proveedores y facturas existentes
        const [existingSuppliers, existingInvoices] = await Promise.all([
            window.db.suppliers.toArray(),
            window.db.purchase_invoices.toArray()
        ]);

        const activeInvoices = existingInvoices.filter(i => !i.deleted);

        // Índice de facturas existentes por folio+rut para evitar duplicados
        const invoiceIndex = new Set();
        activeInvoices.forEach(inv => {
            if (inv.invoiceNumber && inv.siiRutProveedor) {
                invoiceIndex.add(`${inv.invoiceNumber}_${inv.siiRutProveedor}`);
            }
        });

        // Índice de proveedores por RUT
        const supplierByRut = {};
        existingSuppliers.filter(s => !s.deleted).forEach(s => {
            if (s.rut) supplierByRut[s.rut.toUpperCase()] = s;
        });

        for (const factura of datos) {
            try {
                // Saltar filas sin Nro (son sub-líneas de impuestos adicionales)
                if (!factura['Nro'] || factura['Nro'] === '') continue;

                // Solo importar facturas (33) y facturas exentas (34)
                // Las notas de crédito (61) se importan como referencia
                const tipoDoc = parseInt(factura['Tipo Doc']);
                if (![33, 34, 61].includes(tipoDoc)) continue;

                const folio = factura['Folio'];
                const rutProveedor = (factura['RUT Proveedor'] || '').toUpperCase();
                const razonSocial = factura['Razon Social'] || '';

                // Verificar si ya existe
                const key = `${folio}_${rutProveedor}`;
                if (invoiceIndex.has(key)) {
                    stats.skipped++;
                    continue;
                }

                // Auto-crear proveedor si no existe
                let supplier = supplierByRut[rutProveedor];
                if (!supplier && rutProveedor) {
                    const newSupplier = {
                        name: razonSocial.trim() || rutProveedor,
                        rut: rutProveedor,
                        deleted: false
                    };
                    await window.DataManager.saveAndSync('suppliers', newSupplier);
                    // Re-leer para obtener el ID generado
                    const allSup = await window.db.suppliers.toArray();
                    supplier = allSup.find(s => s.rut === rutProveedor && !s.deleted);
                    supplierByRut[rutProveedor] = supplier;
                    stats.newSuppliers++;
                }

                // Parsear montos (vienen como string)
                const montoNeto = parseInt(factura['Monto Neto']) || 0;
                const montoIva = parseInt(factura['Monto IVA Recuperable']) || 0;
                const montoExento = parseInt(factura['Monto Exento']) || 0;
                const montoTotal = parseInt(factura['Monto Total']) || 0;

                // Parsear fecha (viene como DD/MM/YYYY)
                const fechaParts = (factura['Fecha Docto'] || '').split('/');
                const fechaISO = fechaParts.length === 3
                    ? `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}`
                    : periodo + '-01';

                // Nombre del tipo de documento
                const tipoDocNombre = tipoDoc === 33 ? 'Factura'
                    : tipoDoc === 34 ? 'Factura Exenta'
                    : tipoDoc === 61 ? 'Nota de Crédito' : `DTE ${tipoDoc}`;

                // Generar período legible
                const [y, m] = periodo.split('-');
                const periodoLabel = new Date(Number(y), Number(m) - 1, 1)
                    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

                const invoiceData = {
                    supplierId: supplier?.id || null,
                    supplierName: razonSocial.trim(),
                    invoiceNumber: String(folio),
                    date: fechaISO,
                    amount: tipoDoc === 61 ? -montoTotal : montoTotal,
                    period: periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1),
                    paymentMethod: 'Pendiente',
                    paymentStatus: 'Pendiente',
                    paidAmount: 0,
                    notes: `${tipoDocNombre} · Neto: $${montoNeto.toLocaleString('es-CL')} · IVA: $${montoIva.toLocaleString('es-CL')}${montoExento > 0 ? ` · Exento: $${montoExento.toLocaleString('es-CL')}` : ''}`,
                    deleted: false,
                    // Campos SII para rastreo
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
     * @param {number} meses - Cantidad de meses hacia atrás (default: 1 = solo mes actual)
     */
    async importarMultiplesPeriodos(meses = 1) {
        const results = [];
        const now = new Date();

        for (let i = 0; i < meses; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            try {
                const stats = await this.importarFacturas(periodo);
                results.push({ periodo, ...stats });
            } catch (err) {
                results.push({ periodo, error: err.message });
            }
        }

        return results;
    }
};
