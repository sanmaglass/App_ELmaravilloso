-- 034_facturas_storage_bucket
-- Bucket privado para las fotos de facturas que sube la cajera, + policies para
-- que cualquier usuario autenticado de la org pueda subir y leer.
-- Aplicada en prod vía MCP el 2026-06-24.
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

create policy "facturas_insert_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'facturas');
create policy "facturas_select_auth" on storage.objects
  for select to authenticated using (bucket_id = 'facturas');
