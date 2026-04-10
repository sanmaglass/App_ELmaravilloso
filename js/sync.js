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

    // ── Deduplicación por timestamp ────────────────────────────
    // Evita lanzar syncAll si ya se ejecutó hace menos de MIN_SYNC_INTERVAL_MS.
    // También protege contra eventos en ráfaga (p.ej. WebSocket flood).
    _lastSyncCompletedAt: 0,
    MIN_SYNC_INTERVAL_MS: 500,

    // Cambios pendientes de notificar (dedup de tablas)
    _pendingChangeTables: new Set(),

    /**
     * Registra que una tabla cambió localmente.
     * El evento 'sync-data-updated' se despacha una sola vez
     * agrupando todos los cambios del mismo ciclo de evento.
     */
    markTableChanged(tableName) {
        this._pendingChangeTables.add(tableName);
        this._scheduleSyncEvent();
    },

    // Dispara 'sync-data-updated' con debounce para evitar loops de refrescos
    _scheduleSyncEvent() {
        if (this._dispatchTimer) clearTimeout(this._dispatchTimer);

        // Debounce corto: agrupa eventos que llegan juntos sin retrasar la UI
        const isInitialSync = !window._appInitializedAt || (Date.now() - window._appInitializedAt < 5000);
        const delay = isInitialSync ? 300 : 100;

        this._dispatchTimer = setTimeout(() => {
            this._dispatchTimer = null;
            const changedTables = [...this._pendingChangeTables];
            this._pendingChangeTables.clear();
            window.dispatchEvent(new CustomEvent('sync-data-updated', {
                detail: { tables: changedTables }
            }));
        }, delay);
    },


    // Inicializar cliente
    _syncListenerRegistered: false,
    init: async () => {
        // Listener global para forzar sincronización — registrar solo una vez
        if (!window.Sync._syncListenerRegistered) {
            window.addEventListener('request-sync-all', () => window.Sync.syncAll());
            window.Sync._syncListenerRegistered = true;
        }

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
                    window.ErrorLogger?.log('sync.init', 'SDK no disponible', { reason: 'CDN o internet' }, true);
                    window.Sync.updateIndicator('off', 'Sin internet');
                    return { success: false, error: 'SDK no disponible' };
                }

                // Crear cliente siempre (createClient nunca falla por sí solo)
                window.Sync.client = supabase.createClient(url.trim(), key.trim());
                console.log('Cliente Supabase creado. Testeando conexión...');

                // Prueba de conexión: solo detecta errores fatales (key inválida, URL incorrecta)
                // No destruimos el cliente por errores de RLS o proyecto pausado —
                // esos se resolverán cuando el usuario autentique la sesión.
                const { error } = await window.Sync.client
                    .from('employees')
                    .select('id', { count: 'exact', head: true })
                    .limit(1);

                if (error) {
                    const isTransient = error.code !== 'PGRST301' && error.code !== '42P01';
                    window.ErrorLogger?.log('sync.init.connection', error, { code: error.code }, isTransient);

                    // Fatal: API key inválida → destruir cliente
                    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                        window.Sync.client = null;
                        window.Sync.updateIndicator('error', 'API Key inválida');
                        return { success: false, error: 'API Key de Supabase inválida o mal formateada.' };
                    }
                    // Fatal: tablas no existen
                    if (error.code === '42P01') {
                        window.Sync.client = null;
                        window.Sync.updateIndicator('error', 'Tablas no encontradas');
                        return { success: false, error: 'Tablas no encontradas. ¿Ejecutaste el script SQL en Supabase?' };
                    }

                    // No-fatal (RLS sin sesión, proyecto pausado, error de red transitorio):
                    // Mantenemos el cliente creado; la sesión de auth lo resolverá.
                    window.Sync.updateIndicator('connected', 'Verificando...');
                    return { success: true, warning: error.message };
                }

                console.log('Supabase conectado correctamente.');
                window.Sync._retryCount = 0;
                window.Sync.updateIndicator('connected');
                return { success: true };

            } catch (e) {
                // Solo llegamos aquí si hay un error de red total (fetch failed)
                window.Sync.client = null;
                const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed');
                window.ErrorLogger?.log('sync.init.exception', e, { type: isNetworkError ? 'network' : 'unknown' }, isNetworkError);

                if (isNetworkError) {
                    window.Sync.updateIndicator('off', 'Sin internet');
                } else {
                    window.Sync.updateIndicator('error', e.message);
                }
                return { success: false, error: e.message };
            }
        }
        window.Sync.updateIndicator('off', 'Sin credenciales');
        return { success: false, error: 'Faltan credenciales.' };
    },

    // Sincronización Completa
    syncAll: async () => {
        // ── Deduplicación por timestamp ────────────────────────
        // Si syncAll fue llamado hace menos de MIN_SYNC_INTERVAL_MS, ignorar.
        // Esto protege contra múltiples disparos simultáneos (ej. WebSocket + polling).
        const now = Date.now();
        if (now - window.Sync._lastSyncCompletedAt < window.Sync.MIN_SYNC_INTERVAL_MS) {
            return { success: false, error: 'Deduplicado: sync reciente' };
        }

        // Auto-reconnect try
        if (!window.Sync.client) {
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
                { local: 'electronic_invoices', remote: 'electronic_invoices', orderBy: 'date' },
                { local: 'reminders', remote: 'reminders', orderBy: 'id' },
                { local: 'eleventa_sales', remote: 'eleventa_sales', orderBy: 'date', descending: true },
                { local: 'loans', remote: 'loans', orderBy: 'date', descending: true }
            ];

            let dataChanged = false;

            // ── FASE 1: Lanzar todos los PULLs en paralelo ─────────────────
            window.Sync.updateIndicator('syncing', 'Descargando...');
            const pullResults = await Promise.all(tableMap.map(async (map) => {
                const orderKey = map.orderBy || 'id';
                try {
                    let query = window.Sync.client.from(map.remote).select('*');
                    query = map.descending
                        ? query.order(orderKey, { ascending: false })
                        : query.order(orderKey, { ascending: true });
                    if (map.remote === 'eleventa_sales') {
                        const rollingDate = new Date();
                        rollingDate.setDate(rollingDate.getDate() - 90);
                        const filterDate = rollingDate.toISOString();
                        console.log(`[Sync DEBUG] eleventa_sales filter date: ${filterDate}`);
                        query = query.gte('date', filterDate).limit(10000);
                    }
                    const { data, error } = await query;
                    if (map.remote === 'eleventa_sales') {
                        console.log(`[Sync DEBUG] eleventa_sales result: ${data?.length || 0} registros, error: ${error?.message || 'ninguno'}`);
                        if (data && data.length > 0) {
                            console.log(`[Sync DEBUG] Primer registro eleventa:`, data[0]);
                            console.log(`[Sync DEBUG] Últimas 3 fechas:`, data.slice(0, 3).map(d => ({ id: d.id, date: d.date, total: d.total })));
                        }
                    }
                    return { map, data, error };
                } catch (e) {
                    return { map, data: null, error: e };
                }
            }));

            // ── FASE 2: Procesar resultados y actualizar DB local ───────────
            for (const { map, data: cloudData, error } of pullResults) {
                try {
                    const localName = map.local;
                    const remoteName = map.remote;

                    if (error) throw error;

                    if (cloudData) {
                        console.log(`[Sync] ${remoteName}: Recibidos ${cloudData.length} registros de la nube.`);
                        if (cloudData.length > 500) {
                            window.Sync.updateIndicator('syncing', `${remoteName}: ${cloudData.length} recs...`);
                        }
                        const cloudIds = new Set();
                        // Crear mapa local para preservar campos no existentes en nube (por falta de migración)
                        const localData = await window.db[localName].toArray();
                        const localDataMap = new Map();
                        localData.forEach(r => localDataMap.set(Number(r.id || r.key), r));

                        const normalizedCloudData = cloudData.map(item => {
                            const _id = Number(item.id || item.key);
                            cloudIds.add(_id);
                            const localReq = localDataMap.get(_id);

                            // Fusionar datos
                            const merged = { ...item, id: _id };

                            // Si la nube no envía 'deleted', usar el local o false
                            if (!('deleted' in item)) {
                                merged.deleted = localReq && localReq.deleted !== undefined ? localReq.deleted : false;
                            }

                            // Especial para reminders: preservar properties si la nube no los soporta aún
                            if (localName === 'reminders' && localReq) {
                                if (!('completed' in item)) merged.completed = localReq.completed;
                                if (!('priority' in item)) merged.priority = localReq.priority;
                                if (!('notes' in item)) merged.notes = localReq.notes;
                                if (!('type' in item)) merged.type = localReq.type;
                                if (!('frequency_unit' in item)) merged.frequency_unit = localReq.frequency_unit;
                                if (!('snoozed_until' in item)) merged.snoozed_until = localReq.snoozed_until;
                            }

                            // Especial para invoices: preservar image_url y imageData locales si la nube no los devuelve
                            if (localName === 'purchase_invoices' && localReq) {
                                if (!('image_url' in item)) merged.image_url = localReq.image_url;
                                if (!('imageData' in item)) merged.imageData = localReq.imageData;
                            }

                            // Especial para loans: preservar campos que la nube puede no tener aún
                            if (localName === 'loans' && localReq) {
                                if (!('borrowerName' in item) || item.borrowerName === undefined) merged.borrowerName = localReq.borrowerName;
                                if (!('type' in item) || item.type === undefined) merged.type = localReq.type;
                                if (!('direction' in item) || item.direction === undefined) merged.direction = localReq.direction;
                                if (!('repaymentType' in item) || item.repaymentType === undefined) merged.repaymentType = localReq.repaymentType;
                                if (!('repaymentDate' in item) || item.repaymentDate === undefined) merged.repaymentDate = localReq.repaymentDate;
                            }

                            // Especial para employees: preservar fields de horas si la nube no los soporta
                            if (localName === 'employees' && localReq) {
                                if (!('owedMinutes' in item)) merged.owedMinutes = localReq.owedMinutes;
                                if (!('recoveryRateMinutes' in item)) merged.recoveryRateMinutes = localReq.recoveryRateMinutes;
                                if (!('recoveryStartDate' in item)) merged.recoveryStartDate = localReq.recoveryStartDate;
                                if (!('defaultStartTime' in item)) merged.defaultStartTime = localReq.defaultStartTime;
                                if (!('defaultEndTime' in item)) merged.defaultEndTime = localReq.defaultEndTime;
                                if (!('workHoursPerDay' in item)) merged.workHoursPerDay = localReq.workHoursPerDay;
                                if (!('breakMinutes' in item)) merged.breakMinutes = localReq.breakMinutes;
                                if (!('isOwner' in item)) merged.isOwner = localReq.isOwner;
                                if (!('paymentMode' in item)) merged.paymentMode = localReq.paymentMode;
                                if (!('baseSalary' in item)) merged.baseSalary = localReq.baseSalary;
                                if (!('paymentFrequency' in item)) merged.paymentFrequency = localReq.paymentFrequency;
                                if (!('hourlyRate' in item)) merged.hourlyRate = localReq.hourlyRate;
                                if (!('dailyRate' in item)) merged.dailyRate = localReq.dailyRate;
                            }

                            return merged;
                        }).filter(item => {
                            // FILTRO DE BASURA: Ignorar registros con valores imposibles (ej. $8 Trillones)
                            const total = parseFloat(item.total || item.cash || 0);
                            if (total > 1000000000000) { // > 1 Trillon CLP
                                window.ErrorLogger?.log('sync.pull.garbage', `Registro basura detectado en ${remoteName}`,
                                    { tableName: remoteName, id: item.id, value: total });
                                return false;
                            }
                            return true;
                        });

                        // --- RECONCILIACIÓN POR RANGO (Protección de Historial) ---
                        // Solo borramos huérfanos locales si están dentro del rango que pedimos a la nube
                        // Para Eleventa, solo arriesgamos borrar huérfanos de los ÚLTIMOS 3 DÍAS (por si anularon un ticket)
                        const orphanSafetyWindow = 3 * 24 * 60 * 60 * 1000; // 3 días en ms
                        const nowMs = Date.now();
                        const tenMinutesAgo = nowMs - 60 * 60 * 1000;
                        
                        const toDeleteLocal = localData
                            .filter(item => {
                                if (cloudIds.has(Number(item.id || item.key))) return false;
                                
                                // Regla 1: No borrar si se creó hace menos de 1 hora (evitar race conditions)
                                const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
                                if (createdAt > tenMinutesAgo) return false;

                                // Regla 2: PROTECCIÓN CRÍTICA DE HISTORIAL
                                // Si es Eleventa, solo borramos si el ticket es de hace menos de 3 días.
                                // Todo lo que sea más viejo se queda localmente para SIEMPRE, aunque no venga en el query incremental.
                                if (localName === 'eleventa_sales' && item.date) {
                                    const itemDateMs = new Date(item.date).getTime();
                                    if (nowMs - itemDateMs > orphanSafetyWindow) return false; // Proteger histórico
                                }

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
                            console.log(`[Sync] ${localName}: Procesando bulkPut de ${normalizedCloudData.length} registros...`);
                            // Solo marcar como cambiado si el conteo o algún ID difiere
                            const localIds = new Set(localData.map(r => r.id));
                            const cloudHasNew = normalizedCloudData.some(r => !localIds.has(r.id));
                            const countDiffers = normalizedCloudData.length !== localData.length;
                            if (cloudHasNew || countDiffers || toDeleteLocal.length > 0) {
                                try {
                                    await window.db[localName].bulkPut(normalizedCloudData);
                                    console.log(`[Sync DEBUG] ${localName}: bulkPut exitoso`);
                                    window.Sync._syncSummary.updates += normalizedCloudData.length;
                                    dataChanged = true;
                                } catch (putErr) {
                                    console.error(`[Sync ERROR] ${localName} bulkPut falló:`, putErr.message);
                                    throw putErr;
                                }
                            } else {
                                // Mismo conteo e IDs — igual hacemos bulkPut silencioso para actualizar campos
                                try {
                                    await window.db[localName].bulkPut(normalizedCloudData);
                                    console.log(`[Sync DEBUG] ${localName}: bulkPut silencioso exitoso`);
                                } catch (putErr) {
                                    console.error(`[Sync ERROR] ${localName} bulkPut silencioso falló:`, putErr.message);
                                }
                            }
                        }
                    }

                } catch (tableErr) {
                    window.ErrorLogger?.log(`sync.pull.${map.remote}`, tableErr, { tableName: map.remote });
                }
            }

            // ── FASE 3: Lanzar todos los PUSHes en paralelo ────────────────
            const fallbackTables = {
                'reminders': window.DataManager._remindersCoreFields,
                'purchase_invoices': window.DataManager._purchaseInvoicesCoreFields,
                'suppliers': window.DataManager._suppliersCoreFields,
                'expenses': window.DataManager._expensesCoreFields,
                'employees': window.DataManager._employeesCoreFields,
                'daily_sales': window.DataManager._dailySalesCoreFields,
                'electronic_invoices': window.DataManager._electronicInvoicesCoreFields,
                'loans': window.DataManager._loansCoreFields
            };

            await Promise.all(tableMap
                .filter(m => m.remote !== 'settings')
                .map(async (map) => {
                    const localName = map.local;
                    const remoteName = map.remote;
                    try {
                        const finalLocalData = await window.db[localName].toArray();
                        if (!finalLocalData.length) return;

                        const syncDataToPush = finalLocalData.map(item => {
                            const copy = { ...item };
                            if (localName === 'purchase_invoices') {
                                delete copy.imageData;
                                delete copy.created_at;
                            }
                            if (fallbackTables[localName]) {
                                const coreFields = fallbackTables[localName];
                                const clean = {};
                                coreFields.forEach(k => { if (copy[k] !== undefined) clean[k] = copy[k]; });
                                if (localName === 'reminders') {
                                    if (clean.deleted !== undefined) clean.deleted = clean.deleted ? 1 : 0;
                                    if (clean.completed !== undefined) clean.completed = clean.completed ? 1 : 0;
                                }
                                return clean;
                            }
                            return copy;
                        });

                        const { error: pushErr } = await window.Sync.client
                            .from(remoteName)
                            .upsert(syncDataToPush, { onConflict: 'id' })
                            .select('id');

                        if (pushErr) {
                            const isColumnErr = pushErr.message?.includes('column') || pushErr.code === '42703' || pushErr.code === 'PGRST204';
                            if (!isColumnErr) {
                                window.ErrorLogger?.log(`sync.push.${remoteName}`, pushErr, { tableName: remoteName, code: pushErr.code }, true);
                            }
                        }
                    } catch (e) {
                        console.error(`[Sync] Push error en ${remoteName}:`, e.message);
                    }
                })
            );

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

            // Registrar timestamp de finalización para deduplicación
            window.Sync._lastSyncCompletedAt = Date.now();

            // Notificar a DataManager para procesar queue de pendientes
            window.dispatchEvent(new CustomEvent('sync-connected'));

            return { success: true };
        } catch (e) {
            const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed') || e.message?.includes('NetworkError');
            window.ErrorLogger?.log('sync.syncAll', e, { type: isNetworkError ? 'network' : 'sync' }, isNetworkError);
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

    initRealtimeSync: async function () {
        if (!window.Sync.client) return;

        const tableMap = Object.keys(window.Constants.REMOTE_TABLE_MAP);

        try {
            for (const localTable of tableMap) {
                const remoteTable = window.Constants.REMOTE_TABLE_MAP[localTable];

                // Subscribe to realtime changes
                const channel = window.Sync.client
                    .channel(`public:${remoteTable}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: remoteTable
                        },
                        (payload) => {
                            window.Sync.handleRealtimeChange(localTable, payload);
                        }
                    )
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            console.log(`📡 Realtime activo para ${remoteTable}`);
                            window.Sync.isRealtimeActive = true;
                            window.Sync.updateIndicator('realtime');
                        } else if (status === 'CLOSED') {
                            console.warn(`📡 Realtime desconectado para ${remoteTable}`);
                            window.Sync.isRealtimeActive = false;
                        }
                    });

                window.Sync.realtimeChannel = channel;
            }
        } catch (error) {
            console.warn('Realtime init error (fallback a polling):', error);
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

            // Logging detallado para eleventa_sales
            if (localTableName === 'eleventa_sales') {
                console.log(`📡🎟️ Realtime ${payload.eventType} on ${localTableName}:`, {
                    id,
                    date: record.date,
                    total: record.total,
                    items_count: record.items_count
                });
            } else {
                console.log(`📡 Realtime ${payload.eventType} on ${localTableName}:`, id);
            }

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
            window.ErrorLogger?.log('sync.realtime', error, { localTableName });
        }
    }
};
