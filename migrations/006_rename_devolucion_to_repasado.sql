-- Migración: Renombrar tipo 'devolucion' a 'repasado' en eleventa_flujo_caja
-- Los registros marcados como devolución en Eleventa son en realidad tickets
-- cancelados y repasados en otra forma de pago, no devoluciones reales.

UPDATE eleventa_flujo_caja
SET tipo = 'repasado'
WHERE lower(tipo) IN ('devolucion', 'devolución');
