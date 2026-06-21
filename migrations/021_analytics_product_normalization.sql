-- 021_analytics_product_normalization.sql
--
-- PROPÓSITO:
-- Sistema de normalización de nombres de productos para analytics.
-- Los productos llegan del POS Eleventa con variantes de escritura inconsistentes:
--   "MILO 1KG", "milo 1 kg", "MILO1KG", "COCA COLA 1.5L", "COCA-COLA 1.5 LT"
-- Este módulo agrupa variantes bajo un nombre canónico único.
--
-- COMPONENTES:
--   1. product_catalog      — catálogo canónico (un registro por producto real)
--   2. product_name_map     — mapeo raw_name → canonical_id
--   3. fn_normalize_product_name()  — limpia y normaliza un nombre crudo
--   4. fn_auto_populate_catalog()   — lee mv_sale_items y puebla ambas tablas
--
-- DEPENDENCIAS:
--   - Migración 020 (analytics.mv_sale_items debe existir)
--
-- USO TÍPICO (ejecutar manualmente después de correr la migración):
--   SELECT analytics.fn_auto_populate_catalog();
--
-- SEGURO DE CORRER VARIAS VECES: usa CREATE ... IF NOT EXISTS y OR REPLACE.

-- ─── Esquema de analytics (si no existe) ────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS analytics;

-- ─── 1. Tabla: product_catalog ───────────────────────────────────────────────
-- Catálogo canónico de productos. Un registro por producto real,
-- con su nombre limpio y categoría opcional.

CREATE TABLE IF NOT EXISTS analytics.product_catalog (
    id             SERIAL       PRIMARY KEY,
    canonical_name TEXT         UNIQUE NOT NULL,  -- nombre limpio, ej: "MILO 1KG"
    category       TEXT         DEFAULT NULL,     -- ej: "BEBIDAS", "SNACKS", "LÁCTEOS"
    created_at     TIMESTAMPTZ  DEFAULT now()
);

COMMENT ON TABLE  analytics.product_catalog               IS 'Catálogo canónico de productos. Un registro por producto real.';
COMMENT ON COLUMN analytics.product_catalog.canonical_name IS 'Nombre limpio y normalizado del producto (UPPER, sin espacios dobles, unidades estandarizadas).';
COMMENT ON COLUMN analytics.product_catalog.category       IS 'Categoría opcional: BEBIDAS, SNACKS, LÁCTEOS, etc. Se puede completar manualmente después.';

-- ─── 2. Tabla: product_name_map ──────────────────────────────────────────────
-- Mapeo de nombre crudo (tal como viene de Eleventa) → producto canónico.
-- Permite que múltiples variantes de escritura apunten al mismo producto.

