import { describe, it, expect } from 'vitest'
import { maximizeTargetKind } from './desktop-wm-maximize'

describe('maximizeTargetKind', () => {
  it('maximizes terminal column when legacy shell is visible', () => {
    expect(maximizeTargetKind(null, true)).toBe('terminal')
  })

  it('no-ops when legacy shell is hidden and nothing is focused', () => {
    expect(maximizeTargetKind(null, false)).toBe('none')
  })

  it('maximizes focused content tile when a window holds focus', () => {
    expect(maximizeTargetKind('whoami', false)).toBe('content')
  })
})
