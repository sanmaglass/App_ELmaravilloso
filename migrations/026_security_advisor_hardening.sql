-- 026_security_advisor_hardening.sql
-- Endurecimiento derivado de los advisors de seguridad de Supabase (2026-06-22).
-- Aplicado en prod vía MCP. Cierra: search_path mutable (ERROR linter 0011),
-- vista SECURITY DEFINER (ERROR 0010) y funciones-trigger ejecutables por RPC (0028/0029).
-- NO toca: helpers de tenant ni intelligence_report (los usa la app), ni storage (decisión de negocio).

-- 1) Fijar search_path en todas las funciones marcadas (anti-hijacking).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','analytics')
      AND p.proname IN (
        'update_hlc_timestamp','hlc_on_insert','attach_hlc_triggers','hlc_on_update',
        'validate_money_field','validate_daily_sales','validate_purchase_invoices','validate_expenses',
        'validate_cash_register','validate_advances','validate_loans','validate_electronic_invoices',
        'fn_intelligence_report','intelligence_report','fn_refresh_analytics','fn_auto_populate_catalog',
        'sanitize_eleventa_items','fn_normalize_product_name','fn_audit_trigger','get_my_tenant_id',
        'is_tenant_owner','prevent_tenant_id_change')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = %s',
      r.nspname, r.proname, r.args,
      CASE WHEN r.nspname = 'analytics' THEN 'analytics, public, pg_temp' ELSE 'public, pg_temp' END);
  END LOOP;
END $$;

-- 2) Vista de monitoreo: aplicar RLS del que consulta, no del creador.
ALTER VIEW public.suspicious_activity SET (security_invoker = true);

-- 3) Funciones-trigger puras: nunca deben ser llamables vía RPC.
--    El grant por defecto es a PUBLIC; revocarlo cierra anon+authenticated.
--    Los triggers siguen funcionando (corren como dueño de la tabla).
REVOKE EXECUTE ON FUNCTION public.fn_audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_tenant_id_change() FROM PUBLIC, anon, authenticated;

-- 4) Bucket 'invoices': vacío y sin uso en el cliente (las facturas viven en
--    tablas, no en storage). Quitar acceso público total y marcarlo privado.
DROP POLICY IF EXISTS "Permitir acceso publico a las facturas" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to invoices" ON storage.objects;
UPDATE storage.buckets SET public = false WHERE id = 'invoices';
-- 5) Bucket 'marketing_media' (lo usa el estudio de marketing): reemplazar la
--    policy ALL por INSERT+UPDATE. Mantiene lectura por URL (bucket sigue público)
--    y subida, pero quita listado (SELECT broad) y borrado (DELETE) por anon.
DROP POLICY IF EXISTS "Permitir todo a la app" ON storage.objects;
CREATE POLICY "marketing_media_insert" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'marketing_media');
CREATE POLICY "marketing_media_update" ON storage.objects
  FOR UPDATE TO public USING (bucket_id = 'marketing_media')
  WITH CHECK (bucket_id = 'marketing_media');
