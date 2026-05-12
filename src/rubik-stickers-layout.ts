/** 54 sticker meshes on a nominal ±1 cube: layout, hover/raycast picks, layer masks for animation. */

import * as THREE from 'three'
import type { CubeFaceKey } from './rubik-model'

export const FACET_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const satisfies readonly CubeFaceKey[]

/** Linear index 0..53 in URFDLB × 9 order (matching rubik flatten). */
export function flatIndex(face: CubeFaceKey, idx: number): number {
  const fi = FACET_FACE_ORDER.indexOf(face)
  return fi * 9 + idx
}

/** Row-major 0..8 relative to outward normal (see latticeStickerCenter). */
function rowCol(i: number): { row: number; col: number } {
  return { row: Math.floor(i / 3), col: i % 3 }
}

const EPS_SHIFT = 0.002

/** Sticker outward normal (+Y = up = U …). Coordinates nominal shell at ±1. */
export function faceOutward(face: CubeFaceKey): THREE.Vector3 {
  switch (face) {
    case 'U':
      return new THREE.Vector3(0, 1, 0)
    case 'D':
      return new THREE.Vector3(0, -1, 0)
    case 'R':
      return new THREE.Vector3(1, 0, 0)
    case 'L':
      return new THREE.Vector3(-1, 0, 0)
    case 'F':
      return new THREE.Vector3(0, 0, 1)
    case 'B':
      return new THREE.Vector3(0, 0, -1)
  }
}

/** World-space center before animation offset (thin plates sit EPS beyond shell). */
export function latticeStickerCenter(face: CubeFaceKey, idx: number): THREE.Vector3 {
  const { row, col } = rowCol(idx)
  const xa = -1 + 1 / 3 + col * (2 / 3)
  const ya = +1 - 1 / 3 - row * (2 / 3)
  const za = -1 + 1 / 3 + row * (2 / 3)

  switch (face) {
    case 'U':
      return new THREE.Vector3(xa, 1 + EPS_SHIFT, za)
    case 'D':
      return new THREE.Vector3(xa, -1 - EPS_SHIFT, -za)
    case 'F':
      return new THREE.Vector3(xa, ya, 1 + EPS_SHIFT)
    case 'B':
      return new THREE.Vector3(-xa, ya, -1 - EPS_SHIFT)
    case 'R':
      return new THREE.Vector3(1 + EPS_SHIFT, ya, xa)
    case 'L':
      return new THREE.Vector3(-1 - EPS_SHIFT, ya, -xa)
  }
}

/** Which 3×3×3 voxel each sticker centroid lies in (−1,0,1) after rounding. */
export function gridTripleFromSticker(face: CubeFaceKey, idx: number): GridTriple {
  const p = latticeStickerCenter(face, idx)
  return gridTripleFromXYZ(p.x, p.y, p.z)
}

export interface GridTriple {
  gx: -1 | 0 | 1
  gy: -1 | 0 | 1
  gz: -1 | 0 | 1
}

export function gridTripleFromXYZ(x: number, y: number, z: number): GridTriple {
  const q = (t: number): -1 | 0 | 1 => (t < -0.35 ? -1 : t > 0.35 ? 1 : 0)
  return { gx: q(x), gy: q(y), gz: q(z) }
}

/** Single-face quarter turn (logical), before prime suffix. */
export type CubeMoveFace = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

/** Whether flat index i rotates with outer layer `dim` (+X right, ±Y ±Z similarly). */
export function stickerInAnimatedLayer(face: CubeMoveFace, i: number): boolean {
  const f = FACET_FACE_ORDER[Math.floor(i / 9)]!
  const j = i % 9
  const g = gridTripleFromSticker(f, j)
  switch (face) {
    case 'U':
      return g.gy === 1
    case 'D':
      return g.gy === -1
    case 'R':
      return g.gx === 1
    case 'L':
      return g.gx === -1
    case 'F':
      return g.gz === 1
    case 'B':
      return g.gz === -1
  }
}

/**
 * Infer which face-turn the user tapped from world-space outward normal (+Y = top).
 */
export function turnFaceFromWorldNormal(normal: THREE.Vector3): CubeMoveFace | null {
  const ax = Math.abs(normal.x)
  const ay = Math.abs(normal.y)
  const az = Math.abs(normal.z)
  const m = Math.max(ax, ay, az)
  if (m < 1e-3) return null
  if (m === ay) return normal.y > 0 ? 'U' : 'D'
  if (m === ax) return normal.x > 0 ? 'R' : 'L'
  return normal.z > 0 ? 'F' : 'B'
}

const Y = new THREE.Vector3(0, 1, 0)
const X = new THREE.Vector3(1, 0, 0)
const Z = new THREE.Vector3(0, 0, 1)

/**
 * Pivot animation: world axis × angle (radians); prime via negative angle pairing.
 */
export function animAxisAndAngle(face: CubeMoveFace, prime: boolean): [THREE.Vector3, number] {
  const sign = prime ? -1 : 1
  const H = Math.PI / 2
  switch (face) {
    case 'U':
      return [Y.clone(), sign * -H]   // was +H — R_y(-π/2) matches moveU sticker cycle R→F
    case 'D':
      return [Y.clone(), sign * +H]   // was -H — R_y(+π/2) matches moveD sticker cycle F→R
    case 'R':
      return [X.clone(), sign * -H]   // correct — R_x(-π/2) → F→U matches moveR
    case 'L':
      return [X.clone(), sign * +H]   // correct — R_x(+π/2) → F→D matches moveL
    case 'F':
      return [Z.clone(), sign * -H]   // was +H — R_z(-π/2) matches moveF sticker cycle U→R
    case 'B':
      return [Z.clone(), sign * +H]   // was -H — R_z(+π/2) matches moveB sticker cycle U→L
  }
}
