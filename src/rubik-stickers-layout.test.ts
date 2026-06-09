import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  FACET_FACE_ORDER,
  flatIndex,
  latticeStickerCenter,
  stickerInAnimatedLayer,
  animAxisAndAngle,
  faceOutward,
  turnFaceFromWorldNormal,
  gridTripleFromSticker,
  inferFaceTurnFromScreenDrag,
  turnTokenForFace,
  FACE_TURN_DRAG_MIN_PX,
  type CubeMoveFace,
} from './rubik-stickers-layout'
import { MOVE_MAP, solvedCube, type CubeFaces, type CubeFaceKey } from './rubik-model'

/**
 * These tests treat the geometric layout (`latticeStickerCenter` + `animAxisAndAngle`)
 * as the visual source of truth and assert that the LOGICAL model move
 * (`MOVE_MAP[face]`) permutes facelets exactly the way the physical layer rotation
 * does. If the model and geometry disagree, stickers visibly "jump" after a turn:
 * the animation rotates a cubie to position B, but the model recolors B with a
 * different facelet — so the fix must keep these two in lock-step.
 */

const MOVE_FACES: CubeMoveFace[] = ['U', 'R', 'F', 'D', 'L', 'B']

/** All 54 sticker centers, indexed 0..53 in URFDLB × 9 order. */
const POSITIONS: THREE.Vector3[] = (() => {
  const out: THREE.Vector3[] = []
  for (const face of FACET_FACE_ORDER) {
    for (let i = 0; i < 9; i++) out.push(latticeStickerCenter(face, i))
  }
  return out
})()

/** Find the flat slot whose home center matches `v` (within tolerance). */
function findSlot(v: THREE.Vector3): number {
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < POSITIONS.length; i++) {
    const d = POSITIONS[i]!.distanceToSquared(v)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  // Cube cell pitch is 2/3 ≈ 0.667; a true match is within EPS, so 0.05 is safe.
  return bestD < 0.05 ? best : -1
}

/** A cube whose every facelet holds its own flat index (0..53) as a unique label. */
function labeledCube(): CubeFaces {
  const c = {} as CubeFaces
  for (const face of FACET_FACE_ORDER) {
    c[face] = Array.from({ length: 9 }, (_, i) => flatIndex(face, i))
  }
  return c
}

/** Flatten URFDLB × 9 → 54 labels. afterLabels[j] = facelet now occupying slot j. */
function flatten(c: CubeFaces): number[] {
  const out: number[] = []
  for (const face of FACET_FACE_ORDER) {
    for (let i = 0; i < 9; i++) out.push(c[face][i]!)
  }
  return out
}

/** Geometric destination of every affected sticker for `face` (i → slot it rotates into). */
function geometricDestinations(face: CubeMoveFace): Map<number, number> {
  const [axis, angle] = animAxisAndAngle(face, false)
  const dest = new Map<number, number>()
  for (let i = 0; i < 54; i++) {
    if (!stickerInAnimatedLayer(face, i)) continue
    const rotated = POSITIONS[i]!.clone().applyAxisAngle(axis, angle)
    const j = findSlot(rotated)
    expect(j, `sticker ${i} for move ${face} rotated off the lattice`).toBeGreaterThanOrEqual(0)
    dest.set(i, j)
  }
  return dest
}

// ── latticeStickerCenter sanity ───────────────────────────────────────────────

