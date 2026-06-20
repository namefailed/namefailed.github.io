import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

/** Dev-only: MPA entries need trailing slashes; unknown paths fall back to desktop `index.html`. */
function brochureRouteRedirects(): Plugin {
  const redirects: Record<string, string> = {
    '/phoeme': '/phoeme/',
    '/phoneme': '/phoeme/',
    '/phoneme/': '/phoeme/',
    '/static': '/static/',
  }

  return {
    name: 'brochure-route-redirects',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        const target = redirects[pathname]
        if (!target) {
          next()
          return
        }
        const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
        res.statusCode = 302
        res.setHeader('Location', `${target}${qs}`)
        res.end()
      })
    },
  }
}

// Rubik pulls three.js in a lazy chunk (~500k+); keep default warning threshold from flagging it on every build.
export default defineConfig({
  plugins: [brochureRouteRedirects()],
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
        phoeme: path.resolve(repoRoot, 'phoeme/index.html'),
        phoneme: path.resolve(repoRoot, 'phoneme/index.html'),
      },
    },
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/vitest-dom-setup.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      // Floor a few points under current (DOM-heavy tiles run thin in Node) so a
      // real regression trips CI without flaking. Raise as coverage grows.
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 64,
        lines: 72,
      },
    },
  },
})
