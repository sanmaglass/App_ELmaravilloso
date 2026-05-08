-- ============================================================
-- 008: Agregar tenant_id para soporte multi-tenant
-- ============================================================
-- Contexto: Preparar la base de datos para ofrecer la app a
-- múltiples negocios. Cada negocio tendrá un tenant_id único.
--
-- ESTRATEGIA CONSERVADORA:
-- 1. Crear tabla de tenants
-- 2. Registrar el negocio actual como primer tenant
-- 3. Agregar tenant_id a todas las tablas de negocio
-- 4. Marcar todos los datos existentes con el tenant actual
-- 5. Reemplazar políticas RLS abiertas por filtro por tenant
--
-- IMPORTANTE: Esta migración NO rompe la app actual.
-- La app sigue funcionando con anon key hasta que se
-- implemente Supabase Auth (migración futura).
-- ============================================================

-- ── 1. Tabla de tenants ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,                    -- "Distribuidora El Maravilloso"
    rut         TEXT,                             -- RUT del negocio (Chile)
    email       TEXT,                             -- Email de contacto
    plan        TEXT NOT NULL DEFAULT 'free',     -- free, basic, pro
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- Por ahora, anon puede ver tenants (se restringirá con auth)
CREATE POLICY "anon_all_tenants" ON tenants FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 2. Registrar El Maravilloso como primer tenant ──────────

INSERT INTO tenants (id, name, rut, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Distribuidora El Maravilloso',
    NULL,
    'pro'
);

-- ── 3. Agregar tenant_id a tablas de negocio ────────────────

