-- 020_analytics_sale_items_flat.sql
--
-- PROPÓSITO:
-- Crea una MATERIALIZED VIEW que "aplana" el array JSONB de items dentro de
-- eleventa_sales, generando una fila por producto por ticket. Esto permite
-- consultas analíticas eficientes (ABC de productos, top ventas, márgenes)
-- sin tener que desanidar JSON en cada query.
--
-- ORIGEN: eleventa_sales.items  →  array JSONB con {name, qty, price, profit}
-- DESTINO: mv_sale_items  →  una fila por item limpio
--
-- FILTROS APLICADOS:
--   - deleted = false  (excluye tickets anulados)
--   - nombre < 2 chars  (excluye items vacíos o corruptos)
--   - nombre que parece timestamp (YYYY-MM-DD...)  →  basura del POS Eleventa
--
-- REFRESH: ejecutar periódicamente o después de cada sincronización masiva.
--   REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_sale_items;
--
-- SEGURO DE CORRER VARIAS VECES: usa DROP IF EXISTS antes del CREATE.

-- ─── Esquema de analytics (si no existe) ────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS analytics;

-- ─── Drop + Create ───────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_sale_items;

CREATE MATERIALIZED VIEW analytics.mv_sale_items AS
SELECT
    -- Identificadores de la venta
    s.id                                        AS sale_id,
    s.ticket_id,
    s.date                                      AS sale_date,
    s.tenant_id,

    -- Posición del item dentro del array (base-1), necesario para UNIQUE INDEX
    (item_row.ord)::integer                     AS item_ord,

    -- Nombre normalizado del producto
    UPPER(TRIM(item_row.item ->> 'name'))       AS product_name,

    -- Cantidades y precios
    (item_row.item ->> 'qty')::numeric          AS qty,
    (item_row.item ->> 'price')::numeric        AS unit_price,
    (item_row.item ->> 'profit')::numeric       AS unit_profit,

    -- Totales por línea
    (item_row.item ->> 'qty')::numeric
        * (item_row.item ->> 'price')::numeric  AS line_total,
    (item_row.item ->> 'qty')::numeric
        * (item_row.item ->> 'profit')::numeric AS line_profit

FROM eleventa_sales AS s
-- Desanidar el array JSONB con WITH ORDINALITY para conservar el índice
CROSS JOIN LATERAL jsonb_array_elements(s.items) WITH ORDINALITY
    AS item_row(item, ord)

WHERE
    -- Solo tickets activos
    s.deleted = false

    -- Nombre debe existir y tener al menos 2 caracteres
    AND (item_row.item ->> 'name') IS NOT NULL
    AND length(trim(item_row.item ->> 'name')) >= 2

    -- Excluir items cuyo nombre parece un timestamp (basura del POS Eleventa)
    -- Ejemplo real capturado: "2026-05-30 17:44:33.4830"
    AND NOT (trim(item_row.item ->> 'name') ~ '^\d{4}-\d{2}-\d{2}')
;

-- ─── Índices ─────────────────────────────────────────────────────────────────

-- UNIQUE: requerido para poder hacer REFRESH CONCURRENTLY sin bloquear lectura.
-- La combinación sale_id + item_ord identifica unívocamente cada fila.
CREATE UNIQUE INDEX idx_mv_sale_items_unique
    ON analytics.mv_sale_items (sale_id, item_ord);

-- Búsquedas y agrupaciones por nombre de producto (ABC, top-sellers, etc.)
CREATE INDEX idx_mv_sale_items_product_name
    ON analytics.mv_sale_items (product_name);

-- Filtros y rangos de fecha
CREATE INDEX idx_mv_sale_items_sale_date
    ON analytics.mv_sale_items (sale_date);

-- Aislamiento multi-tenant
CREATE INDEX idx_mv_sale_items_tenant_id
    ON analytics.mv_sale_items (tenant_id);

-- Índice compuesto tenant + fecha: el más común en consultas analíticas reales
CREATE INDEX idx_mv_sale_items_tenant_date
    ON analytics.mv_sale_items (tenant_id, sale_date);

-- ─── Primer populate ─────────────────────────────────────────────────────────
-- Carga inicial de datos. En adelante usar CONCURRENTLY para no bloquear.
REFRESH MATERIALIZED VIEW analytics.mv_sale_items;
