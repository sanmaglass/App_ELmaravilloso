-- ============================================================
-- 009: Supabase Auth + user_tenants + RLS por tenant
-- ============================================================
-- Contexto: Reemplazar auth hardcodeado por Supabase Auth real.
-- Cada usuario se vincula a un tenant. Las políticas RLS
-- filtran datos por tenant_id del usuario autenticado.
--
-- PREREQUISITO: Migración 008 (tenant_id en todas las tablas)
--
-- IMPORTANTE: Después de ejecutar esta migración, debes crear
-- tu primer usuario en Supabase Auth (Dashboard > Authentication)
-- con el email sanmaglass@gmail.com y vincularlo manualmente
-- con el INSERT que aparece al final.
-- ============================================================

-- ── 1. Tabla user_tenants (mapea usuarios a negocios) ───────

CREATE TABLE IF NOT EXISTS user_tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,                       -- auth.users.id
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    role        TEXT NOT NULL DEFAULT 'owner',        -- owner, admin, employee
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve sus propias vinculaciones
CREATE POLICY "users_see_own_tenants" ON user_tenants
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Solo owners pueden agregar usuarios a su tenant
CREATE POLICY "owners_manage_tenants" ON user_tenants
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

CREATE INDEX idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON user_tenants(tenant_id);

-- ── 2. Función helper para obtener tenant_id del usuario ────

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT tenant_id
    FROM user_tenants
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$;

-- ── 3. Reemplazar políticas RLS abiertas por filtro real ────
-- Borramos las políticas "anon_all_*" y creamos nuevas que
-- filtran por tenant_id. Mantenemos acceso anon temporal
-- para no romper la app durante la transición.

-- employees
DROP POLICY IF EXISTS "anon_all_employees" ON employees;
CREATE POLICY "tenant_rls_employees" ON employees
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_employees" ON employees
    FOR SELECT TO anon USING (true);

-- worklogs
DROP POLICY IF EXISTS "anon_all_worklogs" ON worklogs;
CREATE POLICY "tenant_rls_worklogs" ON worklogs
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_worklogs" ON worklogs
    FOR SELECT TO anon USING (true);

-- products
DROP POLICY IF EXISTS "anon_all_products" ON products;
CREATE POLICY "tenant_rls_products" ON products
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_products" ON products
    FOR SELECT TO anon USING (true);

-- promotions
DROP POLICY IF EXISTS "anon_all_promotions" ON promotions;
CREATE POLICY "tenant_rls_promotions" ON promotions
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_promotions" ON promotions
    FOR SELECT TO anon USING (true);

-- suppliers
DROP POLICY IF EXISTS "anon_all_suppliers" ON suppliers;
CREATE POLICY "tenant_rls_suppliers" ON suppliers
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_suppliers" ON suppliers
    FOR SELECT TO anon USING (true);

-- purchase_invoices
DROP POLICY IF EXISTS "anon_all_purchase_invoices" ON purchase_invoices;
CREATE POLICY "tenant_rls_purchase_invoices" ON purchase_invoices
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_purchase_invoices" ON purchase_invoices
    FOR SELECT TO anon USING (true);

-- sales_invoices
DROP POLICY IF EXISTS "anon_all_sales_invoices" ON sales_invoices;
CREATE POLICY "tenant_rls_sales_invoices" ON sales_invoices
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_sales_invoices" ON sales_invoices
    FOR SELECT TO anon USING (true);

-- electronic_invoices
DROP POLICY IF EXISTS "anon_all_electronic_invoices" ON electronic_invoices;
CREATE POLICY "tenant_rls_electronic_invoices" ON electronic_invoices
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_electronic_invoices" ON electronic_invoices
    FOR SELECT TO anon USING (true);

-- expenses
DROP POLICY IF EXISTS "anon_all_expenses" ON expenses;
CREATE POLICY "tenant_rls_expenses" ON expenses
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_expenses" ON expenses
    FOR SELECT TO anon USING (true);

-- daily_sales
DROP POLICY IF EXISTS "anon_all_daily_sales" ON daily_sales;
CREATE POLICY "tenant_rls_daily_sales" ON daily_sales
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_daily_sales" ON daily_sales
    FOR SELECT TO anon USING (true);

-- reminders
DROP POLICY IF EXISTS "anon_all_reminders" ON reminders;
CREATE POLICY "tenant_rls_reminders" ON reminders
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_reminders" ON reminders
    FOR SELECT TO anon USING (true);

-- eleventa_sales
DROP POLICY IF EXISTS "anon_all_eleventa_sales" ON eleventa_sales;
CREATE POLICY "tenant_rls_eleventa_sales" ON eleventa_sales
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_eleventa_sales" ON eleventa_sales
    FOR SELECT TO anon USING (true);

-- loans
DROP POLICY IF EXISTS "anon_all_loans" ON loans;
CREATE POLICY "tenant_rls_loans" ON loans
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_loans" ON loans
    FOR SELECT TO anon USING (true);

-- cash_register
DROP POLICY IF EXISTS "anon_all_cash_register" ON cash_register;
CREATE POLICY "tenant_rls_cash_register" ON cash_register
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_cash_register" ON cash_register
    FOR SELECT TO anon USING (true);

-- advances
DROP POLICY IF EXISTS "anon_all_advances" ON advances;
DROP POLICY IF EXISTS "anon_all_advances_policy" ON advances;
CREATE POLICY "tenant_rls_advances" ON advances
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_advances" ON advances
    FOR SELECT TO anon USING (true);

-- sync_state
DROP POLICY IF EXISTS "anon_all_sync_state" ON sync_state;
CREATE POLICY "tenant_rls_sync_state" ON sync_state
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_sync_state" ON sync_state
    FOR SELECT TO anon USING (true);

-- sync_conflicts
DROP POLICY IF EXISTS "anon_all_sync_conflicts" ON sync_conflicts;
CREATE POLICY "tenant_rls_sync_conflicts" ON sync_conflicts
    FOR ALL TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "anon_read_sync_conflicts" ON sync_conflicts
    FOR SELECT TO anon USING (true);

-- tenants (solo ves tu propio tenant)
DROP POLICY IF EXISTS "anon_all_tenants" ON tenants;
CREATE POLICY "tenant_rls_tenants" ON tenants
    FOR ALL TO authenticated
    USING (id = get_my_tenant_id())
    WITH CHECK (id = get_my_tenant_id());
CREATE POLICY "anon_read_tenants" ON tenants
    FOR SELECT TO anon USING (true);

-- ── 4. Notas post-migración ────────────────────────────────
--
-- PASO MANUAL REQUERIDO después de ejecutar esta migración:
--
-- 1. Ve a Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" > "Create New User"
-- 3. Email: sanmaglass@gmail.com, Password: (la que quieras)
-- 4. Ejecuta este SQL para vincular tu usuario al tenant:
--
--    INSERT INTO user_tenants (user_id, tenant_id, role)
--    VALUES (
--        (SELECT id FROM auth.users WHERE email = 'sanmaglass@gmail.com'),
--        '00000000-0000-0000-0000-000000000001',
--        'owner'
--    );
--
-- 5. Las políticas "anon_read_*" son temporales para la transición.
--    Una vez que la app use auth completo, se pueden eliminar con
--    la migración 010_remove_anon_policies.sql
-- ============================================================
