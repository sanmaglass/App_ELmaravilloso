// Outbox - Encolamiento confiable de cambios para sincronización
window.Outbox = {
  async enqueue(tableName, op, payload, hlc) {
    try {
      const tx = window.db.transaction(['rw', tableName, 'sync_outbox'], async () => {
        // 1. Actualizar registro local
        payload.updated_at_hlc = HLC.encode(hlc);
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
      return await tx;
    } catch (e) {
      console.error('❌ Outbox.enqueue falló:', e);
      throw e;
    }
  },

  async drain() {
    if (!window.Sync?.client) {
      console.warn('⚠️ Sync no está listo, drain abortado');
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
          await window.Sync.client.from(tableName).upsert([payload], { onConflict: 'id' });
        } else if (op === 'DELETE') {
          await window.Sync.client.from(tableName).update({ deleted: true }).eq('id', payload.id);
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
        break; // Detener en primer error para mantener orden
      }
    }
  }
};
