-- 032_announcements_updated_by_device
-- El outbox del cliente envía updated_by_device en el payload, pero estas tablas
-- no tenían la columna → el push fallaba (PGRST204) y los avisos/lecturas nunca
-- subían a la nube (la cajera no los veía; al reponerlos se duplicaban localmente).
-- Aplicada en prod vía MCP el 2026-06-24.
alter table public.announcements add column if not exists updated_by_device text;
alter table public.announcement_reads add column if not exists updated_by_device text;
