import { defineConfig } from 'vite'

// Rubik pulls three.js in a lazy chunk (~500k+); keep default warning threshold from flagging it on every build.
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
  },
})
