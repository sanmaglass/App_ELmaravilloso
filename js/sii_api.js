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
     * Normaliza un nombre para comparación (quita tildes, puntos, mayúsculas, etc.)
     */
    _normalizeName(name) {
        return (name || '')
            .toUpperCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
            .replace(/[.\-,]/g, '') // quita puntos, guiones, comas
            .replace(/\s+/g, ' ')   // colapsa espacios
            .replace(/\b(S\.?A\.?|SPA|LTDA\.?|LIMITADA|E\.?I\.?R\.?L\.?|CIA\.?)\b/g, '') // quita sufijos legales
            .trim();
    },

    /**
     * Busca un proveedor existente por RUT o por nombre similar.
     * Si lo encuentra sin RUT, lo actualiza con el RUT del SII.
     * @returns {Object|null} El proveedor encontrado o null
     */
    _findSupplier(rutSII, nombreSII, activeSuppliers, supplierByRut, supplierByName) {
        // 1. Buscar por RUT exacto (prioridad máxima)
        if (rutSII && supplierByRut[rutSII]) {
            return supplierByRut[rutSII];
        }

        // 2. Buscar por nombre normalizado (para proveedores creados manualmente sin RUT)
        const normalizedSII = this._normalizeName(nombreSII);
        if (normalizedSII && supplierByName[normalizedSII]) {
            return supplierByName[normalizedSII];
        }

        // 3. Buscar parcial: si el nombre SII contiene el nombre local o viceversa
        for (const s of activeSuppliers) {
            const normalizedLocal = this._normalizeName(s.name);
            if (normalizedLocal && normalizedSII) {
                if (normalizedLocal.includes(normalizedSII) || normalizedSII.includes(normalizedLocal)) {
                    return s;
                }
            }
        }

        return null;
    },

    /**
     * Importa facturas del RCV a la BD local, auto-crea/actualiza proveedores
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

        const activeSuppliers = existingSuppliers.filter(s => !s.deleted);
        const activeInvoices = existingInvoices.filter(i => !i.deleted);

        // Índice de facturas existentes por folio+rut para evitar duplicados
        const invoiceIndex = new Set();
        activeInvoices.forEach(inv => {
            // Detectar por folio+rut SII o por invoiceNumber solo
            if (inv.invoiceNumber && inv.siiRutProveedor) {
                invoiceIndex.add(`${inv.invoiceNumber}_${inv.siiRutProveedor}`);
            }
            // También indexar por invoiceNumber + supplierId (para facturas manuales)
            if (inv.invoiceNumber && inv.supplierId) {
                invoiceIndex.add(`manual_${inv.invoiceNumber}_${inv.supplierId}`);
            }
        });

        // Índices de proveedores por RUT y por nombre normalizado
        const supplierByRut = {};
        const supplierByName = {};
        activeSuppliers.forEach(s => {
            if (s.rut) supplierByRut[s.rut.toUpperCase()] = s;
            const norm = this._normalizeName(s.name);
            if (norm) supplierByName[norm] = s;
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

                // --- BUSCAR O CREAR PROVEEDOR ---
                let supplier = this._findSupplier(rutProveedor, razonSocial, activeSuppliers, supplierByRut, supplierByName);

                if (supplier) {
                    // Proveedor existente: actualizar con datos del SII si le faltan
                    let needsUpdate = false;
                    const updates = { ...supplier };

                    if (!supplier.rut && rutProveedor) {
                        updates.rut = rutProveedor;
                        needsUpdate = true;
                    }
                    // Actualizar nombre si el del SII es más completo (razón social oficial)
                    if (razonSocial && supplier.name !== razonSocial && razonSocial.length > supplier.name.length) {
                        updates.name = razonSocial;
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        await window.DataManager.saveAndSync('suppliers', updates);
                        // Actualizar índices
                        if (updates.rut) supplierByRut[updates.rut.toUpperCase()] = updates;
                        supplierByName[this._normalizeName(updates.name)] = updates;
                        stats.updatedSuppliers++;
                    }
                } else if (rutProveedor) {
                    // Proveedor nuevo: crear desde datos del SII
                    const newSupplier = {
                        name: razonSocial || rutProveedor,
                        rut: rutProveedor,
                        deleted: false
                    };
                    await window.DataManager.saveAndSync('suppliers', newSupplier);
                    // Re-leer para obtener el ID generado
                    const allSup = await window.db.suppliers.toArray();
                    supplier = allSup.find(s => s.rut === rutProveedor && !s.deleted);
                    if (supplier) {
                        supplierByRut[rutProveedor] = supplier;
                        supplierByName[this._normalizeName(supplier.name)] = supplier;
                        activeSuppliers.push(supplier);
                    }
                    stats.newSuppliers++;
                }

                // También verificar por factura manual con mismo número + proveedor
                if (supplier) {
                    const manualKey = `manual_${folio}_${supplier.id}`;
                    if (invoiceIndex.has(manualKey)) {
                        stats.skipped++;
                        continue;
                    }
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
    }
};
