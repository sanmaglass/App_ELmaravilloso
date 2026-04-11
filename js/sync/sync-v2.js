// Sync v2: Pull incremental + HLC + Realtime robusto + Outbox
window.SyncV2 = {
  client: null,
  isSyncing: false,
  realtimeChannels: [],
  isRealtimeActive: false,
  syncLocks: new Set(),

  // Debounce para _notifyUI: evita re-renders en ráfaga (ej. múltiples eventos Realtime seguidos)
  _notifyTimer: null,
  _pendingNotifyTables: new Set(),

  // Normaliza cualquier HLC a un número comparable.
  // Acepta: número, objeto {physical, logical}, string numérico, o undefined.
  _toHlcNumber(value) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return isNaN(n) ? 0 : n;
    }
    if (typeof value === 'object' && 'physical' in value) {
      return HLC.encode(value);
    }
    return 0;
  },

  async init() {
    const url = localStorage.getItem('supabase_url') || window.AppConfig.supabaseUrl;
    const key = localStorage.getItem('supabase_key') || window.AppConfig.supabaseKey;

    if (!url || !key) {
      console.warn('❌ Supabase config missing');
      return false;
    }

    this.client = supabase.createClient(url, key);
    console.log('✅ SyncV2 inicializado');
    return true;
  },

  async syncAll() {
    if (this.isSyncing) {
      console.warn('⚠️ Sincronización en curso...');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 SyncV2.syncAll() iniciado');

    try {
      const changed = await this.pullIncremental();
      await this.drainOutbox();
      // Solo notificar UI si realmente hubo datos nuevos
      if (changed && changed.length > 0) {
        this._notifyUI(changed);
      }
    } catch (e) {
      console.error('❌ SyncV2.syncAll() error:', e);
      await window.ErrorLogger?.log('sync.v2.syncAll', e, {}, false);
    } finally {
      this.isSyncing = false;
    }
  },

  async pullIncremental() {
    const tables = window.Constants.REMOTE_TABLE_MAP;
    const changedLocalTables = [];

    for (const [local, remote] of Object.entries(tables)) {
      if (this.syncLocks.has(remote)) continue;
      this.syncLocks.add(remote);

      try {
        const syncState = await window.db.sync_state.get(remote) || { table_name: remote, last_seen_hlc: 0, last_seen_id: 0 };
        let lastHlc = syncState.last_seen_hlc || 0;
        let lastId = syncState.last_seen_id || 0;
        const limit = 1000;
        let totalFetched = 0;
        let iterations = 0;
        const maxIterations = 200;

        while (iterations < maxIterations) {
          // Cursor compuesto (hlc, id): el .gt simple se saltaba filas cuando
          // muchos registros compartían el mismo updated_at_hlc (colisiones por
          // UPDATEs masivos de Postgres que asignan el mismo now() a todas las
          // filas de la transacción). Con (hlc, id) ordenado, la paginación es
          // estable aunque existan cientos de filas con HLC idéntico.
          //
          // Filtro: (hlc > lastHlc) OR (hlc = lastHlc AND id > lastId)
          const orFilter = `updated_at_hlc.gt.${lastHlc},and(updated_at_hlc.eq.${lastHlc},id.gt.${lastId})`;

          const { data, error } = await this.client
            .from(remote)
            .select('*')
            .or(orFilter)
            .order('updated_at_hlc', { ascending: true })
            .order('id', { ascending: true })
            .limit(limit);

          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const remote_rec of data) {
            const local_rec = await window.db[local].get(remote_rec.id);
            const localHlc = this._toHlcNumber(local_rec?.updated_at_hlc);
            const remoteHlc = Number(remote_rec.updated_at_hlc) || 0;
            const shouldApply = !local_rec || localHlc < remoteHlc;

            if (shouldApply) {
              remote_rec.updated_at_hlc = remoteHlc || HLC.encode(HLC.now());
              await window.db[local].put(remote_rec);
            } else if (local_rec && localHlc > remoteHlc && window.db.sync_conflicts) {
              await window.db.sync_conflicts.add({
                table_name: remote,
                record_id: remote_rec.id,
                remote_hlc: remoteHlc,
                local_hlc: localHlc,
                resolution: 'local_kept'
              });
            }

            // Avanzar cursor compuesto al registro procesado
            lastHlc = remoteHlc;
            lastId = Number(remote_rec.id) || 0;
          }

          totalFetched += data.length;
          iterations++;

          if (data.length < limit) break;
        }

        await window.db.sync_state.put({ table_name: remote, last_seen_hlc: lastHlc, last_seen_id: lastId, device_id: DeviceId.get(), updated_at: new Date() });
        if (totalFetched > 0) {
          console.log(`✅ ${remote}: ${totalFetched} registros sincronizados (HLC=${lastHlc})`);
          changedLocalTables.push(local);
        }
      } catch (e) {
        console.error(`❌ Pull error en ${remote}:`, e);
      } finally {
        this.syncLocks.delete(remote);
      }
    }

    return changedLocalTables;
  },

  async drainOutbox() {
    await window.Outbox?.drain();
  },

  async initRealtimeSync() {
    if (!this.client) return;

    const tables = Object.values(window.Constants.REMOTE_TABLE_MAP);
    this._subscribedCount = 0;
    const totalTables = tables.length;

    for (const table of tables) {
      const channel = this.client
        .channel(`sync-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table },
          (payload) => this.handleRealtimeChange(table, payload))
        .subscribe((status, err) => {
          // El callback de subscribe recibe el estado real del canal
          if (status === 'SUBSCRIBED') {
            this._subscribedCount++;
            this.isRealtimeActive = true;
            console.log(`📡 Realtime activo para ${table} (${this._subscribedCount}/${totalTables})`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn(`📡 Realtime ${status} en ${table}`, err || '');
            // Si TODOS los canales fallan, marcar como inactivo
            if (this._subscribedCount === 0) {
              this.isRealtimeActive = false;
            }
          }
        });

      this.realtimeChannels.push(channel);
    }
  },

  async heartbeatRealtime() {
    // Implementado en main.js con setInterval
  },

  async handleRealtimeChange(table, payload) {
    try {
      const { eventType, new: newRec, old: oldRec } = payload;
      const rec = newRec || oldRec;
      const local = window.Constants.REMOTE_TABLE_MAP_REVERSE[table] || table;

      if (!rec) return;

      rec.id = Number(rec.id || rec.key);
      if (isNaN(rec.id)) return;

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const localRec = await window.db[local].get(rec.id);
        const localHlc = this._toHlcNumber(localRec?.updated_at_hlc);
        const remoteHlc = Number(rec.updated_at_hlc) || 0;
        const shouldApply = !localRec || remoteHlc >= localHlc;

        if (shouldApply) {
          rec.updated_at_hlc = remoteHlc;
          await window.db[local].put(rec);
          console.log(`📡✅ ${table}#${rec.id} aplicado`);
        }
      } else if (eventType === 'DELETE') {
        await window.db[local].delete(rec.id);
      }

      this._notifyUI([local]);
    } catch (e) {
      console.error(`❌ Realtime handler error:`, e);
    }
  },

  // Despacha el evento de refresh con debounce (200ms) para agrupar múltiples
  // cambios del Realtime que llegan en ráfaga y evitar re-renders en cascada.
  _notifyUI(tables) {
    if (Array.isArray(tables)) {
      tables.forEach(t => this._pendingNotifyTables.add(t));
    }
    if (this._notifyTimer) return; // Ya hay un timer pendiente, solo acumulamos tablas
    this._notifyTimer = setTimeout(() => {
      this._notifyTimer = null;
      const detail = { tables: [...this._pendingNotifyTables] };
      this._pendingNotifyTables.clear();
      if (detail.tables.length === 0) return; // Nunca disparar si no hay cambios reales
      try { window.dispatchEvent(new CustomEvent('sync-data-updated', { detail })); } catch (e) {}
      try { document.dispatchEvent(new CustomEvent('sync-data-updated', { detail })); } catch (e) {}
    }, 200);
  },

  async closeRealtime() {
    for (const ch of this.realtimeChannels) {
      try { await ch.unsubscribe(); } catch (e) { /* ignorar */ }
    }
    this.realtimeChannels = [];
    this.isRealtimeActive = false;
    this._subscribedCount = 0;
  }
};

// Mapa inverso para Realtime
window.Constants.REMOTE_TABLE_MAP_REVERSE = Object.entries(window.Constants.REMOTE_TABLE_MAP).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
