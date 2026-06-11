-- ============================================================
-- 013: RLS Hardening
-- ============================================================
-- 1. Eliminar política anon restante en advances
-- 2. Agregar tenant_id a eleventa_flujo_caja + política RLS
-- 3. Fijar search_path en get_my_tenant_id() para evitar inyección
-- 4. Reemplazar políticas FOR ALL por SELECT/INSERT/UPDATE/DELETE
--    separadas en tablas principales (principio de menor privilegio)
-- 5. Trigger prevent_tenant_id_change() en tablas con tenant_id
-- 6. RLS en push_subscriptions con filtro tenant_id
-- ============================================================

-- ── 1. Advances: eliminar política anon abierta ─────────────

DROP POLICY IF EXISTS "Allow all for anon" ON advances;

-- ── 2. eleventa_flujo_caja: agregar tenant_id + RLS ─────────

ALTER TABLE eleventa_flujo_caja
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE eleventa_flujo_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_rls_eleventa_flujo_caja" ON eleventa_flujo_caja;
CREATE POLICY "tenant_rls_eleventa_flujo_caja_select" ON eleventa_flujo_caja
    FOR SELECT TO authenticated
    USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_rls_eleventa_flujo_caja_insert" ON eleventa_flujo_caja
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_rls_eleventa_flujo_caja_update" ON eleventa_flujo_caja
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_rls_eleventa_flujo_caja_delete" ON eleventa_flujo_caja
    FOR DELETE TO authenticated
    USING (tenant_id = get_my_tenant_id());

-- ── 3. Fijar search_path en get_my_tenant_id() ──────────────

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id
    FROM user_tenants
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$;

-- ── 4. Reemplazar FOR ALL por operaciones separadas ──────────
-- Tablas: employees, products, expenses, sales_invoices,
--         purchase_invoices, suppliers, worklogs, daily_sales,
--         cash_register, loans, advances, reminders

-- employees
DROP POLICY IF EXISTS "tenant_rls_employees" ON employees;
CREATE POLICY "rls_employees_select" ON employees
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_employees_insert" ON employees
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_employees_update" ON employees
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_employees_delete" ON employees
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- products
DROP POLICY IF EXISTS "tenant_rls_products" ON products;
CREATE POLICY "rls_products_select" ON products
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_products_insert" ON products
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_products_update" ON products
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_products_delete" ON products
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- expenses
DROP POLICY IF EXISTS "tenant_rls_expenses" ON expenses;
CREATE POLICY "rls_expenses_select" ON expenses
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_expenses_insert" ON expenses
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_expenses_update" ON expenses
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_expenses_delete" ON expenses
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- sales_invoices
DROP POLICY IF EXISTS "tenant_rls_sales_invoices" ON sales_invoices;
CREATE POLICY "rls_sales_invoices_select" ON sales_invoices
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sales_invoices_insert" ON sales_invoices
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sales_invoices_update" ON sales_invoices
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sales_invoices_delete" ON sales_invoices
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- purchase_invoices
DROP POLICY IF EXISTS "tenant_rls_purchase_invoices" ON purchase_invoices;
CREATE POLICY "rls_purchase_invoices_select" ON purchase_invoices
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_purchase_invoices_insert" ON purchase_invoices
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_purchase_invoices_update" ON purchase_invoices
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_purchase_invoices_delete" ON purchase_invoices
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- suppliers
DROP POLICY IF EXISTS "tenant_rls_suppliers" ON suppliers;
CREATE POLICY "rls_suppliers_select" ON suppliers
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_suppliers_insert" ON suppliers
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_suppliers_update" ON suppliers
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_suppliers_delete" ON suppliers
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- worklogs
DROP POLICY IF EXISTS "tenant_rls_worklogs" ON worklogs;
CREATE POLICY "rls_worklogs_select" ON worklogs
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_worklogs_insert" ON worklogs
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_worklogs_update" ON worklogs
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_worklogs_delete" ON worklogs
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- daily_sales
DROP POLICY IF EXISTS "tenant_rls_daily_sales" ON daily_sales;
CREATE POLICY "rls_daily_sales_select" ON daily_sales
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_daily_sales_insert" ON daily_sales
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_daily_sales_update" ON daily_sales
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_daily_sales_delete" ON daily_sales
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- cash_register
DROP POLICY IF EXISTS "tenant_rls_cash_register" ON cash_register;
CREATE POLICY "rls_cash_register_select" ON cash_register
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_cash_register_insert" ON cash_register
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_cash_register_update" ON cash_register
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_cash_register_delete" ON cash_register
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- loans
DROP POLICY IF EXISTS "tenant_rls_loans" ON loans;
CREATE POLICY "rls_loans_select" ON loans
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_loans_insert" ON loans
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_loans_update" ON loans
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_loans_delete" ON loans
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- advances
DROP POLICY IF EXISTS "tenant_rls_advances" ON advances;
CREATE POLICY "rls_advances_select" ON advances
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_advances_insert" ON advances
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_advances_update" ON advances
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_advances_delete" ON advances
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- reminders
DROP POLICY IF EXISTS "tenant_rls_reminders" ON reminders;
CREATE POLICY "rls_reminders_select" ON reminders
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_reminders_insert" ON reminders
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_reminders_update" ON reminders
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_reminders_delete" ON reminders
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- electronic_invoices
DROP POLICY IF EXISTS "tenant_rls_electronic_invoices" ON electronic_invoices;
CREATE POLICY "rls_electronic_invoices_select" ON electronic_invoices
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_electronic_invoices_insert" ON electronic_invoices
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_electronic_invoices_update" ON electronic_invoices
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_electronic_invoices_delete" ON electronic_invoices
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- ── 5. Trigger prevent_tenant_id_change ─────────────────────
-- Evita que un registro sea "movido" a otro tenant via UPDATE

CREATE OR REPLACE FUNCTION prevent_tenant_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION 'tenant_id no puede modificarse después de la creación';
    END IF;
    RETURN NEW;
END;
$$;

-- Aplicar trigger a tablas con tenant_id
DO $$
DECLARE
    tbl TEXT;
    tbls TEXT[] := ARRAY[
        'employees','products','expenses','sales_invoices','purchase_invoices',
        'suppliers','worklogs','daily_sales','cash_register','loans','advances',
        'reminders','electronic_invoices','eleventa_flujo_caja'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        -- DROP IF EXISTS para idempotencia
        EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_tenant_change ON %I', tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_prevent_tenant_change
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change()',
            tbl
        );
    END LOOP;
END;
$$;

-- ── 6. push_subscriptions: RLS con filtro tenant_id ─────────

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_push_subscriptions_select" ON push_subscriptions;
DROP POLICY IF EXISTS "rls_push_subscriptions_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "rls_push_subscriptions_update" ON push_subscriptions;
DROP POLICY IF EXISTS "rls_push_subscriptions_delete" ON push_subscriptions;

CREATE POLICY "rls_push_subscriptions_select" ON push_subscriptions
    FOR SELECT TO authenticated
    USING (tenant_id = get_my_tenant_id());

CREATE POLICY "rls_push_subscriptions_insert" ON push_subscriptions
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "rls_push_subscriptions_update" ON push_subscriptions
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "rls_push_subscriptions_delete" ON push_subscriptions
    FOR DELETE TO authenticated
    USING (tenant_id = get_my_tenant_id());
