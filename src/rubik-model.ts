/** 3×3 face arrays on standard U/R/F/D/L/B layout; repeated quarter-turns return to identity for each face. */

export interface CubeFaces {
  U: number[]
  R: number[]
  F: number[]
  D: number[]
  L: number[]
  B: number[]
}

export type CubeFaceKey = keyof CubeFaces

export function solvedCube(): CubeFaces {
  const face = (color: number) => Array<number>(9).fill(color)
  return {
    U: face(0),
    R: face(1),
    F: face(2),
    D: face(3),
    L: face(4),
    B: face(5),
  }
}

/** Rotate a face array 90° clockwise in-place (standard cubie numbering 0–8, row-major). */
function rotFaceCW(face: number[]): void {
  const orig = face.slice()
  face[0] = orig[6]
  face[1] = orig[3]
  face[2] = orig[0]
  face[3] = orig[7]
  face[4] = orig[4]
  face[5] = orig[1]
  face[6] = orig[8]
  face[7] = orig[5]
  face[8] = orig[2]
}

/**
 * Rotate a face array 90° counter-clockwise in-place.
 *
 * The R and L faces are stored "mirror-indexed" relative to U/D/F/B (their
 * column axis runs opposite the others in the 3D lattice), so a geometric
 * clockwise turn of those faces corresponds to a CCW array rotation. See
 * rubik-stickers-layout.test.ts for the geometry that pins this down.
 */
function rotFaceCCW(face: number[]): void {
  const orig = face.slice()
  face[0] = orig[2]
  face[1] = orig[5]
  face[2] = orig[8]
  face[3] = orig[1]
  face[4] = orig[4]
  face[5] = orig[7]
  face[6] = orig[0]
  face[7] = orig[3]
  face[8] = orig[6]
}

export function cloneCube(cube: CubeFaces): CubeFaces {
  return {
    U: [...cube.U],
    R: [...cube.R],
    F: [...cube.F],
    D: [...cube.D],
    L: [...cube.L],
    B: [...cube.B],
  }
}

export function isSolved(cube: CubeFaces): boolean {
  const allMatchCenter = (face: number[]) => face.every(cell => cell === face[4])
  return (
    allMatchCenter(cube.U) &&
    allMatchCenter(cube.R) &&
    allMatchCenter(cube.F) &&
    allMatchCenter(cube.D) &&
    allMatchCenter(cube.L) &&
    allMatchCenter(cube.B)
  )
}

/** U clockwise (look down from top) */
export function moveU(cube: CubeFaces): void {
  rotFaceCW(cube.U)
  // Top ring (y=+1): cubie at the right-front swings to the front-left, so each
  // triple reverses as it crosses to the next face. Cycle R→F→L→B→R.
  const saved = [cube.F[0], cube.F[1], cube.F[2]]
  cube.F[0] = cube.R[2]   // R[2] → F[0]
  cube.F[1] = cube.R[1]
  cube.F[2] = cube.R[0]   // R[0] → F[2]
  cube.R[0] = cube.B[2]   // B[2] → R[0]
  cube.R[1] = cube.B[1]
  cube.R[2] = cube.B[0]
  cube.B[0] = cube.L[2]   // L[2] → B[0]
  cube.B[1] = cube.L[1]
  cube.B[2] = cube.L[0]
  cube.L[0] = saved[2]    // F[2] → L[0]
  cube.L[1] = saved[1]
  cube.L[2] = saved[0]
}

/** U counter-clockwise (3× clockwise) */
export function moveUi(cube: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveU(cube)
}

