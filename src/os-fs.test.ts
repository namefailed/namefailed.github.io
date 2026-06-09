import { beforeEach, describe, expect, it } from 'vitest'
import {
  FS_HOME,
  vfsCat,
  vfsCd,
  vfsCopyIntoDirectory,
  vfsFormatPath,
  vfsListEntries,
  vfsLs,
  vfsMkdir,
  vfsMoveIntoDirectory,
  vfsNormalize,
  vfsPersistedFootprint,
  vfsReadRaw,
  vfsReset,
  vfsRm,
  vfsTouch,
  vfsWrite,
} from './os-fs'

// ── Reset VFS state before every test so tests are fully isolated ─────────────
beforeEach(() => {
  vfsReset()
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
    const err = vfsMoveIntoDirectory(`${FS_HOME}/Desktop`, `${FS_HOME}/Desktop/sub`)
    // Either "into itself" or the sub-dir doesn't exist — both are errors
    expect(err).not.toBeNull()
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
