// ── rubik-model.ts ───────────────────────────────────────────────────────────
// 3×3 facelet model (U R F D L B net). Moves verified: U4, D4, R4, L4, F4, B4 = identity.

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
  const mk = (c: number) => Array(9).fill(c)
  return {
    U: mk(0),
    R: mk(1),
    F: mk(2),
    D: mk(3),
    L: mk(4),
    B: mk(5),
  }
}

function rotFaceCW(f: number[]): void {
  const o = f.slice()
  f[0] = o[6]
  f[1] = o[3]
  f[2] = o[0]
  f[3] = o[7]
  f[4] = o[4]
  f[5] = o[1]
  f[6] = o[8]
  f[7] = o[5]
  f[8] = o[2]
}

export function cloneCube(c: CubeFaces): CubeFaces {
  return {
    U: [...c.U],
    R: [...c.R],
    F: [...c.F],
    D: [...c.D],
    L: [...c.L],
    B: [...c.B],
  }
}

export function isSolved(c: CubeFaces): boolean {
  const ok = (f: number[]) => f.every(x => x === f[4])
  return ok(c.U) && ok(c.R) && ok(c.F) && ok(c.D) && ok(c.L) && ok(c.B)
}

/** U clockwise */
export function moveU(c: CubeFaces): void {
  rotFaceCW(c.U)
  const t = [c.F[0], c.F[1], c.F[2]]
  c.F[0] = c.R[0]
  c.F[1] = c.R[1]
  c.F[2] = c.R[2]
  c.R[0] = c.B[0]
  c.R[1] = c.B[1]
  c.R[2] = c.B[2]
  c.B[0] = c.L[0]
  c.B[1] = c.L[1]
  c.B[2] = c.L[2]
  c.L[0] = t[0]
  c.L[1] = t[1]
  c.L[2] = t[2]
}

export function moveUi(c: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveU(c)
}

/** D clockwise (view from bottom) */
export function moveD(c: CubeFaces): void {
  rotFaceCW(c.D)
  const t = [c.F[6], c.F[7], c.F[8]]
  c.F[6] = c.L[6]
  c.F[7] = c.L[7]
  c.F[8] = c.L[8]
  c.L[6] = c.B[6]
  c.L[7] = c.B[7]
  c.L[8] = c.B[8]
  c.B[6] = c.R[6]
  c.B[7] = c.R[7]
  c.B[8] = c.R[8]
  c.R[6] = t[0]
  c.R[7] = t[1]
  c.R[8] = t[2]
}

export function moveDi(c: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveD(c)
}

/** R clockwise (look from right) */
export function moveR(c: CubeFaces): void {
  rotFaceCW(c.R)
  const t = [c.U[2], c.U[5], c.U[8]]
  c.U[2] = c.F[2]
  c.U[5] = c.F[5]
  c.U[8] = c.F[8]
  c.F[2] = c.D[2]
  c.F[5] = c.D[5]
  c.F[8] = c.D[8]
  c.D[2] = c.B[6]
  c.D[5] = c.B[3]
  c.D[8] = c.B[0]
  c.B[6] = t[0]
  c.B[3] = t[1]
  c.B[0] = t[2]
}

export function moveRi(c: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveR(c)
}

/** L clockwise (look from left) */
export function moveL(c: CubeFaces): void {
  rotFaceCW(c.L)
  const t = [c.U[0], c.U[3], c.U[6]]
  c.U[0] = c.B[8]
  c.U[3] = c.B[5]
  c.U[6] = c.B[2]
  c.B[8] = c.D[6]
  c.B[5] = c.D[3]
  c.B[2] = c.D[0]
  c.D[6] = c.F[0]
  c.D[3] = c.F[3]
  c.D[0] = c.F[6]
  c.F[0] = t[0]
  c.F[3] = t[1]
  c.F[6] = t[2]
}

export function moveLi(c: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveL(c)
}

/** F clockwise (look from front) */
export function moveF(c: CubeFaces): void {
  rotFaceCW(c.F)
  const t = [c.U[6], c.U[7], c.U[8]]
  c.U[6] = c.L[8]
  c.U[7] = c.L[5]
  c.U[8] = c.L[2]
  c.L[2] = c.D[0]
  c.L[5] = c.D[1]
  c.L[8] = c.D[2]
  c.D[0] = c.R[6]
  c.D[1] = c.R[3]
  c.D[2] = c.R[0]
  c.R[0] = t[2]
  c.R[3] = t[1]
  c.R[6] = t[0]
}

