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
  invertMove,
  invertSequence,
  generateScrambleSequence,
  CANONICAL_ALGORITHMS,
} from './rubik-model'

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

// ── F and B physical cycle correctness ────────────────────────────────────────
// These tests verify that the correct PHYSICAL sticker slots move, not just
// that the permutation is internally consistent (4× = id doesn't catch swapped cols).

describe('moveF physical sticker cycles', () => {
  it('F on solved: U front-row (U[6,7,8]) becomes L-color (4)', () => {
    const cube = solvedCube()
    moveF(cube)
    expect(cube.U[6]).toBe(4)
    expect(cube.U[7]).toBe(4)
    expect(cube.U[8]).toBe(4)
  })

  it('F on solved: R front-col (R[2,5,8]) becomes U-color (0)', () => {
    const cube = solvedCube()
    moveF(cube)
    expect(cube.R[2]).toBe(0)
    expect(cube.R[5]).toBe(0)
    expect(cube.R[8]).toBe(0)
  })

  it('F on solved: D front-row (D[0,1,2]) becomes R-color (1)', () => {
    const cube = solvedCube()
    moveF(cube)
    expect(cube.D[0]).toBe(1)
    expect(cube.D[1]).toBe(1)
    expect(cube.D[2]).toBe(1)
  })

  it('F on solved: L front-col (L[0,3,6]) becomes D-color (3)', () => {
    const cube = solvedCube()
    moveF(cube)
    expect(cube.L[0]).toBe(3)
    expect(cube.L[3]).toBe(3)
    expect(cube.L[6]).toBe(3)
  })

  it('F on solved: R back-col (R[0,3,6]) unchanged', () => {
    const cube = solvedCube()
    moveF(cube)
    expect(cube.R[0]).toBe(1)
    expect(cube.R[3]).toBe(1)
    expect(cube.R[6]).toBe(1)
  })

  it('F on solved: L back-col (L[2,5,8]) unchanged', () => {
    const cube = solvedCube()
    moveF(cube)
    expect(cube.L[2]).toBe(4)
    expect(cube.L[5]).toBe(4)
    expect(cube.L[8]).toBe(4)
  })
})

