import { describe, it, expect } from 'vitest'
import {
  solvedCube,
  cloneCube,
  isSolved,
  moveU,
  moveUi,
  moveD,
  moveDi,
  moveR,
  moveRi,
  moveL,
  moveLi,
  moveF,
  moveFi,
  moveB,
  moveBi,
  MOVE_MAP,
  normalizeNotationInput,
  applyNotationStrict,
  applyNotation,
  scrambleCube,
} from './rubik-model'

// ── Helpers ────────────────────────────────────────────────────────────────────

function faceRow(face: number[]): string {
  return JSON.stringify(face)
}

// ── solvedCube ─────────────────────────────────────────────────────────────────

describe('solvedCube', () => {
  it('returns a cube where every face has 9 cells of the same color', () => {
    const cube = solvedCube()
    for (const face of [cube.U, cube.R, cube.F, cube.D, cube.L, cube.B]) {
      expect(face).toHaveLength(9)
      expect(new Set(face).size).toBe(1)
    }
  })

  it('assigns distinct color values to each of the 6 faces', () => {
    const cube = solvedCube()
    const centers = [cube.U[4], cube.R[4], cube.F[4], cube.D[4], cube.L[4], cube.B[4]]
    expect(new Set(centers).size).toBe(6)
  })

  it('returns a cube that passes isSolved', () => {
    expect(isSolved(solvedCube())).toBe(true)
  })
})

// ── cloneCube ──────────────────────────────────────────────────────────────────

describe('cloneCube', () => {
  it('returns a deep copy — mutating the clone does not affect the original', () => {
    const original = solvedCube()
    const copy = cloneCube(original)
    copy.U[0] = 99
    expect(original.U[0]).not.toBe(99)
  })

  it('clone is structurally equal to the original', () => {
    const cube = solvedCube()
    expect(cloneCube(cube)).toEqual(cube)
  })
})

// ── isSolved ───────────────────────────────────────────────────────────────────

describe('isSolved', () => {
  it('returns true for a freshly solved cube', () => {
    expect(isSolved(solvedCube())).toBe(true)
  })

  it('returns false after any single move', () => {
    const cube = solvedCube()
    moveU(cube)
    expect(isSolved(cube)).toBe(false)
  })
})

// ── Move inverses: X followed by X' returns to solved ─────────────────────────

describe('move inverses', () => {
  const pairs: Array<[string, (c: ReturnType<typeof solvedCube>) => void, (c: ReturnType<typeof solvedCube>) => void]> = [
    ['U / U\'',  moveU,  moveUi],
    ['D / D\'',  moveD,  moveDi],
    ['R / R\'',  moveR,  moveRi],
    ['L / L\'',  moveL,  moveLi],
    ['F / F\'',  moveF,  moveFi],
    ['B / B\'',  moveB,  moveBi],
  ]

  for (const [label, fwd, inv] of pairs) {
    it(`${label}: move + inverse returns to solved`, () => {
      const cube = solvedCube()
      fwd(cube)
      inv(cube)
      expect(isSolved(cube)).toBe(true)
    })
  }
})

// ── Move order: 4 quarter-turns return to identity ─────────────────────────────

describe('move 4× identity', () => {
  const moves: Array<[string, (c: ReturnType<typeof solvedCube>) => void]> = [
    ['U',  moveU],
    ['D',  moveD],
    ['R',  moveR],
    ['L',  moveL],
    ['F',  moveF],
    ['B',  moveB],
  ]

  for (const [label, fn] of moves) {
    it(`${label} applied 4 times returns to solved`, () => {
      const cube = solvedCube()
      fn(cube); fn(cube); fn(cube); fn(cube)
      expect(isSolved(cube)).toBe(true)
    })
  }
})

// ── MOVE_MAP ───────────────────────────────────────────────────────────────────

