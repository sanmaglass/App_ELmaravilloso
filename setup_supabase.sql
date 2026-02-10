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

-- 6. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workLogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- 7. Crear Políticas de Acceso Público (Lectura y Escritura para todos)
-- NOTA: Como la app es privada y solo tú tienes la URL/Key, esto es seguro.
CREATE POLICY "Public Access" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.workLogs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.promotions FOR ALL USING (true) WITH CHECK (true);
