-- =====================================================
-- Migración 024: Agregar tenant_id y filtro RLS a tablas externas
-- Las tablas eleventa_clientes, eleventa_alertas y social_posts
-- tenían USING (true) sin filtro de tenant. Si se agrega un segundo
-- tenant, cualquier usuario autenticado vería datos de todos.
-- Fix: agregar tenant_id con default al tenant actual + RLS por tenant.
-- =====================================================

-- UUID del tenant único existente
DO $$
DECLARE
    default_tid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

-- eleventa_clientes
IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'eleventa_clientes' AND column_name = 'tenant_id'
) THEN
    ALTER TABLE public.eleventa_clientes ADD COLUMN tenant_id uuid DEFAULT default_tid;
    UPDATE public.eleventa_clientes SET tenant_id = default_tid WHERE tenant_id IS NULL;
END IF;

-- eleventa_alertas
IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'eleventa_alertas' AND column_name = 'tenant_id'
) THEN
    ALTER TABLE public.eleventa_alertas ADD COLUMN tenant_id uuid DEFAULT default_tid;
    UPDATE public.eleventa_alertas SET tenant_id = default_tid WHERE tenant_id IS NULL;
END IF;

-- social_posts
IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_posts' AND column_name = 'tenant_id'
) THEN
    ALTER TABLE public.social_posts ADD COLUMN tenant_id uuid DEFAULT default_tid;
    UPDATE public.social_posts SET tenant_id = default_tid WHERE tenant_id IS NULL;
END IF;

END $$;

-- Reemplazar políticas permisivas con filtro por tenant
DROP POLICY IF EXISTS auth_all_eleventa_clientes ON public.eleventa_clientes;
CREATE POLICY tenant_eleventa_clientes ON public.eleventa_clientes
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS auth_all_eleventa_alertas ON public.eleventa_alertas;
CREATE POLICY tenant_eleventa_alertas ON public.eleventa_alertas
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS auth_all_social_posts ON public.social_posts;
CREATE POLICY tenant_social_posts ON public.social_posts
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());
