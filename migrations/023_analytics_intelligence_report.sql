-- 023_analytics_intelligence_report.sql
--
-- PROPÓSITO:
-- Función CORAZÓN del módulo de inteligencia de El Maravilloso.
-- Retorna un JSONB completo con 12 secciones de análisis para la distribuidora.
-- Hace pocas pasadas sobre los datos usando CTEs que se calculan una sola vez.
--
-- DEPENDENCIAS (deben existir antes de ejecutar):
--   - eleventa_sales               — tabla principal de tickets
--   - analytics.mv_sale_items      — vista materializada de items aplanados (migración 020)
--   - analytics.mv_cross_selling   — pares de productos (migración 022)
--   - analytics.mv_product_stats   — stats por producto (migración 022)
--   - analytics.vw_top_pairs       — top 50 pares con pct_a / pct_b (migración 022)
--
-- TIMEZONE: Todos los cálculos de fecha usan hora local de Chile (America/Santiago).
--
-- SEGURO DE CORRER VARIAS VECES: usa CREATE OR REPLACE.

CREATE SCHEMA IF NOT EXISTS analytics;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCIÓN PRINCIPAL: analytics.fn_intelligence_report()
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION analytics.fn_intelligence_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Fechas en hora local de Chile
    v_ahora           TIMESTAMPTZ := now() AT TIME ZONE 'America/Santiago';
    v_hoy             DATE        := (now() AT TIME ZONE 'America/Santiago')::date;
    v_ayer            DATE        := v_hoy - INTERVAL '1 day';

    -- Límites de períodos
    v_inicio_mes      DATE        := date_trunc('month', v_hoy)::date;
    v_dias_mes        INTEGER     := EXTRACT(day FROM (v_inicio_mes + INTERVAL '1 month - 1 day'))::integer;
    v_dias_transcurridos INTEGER  := (v_hoy - v_inicio_mes)::integer;  -- días completos ya pasados
    v_dias_restantes  INTEGER;

    -- Variables para cálculos intermedios
    v_venta_ayer      BIGINT      := 0;
    v_ganancia_ayer   BIGINT      := 0;
    v_tickets_ayer    INTEGER     := 0;
    v_promedio_30d    BIGINT      := 0;

    v_venta_mes       BIGINT      := 0;
    v_ganancia_mes    BIGINT      := 0;
    v_tickets_mes     INTEGER     := 0;
    v_proyeccion      BIGINT      := 0;
    v_meta_diaria     BIGINT      := 0;

    v_margen_7d       NUMERIC     := 0;
    v_margen_7d_ant   NUMERIC     := 0;
    v_ganancia_7d     BIGINT      := 0;

    v_venta_hoy       BIGINT      := 0;

    v_venta_semana    BIGINT      := 0;
    v_ganancia_semana BIGINT      := 0;
    v_venta_sem_ant   BIGINT      := 0;
    v_ganancia_sem_ant BIGINT     := 0;

    v_tip             TEXT        := '';

    -- Resultado final
    v_resultado       JSONB;

    -- Variables auxiliares para el tip
    v_pct_tickets_1item  NUMERIC  := 0;
    v_par_top_pct_a      NUMERIC  := 0;
    v_par_top_a          TEXT     := '';
    v_par_top_b          TEXT     := '';
    v_prod_margen_alto   TEXT     := '';
    v_dia_fuerte         TEXT     := '';

