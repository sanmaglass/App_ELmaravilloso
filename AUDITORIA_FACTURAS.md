# 📋 AUDITORÍA INTERNA - SECCIÓN FACTURAS

**Fecha:** 8 de Abril 2026  
**Alcance:** purchase_invoices.js, sales_invoices.js, electronic_invoices.js, daily_sales.js, db.js  
**Total Hallazgos:** 40 (1 crítico, 10 alto, 22 medio, 7 bajo)

---

## ⚠️ HALLAZGOS PRIORITARIOS (TOP 5)

### 🔴 1. CRÍTICO: Redondeo incorrecto de IVA en electronic_invoices.js
- **Línea:** 195
- **Impacto:** Pérdida de dinero real en cálculos monetarios
- **Problema:** `Math.round(neto * 0.19)` redondea a entero, perdiendo decimales
- **Ejemplo:** neto=1000.50 → iva debería ser 190.10, pero redondea a 190
- **Solución:** `Math.round((neto * 0.19) * 100) / 100`
- **Estado:** ✅ CORREGIDO

### 🔴 2. ALTO: Race condition en transacción de abonos
- **Línea:** 641 (purchase_invoices.js)
- **Impacto:** Posibilidad de doble pago o inconsistencia de datos
- **Problema:** Entre `get()` y `saveAndSync()`, otro usuario puede actualizar la factura
- **Solución:** Validar que `paidAmount` no haya cambiado desde que se abrió el modal
- **Estado:** ✅ CORREGIDO

### 🔴 3. ALTO: Manejo deficiente de errores Supabase
- **Línea:** 148-172 (db.js)
- **Impacto:** Cambios pueden no sincronizarse en nube sin notificar al usuario
- **Problema:** Errores de Supabase se ignoran silenciosamente
- **Solución:** Registrar y alertar sobre errores de sync
- **Estado:** ⚠️ REQUIERE MEJORA BACKEND

### 🔴 4. ALTO: Auto-fix silencioso de estado de pago
- **Línea:** 1379 (purchase_invoices.js)
- **Impacto:** Cambios de estado no esperados
- **Problema:** Si usuario ingresa monto completo, auto cambia a "Pagado" sin confirmación
- **Solución:** Mostrar diálogo de confirmación
- **Estado:** ✅ CORREGIDO

### 🔴 5. ALTO: Duplicado de folio en electronic_invoices
- **Línea:** 267-278 (electronic_invoices.js)
- **Impacto:** Potencialmente dos facturas con mismo folio en SII
- **Problema:** No valida si folio ya existe en BD antes de guardar
- **Solución:** Verificar folio único antes de `saveAndSync()`
- **Estado:** ✅ CORREGIDO

---

## 📊 RESUMEN POR CATEGORÍA

| Categoría | Crítico | Alto | Medio | Bajo | Correcciones Realizadas |
|-----------|---------|------|-------|------|-------------------------|
| Bugs Funcionales | 0 | 2 | 2 | 0 | ✅ 2 |
| Validación | 0 | 1 | 3 | 0 | ✅ 2 |
| Cálculos | 1 | 1 | 3 | 1 | ✅ 1 |
| Índices BD | 0 | 0 | 3 | 0 | ✅ 3 |
| Manejo Errores | 0 | 1 | 3 | 0 | ⚠️ 0 |
| Transacciones | 0 | 2 | 2 | 0 | ✅ 1 |
| Paginación | 0 | 0 | 0 | 2 | - |
| Sincronización | 0 | 2 | 2 | 0 | ⚠️ 0 |
| Rendimiento | 0 | 0 | 1 | 3 | - |
| Seguridad | 0 | 1 | 3 | 1 | ✅ 1 |
| **TOTAL** | **1** | **10** | **22** | **7** | **✅ 10** |

---

## ✅ CORRECCIONES REALIZADAS

### 1. electronic_invoices.js (línea 195-196)
```javascript
// ❌ ANTES
const iva = Math.round(neto * 0.19);
const total = neto + iva;

// ✅ DESPUÉS
const iva = Math.round((neto * 0.19) * 100) / 100;
const total = Math.round((neto + iva) * 100) / 100;
```

### 2. electronic_invoices.js (línea 214-221)
```javascript
// ❌ ANTES
const p = parseInt(document.getElementById('item-price').value);
if (n && p > 0) { items.push(...) }

// ✅ DESPUÉS
const p = parseFloat(document.getElementById('item-price').value);
if (isNaN(p) || p <= 0) { alert('Ingresa un precio válido (> 0)'); return; }
items.push({ name: n, price: p });
```

### 3. purchase_invoices.js (línea 1378-1384)
```javascript
// ❌ ANTES
if (paidAmount >= amount && amount > 0) {
    paymentStatus = 'Pagado'; // Auto fix silenciosamente
    paidAmount = amount;
}

// ✅ DESPUÉS
if (paidAmount >= amount && amount > 0) {
    if (!confirm(`¿Deseas marcar como PAGADO en su totalidad?`)) {
        // Keep as "Abonado" with partial payment
    } else {
        paymentStatus = 'Pagado';
        paidAmount = amount;
    }
}
```

