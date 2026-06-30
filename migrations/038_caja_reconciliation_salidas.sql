-- 038_caja_reconciliation_salidas
-- fn_caja_reconciliation: incluir salidas de efectivo de Eleventa (eleventa_flujo_caja).
-- Antes el servidor solo restaba 'gasto_caja' de cash_register y NO las salidas que
-- Eleventa sincroniza (PAGO FACTURA, etc.), inflando el efectivo esperado y disparando
-- falsos descuadres en el push "Caja descuadrada". La app local (caja_dia.js) ya las
-- resta; esto alinea el servidor con lo que ve la cajera.
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
    'cuadre', (select to_json(c) from (
        select amount::bigint as contado, notes
        from cash_register
        where deleted is not true and date = p_date::text and type='cuadre'
        order by id desc limit 1
      ) c)
  );
$function$;
