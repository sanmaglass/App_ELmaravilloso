window.Sync = {
    client: null,
    isSyncing: false,
    syncInterval: null,
    realtimeChannel: null,
    isRealtimeActive: false,
    _retryCount: 0,
    _toastQueue: [],
    _isProcessingToasts: false,
    _syncSummary: { updates: 0, deletes: 0 },

    // Inicializar cliente
    init: async () => {
        // Listener global para forzar sincronización
        window.addEventListener('request-sync-all', () => window.Sync.syncAll());

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
                    console.warn('SDK de Supabase no disponible (sin internet o CDN bloqueado).');
                    window.Sync.updateIndicator('off', 'Sin internet');
                    return { success: false, error: 'SDK no disponible' };
                }

                window.Sync.client = supabase.createClient(url.trim(), key.trim());

                // Prueba de conexión: usamos employees (tabla segura que siempre existe)
                const { error } = await window.Sync.client
                    .from('employees')
                    .select('id', { count: 'exact', head: true })
                    .limit(1);

                if (error) {
                    // Error de tabla no existente — problema de configuración real
                    if (error.code === 'PGRST301') throw new Error('API Key inválida.');
                    if (error.code === '42P01') throw new Error('Las tablas no existen. Ejecuta el script SQL.');
                    // Otros errores de Supabase — log pero continuar
                    console.warn('Supabase warning en init:', error.message);
                }

                console.log('Supabase conectado.');
                window.Sync._retryCount = 0;
                window.Sync.updateIndicator('connected');
                return { success: true };

            } catch (e) {
                window.Sync.client = null;
                const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed');
                if (isNetworkError) {
                    console.warn('Sin conexión a Supabase (red no disponible).');
                    window.Sync.updateIndicator('off', 'Sin internet');
                } else {
                    console.error('Error de configuración Supabase:', e.message);
                    window.Sync.updateIndicator('error', e.message);
                }
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'Faltan credenciales.' };
    },

    // Sincronización Completa
    syncAll: async () => {
        // Auto-reconnect try
        if (!window.Sync.client) {
            console.log("Cliente Supabase nulo. Intentando reconectar...");
            await window.Sync.init();
        }

        if (!window.Sync.client) {
            window.Sync.updateIndicator('off');
            return { success: false, error: "No se pudo conectar a la nube." };
        }
        if (window.Sync.isSyncing) return { success: false, error: "Sincronización en curso..." };

        window.Sync.isSyncing = true;
        window.Sync._isSyncingAll = true;
        window.Sync.updateIndicator('syncing');

        try {
            console.log("Iniciando sincronización...");

            // Tablas a sincronizar (Mapeo Local -> Remoto)
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
                { local: 'settings', remote: 'settings', orderBy: 'key' },
                { local: 'electronic_invoices', remote: 'electronic_invoices', orderBy: 'date' }
            ];

            let dataChanged = false;

            for (const map of tableMap) {
                const localName = map.local;
                const remoteName = map.remote;
                const orderKey = map.orderBy || 'id';

                const localData = await window.db[localName].toArray();
                let activeLocalData = localData;

                if (localName === 'suppliers') {
                    const seen = new Map();
                    const deduped = [];
                    for (const item of activeLocalData) {
                        const key = (item.name || '').toLowerCase().trim();
                        if (!seen.has(key)) {
                            seen.set(key, item.id);
                            deduped.push(item);
                        }
                    }
                    activeLocalData = deduped;
                }

                if (activeLocalData.length > 0) {
                    const { error: pushError } = await window.Sync.client
                        .from(remoteName)
                        .upsert(activeLocalData);
                    if (pushError) {
                        if (pushError.code === '23505') {
                            console.warn(`[Sync] Constraint violation on ${remoteName} push (ignorado):`, pushError.message);
                        } else {
                            throw pushError;
                        }
                    }
                }

                const { data: cloudData, error } = await window.Sync.client
                    .from(remoteName)
                    .select('*')
                    .order(orderKey, { ascending: true });

                if (error) throw error;

                if (cloudData) {
                    // --- RECONCILIATION LOGIC ---
                    // Borrar localmente lo que ya no existe en la nube (hard deletes)
                    const cloudIds = new Set(cloudData.map(item => item.id || item.key));
                    const localIds = localData.map(item => item.id || item.key);

                    const toDeleteLocal = localIds.filter(id => !cloudIds.has(id));
                    if (toDeleteLocal.length > 0) {
                        await window.db[localName].bulkDelete(toDeleteLocal);
                        console.log(`[Sync] Reconciliación: Borrados ${toDeleteLocal.length} registros huérfanos en ${localName}`);
                        window.Sync._syncSummary.deletes += toDeleteLocal.length;
                        dataChanged = true;
                    }

                    // Actualizar/Insertar lo que viene de la nube
                    if (cloudData.length > 0) {
                        await window.db[localName].bulkPut(cloudData);
                        window.Sync._syncSummary.updates += cloudData.length;
                        dataChanged = true;
                    }
                }
            }

            if (dataChanged) {
                window.dispatchEvent(new CustomEvent('sync-data-updated'));
                // Mostrar resumen si hubo muchos cambios
                if (window.Sync._syncSummary.updates > 5 || window.Sync._syncSummary.deletes > 0) {
                    const msg = [];
                    if (window.Sync._syncSummary.updates > 0) msg.push(`${window.Sync._syncSummary.updates} cambios`);
                    if (window.Sync._syncSummary.deletes > 0) msg.push(`${window.Sync._syncSummary.deletes} eliminados`);
                    window.Sync.showToast(`Sincronización: ${msg.join(', ')}`, 'success');
                }
            }

            // Reiniciar resumen
            window.Sync._syncSummary = { updates: 0, deletes: 0 };

            // Count ALL active records across ALL tables
            const allTables = tableMap.map(m => m.local);
            let totalLocal = 0;
            for (const tableName of allTables) {
                const count = await window.db[tableName].filter(r => !r.deleted).count();
                totalLocal += count;
            }

            if (window.Sync.client) {
                window.Sync.updateIndicator('connected', `Registros: ${totalLocal}`);
            } else {
                window.Sync.updateIndicator('off', `Registros: ${totalLocal}`);
            }
            return { success: true };
        } catch (e) {
            console.error('Sync Error:', e);
            const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed') || e.message?.includes('NetworkError');
            if (isNetworkError) {
                window.Sync.updateIndicator('off', 'Sin internet');
            } else {
                window.Sync.updateIndicator('error', e.message || 'Error desconocido');
            }
            return { success: false, error: e.message };
        } finally {
            window.Sync._isSyncingAll = false;
            window.Sync.isSyncing = false;
        }
    },

    /**
     * Muestra una notificación rápida en pantalla
     */
    showToast: function (message, type = 'info') {
        this._toastQueue.push({ message, type });
        if (!this._isProcessingToasts) {
            this._processToastQueue();
        }
    },

    _processToastQueue: async function () {
        if (this._toastQueue.length === 0) {
            this._isProcessingToasts = false;
            return;
        }

        this._isProcessingToasts = true;

        // Si hay muchas notificaciones, agruparlas
        if (this._toastQueue.length > 3) {
            const types = new Set(this._toastQueue.map(t => t.type));
            const primaryType = types.has('success') ? 'success' : 'info';
            const count = this._toastQueue.length;
            this._toastQueue = [{ message: `${count} actualizaciones de red`, type: primaryType }];
        }

        const { message, type } = this._toastQueue.shift();

        const toast = document.createElement('div');
        toast.className = `sync-toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content" style="display:flex; align-items:center; gap:8px;">
                <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-info'}" style="font-size:1.2rem;"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);

        // Wait before showing next or removing
        await new Promise(r => setTimeout(r, 3000));

        toast.classList.add('fading');
        setTimeout(() => toast.remove(), 500);

        // Next one
        setTimeout(() => this._processToastQueue(), 200);
    },

    // UI Helper
    updateIndicator: (status, errorMsg = '') => {
        const el = document.getElementById('sync-indicator');
        const text = document.getElementById('sync-text');
        if (!el || !text) return;

        el.style.cursor = 'pointer';

        switch (status) {
            case 'syncing':
                el.style.color = 'var(--accent)';
                el.innerHTML = '<i class="ph ph-arrows-clockwise ph-spin"></i> <span id="sync-text">Sincronizando...</span>';
                el.title = 'Buscando cambios en la red...';
                break;
            case 'realtime':
                el.style.color = '#8b5cf6';
                el.innerHTML = '<i class="ph ph-broadcast"></i> <span id="sync-text">Tiempo Real</span>';
                el.title = 'Conectado instantáneamente con otros dispositivos. Haz clic para refrescar todo.';
                break;
            case 'connected':
                el.style.color = '#10b981';
                el.innerHTML = `<i class="ph ph-cloud-check"></i> <span id="sync-text">${errorMsg || 'En Línea'}</span>`;
                el.title = "Conectado. Haz clic para forzar sincronización manual.";
                break;
            case 'error':
                el.style.color = '#ef4444';
                el.innerHTML = '<i class="ph ph-cloud-slash"></i> <span id="sync-text">Error Nube</span>';
                el.title = errorMsg + " - Haz clic para intentar reconectar.";
                break;
            case 'off':
            default:
                el.style.color = 'var(--text-muted)';
                el.innerHTML = '<i class="ph ph-cloud-slash"></i> <span id="sync-text">Sin Nube</span>';
                el.title = "Trabajando en modo local. Haz clic para intentar conectar.";
                break;
        }
    },

    // Auto-Sync Pro: Ejecutar cada X segundos (FALLBACK when WebSocket disconnected)
    startAutoSync: (intervalMs = 60000) => {
        if (window.Sync.syncInterval) clearInterval(window.Sync.syncInterval);

        console.log(`Polling fallback activado (cada ${intervalMs / 1000}s)`);
        window.Sync.syncInterval = setInterval(() => {
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

            window.Sync.realtimeChannel = window.Sync.client
                .channel('db-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => window.Sync.handleRealtimeChange('employees', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'worklogs' }, (payload) => window.Sync.handleRealtimeChange('workLogs', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => window.Sync.handleRealtimeChange('products', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, (payload) => window.Sync.handleRealtimeChange('promotions', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => window.Sync.handleRealtimeChange('suppliers', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_invoices' }, (payload) => window.Sync.handleRealtimeChange('purchase_invoices', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_invoices' }, (payload) => window.Sync.handleRealtimeChange('sales_invoices', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sales' }, (payload) => window.Sync.handleRealtimeChange('daily_sales', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => window.Sync.handleRealtimeChange('expenses', payload))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'electronic_invoices' }, (payload) => window.Sync.handleRealtimeChange('electronic_invoices', payload))
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Realtime connected!');
                        window.Sync.isRealtimeActive = true;
                        window.Sync.updateIndicator('realtime');
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

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                await window.db[localTableName].put(record);

                // Notificación visual
                const labelMap = {
                    'expenses': 'Gasto',
                    'daily_sales': 'Venta Diaria',
                    'purchase_invoices': 'Factura',
                    'electronic_invoices': 'Doc. Electrónico',
                    'suppliers': 'Proveedor'
                };
                const label = labelMap[localTableName] || localTableName;
                window.Sync.showToast(`Actualizado: ${label}`, 'success');

                // --- NOTIFICACIÓN MÓVIL (Push-like) ---
                // Solo mostrar si el documento no tiene el foco (está en segundo plano)
                // Y NO estamos en medio de un full sync manual (para evitar spam)
                if (document.visibilityState !== 'visible' && !window.Sync._isSyncingAll) {
                    window.Utils.NotificationManager.debouncedShow(
                        `Actualización: ${label}`,
                        `Se ha recibido un nuevo cambio en ${label.toLowerCase()}.`,
                        `./index.html`
                    );
                }
            } else if (payload.eventType === 'DELETE') {
                await window.db[localTableName].delete(record.id);
            }

            window.dispatchEvent(new CustomEvent('sync-data-updated'));
            window.Sync.updateIndicator('realtime');

        } catch (error) {
            console.error('Error handling realtime change:', error);
        }
    },

    // DELETE ALL DATA FROM CLOUD (DANGER)
    nukeCloud: async function () {
        if (!window.Sync.client) throw new Error('No cloud connection');
        const tables = ['employees', 'worklogs', 'products', 'promotions'];
        for (const table of tables) {
            const { error } = await window.Sync.client.from(table).delete().gte('id', 0);
            if (error) throw error;
        }
        console.log('All cloud data deleted successfully');
    }
};
