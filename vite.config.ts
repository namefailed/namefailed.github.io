import { defineConfig } from 'vite'

/** Rubik/`three` chunk is lazy-loaded; tolerate its size in build logs without raising the main-bundle bar. */
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
  },
})
