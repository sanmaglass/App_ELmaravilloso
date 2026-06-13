-- =====================================================
-- Migración 017: Cerrar exposición anon en tablas con RLS desactivado
-- Aplicada en Supabase 2026-06-13 (proyecto ybonpeapvpdseqbtlysx).
-- Antes: social_posts, eleventa_clientes, eleventa_alertas tenían RLS OFF
-- => cualquiera con la anon key podía leer/modificar todo.
-- Ahora: solo usuarios autenticados (la app logueada). service_role
-- (integrador Eleventa / función push) bypasea RLS. anon queda sin acceso.
-- =====================================================

-- eleventa_clientes (clientes / saldo de deuda)
DROP POLICY IF EXISTS "Leyendo clientes" ON public.eleventa_clientes;
DROP POLICY IF EXISTS "Permitir App Web leer clientes" ON public.eleventa_clientes;
ALTER TABLE public.eleventa_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all_eleventa_clientes ON public.eleventa_clientes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- eleventa_alertas
DROP POLICY IF EXISTS "Leyendo alertas" ON public.eleventa_alertas;
DROP POLICY IF EXISTS "Permitir App Web leer alertas" ON public.eleventa_alertas;
ALTER TABLE public.eleventa_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all_eleventa_alertas ON public.eleventa_alertas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- social_posts (sin uso en los proyectos; se asegura igual)
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all_social_posts ON public.social_posts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
