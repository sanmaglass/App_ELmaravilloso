-- 002_hlc_sync.sql: Agregar HLC y campos de sincronización v2
-- Ejecutado exitosamente en Supabase

ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_employees_hlc ON employees(updated_at_hlc);

ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_products_hlc ON products(updated_at_hlc);

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_promotions_hlc ON promotions(updated_at_hlc);

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_suppliers_hlc ON suppliers(updated_at_hlc);

ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_hlc ON purchase_invoices(updated_at_hlc);

ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_hlc ON sales_invoices(updated_at_hlc);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_expenses_hlc ON expenses(updated_at_hlc);

ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_daily_sales_hlc ON daily_sales(updated_at_hlc);

ALTER TABLE electronic_invoices ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE electronic_invoices ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE electronic_invoices ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_hlc ON electronic_invoices(updated_at_hlc);

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_reminders_hlc ON reminders(updated_at_hlc);

ALTER TABLE eleventa_sales ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE eleventa_sales ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE eleventa_sales ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_eleventa_sales_hlc ON eleventa_sales(updated_at_hlc);

ALTER TABLE loans ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT 'server';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_loans_hlc ON loans(updated_at_hlc);

CREATE OR REPLACE FUNCTION update_hlc_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at_hlc := GREATEST(OLD.updated_at_hlc + 1, (extract(epoch from now())*1000)::bigint); NEW.version := COALESCE(NEW.version, OLD.version, 0) + 1; RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS sync_state (table_name TEXT PRIMARY KEY, last_seen_hlc BIGINT DEFAULT 0, device_id TEXT, updated_at TIMESTAMP DEFAULT now());

CREATE TABLE IF NOT EXISTS sync_conflicts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), table_name TEXT NOT NULL, record_id BIGINT NOT NULL, local_hlc BIGINT, remote_hlc BIGINT, resolution TEXT, created_at TIMESTAMP DEFAULT now());
