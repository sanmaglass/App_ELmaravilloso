-- 003_complete_hlc_triggers.sql
-- Completa los triggers HLC en TODAS las tablas sincronizadas.
--
-- PROBLEMA QUE RESUELVE:
-- La migración 002 creó la función update_hlc_timestamp() pero nunca adjuntó
-- los triggers a las tablas. Resultado: UPDATEs desde clientes externos
-- (API de Eleventa, correcciones manuales en Supabase, upserts) NO bumpean
-- updated_at_hlc, por lo tanto el pull incremental .gt('updated_at_hlc', lastHlc)
-- en sync-v2.js no los ve como cambios nuevos → dispositivos desincronizados.
--
-- DESPUÉS DE ESTA MIGRACIÓN:
-- Cada INSERT y UPDATE en cualquiera de las 13 tablas sincronizadas bumpea
-- updated_at_hlc automáticamente a nivel DB, sin depender de que el cliente
-- lo haga. El sync funciona aunque el writer no sepa nada de HLC.
--
-- SEGURO DE CORRER VARIAS VECES: usa DROP IF EXISTS + CREATE.

-- ============================================================
-- 1. Funciones
-- ============================================================

CREATE OR REPLACE FUNCTION hlc_on_insert() RETURNS TRIGGER AS $$
DECLARE
  now_ms BIGINT := (extract(epoch from now()) * 1000)::bigint;
BEGIN
  -- Si el cliente envió un HLC, respetamos el mayor (para evitar retrocesos
  -- por skew de reloj). Si no envió, usamos now().
  NEW.updated_at_hlc := GREATEST(COALESCE(NEW.updated_at_hlc, 0), now_ms);
  NEW.version := COALESCE(NEW.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hlc_on_update() RETURNS TRIGGER AS $$
DECLARE
  now_ms BIGINT := (extract(epoch from now()) * 1000)::bigint;
BEGIN
  -- Siempre avanzamos el HLC: mayor entre (viejo+1) y now().
  -- Esto garantiza que todo UPDATE es visible para el pull incremental,
  -- incluso si el writer externo no setea updated_at_hlc.
  NEW.updated_at_hlc := GREATEST(COALESCE(OLD.updated_at_hlc, 0) + 1, now_ms);
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Helper para adjuntar ambos triggers a una tabla
-- ============================================================

CREATE OR REPLACE FUNCTION attach_hlc_triggers(tbl TEXT) RETURNS VOID AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS insert_hlc_%I ON %I', tbl, tbl);
  EXECUTE format('DROP TRIGGER IF EXISTS update_hlc_%I ON %I', tbl, tbl);

  EXECUTE format(
    'CREATE TRIGGER insert_hlc_%I BEFORE INSERT ON %I
     FOR EACH ROW EXECUTE FUNCTION hlc_on_insert()',
    tbl, tbl
  );
  EXECUTE format(
    'CREATE TRIGGER update_hlc_%I BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION hlc_on_update()',
    tbl, tbl
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Adjuntar triggers a las 13 tablas sincronizadas
-- ============================================================

SELECT attach_hlc_triggers('employees');
SELECT attach_hlc_triggers('worklogs');
SELECT attach_hlc_triggers('products');
SELECT attach_hlc_triggers('promotions');
SELECT attach_hlc_triggers('suppliers');
SELECT attach_hlc_triggers('purchase_invoices');
SELECT attach_hlc_triggers('sales_invoices');
SELECT attach_hlc_triggers('expenses');
SELECT attach_hlc_triggers('daily_sales');
SELECT attach_hlc_triggers('electronic_invoices');
SELECT attach_hlc_triggers('reminders');
SELECT attach_hlc_triggers('eleventa_sales');
SELECT attach_hlc_triggers('loans');

-- ============================================================
-- 4. Verificación: debe devolver 26 filas (13 tablas × 2 triggers)
-- ============================================================
--
-- SELECT event_object_table, trigger_name, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'public'
--   AND trigger_name LIKE '%_hlc_%'
-- ORDER BY event_object_table, event_manipulation;
