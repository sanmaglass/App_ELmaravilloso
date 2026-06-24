-- 033_team_tables_updated_by_device
-- Mismo bug que announcements (migr 032): el outbox del cliente manda
-- updated_by_device en el payload, pero estas tablas con id uuid no tenían la
-- columna → el push fallaba (PGRST204) y los reportes/checklists de la cajera no
-- sincronizaban. El fix de coerción de id (db.js, preservar UUID) ya está desplegado.
-- Aplicada en prod vía MCP el 2026-06-24.
alter table public.team_reports add column if not exists updated_by_device text;
alter table public.team_checklists add column if not exists updated_by_device text;
alter table public.checklist_templates add column if not exists updated_by_device text;
