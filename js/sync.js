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
    _dispatchTimer: null,

    // Dispara 'sync-data-updated' con debounce para evitar loops de refrescos
    _scheduleSyncEvent() {
        if (this._dispatchTimer) clearTimeout(this._dispatchTimer);
        this._dispatchTimer = setTimeout(() => {
            this._dispatchTimer = null;
            window.dispatchEvent(new CustomEvent('sync-data-updated'));
        }, 800);
    },

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
                console.log('Cliente Supabase creado. Testeando conexión...');

                // Prueba de conexión: usamos employees (tabla segura que siempre existe)
                const { error } = await window.Sync.client
                    .from('employees')
                    .select('id', { count: 'exact', head: true })
                    .limit(1);

                if (error) {
                    console.error('Test de conexión fallido:', error);
                    // Error de tabla no existente o API key mal configurada
                    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                        throw new Error('API Key de Supabase inválida o mal formateada.');
                    }
                    if (error.code === '42P01') {
                        throw new Error('Tablas no encontradas. ¿Ejecutaste el script SQL en Supabase?');
                    }
                    throw new Error(`Conexión fallida: ${error.message}`);
                }

                console.log('Supabase conectado correctamente.');
                window.Sync._retryCount = 0;
                window.Sync.updateIndicator('connected');
                return { success: true };

            } catch (e) {
                window.Sync.client = null;
                console.error('Error detallado de Sync.init:', e);
                const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed');

                if (isNetworkError) {
                    window.Sync.updateIndicator('off', 'Error de red');
                } else {
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
                { local: 'electronic_invoices', remote: 'electronic_invoices', orderBy: 'date' },
                { local: 'reminders', remote: 'reminders', orderBy: 'id' }
            ];

            let dataChanged = false;

            for (const map of tableMap) {
                try {
                    const localName = map.local;
                    const remoteName = map.remote;
                    const orderKey = map.orderBy || 'id';

                    // 1. PULL PHASE (Cloud is Master)
                    const { data: cloudData, error } = await window.Sync.client
                        .from(remoteName)
                        .select('*')
                        .order(orderKey, { ascending: true });

                    if (error) throw error;

                    if (cloudData) {
                        // NORMALIZAR IDs de la nube a Números para prevenir "fantasmas"
                        const normalizedCloudData = cloudData.map(item => ({
                            deleted: false, // Default to NOT deleted
                            ...item,
                            id: Number(item.id || item.key)
                        })).filter(item => {
                            // FILTRO DE BASURA: Ignorar registros con valores imposibles (ej. $8 Trillones)
                            const total = parseFloat(item.total || item.cash || 0);
                            if (total > 1000000000000) { // > 1 Trillon CLP
                                console.warn(`[Sync] Ignorando registro basura detectado en ${remoteName}:`, item.id);
                                return false;
                            }
                            return true;
                        });

                        const cloudIds = new Set(normalizedCloudData.map(item => item.id));
                        const localData = await window.db[localName].toArray();

                        // --- RECONCILIACIÓN AGRESIVA (con protección de registros recientes) ---
                        // Proteger registros creados en los últimos 10 minutos
                        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
                        const toDeleteLocal = localData
                            .filter(item => {
                                if (cloudIds.has(Number(item.id || item.key))) return false;
                                const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
                                if (createdAt > tenMinutesAgo) return false; // recién creado, proteger
                                return true;
                            })
                            .map(item => item.id);

                        if (toDeleteLocal.length > 0) {
                            console.log(`[Sync] Limpiando ${toDeleteLocal.length} huérfanos locales en ${localName}`);
                            await window.db[localName].bulkDelete(toDeleteLocal);
                            window.Sync._syncSummary.deletes += toDeleteLocal.length;
                            dataChanged = true;
                        }

                        // Actualizar local con datos oficiales de la nube
                        if (normalizedCloudData.length > 0) {
                            // Solo marcar como cambiado si el conteo o algún ID difiere
                            const localIds = new Set(localData.map(r => r.id));
                            const cloudHasNew = normalizedCloudData.some(r => !localIds.has(r.id));
                            const countDiffers = normalizedCloudData.length !== localData.length;
                            if (cloudHasNew || countDiffers || toDeleteLocal.length > 0) {
                                await window.db[localName].bulkPut(normalizedCloudData);
                                window.Sync._syncSummary.updates += normalizedCloudData.length;
                                dataChanged = true;
                            } else {
                                // Mismo conteo e IDs — igual hacemos bulkPut silencioso para actualizar campos
                                await window.db[localName].bulkPut(normalizedCloudData);
                            }
                        }
                    }

                    // 2. PUSH PHASE: Subir cambios locales al cloud (incluyendo recién creados)
                    // Settings se omite del push — no tiene columna 'deleted'
                    if (remoteName !== 'settings') {
                        const finalLocalData = await window.db[localName].toArray();
                        if (finalLocalData.length > 0) {
                            const { error: pushErr } = await window.Sync.client
                                .from(remoteName)
                                .upsert(finalLocalData, { onConflict: 'id' });
                            if (pushErr) console.warn(`[Sync] Push error en ${remoteName}:`, pushErr.message);
                        }
                    }
                } catch (tableErr) {
                    console.error(`[Sync] Error en tabla ${map.remote}:`, tableErr.message);
                }
            }

            if (dataChanged) {
                window.Sync._scheduleSyncEvent();
                const stats = window.Sync._syncSummary;
                if (stats.updates > 5 || stats.deletes > 0) {
                    const msg = [];
                    if (stats.updates > 0) msg.push(`${stats.updates} cambios`);
                    if (stats.deletes > 0) msg.push(`${stats.deletes} eliminados`);
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
                .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, (payload) => window.Sync.handleRealtimeChange('reminders', payload))
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
        try {
            const record = payload.new || payload.old;
            if (!record) return;

            // --- FORZAR CONSISTENCIA DE ID (Número) ---
            // Supabase puede devolver IDs como string o Number dependiendo de la config.
            // Dexie necesita consistencia total para no crear duplicados "fantasma".
            const id = Number(record.id || record.key);
            if (isNaN(id)) return;

            // Re-insuflar el ID numérico en el objeto
            record.id = id;

            console.log(`📡 Realtime ${payload.eventType} on ${localTableName}:`, id);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                // Si el registro viene marcado como borrado desde la nube, lo quitamos localmente
                if (record.deleted === true || record.deleted === 1) {
                    await window.db[localTableName].delete(id);
                } else {
                    await window.db[localTableName].put(record);
                }
            } else if (payload.eventType === 'DELETE') {
                await window.db[localTableName].delete(id);
            }

            window.Sync._scheduleSyncEvent();
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
