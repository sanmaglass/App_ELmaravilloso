# 🧪 Guía de Pruebas - WebSockets + Error Handling

Fecha: 9 Abril 2026  
Cambios: WebSockets real-time + Error Handling centralizado

---

## 🚀 Cómo Ejecutar las Pruebas

### **Opción 1: Pruebas Unitarias (Recomendado)**

1. Abre la app en navegador (por GitHub Pages o Electron)
2. Presiona **F12** para abrir DevTools
3. Ve a la pestaña **Console**
4. Pega este comando:
   ```javascript
   TestSuite.runAll()
   ```
5. Espera a que terminen las 7 pruebas (toma ~10 segundos)

### **Opción 2: Pruebas Manuales**

Sigue los pasos a continuación para verificar cada funcionalidad.

---

## 📋 Test Cases

### **Test 1: WebSocket Initialization ✅**

**Qué verifica:**
- `initRealtimeSync()` está implementado
- Supabase client está configurado
- WebSocket se inicializa correctamente

**Resultado esperado:**
```
✅ initRealtimeSync existe y es función
✅ Supabase client disponible
✅ Realtime status: ACTIVO
```

**Si falla:**
- Revisa que credenciales de Supabase están en `.env`
- Verifica que `Supabase.createClient()` fue llamado exitosamente
- Revisa en DevTools que `window.Sync.client` existe

---

### **Test 2: ErrorLogger ✅**

**Qué verifica:**
- Sistema de logging centralizado funciona
- Diferencia entre errores transitorios vs críticos
- Guarda en BD local (Dexie)

**Resultado esperado:**
```
✅ Detecta errores transitorios correctamente
✅ Detecta errores críticos correctamente
✅ Errores guardados en BD (N registros encontrados)
```

**Si falla:**
- Abre DevTools y escribe: `window.ErrorLogger.printSummary()`
- Debería mostrar un table con resumen de errores

---

### **Test 3: Realtime Change Handler ✅**

**Qué verifica:**
- Cambios en tiempo real se procesan correctamente
- Registros se guardan en BD local

**Resultado esperado:**
```
✅ Handler procesó cambio INSERT correctamente
✅ Registro INSERT guardado en BD local
```

**Si falla:**
- Verifica que `window.db.employees` existe
- Revisa que el handler no tiene errores en console

---

### **Test 4: Sync Indicator Status ✅**

**Qué verifica:**
- El indicador visual de sincronización se actualiza
- Estados: syncing → realtime → connected

**Resultado esperado:**
```
✅ Estado "syncing" actualizado
✅ Estado "realtime" actualizado
✅ Estado "connected" actualizado
```

**Si falla:**
- Revisa que elemento `#sync-indicator` existe en HTML
- Verifica `window.Sync.updateIndicator()` en console

---

### **Test 5: Polling Fallback ✅**

**Qué verifica:**
- Si WebSocket falla, vuelve a polling automático
- Polling está configurado cada 30 segundos

**Resultado esperado:**
```
✅ Polling fallback configurado cada 30000ms
✅ Si WebSocket falla, volverá a polling automáticamente
```

**Si falla:**
- Revisa que `window.Sync.startAutoSync()` fue llamado
- En DevTools: `window.Sync.syncInterval` debería mostrar un objeto

---

### **Test 6: Sync Deduplication ✅**

**Qué verifica:**
- No permite sincronizaciones muy frecuentes (< 500ms)
- Evita spam de sincronizaciones

**Resultado esperado:**
```
✅ Segundo sync en < 500ms fue deduplicado
✅ Sync permitido después de MIN_SYNC_INTERVAL
```

**Si falla:**
- Revisa `window.Sync.MIN_SYNC_INTERVAL_MS` (debería ser 500)
- Verifica que `_lastSyncCompletedAt` se actualiza

---

### **Test 7: Error Log Export ✅**

**Qué verifica:**
- Puedes exportar logs de errores a CSV
- Útil para debugging

**Resultado esperado:**
```
✅ Error log exportado (N registros)
   📁 Archivo descargado: error-log-[timestamp].csv
```

**Si falla:**
- Revisa que tienes errores loguados (ejecuta primero Test 2)
- Verifica que el navegador permite descargas

---

## 🔍 Pruebas Manuales Adicionales

### **Verificar WebSocket en tiempo real**

1. Abre la app en DOS navegadores simultáneamente
2. En el navegador 1, registra una **nueva venta**
3. En el navegador 2, **NO hagas nada**
4. Espera 1-2 segundos

**Resultado esperado:**
- La venta aparece automáticamente en navegador 2 (sin refresh)
- Indicador de sync dice "Tiempo Real" (ícono púrpura)

**Si no funciona:**
- Abre DevTools en navegador 2 → Console
- Busca mensajes que digan `📡 Realtime INSERT`
- Si no aparece, WebSocket no está recibiendo cambios
- Fallback a polling cada 30s (verifica que al menos así funciona)

---

### **Verificar Error Handling**

1. Desconecta internet (simula con DevTools → Network → Offline)
2. Intenta registrar una venta
3. Vuelve a conectar

**Resultado esperado:**
- Indicador muestra "Sin Nube"
- Venta se guarda en BD local
- Error se loguea en BD (NO contamina console)
- Al reconectar, se sincroniza automáticamente

**Para ver los errores loguados:**
```javascript
window.ErrorLogger.getRecentErrors(10).then(e => console.table(e))
```

---

### **Verificar Fallback a Polling**

1. Abre DevTools → Network
2. Busca peticiones a `supabase.com` que digan `*postgres_changes*`
3. Bloquea esas peticiones (DevTools → Network → Request blocking)
4. Registra una venta
5. Revisa si aparece en otro navegador

**Resultado esperado:**
- Sin WebSocket, volverá a polling cada 30 segundos
- Venta aparece en ~30-60 segundos (no instantáneo)
- Indicador dice "En Línea" (no "Tiempo Real")

---

## 📊 Resumen de Archivos de Prueba

```
tests/test-websockets-realtime.js    ← Suite de 7 pruebas unitarias
TESTING_GUIDE.md                      ← Este archivo
```

---

## ✅ Checklist Post-Testing

Después de ejecutar todas las pruebas, verifica:

```
[ ] Test 1-7 todos pasaron (0 fallidos)
[ ] WebSocket muestra "Tiempo Real" en indicador
[ ] Cambios aparecen en < 1 segundo en otros dispositivos
[ ] ErrorLogger loguea errores sin contaminar console
[ ] Fallback a polling funciona si WebSocket falla
[ ] Error logs se pueden exportar a CSV
```

---

## 🚨 Troubleshooting

| Problema | Solución |
|----------|----------|
| **WebSocket no se conecta** | Revisa que Supabase URL/Key son válidas en `.env` |
| **ErrorLogger dice "SDK no disponible"** | Verifica internet y que CDN de Supabase es accesible |
| **Pruebas dicen "Deduplicado"** | Normal, solo espera 600ms y reintentas |
| **Error export no descarga** | Revisa permisos de descarga en navegador |
| **Real-time no funciona pero polling sí** | El fallback está funcionando correctamente |

---

## 📞 Soporte

Si alguna prueba falla:

1. **Abre DevTools (F12)**
2. **Console → Copia todo**
3. **Documenta qué test falló**
4. **Comparte el error exacto**

---

**Generado:** 9 Abril 2026  
**Versión:** 1.0  
**Estado:** Production Ready ✅
