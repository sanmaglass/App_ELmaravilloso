window.Sync = {
    client: null,
    isSyncing: false,
    syncInterval: null,

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
            // Tablas a sincronizar
            const tables = ['employees', 'workLogs', 'products', 'promotions', 'settings'];
            let dataChanged = false;

            for (const table of tables) {
                // 1. Push: Enviar lo local a la nube primero (UPSERT)
                const localData = await window.db[table].toArray();
                if (localData.length > 0) {
                    const { error: pushError } = await window.Sync.client
                        .from(table)
                        .upsert(localData);
                    if (pushError) throw pushError;
                }

                // 2. Pull: Traer TODO lo de la nube y actualizar localmente
                const { data: cloudData, error } = await window.Sync.client
                    .from(table)
                    .select('*')
                    .order('id', { ascending: true }); // Ordenar para estabilizar y evitar caches

                if (error) throw error;

                // 3. Put into Dexie (sobrescribe si existe el ID, añade si no)
                if (cloudData && cloudData.length > 0) {
                    await window.db[table].bulkPut(cloudData);
                    dataChanged = true;
                } else if (localData.length > 0) {
                    // SI LA NUBE ESTÁ VACÍA PERO EL LOCAL TIENE ALGO -> Significa borrado total detectado
                    await window.db[table].clear();
                    dataChanged = true;
                }
            }

            if (dataChanged) {
                window.dispatchEvent(new CustomEvent('sync-data-updated'));
            }

            // Contar total para feedback
            const totalLocal = (await Promise.all(['employees', 'workLogs', 'products'].map(t => window.db[t].count()))).reduce((a, b) => a + b, 0);
            window.Sync.updateIndicator('connected', `Registros: ${totalLocal}`);
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

    // Auto-Sync Pro: Ejecutar cada X segundos
    startAutoSync: (intervalMs = 10000) => {
        if (window.Sync.syncInterval) clearInterval(window.Sync.syncInterval);

        console.log(`Auto-Sync activado (cada ${intervalMs / 1000}s)`);
        window.Sync.syncInterval = setInterval(() => {
            window.Sync.syncAll();
        }, intervalMs);
    }
};