BEGIN
    -- ─── Validar días transcurridos (evitar división por cero en primer día del mes) ─
    IF v_dias_transcurridos < 1 THEN
        v_dias_transcurridos := 1;
    END IF;
    v_dias_restantes := v_dias_mes - (v_hoy - v_inicio_mes)::integer;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- BLOQUE 1: Pulso ayer y promedio 30 días
    -- Una sola consulta sobre eleventa_sales filtrando por rango de fechas
    -- ═══════════════════════════════════════════════════════════════════════════
    SELECT
        COALESCE(SUM(CASE WHEN (date AT TIME ZONE 'America/Santiago')::date = v_ayer THEN total ELSE 0 END), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT CASE WHEN (date AT TIME ZONE 'America/Santiago')::date = v_ayer THEN id END), 0)::INTEGER,
        COALESCE(
            CASE
                WHEN COUNT(DISTINCT (date AT TIME ZONE 'America/Santiago')::date) > 0
                THEN SUM(CASE WHEN (date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 30 AND v_ayer THEN total ELSE 0 END)
                     / NULLIF(COUNT(DISTINCT CASE WHEN (date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 30 AND v_ayer THEN (date AT TIME ZONE 'America/Santiago')::date END), 0)
                ELSE 0
            END, 0
        )::BIGINT
    INTO v_venta_ayer, v_tickets_ayer, v_promedio_30d
    FROM eleventa_sales
    WHERE deleted = false
      AND date >= (v_hoy - INTERVAL '30 days') AT TIME ZONE 'America/Santiago';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- BLOQUE 2: Ganancia ayer y datos del mes — usando mv_sale_items (tiene profit)
    -- ═══════════════════════════════════════════════════════════════════════════
    SELECT
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date = v_ayer THEN line_profit ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date >= v_inicio_mes AND (sale_date AT TIME ZONE 'America/Santiago')::date < v_hoy THEN line_total ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date >= v_inicio_mes AND (sale_date AT TIME ZONE 'America/Santiago')::date < v_hoy THEN line_profit ELSE 0 END), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date >= v_inicio_mes AND (sale_date AT TIME ZONE 'America/Santiago')::date < v_hoy THEN ticket_id END), 0)::INTEGER
    INTO v_ganancia_ayer, v_venta_mes, v_ganancia_mes, v_tickets_mes
    FROM analytics.mv_sale_items
    WHERE sale_date >= v_inicio_mes AT TIME ZONE 'America/Santiago'
       OR (sale_date AT TIME ZONE 'America/Santiago')::date = v_ayer;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- BLOQUE 3: Ventas de hoy (puede ser 0 si es temprano)
    -- ═══════════════════════════════════════════════════════════════════════════
    SELECT
        COALESCE(SUM(line_total), 0)::BIGINT
    INTO v_venta_hoy
    FROM analytics.mv_sale_items
    WHERE (sale_date AT TIME ZONE 'America/Santiago')::date = v_hoy;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- BLOQUE 4: Márgenes 7d vs 7d anteriores
    -- ═══════════════════════════════════════════════════════════════════════════
    SELECT
        -- Margen últimos 7 días
        COALESCE(
            ROUND(
                SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer THEN line_profit ELSE 0 END)
                / NULLIF(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer THEN line_total ELSE 0 END), 0) * 100,
                1
            ), 0
        ),
        -- Ganancia últimos 7 días
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer THEN line_profit ELSE 0 END), 0)::BIGINT,
        -- Margen 7 días anteriores (7-14 días atrás)
        COALESCE(
            ROUND(
                SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 14 AND v_hoy - 8 THEN line_profit ELSE 0 END)
                / NULLIF(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 14 AND v_hoy - 8 THEN line_total ELSE 0 END), 0) * 100,
                1
            ), 0
        )
    INTO v_margen_7d, v_ganancia_7d, v_margen_7d_ant
    FROM analytics.mv_sale_items
    WHERE sale_date >= (v_hoy - INTERVAL '14 days') AT TIME ZONE 'America/Santiago'
      AND (sale_date AT TIME ZONE 'America/Santiago')::date < v_hoy;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- BLOQUE 5: Comparación semanal
    -- Esta semana = lunes de esta semana hasta ayer
    -- Semana anterior = lunes anterior al anterior hasta el domingo pasado
    -- ═══════════════════════════════════════════════════════════════════════════
    SELECT
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN date_trunc('week', v_hoy::timestamptz)::date AND v_ayer THEN line_total ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN date_trunc('week', v_hoy::timestamptz)::date AND v_ayer THEN line_profit ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN date_trunc('week', v_hoy::timestamptz - INTERVAL '7 days')::date AND date_trunc('week', v_hoy::timestamptz)::date - 1 THEN line_total ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN date_trunc('week', v_hoy::timestamptz - INTERVAL '7 days')::date AND date_trunc('week', v_hoy::timestamptz)::date - 1 THEN line_profit ELSE 0 END), 0)::BIGINT
    INTO v_venta_semana, v_ganancia_semana, v_venta_sem_ant, v_ganancia_sem_ant
    FROM analytics.mv_sale_items
    WHERE sale_date >= (date_trunc('week', v_hoy::timestamptz - INTERVAL '7 days')) AT TIME ZONE 'America/Santiago';

    -- ═══════════════════════════════════════════════════════════════════════════
    -- CÁLCULOS DERIVADOS
    -- ═══════════════════════════════════════════════════════════════════════════

    -- Proyección de cierre del mes
    v_proyeccion := CASE
        WHEN v_dias_transcurridos > 0
        THEN (v_venta_mes::NUMERIC / v_dias_transcurridos * v_dias_mes)::BIGINT
        ELSE 0
    END;

    -- Meta diaria = venta acumulada / días transcurridos (ritmo real)
    v_meta_diaria := CASE
        WHEN v_dias_transcurridos > 0
        THEN (v_venta_mes::NUMERIC / v_dias_transcurridos)::BIGINT
        ELSE 0
    END;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- TIP DEL DÍA — Calcular el más relevante con datos reales
    -- ═══════════════════════════════════════════════════════════════════════════

    -- ¿Qué % de tickets son de 1 solo item? (últimos 7 días)
    SELECT
        COALESCE(
            ROUND(
                COUNT(DISTINCT CASE WHEN item_count = 1 THEN ticket_id END)::NUMERIC
                / NULLIF(COUNT(DISTINCT ticket_id), 0) * 100,
                1
            ), 0
        )
    INTO v_pct_tickets_1item
    FROM (
        SELECT ticket_id, COUNT(*) AS item_count
        FROM analytics.mv_sale_items
        WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer
        GROUP BY ticket_id
    ) sub;

    -- ¿Existe un par con alta co-ocurrencia?
    SELECT COALESCE(pct_a, 0), product_a, product_b
    INTO v_par_top_pct_a, v_par_top_a, v_par_top_b
    FROM analytics.vw_top_pairs
    ORDER BY pct_a DESC NULLS LAST
    LIMIT 1;

    -- ¿Producto con margen alto (> 30%) y pocos tickets en últimos 7d?
    SELECT COALESCE(product_name, '')
    INTO v_prod_margen_alto
    FROM analytics.mv_sale_items
    WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer
    GROUP BY product_name
    HAVING COUNT(DISTINCT ticket_id) < 5
       AND ROUND(SUM(line_profit) / NULLIF(SUM(line_total), 0) * 100, 1) > 30
       AND SUM(line_total) > 0
    ORDER BY SUM(line_profit) / NULLIF(SUM(line_total), 0) DESC
    LIMIT 1;

    -- ¿Qué día de la semana es consistentemente el más fuerte? (últimas 8 semanas)
    SELECT
        CASE dow
            WHEN 0 THEN 'domingo'
            WHEN 1 THEN 'lunes'
            WHEN 2 THEN 'martes'
            WHEN 3 THEN 'miércoles'
            WHEN 4 THEN 'jueves'
            WHEN 5 THEN 'viernes'
            WHEN 6 THEN 'sábado'
        END
    INTO v_dia_fuerte
    FROM (
        SELECT
            EXTRACT(dow FROM (sale_date AT TIME ZONE 'America/Santiago'))::integer AS dow,
            AVG(SUM(line_total)) OVER (PARTITION BY EXTRACT(dow FROM (sale_date AT TIME ZONE 'America/Santiago'))::integer) AS avg_por_dia
        FROM analytics.mv_sale_items
        WHERE sale_date >= (v_hoy - INTERVAL '56 days') AT TIME ZONE 'America/Santiago'
        GROUP BY (sale_date AT TIME ZONE 'America/Santiago')::date,
                 EXTRACT(dow FROM (sale_date AT TIME ZONE 'America/Santiago'))::integer
    ) sub
    ORDER BY avg_por_dia DESC
    LIMIT 1;

    -- Elegir el tip más relevante (orden de prioridad)
    IF v_pct_tickets_1item > 45 THEN
        v_tip := 'Luis, el ' || v_pct_tickets_1item::TEXT || '% de los tickets de esta semana fueron de un solo producto. '
              || 'Pon los snacks o bebidas más baratas cerca de la caja — hay mucha oportunidad de venta adicional.';
    ELSIF v_par_top_pct_a >= 30 AND v_par_top_a <> '' THEN
        v_tip := 'Luis, el ' || v_par_top_pct_a::TEXT || '% de quienes compran ' || v_par_top_a
              || ' también se llevan ' || v_par_top_b || '. Ponlos cerca o arma un combo — es plata fácil.';
    ELSIF v_prod_margen_alto <> '' THEN
        v_tip := 'Luis, ' || v_prod_margen_alto || ' tiene margen sobre 30% pero muy pocas ventas esta semana. '
              || 'Ponlo en un lugar visible o mencionárselo a los clientes que compran productos similares.';
    ELSIF v_dia_fuerte IS NOT NULL AND v_dia_fuerte <> '' THEN
        v_tip := 'Luis, históricamente el ' || v_dia_fuerte || ' es el día más fuerte de venta. '
              || 'Asegúrate de tener stock completo y personal listo ese día.';
    ELSE
        v_tip := 'Luis, mantén el ritmo — el negocio va bien. Revisa los productos con margen bajo y evalúa si conviene seguir vendiéndolos al mismo precio.';
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════════
    -- ENSAMBLAR EL RESULTADO JSONB
    -- Cada sección usa subqueries inline para mantener las 12 secciones en un
    -- solo SELECT final. Valores nulos se tratan con COALESCE.
    -- ═══════════════════════════════════════════════════════════════════════════

    SELECT jsonb_build_object(

        -- ─── 1. PULSO AYER ────────────────────────────────────────────────────
        'pulso_ayer', jsonb_build_object(
            'venta',            v_venta_ayer,
            'ganancia',         v_ganancia_ayer,
            'tickets',          v_tickets_ayer,
            'ticket_promedio',  CASE WHEN v_tickets_ayer > 0 THEN (v_venta_ayer / v_tickets_ayer)::BIGINT ELSE 0 END,
            'margen_pct',       ROUND(CASE WHEN v_venta_ayer > 0 THEN v_ganancia_ayer::NUMERIC / v_venta_ayer * 100 ELSE 0 END, 1),
            'vs_promedio_pct',  ROUND(CASE WHEN v_promedio_30d > 0 THEN (v_venta_ayer - v_promedio_30d)::NUMERIC / v_promedio_30d * 100 ELSE 0 END, 1),
            'promedio_30d',     v_promedio_30d
        ),

        -- ─── 2. ACUMULADO MES ─────────────────────────────────────────────────
        'acumulado_mes', jsonb_build_object(
            'venta',                v_venta_mes,
            'ganancia',             v_ganancia_mes,
            'tickets',              v_tickets_mes,
            'dias_transcurridos',   v_dias_transcurridos,
            'dias_restantes',       v_dias_restantes,
            'proyeccion_cierre',    v_proyeccion,
            'meta_diaria',          v_meta_diaria
        ),

        -- ─── 3. MARGEN ACTUAL ─────────────────────────────────────────────────
        'margen_actual', jsonb_build_object(
            'margen_7d',          v_margen_7d,
            'margen_7d_anterior', v_margen_7d_ant,
            'tendencia',          CASE
                                      WHEN v_margen_7d > v_margen_7d_ant THEN 'subiendo'
                                      WHEN v_margen_7d < v_margen_7d_ant THEN 'bajando'
                                      ELSE 'estable'
                                  END,
            'ganancia_7d',        v_ganancia_7d
        ),

        -- ─── 4. ALERTAS MARGEN ────────────────────────────────────────────────
        -- Productos con margen < 10% vendidos en últimos 7 días (con >= 3 tickets)
        'alertas_margen', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'producto',   product_name,
                    'revenue_7d', revenue_7d,
                    'profit_7d',  profit_7d,
                    'margen_pct', margen_pct,
                    'tickets',    tickets_7d
                ) ORDER BY revenue_7d DESC
            ), '[]'::jsonb)
            FROM (
                SELECT
                    product_name,
                    SUM(line_total)::BIGINT  AS revenue_7d,
                    SUM(line_profit)::BIGINT AS profit_7d,
                    ROUND(SUM(line_profit) / NULLIF(SUM(line_total), 0) * 100, 1) AS margen_pct,
                    COUNT(DISTINCT ticket_id)::INTEGER AS tickets_7d
                FROM analytics.mv_sale_items
                WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer
                GROUP BY product_name
                HAVING COUNT(DISTINCT ticket_id) >= 3
                   AND SUM(line_total) > 0
                   AND ROUND(SUM(line_profit) / NULLIF(SUM(line_total), 0) * 100, 1) < 10
                ORDER BY SUM(line_total) DESC
                LIMIT 10
            ) alertas
        ),

        -- ─── 5. PRODUCTOS CAYENDO ─────────────────────────────────────────────
        -- Productos con delta <= -3 tickets entre últimos 7d vs 7d anteriores
        'productos_cayendo', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'producto',       product_name,
                    'tickets_ahora',  tickets_ahora,
                    'tickets_antes',  tickets_antes,
                    'delta',          delta,
                    'revenue_perdido', revenue_perdido
                ) ORDER BY delta ASC
            ), '[]'::jsonb)
            FROM (
                SELECT
                    COALESCE(a.product_name, b.product_name) AS product_name,
                    COALESCE(a.tickets_ahora, 0)             AS tickets_ahora,
                    COALESCE(b.tickets_antes, 0)             AS tickets_antes,
                    COALESCE(a.tickets_ahora, 0) - COALESCE(b.tickets_antes, 0) AS delta,
                    COALESCE(b.revenue_antes - COALESCE(a.revenue_ahora, 0), 0)::BIGINT AS revenue_perdido
                FROM (
                    -- Últimos 7 días
                    SELECT product_name,
                           COUNT(DISTINCT ticket_id)::INTEGER AS tickets_ahora,
                           SUM(line_total)::BIGINT AS revenue_ahora
                    FROM analytics.mv_sale_items
                    WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer
                    GROUP BY product_name
                ) a
                FULL OUTER JOIN (
                    -- 7 días anteriores
                    SELECT product_name,
                           COUNT(DISTINCT ticket_id)::INTEGER AS tickets_antes,
                           SUM(line_total)::BIGINT AS revenue_antes
                    FROM analytics.mv_sale_items
                    WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 14 AND v_hoy - 8
                    GROUP BY product_name
                ) b ON a.product_name = b.product_name
                WHERE COALESCE(b.tickets_antes, 0) >= 5
                  AND (COALESCE(a.tickets_ahora, 0) - COALESCE(b.tickets_antes, 0)) <= -3
                ORDER BY delta ASC
                LIMIT 8
            ) cayendo
        ),

        -- ─── 6. PRODUCTOS SUBIENDO ────────────────────────────────────────────
        -- Misma lógica inversa: delta >= +3
        'productos_subiendo', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'producto',       product_name,
                    'tickets_ahora',  tickets_ahora,
                    'tickets_antes',  tickets_antes,
                    'delta',          delta,
                    'revenue_ganado', revenue_ganado
                ) ORDER BY delta DESC
            ), '[]'::jsonb)
            FROM (
                SELECT
                    COALESCE(a.product_name, b.product_name) AS product_name,
                    COALESCE(a.tickets_ahora, 0)             AS tickets_ahora,
                    COALESCE(b.tickets_antes, 0)             AS tickets_antes,
                    COALESCE(a.tickets_ahora, 0) - COALESCE(b.tickets_antes, 0) AS delta,
                    (COALESCE(a.revenue_ahora, 0) - COALESCE(b.revenue_antes, 0))::BIGINT AS revenue_ganado
                FROM (
                    SELECT product_name,
                           COUNT(DISTINCT ticket_id)::INTEGER AS tickets_ahora,
                           SUM(line_total)::BIGINT AS revenue_ahora
                    FROM analytics.mv_sale_items
                    WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 7 AND v_ayer
                    GROUP BY product_name
                ) a
                FULL OUTER JOIN (
                    SELECT product_name,
                           COUNT(DISTINCT ticket_id)::INTEGER AS tickets_antes,
                           SUM(line_total)::BIGINT AS revenue_antes
                    FROM analytics.mv_sale_items
                    WHERE (sale_date AT TIME ZONE 'America/Santiago')::date BETWEEN v_hoy - 14 AND v_hoy - 8
                    GROUP BY product_name
                ) b ON a.product_name = b.product_name
                WHERE COALESCE(b.tickets_antes, 0) >= 5
                  AND (COALESCE(a.tickets_ahora, 0) - COALESCE(b.tickets_antes, 0)) >= 3
                ORDER BY delta DESC
                LIMIT 8
            ) subiendo
        ),

        -- ─── 7. TOP 5 AYER ────────────────────────────────────────────────────
        -- Top 5 productos por ganancia del día anterior
        'top5_ayer', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'producto',   product_name,
                    'qty',        qty_total,
                    'revenue',    revenue,
                    'profit',     profit,
                    'margen_pct', margen_pct
                ) ORDER BY profit DESC
            ), '[]'::jsonb)
            FROM (
                SELECT
                    product_name,
                    SUM(qty)::NUMERIC(14,2)   AS qty_total,
                    SUM(line_total)::BIGINT   AS revenue,
                    SUM(line_profit)::BIGINT  AS profit,
                    ROUND(SUM(line_profit) / NULLIF(SUM(line_total), 0) * 100, 1) AS margen_pct
                FROM analytics.mv_sale_items
                WHERE (sale_date AT TIME ZONE 'America/Santiago')::date = v_ayer
                GROUP BY product_name
                ORDER BY SUM(line_profit) DESC
                LIMIT 5
            ) top5
        ),

        -- ─── 8. CROSS SELLING ────────────────────────────────────────────────
        -- Top 5 pares para armar combos (últimos 30 días)
        'cross_selling', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'producto_a', product_a,
                    'producto_b', product_b,
                    'veces',      pair_count,
                    'pct_a',      pct_a,
                    'pct_b',      pct_b
                ) ORDER BY pair_count DESC
            ), '[]'::jsonb)
            FROM (
                SELECT product_a, product_b, pair_count, pct_a, pct_b
                FROM analytics.vw_top_pairs
                LIMIT 5
            ) pares
        ),

        -- ─── 9. PRODUCTOS MUERTOS ─────────────────────────────────────────────
        -- No vendidos en últimos 14 días pero con >= 10 tickets históricos
        'productos_muertos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'producto',           product_name,
                    'ultima_venta',       ultima_venta,
                    'tickets_historicos', ticket_count,
                    'revenue_historico',  total_revenue
                ) ORDER BY ultima_venta ASC
            ), '[]'::jsonb)
            FROM (
                SELECT
                    ps.product_name,
                    ps.last_seen::TEXT                        AS ultima_venta,
                    ps.ticket_count::INTEGER                  AS ticket_count,
                    ps.total_revenue::BIGINT                  AS total_revenue
                FROM analytics.mv_product_stats ps
                WHERE ps.ticket_count >= 10
                  AND ps.last_seen < v_hoy - 14  -- no vendido en 14 días
                  AND ps.last_seen >= v_hoy - 365 -- pero sí vendido en el último año (no descontinuado)
                ORDER BY ps.last_seen ASC
                LIMIT 8
            ) muertos
        ),

        -- ─── 10. TIP DEL DÍA ─────────────────────────────────────────────────
        -- String con tip rotativo basado en datos reales
        'tip_del_dia', to_jsonb(v_tip),

        -- ─── 11. META HOY ────────────────────────────────────────────────────
        'meta_hoy', jsonb_build_object(
            'meta',        v_meta_diaria,
            'vendido_hoy', v_venta_hoy,
            'pct_avance',  ROUND(CASE WHEN v_meta_diaria > 0 THEN v_venta_hoy::NUMERIC / v_meta_diaria * 100 ELSE 0 END, 1),
            'faltan',      GREATEST(v_meta_diaria - v_venta_hoy, 0)
        ),

        -- ─── 12. COMPARACIÓN SEMANAL ─────────────────────────────────────────
        'comparacion_semanal', jsonb_build_object(
            'venta_esta',      v_venta_semana,
            'venta_anterior',  v_venta_sem_ant,
            'delta_pct',       ROUND(CASE WHEN v_venta_sem_ant > 0 THEN (v_venta_semana - v_venta_sem_ant)::NUMERIC / v_venta_sem_ant * 100 ELSE 0 END, 1),
            'ganancia_esta',   v_ganancia_semana,
            'ganancia_anterior', v_ganancia_sem_ant,
            'tendencia',       CASE
                                   WHEN v_venta_semana > v_venta_sem_ant THEN 'subiendo'
                                   WHEN v_venta_semana < v_venta_sem_ant THEN 'bajando'
                                   ELSE 'estable'
                               END
        )

    ) INTO v_resultado;

    RETURN v_resultado;