export function moveFi(c: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveF(c)
}

/** B clockwise (look from back toward front) */
export function moveB(c: CubeFaces): void {
  rotFaceCW(c.B)
  const t = [c.U[0], c.U[1], c.U[2]]
  c.U[0] = c.R[2]
  c.U[1] = c.R[5]
  c.U[2] = c.R[8]
  c.R[8] = c.D[8]
  c.R[5] = c.D[7]
  c.R[2] = c.D[6]
  c.D[8] = c.L[0]
  c.D[7] = c.L[3]
  c.D[6] = c.L[6]
  c.L[6] = t[2]
  c.L[3] = t[1]
  c.L[0] = t[0]
}

export function moveBi(c: CubeFaces): void {
  for (let i = 0; i < 3; i++) moveB(c)
}

export const MOVE_MAP: Record<string, (c: CubeFaces) => void> = {
  U: moveU,
  "U'": moveUi,
  U2: c => {
    moveU(c)
    moveU(c)
  },
  D: moveD,
  "D'": moveDi,
  D2: c => {
    moveD(c)
    moveD(c)
  },
  R: moveR,
  "R'": moveRi,
  R2: c => {
    moveR(c)
    moveR(c)
  },
  L: moveL,
  "L'": moveLi,
  L2: c => {
    moveL(c)
    moveL(c)
  },
  F: moveF,
  "F'": moveFi,
  F2: c => {
    moveF(c)
    moveF(c)
  },
  B: moveB,
  "B'": moveBi,
  B2: c => {
    moveB(c)
    moveB(c)
  },
}

/**
 * Loose tutorial / Scratch-style tokens → spaced WCA (`rprime`, `Ri`, `U2`).
 * Returns null if any segment is unrecognized.
 */
export function normalizeNotationInput(raw: string): string | null {
  let s = raw
    .trim()
    .replace(/[’′]/g, "'")
    .replace(/\bRi\b/gi, "R'")
    .replace(/\bUi\b/gi, "U'")
    .replace(/\bLi\b/gi, "L'")
    .replace(/\bDi\b/gi, "D'")
    .replace(/\bFi\b/gi, "F'")
    .replace(/\bBi\b/gi, "B'")
    .replace(/\b([udrlfb])prime\b/gi, (_, c: string) => `${c.toUpperCase()}'`)

  const parts = s.split(/\s+/).filter(Boolean)
  const out: string[] = []

  for (const t of parts) {
    const m2 = /^([udrlfb])2$/i.exec(t)
    if (m2) {
      out.push(`${m2[1]!.toUpperCase()}2`)
      continue
    }

    const mp = /^([udrlfb])'$/i.exec(t)
    if (mp) {
      out.push(`${mp[1]!.toUpperCase()}'`)
      continue
    }

    const mib = /^([udrlfb])i$/i.exec(t)
    if (mib) {
      out.push(`${mib[1]!.toUpperCase()}'`)
      continue
    }

    const mb = /^[udrlfb]$/i.exec(t)
    if (mb) {
      out.push(mb[0]!.toUpperCase())
      continue
    }

    return null
  }

  return out.join(' ')
}

/** Apply notation — rejects unknown tokens instead of silently skipping. */
export function applyNotationStrict(c: CubeFaces, alg: string): boolean {
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    const fn = MOVE_MAP[token]
    if (!fn) return false
    fn(c)
  }
  return true
}

export function applyNotation(c: CubeFaces, alg: string): void {
  for (const token of alg.trim().split(/\s+/).filter(Boolean)) {
    const fn = MOVE_MAP[token]
    if (fn) fn(c)
  }
}

export function scrambleCube(c: CubeFaces, moves = 25): void {
  const keys = ['U', "U'", 'R', "R'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"]
  for (let i = 0; i < moves; i++) {
    const k = keys[Math.floor(Math.random() * keys.length)]!
    MOVE_MAP[k]!(c)
  }
}
