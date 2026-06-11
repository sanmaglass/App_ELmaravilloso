-- ============================================================
-- 012: Eliminar políticas anon_read_* (seguridad crítica)
-- ============================================================
-- Motivo: Las políticas "anon_read_*" permiten que cualquier
-- usuario anónimo (sin autenticación) lea datos sensibles del
-- negocio: empleados, ventas, facturas, préstamos, caja, etc.
--
-- Estas políticas fueron creadas en 009 como medida temporal
-- durante la transición a Supabase Auth. Con el auth completo
-- ya operativo, los usuarios anónimos NO deben tener acceso
-- a ningún dato de negocio.
--
-- Tras esta migración, solo usuarios autenticados con un
-- tenant_id válido pueden leer datos (via tenant_rls_* policies).
-- ============================================================

DROP POLICY IF EXISTS "anon_read_employees"           ON employees;
DROP POLICY IF EXISTS "anon_read_worklogs"            ON worklogs;
DROP POLICY IF EXISTS "anon_read_products"            ON products;
DROP POLICY IF EXISTS "anon_read_promotions"          ON promotions;
DROP POLICY IF EXISTS "anon_read_suppliers"           ON suppliers;
DROP POLICY IF EXISTS "anon_read_purchase_invoices"   ON purchase_invoices;
DROP POLICY IF EXISTS "anon_read_sales_invoices"      ON sales_invoices;
DROP POLICY IF EXISTS "anon_read_electronic_invoices" ON electronic_invoices;
DROP POLICY IF EXISTS "anon_read_expenses"            ON expenses;
DROP POLICY IF EXISTS "anon_read_daily_sales"         ON daily_sales;
DROP POLICY IF EXISTS "anon_read_reminders"           ON reminders;
DROP POLICY IF EXISTS "anon_read_eleventa_sales"      ON eleventa_sales;
DROP POLICY IF EXISTS "anon_read_loans"               ON loans;
DROP POLICY IF EXISTS "anon_read_cash_register"       ON cash_register;
DROP POLICY IF EXISTS "anon_read_advances"            ON advances;
DROP POLICY IF EXISTS "anon_read_sync_state"          ON sync_state;
DROP POLICY IF EXISTS "anon_read_sync_conflicts"      ON sync_conflicts;
DROP POLICY IF EXISTS "anon_read_tenants"             ON tenants;
