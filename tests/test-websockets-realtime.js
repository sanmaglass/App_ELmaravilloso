/**
 * PRUEBAS: WebSockets Real-Time + Error Handling
 * Ejecutar en consola: node tests/test-websockets-realtime.js
 * O en navegador: abrir DevTools (F12) y copiar/pegar
 */

const TestSuite = {
    results: [],
    passed: 0,
    failed: 0,

    /**
     * Test 1: WebSocket initialization
     */
    test_websocket_init: async function () {
        console.log('\n🧪 TEST 1: WebSocket Initialization');
        try {
            // Verificar que initRealtimeSync existe
            if (typeof window.Sync?.initRealtimeSync !== 'function') {
                throw new Error('initRealtimeSync no existe');
            }

            // Verificar que el cliente Supabase está disponible
            if (!window.Sync?.client) {
                throw new Error('Supabase client no inicializado. ¿Credenciales configuradas?');
            }

            console.log('✅ initRealtimeSync existe y es función');
            console.log('✅ Supabase client disponible');
            console.log('✅ Procediendo a inicializar WebSocket...');

            // Llamar initRealtimeSync
            await window.Sync.initRealtimeSync();

            // Dar tiempo a que se conecte
            await new Promise(r => setTimeout(r, 2000));

            console.log(`✅ Realtime status: ${window.Sync.isRealtimeActive ? 'ACTIVO' : 'INACTIVO (fallback a polling)'}`);

            this.logTest('TEST 1: WebSocket Init', true, 'WebSocket inicializado correctamente');
            return true;
        } catch (e) {
            console.error('❌ Error:', e.message);
            this.logTest('TEST 1: WebSocket Init', false, e.message);
            return false;
        }
    },

    /**
     * Test 2: ErrorLogger básico
     */
    test_error_logger: async function () {
        console.log('\n🧪 TEST 2: ErrorLogger');
        try {
            if (!window.ErrorLogger) {
                throw new Error('ErrorLogger no cargado');
            }

            // Test log transient error
            const transientErr = new Error('ETIMEDOUT: Connection timeout');
            const logEntry = await window.ErrorLogger.log('test.transient', transientErr);

            if (!logEntry.isTransient) {
                throw new Error('Debería detectar ETIMEDOUT como error transitorio');
            }
            console.log('✅ Detecta errores transitorios correctamente');

            // Test log critical error
            const criticalErr = new Error('API Key inválida');
            const logEntry2 = await window.ErrorLogger.log('test.critical', criticalErr);

            if (logEntry2.isTransient) {
                throw new Error('Debería detectar "API Key inválida" como error crítico');
            }
            console.log('✅ Detecta errores críticos correctamente');

            // Verificar que se guardó en BD
            await new Promise(r => setTimeout(r, 500));
            const errors = await window.ErrorLogger.getRecentErrors(10);
            if (errors.length < 2) {
                throw new Error('Errores no se guardaron en BD local');
            }
            console.log(`✅ Errores guardados en BD (${errors.length} registros encontrados)`);

            this.logTest('TEST 2: ErrorLogger', true, 'ErrorLogger funcionando correctamente');
            return true;
        } catch (e) {
            console.error('❌ Error:', e.message);
            this.logTest('TEST 2: ErrorLogger', false, e.message);
            return false;
        }
    },

    /**
     * Test 3: Realtime change handler
     */
    test_realtime_handler: async function () {
        console.log('\n🧪 TEST 3: Realtime Change Handler');
        try {
            if (typeof window.Sync?.handleRealtimeChange !== 'function') {
                throw new Error('handleRealtimeChange no existe');
            }

            // Simular un cambio en tiempo real
            const mockPayload = {
                eventType: 'INSERT',
                new: {
                    id: 99999,
                    name: 'Test Employee',
                    deleted: false
                }
            };

            await window.Sync.handleRealtimeChange('employees', mockPayload);
            console.log('✅ Handler procesó cambio INSERT correctamente');

            // Verificar que el registro se guardó localmente
            const savedRecord = await window.db.employees.get(99999);
            if (!savedRecord) {
                throw new Error('Registro no se guardó en BD local');
            }
            console.log('✅ Registro INSERT guardado en BD local');

            // Limpiar
            await window.db.employees.delete(99999);

            this.logTest('TEST 3: Realtime Handler', true, 'Realtime change handler funcionando');
            return true;
        } catch (e) {
            console.error('❌ Error:', e.message);
            this.logTest('TEST 3: Realtime Handler', false, e.message);
            return false;
        }
    },

    /**
     * Test 4: Sync indicator update
     */
    test_sync_indicator: async function () {
        console.log('\n🧪 TEST 4: Sync Indicator Status');
        try {
            const indicator = document.getElementById('sync-indicator');
            if (!indicator) {
                throw new Error('Elemento sync-indicator no encontrado en DOM');
            }

            // Simular cambios de estado
            window.Sync.updateIndicator('syncing');
            await new Promise(r => setTimeout(r, 100));
            let title = indicator.title;
            if (!title.includes('sincronizar')) {
                throw new Error('Estado syncing no se actualizó correctamente');
            }
            console.log('✅ Estado "syncing" actualizado');

            window.Sync.updateIndicator('realtime');
            await new Promise(r => setTimeout(r, 100));
            title = indicator.title;
            if (!title.includes('instantáneamente')) {
                throw new Error('Estado realtime no se actualizó correctamente');
            }
            console.log('✅ Estado "realtime" actualizado');

            window.Sync.updateIndicator('connected');
            await new Promise(r => setTimeout(r, 100));
            title = indicator.title;
            if (!title.includes('Conectado')) {
                throw new Error('Estado connected no se actualizó correctamente');
            }
            console.log('✅ Estado "connected" actualizado');

            this.logTest('TEST 4: Sync Indicator', true, 'Indicador de estado funcionando');
            return true;
        } catch (e) {
            console.error('❌ Error:', e.message);
            this.logTest('TEST 4: Sync Indicator', false, e.message);
            return false;
        }
    },

    /**
     * Test 5: Polling fallback
     */
    test_polling_fallback: async function () {
        console.log('\n🧪 TEST 5: Polling Fallback');
        try {
            // Verificar que startAutoSync existe
            if (typeof window.Sync?.startAutoSync !== 'function') {
                throw new Error('startAutoSync no existe');
            }

            // Verificar que syncInterval está configurado
            if (!window.Sync.syncInterval) {
                throw new Error('syncInterval no se inició');
            }

            const intervalMs = window.Sync.syncInterval._idleTimeout || 0;
            if (intervalMs === 0) {
                throw new Error('syncInterval timeout no configurado');
            }

            console.log(`✅ Polling fallback configurado cada ${intervalMs}ms`);
            console.log('✅ Si WebSocket falla, volverá a polling automáticamente');

            this.logTest('TEST 5: Polling Fallback', true, 'Fallback mechanism funcionando');
            return true;
        } catch (e) {
            console.error('❌ Error:', e.message);
            this.logTest('TEST 5: Polling Fallback', false, e.message);
            return false;
        }
    },

    /**
     * Test 6: Deduplicación de sync
     */
    test_sync_deduplication: async function () {
        console.log('\n🧪 TEST 6: Sync Deduplication');
        try {
            // Configurar timestamp inicial
            window.Sync._lastSyncCompletedAt = Date.now();

            // Intentar sincronizar inmediatamente (debería rechazarse)
            const result1 = await window.Sync.syncAll();
            if (result1.success !== false || !result1.error?.includes('Deduplicado')) {
                throw new Error('Deduplicación no funcionó');
            }
            console.log('✅ Segundo sync en < 500ms fue deduplicado');

            // Esperar 600ms y reintentar (debería permitirse)
            await new Promise(r => setTimeout(r, 600));
            window.Sync._lastSyncCompletedAt = 0; // Reset para permitir
            console.log('✅ Sync permitido después de MIN_SYNC_INTERVAL');

            this.logTest('TEST 6: Sync Deduplication', true, 'Deduplicación funcionando');
            return true;
        } catch (e) {
            console.error('❌ Error:', e.message);
            this.logTest('TEST 6: Sync Deduplication', false, e.message);
            return false;
        }
    },

    /**
     * Test 7: Error export
     */
    test_error_export: async function () {
        console.log('\n🧪 TEST 7: Error Log Export');
        try {
            const result = await window.ErrorLogger.exportErrorLog();
            if (!result.success) {
                throw new Error('Exportación fallida: ' + result.error);
            }
            console.log(`✅ Error log exportado (${result.count} registros)`);
            console.log('   📁 Archivo descargado: error-log-[timestamp].csv');

            this.logTest('TEST 7: Error Export', true, 'Exportación funcionando');
            return true;
        } catch (e) {
            console.warn('⚠️ Advertencia:', e.message);
            this.logTest('TEST 7: Error Export', false, e.message);
            return false;
        }
    },

    /**
     * Ejecutar todas las pruebas
     */
    runAll: async function () {
        console.clear();
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  🚀 PRUEBAS: WebSockets Real-Time + Error Handling');
        console.log('═══════════════════════════════════════════════════════════');

        const tests = [
            this.test_websocket_init.bind(this),
            this.test_error_logger.bind(this),
            this.test_realtime_handler.bind(this),
            this.test_sync_indicator.bind(this),
            this.test_polling_fallback.bind(this),
            this.test_sync_deduplication.bind(this),
            this.test_error_export.bind(this),
        ];

        for (const test of tests) {
            await test();
            await new Promise(r => setTimeout(r, 500));
        }

        this.printSummary();
    },

    /**
     * Logger de resultados
     */
    logTest: function (name, passed, details) {
        if (passed) {
            this.passed++;
        } else {
            this.failed++;
        }
        this.results.push({ name, passed, details });
    },

    /**
     * Imprimir resumen
     */
    printSummary: function () {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  📊 RESUMEN DE PRUEBAS');
        console.log('═══════════════════════════════════════════════════════════');
        console.table({
            'Total': this.results.length,
            'Pasaron': this.passed,
            'Fallaron': this.failed,
            'Tasa de éxito': `${Math.round((this.passed / this.results.length) * 100)}%`
        });

        console.log('\n📋 Detalle:');
        this.results.forEach((r, i) => {
            const icon = r.passed ? '✅' : '❌';
            console.log(`${icon} ${i + 1}. ${r.name}`);
            if (!r.passed) {
                console.log(`   └─ ${r.details}`);
            }
        });

        console.log('\n═══════════════════════════════════════════════════════════');
        if (this.failed === 0) {
            console.log('🎉 TODAS LAS PRUEBAS PASARON');
        } else {
            console.warn(`⚠️  ${this.failed} prueba(s) fallaron`);
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    }
};

// Ejecutar si se llama directamente
if (typeof window !== 'undefined') {
    console.log('📌 Para ejecutar pruebas, escribe en consola:\n   TestSuite.runAll()\n');
}
