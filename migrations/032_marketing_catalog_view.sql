-- 032_marketing_catalog_view.sql
-- Vista del catálogo derivado de Eleventa para el Estudio de Marketing.
-- Cada producto distinto con el precio de su venta más reciente, conteo de ventas
-- y fecha de última venta. La fuente real del catálogo (~900 productos) son los
-- items de eleventa_sales, igual que en la app — NO la tabla products (que solo
-- tiene altas manuales).
--
-- Privacidad: la vista corre con privilegios del owner (salta RLS de eleventa_sales),
-- así que se REVOCA a anon/authenticated y solo la lee service_role. El Estudio es un
-- server local que usa la service key (server-side, nunca al cliente).

create or replace view public.marketing_catalog as
with li as (
  select
    trim(it->>'name')                              as name,
    (it->>'price')::numeric                         as price,
    s.date,
    row_number() over (
      partition by lower(trim(it->>'name'))
      order by s.date desc
    )                                               as rn,
    count(*)    over (partition by lower(trim(it->>'name'))) as times_sold
  from public.eleventa_sales s,
       lateral jsonb_array_elements(s.items) as it
  where s.items is not null
    and jsonb_typeof(s.items) = 'array'
    and s.deleted is not true
    and trim(it->>'name') <> ''
)
select
  name,
  price        as "salePrice",
  date::date   as last_sold,
  times_sold
from li
where rn = 1;

revoke all on public.marketing_catalog from anon, authenticated;
grant select on public.marketing_catalog to service_role;
