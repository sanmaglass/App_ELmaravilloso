// jest.setup.cjs
// Configuración de fake-indexeddb para que Dexie funcione en Jest (Node/jsdom)

// Polyfill global de IndexedDB con fake-indexeddb
const fakIndexedDB = require('fake-indexeddb');
const FakeIDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Asignar globales para que Dexie y los tests encuentren IndexedDB
global.indexedDB = fakIndexedDB;
global.IDBKeyRange = FakeIDBKeyRange;

// Opcional: silenciar avisos de deprecación si los hay
if (global.console && global.console.warn) {
  const originalWarn = global.console.warn;
  global.console.warn = (...args) => {
    // Filtrar avisos específicos si es necesario
    if (!args.toString().includes('deprecation')) {
      originalWarn(...args);
    }
  };
}
