-- 037_cash_register_hlc_triggers.sql
-- BUG: el fondo de apertura (y cuadres/gastos) de la cajera "desaparecía" ($0) al
-- reiniciar la app. Causa raíz: cash_register era la ÚNICA tabla sincronizada SIN
-- los triggers HLC, y además le faltaba la columna `version` que esos triggers usan.
-- Resultado: sus registros quedaban con updated_at_hlc = NULL, y el pull incremental
-- (cursor por updated_at_hlc) los ignoraba → nunca volvían a bajar de la nube al
-- dispositivo. También causaba duplicados al re-registrar el fondo.
--
-- Fix:
--   (1) agregar la columna `version` (las otras 19 tablas HLC ya la tienen),
--   (2) agregar los triggers HLC insert/update (idénticos a las demás tablas),
--   (3) backfill: forzar un cambio real para que el trigger asigne HLC + version
--       a los registros existentes (el trigger ignora updates no-op).
--
-- ORDEN IMPORTANTE: la columna debe existir ANTES de crear los triggers, porque
-- hlc_on_insert/hlc_on_update asignan NEW.version.

-- (1) Columna version (las funciones hlc_on_insert/update hacen NEW.version := ...)
ALTER TABLE cash_register ADD COLUMN IF NOT EXISTS version bigint;

-- (2) Triggers HLC (idénticos a las otras tablas sincronizadas)
CREATE TRIGGER insert_hlc_cash_register BEFORE INSERT ON public.cash_register
  FOR EACH ROW EXECUTE FUNCTION hlc_on_insert();
CREATE TRIGGER update_hlc_cash_register BEFORE UPDATE ON public.cash_register
  FOR EACH ROW EXECUTE FUNCTION hlc_on_update();

-- (3) Backfill: hlc_on_update ignora updates no-op (NEW IS NOT DISTINCT FROM OLD),
--     por eso se cambia el valor a 1; el trigger lo eleva a now_hlc y setea version.
UPDATE cash_register SET updated_at_hlc = 1 WHERE updated_at_hlc IS NULL OR version IS NULL;
