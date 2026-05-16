import { describe, it, expect } from 'vitest'
import { randomPick } from './random-pick'

describe('randomPick', () => {
  it('throws RangeError when items array is empty', () => {
    expect(() => randomPick([])).toThrow(RangeError)
  })

  it('always returns the only element in a single-item array', () => {
    expect(randomPick(['only'])).toBe('only')
  })

  it('returns a value that exists in the array', () => {
    const options = ['a', 'b', 'c', 'd'] as const
    for (let i = 0; i < 20; i++) {
      expect(options).toContain(randomPick(options))
    }
  })

  it('works with numeric items', () => {
    const nums = [10, 20, 30] as const
    for (let i = 0; i < 20; i++) {
      expect(nums).toContain(randomPick(nums))
    }
  })

  it('works with object items', () => {
    const obj = { id: 1 }
    expect(randomPick([obj])).toBe(obj)
  })
})
