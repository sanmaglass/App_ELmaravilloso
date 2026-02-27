-- ============================================================
-- MIGRACIÓN: Tabla reminders — Add priority, notes, category
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.reminders (
    id              BIGINT PRIMARY KEY,
    title           TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'once',
    frequency_unit  TEXT NOT NULL DEFAULT 'days',
    frequency_value INTEGER NOT NULL DEFAULT 0,
    next_run        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed       INTEGER NOT NULL DEFAULT 0,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Columnas PRO
    priority        TEXT NOT NULL DEFAULT 'medium',  -- 'high' | 'medium' | 'low'
    notes           TEXT,
    category        TEXT,
    snoozed_until   TIMESTAMPTZ
);

-- 2. Si la tabla ya existía, agregar columnas nuevas (safe)
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS priority       TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS category       TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS snoozed_until  TIMESTAMPTZ;

-- 3. Row Level Security
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON public.reminders
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Habilitar Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
