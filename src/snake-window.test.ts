import { describe, it, expect } from 'vitest'
import { reflowSnakeIntoGrid } from './snake-window'

const cell = (x: number, y: number) => ({ x, y })

describe('reflowSnakeIntoGrid', () => {
  it('keeps the whole snake when it still fits the grid', () => {
    const snake = [cell(2, 2), cell(1, 2), cell(0, 2)]
    expect(reflowSnakeIntoGrid(snake, 10, 10)).toEqual(snake)
  })

  it('drops segments that fall outside a shrunk grid, keeping the run from the head', () => {
    const snake = [cell(1, 1), cell(2, 1), cell(4, 1)] // last cell is off a 3×3 grid
    expect(reflowSnakeIntoGrid(snake, 3, 3)).toEqual([cell(1, 1), cell(2, 1)])
  })

  it('returns null (round ends) when the head no longer fits', () => {
    expect(reflowSnakeIntoGrid([cell(9, 9), cell(8, 9)], 3, 3)).toBeNull()
  })

  it('returns null for an empty snake', () => {
    expect(reflowSnakeIntoGrid([], 5, 5)).toBeNull()
  })
})