describe('MOVE_MAP', () => {
  it('contains all 18 standard moves', () => {
    const expected = [
      'U', "U'", 'U2',
      'D', "D'", 'D2',
      'R', "R'", 'R2',
      'L', "L'", 'L2',
      'F', "F'", 'F2',
      'B', "B'", 'B2',
    ]
    for (const move of expected) {
      expect(MOVE_MAP).toHaveProperty(move)
    }
  })

  it('U2 leaves U face unchanged (double turn)', () => {
    const cube = solvedCube()
    MOVE_MAP['U2']!(cube)
    MOVE_MAP['U2']!(cube)
    expect(isSolved(cube)).toBe(true)
  })
})

// ── normalizeNotationInput ────────────────────────────────────────────────────

describe('normalizeNotationInput', () => {
  it('returns null for an empty string', () => {
    expect(normalizeNotationInput('')).toBe('')
  })

  it('passes valid WCA notation unchanged', () => {
    expect(normalizeNotationInput("U R' F2 D")).toBe("U R' F2 D")
  })

  it('accepts lowercase and uppercases the output', () => {
    expect(normalizeNotationInput('u r f d')).toBe('U R F D')
  })

  it("converts 'Ri' shorthand to R'", () => {
    expect(normalizeNotationInput('Ri')).toBe("R'")
  })

  it("converts 'Ui' shorthand to U'", () => {
    expect(normalizeNotationInput('Ui')).toBe("U'")
  })

  it("converts 'rprime' to R'", () => {
    expect(normalizeNotationInput('rprime')).toBe("R'")
  })

  it('returns null for completely unrecognized tokens', () => {
    expect(normalizeNotationInput('X Y Z')).toBeNull()
  })

  it('handles multiple mixed tokens', () => {
    expect(normalizeNotationInput('U Ri F2')).toBe("U R' F2")
  })
})

// ── applyNotationStrict ───────────────────────────────────────────────────────

describe('applyNotationStrict', () => {
  it('applies valid moves and returns true', () => {
    const cube = solvedCube()
    const result = applyNotationStrict(cube, 'U R')
    expect(result).toBe(true)
    expect(isSolved(cube)).toBe(false)
  })

  it('returns false and stops on an unknown token', () => {
    const cube = solvedCube()
    const result = applyNotationStrict(cube, 'INVALID')
    expect(result).toBe(false)
  })

  it('empty algorithm returns true and leaves cube unchanged', () => {
    const cube = solvedCube()
    expect(applyNotationStrict(cube, '')).toBe(true)
    expect(isSolved(cube)).toBe(true)
  })

  it('sextet U R U\' L\' U R\' is not solved after applying', () => {
    const cube = solvedCube()
    applyNotationStrict(cube, "U R U' L' U R'")
    expect(isSolved(cube)).toBe(false)
  })
})

// ── applyNotation ─────────────────────────────────────────────────────────────

describe('applyNotation', () => {
  it('silently skips unknown tokens', () => {
    const cube = solvedCube()
    // Only 'U' is valid here; 'INVALID' is skipped
    applyNotation(cube, 'U INVALID')
    // cube should not be solved (U was applied)
    expect(isSolved(cube)).toBe(false)
  })

  it('empty algorithm leaves cube solved', () => {
    const cube = solvedCube()
    applyNotation(cube, '')
    expect(isSolved(cube)).toBe(true)
  })
})

// ── scrambleCube ──────────────────────────────────────────────────────────────

describe('scrambleCube', () => {
  it('leaves cube not solved after 25 moves (overwhelmingly likely)', () => {
    const cube = solvedCube()
    scrambleCube(cube, 25)
    // Probability of 25 random moves returning to solved is ~1 in 4.3×10^19
    expect(isSolved(cube)).toBe(false)
  })

  it('with 0 moves, cube remains solved', () => {
    const cube = solvedCube()
    scrambleCube(cube, 0)
    expect(isSolved(cube)).toBe(true)
  })
})
