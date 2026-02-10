-- MIGRATION SCRIPT: Add Soft Delete Column
-- Solo ejecuta esto SI YA TIENES DATOS en Supabase
-- Si estás empezando de cero, usa setup_supabase.sql completo

-- Agregar columna 'deleted' a todas las tablas
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.worklogs ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Verificar que se agregó correctamente
SELECT 'employees' AS tabla, COUNT(*) AS total_registros, SUM(CASE WHEN deleted THEN 1 ELSE 0 END) AS borrados FROM public.employees
UNION ALL
SELECT 'worklogs', COUNT(*), SUM(CASE WHEN deleted THEN 1 ELSE 0 END) FROM public.worklogs
UNION ALL  
SELECT 'products', COUNT(*), SUM(CASE WHEN deleted THEN 1 ELSE 0 END) FROM public.products
UNION ALL
SELECT 'promotions', COUNT(*), SUM(CASE WHEN deleted THEN 1 ELSE 0 END) FROM public.promotions;
