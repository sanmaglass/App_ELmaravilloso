-- =====================================================
-- Migración 025: EMERGENCIA — Eliminar políticas RLS legacy abiertas
-- Aplicada en Supabase 2026-06-22 (proyecto ybonpeapvpdseqbtlysx).
--
-- PROBLEMA: 31 políticas con roles={public} y USING(true) daban
-- acceso TOTAL a cualquiera con la anon key (visible en JS público).
-- Datos de employees, expenses, sales, push tokens expuestos.
-- RPCs intelligence_report y fn_refresh_analytics ejecutables sin auth.
--
-- FIX: Eliminar todas las políticas legacy + revocar RPCs de public.
-- Las políticas por tenant (rls_*_select, etc.) quedan como únicas.
-- =====================================================

-- employees
DROP POLICY IF EXISTS "Enable all" ON public.employees;
DROP POLICY IF EXISTS "Public Access" ON public.employees;

-- expenses
DROP POLICY IF EXISTS "Enable all" ON public.expenses;
DROP POLICY IF EXISTS "Public Access" ON public.expenses;

-- products
DROP POLICY IF EXISTS "Enable all" ON public.products;
DROP POLICY IF EXISTS "Public Access" ON public.products;

-- promotions
DROP POLICY IF EXISTS "Enable all" ON public.promotions;
DROP POLICY IF EXISTS "Public Access" ON public.promotions;

-- purchase_invoices
DROP POLICY IF EXISTS "Enable all" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Public Access" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Enable all access for purchase_invoices" ON public.purchase_invoices;

-- sales_invoices
DROP POLICY IF EXISTS "Enable all" ON public.sales_invoices;
DROP POLICY IF EXISTS "Public Access" ON public.sales_invoices;
DROP POLICY IF EXISTS "Enable all access for sales_invoices" ON public.sales_invoices;

-- daily_sales
DROP POLICY IF EXISTS "Enable all" ON public.daily_sales;
DROP POLICY IF EXISTS "Public Access" ON public.daily_sales;
DROP POLICY IF EXISTS "Leyendo cierres" ON public.daily_sales;

-- electronic_invoices
DROP POLICY IF EXISTS "Public Access" ON public.electronic_invoices;

-- worklogs
DROP POLICY IF EXISTS "Enable all" ON public.worklogs;
DROP POLICY IF EXISTS "Public Access" ON public.worklogs;

-- suppliers
DROP POLICY IF EXISTS "Enable all" ON public.suppliers;
DROP POLICY IF EXISTS "Public Access" ON public.suppliers;
DROP POLICY IF EXISTS "Enable all access for suppliers" ON public.suppliers;

-- settings
DROP POLICY IF EXISTS "Enable all" ON public.settings;
DROP POLICY IF EXISTS "Public Access" ON public.settings;
DROP POLICY IF EXISTS "Enable all access for settings" ON public.settings;

-- push_subscriptions
DROP POLICY IF EXISTS "Allow all for anon" ON public.push_subscriptions;

-- reminders
DROP POLICY IF EXISTS "Allow all for anon" ON public.reminders;

-- eleventa_abonos
DROP POLICY IF EXISTS "Allow anon select" ON public.eleventa_abonos;

-- eleventa_sales
DROP POLICY IF EXISTS "Leyendo ventas" ON public.eleventa_sales;

-- eleventa_flujo_caja
DROP POLICY IF EXISTS "Leyendo flujo" ON public.eleventa_flujo_caja;

-- RPCs: solo authenticated puede ejecutar
REVOKE EXECUTE ON FUNCTION public.intelligence_report() FROM public;
GRANT EXECUTE ON FUNCTION public.intelligence_report() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_refresh_analytics() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_refresh_analytics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_auto_populate_catalog() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_auto_populate_catalog() TO authenticated;
