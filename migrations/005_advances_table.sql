-- Tabla de adelantos de sueldo para empleados
CREATE TABLE IF NOT EXISTS advances (
    id BIGINT PRIMARY KEY,
    employee_id BIGINT,
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deducted_in_expense_id BIGINT,
    deleted BOOLEAN DEFAULT FALSE,
    updated_at_hlc BIGINT,
    updated_by_device TEXT
);

-- Habilitar RLS
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;

-- Política de acceso público (misma que las demás tablas con anon key)
CREATE POLICY "Allow all for anon" ON advances
    FOR ALL
    USING (true)
    WITH CHECK (true);
