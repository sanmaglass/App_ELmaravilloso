-- SCRIPT DE CREACIÓN DE TABLAS PARA "EL MARAVILLOSO"
-- Copia y pega todo este código en el SQL Editor de Supabase

-- 1. Tabla Empleados
CREATE TABLE IF NOT EXISTS public.employees (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    email TEXT,
    role TEXT,
    "hourlyRate" NUMERIC,
    "dailyRate" NUMERIC,
    avatar TEXT,
    "startDate" TEXT,
    "paymentMode" TEXT,
    "baseSalary" NUMERIC,
    "paymentFrequency" TEXT,
    "workHoursPerDay" NUMERIC,
    "breakMinutes" NUMERIC,
    deleted BOOLEAN DEFAULT FALSE
);

-- 2. Tabla Registros de Trabajo
CREATE TABLE IF NOT EXISTS public.workLogs (
    id BIGSERIAL PRIMARY KEY,
    "employeeId" BIGINT,
    date TEXT,
    status TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "totalHours" NUMERIC,
    "payAmount" NUMERIC,
    deleted BOOLEAN DEFAULT FALSE
);

-- 3. Tabla Ajustes
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB
);

-- 4. Tabla Productos
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    category TEXT,
    "buyPrice" NUMERIC,
    "salePrice" NUMERIC,
    "expiryDate" TEXT,
    stock NUMERIC,
    "costUnit" NUMERIC,
    units NUMERIC,
    "isNeto" BOOLEAN,
    margin NUMERIC,
    "createdAt" TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 5. Tabla Promociones
CREATE TABLE IF NOT EXISTS public.promotions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    text TEXT,
    "isActive" BOOLEAN,
    deleted BOOLEAN DEFAULT FALSE
);

-- 6. Tabla Proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    rut TEXT,
    giro TEXT,
    address TEXT,
    contact TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 7. Tabla Facturas de Compra (Insumos/Stock)
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
    id BIGSERIAL PRIMARY KEY,
    "supplierId" BIGINT,
    "supplierName" TEXT,
    "invoiceNumber" TEXT,
    date TEXT,
    period TEXT,
    amount NUMERIC,
    "paymentMethod" TEXT,
    "paymentStatus" TEXT,
    "creditDays" NUMERIC,
    "dueDate" TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 8. Tabla Gastos Generales (Luz, Agua, etc.)
CREATE TABLE IF NOT EXISTS public.expenses (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    amount NUMERIC,
    category TEXT,
    date TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 9. Tabla Cierres de Venta Diarios
CREATE TABLE IF NOT EXISTS public.daily_sales (
    id BIGSERIAL PRIMARY KEY,
    date TEXT,
    cash NUMERIC,
    transfer NUMERIC,
    debit NUMERIC,
    credit NUMERIC,
    total NUMERIC,
    notes TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 10. Tabla Facturas de Venta (Clientes)
CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id BIGSERIAL PRIMARY KEY,
    "invoiceNumber" NUMERIC,
    "clientName" TEXT,
    date TEXT,
    items JSONB,
    total NUMERIC,
    "paymentStatus" TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 11. Tabla Facturas Electrónicas (SII)
CREATE TABLE IF NOT EXISTS public.electronic_invoices (
    id BIGSERIAL PRIMARY KEY,
    date TEXT,
    "receiverRut" TEXT,
    "receiverName" TEXT,
    total NUMERIC,
    status TEXT,
    folio NUMERIC,
    "pdfUrl" TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

-- 12. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workLogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronic_invoices ENABLE ROW LEVEL SECURITY;

-- 13. Crear Políticas de Acceso Público 
-- Usamos DROP POLICY IF EXISTS para evitar errores si ya existen
DROP POLICY IF EXISTS "Public Access" ON public.employees;
CREATE POLICY "Public Access" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.workLogs;
CREATE POLICY "Public Access" ON public.workLogs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.settings;
CREATE POLICY "Public Access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.products;
CREATE POLICY "Public Access" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.promotions;
CREATE POLICY "Public Access" ON public.promotions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.suppliers;
CREATE POLICY "Public Access" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.purchase_invoices;
CREATE POLICY "Public Access" ON public.purchase_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.expenses;
CREATE POLICY "Public Access" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.daily_sales;
CREATE POLICY "Public Access" ON public.daily_sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.sales_invoices;
CREATE POLICY "Public Access" ON public.sales_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.electronic_invoices;
CREATE POLICY "Public Access" ON public.electronic_invoices FOR ALL USING (true) WITH CHECK (true);