/** D clockwise (view from bottom) */
export function moveD(cube: CubeFaces): void {
  rotFaceCW(cube.D)
  // Bottom ring (y=-1): cycle F→R→B→L→F, each triple reversing as it crosses.
  const saved = [cube.F[6], cube.F[7], cube.F[8]]
  cube.F[6] = cube.L[8]   // L[8] → F[6]
  cube.F[7] = cube.L[7]
  cube.F[8] = cube.L[6]   // L[6] → F[8]
  cube.L[6] = cube.B[8]   // B[8] → L[6]
  cube.L[7] = cube.B[7]
  cube.L[8] = cube.B[6]
  cube.B[6] = cube.R[8]   // R[8] → B[6]
  cube.B[7] = cube.R[7]
  cube.B[8] = cube.R[6]
  cube.R[6] = saved[2]    // F[8] → R[6]
  cube.R[7] = saved[1]
  cube.R[8] = saved[0]
}

/** D counter-clockwise */
export function moveDi(cube: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveD(cube)
}

/** R clockwise (look from right) */
export function moveR(cube: CubeFaces): void {
  // R/L faces are mirror-indexed in the 3D lattice → geometric CW = array CCW.
  rotFaceCCW(cube.R)
  const saved = [cube.U[2], cube.U[5], cube.U[8]]
  cube.U[2] = cube.F[2]
  cube.U[5] = cube.F[5]
  cube.U[8] = cube.F[8]
  cube.F[2] = cube.D[2]
  cube.F[5] = cube.D[5]
  cube.F[8] = cube.D[8]
  cube.D[2] = cube.B[6]
  cube.D[5] = cube.B[3]
  cube.D[8] = cube.B[0]
  cube.B[6] = saved[0]
  cube.B[3] = saved[1]
  cube.B[0] = saved[2]
}

/** R counter-clockwise */
export function moveRi(cube: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveR(cube)
}

/** L clockwise (look from left) */
export function moveL(cube: CubeFaces): void {
  // R/L faces are mirror-indexed in the 3D lattice → geometric CW = array CCW.
  rotFaceCCW(cube.L)
  // Left ring (x=-1): cycle U→F→D→B→U. The U↔B legs reverse (B is stored with
  // a flipped column axis); the F and D legs are straight.
  const saved = [cube.U[0], cube.U[3], cube.U[6]]
  cube.U[0] = cube.B[8]   // B[8] → U[0]
  cube.U[3] = cube.B[5]
  cube.U[6] = cube.B[2]   // B[2] → U[6]
  cube.B[8] = cube.D[0]   // D[0] → B[8]
  cube.B[5] = cube.D[3]
  cube.B[2] = cube.D[6]   // D[6] → B[2]
  cube.D[0] = cube.F[0]   // F[0] → D[0]
  cube.D[3] = cube.F[3]
  cube.D[6] = cube.F[6]
  cube.F[0] = saved[0]    // U[0] → F[0]
  cube.F[3] = saved[1]
  cube.F[6] = saved[2]
}

/** L counter-clockwise */
export function moveLi(cube: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveL(cube)
}

/** F clockwise (look from front) */
export function moveF(cube: CubeFaces): void {
  rotFaceCW(cube.F)
  // Front layer cycle (z=+1 face): L front-col → U front-row → R front-col → D front-row → L
  // Physical slots at z≈+⅔: U[6,7,8], R[2,5,8], D[0,1,2], L[0,3,6]
  const saved = [cube.U[6], cube.U[7], cube.U[8]]
  cube.U[6] = cube.L[6]   // L[6] → U[6]
  cube.U[7] = cube.L[3]   // L[3] → U[7]
  cube.U[8] = cube.L[0]   // L[0] → U[8]
  cube.L[0] = cube.D[0]   // D[0] → L[0]
  cube.L[3] = cube.D[1]   // D[1] → L[3]
  cube.L[6] = cube.D[2]   // D[2] → L[6]
  cube.D[0] = cube.R[8]   // R[8] → D[0]
  cube.D[1] = cube.R[5]   // R[5] → D[1]
  cube.D[2] = cube.R[2]   // R[2] → D[2]
  cube.R[2] = saved[0]    // U[6] → R[2]
  cube.R[5] = saved[1]    // U[7] → R[5]
  cube.R[8] = saved[2]    // U[8] → R[8]
}

