-- ============================================================
-- LIMPIEZA DE PROVEEDORES DUPLICADOS EN SUPABASE
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- ============================================================
-- PASO 0: LIMPIEZA + PROTECCIÓN PERMANENTE (SOLUCIÓN DEFINITIVA)
-- Esto agrega una restricción ÚNICA en la base de datos.
-- Después de esto es IMPOSIBLE que se vuelvan a crear duplicados.
-- ============================================================

-- Primero limpiar duplicados (queda solo el más antiguo de cada nombre)
DELETE FROM suppliers
WHERE id NOT IN (
    SELECT MIN(id)
    FROM suppliers
    GROUP BY LOWER(TRIM(name))
);

-- Luego crear índice único para que Supabase rechace duplicados para siempre
-- (Si ya existe, este comando no hace nada)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_unique 
ON suppliers (LOWER(TRIM(name)));

-- Verificar que quedó limpio
SELECT MIN(name) as name, COUNT(*) as total
FROM suppliers
WHERE deleted = false
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;

-- Si la consulta anterior devuelve 0 filas: ✅ TODO LIMPIO

-- ============================================================


-- 1. VER CUÁNTOS DUPLICADOS HAY (antes de borrar, para confirmar)
SELECT 
    MIN(name) as name,
    COUNT(*) as total,
    MIN(id) as id_a_conservar,
    ARRAY_AGG(id ORDER BY id) as todos_los_ids
FROM suppliers
WHERE deleted = false
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ============================================================
-- 2. ELIMINAR LOS DUPLICADOS (conserva el ID más bajo de cada nombre)
--    EJECUTAR SOLO DESPUÉS DE REVISAR EL RESULTADO DEL PASO 1
-- ============================================================
DELETE FROM suppliers
WHERE id NOT IN (
    -- Selecciona el ID mínimo (más antiguo) por cada nombre único
    SELECT MIN(id)
    FROM suppliers
    GROUP BY LOWER(TRIM(name))
)
AND deleted = false;

-- 3. VERIFICAR QUE YA NO HAY DUPLICADOS (debería devolver 0 filas)
SELECT 
    name,
    COUNT(*) as total
FROM suppliers
WHERE deleted = false
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;
