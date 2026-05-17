/**
 * In-browser virtual filesystem persisted to `localStorage`.
 *
 * The tree is a plain JSON object — directories are `{ t: 'd', c: Record<string, FsNode> }` and
 * files are `{ t: 'f', body: string }`. All path operations go through `vfsNormalize` which
 * resolves `.`/`..` and collapses duplicate slashes, so callers never need to canonicalize paths
 * themselves.
 *
 * Persistence: mutating operations trigger a debounced `save()` which serialises the whole tree to
 * `localStorage`. Reads call `load()` once at module init. `vfsReloadFromStorage()` is exposed
 * for the `cookies` command to sync after an external change.
 *
 * Terminal builtins (`cat`, `cd`, `ls`, `mkdir`, `rm`, `touch`, `cp`, `mv`) and the `edit` tile
 * all read/write through the exports below.
 */

import { storageGet, storageSet } from './storage'
import { P5_EXAMPLES, sketchFilename } from './p5-sketches'

/**
 * Bumped on each schema change so older saves don't shadow new default content.
 *   v3 — removed welcome.txt
 *   v4 — seeded /home/namefailed/sketches/ with the p5 example library
 *   v5 — renamed sketches/ → p5.js sketches/
 *   v6 — added wallpapers/ folder with theme-matched Unsplash URLs
 *   v7 — added midnight.jpg wallpaper
 */
const STORAGE_KEY = 'portfolio-vfs-v7-namefailed-home'

/** Debounce delay for VFS saves to reduce localStorage writes during rapid operations. */
const SAVE_DEBOUNCE_MS = 150

/** Shared encoder — avoids per-call instantiation in `vfsLsLong` and `vfsPersistedFootprint`. */
const encoder = new TextEncoder()

/** Month abbreviations used by `vfsLsLong` — declared once at module scope. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const FS_HOME = '/home/namefailed'

type FsDir = { t: 'd'; c: Record<string, FsNode> }
type FsFile = { t: 'f'; body: string }
export type FsNode = FsDir | FsFile

interface FsState {
  cwd: string
  root: FsDir
}

function emptyDir(): FsDir {
  return { t: 'd', c: {} }
}

function defaultRoot(): FsDir {
  const root = emptyDir()
  const etc = emptyDir()
  etc.c['hostname'] = { t: 'f', body: 'mrgrey.site\n' }
  etc.c['os-release'] = {
    t: 'f',
    body:
      'NAME="Portfolio OS"\nVERSION="1.0 (browser)"\nID=portfolio\nPRETTY_NAME="Portfolio GNU/Linux 1.0"\n',
  }
  root.c['etc'] = etc

  const home = emptyDir()
  const user = emptyDir()
  user.c['notes.txt'] = {
    t: 'f',
    body: 'Nothing here yet — touch notes.txt is already taken.\n',
  }
  const mkEmptyDir = (): FsDir => ({ t: 'd', c: {} })
  const desk = mkEmptyDir()
  desk.c['.keep'] = { t: 'f', body: '' }
  user.c['Desktop'] = desk
  const docs = mkEmptyDir()
  docs.c['readme.txt'] = {
    t: 'f',
    body: 'Fake Documents — drop ideas for portfolio copy or client notes here.\n',
  }
  user.c['Documents'] = docs
  const dl = mkEmptyDir()
  dl.c['.keep'] = { t: 'f', body: '' }
  user.c['Downloads'] = dl
  const pics = mkEmptyDir()
  pics.c['.keep'] = { t: 'f', body: '' }
  user.c['Pictures'] = pics

  // Seed the bundled p5 sketches. Double-clicking these in the file explorer
  // launches the p5 viewer; the same set also shows in the viewer's Examples
  // dropdown so the two paths stay in sync.
  //
  // _template.js is a minimal copy-paste starting point for new sketches —
  // open the editor (`:e ~/sketches/myidea.js`), paste from this template,
  // then press F5 to play in p5.
  const sketches = mkEmptyDir()
  sketches.c['_template.js'] = {
    t: 'f',
    body: `// Minimal p5.js template — copy to a new filename and edit.
// In the editor: press F5 or :run to play this in the p5 viewer.

let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(240, 25, 8);
}

function draw() {
  background(240, 25, 8, 12);
  translate(width / 2, height / 2);
  const r = 100 + sin(t) * 60;
  noFill();
  stroke((t * 40) % 360, 75, 95);
  strokeWeight(2);
  circle(0, 0, r * 2);
  t += 0.02;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
`,
  }
  for (const ex of P5_EXAMPLES) {
    sketches.c[sketchFilename(ex.label)] = { t: 'f', body: ex.code }
  }
  user.c['p5.js sketches'] = sketches

  // Wallpapers — each file body is a plain image URL.
  // The file-explorer treats any .jpg/.png/.webp as an image and shows
  // "set as wallpaper" instead of "open in editor" for these files.
  const walls = mkEmptyDir()
  const wp = (url: string): FsFile => ({ t: 'f', body: url })
  walls.c['mocha.jpg']        = wp('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80')
  walls.c['dracula.jpg']      = wp('https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80')
  walls.c['nord.jpg']         = wp('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')
  walls.c['gruvbox.jpg']      = wp('https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80')
  walls.c['tokyo-night.jpg']  = wp('https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80')
  walls.c['solarized.jpg']    = wp('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')
  walls.c['one-dark.jpg']     = wp('https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80')
  walls.c['cherry-blossom.jpg'] = wp('https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1920&q=80')
  walls.c['midnight.jpg']       = wp('https://images.unsplash.com/photo-1632230997264-b2bfc65cb8b4?w=1920&q=80')
  user.c['wallpapers'] = walls

  const cfg = mkEmptyDir()
  cfg.c['user-dirs.dirs'] = {
    t: 'f',
    body: '# XDG nonsense for tourists\nXDG_DESKTOP_DIR="$HOME/Desktop"\n',
  }
  user.c['.config'] = cfg
  home.c['namefailed'] = user
  root.c['home'] = home

  const tmp = emptyDir()
  tmp.c['.keep'] = { t: 'f', body: '' }
  root.c['tmp'] = tmp

  return root
}

let state: FsState = {
  cwd: FS_HOME,
  root: defaultRoot(),
}

/** Last cwd before each successful `cd` (POSIX OLDPWD — used by `cd -` and printed from `pwd`). */
let vfsOldPwd: string | null = null