### 4. purchase_invoices.js (línea 641-651)
```javascript
// ✅ AGREGADO: Validación de race condition
if (existing.paidAmount !== alreadyPaid) {
    alert(`⚠️ La factura fue actualizada por otro usuario...`);
    return;
}
const newPaid = Math.round((existing.paidAmount + abonoMonto) * 100) / 100;
```

### 5. electronic_invoices.js (línea 268-277)
```javascript
// ✅ AGREGADO: Validación de folio duplicado
const existing = await window.db.electronic_invoices
    .where('folio').equals(result.folio).toArray();
if (existing.length > 0) {
    alert(`⚠️ ERROR: El folio ${result.folio} YA EXISTE...`);
    return;
}
```

### 6. db.js (índices)
```javascript
// ❌ ANTES
purchase_invoices: 'id, supplierId, date, deleted',
sales_invoices: 'id, date, deleted',
electronic_invoices: 'id, date, folio, deleted',

// ✅ DESPUÉS
purchase_invoices: 'id, supplierId, date, paymentStatus, paymentMethod, invoiceNumber, deleted',
sales_invoices: 'id, date, clientName, invoiceNumber, deleted',
electronic_invoices: 'id, date, folio, status, deleted',
```

### 7. sales_invoices.js (línea 91, 93)
```javascript
// ❌ ANTES
${sale.clientName}
${sale.invoiceNumber}

// ✅ DESPUÉS
${escapeHTML(sale.clientName)}
${escapeHTML(sale.invoiceNumber)}
```

---

## ⚠️ PROBLEMAS QUE REQUIEREN TRABAJO BACKEND

### 1. Error handling de Supabase
- **Ubicación:** db.js línea 149-170
- **Problema:** Errores de sync se ignoran silenciosamente
- **Recomendación:** 
  - Implementar retry logic con exponential backoff
  - Notificar usuario si Supabase está offline
  - Mantener queue de cambios pendientes

### 2. Transacciones sin atomicidad
- **Ubicación:** purchase_invoices.js línea 1428-1441
- **Problema:** Si renderAnalytics() falla después de saveAndSync(), queda inconsistente
- **Recomendación:** Usar transacciones SQL en Supabase o `Promise.allSettled()`

### 3. Race conditions potenciales
- **Ubicación:** electronic_invoices.js línea 267
- **Problema:** Sin validación de folio único a nivel BD
- **Recomendación:** Agregar constraint UNIQUE en tabla electronic_invoices.folio en Supabase

### 4. Índices de búsqueda
- **Ubicación:** db.js v14
- **Problema:** Muchos campos se filtran sin índices
- **Recomendación:** Migrar a v15 con nuevos índices (ya actualizado localmente)

### 5. Sync strategy
- **Ubicación:** sync.js (no revisado aquí)
- **Problema:** Debounce global puede perder eventos
- **Recomendación:** Usar timestamp-based deduplication

---

## 🔍 OTROS HALLAZGOS IMPORTANTES

### XSS Vulnerabilities (Bajas)
- ✅ daily_sales.js: Mitigado por toLocaleDateString
- ✅ sales_invoices.js: CORREGIDO con escapeHTML
- ⚠️ TODAS las referencias a datos de usuario deben usar escapeHTML

### Cálculos Monetarios
- ✅ electronic_invoices: Redondeo corregido
- ⚠️ daily_sales.js: Suma de totales debería usar redondeo
- ⚠️ purchase_invoices: Tolerancia inconsistente (±0.01) en líneas 636, 646

### Validación de Entrada
- ✅ electronic_invoices: Mejorada validación de precios
- ⚠️ RUT chileno: No se valida formato en electronic_invoices
- ⚠️ Numbers: Usar parseFloat en lugar de parseInt para moneda

### Rendimiento
- ⚠️ renderSupplierHistory: Filtra todos los invoices cada vez
- ⚠️ toArray(): Carga campos innecesarios (especialmente notas)
- ⚠️ Renders en cascada: 5 renders = 5 lecturas de BD

---

## 📝 RECOMENDACIONES FUTURAS

1. **Audit Trail:** Registrar quién/cuándo cambió cada factura
2. **Webhooks:** Sync push en lugar de pull para actualizar en tiempo real
3. **Batch Operations:** Agrupar cambios múltiples en una sola transacción
4. **Offline First:** Implementar service worker para funcionar offline
5. **Testing:** Crear tests de edge cases (montos iguales, cambios simultáneos)

---

## 📌 PRÓXIMAS ACCIONES

- [ ] Revisar logs de Supabase para detectar sync failures
- [ ] Migrar BD a v15 con nuevos índices
- [ ] Implementar constraint UNIQUE para folio
- [ ] Agregar tests unitarios para cálculos monetarios
- [ ] Documentar política de tolerancia monetaria (±0.01)
- [ ] Capacitar a equipo sobre XSS prevention
- [ ] Implementar rate limiting en API de electronic invoices

---

**Generado por:** Auditoría Automática Claude Code  
**Método:** Análisis estático + búsqueda de patrones
