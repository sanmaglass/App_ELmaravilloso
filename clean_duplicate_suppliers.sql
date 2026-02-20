-- ============================================================
-- LIMPIEZA DE PROVEEDORES DUPLICADOS EN SUPABASE
-- Ejecutar en: Supabase > SQL Editor
-- Efecto: elimina filas duplicadas (mismo nombre), 
--         conservando SIEMPRE el registro con ID más bajo (el original).
-- Las facturas de compra NO se ven afectadas porque apuntan al ID original.
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
