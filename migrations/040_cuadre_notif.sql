-- ──────────────────────────────────────────────────────────────
-- 040_cuadre_notif.sql
-- Idempotencia para el push de descuadre de caja (job=cuadre en api/notify.js).
--
-- Problema que resuelve: el aviso de "Caja descuadrada" se disparaba en CADA
-- guardado del cuadre y para CUALQUIER fecha seleccionada, así que:
--   - re-enviaba descuadres de días pasados ("llegó bugeada de ayer")
--   - repetía la alerta cada vez que se apretaba "Actualizar"
--
-- Con esta tabla, notify.js registra un aviso por (tenant_id, date) y no vuelve
-- a mandar push ese mismo día. Escribe solo la service-role (bypassa RLS).
-- ──────────────────────────────────────────────────────────────

create table if not exists public.cuadre_notif (
    tenant_id  uuid        not null references public.tenants(id) on delete cascade,
    date       date        not null,
    body       text,
    sent_at    timestamptz not null default now(),
    primary key (tenant_id, date)
);

alter table public.cuadre_notif enable row level security;

-- Lectura: solo admins/owners del propio tenant (por si se quiere inspeccionar).
-- Sin políticas de insert/update/delete → nadie salvo la service-role puede escribir.
drop policy if exists cuadre_notif_read on public.cuadre_notif;
create policy cuadre_notif_read on public.cuadre_notif
    for select to authenticated
    using (tenant_id = public.get_my_tenant_id());
