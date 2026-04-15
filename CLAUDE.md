# CLAUDE.md

Este archivo provee contexto a Claude Code (claude.ai/code) para trabajar con el código de este repositorio.

## Resumen del Proyecto

**El Maravilloso** es una PWA de gestión comercial para "Distribuidora El Maravilloso" (negocio de distribución chileno). Es una **app vanilla JS de página única** — sin build, sin bundler, sin framework. Todos los scripts se cargan vía `<script>` en `index.html` y se registran en globales `window.*`.

Se despliega como **sitio estático en Vercel** (configurado en `vercel.json`). No hay código server-side.

## Arquitectura

### Capa de Datos
- **BD Local**: Dexie.js (wrapper de IndexedDB) — definida en `js/db.js` con esquemas versionados (actualmente v17)
- **BD Nube**: Supabase (PostgreSQL) — config en `js/config.js`, anon key pública protegida por RLS
- **Sincronización**: Sistema basado en Hybrid Logical Clock (HLC) en `js/sync/`
  - `hlc.js` — reloj monótono con tolerancia a desfase
  - `outbox.js` — cola confiable de escritura (local-first, drena hacia Supabase)
  - `sync-v2.js` — pull incremental, suscripciones Realtime de Supabase, polling de respaldo cada 90s
  - `device-id.js` — identidad por dispositivo para resolución de conflictos
- **Sync legacy** aún existe en `js/sync.js`
- **Migraciones SQL** para Supabase están en `migrations/`

### Globales Clave (todos en `window`)
- `db` — instancia de base de datos Dexie
- `SyncV2` — motor de sincronización (init, syncAll, pullIncremental, drainOutbox)
- `Outbox` — cola de escritura (enqueue envuelve escritura local + entrada al outbox en una transacción Dexie)
- `HLC` — reloj lógico híbrido (now, receive, encode, decode, compare)
- `TransactionManager` — operaciones batch atómicas con rollback
- `ErrorLogger` — logging centralizado de errores a tabla local `error_logs`
- `Constants` — mapeo de tablas, config de sync, límites
- `AppConfig` — URL/key de Supabase, versión de la app
- `Views` — objeto con una función por vista (dashboard, employees, etc.)
- `state` — vista actual y usuario (en `main.js`)

### Sistema de Vistas
Cada vista es una función en `js/views/<nombre>.js` que renderiza HTML en `#view-container`. Las vistas se registran en `window.Views`. El router en `main.js` mapea los botones `data-view` del sidebar a estas funciones. Las vistas incluyen bloques `<style>` inline.

### Orden de Carga de Scripts (importa)
`config.js` → `constants.js` → `utils.js` → `db.js` → `transaction-manager.js` → `error-logger.js` → módulos sync → `sync.js` → `sii_api.js` → vistas → `notifications.js` → `main.js` (debe ser el último).

### Flujo de Inicialización (`main.js`)
1. Verificación de auth (auto-login vía localStorage)
2. `seedDatabase()` — inicializa Dexie
3. `SyncV2.init()` → `SyncV2.syncAll()` → `SyncV2.initRealtimeSync()`
4. Intervalo de polling (90s) como respaldo al WebSocket
5. Ocultar splash screen, renderizar vista por defecto

## Desarrollo

### Ejecutar Localmente
Abrir `index.html` en un navegador, o usar cualquier servidor de archivos estáticos. No requiere build.

### Despliegue
Push a la rama `main` — Vercel despliega automáticamente. El sitio es puramente archivos estáticos.

### Cache Busting
Los scripts usan query strings `?v=XXXX` en `index.html` (ej: `js/db.js?v=1018`). Incrementar este número de versión al desplegar cambios para asegurar que los clientes reciban código nuevo. La app también tiene un script "Cache Nuker" inline en `index.html` (asociado a `NUKE_VERSION`) que fuerza la limpieza de cachés del SW e IndexedDB al cambiar de versión.

### Tests
```bash
npx jest tests/critical-paths.test.js    # Tests unitarios (Jest + fake-indexeddb)
```
También se pueden correr tests desde el navegador con `TestSuite.runAll()` en la consola de DevTools.

### Integración Eleventa
`settings.json` contiene la config para sincronizar datos POS desde Eleventa (Firebird DB) vía un launcher local (`launcher.bat`/`launcher.vbs` → `debug_eleventa.js`).

## Convenciones

- Todo el código es vanilla ES6+ JS — sin TypeScript, sin módulos, sin imports. Todo se registra en `window`.
- Textos de UI y comentarios están en **español**.
- Borrado lógico: los registros usan un campo `deleted` (no se eliminan físicamente).
- Los timestamps HLC (`updated_at_hlc`) se codifican como `physical * 1_000_000 + logical`.
- Las escrituras pasan por `Outbox.enqueue()` que envuelve la escritura local Dexie + entrada al outbox en una sola transacción, luego SyncV2 drena hacia Supabase.
- El mapeo de nombres de tablas entre local (camelCase, ej: `workLogs`) y remoto (snake_case, ej: `worklogs`) está en `Constants.REMOTE_TABLE_MAP`.
