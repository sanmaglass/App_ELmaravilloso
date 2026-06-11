-- ============================================================
-- 015: Eliminar políticas anon_all_* remanentes de migración 007
-- ============================================================
-- Las políticas anon_all_* de 007 nunca fueron eliminadas explícitamente.
-- La 012 eliminó las anon_read_* (de 009), pero las originales FOR ALL
-- de 007 que dan acceso TOTAL a rol anon siguen activas.
-- También agrega RLS completo a promotions y eleventa_sales (faltaban en 013).
-- ============================================================

-- ── 1. Eliminar TODAS las políticas anon_all_* de 007 ──────

DROP POLICY IF EXISTS "anon_all_employees"           ON employees;
DROP POLICY IF EXISTS "anon_all_worklogs"            ON worklogs;
DROP POLICY IF EXISTS "anon_all_products"            ON products;
DROP POLICY IF EXISTS "anon_all_promotions"          ON promotions;
DROP POLICY IF EXISTS "anon_all_suppliers"           ON suppliers;
DROP POLICY IF EXISTS "anon_all_purchase_invoices"   ON purchase_invoices;
DROP POLICY IF EXISTS "anon_all_sales_invoices"      ON sales_invoices;
DROP POLICY IF EXISTS "anon_all_expenses"            ON expenses;
DROP POLICY IF EXISTS "anon_all_daily_sales"         ON daily_sales;
DROP POLICY IF EXISTS "anon_all_electronic_invoices" ON electronic_invoices;
DROP POLICY IF EXISTS "anon_all_reminders"           ON reminders;
DROP POLICY IF EXISTS "anon_all_eleventa_sales"      ON eleventa_sales;
DROP POLICY IF EXISTS "anon_all_loans"               ON loans;
DROP POLICY IF EXISTS "anon_all_cash_register"       ON cash_register;
DROP POLICY IF EXISTS "anon_all_advances"            ON advances;
DROP POLICY IF EXISTS "anon_all_sync_state"          ON sync_state;
DROP POLICY IF EXISTS "anon_all_sync_conflicts"      ON sync_conflicts;

-- ── 2. promotions: RLS con tenant_id (faltaba en 013) ──────

DROP POLICY IF EXISTS "tenant_rls_promotions" ON promotions;
CREATE POLICY "rls_promotions_select" ON promotions
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_promotions_insert" ON promotions
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_promotions_update" ON promotions
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_promotions_delete" ON promotions
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

-- Trigger prevent_tenant_id_change
DROP TRIGGER IF EXISTS trg_prevent_tenant_change ON promotions;
CREATE TRIGGER trg_prevent_tenant_change
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- ── 3. eleventa_sales: RLS con tenant_id (faltaba en 013) ──

DROP POLICY IF EXISTS "tenant_rls_eleventa_sales" ON eleventa_sales;
CREATE POLICY "rls_eleventa_sales_select" ON eleventa_sales
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_eleventa_sales_insert" ON eleventa_sales
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_eleventa_sales_update" ON eleventa_sales
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_eleventa_sales_delete" ON eleventa_sales
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

DROP TRIGGER IF EXISTS trg_prevent_tenant_change ON eleventa_sales;
CREATE TRIGGER trg_prevent_tenant_change
    BEFORE UPDATE ON eleventa_sales
    FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- ── 4. sync_state y sync_conflicts: RLS tenant ─────────────

DROP POLICY IF EXISTS "tenant_rls_sync_state" ON sync_state;
CREATE POLICY "rls_sync_state_select" ON sync_state
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sync_state_insert" ON sync_state
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sync_state_update" ON sync_state
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sync_state_delete" ON sync_state
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());

DROP POLICY IF EXISTS "tenant_rls_sync_conflicts" ON sync_conflicts;
CREATE POLICY "rls_sync_conflicts_select" ON sync_conflicts
    FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sync_conflicts_insert" ON sync_conflicts
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sync_conflicts_update" ON sync_conflicts
    FOR UPDATE TO authenticated
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "rls_sync_conflicts_delete" ON sync_conflicts
    FOR DELETE TO authenticated USING (tenant_id = get_my_tenant_id());
