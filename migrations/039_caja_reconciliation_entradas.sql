-- 039_caja_reconciliation_entradas
-- fn_caja_reconciliation: incluir TAMBIÉN las entradas de efectivo de Eleventa.
-- El cajón es uno solo: fondo + ventas + entradas − salidas − gastos = esperado.
-- Las entradas (efectivo que se agrega al cajón, ej. sencillo cuando falta cambio)
-- suman al efectivo esperado, igual que las salidas restan.
CREATE OR REPLACE FUNCTION public.fn_caja_reconciliation(p_date date)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'fondo', (select coalesce(amount,0)::bigint from cash_register
              where deleted is not true and date = p_date::text and type='fondo_apertura'
              order by id desc limit 1),
    'gastos', (select coalesce(sum(abs(amount)),0)::bigint from cash_register
               where deleted is not true and date = p_date::text and type='gasto_caja'),
    'salidas', (select coalesce(sum(abs(monto)),0)::bigint from eleventa_flujo_caja
                where lower(tipo)='salida'
                  and (fecha at time zone 'America/Santiago')::date = p_date),
    'entradas', (select coalesce(sum(abs(monto)),0)::bigint from eleventa_flujo_caja
                 where lower(tipo)='entrada'
                   and (fecha at time zone 'America/Santiago')::date = p_date),
    'cuadre', (select to_json(c) from (
        select amount::bigint as contado, notes
        from cash_register
        where deleted is not true and date = p_date::text and type='cuadre'
        order by id desc limit 1
      ) c)
  );
$function$;
