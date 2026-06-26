-- Tabla de sugerencias/mejoras del equipo
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,
    user_email TEXT,
    title TEXT NOT NULL CHECK (char_length(title) <= 80),
    description TEXT CHECK (char_length(description) <= 500),
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'vista', 'en_proceso', 'implementada', 'descartada')),
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Employee puede insertar y ver las suyas
CREATE POLICY "suggestions_insert" ON suggestions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND active = true)
    );

CREATE POLICY "suggestions_select_own" ON suggestions
    FOR SELECT USING (
        auth.uid() = user_id
        AND tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND active = true)
    );

-- Admin/owner puede ver todas y actualizar (responder, cambiar estado)
CREATE POLICY "suggestions_admin_select" ON suggestions
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND active = true AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "suggestions_admin_update" ON suggestions
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND active = true AND role IN ('admin', 'owner')
        )
    );

-- Índice para consultas por tenant
CREATE INDEX IF NOT EXISTS idx_suggestions_tenant ON suggestions(tenant_id, created_at DESC);