-- Variable para reutilizar el ID del primer tenant
DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

    -- employees
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='tenant_id') THEN
        ALTER TABLE employees ADD COLUMN tenant_id UUID;
        UPDATE employees SET tenant_id = v_tenant_id;
        ALTER TABLE employees ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE employees ADD CONSTRAINT fk_employees_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_employees_tenant ON employees(tenant_id);
    END IF;

    -- worklogs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worklogs' AND column_name='tenant_id') THEN
        ALTER TABLE worklogs ADD COLUMN tenant_id UUID;
        UPDATE worklogs SET tenant_id = v_tenant_id;
        ALTER TABLE worklogs ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE worklogs ADD CONSTRAINT fk_worklogs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_worklogs_tenant ON worklogs(tenant_id);
    END IF;

    -- products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tenant_id') THEN
        ALTER TABLE products ADD COLUMN tenant_id UUID;
        UPDATE products SET tenant_id = v_tenant_id;
        ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE products ADD CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_products_tenant ON products(tenant_id);
    END IF;

    -- promotions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='tenant_id') THEN
        ALTER TABLE promotions ADD COLUMN tenant_id UUID;
        UPDATE promotions SET tenant_id = v_tenant_id;
        ALTER TABLE promotions ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE promotions ADD CONSTRAINT fk_promotions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_promotions_tenant ON promotions(tenant_id);
    END IF;

    -- suppliers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='tenant_id') THEN
        ALTER TABLE suppliers ADD COLUMN tenant_id UUID;
        UPDATE suppliers SET tenant_id = v_tenant_id;
        ALTER TABLE suppliers ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);
    END IF;

    -- purchase_invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='tenant_id') THEN
        ALTER TABLE purchase_invoices ADD COLUMN tenant_id UUID;
        UPDATE purchase_invoices SET tenant_id = v_tenant_id;
        ALTER TABLE purchase_invoices ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE purchase_invoices ADD CONSTRAINT fk_purchase_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_purchase_invoices_tenant ON purchase_invoices(tenant_id);
    END IF;

    -- sales_invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoices' AND column_name='tenant_id') THEN
        ALTER TABLE sales_invoices ADD COLUMN tenant_id UUID;
        UPDATE sales_invoices SET tenant_id = v_tenant_id;
        ALTER TABLE sales_invoices ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE sales_invoices ADD CONSTRAINT fk_sales_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_sales_invoices_tenant ON sales_invoices(tenant_id);
    END IF;

    -- electronic_invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='electronic_invoices' AND column_name='tenant_id') THEN
        ALTER TABLE electronic_invoices ADD COLUMN tenant_id UUID;
        UPDATE electronic_invoices SET tenant_id = v_tenant_id;
        ALTER TABLE electronic_invoices ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE electronic_invoices ADD CONSTRAINT fk_electronic_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_electronic_invoices_tenant ON electronic_invoices(tenant_id);
    END IF;

    -- expenses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='tenant_id') THEN
        ALTER TABLE expenses ADD COLUMN tenant_id UUID;
        UPDATE expenses SET tenant_id = v_tenant_id;
        ALTER TABLE expenses ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE expenses ADD CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
    END IF;

    -- daily_sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='tenant_id') THEN
        ALTER TABLE daily_sales ADD COLUMN tenant_id UUID;
        UPDATE daily_sales SET tenant_id = v_tenant_id;
        ALTER TABLE daily_sales ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE daily_sales ADD CONSTRAINT fk_daily_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_daily_sales_tenant ON daily_sales(tenant_id);
    END IF;

    -- reminders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reminders' AND column_name='tenant_id') THEN
        ALTER TABLE reminders ADD COLUMN tenant_id UUID;
        UPDATE reminders SET tenant_id = v_tenant_id;
        ALTER TABLE reminders ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE reminders ADD CONSTRAINT fk_reminders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_reminders_tenant ON reminders(tenant_id);
    END IF;

    -- eleventa_sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eleventa_sales' AND column_name='tenant_id') THEN
        ALTER TABLE eleventa_sales ADD COLUMN tenant_id UUID;
        UPDATE eleventa_sales SET tenant_id = v_tenant_id;
        ALTER TABLE eleventa_sales ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE eleventa_sales ADD CONSTRAINT fk_eleventa_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_eleventa_sales_tenant ON eleventa_sales(tenant_id);
    END IF;

    -- loans
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='tenant_id') THEN
        ALTER TABLE loans ADD COLUMN tenant_id UUID;
        UPDATE loans SET tenant_id = v_tenant_id;
        ALTER TABLE loans ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE loans ADD CONSTRAINT fk_loans_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_loans_tenant ON loans(tenant_id);
    END IF;

    -- cash_register
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_register' AND column_name='tenant_id') THEN
        ALTER TABLE cash_register ADD COLUMN tenant_id UUID;
        UPDATE cash_register SET tenant_id = v_tenant_id;
        ALTER TABLE cash_register ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE cash_register ADD CONSTRAINT fk_cash_register_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_cash_register_tenant ON cash_register(tenant_id);
    END IF;

    -- advances
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='advances' AND column_name='tenant_id') THEN
        ALTER TABLE advances ADD COLUMN tenant_id UUID;
        UPDATE advances SET tenant_id = v_tenant_id;
        ALTER TABLE advances ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE advances ADD CONSTRAINT fk_advances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        CREATE INDEX idx_advances_tenant ON advances(tenant_id);
    END IF;

    -- sync_state (por tenant para que cada negocio tenga su cursor de sync)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_state' AND column_name='tenant_id') THEN
        ALTER TABLE sync_state ADD COLUMN tenant_id UUID;
        UPDATE sync_state SET tenant_id = v_tenant_id;
        ALTER TABLE sync_state ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE sync_state ADD CONSTRAINT fk_sync_state_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;

    -- sync_conflicts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_conflicts' AND column_name='tenant_id') THEN
        ALTER TABLE sync_conflicts ADD COLUMN tenant_id UUID;
        UPDATE sync_conflicts SET tenant_id = v_tenant_id;
        ALTER TABLE sync_conflicts ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE sync_conflicts ADD CONSTRAINT fk_sync_conflicts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;

END $$;

-- ── 4. Comentario sobre RLS ────────────────────────────────
-- Las políticas RLS actuales (USING true) se mantienen por ahora.
-- Cuando se implemente Supabase Auth (migración 009), se
-- reemplazarán por:
--
--   DROP POLICY "anon_all_employees" ON employees;
--   CREATE POLICY "tenant_isolation_employees" ON employees
--     FOR ALL TO authenticated
--     USING (tenant_id = (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()))
--     WITH CHECK (tenant_id = (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));
--
-- Esto asegura que cada usuario solo vea datos de su negocio.
-- ============================================================
