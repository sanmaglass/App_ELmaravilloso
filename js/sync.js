window.Sync = {
    client: null,
    isSyncing: false,
    syncInterval: null,
    realtimeChannel: null,
    isRealtimeActive: false,

    // Inicializar cliente
    init: async () => {
        // 1. Try Config File (Pro Mode)
        let url = window.AppConfig ? window.AppConfig.supabaseUrl : null;
        let key = window.AppConfig ? window.AppConfig.supabaseKey : null;

        // 2. Fallback to LocalStorage (Manual Mode)
        if (!url || !key) {
            url = localStorage.getItem('supabase_url');
            key = localStorage.getItem('supabase_key');
        }

        if (url && key) {
            try {
                if (typeof supabase === 'undefined') {
                    throw new Error("El SDK de Supabase no se cargó. Revisa tu conexión a internet.");
                }

                window.Sync.client = supabase.createClient(url.trim(), key.trim());

                // PRUEBA DE CONEXIÓN REAL: Intentar leer una tabla (ej. settings)
                // Usamos un limit(0) para que sea rápido y no traiga datos
                const { error } = await window.Sync.client.from('settings').select('key', { count: 'exact', head: true }).limit(1);

                if (error) {
                    // Si el error es de RLS o API Key, lo capturamos
                    if (error.code === 'PGRST301') throw new Error("API Key inválida.");
                    if (error.code === '42P01') throw new Error("Las tablas no existen. ¿Corriste el script SQL?");
                    throw new Error(error.message);
                }

                console.log("Supabase verificado y listo.");
                window.Sync.updateIndicator('connected');
                return { success: true };
            } catch (e) {
                console.error("Error inicializando Supabase:", e);
                window.Sync.client = null; // Asegurar que sea null si falla
                window.Sync.updateIndicator('error', e.message);
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: "Faltan credenciales." };
    },

    // Sincronización Completa
    syncAll: async () => {
        if (!window.Sync.client) {
            window.Sync.updateIndicator('off');
            return { success: false, error: "No conectado a la nube." };
        }
        if (window.Sync.isSyncing) return { success: false, error: "Sincronización en curso..." };

        window.Sync.isSyncing = true;
        window.Sync.updateIndicator('syncing');

        try {
            // Tablas a sincronizar (Mapeo Local -> Remoto)
            // Postgres suele usar minúsculas, Dexie usa CamelCase
            const tableMap = [
                { local: 'employees', remote: 'employees', orderBy: 'id' },
                { local: 'workLogs', remote: 'worklogs', orderBy: 'id' },
                { local: 'products', remote: 'products', orderBy: 'id' },
                { local: 'promotions', remote: 'promotions', orderBy: 'id' },
                { local: 'suppliers', remote: 'suppliers', orderBy: 'name' },
                { local: 'purchase_invoices', remote: 'purchase_invoices', orderBy: 'date' },
                { local: 'sales_invoices', remote: 'sales_invoices', orderBy: 'date' },
                { local: 'expenses', remote: 'expenses', orderBy: 'date' },
                { local: 'daily_sales', remote: 'daily_sales', orderBy: 'date' },
                { local: 'settings', remote: 'settings', orderBy: 'key' } // Settings usa 'key', no 'id'
            ];

            let dataChanged = false;

            for (const map of tableMap) {
                const localName = map.local;
                const remoteName = map.remote;
                const orderKey = map.orderBy || 'id';

                // 1. Push: Enviar lo local a la nube primero (UPSERT)
                // FILTER OUT deleted records - don't upload them to cloud
                const localData = await window.db[localName].toArray();
                const activeLocalData = localName === 'settings' ? localData : localData.filter(item => !item.deleted);

                if (activeLocalData.length > 0) {
                    const { error: pushError } = await window.Sync.client
                        .from(remoteName)
                        .upsert(activeLocalData);
                    if (pushError) throw pushError;
                }

                // 2. Pull: Traer TODO lo de la nube y actualizar localmente
                // FILTER OUT deleted records - don't download old deleted data
                const { data: cloudData, error } = await window.Sync.client
                    .from(remoteName)
                    .select('*')
                    .order(orderKey, { ascending: true }); // Ordenar dinámico

                if (error) throw error;

                // Filter out deleted records from cloud data (except settings table)
                const activeCloudData = (cloudData && localName !== 'settings')
                    ? cloudData.filter(item => !item.deleted)
                    : cloudData;

                // 3. Put into Dexie (sobrescribe si existe el ID, añade si no)
                if (activeCloudData && activeCloudData.length > 0) {
                    await window.db[localName].bulkPut(activeCloudData);
                    dataChanged = true;
                } else if (activeLocalData.length > 0) {
                    // SI LA NUBE ESTÁ VACÍA PERO EL LOCAL TIENE ALGO -> Significa borrado total detectado
                    await window.db[localName].clear();
                    dataChanged = true;
                }
            }

            if (dataChanged) {
                window.dispatchEvent(new CustomEvent('sync-data-updated'));
            }

            // Calculate total ACTIVE records (excluding deleted)
            const tables = ['employees', 'workLogs', 'products', 'promotions'];
            let totalLocal = 0;
            for (const tableName of tables) {
                const records = await window.db[tableName].toArray();
                const activeRecords = records.filter(r => !r.deleted);
                totalLocal += activeRecords.length;
            }

            if (window.Sync.client) {
                window.Sync.updateIndicator('connected', `Registros: ${totalLocal}`);
            } else {
                window.Sync.updateIndicator('off', `Registros: ${totalLocal}`); // Changed 'disconnected' to 'off' as per existing cases
            }
            return { success: true };
        } catch (e) {
            console.error("Sync Error:", e);
            window.Sync.updateIndicator('error', e.message); // Update UI!

            // Helpful Debuging for Mobile users
            if (!window.hasShownErrorAlert) {
                alert("Error de Sincronización: " + e.message + "\n(Revisa tu conexión o las claves)");
                window.hasShownErrorAlert = true; // Don't spam alerts
            }

            return { success: false, error: e.message };
        } finally {
            window.Sync.isSyncing = false;
        }
    },

    // UI Helper
    updateIndicator: (status, errorMsg = '') => {
        const el = document.getElementById('sync-indicator');
        const text = document.getElementById('sync-text');
        if (!el || !text) return;

        switch (status) {
            case 'syncing':
                el.style.color = 'var(--accent)';
                el.innerHTML = '<i class="ph ph-arrows-clockwise ph-spin"></i> <span id="sync-text">Sincronizando...</span>';
                break;
            case 'realtime':
                el.style.color = '#8b5cf6';
                el.innerHTML = '<i class="ph ph-broadcast"></i> <span id="sync-text">Tiempo Real</span>';
                el.title = errorMsg || 'WebSocket conectado - Sincronización instantánea';
                break;
            case 'connected':
                el.style.color = '#10b981';
                el.innerHTML = `<i class="ph ph-cloud-check"></i> <span id="sync-text">${errorMsg || 'En Línea'}</span>`;
                el.title = "Última sincronización: " + new Date().toLocaleTimeString();
                break;
            case 'error':
                el.style.color = '#ef4444';
                el.innerHTML = '<i class="ph ph-cloud-slash"></i> <span id="sync-text">Error Nube</span>';
                el.title = errorMsg;
                break;
            case 'off':
            default:
                el.style.color = 'var(--text-muted)';
                el.innerHTML = '<i class="ph ph-cloud-slash"></i> <span id="sync-text">Sin Nube</span>';
                break;
        }
    },

    // Auto-Sync Pro: Ejecutar cada X segundos (FALLBACK when WebSocket disconnected)
    startAutoSync: (intervalMs = 60000) => {
        if (window.Sync.syncInterval) clearInterval(window.Sync.syncInterval);

        console.log(`Polling fallback activado (cada ${intervalMs / 1000}s)`);
        window.Sync.syncInterval = setInterval(() => {
            // Only poll if WebSocket is NOT active
            if (!window.Sync.isRealtimeActive) {
                window.Sync.syncAll();
            }
        }, intervalMs);
    },

    // ===== WEBSOCKET REAL-TIME SYNC =====
    initRealtimeSync: async function () {
        if (!window.Sync.client) {
            console.warn('No Supabase client - skipping realtime');
            return;
        }

        try {
            console.log('🔌 Initializing Supabase Realtime...');

            // Create a single channel for all table changes
            window.Sync.realtimeChannel = window.Sync.client
                .channel('db-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'employees' },
                    (payload) => window.Sync.handleRealtimeChange('employees', payload)
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'worklogs' },
                    (payload) => window.Sync.handleRealtimeChange('workLogs', payload)
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'products' },
                    (payload) => window.Sync.handleRealtimeChange('products', payload)
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'promotions' },
                    (payload) => window.Sync.handleRealtimeChange('promotions', payload)
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'suppliers' },
                    (payload) => window.Sync.handleRealtimeChange('suppliers', payload)
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'purchase_invoices' },
                    (payload) => window.Sync.handleRealtimeChange('purchase_invoices', payload)
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'sales_invoices' },
                    (payload) => window.Sync.handleRealtimeChange('sales_invoices', payload)
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Realtime connected!');
                        window.Sync.isRealtimeActive = true;
                        window.Sync.updateIndicator('realtime', 'Sincronización en Tiempo Real');
                    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        console.warn('❌ Realtime disconnected, using polling fallback');
                        window.Sync.isRealtimeActive = false;
                        window.Sync.updateIndicator('connected', 'Polling (WebSocket caído)');
                    }
                });

        } catch (error) {
            console.error('Realtime init error:', error);
            window.Sync.isRealtimeActive = false;
        }
    },

    // Handle incoming real-time changes
    handleRealtimeChange: async function (localTableName, payload) {
        console.log(`📡 Realtime ${payload.eventType} on ${localTableName}:`, payload.new || payload.old);

        try {
            const record = payload.new || payload.old;

            // Skip deleted records from sync
            if (record && record.deleted && localTableName !== 'settings') {
                console.log('Skipping deleted record from realtime');
                return;
            }

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                // Upsert into local DB
                await window.db[localTableName].put(record);
            } else if (payload.eventType === 'DELETE') {
                // Remove from local DB (hard delete from cloud = hard delete locally)
                await window.db[localTableName].delete(record.id);
            }

            // Trigger view refresh
            window.dispatchEvent(new CustomEvent('sync-data-updated'));

            // Update indicator
            window.Sync.updateIndicator('realtime', 'Sincronización en Tiempo Real');

        } catch (error) {
            console.error('Error handling realtime change:', error);
        }
    },

    // DELETE ALL DATA FROM CLOUD (DANGER)
    nukeCloud: async function () {
        if (!window.Sync.client) {
            throw new Error('No cloud connection');
        }

        const tables = ['employees', 'worklogs', 'products', 'promotions'];

        for (const table of tables) {
            // Delete all rows from the table
            // Using .gte('id', 0) to select all rows (id >= 0)
            const { error } = await window.Sync.client
                .from(table)
                .delete()
                .gte('id', 0);

            if (error) {
                console.error(`Error deleting from ${table}:`, error);
                throw error;
            }
        }

        console.log('All cloud data deleted successfully');
    }
};
