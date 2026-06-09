/**
 * Split src/style.css into src/styles/*.css by top-level section headers only.
 * Ignores indented sub-headers inside :root (e.g. UI tokens comment).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcStyle = path.join(root, 'src', 'style.css')
const stylesDir = path.join(root, 'src', 'styles')

const TOP_SECTION = /^\/\* ── .+ ─{20,}/gm

const SLUG = {
  reset: 'reset',
  'crt-style monitor shell': 'monitor',
  'retro crt layer': 'retro-fx',
  'desktop (the wm workspace': 'desktop',
  'top panel': 'yasb',
  'launcher overlay': 'launcher',
  maximize: 'maximize',
  panes: 'panes',
  splitters: 'splitters',
  'window chrome': 'window-chrome',
  'title bar': 'titlebar',
  'traffic lights': 'traffic-lights',
  'window title': 'window-title',
  'terminal area': 'terminal',
  'xterm overrides': 'xterm',
  'content window body': 'content-body',
  'contact tile': 'contact-tile',
  'projects window': 'projects-window',
  'mini-vim editor': 'editor',
  'file explorer': 'file-explorer',
  'embedded browser': 'browser-tile',
  'floating dock': 'dock',
  'shared toolbar buttons': 'toolbar',
  'phosphor flicker': 'phosphor',
  'narrow viewports': 'narrow',
  'paint / cube / snake / pong': 'games',
  'motion accessibility': 'motion-a11y',
  'p5.js viewer': 'p5-viewer',
  'boot splash': 'boot-splash',
  'desktop tiles': 'desktop-tiles',
  'welcome guide': 'welcome-guide',
  'folder popup': 'folder-popup',
  'hint bubbles': 'hint-bubbles',
  'p5.js first-open tip': 'p5-tip',
  'settings panel action': 'settings-panel',
}

function slugFor(headerLine) {
  const inner = headerLine.replace(/^\/\*+\s*/, '').replace(/\s*─+.*/, '').trim().toLowerCase()
  for (const [key, slug] of Object.entries(SLUG)) {
    if (inner.includes(key)) return slug
  }
  return inner.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section'
}

const raw = fs.readFileSync(srcStyle, 'utf8')
const starts = [...raw.matchAll(TOP_SECTION)].map((m) => m.index ?? 0)
if (starts.length === 0) {
  console.error('No top-level sections found — is style.css already an @import hub?')
  process.exit(1)
}

const chunks = starts.map((start, i) => raw.slice(start, starts[i + 1] ?? raw.length).trimEnd())

if (!fs.existsSync(stylesDir)) fs.mkdirSync(stylesDir, { recursive: true })
for (const f of fs.readdirSync(stylesDir)) {
  if (f.endsWith('.css')) fs.unlinkSync(path.join(stylesDir, f))
}

const imports = []
const used = new Map()

for (const chunk of chunks) {
  const firstLine = chunk.split('\n')[0] ?? 'section'
  let slug = slugFor(firstLine)
  const n = (used.get(slug) ?? 0) + 1
  used.set(slug, n)
  if (n > 1) slug = slug + '-' + String(n)
  const file = slug + '.css'
  fs.writeFileSync(path.join(stylesDir, file), chunk + '\n', 'utf8')
  imports.push("@import './styles/" + file + "';")
}

const hub =
  '/* Desktop shell styles — split into src/styles/ (run: node scripts/split-style-css.mjs) */\n\n' +
  imports.join('\n') +
  '\n'
fs.writeFileSync(srcStyle, hub, 'utf8')
console.log('Split ' + String(chunks.length) + ' top-level sections into src/styles/')
