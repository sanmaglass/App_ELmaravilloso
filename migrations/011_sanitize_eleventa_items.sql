-- 011_sanitize_eleventa_items.sql
--
-- PROBLEMA QUE RESUELVE:
-- La ingesta desde Eleventa (Firebird → Supabase) ocasionalmente genera tickets
-- con items corruptos donde el campo "name" contiene un timestamp en vez del
-- nombre real del producto. Esto contamina el análisis ABC y otras métricas.
-- Ejemplo real: item con name="2026-05-30 17:44:33.4830" generó $3.3M falsos.
--
-- FIX:
-- Trigger BEFORE INSERT/UPDATE que filtra items cuyo nombre parece timestamp
-- (YYYY-MM-DD...) o está vacío/muy corto. Si todos los items de un ticket
-- son basura, se marca como deleted=true.
--
-- SEGURO DE CORRER VARIAS VECES: usa DROP IF EXISTS + CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION sanitize_eleventa_items()
RETURNS TRIGGER AS $$
DECLARE
    clean_items jsonb := '[]'::jsonb;
    item jsonb;
BEGIN
    IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items::jsonb) = 'array' THEN
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items::jsonb)
        LOOP
            IF (item->>'name') IS NOT NULL
               AND length(trim(item->>'name')) >= 2
               AND NOT (trim(item->>'name') ~ '^\d{4}-\d{2}-\d{2}') THEN
                clean_items := clean_items || jsonb_build_array(item);
            END IF;
        END LOOP;

        IF jsonb_array_length(clean_items) = 0 THEN
            NEW.deleted := true;
        END IF;

        NEW.items := clean_items;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_eleventa_items ON eleventa_sales;
CREATE TRIGGER trg_sanitize_eleventa_items
    BEFORE INSERT OR UPDATE ON eleventa_sales
    FOR EACH ROW
    EXECUTE FUNCTION sanitize_eleventa_items();
