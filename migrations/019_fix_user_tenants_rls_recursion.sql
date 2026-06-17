-- 019_fix_user_tenants_rls_recursion.sql
-- Arregla recursión infinita (42P17) en la política RLS de user_tenants.
-- La política "owners_manage_tenants" consultaba user_tenants DENTRO de una
-- política SOBRE user_tenants → recursión → ningún usuario podía leer su rol
-- (Auth._loadTenant fallaba en silencio, rompiendo el candado por rol).
--
-- Fix: función SECURITY DEFINER (bypassa RLS internamente) para el chequeo de owner.
-- Aplicado en producción 2026-06-17.

CREATE OR REPLACE FUNCTION public.is_tenant_owner(_tenant uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant
      AND role = 'owner'
      AND active = true
  );
$$;

DROP POLICY IF EXISTS owners_manage_tenants ON public.user_tenants;

CREATE POLICY owners_manage_tenants ON public.user_tenants
  FOR ALL TO authenticated
  USING (public.is_tenant_owner(tenant_id))
  WITH CHECK (public.is_tenant_owner(tenant_id));

-- La política "users_see_own_tenants" (user_id = auth.uid()) se mantiene:
-- permite a cualquier usuario leer su propia fila sin recursión.
