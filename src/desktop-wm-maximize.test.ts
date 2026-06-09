import { describe, it, expect } from 'vitest'
import { maximizeTargetKind } from './desktop-wm-maximize'

describe('maximizeTargetKind', () => {
  it('maximizes terminal column when nothing in right pane is focused', () => {
    expect(maximizeTargetKind(null)).toBe('terminal')
  })

  it('maximizes focused content tile when a window holds focus', () => {
    expect(maximizeTargetKind('whoami')).toBe('content')
  })
})
