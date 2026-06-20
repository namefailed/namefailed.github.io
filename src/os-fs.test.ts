// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FS_HOME,
  vfsCat,
  vfsCd,
  vfsCopyIntoDirectory,
  vfsFormatPath,
  vfsListEntries,
  vfsLs,
  vfsLsLong,
  vfsMkdir,
  vfsMoveIntoDirectory,
  vfsNormalize,
  vfsOldPwdFormatted,
  vfsPersistedFootprint,
  vfsPromptPath,
  vfsPwd,
  vfsReadRaw,
  vfsReloadFromStorage,
  vfsReset,
  vfsRm,
  vfsTouch,
  vfsWrite,
} from './os-fs'

/** localStorage key the VFS persists under (mirrors STORAGE_KEY in os-fs.ts). */
const STORAGE_KEY = 'portfolio-vfs-v8-namefailed-home'

// ── Reset VFS state before every test so tests are fully isolated ─────────────
beforeEach(() => {
  localStorage.clear()
  vfsReset()
})

// The debounced save() leaves a pending setTimeout after each mutating op. Flush
// it after every test so nothing is still resolving when the env tears down.
afterEach(() => {
  // Flush any debounced save still pending so no real-timer setTimeout is left
  // resolving when the env tears down. beforeunload → saveSync clears the handle.
  // Restore real timers first so the dispatch runs against the live scheduler.
  vi.useRealTimers()
  window.dispatchEvent(new Event('beforeunload'))
  localStorage.clear()
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsNormalize
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsNormalize', () => {
  it('treats absolute paths as rooted at /', () => {
    expect(vfsNormalize('/home/namefailed')).toBe('/home/namefailed')
    expect(vfsNormalize('/tmp/../home/namefailed')).toBe('/home/namefailed')
  })

  it('resolves relative segments against cwd', () => {
    expect(vfsNormalize('Documents/../Documents')).toBe(`${FS_HOME}/Documents`)
    expect(vfsNormalize('./Desktop')).toBe(`${FS_HOME}/Desktop`)
  })

  it('walks above home with ..', () => {
    expect(vfsNormalize('../../etc/hostname')).toBe('/etc/hostname')
  })

  it('collapses duplicate slashes', () => {
    expect(vfsNormalize('/home//namefailed')).toBe('/home/namefailed')
  })

  it('returns / when the path resolves to root', () => {
    expect(vfsNormalize('/')).toBe('/')
  })

  it('treats a bare . as the current directory', () => {
    expect(vfsNormalize('.')).toBe(FS_HOME)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsCd + vfsNormalize (cwd update)
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsCd', () => {
  it('uses updated cwd for relative paths after cd', () => {
    expect(vfsCd('/tmp').ok).toBe(true)
    expect(vfsNormalize('.')).toBe('/tmp')
    expect(vfsNormalize('sub')).toBe('/tmp/sub')
  })

  it('cd to ~ resets to FS_HOME', () => {
    expect(vfsCd('/tmp').ok).toBe(true)
    expect(vfsCd('~').ok).toBe(true)
    expect(vfsNormalize('.')).toBe(FS_HOME)
  })

  it('cd to empty string resets to FS_HOME', () => {
    expect(vfsCd('').ok).toBe(true)
    expect(vfsNormalize('.')).toBe(FS_HOME)
  })

  it('returns ok: false for a nonexistent path', () => {
    const result = vfsCd('/does/not/exist')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; msg: string }).msg).toMatch(/No such file/)
  })

  it('returns ok: false when target is a file, not a directory', () => {
    const result = vfsCd('/etc/hostname')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; msg: string }).msg).toMatch(/Not a directory/)
  })

  it('cd - swaps back to previous directory', () => {
    vfsCd('/tmp')
    vfsCd(FS_HOME)
    const result = vfsCd('-')
    expect(result.ok).toBe(true)
    expect(vfsNormalize('.')).toBe('/tmp')
  })

  it('cd - fails when OLDPWD is not set', () => {
    const result = vfsCd('-')
    expect(result.ok).toBe(false)
  })

  it('cd - fails when OLDPWD has vanished from disk', () => {
    vfsMkdir(`${FS_HOME}/gone`)
    vfsCd(`${FS_HOME}/gone`) // OLDPWD = home
    vfsCd(FS_HOME) // OLDPWD = ~/gone
    vfsRm(`${FS_HOME}/gone`)
    const result = vfsCd('-')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; msg: string }).msg).toMatch(/OLDPWD vanished/)
  })

  it('reports jumpedFromDash with the formatted previous path', () => {
    vfsCd(`${FS_HOME}/Documents`) // OLDPWD = home
    vfsCd('/tmp') // OLDPWD = ~/Documents
    const result = vfsCd('-')
    expect(result.ok).toBe(true)
    expect((result as { ok: true; jumpedFromDash?: string }).jumpedFromDash).toBe('~/Documents')
    expect(vfsPwd()).toBe(`${FS_HOME}/Documents`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsCat
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsCat', () => {
  it('reads an existing file', () => {
    const content = vfsCat('/etc/hostname')
    expect(content).toContain('mrgrey.site')
  })

  it('returns an error string for a nonexistent path', () => {
    const content = vfsCat('/no/such/file.txt')
    expect(content).toMatch(/No such file/)
  })

  it('returns an error string when the path is a directory', () => {
    const content = vfsCat('/etc')
    expect(content).toMatch(/Is a directory/)
  })

  it('returns (empty file) for a zero-byte file', () => {
    vfsTouch(`${FS_HOME}/blank.txt`)
    expect(vfsCat(`${FS_HOME}/blank.txt`)).toBe('(empty file)')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsWrite + vfsReadRaw
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsWrite / vfsReadRaw', () => {
  it('creates a new file and reads it back', () => {
    const err = vfsWrite(`${FS_HOME}/hello.txt`, 'world\n')
    expect(err).toBeNull()
    const result = vfsReadRaw(`${FS_HOME}/hello.txt`)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body).toBe('world\n')
  })

  it('overwrites an existing file', () => {
    vfsWrite(`${FS_HOME}/hello.txt`, 'first')
    vfsWrite(`${FS_HOME}/hello.txt`, 'second')
    const result = vfsReadRaw(`${FS_HOME}/hello.txt`)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body).toBe('second')
  })

  it('returns an error when the parent directory does not exist', () => {
    const err = vfsWrite(`${FS_HOME}/nonexistent-dir/file.txt`, 'x')
    expect(err).toMatch(/No such file/)
  })

  it('returns an error when trying to write to a directory path', () => {
    const err = vfsWrite(`${FS_HOME}/Desktop`, 'x')
    expect(err).toMatch(/is a directory/)
  })

  it('vfsReadRaw fails for nonexistent path', () => {
    const result = vfsReadRaw('/no/such.txt')
    expect(result.ok).toBe(false)
  })

  it('vfsReadRaw fails when path is a directory', () => {
    const result = vfsReadRaw('/etc')
    expect(result.ok).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsTouch
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsTouch', () => {
  it('creates a new empty file', () => {
    const err = vfsTouch(`${FS_HOME}/new.txt`)
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME)).toContain('new.txt')
  })

  it('does not overwrite an existing file', () => {
    vfsWrite(`${FS_HOME}/existing.txt`, 'content')
    vfsTouch(`${FS_HOME}/existing.txt`)
    const result = vfsReadRaw(`${FS_HOME}/existing.txt`)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body).toBe('content')
  })

  it('returns an error when the parent directory does not exist', () => {
    const err = vfsTouch(`${FS_HOME}/missing/file.txt`)
    expect(err).toMatch(/No such file/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsMkdir
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsMkdir', () => {
  it('creates a new directory', () => {
    const err = vfsMkdir(`${FS_HOME}/newdir`)
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME)).toContain('newdir')
  })

  it('returns an error when the directory already exists', () => {
    const err = vfsMkdir(`${FS_HOME}/Desktop`)
    expect(err).toMatch(/File exists/)
  })

  it('returns an error when a file with that name exists', () => {
    vfsTouch(`${FS_HOME}/file.txt`)
    const err = vfsMkdir(`${FS_HOME}/file.txt`)
    expect(err).toMatch(/File exists/)
  })

  it('returns an error when the parent directory does not exist', () => {
    const err = vfsMkdir(`${FS_HOME}/missing/child`)
    expect(err).toMatch(/No such file/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsRm
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsRm', () => {
  it('removes an existing file', () => {
    vfsTouch(`${FS_HOME}/temp.txt`)
    const err = vfsRm(`${FS_HOME}/temp.txt`)
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME)).not.toContain('temp.txt')
  })

  it('removes an existing directory', () => {
    vfsMkdir(`${FS_HOME}/emptydir`)
    const err = vfsRm(`${FS_HOME}/emptydir`)
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME)).not.toContain('emptydir')
  })

  it('removes a non-empty directory recursively', () => {
    vfsMkdir(`${FS_HOME}/fulldir`)
    vfsTouch(`${FS_HOME}/fulldir/inside.txt`)
    const err = vfsRm(`${FS_HOME}/fulldir`)
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME)).not.toContain('fulldir')
    // The subtree is gone — listing the removed path now errors.
    expect(vfsLs(`${FS_HOME}/fulldir`)[0]).toMatch(/No such file/)
  })

  it('returns an error for a nonexistent path', () => {
    const err = vfsRm(`${FS_HOME}/ghost.txt`)
    expect(err).toMatch(/No such file/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsLs
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsLs', () => {
  it('lists default user directory entries', () => {
    const entries = vfsLs(FS_HOME)
    expect(entries).toContain('notes.txt')
    expect(entries).toContain('Desktop')
    expect(entries).toContain('Documents')
  })

  it('returns an error string for a nonexistent target', () => {
    const entries = vfsLs('/no/such/dir')
    expect(entries[0]).toMatch(/No such file/)
  })

  it('returns an error string when target is a file', () => {
    const entries = vfsLs('/etc/hostname')
    expect(entries[0]).toMatch(/Not a directory/)
  })

  it('includes all entries (including dot-files) in the base listing', () => {
    // vfsLs does not filter hidden entries — it matches Object.keys() behaviour.
    // Only the `.` and `..` virtual entries are added exclusively by opts.all.
    const entries = vfsLs(FS_HOME)
    expect(entries).toContain('.config')
    expect(entries).not.toContain('.')
    expect(entries).not.toContain('..')
  })

  it('prepends . and .. with opts.all = true', () => {
    const entries = vfsLs(FS_HOME, { all: true })
    expect(entries).toContain('.')
    expect(entries).toContain('..')
    expect(entries[0]).toBe('.')
    expect(entries[1]).toBe('..')
  })

  it('lists the current directory when no target is given', () => {
    vfsCd(`${FS_HOME}/Documents`)
    const entries = vfsLs()
    expect(entries).toContain('readme.txt')
  })

  it('reports the no-target error as cannot access .', () => {
    // cd into a dir, delete it out from under cwd, then bare ls hits the
    // `target ?? '.'` fallback in the error string.
    vfsMkdir(`${FS_HOME}/doomed`)
    vfsCd(`${FS_HOME}/doomed`)
    vfsRm(`${FS_HOME}/doomed`)
    expect(vfsLs()[0]).toBe('ls: cannot access .: No such file or directory')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsListEntries
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsListEntries', () => {
  it('returns entries sorted dirs-first', () => {
    const result = vfsListEntries(FS_HOME)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const kinds = result.entries.map(e => e.kind)
    const firstFileIdx = kinds.indexOf('f')
    const lastDirIdx = kinds.lastIndexOf('d')
    // All dirs come before all files (or there are only dirs / only files)
    if (firstFileIdx !== -1 && lastDirIdx !== -1) {
      expect(lastDirIdx).toBeLessThan(firstFileIdx)
    }
  })

  it('fails for nonexistent path', () => {
    const result = vfsListEntries('/no/such')
    expect(result.ok).toBe(false)
  })

  it('fails when path is a file', () => {
    const result = vfsListEntries('/etc/hostname')
    expect(result.ok).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsMoveIntoDirectory
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsMoveIntoDirectory', () => {
  it('moves a file into a directory', () => {
    vfsTouch(`${FS_HOME}/moveme.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/moveme.txt`, `${FS_HOME}/Desktop`)
    expect(err).toBeNull()
    expect(vfsLs(`${FS_HOME}/Desktop`)).toContain('moveme.txt')
    expect(vfsLs(FS_HOME)).not.toContain('moveme.txt')
  })

  it('renames a file when basename is supplied', () => {
    vfsTouch(`${FS_HOME}/original.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/original.txt`, FS_HOME, 'renamed.txt')
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME)).toContain('renamed.txt')
    expect(vfsLs(FS_HOME)).not.toContain('original.txt')
  })

  it('returns an error when source does not exist', () => {
    const err = vfsMoveIntoDirectory(`${FS_HOME}/ghost.txt`, FS_HOME)
    expect(err).toMatch(/No such source/)
  })

  it('returns an error when destination does not exist', () => {
    vfsTouch(`${FS_HOME}/file.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/file.txt`, `${FS_HOME}/nonexistent`)
    expect(err).toMatch(/No such folder/)
  })

  it('prevents moving a directory into itself', () => {
    // The destination must actually exist inside the source, or this passes via
    // "No such folder" without ever exercising the self-containment guard.
    vfsMkdir(`${FS_HOME}/Desktop/sub`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/Desktop`, `${FS_HOME}/Desktop/sub`)
    expect(err).toMatch(/into itself/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsCopyIntoDirectory
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsCopyIntoDirectory', () => {
  it('deep-copies a file into a directory', () => {
    vfsWrite(`${FS_HOME}/original.txt`, 'data')
    const err = vfsCopyIntoDirectory(`${FS_HOME}/original.txt`, `${FS_HOME}/Desktop`)
    expect(err).toBeNull()
    // Original still exists
    expect(vfsLs(FS_HOME)).toContain('original.txt')
    // Copy exists in Desktop
    const destContent = vfsCat(`${FS_HOME}/Desktop/original.txt`)
    expect(destContent).toContain('data')
  })

  it('copies with a new basename', () => {
    vfsWrite(`${FS_HOME}/src.txt`, 'hello')
    vfsCopyIntoDirectory(`${FS_HOME}/src.txt`, FS_HOME, 'dst.txt')
    expect(vfsLs(FS_HOME)).toContain('dst.txt')
    expect(vfsLs(FS_HOME)).toContain('src.txt')
  })

  it('returns error when destination name already exists', () => {
    vfsTouch(`${FS_HOME}/file.txt`)
    vfsTouch(`${FS_HOME}/Desktop/file.txt`)
    const err = vfsCopyIntoDirectory(`${FS_HOME}/file.txt`, `${FS_HOME}/Desktop`)
    expect(err).toMatch(/already exists/)
  })

  it('returns error for nonexistent source', () => {
    const err = vfsCopyIntoDirectory(`${FS_HOME}/nope.txt`, FS_HOME)
    expect(err).toMatch(/No such source/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsFormatPath
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsFormatPath', () => {
  it('abbreviates the home directory as ~', () => {
    expect(vfsFormatPath(FS_HOME)).toBe('~')
  })

  it('abbreviates paths under home with ~/...', () => {
    expect(vfsFormatPath(`${FS_HOME}/Documents`)).toBe('~/Documents')
  })

  it('returns absolute paths unchanged', () => {
    expect(vfsFormatPath('/etc/hostname')).toBe('/etc/hostname')
  })

  it('returns / for the root', () => {
    expect(vfsFormatPath('/')).toBe('/')
  })

  it('strips a trailing slash when abbreviating under home', () => {
    expect(vfsFormatPath(`${FS_HOME}/Documents/`)).toBe('~/Documents')
  })

  it('falls back to / for an empty input', () => {
    expect(vfsFormatPath('')).toBe('/')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsPersistedFootprint
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsPersistedFootprint', () => {
  it('counts at least the default dirs and files', () => {
    const { files, dirs, jsonBytes } = vfsPersistedFootprint()
    expect(dirs).toBeGreaterThan(0)
    expect(files).toBeGreaterThan(0)
    expect(jsonBytes).toBeGreaterThan(0)
  })

  it('increments file count after writing a new file', () => {
    const before = vfsPersistedFootprint().files
    vfsWrite(`${FS_HOME}/counted.txt`, 'x')
    const after = vfsPersistedFootprint().files
    expect(after).toBe(before + 1)
  })

  it('increments dir count after mkdir', () => {
    const before = vfsPersistedFootprint().dirs
    vfsMkdir(`${FS_HOME}/newdir`)
    const after = vfsPersistedFootprint().dirs
    expect(after).toBe(before + 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsNormalize — edge cases (.. past root, trailing slashes)
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsNormalize edge cases', () => {
  it('clamps .. at the root instead of going negative', () => {
    // parts.pop() on an empty stack is a no-op, so traversing above / stays at /.
    expect(vfsNormalize('/../../..')).toBe('/')
    expect(vfsNormalize('/../etc')).toBe('/etc')
  })

  it('strips a trailing slash from absolute input', () => {
    expect(vfsNormalize('/etc/')).toBe('/etc')
    expect(vfsNormalize('/home/namefailed/Desktop/')).toBe(`${FS_HOME}/Desktop`)
  })

  it('collapses a run of trailing/middle slashes to one path', () => {
    expect(vfsNormalize('/etc///os-release//')).toBe('/etc/os-release')
  })

  it('resolves a relative path against a cwd that has a trailing slash', () => {
    // cd to /tmp, then a relative segment is appended after stripping any cwd slash.
    vfsCd('/tmp')
    expect(vfsNormalize('sub/../leaf')).toBe('/tmp/leaf')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsPwd / vfsOldPwdFormatted
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsPwd / vfsOldPwdFormatted', () => {
  it('reports the current working directory', () => {
    expect(vfsPwd()).toBe(FS_HOME)
    vfsCd('/tmp')
    expect(vfsPwd()).toBe('/tmp')
  })

  it('returns null for OLDPWD before any hop', () => {
    expect(vfsOldPwdFormatted()).toBeNull()
  })

  it('formats OLDPWD relative to home after a cd', () => {
    vfsCd(`${FS_HOME}/Documents`)
    // The previous dir (home) is recorded as OLDPWD and abbreviated to ~.
    expect(vfsOldPwdFormatted()).toBe('~')
  })

  it('formats an out-of-home OLDPWD as an absolute path', () => {
    vfsCd('/tmp')
    vfsCd(FS_HOME)
    expect(vfsOldPwdFormatted()).toBe('/tmp')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsPromptPath
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsPromptPath', () => {
  it('renders home as ~', () => {
    expect(vfsPromptPath()).toBe('~')
  })

  it('renders a path under home with ~/...', () => {
    vfsCd(`${FS_HOME}/Documents`)
    expect(vfsPromptPath()).toBe('~/Documents')
  })

  it('renders a path outside home absolutely', () => {
    vfsCd('/etc')
    expect(vfsPromptPath()).toBe('/etc')
  })

  it('renders the root as /', () => {
    vfsCd('/')
    expect(vfsPromptPath()).toBe('/')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsLsLong
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsLsLong', () => {
  it('returns one row per entry with directory + file modes', () => {
    const rows = vfsLsLong(FS_HOME) as Array<{ mode: string; name: string; size: number; nlink: number }>
    expect(Array.isArray(rows)).toBe(true)
    const byName = new Map(rows.map(r => [r.name, r]))
    // Desktop is a directory → drwx, size 4096, nlink 3 or 4.
    const desktop = byName.get('Desktop')!
    expect(desktop.mode).toBe('drwxr-xr-x')
    expect(desktop.size).toBe(4096)
    expect([3, 4]).toContain(desktop.nlink)
    // notes.txt is a regular file → -rw, nlink 1, byte-length size.
    const notes = byName.get('notes.txt')!
    expect(notes.mode).toBe('-rw-r--r--')
    expect(notes.nlink).toBe(1)
    expect(notes.size).toBeGreaterThan(0)
  })

  it('produces deterministic fake timestamps', () => {
    const first = vfsLsLong(FS_HOME) as Array<{ name: string; mon: string; hhmm: string }>
    const second = vfsLsLong(FS_HOME) as Array<{ name: string; mon: string; hhmm: string }>
    expect(second).toEqual(first)
    const notes = first.find(r => r.name === 'notes.txt')!
    expect(notes.hhmm).toMatch(/^\d{2}:\d{2}$/)
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    expect(MONTHS).toContain(notes.mon)
  })

  it('prepends . and .. rows with opts.all', () => {
    const rows = vfsLsLong(`${FS_HOME}/Documents`, { all: true }) as Array<{ name: string; mode: string }>
    expect(rows[0]!.name).toBe('.')
    expect(rows[1]!.name).toBe('..')
    // Both virtual entries are directories.
    expect(rows[0]!.mode).toBe('drwxr-xr-x')
    expect(rows[1]!.mode).toBe('drwxr-xr-x')
  })

  it('falls back to root for .. when listing / with opts.all', () => {
    // parentAbsOf('/') is '/', so the parent dir resolves to root itself.
    const rows = vfsLsLong('/', { all: true }) as Array<{ name: string; mode: string }>
    expect(rows[0]!.name).toBe('.')
    expect(rows[1]!.name).toBe('..')
  })

  it('returns an error string for a nonexistent target', () => {
    const rows = vfsLsLong('/no/such/dir')
    expect((rows as string[])[0]).toMatch(/No such file/)
  })

  it('returns an error string when target is a file', () => {
    const rows = vfsLsLong('/etc/hostname')
    expect((rows as string[])[0]).toMatch(/Not a directory/)
  })

  it('long-lists the current directory when no target is given', () => {
    vfsCd(`${FS_HOME}/Documents`)
    const rows = vfsLsLong() as Array<{ name: string }>
    expect(rows.some(r => r.name === 'readme.txt')).toBe(true)
  })

  it('reports the no-target error as cannot access .', () => {
    vfsMkdir(`${FS_HOME}/doomed-l`)
    vfsCd(`${FS_HOME}/doomed-l`)
    vfsRm(`${FS_HOME}/doomed-l`)
    expect((vfsLsLong() as string[])[0]).toBe('ls: cannot access .: No such file or directory')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsReadRaw — directory + nonexistent error messages (exact strings)
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsReadRaw error paths', () => {
  it('reports No such file for a missing path', () => {
    const r = vfsReadRaw('/no/such.txt')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toBe('/no/such.txt: No such file or directory')
  })

  it('reports Is a directory when path is a folder', () => {
    const r = vfsReadRaw('/etc')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toBe('/etc: Is a directory')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsWrite / vfsTouch / vfsMkdir — invalid-path + not-a-directory guards
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsWrite / vfsTouch / vfsMkdir guards', () => {
  it('rejects writing to the root path itself', () => {
    expect(vfsWrite('/', 'x')).toBe('Invalid path')
  })

  it('touch through a file component reports Not a directory', () => {
    expect(vfsTouch('/etc/hostname/child.txt')).toMatch(/Not a directory/)
  })

  it('touch rejects an empty (root) path', () => {
    expect(vfsTouch('/')).toBe('touch: invalid path')
  })

  it('mkdir through a file component reports Not a directory', () => {
    vfsTouch(`${FS_HOME}/afile`)
    expect(vfsMkdir(`${FS_HOME}/afile/child`)).toMatch(/Not a directory/)
  })

  it('mkdir rejects an empty (root) path', () => {
    expect(vfsMkdir('/')).toBe('mkdir: invalid path')
  })

  it('mkdir reports File exists with a distinct message for a clobbered file', () => {
    vfsTouch(`${FS_HOME}/clash`)
    expect(vfsMkdir(`${FS_HOME}/clash`)).toBe(`mkdir: '${FS_HOME}/clash': File exists`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsMoveIntoDirectory — remaining guards
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsMoveIntoDirectory guards', () => {
  it('rejects a destination parent that is a file', () => {
    vfsTouch(`${FS_HOME}/src.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/src.txt`, '/etc/hostname')
    expect(err).toBe('Destination parent is not a directory')
  })

  it('rejects a basename containing a slash', () => {
    vfsTouch(`${FS_HOME}/src.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/src.txt`, FS_HOME, 'a/b')
    expect(err).toBe('Invalid name')
  })

  it('is a no-op when moving a file onto its own location', () => {
    vfsTouch(`${FS_HOME}/stay.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/stay.txt`, FS_HOME, 'stay.txt')
    expect(err).toBeNull()
    expect(vfsLs(FS_HOME).filter(n => n === 'stay.txt')).toHaveLength(1)
  })

  it('rejects when a different entry already exists at the destination name', () => {
    vfsTouch(`${FS_HOME}/from.txt`)
    vfsTouch(`${FS_HOME}/Desktop/from.txt`)
    const err = vfsMoveIntoDirectory(`${FS_HOME}/from.txt`, `${FS_HOME}/Desktop`)
    expect(err).toBe(`'from.txt' already exists`)
    // Source is untouched because the move bailed before deleting it.
    expect(vfsLs(FS_HOME)).toContain('from.txt')
  })

  it('moves a directory and its whole subtree', () => {
    vfsMkdir(`${FS_HOME}/box`)
    vfsWrite(`${FS_HOME}/box/inner.txt`, 'kept')
    const err = vfsMoveIntoDirectory(`${FS_HOME}/box`, `${FS_HOME}/Desktop`)
    expect(err).toBeNull()
    expect(vfsLs(`${FS_HOME}/Desktop`)).toContain('box')
    expect(vfsCat(`${FS_HOME}/Desktop/box/inner.txt`)).toBe('kept')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsCopyIntoDirectory — remaining guards + directory deep-copy (cloneSubtree)
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsCopyIntoDirectory guards', () => {
  it('rejects when the destination folder does not exist', () => {
    vfsTouch(`${FS_HOME}/c.txt`)
    const err = vfsCopyIntoDirectory(`${FS_HOME}/c.txt`, `${FS_HOME}/ghostdir`)
    expect(err).toMatch(/No such folder/)
  })

  it('rejects a destination parent that is a file', () => {
    vfsTouch(`${FS_HOME}/c.txt`)
    const err = vfsCopyIntoDirectory(`${FS_HOME}/c.txt`, '/etc/hostname')
    expect(err).toBe('Destination parent is not a directory')
  })

  it('rejects a basename containing a slash', () => {
    vfsTouch(`${FS_HOME}/c.txt`)
    const err = vfsCopyIntoDirectory(`${FS_HOME}/c.txt`, FS_HOME, 'bad/name')
    expect(err).toBe('Invalid name')
  })

  it('deep-copies a directory subtree independently of the source', () => {
    // Exercises cloneSubtree's directory branch (recursing over children).
    vfsMkdir(`${FS_HOME}/tree`)
    vfsMkdir(`${FS_HOME}/tree/sub`)
    vfsWrite(`${FS_HOME}/tree/sub/leaf.txt`, 'v1')
    const err = vfsCopyIntoDirectory(`${FS_HOME}/tree`, `${FS_HOME}/Desktop`)
    expect(err).toBeNull()
    // The copy carries the nested file.
    expect(vfsCat(`${FS_HOME}/Desktop/tree/sub/leaf.txt`)).toBe('v1')
    // Mutating the copy must not bleed into the original (true deep clone).
    vfsWrite(`${FS_HOME}/Desktop/tree/sub/leaf.txt`, 'v2')
    expect(vfsCat(`${FS_HOME}/tree/sub/leaf.txt`)).toBe('v1')
    expect(vfsCat(`${FS_HOME}/Desktop/tree/sub/leaf.txt`)).toBe('v2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// vfsListEntries — sort stability among same-kind entries
// ─────────────────────────────────────────────────────────────────────────────
describe('vfsListEntries sorting', () => {
  it('orders same-kind entries alphabetically (localeCompare branch)', () => {
    vfsMkdir(`${FS_HOME}/zeta`)
    vfsMkdir(`${FS_HOME}/alpha`)
    const r = vfsListEntries(FS_HOME)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const dirNames = r.entries.filter(e => e.kind === 'd').map(e => e.name)
    expect(dirNames.indexOf('alpha')).toBeLessThan(dirNames.indexOf('zeta'))
    const fileNames = r.entries.filter(e => e.kind === 'f').map(e => e.name)
    // Files are sorted among themselves too.
    const sortedFiles = [...fileNames].sort((a, b) => a.localeCompare(b))
    expect(fileNames).toEqual(sortedFiles)
  })

  it('places a dir before a file even when the file sorts first by name', () => {
    // Insertion order is dir-first, so V8's 2-element sort invokes the comparator
    // as (file, dir) and must return +1, demoting the file below the dir despite
    // its name sorting earlier alphabetically.
    vfsMkdir(`${FS_HOME}/box2`)
    vfsMkdir(`${FS_HOME}/box2/zzz-dir`)
    vfsTouch(`${FS_HOME}/box2/aaa-file.txt`)
    const r = vfsListEntries(`${FS_HOME}/box2`)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.entries.map(e => e.name)).toEqual(['zzz-dir', 'aaa-file.txt'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Persistence: debounced save, reload, reset-on-vanished-cwd, parse guards
// ─────────────────────────────────────────────────────────────────────────────
describe('persistence', () => {
  it('debounced save writes the tree to localStorage after the delay', () => {
    vi.useFakeTimers()
    // vfsReset (run in beforeEach with real timers) already flushed; clear the slate.
    localStorage.removeItem(STORAGE_KEY)
    vfsWrite(`${FS_HOME}/persisted.txt`, 'on disk')
    // Save is debounced — nothing written until the timer fires.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    vi.advanceTimersByTime(200)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw!).toContain('persisted.txt')
    expect(raw!).toContain('on disk')
    vi.useRealTimers()
  })

  it('coalesces rapid edits into a single debounced write', () => {
    vi.useFakeTimers()
    localStorage.removeItem(STORAGE_KEY)
    vfsWrite(`${FS_HOME}/a.txt`, '1')
    vi.advanceTimersByTime(50)
    vfsWrite(`${FS_HOME}/b.txt`, '2') // resets the debounce window
    vi.advanceTimersByTime(50)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull() // still pending
    vi.advanceTimersByTime(150)
    const raw = localStorage.getItem(STORAGE_KEY)!
    expect(raw).toContain('a.txt')
    expect(raw).toContain('b.txt')
    vi.useRealTimers()
  })

  it('reloads in-memory state from a previously saved tree', () => {
    vi.useFakeTimers()
    vfsWrite(`${FS_HOME}/keep.txt`, 'survives')
    vi.advanceTimersByTime(200) // flush save to storage
    vi.useRealTimers()
    // Drift in-memory state away from disk, then reload should restore it.
    vfsRm(`${FS_HOME}/keep.txt`)
    const msg = vfsReloadFromStorage()
    expect(msg).toBeNull()
    expect(vfsLs(FS_HOME)).toContain('keep.txt')
  })

  it('resets cwd to home and reports it when the saved cwd has vanished', () => {
    vi.useFakeTimers()
    // Persist a state whose cwd points at a dir, then delete the dir before reload.
    vfsMkdir(`${FS_HOME}/transient`)
    vfsCd(`${FS_HOME}/transient`)
    vi.advanceTimersByTime(200) // flush: storage now has cwd=~/transient
    // Remove the directory and re-persist a tree without it.
    vfsCd(FS_HOME)
    vfsRm(`${FS_HOME}/transient`)
    vi.advanceTimersByTime(200)
    vi.useRealTimers()
    // Hand-craft a stored state that references the now-missing cwd.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    stored.cwd = `${FS_HOME}/transient`
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    const msg = vfsReloadFromStorage()
    expect(msg).toMatch(/working directory reset to ~/)
    expect(vfsPwd()).toBe(FS_HOME)
  })

  it('keeps defaults when stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    const msg = vfsReloadFromStorage()
    // load() swallows the parse error; tree falls back to defaults (cwd at home).
    expect(msg).toBeNull()
    expect(vfsPwd()).toBe(FS_HOME)
    expect(vfsLs(FS_HOME)).toContain('notes.txt')
  })

  it('ignores a stored payload with the wrong shape', () => {
    // Valid JSON but root is not a directory node → load() rejects it.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cwd: '/tmp', root: { t: 'f', body: 'x' } }))
    const msg = vfsReloadFromStorage()
    expect(msg).toBeNull()
    expect(vfsPwd()).toBe(FS_HOME)
    expect(vfsLs(FS_HOME)).toContain('Desktop')
  })

  it('does nothing on reload when there is no stored payload', () => {
    localStorage.removeItem(STORAGE_KEY)
    const msg = vfsReloadFromStorage()
    expect(msg).toBeNull()
    expect(vfsPwd()).toBe(FS_HOME)
  })

  it('flushes a pending save synchronously on beforeunload', () => {
    vi.useFakeTimers()
    localStorage.removeItem(STORAGE_KEY)
    vfsWrite(`${FS_HOME}/unload.txt`, 'flush me')
    // Save is still pending in the debounce window.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    window.dispatchEvent(new Event('beforeunload'))
    // beforeunload → saveSync wrote immediately, before the timer would have fired.
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw!).toContain('unload.txt')
    vi.useRealTimers()
  })
})
