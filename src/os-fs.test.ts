import { beforeEach, describe, expect, it } from 'vitest'
import { FS_HOME, vfsCd, vfsNormalize, vfsReset } from './os-fs'

beforeEach(() => {
  vfsReset()
})

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
    const up = vfsNormalize('../../etc/hostname')
    expect(up).toBe('/etc/hostname')
  })

  it('collapses duplicate slashes via split logic', () => {
    expect(vfsNormalize('/home//namefailed')).toBe('/home/namefailed')
  })
})

describe('vfsCd + vfsNormalize', () => {
  it('uses updated cwd for relative paths', () => {
    expect(vfsCd('/tmp').ok).toBe(true)
    expect(vfsNormalize('.')).toBe('/tmp')
    expect(vfsNormalize('sub')).toBe('/tmp/sub')
  })
})
