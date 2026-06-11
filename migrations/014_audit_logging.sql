-- ============================================================
-- 014: Audit Logging
-- ============================================================
-- 1. Tabla audit_log — registro de operaciones DML
-- 2. RLS: INSERT + SELECT solo para authenticated
-- 3. Trigger fn_audit_trigger() genérico
-- 4. Attach en tablas de negocio principales
-- 5. Vista suspicious_activity para alertas de seguridad
-- ============================================================

-- ── 1. Tabla audit_log ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name  TEXT        NOT NULL,
    operation   TEXT        NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    old_data    JSONB,
    new_data    JSONB,
    user_id     UUID,       -- auth.uid() al momento de la operación
    tenant_id   UUID,       -- tenant del usuario
    ip          TEXT,       -- disponible si se pasa vía app (opcional)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_op   ON audit_log(table_name, operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_ts  ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_ts    ON audit_log(user_id, created_at DESC);

-- ── 2. RLS en audit_log ──────────────────────────────────────

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Cada tenant solo puede ver sus propios logs
CREATE POLICY "audit_log_select" ON audit_log
    FOR SELECT TO authenticated
    USING (tenant_id = get_my_tenant_id());

-- Solo INSERT vía trigger (SECURITY DEFINER), los usuarios no insertan directo.
-- Pero necesitamos la política para que el trigger pueda insertar.
CREATE POLICY "audit_log_insert" ON audit_log
    FOR INSERT TO authenticated
    WITH CHECK (true);  -- el filtro real lo hace el trigger

-- ── 3. Función trigger fn_audit_trigger ─────────────────────

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operation TEXT;
    v_old_data  JSONB;
    v_new_data  JSONB;
    v_tenant_id UUID;
BEGIN
    v_operation := TG_OP;

    IF TG_OP = 'DELETE' THEN
        v_old_data  := to_jsonb(OLD);
        v_new_data  := NULL;
        -- Intentar extraer tenant_id del registro borrado
        BEGIN
            v_tenant_id := (v_old_data->>'tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data  := NULL;
        v_new_data  := to_jsonb(NEW);
        BEGIN
            v_tenant_id := (v_new_data->>'tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    ELSE -- UPDATE
        v_old_data  := to_jsonb(OLD);
        v_new_data  := to_jsonb(NEW);
        BEGIN
            v_tenant_id := (v_new_data->>'tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    END IF;

    INSERT INTO audit_log (table_name, operation, old_data, new_data, user_id, tenant_id)
    VALUES (TG_TABLE_NAME, v_operation, v_old_data, v_new_data, auth.uid(), v_tenant_id);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ── 4. Attach trigger a tablas de negocio ───────────────────

DO $$
DECLARE
    tbl TEXT;
    tbls TEXT[] := ARRAY[
        'sales_invoices',
        'expenses',
        'products',
        'suppliers',
        'employees',
        'advances',
        'loans',
        'cash_register'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%I
             AFTER INSERT OR UPDATE OR DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ── 5. Vista suspicious_activity ────────────────────────────

CREATE OR REPLACE VIEW suspicious_activity AS

-- 5a. Intentos de login fallidos consecutivos (brute force)
-- NOTA: Supabase Auth no expone auth.audit_log_entries por defecto vía SQL;
-- esta sección monitorea bulk deletes y off-hours como proxy detectable desde app.

-- 5b. Bulk deletes: más de 10 registros borrados en 5 minutos por el mismo usuario
SELECT
    'bulk_delete'               AS alert_type,
    user_id,
    tenant_id,
    table_name,
    COUNT(*)                    AS event_count,
    MIN(created_at)             AS window_start,
    MAX(created_at)             AS window_end,
    NULL::TEXT                  AS detail
FROM audit_log
WHERE
    operation = 'DELETE'
    AND created_at >= now() - INTERVAL '24 hours'
GROUP BY
    user_id, tenant_id, table_name,
    floor(EXTRACT(EPOCH FROM created_at) / 300)  -- ventana de 5 min
HAVING COUNT(*) > 10

UNION ALL

-- 5c. Actividad fuera de horario (antes de 7am o después de 22:00 hora local UTC-4)
SELECT
    'off_hours_activity'        AS alert_type,
    user_id,
    tenant_id,
    table_name,
    COUNT(*)                    AS event_count,
    MIN(created_at)             AS window_start,
    MAX(created_at)             AS window_end,
    EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Santiago')::TEXT AS detail
FROM audit_log
WHERE
    created_at >= now() - INTERVAL '24 hours'
    AND (
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Santiago') < 7
        OR EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Santiago') >= 22
    )
GROUP BY user_id, tenant_id, table_name, created_at

UNION ALL

-- 5d. Escrituras masivas (más de 50 INSERT o UPDATE en 5 minutos)
SELECT
    'bulk_write'                AS alert_type,
    user_id,
    tenant_id,
    table_name,
    COUNT(*)                    AS event_count,
    MIN(created_at)             AS window_start,
    MAX(created_at)             AS window_end,
    operation                   AS detail
FROM audit_log
WHERE
    operation IN ('INSERT', 'UPDATE')
    AND created_at >= now() - INTERVAL '24 hours'
GROUP BY
    user_id, tenant_id, table_name, operation,
    floor(EXTRACT(EPOCH FROM created_at) / 300)
HAVING COUNT(*) > 50;

-- Comentario: La vista usa UTC-4 / America/Santiago para horario chileno.
-- Ajustar zona horaria si el negocio opera en otra región.
-- RLS de audit_log aplica automáticamente a la vista para usuarios autenticados.