/** Pending save timeout handle for debouncing. */
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function load(): void {
  const raw = storageGet(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as FsState
    if (parsed && parsed.root && parsed.root.t === 'd' && typeof parsed.cwd === 'string') {
      state = parsed
    }
  } catch {
    /* keep defaults */
  }
}

/** Trigger a debounced save. Accumulates rapid changes into a single localStorage write. */
function save(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    storageSet(STORAGE_KEY, JSON.stringify(state))
  }, SAVE_DEBOUNCE_MS)
}

/** Synchronous save for operations that need immediate persistence (e.g., vfsReloadFromStorage). */
function saveSync(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  storageSet(STORAGE_KEY, JSON.stringify(state))
}

load()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (saveTimeout) saveSync()
  })
}

/** Re-read tree + cwd from `localStorage` (drops any in-memory-only drift since last `save`). */
export function vfsReloadFromStorage(): string | null {
  vfsOldPwd = null
  load()
  const hit = walk(state.cwd)
  if (!hit?.node || hit.node.t !== 'd') {
    state.cwd = FS_HOME
    saveSync()
    return 'working directory reset to ~ (saved cwd no longer exists)'
  }
  return null
}

export function vfsPwd(): string {
  return state.cwd
}

/**
 * Resolve `input` to an absolute path.
 *
 * - Absolute paths (starting with `/`) are used as-is.
 * - Relative paths are resolved against the current working directory.
 * - `.` and `..` segments are collapsed. Multiple consecutive slashes are treated as one.
 *
 * The result always starts with `/` and never has a trailing slash (except for `/` itself).
 */
export function vfsNormalize(input: string): string {
  const base = input.startsWith('/') ? input : `${state.cwd.replace(/\/$/, '')}/${input}`
  const parts: string[] = []
  for (const seg of base.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      parts.pop()
      continue
    }
    parts.push(seg)
  }
  return '/' + parts.join('/')
}

