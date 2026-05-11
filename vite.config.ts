import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

// Rubik pulls three.js in a lazy chunk (~500k+); keep default warning threshold from flagging it on every build.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(repoRoot, 'index.html'),
        static: path.resolve(repoRoot, 'static/index.html'),
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
