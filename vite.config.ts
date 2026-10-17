import { cpSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// micro-lc ships as a self-contained bundle (qiankun included) that loads its own
// files relative to itself: assets/composer.js, assets/40x.html, error-lifecycle.js...
// Re-bundling it would scatter those files, so it is served untouched, the way the
// micro-lc docs serve it from a CDN: this copies the package's dist/ into
// public/micro-lc/ (gitignored) on every dev start and build, and index.html loads
// /micro-lc/micro-lc.production.js. The version is the one in package.json.
function microlcStatic(): Plugin {
  const dist = dirname(createRequire(import.meta.url).resolve('@micro-lc/orchestrator/micro-lc.production.js'))
  return {
    name: 'micro-lc-static',
    // config() runs before Vite indexes public/, so dev serves the copy too.
    config() {
      cpSync(dist, fileURLToPath(new URL('./public/micro-lc', import.meta.url)), {
        recursive: true,
        filter: (src) => !/[\\/](es|cjs|types|dev|\.vite)$/.test(src) && !src.endsWith('micro-lc.development.js')
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), microlcStatic()],
  server: { port: 5173 },
  preview: { port: 4173 }
})
