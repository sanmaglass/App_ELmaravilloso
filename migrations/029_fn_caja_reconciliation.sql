-- 029_fn_caja_reconciliation
-- Totales del día para el cuadre de caja, calculados server-side con la zona
-- America/Santiago (misma lógica que la vista Caja del Día). Lo usa el endpoint
-- /api/mp-cuadre para cruzar las ventas de Eleventa contra Mercado Pago.
-- Devuelve ventas Eleventa por forma de pago + fondo + gastos + cuadre del día.
-- Aplicada en prod vía MCP el 2026-06-23.

create or replace function fn_caja_reconciliation(p_date date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'date', p_date,
    'eleventa', (
      select coalesce(json_object_agg(forma_pago, monto), '{}'::json)
      from (
        select coalesce(nullif(forma_pago,''),'Efectivo') as forma_pago,
               sum(total)::bigint as monto
        from eleventa_sales
        where deleted is not true
          and (total)::numeric > 0
          and (date at time zone 'America/Santiago')::date = p_date
        group by 1
      ) e
    ),
    'tickets', (
      select count(*) from eleventa_sales
      where deleted is not true and (total)::numeric > 0
        and (date at time zone 'America/Santiago')::date = p_date
    ),
    'fondo', (select coalesce(sum(amount),0)::bigint from cash_register
              where deleted is not true and date = p_date::text and type='fondo_apertura'),
    'gastos', (select coalesce(sum(abs(amount)),0)::bigint from cash_register
               where deleted is not true and date = p_date::text and type='gasto_caja'),
    'cuadre', (select to_json(c) from (
        select amount::bigint as contado, notes
        from cash_register
        where deleted is not true and date = p_date::text and type='cuadre'
        order by id desc limit 1
      ) c)
  );
$$;

grant execute on function fn_caja_reconciliation(date) to authenticated, service_role, anon;
