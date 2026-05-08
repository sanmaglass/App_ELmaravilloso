-- ============================================================
-- 007: Habilitar RLS en TODAS las tablas públicas
-- ============================================================
-- Contexto: Supabase alerta que las tablas no tienen RLS.
-- La app usa solo la anon key (sin Supabase Auth), así que
-- creamos políticas permisivas para el rol 'anon'.
-- Esto silencia la alerta y prepara la base para auth futuro.
-- ============================================================

-- ── Tablas de negocio ────────────────────────────────────────

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_employees" ON employees FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE worklogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_worklogs" ON worklogs FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_products" ON products FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_promotions" ON promotions FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_suppliers" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_purchase_invoices" ON purchase_invoices FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_sales_invoices" ON sales_invoices FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_expenses" ON expenses FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_daily_sales" ON daily_sales FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_electronic_invoices" ON electronic_invoices FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_reminders" ON reminders FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE eleventa_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_eleventa_sales" ON eleventa_sales FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_loans" ON loans FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_cash_register" ON cash_register FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── advances ya tiene RLS (migración 005), solo verificar política ──
-- Si no tiene política para anon, agregarla:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'advances' AND policyname = 'anon_all_advances'
    ) THEN
        EXECUTE 'CREATE POLICY "anon_all_advances" ON advances FOR ALL TO anon USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- ── Tablas de sync ───────────────────────────────────────────

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_sync_state" ON sync_state FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_sync_conflicts" ON sync_conflicts FOR ALL TO anon USING (true) WITH CHECK (true);