/** F counter-clockwise */
export function moveFi(cube: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveF(cube)
}

/** B clockwise (look from back toward front) */
export function moveB(cube: CubeFaces): void {
  rotFaceCW(cube.B)
  // Back layer cycle (z=-1 face): R back-col → U back-row → L back-col → D back-row → R
  // Physical slots at z≈-⅔: U[0,1,2], R[0,3,6], D[6,7,8], L[2,5,8]
  const saved = [cube.U[0], cube.U[1], cube.U[2]]
  cube.U[0] = cube.R[0]   // R[0] → U[0]
  cube.U[1] = cube.R[3]   // R[3] → U[1]
  cube.U[2] = cube.R[6]   // R[6] → U[2]
  cube.R[0] = cube.D[8]   // D[8] → R[0]
  cube.R[3] = cube.D[7]   // D[7] → R[3]
  cube.R[6] = cube.D[6]   // D[6] → R[6]
  cube.D[8] = cube.L[8]   // L[8] → D[8]
  cube.D[7] = cube.L[5]   // L[5] → D[7]
  cube.D[6] = cube.L[2]   // L[2] → D[6]
  cube.L[8] = saved[0]    // U[0] → L[8]
  cube.L[5] = saved[1]    // U[1] → L[5]
  cube.L[2] = saved[2]    // U[2] → L[2]
}

/** B counter-clockwise */
export function moveBi(cube: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveB(cube)
}

/** All 18 standard WCA moves keyed by notation token. */
export const MOVE_MAP: Record<string, (cube: CubeFaces) => void> = {
  U:    moveU,
  "U'": moveUi,
  U2:   cube => { moveU(cube); moveU(cube) },
  D:    moveD,
  "D'": moveDi,
  D2:   cube => { moveD(cube); moveD(cube) },
  R:    moveR,
  "R'": moveRi,
  R2:   cube => { moveR(cube); moveR(cube) },
  L:    moveL,
  "L'": moveLi,
  L2:   cube => { moveL(cube); moveL(cube) },
  F:    moveF,
  "F'": moveFi,
  F2:   cube => { moveF(cube); moveF(cube) },
  B:    moveB,
  "B'": moveBi,
  B2:   cube => { moveB(cube); moveB(cube) },
}

/**
 * Loose tutorial / Scratch-style tokens → spaced WCA notation (`rprime`, `Ri`, `U2` → `R'`, `R'`, `U2`).
 * Returns null if any segment is unrecognized.
 */
export function normalizeNotationInput(raw: string): string | null {
  const normalized = raw
    .trim()
    .replace(/['′]/g, "'")
    .replace(/\bRi\b/gi, "R'")
    .replace(/\bUi\b/gi, "U'")
    .replace(/\bLi\b/gi, "L'")
    .replace(/\bDi\b/gi, "D'")
    .replace(/\bFi\b/gi, "F'")
    .replace(/\bBi\b/gi, "B'")
    .replace(/\b([udrlfb])prime\b/gi, (_, letter: string) => `${letter.toUpperCase()}'`)

  const tokens = normalized.split(/\s+/).filter(Boolean)
  const output: string[] = []

  for (const token of tokens) {
    const matchDouble  = /^([udrlfb])2$/i.exec(token)
    if (matchDouble) { output.push(`${matchDouble[1]!.toUpperCase()}2`); continue }

    const matchPrime   = /^([udrlfb])'$/i.exec(token)
    if (matchPrime)  { output.push(`${matchPrime[1]!.toUpperCase()}'`);  continue }

    const matchInverse = /^([udrlfb])i$/i.exec(token)
    if (matchInverse) { output.push(`${matchInverse[1]!.toUpperCase()}'`); continue }

    const matchBare    = /^[udrlfb]$/i.exec(token)
    if (matchBare)   { output.push(matchBare[0]!.toUpperCase()); continue }

    return null
  }

  return output.join(' ')
}

/** Apply notation — rejects unknown tokens instead of silently skipping. Returns false on first unknown token. */
export function applyNotationStrict(cube: CubeFaces, alg: string): boolean {
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    const fn = MOVE_MAP[token]
    if (!fn) return false
    fn(cube)
  }
  return true
}

/** Apply notation — silently skips unknown tokens. */
export function applyNotation(cube: CubeFaces, alg: string): void {
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    const fn = MOVE_MAP[token]
    if (fn) fn(cube)
  }
}

