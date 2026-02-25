-- ================================================
-- ENABLE SUPABASE REALTIME FOR WEBSOCKET SYNC
-- ================================================
-- Run this in Supabase SQL Editor to enable real-time
-- synchronization for all tables safely.

DO $$
DECLARE
    tbl_name TEXT;
    -- Usamos minúsculas ya que Postgres las guarda así por defecto
    tables_to_add TEXT[] := ARRAY[
        'employees', 'worklogs', 'products', 'promotions', 
        'suppliers', 'purchase_invoices', 'expenses', 
        'daily_sales', 'sales_invoices', 'electronic_invoices'
    ];
BEGIN
    FOR tbl_name IN SELECT unnest(tables_to_add) LOOP
        -- Verificamos si la tabla ya está en la publicación
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = tbl_name
        ) THEN
            -- Intentamos agregarla
            BEGIN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl_name);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Saltando tabla %: %', tbl_name, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- ================================================
-- VERIFICATION QUERY
-- ================================================
-- Run this to verify tables are enabled for Realtime:

SELECT 
    tablename,
    'ENABLED' as status
FROM 
    pg_publication_tables
WHERE 
    pubname = 'supabase_realtime'
ORDER BY 
    tablename;

-- Expected output: Should show employees, worklogs, products, promotions

-- ================================================
-- NOTES
-- ================================================
-- * Free tier supports 200 concurrent connections
-- * No additional cost for Realtime on Free tier
-- * Changes are pushed via WebSocket (instant)
-- * Polling runs every 60s as automatic fallback
--
-- After running this script:
-- 1. Refresh your app
-- 2. Look for "Tiempo Real" status (purple icon)
-- 3. Open app on 2 devices and test cross-device sync
-- ================================================
