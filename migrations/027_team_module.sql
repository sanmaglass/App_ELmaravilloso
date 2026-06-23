-- ============================================================
-- 027: Módulo Equipo — tablas team_reports, announcements, announcement_reads
-- + Storage bucket team-photos + RLS por tenant y rol
-- ============================================================

-- 1. TABLAS -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    type TEXT NOT NULL CHECK (type IN ('pedido', 'merma', 'limpieza', 'reporte')),
    title TEXT,
    description TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    photo_urls TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'visto', 'respondido', 'resuelto')),
    admin_response TEXT,
    admin_responded_at TIMESTAMPTZ,
    admin_responded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_hlc BIGINT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    photo_urls TEXT[] DEFAULT '{}',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgente')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_hlc BIGINT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id UUID NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_hlc BIGINT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(announcement_id, user_id)
);

-- 2. ÍNDICES ----------------------------------------------

CREATE INDEX IF NOT EXISTS idx_team_reports_tenant ON public.team_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_reports_user ON public.team_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_team_reports_type ON public.team_reports(type);
CREATE INDEX IF NOT EXISTS idx_team_reports_status ON public.team_reports(status);
CREATE INDEX IF NOT EXISTS idx_team_reports_created ON public.team_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON public.announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_ann ON public.announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads(user_id);

-- 3. HLC TRIGGERS (usa la función de migración 003) --------

SELECT attach_hlc_triggers('team_reports');
SELECT attach_hlc_triggers('announcements');
SELECT attach_hlc_triggers('announcement_reads');

-- 4. REALTIME (para sync en vivo) --------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reads;

-- 5. RLS ---------------------------------------------------

ALTER TABLE public.team_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- team_reports: employee ve/crea los suyos, admin/owner ve todos del tenant
CREATE POLICY "team_reports_select" ON public.team_reports
    FOR SELECT TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_tenants
                WHERE user_tenants.user_id = auth.uid()
                  AND user_tenants.tenant_id = team_reports.tenant_id
                  AND user_tenants.role IN ('owner', 'admin')
                  AND user_tenants.active = true
            )
        )
    );

CREATE POLICY "team_reports_insert" ON public.team_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND user_id = auth.uid()
    );

CREATE POLICY "team_reports_update" ON public.team_reports
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_tenants
                WHERE user_tenants.user_id = auth.uid()
                  AND user_tenants.tenant_id = team_reports.tenant_id
                  AND user_tenants.role IN ('owner', 'admin')
                  AND user_tenants.active = true
            )
        )
    )
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- announcements: admin/owner crea y edita, employee solo lee activos
CREATE POLICY "announcements_select" ON public.announcements
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "announcements_insert" ON public.announcements
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.user_tenants
            WHERE user_tenants.user_id = auth.uid()
              AND user_tenants.tenant_id = announcements.tenant_id
              AND user_tenants.role IN ('owner', 'admin')
              AND user_tenants.active = true
        )
    );

CREATE POLICY "announcements_update" ON public.announcements
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.user_tenants
            WHERE user_tenants.user_id = auth.uid()
              AND user_tenants.tenant_id = announcements.tenant_id
              AND user_tenants.role IN ('owner', 'admin')
              AND user_tenants.active = true
        )
    )
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- announcement_reads: employee crea su acuse, admin/owner lee todos
CREATE POLICY "announcement_reads_select" ON public.announcement_reads
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "announcement_reads_insert" ON public.announcement_reads
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND user_id = auth.uid()
    );

-- 6. STORAGE BUCKET para fotos del equipo ------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'team-photos',
    'team-photos',
    false,
    5242880,  -- 5MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated del tenant puede subir y ver
CREATE POLICY "team_photos_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'team-photos');

CREATE POLICY "team_photos_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'team-photos'
        AND (storage.foldername(name))[1] = (
            SELECT tenant_id::text FROM public.user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.active = true
            LIMIT 1
        )
    );

-- 7. CHECKLIST DIARIO (apertura/cierre) --------------------

CREATE TABLE IF NOT EXISTS public.team_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    date TEXT NOT NULL,  -- YYYY-MM-DD en zona Chile
    checklist_type TEXT NOT NULL DEFAULT 'apertura' CHECK (checklist_type IN ('apertura', 'cierre')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{task, done, photo_url?, completed_at?}]
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_hlc BIGINT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(tenant_id, user_id, date, checklist_type)
);

CREATE INDEX IF NOT EXISTS idx_team_checklists_tenant ON public.team_checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_checklists_date ON public.team_checklists(date DESC);
CREATE INDEX IF NOT EXISTS idx_team_checklists_user ON public.team_checklists(user_id);

SELECT attach_hlc_triggers('team_checklists');
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_checklists;

ALTER TABLE public.team_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_checklists_select" ON public.team_checklists
    FOR SELECT TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_tenants
                WHERE user_tenants.user_id = auth.uid()
                  AND user_tenants.tenant_id = team_checklists.tenant_id
                  AND user_tenants.role IN ('owner', 'admin')
                  AND user_tenants.active = true
            )
        )
    );

CREATE POLICY "team_checklists_insert" ON public.team_checklists
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.get_my_tenant_id()
        AND user_id = auth.uid()
    );

CREATE POLICY "team_checklists_update" ON public.team_checklists
    FOR UPDATE TO authenticated
    USING (
        tenant_id = public.get_my_tenant_id()
        AND user_id = auth.uid()
    )
    WITH CHECK (tenant_id = public.get_my_tenant_id());