/** Apply `moves` random quarter-turns to `cube` in place. */
export function scrambleCube(cube: CubeFaces, moves = 25): void {
  const moveKeys = ['U', "U'", 'R', "R'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"]
  for (let i = 0; i < moves; i++) {
    const key = moveKeys[Math.floor(Math.random() * moveKeys.length)]!
    MOVE_MAP[key]!(cube)
  }
}

/** Inverse of a single WCA move token: `U` ↔ `U'`; `U2` is its own inverse. */
export function invertMove(token: string): string {
  if (!MOVE_MAP[token]) {
    throw new Error(`invertMove: unknown move token ${JSON.stringify(token)}`)
  }
  if (token.endsWith('2')) return token
  if (token.endsWith("'")) return token.slice(0, -1)
  return `${token}'`
}

/** Inverse of a whitespace-separated WCA sequence — reversed order, each move inverted. */
export function invertSequence(seq: string): string {
  const tokens = seq.trim().split(/\s+/).filter(Boolean)
  return tokens.reverse().map(invertMove).join(' ')
}

/**
 * Generate a scramble sequence that avoids repeating the same face twice in a row.
 * (Repeated turns on one face are degenerate — e.g. `U U` is just `U2`.)
 */
export function generateScrambleSequence(length = 25): string[] {
  const moveKeys = ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"]
  const out: string[] = []
  let lastFace = ''
  for (let i = 0; i < length; i++) {
    const candidates = moveKeys.filter(m => m[0] !== lastFace)
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!
    out.push(pick)
    lastFace = pick[0]!
  }
  return out
}

/**
 * Canonical Rubik's cube algorithms (CFOP-flavored).
 * Each one returns the cube to solved when applied to a solved cube some
 * number of times (cycle length varies — most repeat after 4–6 applications).
 * Used as a demo: apply once, then watch the inverse "solve" it back.
 */
export interface NamedAlgorithm {
  label: string
  moves: string
  description: string
}

/** Named OLL/PLL algorithms and demo patterns, keyed by short id (e.g. `'sune'`). */
export const CANONICAL_ALGORITHMS: Record<string, NamedAlgorithm> = {
  sune: {
    label: 'Sune (OLL)',
    moves: "R U R' U R U2 R'",
    description: 'OLL — orients last layer corners (twists 3 corners CW)',
  },
  antisune: {
    label: 'Anti-Sune (OLL)',
    moves: "R U2 R' U' R U' R'",
    description: 'OLL mirror of Sune (twists 3 corners CCW)',
  },
  tperm: {
    label: 'T-perm (PLL)',
    moves: "R U R' U' R' F R2 U' R' U' R U R' F'",
    description: 'PLL — swaps two adjacent corners and two edges',
  },
  yperm: {
    label: 'Y-perm (PLL)',
    moves: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    description: 'PLL — swaps two diagonal corners and two edges',
  },
  uperm: {
    label: 'U-perm (PLL)',
    moves: "R U' R U R U R U' R' U' R2",
    description: 'PLL — 3-cycle of edges (clockwise)',
  },
  sexymove: {
    label: 'Sexy Move',
    moves: "R U R' U'",
    description: 'Beginner trigger — 6 reps return to solved',
  },
  superflip: {
    label: 'Superflip',
    moves: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    description: "All edges flipped — 20-move \"god's number\" pattern",
  },
}
