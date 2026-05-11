/**
 * In-browser filesystem persisted in `localStorage`. Terminal builtins (`cat`, `cd`, …) and the
 * `edit` app read/write through here.
 */

/** Bumped so `/home/namefailed` default tree replaces older `/home/mrgrey` saves. */
const STORAGE_KEY = 'portfolio-vfs-v2-namefailed-home'

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
  etc.c['hostname'] = { t: 'f', body: 'mrgrey.dev\n' }
  etc.c['os-release'] = {
    t: 'f',
    body:
      'NAME="Portfolio OS"\nVERSION="1.0 (browser)"\nID=portfolio\nPRETTY_NAME="Portfolio GNU/Linux 1.0"\n',
  }
  root.c['etc'] = etc

  const home = emptyDir()
  const user = emptyDir()
  user.c['welcome.txt'] = {
    t: 'f',
    body:
      'Welcome to your home directory.\nTry: cat welcome.txt\n       ls ../etc\n',
  }
  user.c['notes.txt'] = {
    t: 'f',
    body: 'Nothing here yet — touch notes.txt is already taken.\n',
  }
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

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as FsState
    if (parsed && parsed.root && parsed.root.t === 'd' && typeof parsed.cwd === 'string') {
      state = parsed
    }
  } catch {
    /* keep defaults */
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* private mode */
  }
}

load()

/** Re-read tree + cwd from `localStorage` (drops any in-memory-only drift since last `save`). */
export function vfsReloadFromStorage(): string | null {
  vfsOldPwd = null
  load()
  const hit = walk(state.cwd)
  if (!hit?.node || hit.node.t !== 'd') {
    state.cwd = FS_HOME
    save()
    return 'working directory reset to ~ (saved cwd no longer exists)'
  }
  return null
}

export function vfsPwd(): string {
  return state.cwd
}

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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
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
    const mon = months[seed % 12]
    const day = String((seed % 27) + 1).padStart(2, '0')
    const hh = String((seed * 3) % 24).padStart(2, '0')
    const mm = String((seed * 7) % 60).padStart(2, '0')

    const size = isDir ? 4096 : new TextEncoder().encode(node.body).length
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
    jsonBytes = new TextEncoder().encode(JSON.stringify(state)).length
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

/** Create or overwrite a regular file (parent path must exist) */
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
