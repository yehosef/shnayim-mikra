import { defineConfig } from 'vitest/config'

// Security-rules tests against the Firestore emulator. Run through
// `npm run test:rules` (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST);
// excluded from the plain `npm test`, which CI runs without an emulator.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false
  }
})