function walk(abs: string): { parent: FsDir; name: string; node: FsNode | null } | null {
  const parts = abs.split('/').filter(Boolean)
  if (parts.length === 0) return { parent: state.root, name: '', node: state.root }

  let cur: FsDir = state.root
  for (let i = 0; i < parts.length - 1; i++) {
    const n = cur.c[parts[i]!]
    if (!n || n.t !== 'd') return null
    cur = n
  }
  const name = parts[parts.length - 1]!
  const node = cur.c[name] ?? null
  return { parent: cur, name, node }
}

/** When `all`, prepend `.` and `..` (see `ls -a`). */
export interface VfsLsOptions {
  all?: boolean
}

/** `ls -l` row — timestamps are thematic fiction. */
export interface VfsLongEntry {
  mode: string
  nlink: number
  size: number
  mon: string
  day: string
  hhmm: string
  name: string
}

export function vfsLs(target?: string, opts?: VfsLsOptions): string[] {
  const path = target ? vfsNormalize(target) : state.cwd
  const hit = walk(path)
  if (!hit?.node) return [`ls: cannot access ${target ?? '.'}: No such file or directory`]
  if (hit.node.t !== 'd') return [`ls: ${path}: Not a directory`]
  const names = Object.keys(hit.node.c).sort()
  if (opts?.all) return ['.', '..', ...names]
  return names
}

function parentAbsOf(pathNorm: string): string {
  const parts = pathNorm.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return '/' + parts.slice(0, -1).join('/')
}

/** Long listing (`ls -l`); deterministic fake mtimes keyed off names. */
export function vfsLsLong(target?: string, opts?: VfsLsOptions): VfsLongEntry[] | string[] {
  const path = target ? vfsNormalize(target) : state.cwd
  const hit = walk(path)
  if (!hit?.node) return [`ls: cannot access ${target ?? '.'}: No such file or directory`]
  if (hit.node.t !== 'd') return [`ls: ${path}: Not a directory`]

  const entries: Array<{ node: FsNode; name: string }> = []
  if (opts?.all) {
    const pAbs = parentAbsOf(path)
    const pHit = walk(pAbs)
    const parentDir = pHit?.node?.t === 'd' ? pHit.node : state.root
    entries.push({ node: hit.node, name: '.' })
    entries.push({ node: parentDir, name: '..' })
  }

  const dir = hit.node
  const names = Object.keys(dir.c).sort()
  for (const n of names) entries.push({ node: dir.c[n]!, name: n })

  const rows: VfsLongEntry[] = []
  let i = 0
  for (const { node, name } of entries) {
    const isDir = node.t === 'd'
    const seed = [...name].reduce((a, ch) => a + ch.charCodeAt(0), i * 13)
    const mon = MONTHS[seed % 12]
    const day = String((seed % 27) + 1).padStart(2, '0')
    const hh = String((seed * 3) % 24).padStart(2, '0')
    const mm = String((seed * 7) % 60).padStart(2, '0')

    const size = isDir ? 4096 : encoder.encode(node.body).length
    const mode = isDir ? 'drwxr-xr-x' : '-rw-r--r--'

    rows.push({
      mode,
      nlink: isDir ? 3 + (seed % 2) : 1,
      size,
      mon,
      day,
      hhmm: `${hh}:${mm}`,
      name,
    })
    i++
  }
  return rows
}

/** Walk the tree for nerd stats (cookies command, faux `df`). */
export function vfsPersistedFootprint(): { files: number; dirs: number; jsonBytes: number } {
  function count(dir: FsDir): { dirs: number; files: number } {
    let dirs = 1
    let files = 0
    for (const n of Object.values(dir.c)) {
      if (n.t === 'd') {
        const s = count(n)
        dirs += s.dirs
        files += s.files
      } else files++
    }
    return { dirs, files }
  }
  const { dirs, files } = count(state.root)
  let jsonBytes = 0
  try {
    jsonBytes = encoder.encode(JSON.stringify(state)).length
  } catch {
    jsonBytes = 0
  }
  return { files, dirs, jsonBytes }
}

export interface VfsListEntry {
  name: string
  kind: 'd' | 'f'
}

