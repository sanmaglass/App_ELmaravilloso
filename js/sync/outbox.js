// Outbox - Encolamiento confiable de cambios para sincronización
window.Outbox = {
  _draining: false,
  _drainStartedAt: 0,
  _DRAIN_TIMEOUT_MS: 120000, // 2 min máx por drain completo
  _THROTTLE_MS: 150, // pausa entre requests a Supabase

  async enqueue(tableName, op, payload, hlc) {
    try {
      return await window.db.transaction('rw', [window.db[tableName], window.db.sync_outbox], async () => {
        // 1. Actualizar registro local
        payload.updated_at_hlc = typeof hlc === 'number' ? hlc : HLC.encode(hlc || HLC.now());
        payload.updated_by_device = DeviceId.get();

        // Inyectar tenant_id si hay sesión autenticada
        const tenantId = window.Auth?.getTenantId();
        if (tenantId && !payload.tenant_id) {
          payload.tenant_id = tenantId;
        }
        await window.db[tableName].put(payload);

        // 2. Encolar en outbox
        const remoteTable = window.Constants?.REMOTE_TABLE_MAP?.[tableName] || tableName;
        await window.db.sync_outbox.add({
          tableName,
          remoteTable,
          op, // 'PUT', 'DELETE'
          payload: JSON.stringify(payload),
          status: 'pending',
          created_at: Date.now(),
          retries: 0
        });
      });
    } catch (e) {
      console.error('❌ Outbox.enqueue falló:', e);
      throw e;
    }
  },

  async drain() {
    if (!window.SyncV2?.client) {
      console.warn('⚠️ SyncV2 no está listo, drain abortado');
      return;
    }

    // Prevenir drain concurrente — con timeout de seguridad
    if (this._draining) {
      if (Date.now() - this._drainStartedAt > this._DRAIN_TIMEOUT_MS) {
        console.warn('⚠️ Drain anterior excedió timeout, reseteando flag');
        this._draining = false;
      } else {
        console.log('⏳ Drain ya en progreso, saltando');
        return;
      }
    }
    this._draining = true;
    this._drainStartedAt = Date.now();

    try {
      const pending = await window.db.sync_outbox
        .where('status').equals('pending')
        .sortBy('created_at');

      if (!pending.length) return;

      console.log(`📤 Drenando ${pending.length} items del outbox...`);

      for (const item of pending) {
        try {
          const payload = JSON.parse(item.payload);
          const { op } = item;
          const remote = item.remoteTable || window.Constants?.REMOTE_TABLE_MAP?.[item.tableName] || item.tableName;

          if (op === 'PUT') {
            const { error } = await window.SyncV2.client.from(remote).upsert([payload], { onConflict: 'id' });
            if (error) {
                if (error.code === '23505' || error.code === '409' || String(error.message).includes('409')) {
                    await window.db.sync_outbox.update(item.id, { status: 'error' });
                    console.warn(`[Outbox] Conflicto 409 en ${item.tableName}#${payload.id}. Descartado.`);
                    continue;
                }
                throw error;
            }
          } else if (op === 'DELETE') {
            const { error } = await window.SyncV2.client.from(remote).update({ deleted: true }).eq('id', payload.id);
            if (error) throw error;
          }

          // Marcar como done
          await window.db.sync_outbox.update(item.id, { status: 'done' });
          console.log(`✅ ${item.tableName}#${payload.id} sincronizado`);

          // Throttle: pausa entre requests para no saturar Supabase
          if (this._THROTTLE_MS > 0) await new Promise(r => setTimeout(r, this._THROTTLE_MS));
        } catch (e) {
          item.retries++;
          if (item.retries < 5) {
            await window.db.sync_outbox.update(item.id, {
              retries: item.retries,
              status: 'pending'
            });
            const retryId = (() => { try { return JSON.parse(item.payload).id; } catch (_) { return '?'; } })();
            console.warn(`⚠️ Reintento ${item.retries}/5 para ${item.tableName}#${retryId}`);
          } else {
            await window.db.sync_outbox.update(item.id, { status: 'error' });
            console.error(`❌ Máx reintentos para ${item.tableName}, marcado como error`);
            await window.ErrorLogger?.log('sync.outbox.max_retries', e, { item });
          }
        }
      }

      // Reintentar errores antiguos (>1h) con retry count reseteado
      const errorCutoff = Date.now() - 60 * 60 * 1000;
      const staleErrors = await window.db.sync_outbox
          .where('status').equals('error')
          .filter(item => item.created_at < errorCutoff)
          .toArray();

      for (const item of staleErrors) {
          await window.db.sync_outbox.update(item.id, { status: 'pending', retries: 0 });
      }
      if (staleErrors.length) console.log(`♻️ ${staleErrors.length} errores antiguos re-encolados`);

      // Purgar registros completados con más de 24h
      await this.purge();
    } finally {
      this._draining = false;
    }
  },

  async purge() {
    try {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const old = await window.db.sync_outbox
        .where('status').anyOf(['done', 'error'])
        .filter(item => item.created_at < cutoff)
        .toArray();
      if (old.length > 0) {
        await window.db.sync_outbox.bulkDelete(old.map(i => i.id));
        console.log(`🧹 Outbox: purgados ${old.length} registros antiguos`);
      }
    } catch (e) {
      console.warn('⚠️ Outbox.purge falló:', e);
    }
  }
};
