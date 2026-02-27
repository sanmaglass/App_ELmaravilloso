-- ============================================================
-- CREAR TABLA: reminders
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reminders (
    id          BIGINT PRIMARY KEY,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'once',          -- 'once' | 'periodic'
    frequency_unit  TEXT NOT NULL DEFAULT 'days',     -- 'hours' | 'days'
    frequency_value INTEGER NOT NULL DEFAULT 0,
    next_run    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed   INTEGER NOT NULL DEFAULT 0,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Política: acceso total para anon (solo si tienes anon key en config.js)
CREATE POLICY "Allow all for anon" ON public.reminders
    FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
