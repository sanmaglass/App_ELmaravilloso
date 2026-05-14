-- =====================================================
-- Migración 010: Tabla push_subscriptions para Web Push
-- =====================================================

-- Tabla para almacenar suscripciones Push de cada dispositivo
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id       TEXT NOT NULL UNIQUE,
    endpoint        TEXT NOT NULL,
    p256dh          TEXT,
    auth            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_tenant ON push_subscriptions(tenant_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: usuarios solo ven/editan sus propias suscripciones
CREATE POLICY push_subs_own ON push_subscriptions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Nota: la Edge Function usa SUPABASE_SERVICE_ROLE_KEY que bypasea RLS
-- automáticamente, así que no necesita política adicional.

-- Campos opcionales en reminders para tracking de push enviados
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS push_status TEXT DEFAULT NULL;
