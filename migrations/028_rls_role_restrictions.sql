-- ═══════════════════════════════════════════════════════════════════════
-- 028: RLS con restricción de rol para tablas financieras
-- Employee solo puede LEER (SELECT) tablas financieras, no escribir.
-- Tablas afectadas: expenses, cash_register, loans, advances,
--   purchase_invoices, sales_invoices, electronic_invoices, suppliers
-- También: team_reports UPDATE restringido para employees.
-- También: team-photos SELECT con filtro de tenant.
-- También: eleventa_clientes y eleventa_alertas con filtro de tenant.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper: obtener rol del usuario actual ──
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM user_tenants
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- EXPENSES — employee no puede INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_expenses_insert" ON expenses;
DROP POLICY IF EXISTS "tenant_rls_expenses_update" ON expenses;
DROP POLICY IF EXISTS "tenant_rls_expenses_delete" ON expenses;

CREATE POLICY "expenses_insert_admin" ON expenses
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "expenses_update_admin" ON expenses
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "expenses_delete_admin" ON expenses
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- CASH_REGISTER — employee solo puede INSERT cuadres (type='cuadre')
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_cash_register_insert" ON cash_register;
DROP POLICY IF EXISTS "tenant_rls_cash_register_update" ON cash_register;
DROP POLICY IF EXISTS "tenant_rls_cash_register_delete" ON cash_register;

CREATE POLICY "cash_register_insert" ON cash_register
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND (
            public.get_my_role() IN ('owner', 'admin')
            OR (public.get_my_role() = 'employee' AND type IN ('cuadre', 'fondo_apertura', 'gasto_caja'))
        )
    );

CREATE POLICY "cash_register_update" ON cash_register
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND (
            public.get_my_role() IN ('owner', 'admin')
            OR (public.get_my_role() = 'employee' AND type IN ('cuadre', 'fondo_apertura', 'gasto_caja'))
        )
    );

CREATE POLICY "cash_register_delete_admin" ON cash_register
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- LOANS — employee no puede INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_loans_insert" ON loans;
DROP POLICY IF EXISTS "tenant_rls_loans_update" ON loans;
DROP POLICY IF EXISTS "tenant_rls_loans_delete" ON loans;

CREATE POLICY "loans_insert_admin" ON loans
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "loans_update_admin" ON loans
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "loans_delete_admin" ON loans
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- ADVANCES — employee no puede INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_advances_insert" ON advances;
DROP POLICY IF EXISTS "tenant_rls_advances_update" ON advances;
DROP POLICY IF EXISTS "tenant_rls_advances_delete" ON advances;

CREATE POLICY "advances_insert_admin" ON advances
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "advances_update_admin" ON advances
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "advances_delete_admin" ON advances
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- PURCHASE_INVOICES — employee no puede INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_purchase_invoices_insert" ON purchase_invoices;
DROP POLICY IF EXISTS "tenant_rls_purchase_invoices_update" ON purchase_invoices;
DROP POLICY IF EXISTS "tenant_rls_purchase_invoices_delete" ON purchase_invoices;

CREATE POLICY "purchase_invoices_insert_admin" ON purchase_invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "purchase_invoices_update_admin" ON purchase_invoices
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "purchase_invoices_delete_admin" ON purchase_invoices
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- SALES_INVOICES — employee no puede INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_sales_invoices_insert" ON sales_invoices;
DROP POLICY IF EXISTS "tenant_rls_sales_invoices_update" ON sales_invoices;
DROP POLICY IF EXISTS "tenant_rls_sales_invoices_delete" ON sales_invoices;

CREATE POLICY "sales_invoices_insert_admin" ON sales_invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "sales_invoices_update_admin" ON sales_invoices
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "sales_invoices_delete_admin" ON sales_invoices
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- SUPPLIERS — employee no puede INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tenant_rls_suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "tenant_rls_suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "tenant_rls_suppliers_delete" ON suppliers;

CREATE POLICY "suppliers_insert_admin" ON suppliers
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "suppliers_update_admin" ON suppliers
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

CREATE POLICY "suppliers_delete_admin" ON suppliers
    FOR DELETE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- ═══════════════════════════════════════════════════════════════════════
-- TEAM_REPORTS — employee solo puede UPDATE sus propios campos (no status/admin_response)
-- Reemplazar la política permisiva por una restrictiva
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "team_reports_update" ON team_reports;

-- Admin puede actualizar todo
CREATE POLICY "team_reports_update_admin" ON team_reports
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND public.get_my_role() IN ('owner', 'admin')
    );

-- Employee solo puede actualizar sus propios reportes y no puede cambiar status ni admin_response
CREATE POLICY "team_reports_update_employee" ON team_reports
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND user_id = auth.uid()
        AND public.get_my_role() = 'employee'
    )
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND user_id = auth.uid()
        AND status = 'pendiente'
    );

-- ═══════════════════════════════════════════════════════════════════════
-- TEAM-PHOTOS STORAGE — SELECT con filtro de tenant
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "team_photos_select" ON storage.objects;

CREATE POLICY "team_photos_select_tenant" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'team-photos'
        AND (storage.foldername(name))[1] = (public.get_my_tenant_id())::text
    );

-- ═══════════════════════════════════════════════════════════════════════
-- ELEVENTA_CLIENTES / ELEVENTA_ALERTAS — agregar filtro de tenant
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "eleventa_clientes_all" ON eleventa_clientes;
DROP POLICY IF EXISTS "rls_eleventa_clientes" ON eleventa_clientes;

CREATE POLICY "eleventa_clientes_tenant" ON eleventa_clientes
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "eleventa_alertas_all" ON eleventa_alertas;
DROP POLICY IF EXISTS "rls_eleventa_alertas" ON eleventa_alertas;

CREATE POLICY "eleventa_alertas_tenant" ON eleventa_alertas
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());
