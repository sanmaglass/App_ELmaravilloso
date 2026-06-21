-- 022_analytics_cross_selling.sql
--
-- PROPÓSITO:
-- Análisis de cross-selling (market basket analysis) para la distribuidora.
-- Responde preguntas como:
--   "¿Qué productos se compran juntos con más frecuencia?"
--   "El 45% de quienes compran MILO también compran PAN"
--
-- DEPENDENCIAS (deben existir antes de ejecutar esta migración):
--   - analytics.mv_sale_items      — vista materializada (migración 020)
--   - analytics.product_catalog       — tabla con id, canonical_name, category
--   - analytics.product_name_map      — tabla con raw_name, canonical_id
--   - public.fn_normalize_product_name(text) — función de normalización
--
-- SEGURO DE CORRER VARIAS VECES: usa DROP IF EXISTS antes de cada CREATE.

-- ─── Esquema (por si no existe aún) ─────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS analytics;


-- ════════════════════════════════════════════════════════════════════════════
-- 1. MATERIALIZED VIEW: mv_cross_selling
--    Pares de productos comprados en el mismo ticket (market basket pairs).
--    Solo incluye pares con al menos 3 co-ocurrencias para filtrar ruido.
-- ════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_cross_selling;

CREATE MATERIALIZED VIEW analytics.mv_cross_selling AS
WITH
-- Resolver nombre canónico: si existe en el mapa de nombres, usar canonical_name
-- de product_catalog; si no, usar el product_name directo de mv_sale_items.
items_normalizados AS (
    SELECT
        si.sale_id,
        si.ticket_id,
        si.tenant_id,
        si.line_total,
        COALESCE(pc.canonical_name, si.product_name) AS nombre_producto
    FROM analytics.mv_sale_items AS si
    LEFT JOIN analytics.product_name_map AS pnm
        ON pnm.raw_name = si.product_name
    LEFT JOIN analytics.product_catalog AS pc
        ON pc.id = pnm.canonical_id
),

-- Self-join por sale_id: empareja cada producto con todos los demás del mismo ticket.
-- La condición a.nombre_producto < b.nombre_producto evita duplicados y auto-pares.
pares_por_ticket AS (
    SELECT
        a.sale_id,
        a.nombre_producto AS product_a,
        b.nombre_producto AS product_b
    FROM items_normalizados AS a
    JOIN items_normalizados AS b
        ON  a.sale_id          = b.sale_id
        AND a.nombre_producto  < b.nombre_producto
)

SELECT
    product_a,
    product_b,
    COUNT(*)::integer                             AS pair_count,
    -- Ticket promedio de las ventas en que apareció este par
    AVG(t.ticket_total)::numeric(12,2)            AS avg_ticket
FROM pares_por_ticket AS p
-- Ticket total: suma de line_total de todos los ítems del mismo sale_id
JOIN (
    SELECT sale_id, SUM(line_total) AS ticket_total
    FROM analytics.mv_sale_items
    GROUP BY sale_id
) AS t ON t.sale_id = p.sale_id
GROUP BY product_a, product_b
HAVING COUNT(*) >= 3   -- Filtrar pares con muy pocas co-ocurrencias (ruido)
;

-- ─── Índices mv_cross_selling ────────────────────────────────────────────────

-- UNIQUE requerido para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_cross_selling_unique
    ON analytics.mv_cross_selling (product_a, product_b);

-- Búsqueda rápida de pares que involucran un producto específico
CREATE INDEX idx_mv_cross_selling_product_a
    ON analytics.mv_cross_selling (product_a);

CREATE INDEX idx_mv_cross_selling_product_b
    ON analytics.mv_cross_selling (product_b);

-- Ordenar por pares más frecuentes (uso principal en dashboards)
CREATE INDEX idx_mv_cross_selling_pair_count
    ON analytics.mv_cross_selling (pair_count DESC);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. MATERIALIZED VIEW: mv_product_stats
--    Resumen de desempeño por producto: volumen, revenue, márgenes, frecuencia.
-- ════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_product_stats;

CREATE MATERIALIZED VIEW analytics.mv_product_stats AS
WITH items_normalizados AS (
    -- Mismo CTE de resolución canónica que en mv_cross_selling
    SELECT
        si.sale_id,
        si.ticket_id,
        si.sale_date,
        si.qty,
        si.unit_price,
        si.line_total,
        si.line_profit,
        COALESCE(pc.canonical_name, si.product_name) AS product_name
    FROM analytics.mv_sale_items AS si
    LEFT JOIN analytics.product_name_map AS pnm
        ON pnm.raw_name = si.product_name
    LEFT JOIN analytics.product_catalog AS pc
        ON pc.id = pnm.canonical_id
)

