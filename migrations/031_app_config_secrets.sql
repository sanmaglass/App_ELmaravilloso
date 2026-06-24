-- 031_app_config_secrets
-- Tabla de configuración/secretos server-side. RLS activo SIN políticas:
-- solo la service-role (que bypassa RLS) puede leerla; anon/authenticated no.
-- Se usa para guardar MP_ACCESS_TOKEN cuando no está en las env vars de Vercel.
-- El valor del token se inserta por separado (NUNCA en el repo). Aplicada en prod
-- vía MCP el 2026-06-23.
create table if not exists public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
