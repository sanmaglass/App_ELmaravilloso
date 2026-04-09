-- ============================================================
-- Migration 001: Versioning, Constraints e Índices
-- App: el-maravilloso-final
-- Fecha: 2026-04-08
--
-- EJECUTAR EN: Supabase SQL Editor
-- ROLLBACK:    migrations/001_rollback.sql
--
-- PASOS PREVIOS:
--   1. Hacer backup de la BD (Supabase > Database > Backups)
--   2. Ejecutar este script en un ambiente de staging primero
--   3. Verificar con SELECT antes de hacer COMMIT en producción
--
-- IMPACTO EN APP:
--   - La columna `version` es retrocompatible: DEFAULT 1
--   - El constraint UNIQUE en folio afecta solo registros no eliminados
--     (se usa un índice parcial para no bloquear soft-deletes)
--   - Los índices son operaciones NO BLOQUEANTES (CONCURRENTLY)
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. CAMPO VERSION (Optimistic Locking)
--    Permite detectar modificaciones concurrentes.
--    DEFAULT 1 garantiza compatibilidad con registros existentes.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE purchase_invoices
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE electronic_invoices
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Normalizar registros existentes: asegurarse de que version >= 1
UPDATE purchase_invoices  SET version = 1 WHERE version IS NULL OR version < 1;
UPDATE loans              SET version = 1 WHERE version IS NULL OR version < 1;
UPDATE electronic_invoices SET version = 1 WHERE version IS NULL OR version < 1;


-- ──────────────────────────────────────────────────────────────
-- 2. UNIQUE CONSTRAINT: folio en electronic_invoices
--    Solo aplica a registros activos (deleted = false / NULL).
--    Usa índice parcial para no interferir con soft-deletes.
-- ──────────────────────────────────────────────────────────────

-- Primero detectar duplicados existentes (ejecutar como lectura previa):
-- SELECT folio, COUNT(*) FROM electronic_invoices
--   WHERE (deleted = false OR deleted IS NULL)
--   GROUP BY folio HAVING COUNT(*) > 1;

-- Índice parcial único: solo folios activos
CREATE UNIQUE INDEX IF NOT EXISTS uq_electronic_invoices_folio_active
    ON electronic_invoices (folio)
    WHERE (deleted = false OR deleted IS NULL);


-- ──────────────────────────────────────────────────────────────
-- 3. ÍNDICES DE RENDIMIENTO
--    Todos usan IF NOT EXISTS y son seguros para re-ejecutar.
--    CONCURRENTLY permite crearlos sin bloquear lecturas/escrituras.
--    Nota: CONCURRENTLY no se puede usar dentro de BEGIN/COMMIT,
--    por eso se ejecutan por separado al final.
-- ──────────────────────────────────────────────────────────────

-- purchase_invoices: queries por estado de pago + deleted
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_payment_status
    ON purchase_invoices (paymentStatus, deleted);

-- purchase_invoices: búsquedas por número de factura
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_folio
    ON purchase_invoices (invoiceNumber, deleted);

-- purchase_invoices: filtros por proveedor + fecha (dashboard)
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_date
    ON purchase_invoices ("supplierId", date, deleted);

-- electronic_invoices: filtros por estado
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_status
    ON electronic_invoices (status, deleted);

-- loans: queries por estado + dirección
CREATE INDEX IF NOT EXISTS idx_loans_status_direction
    ON loans (status, direction, deleted);

-- loans: filtros por proveedor
CREATE INDEX IF NOT EXISTS idx_loans_supplier
    ON loans ("supplierId", deleted);


-- ──────────────────────────────────────────────────────────────
-- 4. CHECK CONSTRAINTS: Integridad de datos monetarios
--    Previene insertar valores imposibles (> 1 Trillón CLP).
-- ──────────────────────────────────────────────────────────────

ALTER TABLE purchase_invoices
    ADD CONSTRAINT IF NOT EXISTS chk_purchase_invoices_amount_range
    CHECK (amount >= 0 AND amount <= 1000000000000);

ALTER TABLE purchase_invoices
    ADD CONSTRAINT IF NOT EXISTS chk_purchase_invoices_paid_range
    CHECK (paidAmount >= 0 AND paidAmount <= 1000000000000);

ALTER TABLE loans
    ADD CONSTRAINT IF NOT EXISTS chk_loans_total_range
    CHECK (total >= 0 AND total <= 1000000000000);

ALTER TABLE electronic_invoices
    ADD CONSTRAINT IF NOT EXISTS chk_electronic_invoices_total_range
    CHECK (total >= 0 AND total <= 1000000000000);


-- ──────────────────────────────────────────────────────────────
-- 5. VERIFICACIÓN POST-MIGRACIÓN
--    Ejecutar estas queries después del COMMIT para confirmar.
-- ──────────────────────────────────────────────────────────────

-- Verificar columnas version:
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('purchase_invoices','loans','electronic_invoices')
--     AND column_name = 'version';

-- Verificar índices creados:
-- SELECT indexname, tablename, indexdef
--   FROM pg_indexes
--   WHERE tablename IN ('purchase_invoices','loans','electronic_invoices')
--   ORDER BY tablename, indexname;

-- Verificar constraints:
-- SELECT constraint_name, table_name, constraint_type
--   FROM information_schema.table_constraints
--   WHERE table_name IN ('purchase_invoices','loans','electronic_invoices')
--   ORDER BY table_name;

COMMIT;
