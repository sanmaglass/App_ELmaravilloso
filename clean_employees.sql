-- ============================================================
-- LIMPIEZA DE EMPLEADOS EN SUPABASE
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- PASO 1: VER TODOS LOS EMPLEADOS ACTIVOS (para identificar cuáles borrar)
SELECT id, name, role, "startDate", deleted
FROM employees
WHERE deleted = false OR deleted IS NULL
ORDER BY name;

-- ============================================================
-- PASO 2: BORRAR EMPLEADOS POR NOMBRE (reemplaza los nombres que NO quieres)
-- Deja SOLO los que SÍ quieres conservar.
-- IMPORTANTE: copia los nombres exactamente como aparecen en el PASO 1
-- ============================================================

-- Borrar marcando como deleted (borrado suave, más seguro):
UPDATE employees
SET deleted = true
WHERE LOWER(TRIM(name)) NOT IN (
    'yamileth'   -- ← Agrega aquí los nombres que SÍ quieres conservar
    -- Si tienes más empleados a conservar, agrega más líneas así:
    -- , 'otro nombre'
);

-- ============================================================
-- PASO 3: VERIFICAR QUE QUEDÓ SOLO LO QUE QUERÍAS
-- ============================================================
SELECT id, name, role, deleted
FROM employees
ORDER BY deleted, name;
