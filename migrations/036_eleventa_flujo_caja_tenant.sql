-- 036_eleventa_flujo_caja_tenant.sql
-- Las salidas/entradas de caja de Eleventa (eleventa_flujo_caja) llegaban con tenant_id NULL,
-- por lo que la RLS (tenant_id = get_my_tenant_id()) las ocultaba a TODOS los usuarios de la app.
-- Esto dejaba invisibles las "Salidas Caja Eleventa" y el cierre de cajera no podía descontarlas.
--
-- Fix: (1) backfill de las filas existentes, (2) default + trigger para que las futuras
-- inserciones del conector queden con el tenant aunque no lo envíen.
-- App single-tenant: tenant fijo 00000000-0000-0000-0000-000000000001.

-- (1) Backfill
UPDATE eleventa_flujo_caja
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- (2a) Default por si el conector omite la columna
ALTER TABLE eleventa_flujo_caja
ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- (2b) Trigger: cubre el caso de INSERT/UPDATE con tenant_id explícitamente NULL
CREATE OR REPLACE FUNCTION public.eleventa_flujo_caja_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := '00000000-0000-0000-0000-000000000001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eleventa_flujo_caja_set_tenant ON eleventa_flujo_caja;
CREATE TRIGGER trg_eleventa_flujo_caja_set_tenant
  BEFORE INSERT OR UPDATE ON eleventa_flujo_caja
  FOR EACH ROW EXECUTE FUNCTION public.eleventa_flujo_caja_set_tenant();