describe('moveB physical sticker cycles', () => {
  it('B on solved: U back-row (U[0,1,2]) becomes R-color (1)', () => {
    const cube = solvedCube()
    moveB(cube)
    expect(cube.U[0]).toBe(1)
    expect(cube.U[1]).toBe(1)
    expect(cube.U[2]).toBe(1)
  })

  it('B on solved: R back-col (R[0,3,6]) becomes D-color (3)', () => {
    const cube = solvedCube()
    moveB(cube)
    expect(cube.R[0]).toBe(3)
    expect(cube.R[3]).toBe(3)
    expect(cube.R[6]).toBe(3)
  })

  it('B on solved: D back-row (D[6,7,8]) becomes L-color (4)', () => {
    const cube = solvedCube()
    moveB(cube)
    expect(cube.D[6]).toBe(4)
    expect(cube.D[7]).toBe(4)
    expect(cube.D[8]).toBe(4)
  })

  it('B on solved: L back-col (L[2,5,8]) becomes U-color (0)', () => {
    const cube = solvedCube()
    moveB(cube)
    expect(cube.L[2]).toBe(0)
    expect(cube.L[5]).toBe(0)
    expect(cube.L[8]).toBe(0)
  })

  it('B on solved: R front-col (R[2,5,8]) unchanged', () => {
    const cube = solvedCube()
    moveB(cube)
    expect(cube.R[2]).toBe(1)
    expect(cube.R[5]).toBe(1)
    expect(cube.R[8]).toBe(1)
  })

  it('B on solved: L front-col (L[0,3,6]) unchanged', () => {
    const cube = solvedCube()
    moveB(cube)
    expect(cube.L[0]).toBe(4)
    expect(cube.L[3]).toBe(4)
    expect(cube.L[6]).toBe(4)
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
  it('returns an empty string for empty input (nothing to flag as unrecognized)', () => {
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

// ── invertMove ────────────────────────────────────────────────────────────────

describe('invertMove', () => {
  it('U → U\'', () => {
    expect(invertMove('U')).toBe("U'")
  })

  it("U' → U", () => {
    expect(invertMove("U'")).toBe('U')
  })

  it('U2 is its own inverse', () => {
    expect(invertMove('U2')).toBe('U2')
  })

  it('inverts all six faces', () => {
    for (const f of ['U', 'D', 'L', 'R', 'F', 'B']) {
      expect(invertMove(f)).toBe(`${f}'`)
      expect(invertMove(`${f}'`)).toBe(f)
      expect(invertMove(`${f}2`)).toBe(`${f}2`)
    }
  })

  it('throws on unknown token', () => {
    expect(() => invertMove('X')).toThrow()
    expect(() => invertMove('U3')).toThrow()
  })
})

// ── invertSequence ────────────────────────────────────────────────────────────

describe('invertSequence', () => {
  it('empty sequence inverts to empty', () => {
    expect(invertSequence('')).toBe('')
  })

  it('single move inverts correctly', () => {
    expect(invertSequence('U')).toBe("U'")
  })

  it('reverses order and inverts each move', () => {
    expect(invertSequence("U R")).toBe("R' U'")
  })

  it('R U R\' U\' inverts to U R U\' R\'', () => {
    expect(invertSequence("R U R' U'")).toBe("U R U' R'")
  })

  it('applying a sequence then its inverse solves the cube', () => {
    const cube = solvedCube()
    const alg = "R U R' U' R' F R2 U' R' U' R U R' F'"
    applyNotationStrict(cube, alg)
    expect(isSolved(cube)).toBe(false)
    applyNotationStrict(cube, invertSequence(alg))
    expect(isSolved(cube)).toBe(true)
  })

  it('preserves U2 as U2 in inverse position', () => {
    expect(invertSequence("U2 R")).toBe("R' U2")
  })

  it('throws on unknown token', () => {
    expect(() => invertSequence('X Y Z')).toThrow()
  })
})

// ── generateScrambleSequence ──────────────────────────────────────────────────

describe('generateScrambleSequence', () => {
  it('returns the requested number of tokens', () => {
    expect(generateScrambleSequence(0).length).toBe(0)
    expect(generateScrambleSequence(1).length).toBe(1)
    expect(generateScrambleSequence(20).length).toBe(20)
  })

  it('every token is a quarter-turn move', () => {
    const valid = new Set(['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"])
    for (const token of generateScrambleSequence(50)) {
      expect(valid.has(token)).toBe(true)
    }
  })

  it('does not generate the same face twice in a row (smarter scramble)', () => {
    for (let trial = 0; trial < 20; trial++) {
      const seq = generateScrambleSequence(40)
      for (let i = 1; i < seq.length; i++) {
        // Compare face letters: U and U' are same face
        expect(seq[i]![0]).not.toBe(seq[i - 1]![0])
      }
    }
  })

  it('applying then inverting solves the cube', () => {
    const cube = solvedCube()
    const seq = generateScrambleSequence(25)
    applyNotationStrict(cube, seq.join(' '))
    expect(isSolved(cube)).toBe(false)
    applyNotationStrict(cube, invertSequence(seq.join(' ')))
    expect(isSolved(cube)).toBe(true)
  })
})

// ── CANONICAL_ALGORITHMS ──────────────────────────────────────────────────────

describe('CANONICAL_ALGORITHMS', () => {
  it('exports at least 4 named algorithms', () => {
    expect(Object.keys(CANONICAL_ALGORITHMS).length).toBeGreaterThanOrEqual(4)
  })

  it('every algorithm parses to valid notation', () => {
    for (const [name, alg] of Object.entries(CANONICAL_ALGORITHMS)) {
      expect(typeof name).toBe('string')
      expect(typeof alg.moves).toBe('string')
      expect(typeof alg.label).toBe('string')
      expect(alg.label.length).toBeGreaterThan(0)
      const cube = solvedCube()
      // Test it applies cleanly
      expect(applyNotationStrict(cube, alg.moves)).toBe(true)
    }
  })

  it('includes "sune" (canonical OLL)', () => {
    expect(CANONICAL_ALGORITHMS).toHaveProperty('sune')
  })
})

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
