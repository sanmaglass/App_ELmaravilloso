-- ============================================================
-- Rollback Migration 001
-- Revierte todos los cambios de 001_add_constraints.sql
-- ============================================================

BEGIN;

-- Eliminar índices
DROP INDEX IF EXISTS uq_electronic_invoices_folio_active;
DROP INDEX IF EXISTS idx_purchase_invoices_payment_status;
DROP INDEX IF EXISTS idx_purchase_invoices_folio;
DROP INDEX IF EXISTS idx_purchase_invoices_supplier_date;
DROP INDEX IF EXISTS idx_electronic_invoices_status;
DROP INDEX IF EXISTS idx_loans_status_direction;
DROP INDEX IF EXISTS idx_loans_supplier;

-- Eliminar constraints de integridad
ALTER TABLE purchase_invoices  DROP CONSTRAINT IF EXISTS chk_purchase_invoices_amount_range;
ALTER TABLE purchase_invoices  DROP CONSTRAINT IF EXISTS chk_purchase_invoices_paid_range;
ALTER TABLE loans               DROP CONSTRAINT IF EXISTS chk_loans_total_range;
ALTER TABLE electronic_invoices DROP CONSTRAINT IF EXISTS chk_electronic_invoices_total_range;

-- Eliminar columnas version
ALTER TABLE purchase_invoices   DROP COLUMN IF EXISTS version;
ALTER TABLE loans                DROP COLUMN IF EXISTS version;
ALTER TABLE electronic_invoices  DROP COLUMN IF EXISTS version;

COMMIT;