CREATE TABLE IF NOT EXISTS analytics.product_name_map (
    id           SERIAL      PRIMARY KEY,
    raw_name     TEXT        UNIQUE NOT NULL,  -- nombre crudo UPPER+TRIM, ej: "MILO 1 KG"
    canonical_id INTEGER     NOT NULL REFERENCES analytics.product_catalog(id),
    auto_matched BOOLEAN     DEFAULT false,    -- true = match automático, false = revisado manualmente
    created_at   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  analytics.product_name_map               IS 'Mapeo de nombre crudo (Eleventa) → producto canónico. Permite agrupar variantes.';
COMMENT ON COLUMN analytics.product_name_map.raw_name      IS 'Nombre tal cual viene del POS Eleventa, convertido a UPPER+TRIM antes de insertar.';
COMMENT ON COLUMN analytics.product_name_map.auto_matched  IS 'true = agrupado automáticamente (raw normalizado == canonical). false = asignado manualmente.';

-- ─── Índices auxiliares ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_name_map_canonical_id
    ON analytics.product_name_map (canonical_id);

-- ─── 3. Función: fn_normalize_product_name ───────────────────────────────────
-- Normaliza un nombre crudo de producto aplicando:
--   - UPPER + TRIM
--   - Elimina espacios múltiples
--   - Quita caracteres especiales innecesarios (guiones, puntos entre palabras)
--   - Normaliza unidades de medida comunes
--
-- Ejemplos:
--   "milo 1 kg"      → "MILO 1KG"
--   "COCA-COLA 1.5 LT" → "COCA COLA 1.5L"
--   "ARROZ 500 GR"   → "ARROZ 500G"
--   "JUGO 1 UN"      → "JUGO 1UN"

CREATE OR REPLACE FUNCTION analytics.fn_normalize_product_name(p_raw_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_name TEXT;
BEGIN
    -- Paso 1: Nulo → devolver nulo directamente
    IF p_raw_name IS NULL THEN
        RETURN NULL;
    END IF;

    -- Paso 2: Convertir a mayúsculas y quitar espacios extremos
    v_name := UPPER(TRIM(p_raw_name));

    -- Paso 3: Reemplazar guiones entre palabras por espacio
    --   "COCA-COLA" → "COCA COLA"
    v_name := regexp_replace(v_name, '-', ' ', 'g');

    -- Paso 4: Eliminar puntos que no sean decimales
    --   "1.5" se mantiene, "PROD.ABC" → "PROD ABC"
    --   Estrategia: quitar punto si NO está flanqueado por dígitos en ambos lados
    v_name := regexp_replace(v_name, '\.(?!\d)|(?<!\d)\.', ' ', 'g');

    -- Paso 5: Normalizar unidades de peso/volumen/cantidad
    --   El patrón captura: número + espacio opcional + unidad
    --   " 1 KG"  → " 1KG"
    --   " 1.5 LT" → " 1.5L"   (también LITROS, LTS)
    --   " 500 GR" → " 500G"   (también GRS, GRAMOS)
    --   " 1 UN"  → " 1UN"    (también UND, UNS, UNIDADES)
    --   " 250 ML" → " 250ML"  (mililitros)
    --   " 1 CC"  → " 1CC"    (centímetros cúbicos / mililitros)

    -- Litros: LT / LTS / LITRO / LITROS → L
    v_name := regexp_replace(v_name, '(\d)\s+LTS?\b',      '\1L',   'g');
    v_name := regexp_replace(v_name, '(\d)\s+LITROS?\b',   '\1L',   'g');

    -- Kilogramos: KG / KGS / KILO / KILOS → KG
    v_name := regexp_replace(v_name, '(\d)\s+KGS?\b',      '\1KG',  'g');
    v_name := regexp_replace(v_name, '(\d)\s+KILOS?\b',    '\1KG',  'g');

    -- Gramos: GR / GRS / GRAMO / GRAMOS → G
    v_name := regexp_replace(v_name, '(\d)\s+GRS?\b',      '\1G',   'g');
    v_name := regexp_replace(v_name, '(\d)\s+GRAMOS?\b',   '\1G',   'g');

    -- Mililitros: ML / MLS → ML (sin espacio, pero ya se une)
    v_name := regexp_replace(v_name, '(\d)\s+MLS?\b',      '\1ML',  'g');

    -- Centímetros cúbicos: CC → ML (equivalentes)
    v_name := regexp_replace(v_name, '(\d)\s+CC\b',        '\1ML',  'g');

    -- Unidades: UN / UND / UNS / UNIDAD / UNIDADES → UN
    v_name := regexp_replace(v_name, '(\d)\s+UNDS?\b',     '\1UN',  'g');
    v_name := regexp_replace(v_name, '(\d)\s+UNIDADES?\b', '\1UN',  'g');
    v_name := regexp_replace(v_name, '(\d)\s+UN\b',        '\1UN',  'g');

    -- Paso 6: Colapsar múltiples espacios consecutivos en uno solo
    v_name := regexp_replace(v_name, '\s+', ' ', 'g');

    -- Paso 7: Trim final por si quedaron espacios en los bordes
    v_name := TRIM(v_name);

    RETURN v_name;
END;
$$;

COMMENT ON FUNCTION analytics.fn_normalize_product_name(TEXT) IS
'Normaliza un nombre crudo de producto: UPPER+TRIM, colapsa espacios, estandariza unidades (KG, G, L, ML, UN). Idempotente y IMMUTABLE.';

-- ─── 4. Función: fn_auto_populate_catalog ────────────────────────────────────
-- Lee todos los nombres de producto DISTINTOS de analytics.mv_sale_items,
-- normaliza cada uno y puebla product_catalog + product_name_map.
-- NO se ejecuta automáticamente — llamar manualmente cuando sea necesario.
--
-- Retorna: cantidad de productos canónicos nuevos insertados en esta ejecución.
--
-- Uso:
--   SELECT analytics.fn_auto_populate_catalog();
--   → INTEGER (productos nuevos en product_catalog)
--
-- Es seguro ejecutar múltiples veces: usa INSERT ... ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION analytics.fn_auto_populate_catalog()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_raw_name      TEXT;
    v_normalized    TEXT;
    v_canonical_id  INTEGER;
    v_new_count     INTEGER := 0;
BEGIN
    -- Iterar sobre todos los nombres distintos de la vista de items de ventas
    FOR v_raw_name IN
        SELECT DISTINCT product_name
        FROM analytics.mv_sale_items
        WHERE product_name IS NOT NULL
          AND length(product_name) >= 2
        ORDER BY product_name
    LOOP
        -- Normalizar el nombre crudo
        v_normalized := analytics.fn_normalize_product_name(v_raw_name);

        -- Ignorar si la normalización devuelve nulo o cadena vacía
        CONTINUE WHEN v_normalized IS NULL OR length(v_normalized) = 0;

        -- Insertar en product_catalog si el nombre canónico no existe todavía
        INSERT INTO analytics.product_catalog (canonical_name)
        VALUES (v_normalized)
        ON CONFLICT (canonical_name) DO NOTHING;

        -- Si insertó una fila nueva, incrementar el contador
        IF FOUND THEN
            v_new_count := v_new_count + 1;
        END IF;

        -- Obtener el id del canónico (existente o recién creado)
        SELECT id INTO v_canonical_id
        FROM analytics.product_catalog
        WHERE canonical_name = v_normalized;

        -- Insertar el mapeo raw → canonical si no existe
        -- raw_name: almacenar en UPPER+TRIM (como viene de mv_sale_items)
        INSERT INTO analytics.product_name_map (raw_name, canonical_id, auto_matched)
        VALUES (UPPER(TRIM(v_raw_name)), v_canonical_id, true)
        ON CONFLICT (raw_name) DO NOTHING;

    END LOOP;

    RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION analytics.fn_auto_populate_catalog() IS
'Puebla product_catalog y product_name_map desde analytics.mv_sale_items. Ejecutar manualmente después de cada sincronización masiva. Retorna cantidad de productos canónicos nuevos.';
