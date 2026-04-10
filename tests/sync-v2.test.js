// Tests para SyncV2
console.log('🧪 Iniciando tests de SyncV2...');

describe('SyncV2', () => {
  it('DeviceId debería generar UUID v4 único', () => {
    const id1 = window.DeviceId.get();
    const id2 = window.DeviceId.get();
    assert(id1 === id2, 'ID debe ser estable');
    assert(/^[0-9a-f-]{36}$/.test(id1), 'Debe ser UUID válido');
  });

  it('HLC debería ser monotónico', () => {
    const h1 = HLC.now();
    const h2 = HLC.now();
    assert(HLC.compare(h2, h1) >= 0, 'HLC debe ser monotónico');
  });

  it('HLC.receive debería manejar timestamps remotos', () => {
    const local = HLC.now();
    const remote = { physical: local.physical + 1000, logical: 0 };
    const merged = HLC.receive(remote);
    assert(merged.physical >= remote.physical, 'Debe avanzar reloj');
  });

  it('Outbox debería encolar cambios', async () => {
    await window.db.sync_outbox.clear();
    const mock = { id: 1, name: 'Test' };
    await window.Outbox.enqueue('products', 'PUT', mock, HLC.now());
    const pending = await window.db.sync_outbox.where('status').equals('pending').toArray();
    assert(pending.length === 1, 'Debe haber 1 pending');
  });

  it('SyncV2.init debería conectar a Supabase', async () => {
    const result = await window.SyncV2.init();
    assert(result, 'Debe inicializar correctamente');
    assert(window.SyncV2.client, 'Client debe estar listo');
  });
});

async function runTests() {
  try {
    for (const [name, fn] of Object.entries(window.describe._tests || {})) {
      try {
        await fn();
        console.log(`✅ ${name}`);
      } catch (e) {
        console.error(`❌ ${name}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Test runner error:', e);
  }
}

// Mock assert
window.assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// Mock describe
window.describe = function(name, fn) {
  window.describe._tests = window.describe._tests || {};
  // Noop, evaluamos inline
};
