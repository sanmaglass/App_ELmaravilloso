-- ============================================================
-- 016: Validación Server-Side (Triggers)
-- ============================================================
-- Agrega triggers de validación en tablas con campos monetarios
-- y fechas para rechazar datos imposibles ANTES de que entren.
-- RLS filtra por tenant, pero no valida rangos ni tipos.
--
-- EJECUTAR EN: Supabase SQL Editor
-- ROLLBACK: DROP las funciones y triggers creados aquí
-- ============================================================

BEGIN;

-- ── Función genérica de validación monetaria ────────────────
-- Valida que un campo numérico esté en rango razonable
CREATE OR REPLACE FUNCTION validate_money_field(val NUMERIC, field_name TEXT)
RETURNS VOID AS $$
BEGIN
    IF val IS NOT NULL THEN
        IF val < -999999999 OR val > 999999999 THEN
            RAISE EXCEPTION 'Campo % fuera de rango: % (máx ±999.999.999)', field_name, val;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ── 1. sales_invoices (daily_sales) ─────────────────────────
CREATE OR REPLACE FUNCTION validate_daily_sales()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar montos
    PERFORM validate_money_field(NEW.cash, 'cash');
    PERFORM validate_money_field(NEW.transfer, 'transfer');
    PERFORM validate_money_field(NEW.debit, 'debit');
    PERFORM validate_money_field(NEW.credit, 'credit');
    PERFORM validate_money_field(NEW.total, 'total');

    -- Validar fecha no futura (máx 1 día adelante por timezone)
    IF NEW.date IS NOT NULL AND NEW.date > (CURRENT_DATE + INTERVAL '1 day') THEN
        RAISE EXCEPTION 'Fecha de cierre no puede ser futura: %', NEW.date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_daily_sales ON daily_sales;
CREATE TRIGGER trg_validate_daily_sales
    BEFORE INSERT OR UPDATE ON daily_sales
    FOR EACH ROW EXECUTE FUNCTION validate_daily_sales();


-- ── 2. purchase_invoices ────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_purchase_invoices()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_money_field(NEW.amount, 'amount');
    PERFORM validate_money_field(NEW."paidAmount", 'paidAmount');

    -- amount no puede ser negativo
    IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
        RAISE EXCEPTION 'Monto de factura no puede ser negativo: %', NEW.amount;
    END IF;

    -- Fecha no futura
    IF NEW.date IS NOT NULL AND NEW.date > (CURRENT_DATE + INTERVAL '1 day') THEN
        RAISE EXCEPTION 'Fecha de factura no puede ser futura: %', NEW.date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_purchase_invoices ON purchase_invoices;
CREATE TRIGGER trg_validate_purchase_invoices
    BEFORE INSERT OR UPDATE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION validate_purchase_invoices();


-- ── 3. expenses ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_expenses()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_money_field(NEW.amount, 'amount');

    IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
        RAISE EXCEPTION 'Monto de gasto no puede ser negativo: %', NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_expenses ON expenses;
CREATE TRIGGER trg_validate_expenses
    BEFORE INSERT OR UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION validate_expenses();


-- ── 4. cash_register ────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_cash_register()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_money_field(NEW.amount, 'amount');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_cash_register ON cash_register;
CREATE TRIGGER trg_validate_cash_register
    BEFORE INSERT OR UPDATE ON cash_register
    FOR EACH ROW EXECUTE FUNCTION validate_cash_register();


-- ── 5. advances ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_advances()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_money_field(NEW.amount, 'amount');

    IF NEW.amount IS NOT NULL AND NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Monto de adelanto debe ser positivo: %', NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_advances ON advances;
CREATE TRIGGER trg_validate_advances
    BEFORE INSERT OR UPDATE ON advances
    FOR EACH ROW EXECUTE FUNCTION validate_advances();


-- ── 6. loans ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_loans()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_money_field(NEW.total, 'total');

    IF NEW.quantity IS NOT NULL AND NEW.quantity < 0 THEN
        RAISE EXCEPTION 'Cantidad de préstamo no puede ser negativa: %', NEW.quantity;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_loans ON loans;
CREATE TRIGGER trg_validate_loans
    BEFORE INSERT OR UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION validate_loans();


-- ── 7. electronic_invoices ──────────────────────────────────
CREATE OR REPLACE FUNCTION validate_electronic_invoices()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_money_field(NEW.total, 'total');

    IF NEW.total IS NOT NULL AND NEW.total < 0 THEN
        RAISE EXCEPTION 'Total de factura electrónica no puede ser negativo: %', NEW.total;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_electronic_invoices ON electronic_invoices;
CREATE TRIGGER trg_validate_electronic_invoices
    BEFORE INSERT OR UPDATE ON electronic_invoices
    FOR EACH ROW EXECUTE FUNCTION validate_electronic_invoices();

COMMIT;