/** Directory listing with types — dirs first — for the file explorer UI */
export function vfsListEntries(absDir: string): { ok: true; entries: VfsListEntry[] } | { ok: false; msg: string } {
  const path = vfsNormalize(absDir)
  const hit = walk(path)
  if (!hit?.node) return { ok: false, msg: `Cannot open ${path}` }
  if (hit.node.t !== 'd') return { ok: false, msg: 'Not a directory' }
  const entries: VfsListEntry[] = []
  for (const name of Object.keys(hit.node.c)) {
    const node = hit.node.c[name]!
    entries.push({ name, kind: node.t === 'd' ? 'd' : 'f' })
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'd' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { ok: true, entries }
}

export type VfsCdResult =
  | { ok: true; jumpedFromDash?: string }
  | { ok: false; msg: string }

export function vfsCd(rawPath: string): VfsCdResult {
  const path = rawPath.trim()
  if (!path || path === '~') {
    vfsOldPwd = state.cwd
    state.cwd = FS_HOME
    save()
    return { ok: true }
  }
  if (path === '-') {
    if (vfsOldPwd == null) return { ok: false, msg: 'cd: OLDPWD not set (need one hop first)' }
    const target = vfsOldPwd
    const fmt = vfsFormatPath(target)
    const hit = walk(target)
    if (!hit?.node || hit.node.t !== 'd') {
      return { ok: false, msg: 'cd: OLDPWD vanished from disk (cookies clear?)' }
    }
    vfsOldPwd = state.cwd
    state.cwd = target
    save()
    return { ok: true, jumpedFromDash: fmt }
  }

  const abs = vfsNormalize(path)
  const hit = walk(abs)
  if (!hit?.node)
    return { ok: false, msg: `cd: ${path}: No such file or directory` }
  if (hit.node.t !== 'd') return { ok: false, msg: `cd: ${path}: Not a directory` }
  vfsOldPwd = state.cwd
  state.cwd = abs.replace(/\/$/, '') || '/'
  save()
  return { ok: true }
}

/**
 * Read a file and return its content as a display string.
 *
 * Returns an error message string (not `null`) when the path does not exist or is a directory,
 * matching the POSIX `cat` convention of printing to stdout. Returns `'(empty file)'` for a
 * zero-byte file so the terminal always has something to render.
 */
export function vfsCat(path: string): string | null {
  const abs = vfsNormalize(path)
  const hit = walk(abs)
  if (!hit?.node) return `cat: ${path}: No such file or directory`
  if (hit.node.t !== 'f') return `cat: ${path}: Is a directory`
  return hit.node.body.replace(/\n$/, '') || '(empty file)'
}

/** Raw bytes for editor — preserves exact `body` string */
export function vfsReadRaw(
  path: string,
): { ok: true; abs: string; body: string } | { ok: false; msg: string } {
  const abs = vfsNormalize(path)
  const hit = walk(abs)
  if (!hit?.node) return { ok: false, msg: `${path}: No such file or directory` }
  if (hit.node.t !== 'f') return { ok: false, msg: `${path}: Is a directory` }
  return { ok: true, abs, body: hit.node.body }
}

/**
 * Create or overwrite a regular file at `path`.
 *
 * The parent directory must already exist. Returns `null` on success or an error message string
 * on failure (parent missing, `path` is a directory, or the path is invalid).
 */
export function vfsWrite(path: string, body: string): string | null {
  const abs = vfsNormalize(path)
  const parts = abs.split('/').filter(Boolean)
  if (parts.length === 0) return 'Invalid path'

  const leaf = parts.pop()!
  let cur = state.root
  for (const p of parts) {
    const n = cur.c[p]
    if (!n || n.t !== 'd') return `Cannot write '${path}': No such file or directory`
    cur = n
  }
  const existing = cur.c[leaf]
  if (existing?.t === 'd') return `'${path}' is a directory`
  cur.c[leaf] = { t: 'f', body }
  save()
  return null
}

export function vfsFormatPath(abs: string): string {
  if (abs === FS_HOME || abs.startsWith(FS_HOME + '/')) {
    const rest = abs.slice(FS_HOME.length)
    return ('~' + rest).replace(/\/?$/, '') || '~'
  }
  return abs || '/'
}

export function vfsOldPwdFormatted(): string | null {
  return vfsOldPwd == null ? null : vfsFormatPath(vfsOldPwd)
}

export function vfsTouch(path: string): string | null {
  const abs = vfsNormalize(path)
  const parts = abs.split('/').filter(Boolean)
  if (parts.length === 0) return 'touch: invalid path'
  const leaf = parts.pop()!
  let cur = state.root
  for (const p of parts) {
    const n = cur.c[p]
    if (!n) return `touch: cannot touch '${path}': No such file or directory`
    if (n.t !== 'd') return `touch: '${path}': Not a directory`
    cur = n
  }
  if (!cur.c[leaf]) cur.c[leaf] = { t: 'f', body: '' }
  save()
  return null
}

export function vfsMkdir(path: string): string | null {
  const abs = vfsNormalize(path)
  const parts = abs.split('/').filter(Boolean)
  if (parts.length === 0) return 'mkdir: invalid path'

  let cur = state.root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!
    const n = cur.c[p]
    if (!n) return `mkdir: cannot create directory '${path}': No such file or directory`
    if (n.t !== 'd') return `mkdir: '${path}': Not a directory`
    cur = n
  }
  const leaf = parts[parts.length - 1]!
  if (cur.c[leaf]) {
    if (cur.c[leaf]!.t === 'd') return `mkdir: cannot create directory '${path}': File exists`
    return `mkdir: '${path}': File exists`
  }
  cur.c[leaf] = emptyDir()
  save()
  return null
}

