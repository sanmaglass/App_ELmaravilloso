-- 004_hlc_skip_noop_updates.sql
--
-- PROBLEMA QUE RESUELVE:
-- El trigger hlc_on_update de la migración 003 bumpeaba updated_at_hlc
-- en CUALQUIER UPDATE, incluso cuando los valores nuevos eran idénticos
-- a los viejos. Efecto: la ingesta externa de Eleventa, que hace UPSERT
-- de los últimos N tickets cada ~90s para mantener la tabla al día, tocaba
-- ~125 filas por ciclo con valores idénticos. Postgres igual ejecuta el
-- UPDATE en un UPSERT ON CONFLICT DO UPDATE, el trigger bumpeaba HLC,
-- Realtime pusheaba los 125 eventos a todos los clientes, cada cliente
-- hacía 125 writes no-op a IndexedDB y 125 re-renders debounceados.
--
-- FIX:
-- Si NEW IS NOT DISTINCT FROM OLD (comparación fila-entera, NULL-safe),
-- retornar OLD sin tocar nada. Postgres entiende que no hubo cambios y
-- el UPDATE se convierte en no-op: sin bump de HLC, sin evento Realtime,
-- sin ruido en la red.
--
-- SEGURO DE CORRER VARIAS VECES: CREATE OR REPLACE FUNCTION.

CREATE OR REPLACE FUNCTION hlc_on_update() RETURNS TRIGGER AS $$
DECLARE
  now_ms BIGINT := (extract(epoch from now()) * 1000)::bigint;
BEGIN
  -- Guard contra UPSERTs idempotentes: si nada cambió, salir sin tocar HLC.
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN OLD;
  END IF;

  NEW.updated_at_hlc := GREATEST(COALESCE(OLD.updated_at_hlc, 0) + 1, now_ms);
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
