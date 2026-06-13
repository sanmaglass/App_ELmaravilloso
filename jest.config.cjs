module.exports = {
  // Entorno de prueba para testing en el navegador sin navegador real
  testEnvironment: 'jsdom',

  // Patrón para encontrar archivos de test
  testMatch: ['**/tests/**/*.test.js'],

  // Configuración de módulos (fake-indexeddb para Dexie)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  // Resolver módulos de Node (fs, path) para tests que leen archivos
  moduleFileExtensions: ['js'],

  // Verbosidad
  verbose: true,

  // Timeout para tests que hacen operaciones asincrónicas
  testTimeout: 10000,
};
