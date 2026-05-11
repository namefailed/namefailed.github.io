import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

// Rubik pulls three.js in a lazy chunk (~500k+); keep default warning threshold from flagging it on every build.
export default defineConfig({
  /**
   * Pre-bundle Three + OrbitControls so dev never serves a stale `node_modules/.vite/deps/*`
   * hash (504 “Outdated Optimize Dep”) after upgrades or cache drift — which breaks `import('./rubik-window')`.
   */
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js'],
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(repoRoot, 'index.html'),
        static: path.resolve(repoRoot, 'static/index.html'),
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
})