export function vfsRm(path: string): string | null {
  const abs = vfsNormalize(path)
  const hit = walk(abs)
  if (!hit?.node || !hit.name) return `rm: cannot remove ${path}: No such file or directory`
  delete hit.parent.c[hit.name]
  save()
  return null
}

function cloneSubtree(node: FsNode): FsNode {
  if (node.t === 'f') return { t: 'f', body: node.body }
  const next: FsDir = { t: 'd', c: {} }
  for (const [key, child] of Object.entries(node.c)) next.c[key] = cloneSubtree(child)
  return next
}

/**
 * Rename or move — `dstParentDir` must be a directory.
 * Uses `basename` when provided, else carries the leaf name from `srcAbs`.
 */
export function vfsMoveIntoDirectory(
  srcAbs: string,
  dstParentDir: string,
  basename?: string,
): string | null {
  const src = vfsNormalize(srcAbs)
  const dstP = vfsNormalize(dstParentDir)
  const hitS = walk(src)
  if (!hitS?.node || !hitS.name) return `No such source: ${srcAbs}`
  const hitD = walk(dstP)
  if (!hitD?.node) return `No such folder: ${dstParentDir}`
  if (hitD.node.t !== 'd') return 'Destination parent is not a directory'

  if (hitS.node.t === 'd' && (dstP === src || dstP.startsWith(src + '/'))) return 'Cannot move a folder into itself'

  let base = (basename?.trim() || hitS.name).replace(/\\/g, '/')
  if (!base || base.includes('/')) return 'Invalid name'
  const parentObj = hitD.node
  if (hitS.parent === parentObj && hitS.name === base) return null
  if (parentObj.c[base]) return `'${base}' already exists`

  parentObj.c[base] = hitS.node
  delete hitS.parent.c[hitS.name]
  save()
  return null
}

/** Deep-copy a file or directory under `dstParentDir` using optional `basename`. */
export function vfsCopyIntoDirectory(
  srcAbs: string,
  dstParentDir: string,
  basename?: string,
): string | null {
  const src = vfsNormalize(srcAbs)
  const dstP = vfsNormalize(dstParentDir)
  const hitS = walk(src)
  if (!hitS?.node || !hitS.name) return `No such source: ${srcAbs}`
  const hitD = walk(dstP)
  if (!hitD?.node) return `No such folder: ${dstParentDir}`
  if (hitD.node.t !== 'd') return 'Destination parent is not a directory'

  let base = (basename?.trim() || hitS.name).replace(/\\/g, '/')
  if (!base || base.includes('/')) return 'Invalid name'
  if (hitD.node.c[base]) return `'${base}' already exists`

  hitD.node.c[base] = cloneSubtree(hitS.node)
  save()
  return null
}

/** Prompt fragment: ~/foo when under home */
export function vfsPromptPath(): string {
  let p = state.cwd
  if (p === FS_HOME || p.startsWith(FS_HOME + '/')) {
    const rest = p.slice(FS_HOME.length)
    return '~' + rest.replace(/\/$/, '') || '~'
  }
  return p || '/'
}

/** Factory-reset VFS (for debugging / future command) */
export function vfsReset(): void {
  vfsOldPwd = null
  state = { cwd: FS_HOME, root: defaultRoot() }
  save()
}