describe('latticeStickerCenter', () => {
  it('produces 54 distinct sticker centers', () => {
    const keys = new Set(POSITIONS.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`))
    expect(keys.size).toBe(54)
  })

  it('each face center (idx 4) sits on its outward normal axis at ±1', () => {
    for (const face of FACET_FACE_ORDER) {
      const c = latticeStickerCenter(face, 4)
      const n = faceOutward(face as CubeMoveFace)
      // center projects onto its own axis at ~1, and ~0 on the others
      expect(Math.abs(c.dot(n))).toBeGreaterThan(0.99)
    }
  })
})

// ── stickerInAnimatedLayer membership ─────────────────────────────────────────

describe('stickerInAnimatedLayer', () => {
  it('each face turn moves exactly 21 stickers (9 face + 4×3 ring)', () => {
    for (const face of MOVE_FACES) {
      let count = 0
      for (let i = 0; i < 54; i++) if (stickerInAnimatedLayer(face, i)) count++
      expect(count, `move ${face} layer size`).toBe(21)
    }
  })

  it("includes the turned face's own 9 stickers", () => {
    for (const face of MOVE_FACES) {
      for (let i = 0; i < 9; i++) {
        const flat = flatIndex(face as CubeFaceKey, i)
        expect(stickerInAnimatedLayer(face, flat), `${face} face sticker ${i}`).toBe(true)
      }
    }
  })

  it('never includes the opposite face', () => {
    const opposite: Record<CubeMoveFace, CubeFaceKey> = {
      U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F',
    }
    for (const face of MOVE_FACES) {
      for (let i = 0; i < 9; i++) {
        const flat = flatIndex(opposite[face], i)
        expect(stickerInAnimatedLayer(face, flat), `${face} should not move ${opposite[face]}${i}`).toBe(false)
      }
    }
  })
})

// ── geometry ⇄ model agreement (the core sync invariant) ──────────────────────

describe('animation matches model permutation', () => {
  for (const face of MOVE_FACES) {
    it(`${face}: every rotated cubie lands where the model recolors it`, () => {
      const dest = geometricDestinations(face)
      const after = flatten((() => {
        const c = labeledCube()
        MOVE_MAP[face]!(c)
        return c
      })())

      // For every affected sticker i that physically rotates to slot j,
      // the model must place facelet i's label at slot j.
      for (const [i, j] of dest) {
        expect(after[j], `move ${face}: sticker ${i} → slot ${j}`).toBe(i)
      }
    })

    it(`${face}: leaves every non-layer sticker untouched`, () => {
      const after = flatten((() => {
        const c = labeledCube()
        MOVE_MAP[face]!(c)
        return c
      })())
      for (let i = 0; i < 54; i++) {
        if (stickerInAnimatedLayer(face, i)) continue
        expect(after[i], `move ${face}: non-layer slot ${i} changed`).toBe(i)
      }
    })
  }
})

// ── prime / double consistency with the model ─────────────────────────────────

describe('prime and double animation direction', () => {
  it('prime angle is the negation of the base angle', () => {
    for (const face of MOVE_FACES) {
      const [, base] = animAxisAndAngle(face, false)
      const [, primed] = animAxisAndAngle(face, true)
      expect(primed).toBeCloseTo(-base)
    }
  })

  it("a base turn then its prime returns every sticker home (geometry round-trip)", () => {
    for (const face of MOVE_FACES) {
      const [axis, angle] = animAxisAndAngle(face, false)
      for (let i = 0; i < 54; i++) {
        if (!stickerInAnimatedLayer(face, i)) continue
        const p = POSITIONS[i]!.clone()
          .applyAxisAngle(axis, angle)
          .applyAxisAngle(axis, -angle)
        expect(findSlot(p)).toBe(i)
      }
    }
  })
})

// ── raycast helper ────────────────────────────────────────────────────────────

describe('turnFaceFromWorldNormal', () => {
  it('maps each outward normal back to its move face', () => {
    for (const face of MOVE_FACES) {
      expect(turnFaceFromWorldNormal(faceOutward(face))).toBe(face)
    }
  })

  it('returns null for a degenerate normal', () => {
    expect(turnFaceFromWorldNormal(new THREE.Vector3(0, 0, 0))).toBeNull()
  })
})

// ── gridTripleFromSticker ─────────────────────────────────────────────────────

describe('gridTripleFromSticker', () => {
  it('every face center maps to a single non-zero axis', () => {
    for (const face of FACET_FACE_ORDER) {
      const g = gridTripleFromSticker(face, 4)
      const nonZero = [g.gx, g.gy, g.gz].filter(v => v !== 0)
      expect(nonZero).toHaveLength(1)
    }
  })

  it('solved cube has all centers distinct (layout covers all 6 axes)', () => {
    const cube = solvedCube()
    const centers = new Set([cube.U[4], cube.R[4], cube.F[4], cube.D[4], cube.L[4], cube.B[4]])
    expect(centers.size).toBe(6)
  })
})

// ── drag turn inference ───────────────────────────────────────────────────────

describe('inferFaceTurnFromScreenDrag', () => {
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(3, 2.4, 3.8)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  const rect = { left: 0, top: 0, width: 400, height: 400 } as DOMRect

  it('returns null for tiny movement (tap threshold)', () => {
    const center = latticeStickerCenter('F', 4)
    expect(
      inferFaceTurnFromScreenDrag('F', camera, center, 200, 200, 205, 203, rect),
    ).toBeNull()
  })

  it('turnTokenForFace maps sense to WCA tokens', () => {
    expect(turnTokenForFace('R', 'cw')).toBe('R')
    expect(turnTokenForFace('R', 'ccw')).toBe("R'")
  })

  it('drag threshold constant is reasonable', () => {
    expect(FACE_TURN_DRAG_MIN_PX).toBeGreaterThan(8)
  })
})