SELECT
    product_name,
    SUM(qty)::numeric(14,4)                       AS total_qty,
    SUM(line_total)::numeric(14,2)                AS total_revenue,
    SUM(line_profit)::numeric(14,2)               AS total_profit,
    COUNT(DISTINCT ticket_id)::integer            AS ticket_count,
    -- Cantidad promedio por ticket en que apareció
    (SUM(qty) / NULLIF(COUNT(DISTINCT ticket_id), 0))::numeric(10,4)
                                                  AS avg_qty_per_ticket,
    -- Precio promedio ponderado por unidad vendida
    (SUM(line_total) / NULLIF(SUM(qty), 0))::numeric(12,4)
                                                  AS avg_price,
    MIN(sale_date)::date                          AS first_seen,
    MAX(sale_date)::date                          AS last_seen
FROM items_normalizados
GROUP BY product_name
;

-- ─── Índices mv_product_stats ────────────────────────────────────────────────

-- UNIQUE requerido para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_product_stats_unique
    ON analytics.mv_product_stats (product_name);

-- Búsqueda directa por nombre
CREATE INDEX idx_mv_product_stats_product_name
    ON analytics.mv_product_stats (product_name);

-- Top productos por revenue (uso más común en dashboards ABC)
CREATE INDEX idx_mv_product_stats_total_revenue
    ON analytics.mv_product_stats (total_revenue DESC);


-- ════════════════════════════════════════════════════════════════════════════
-- 3. FUNCIÓN: fn_refresh_analytics()
--    Refresca todas las vistas materializadas de analytics en el orden correcto.
--    Retorna un TEXT con resumen del refresh ejecutado.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS analytics.fn_refresh_analytics();

CREATE OR REPLACE FUNCTION analytics.fn_refresh_analytics()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inicio   TIMESTAMPTZ := clock_timestamp();
    v_paso     TIMESTAMPTZ;
    v_resumen  TEXT        := '';
BEGIN
    -- 1. Refrescar mv_sale_items primero (es la fuente de las demás)
    v_paso := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_sale_items;
    v_resumen := v_resumen
        || 'mv_sale_items: OK ('
        || round(extract(milliseconds FROM clock_timestamp() - v_paso))::text
        || ' ms)' || E'\n';

    -- 2. Refrescar mv_cross_selling (depende de mv_sale_items)
    v_paso := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_cross_selling;
    v_resumen := v_resumen
        || 'mv_cross_selling: OK ('
        || round(extract(milliseconds FROM clock_timestamp() - v_paso))::text
        || ' ms)' || E'\n';

    -- 3. Refrescar mv_product_stats (depende de mv_sale_items)
    v_paso := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_product_stats;
    v_resumen := v_resumen
        || 'mv_product_stats: OK ('
        || round(extract(milliseconds FROM clock_timestamp() - v_paso))::text
        || ' ms)' || E'\n';

    v_resumen := v_resumen
        || 'Total: '
        || round(extract(milliseconds FROM clock_timestamp() - v_inicio))::text
        || ' ms';

    RETURN v_resumen;

EXCEPTION
    WHEN OTHERS THEN
        -- Retornar el error sin relanzar para no romper crons
        RETURN 'ERROR en fn_refresh_analytics: ' || SQLERRM;
END;
$$;

COMMENT ON FUNCTION analytics.fn_refresh_analytics() IS
    'Refresca en orden mv_sale_items → mv_cross_selling → mv_product_stats. '
    'Retorna resumen de tiempos por vista. Seguro para llamar desde cron.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. VISTA SIMPLE: vw_top_pairs
--    Los 50 pares más frecuentes con porcentaje de co-ocurrencia.
--    Responde: "El 45% de quienes compran MILO también compran PAN"
-- ════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS analytics.vw_top_pairs;

CREATE VIEW analytics.vw_top_pairs AS
SELECT
    cs.product_a,
    cs.product_b,
    cs.pair_count,

    -- pct_a: % de tickets de product_a que también contienen product_b
    -- = co-ocurrencias / total tickets de product_a
    round(
        (cs.pair_count::numeric / NULLIF(stats_a.ticket_count, 0)) * 100,
        1
    ) AS pct_a,

    -- pct_b: % de tickets de product_b que también contienen product_a
    round(
        (cs.pair_count::numeric / NULLIF(stats_b.ticket_count, 0)) * 100,
        1
    ) AS pct_b

FROM analytics.mv_cross_selling AS cs

-- Frecuencia individual de product_a (denominador de pct_a)
LEFT JOIN analytics.mv_product_stats AS stats_a
    ON stats_a.product_name = cs.product_a

-- Frecuencia individual de product_b (denominador de pct_b)
LEFT JOIN analytics.mv_product_stats AS stats_b
    ON stats_b.product_name = cs.product_b

ORDER BY cs.pair_count DESC
LIMIT 50
;

COMMENT ON VIEW analytics.vw_top_pairs IS
    'Top 50 pares de productos comprados juntos con frecuencia. '
    'pct_a = % de tickets de product_a que llevan product_b, y viceversa. '
    'Ejemplo: pct_a=45 significa "el 45% de quienes compran X también compran Y".';


-- ─── Primer populate ─────────────────────────────────────────────────────────
-- Carga inicial. En adelante llamar analytics.fn_refresh_analytics() desde cron.
REFRESH MATERIALIZED VIEW analytics.mv_cross_selling;
REFRESH MATERIALIZED VIEW analytics.mv_product_stats;
