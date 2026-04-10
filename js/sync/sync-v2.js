// Sync v2: Pull incremental + HLC + Realtime robusto + Outbox
window.SyncV2 = {
  client: null,
  isSyncing: false,
  realtimeChannels: [],
  isRealtimeActive: false,
  syncLocks: new Set(),

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
      await this.pullIncremental();
      await this.drainOutbox();
      window.dispatchEvent(new CustomEvent('sync-data-updated', { detail: { tables: [] } }));
    } catch (e) {
      console.error('❌ SyncV2.syncAll() error:', e);
      await window.ErrorLogger?.log('sync.v2.syncAll', e, {}, false);
    } finally {
      this.isSyncing = false;
    }
  },

  async pullIncremental() {
    const tables = window.Constants.REMOTE_TABLE_MAP;

    for (const [local, remote] of Object.entries(tables)) {
      if (this.syncLocks.has(remote)) continue;
      this.syncLocks.add(remote);

      try {
        const syncState = await window.db.sync_state.get(remote) || { table_name: remote, last_seen_hlc: 0 };
        let lastHlc = syncState.last_seen_hlc || 0;
        let offset = 0;
        const limit = 1000;

        while (true) {
          let query = this.client.from(remote).select('*').gt('updated_at_hlc', lastHlc).order('updated_at_hlc', { ascending: true }).limit(limit).range(offset, offset + limit - 1);
          const { data, error } = await query;

          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const remote_rec of data) {
            const local_rec = await window.db[local].get(remote_rec.id);
            const shouldApply = !local_rec || HLC.encode(local_rec.updated_at_hlc || { physical: 0, logical: 0 }) < remote_rec.updated_at_hlc;

            if (shouldApply) {
              remote_rec.updated_at_hlc = remote_rec.updated_at_hlc || HLC.encode(HLC.now());
              await window.db[local].put(remote_rec);
            } else if (local_rec && HLC.encode(local_rec.updated_at_hlc || { physical: 0, logical: 0 }) > remote_rec.updated_at_hlc) {
              // Conflicto: local ganó
              await window.db.sync_conflicts.add({
                table_name: remote,
                record_id: remote_rec.id,
                remote_hlc: remote_rec.updated_at_hlc,
                local_hlc: HLC.encode(local_rec.updated_at_hlc),
                resolution: 'local_kept'
              });
            }
            lastHlc = Math.max(lastHlc, remote_rec.updated_at_hlc);
          }

          if (data.length < limit) break;
          offset += limit;
        }

        await window.db.sync_state.put({ table_name: remote, last_seen_hlc: lastHlc, device_id: DeviceId.get(), updated_at: new Date() });
        console.log(`✅ ${remote}: Sincronizado hasta HLC ${lastHlc}`);
      } catch (e) {
        console.error(`❌ Pull error en ${remote}:`, e);
      } finally {
        this.syncLocks.delete(remote);
      }
    }
  },

  async drainOutbox() {
    await window.Outbox?.drain();
  },

  async initRealtimeSync() {
    if (!this.client) return;

    const tables = Object.values(window.Constants.REMOTE_TABLE_MAP);

    for (const table of tables) {
      const channel = this.client
        .channel(`sync-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table },
          (payload) => this.handleRealtimeChange(table, payload))
        .on('status', (status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`📡 Realtime activo para ${table}`);
            this.isRealtimeActive = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`📡 Error realtime en ${table}: ${status}`);
          }
        })
        .subscribe();

      this.realtimeChannels.push(channel);
    }

    // Reconexión con backoff
    setTimeout(() => this.heartbeatRealtime(), 30000);
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
        const shouldApply = !localRec || (rec.updated_at_hlc >= (HLC.encode(localRec.updated_at_hlc || { physical: 0, logical: 0 })));

        if (shouldApply) {
          await window.db[local].put(rec);
          console.log(`📡✅ ${table}#${rec.id} aplicado`);
        }
      } else if (eventType === 'DELETE') {
        await window.db[local].delete(rec.id);
      }

      window.dispatchEvent(new CustomEvent('sync-data-updated', { detail: { tables: [local] } }));
    } catch (e) {
      console.error(`❌ Realtime handler error:`, e);
    }
  },

  async closeRealtime() {
    for (const ch of this.realtimeChannels) {
      await ch.unsubscribe();
    }
    this.realtimeChannels = [];
    this.isRealtimeActive = false;
  }
};

// Mapa inverso para Realtime
window.Constants.REMOTE_TABLE_MAP_REVERSE = Object.entries(window.Constants.REMOTE_TABLE_MAP).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});