EXCEPTION
    WHEN OTHERS THEN
        -- Retornar estructura mínima de error sin exponer detalles internos
        RETURN jsonb_build_object(
            'error',     true,
            'mensaje',   'No se pudo generar el reporte. Intenta más tarde.',
            'timestamp', to_jsonb(now()::TEXT)
        );
END;
$$;

COMMENT ON FUNCTION analytics.fn_intelligence_report() IS
'Función CORAZÓN del módulo de inteligencia de El Maravilloso. '
'Retorna JSONB con 12 secciones: pulso_ayer, acumulado_mes, margen_actual, '
'alertas_margen, productos_cayendo, productos_subiendo, top5_ayer, cross_selling, '
'productos_muertos, tip_del_dia, meta_hoy, comparacion_semanal. '
'Todas las fechas usan hora local de Chile (America/Santiago). '
'SECURITY DEFINER permite que el rol anon la llame vía RPC.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PERMISOS analytics.fn_intelligence_report
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION analytics.fn_intelligence_report()
    TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- WRAPPER en schema public
-- Necesario para que el cliente Supabase JS pueda llamarla con .rpc('intelligence_report')
-- sin necesitar acceso directo al schema analytics.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.intelligence_report()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT analytics.fn_intelligence_report();
$$;

COMMENT ON FUNCTION public.intelligence_report() IS
'Wrapper público de analytics.fn_intelligence_report(). '
'Llamar desde el cliente Supabase JS con: supabase.rpc("intelligence_report"). '
'SECURITY DEFINER — accesible por anon y authenticated.';

GRANT EXECUTE ON FUNCTION public.intelligence_report()
    TO anon, authenticated;
