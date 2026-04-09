# Guía de Deployment — Fixes Backend Críticos

**Versión:** 2.0  
**Fecha:** 2026-04-08  
**Archivos modificados:** `db.js`, `sync.js`, `purchase_invoices.js`, `electronic_invoices.js`  
**Archivos nuevos:** `js/transaction-manager.js`, `migrations/001_add_constraints.sql`, `migrations/001_rollback.sql`, `tests/critical-paths.test.js`

---

## Resumen de Cambios

| # | Problema | Solución | Archivos |
|---|----------|----------|----------|
| 1 | Errores de sync ignorados silenciosamente | Retry exponencial + queue de pendientes | `db.js` |
| 2 | Race conditions en abonos | Optimistic locking por campo `version` | `db.js`, `purchase_invoices.js` |
| 3 | Operaciones sin atomicidad | TransactionManager con rollback | `transaction-manager.js`, `purchase_invoices.js`, `electronic_invoices.js` |
| 4 | Sync con debounce global sin deduplicación | Timestamp-based dedup + event payload con tablas | `sync.js` |
| 5 | UNIQUE constraint faltante + índices insuficientes | Migration SQL con constraints e índices | `migrations/001_add_constraints.sql` |

---

## Pre-requisitos

- Acceso al panel de Supabase del proyecto
- Backup reciente de la base de datos (Supabase > Database > Backups)
- Node.js 18+ (solo para correr tests)

---

## Paso 1: Ejecutar Migration SQL en Supabase

**Tiempo estimado:** 2-5 minutos (depende del volumen de datos)

1. Abrir Supabase Dashboard > SQL Editor
2. Pegar el contenido de `migrations/001_add_constraints.sql`
3. Revisar el script antes de ejecutar (especialmente la sección de CHECK CONSTRAINTS)
4. Ejecutar con el botón "Run"
5. Verificar con las queries de la sección "VERIFICACIÓN POST-MIGRACIÓN" al final del script

**Qué hace este script:**
- Agrega columna `version INTEGER DEFAULT 1` a `purchase_invoices`, `loans`, `electronic_invoices`
- Crea índice único parcial en `electronic_invoices.folio` (solo registros activos)
- Crea 6 índices de rendimiento para queries comunes
- Agrega CHECK constraints para prevenir montos imposibles (> 1 Trillón CLP)

**Impacto en producción:** Mínimo. Los índices usan `IF NOT EXISTS`. La columna `version` tiene DEFAULT 1 y es retrocompatible.

---

## Paso 2: Agregar `transaction-manager.js` al HTML

Agregar el siguiente script tag en `index.html`, **ANTES** de `db.js` y las views:

```html
<script src="js/transaction-manager.js"></script>
```

Orden recomendado de carga:
```html
<script src="js/config.js"></script>
<script src="js/db.js"></script>
<script src="js/transaction-manager.js"></script>  <!-- NUEVO -->
<script src="js/sync.js"></script>
<script src="js/utils.js"></script>
<!-- ... resto de views ... -->
```

---

## Paso 3: Desplegar archivos JS actualizados

Subir los siguientes archivos al servidor / repositorio:

- `js/db.js` (DataManager v2)
- `js/sync.js` (deduplicación por timestamp)
- `js/transaction-manager.js` (nuevo)
- `js/views/purchase_invoices.js` (optimistic locking)
- `js/views/electronic_invoices.js` (folio protection + TransactionManager)

---

## Paso 4: Verificación Post-Deploy

### Verificar que `version` se incrementa correctamente

1. Abrir la app
2. Editar cualquier factura de compra
3. En Supabase > Table Editor > `purchase_invoices`, filtrar por el ID editado
4. Verificar que `version = 2` (o mayor si ya fue editada antes)

### Verificar queue de pendientes

1. Desconectar internet en el dispositivo
2. Registrar un abono en una factura
3. Volver a conectar internet
4. Verificar en Supabase que el registro se actualizó correctamente

### Verificar deduplicación de sync

1. Abrir DevTools > Network
2. Forzar sync varias veces en < 500ms
3. Verificar que solo se ejecutó una vez (no deben verse múltiples llamadas a Supabase en ese intervalo)

---

## Guía de Rollback

Si algo falla después del deploy, seguir estos pasos en orden:

### Rollback JS (inmediato)

1. Restaurar la versión anterior de los archivos JS desde git:
   ```bash
   git checkout HEAD~1 -- js/db.js js/sync.js js/views/purchase_invoices.js js/views/electronic_invoices.js
   ```
2. Remover `<script src="js/transaction-manager.js"></script>` del `index.html`
3. Desplegar

### Rollback SQL (solo si es necesario)

El rollback SQL es reversible pero **elimina los índices y la columna `version`**. Solo ejecutar si la migration causó un problema confirmado.

1. Abrir Supabase Dashboard > SQL Editor
2. Pegar el contenido de `migrations/001_rollback.sql`
3. Ejecutar
4. Verificar que las columnas `version` ya no existen

**Nota:** Los registros que ya tenían `version > 1` perderán ese campo. El campo es cosmético en la app hasta que la lógica de locking sea la única fuente de verdad.

---

## Notas Técnicas

### Dexie v15 (versión local de la BD)

`db.js` agrega `version 15` al schema de Dexie para indexar el campo `version` en `purchase_invoices`, `loans` y `electronic_invoices`. Esta migración ocurre automáticamente en el navegador del usuario la primera vez que carga la app actualizada. No requiere acción manual.

### Backward Compatibility

- Todos los cambios son aditivos (ningún campo existente fue eliminado o renombrado)
- El campo `version` tiene DEFAULT 1: registros sin el campo son tratados como `version 0 → 1` en el primer update
- Si un usuario carga la app vieja (sin actualizar) mientras otro usa la nueva, el locking por `version` fallará gracefully mostrando un diálogo de confirmación al usuario

### Tests

```bash
# Instalar dependencias de test (solo una vez)
npm install --save-dev jest

# Ejecutar todos los tests críticos
npx jest tests/critical-paths.test.js --verbose
```

Los tests no requieren conexión a Supabase ni base de datos real (todo usa mocks).
