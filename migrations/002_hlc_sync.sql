-- 002_hlc_sync.sql: Agregar HLC y campos de sincronización v2

-- Tablas a actualizar
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['employees', 'workLogs', 'products', 'promotions', 'suppliers',
                                       'purchase_invoices', 'sales_invoices', 'expenses', 'daily_sales',
                                       'electronic_invoices', 'reminders', 'eleventa_sales', 'loans']
  LOOP
    EXECUTE format('
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT DEFAULT (extract(epoch from now())*1000)::bigint;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by_device TEXT DEFAULT ''server'';
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
      CREATE INDEX IF NOT EXISTS idx_%I_hlc ON %I(updated_at_hlc);
    ', table_name, table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

-- Trigger para actualizar HLC en UPDATE (automático)
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['employees', 'workLogs', 'products', 'promotions', 'suppliers',
                                       'purchase_invoices', 'sales_invoices', 'expenses', 'daily_sales',
                                       'electronic_invoices', 'reminders', 'eleventa_sales', 'loans']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_hlc_%I ON %I;
      CREATE TRIGGER update_hlc_%I BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_hlc_timestamp();
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

-- Función para actualizar HLC
CREATE OR REPLACE FUNCTION update_hlc_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at_hlc := GREATEST(OLD.updated_at_hlc + 1, (extract(epoch from now())*1000)::bigint);
  NEW.version := COALESCE(NEW.version, OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabla para sincronización del estado (última HLC vista)
CREATE TABLE IF NOT EXISTS sync_state (
  table_name TEXT PRIMARY KEY,
  last_seen_hlc BIGINT DEFAULT 0,
  device_id TEXT,
  updated_at TIMESTAMP DEFAULT now()
);

-- Tabla de conflictos resueltos
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id BIGINT NOT NULL,
  local_hlc BIGINT,
  remote_hlc BIGINT,
  resolution TEXT, -- 'remote_won', 'local_kept', 'manual'
  created_at TIMESTAMP DEFAULT now()
);

-- Habilitar Realtime para nuevas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS sync_state;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS sync_conflicts;
