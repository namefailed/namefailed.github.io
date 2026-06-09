import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

// Rubik pulls three.js in a lazy chunk (~500k+); keep default warning threshold from flagging it on every build.
export default defineConfig({
  /**
   * Pre-bundle cubing.js (TwistyPlayer + scramble worker) for stable lazy chunk loads.
   */
  optimizeDeps: {
    include: ['cubing/twisty', 'cubing/scramble', 'cubing/alg'],
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(repoRoot, 'index.html'),
        static: path.resolve(repoRoot, 'static/index.html'),
      },
    },
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
