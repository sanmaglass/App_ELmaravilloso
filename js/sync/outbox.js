// Outbox - Encolamiento confiable de cambios para sincronización
window.Outbox = {
  async enqueue(tableName, op, payload, hlc) {
    try {
      return await window.db.transaction('rw', [window.db[tableName], window.db.sync_outbox], async () => {
        // 1. Actualizar registro local
        payload.updated_at_hlc = typeof hlc === 'number' ? hlc : HLC.encode(hlc || HLC.now());
        payload.updated_by_device = DeviceId.get();
        await window.db[tableName].put(payload);

        // 2. Encolar en outbox
        await window.db.sync_outbox.add({
          tableName,
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

    const pending = await window.db.sync_outbox
      .where('status').equals('pending')
      .toArray();

    if (!pending.length) return;

    console.log(`📤 Drenando ${pending.length} items del outbox...`);

    for (const item of pending) {
      try {
        const payload = JSON.parse(item.payload);
        const { tableName, op } = item;

        if (op === 'PUT') {
          const { error } = await window.SyncV2.client.from(tableName).upsert([payload], { onConflict: 'id' });
          if (error) {
              if (error.code === '23505' || error.code === '409' || String(error.message).includes('409')) {
                  await window.db.sync_outbox.update(item.id, { status: 'error' });
                  console.warn(`[Outbox] Conflicto 409 en ${tableName}#${payload.id}. Descartado.`);
                  continue; // Saltar throw, ya está marcado como error
              }
              throw error;
          }
        } else if (op === 'DELETE') {
          const { error } = await window.SyncV2.client.from(tableName).update({ deleted: true }).eq('id', payload.id);
          if (error) throw error;
        }

        // Marcar como done
        await window.db.sync_outbox.update(item.id, { status: 'done' });
        console.log(`✅ ${tableName}#${payload.id} sincronizado`);
      } catch (e) {
        item.retries++;
        if (item.retries < 5) {
          await window.db.sync_outbox.update(item.id, {
            retries: item.retries,
            status: 'pending'
          });
          console.warn(`⚠️ Reintento ${item.retries}/5 para ${item.tableName}#${JSON.parse(item.payload).id}`);
        } else {
          await window.db.sync_outbox.update(item.id, { status: 'error' });
          console.error(`❌ Máx reintentos para ${item.tableName}, marcado como error`);
          await window.ErrorLogger?.log('sync.outbox.max_retries', e, { item });
        }
        // No hacer break: continuar con los demás items para no bloquear el outbox completo
      }
    }
  }
};
