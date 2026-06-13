-- 018_hlc_eleventa_abonos.sql
-- Habilita sincronización HLC para la tabla eleventa_abonos.
--
-- PROBLEMA QUE RESUELVE:
-- eleventa_abonos (pagos recibidos en cuentas de crédito, escritos por el
-- launcher de Eleventa) estaba documentada como "pull-only desde Supabase",
-- pero nunca se le agregó la columna updated_at_hlc ni entró al
-- REMOTE_TABLE_MAP de js/constants.js. Resultado: SyncV2 NUNCA la sincronizaba
-- y los abonos a crédito no llegaban a otros dispositivos.
--
-- DESPUÉS DE ESTA MIGRACIÓN:
-- eleventa_abonos tiene updated_at_hlc + version + triggers HLC (igual que
-- eleventa_sales), está en la publicación de Realtime, y se agregó al
-- REMOTE_TABLE_MAP en el código. El pull incremental ya la detecta.
--
-- SEGURO DE CORRER VARIAS VECES: usa IF NOT EXISTS + DROP/CREATE en triggers.

ALTER TABLE public.eleventa_abonos ADD COLUMN IF NOT EXISTS updated_at_hlc BIGINT;
ALTER TABLE public.eleventa_abonos ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Triggers HLC (la función attach_hlc_triggers ya existe desde la migración 003)
SELECT attach_hlc_triggers('eleventa_abonos');

-- Backfill de filas existentes para que el pull incremental las detecte
UPDATE public.eleventa_abonos
SET updated_at_hlc = (extract(epoch from now()) * 1000)::bigint
WHERE updated_at_hlc IS NULL;

-- Agregar a la publicación de Realtime (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'eleventa_abonos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.eleventa_abonos';
  END IF;
END $$;
