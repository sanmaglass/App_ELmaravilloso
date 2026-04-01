# 🧠 Memoria del Proyecto - El Maravilloso Final

## 📍 Ubicación Actual
- **Ruta Local:** `C:\Users\sanma\OneDrive\Documentos\GitHub\el-maravilloso-final`
- **GitHub:** `https://github.com/sanmaglass/App_ELmaravilloso.git`
- **Estado Git:** Limpio en el commit **CAMBIO 71** (01-04-2026). Resolución de bug aritmético en "Productos Gancho" (`item.profit * qty`).

## 🚀 Accesos
- Se creó un acceso directo en el Escritorio para apertura rápida.
- Archivos `.bat` configurados correctamente para la nueva ruta de OneDrive.

## 💰 Plan de Monetización: Distribuidora Kiwan
- **Estrategia:** Multi-instancia (Un proyecto de Supabase independiente por cliente).
- **Infraestructura:** Usar el Free Tier de Supabase (permite 2 proyectos).
- **Próximos pasos:**
    1. Crear base de datos para Kiwan.
    2. Duplicar código actual.
    3. Analizar software de ventas de Kiwan para crear un "conector" de datos (API/Script).
- **Referencia de Precios:**
    - Setup inicial: ~$100 USD ($95.000 CLP).
    - Mensualidad: ~$30 USD ($28.000 CLP).

## 🛠️ Notas Técnicas
- La app usa Supabase (URL/Key en `.env` y `js/config.js`).
- El sistema de sincronización actual (`js/sync.js`) ya maneja tablas de Eleventa.
- No mezclar datos de clientes en una misma base de datos.
