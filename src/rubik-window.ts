// ── rubik-window.ts ───────────────────────────────────────────────────────────
// Interactive 3×3 — Three.js preview + same facelet model as `rubik-model.ts`.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  type CubeFaces,
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
  scrambleCube,
  solvedCube,
} from './rubik-model'

export interface RubikWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

const COLOR_HEX = ['#f5f5f7', '#eb6f92', '#a6e3a1', '#fab387', '#cba6f7', '#89b4fa']

/** three.js BoxGeometry material order: +X,-X,+Y,-Y,+Z,-Z → R,L,U,D,F,B */
const TEX_SIZE = 384

function drawFaceTexture(cv: HTMLCanvasElement, face: number[]): void {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const w = cv.width
  const cs = w / 3
  ctx.fillStyle = '#0f0f14'
  ctx.fillRect(0, 0, w, w)
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    ctx.fillStyle = COLOR_HEX[face[i]!] ?? '#888'
    const pad = 3
    ctx.fillRect(col * cs + pad, row * cs + pad, cs - pad * 2, cs - pad * 2)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(col * cs + pad, row * cs + pad, cs - pad * 2, cs - pad * 2)
  }
}

export class RubikWindow {
  readonly el: HTMLElement
  readonly command = 'cube' as const
  readonly onFocus: () => void

  private state: CubeFaces
  private statusEl!: HTMLElement
  private host!: HTMLElement

  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls
  private cube!: THREE.Mesh
  private textures: THREE.CanvasTexture[] = []
  private canvases: HTMLCanvasElement[] = []
  private raf = 0
  private resizeRo!: ResizeObserver
  private glDisposed = false

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  constructor(opts: RubikWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    this.state = solvedCube()

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window rubik-app rubik-app--3d'
    this.el.dataset.app = 'cube'
    this.el.tabIndex = -1

    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">cube</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min" title="minimize (ctrl+m)"></span>
        <span class="dot dot-max" title="maximize / restore (ctrl+f)"></span>
        <span class="dot dot-close" title="close (ctrl+q)"></span>
      </div>
    `
    bar.querySelector('.dot-close')!.addEventListener('click', e => {
      e.stopPropagation()
      this.dispose()
      this.onClose()
    })
    bar.querySelector('.dot-min')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMinimize()
    })
    bar.querySelector('.dot-max')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMaximize()
    })
    bar.addEventListener('mousedown', () => opts.onFocus())

    const toolbar = document.createElement('div')
    toolbar.className = 'rubik-toolbar'
    const btnScramble = this.mkToolBtn('Scramble', 'Random quarter-turns', () => {
      scrambleCube(this.state, 28)
      this.refreshTextures()
    })
    const btnReset = this.mkToolBtn('Reset', 'Solved state', () => {
      this.state = solvedCube()
      this.refreshTextures()
    })
    toolbar.append(btnScramble, btnReset)

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'rubik-status'
    this.statusEl.setAttribute('aria-live', 'polite')

    const help = document.createElement('div')
    help.className = 'rubik-help'
    help.innerHTML = `
      <div class="rubik-help-title">Controls</div>
      <ul class="rubik-help-list">
        <li><kbd>Drag</kbd> orbit · <kbd>Scroll</kbd> zoom</li>
        <li><kbd>U</kbd><kbd>D</kbd><kbd>L</kbd><kbd>R</kbd><kbd>F</kbd><kbd>B</kbd> quarter-turns · <kbd>Shift</kbd> prime</li>
        <li><kbd>Space</kbd> scramble · toolbar resets solved state</li>
      </ul>`

    this.host = document.createElement('div')
    this.host.className = 'rubik-canvas-host'

    const moveRow = document.createElement('div')
    moveRow.className = 'rubik-moves'
    for (const m of ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'rubik-move-btn os-toolbar-btn'
      b.textContent = m
      b.addEventListener('click', () => {
        this.apply(m)
        opts.onFocus()
        this.el.focus()
      })
      moveRow.appendChild(b)
    }

    const stack = document.createElement('div')
    stack.className = 'rubik-stack'
    stack.appendChild(toolbar)
    stack.appendChild(this.statusEl)
    stack.appendChild(help)
    stack.appendChild(this.host)
    stack.appendChild(moveRow)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    this.initThree()
    this.el.addEventListener('keydown', e => this.onKey(e), true)
    this.el.addEventListener('mousedown', () => opts.onFocus())
    this.refreshTextures()
  }

  private mkToolBtn(label: string, title: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'rubik-tool-btn os-toolbar-btn os-toolbar-btn--accent'
    b.textContent = label
    b.title = title
    b.addEventListener('click', fn)
    return b
  }

  private initThree(): void {
    const scene = new THREE.Scene()

    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    cam.position.set(2.9, 2.2, 3.8)
    this.camera = cam

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000, 0)
    this.renderer = renderer
    this.host.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.72))
    const d = new THREE.DirectionalLight(0xffffff, 0.55)
    d.position.set(4, 8, 6)
    scene.add(d)

    const geom = new THREE.BoxGeometry(2.05, 2.05, 2.05)
    const mats: THREE.MeshStandardMaterial[] = []
    for (let i = 0; i < 6; i++) {
      const cv = document.createElement('canvas')
      cv.width = TEX_SIZE
      cv.height = TEX_SIZE
      this.canvases.push(cv)
      const tex = new THREE.CanvasTexture(cv)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      this.textures.push(tex)
      mats.push(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.45,
          metalness: 0.08,
        }),
      )
    }
    this.cube = new THREE.Mesh(geom, mats)
    scene.add(this.cube)

    const ctl = new OrbitControls(cam, renderer.domElement)
    ctl.enableDamping = true
    ctl.dampingFactor = 0.06
    ctl.minDistance = 2.6
    ctl.maxDistance = 16
    ctl.rotateSpeed = 0.65
    ctl.target.set(0, 0, 0)
    this.controls = ctl

    const animate = (): void => {
      this.raf = requestAnimationFrame(animate)
      if (this.el.classList.contains('minimized')) return
      ctl.update()
      renderer.render(scene, cam)
    }
    animate()

    this.resizeRo = new ResizeObserver(() => this.resizeGl())
    this.resizeRo.observe(this.host)
    requestAnimationFrame(() => this.resizeGl())
  }

  private resizeGl(): void {
    const r = this.host.getBoundingClientRect()
    const w = Math.max(160, r.width)
    const h = Math.max(160, r.height)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private refreshTextures(): void {
    const order = ['R', 'L', 'U', 'D', 'F', 'B'] as const
    for (let i = 0; i < 6; i++) {
      drawFaceTexture(this.canvases[i]!, this.state[order[i]!])
      this.textures[i]!.needsUpdate = true
    }
    this.statusEl.textContent = isSolved(this.state) ? 'Solved.' : ''
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      scrambleCube(this.state, 26)
      this.refreshTextures()
      return
    }
    const map: Record<string, string> = {
      KeyU: 'U',
      KeyD: 'D',
      KeyL: 'L',
      KeyR: 'R',
      KeyF: 'F',
      KeyB: 'B',
    }
    const base = map[e.code]
    if (!base) return
    e.preventDefault()
    e.stopPropagation()
    this.apply(e.shiftKey ? `${base}'` : base)
  }

  private apply(token: string): void {
    const t = token as 'U' | "U'" | 'D' | "D'" | 'L' | "L'" | 'R' | "R'" | 'F' | "F'" | 'B' | "B'"
    const m: Record<typeof t, () => void> = {
      U: () => moveU(this.state),
      "U'": () => moveUi(this.state),
      D: () => moveD(this.state),
      "D'": () => moveDi(this.state),
      L: () => moveL(this.state),
      "L'": () => moveLi(this.state),
      R: () => moveR(this.state),
      "R'": () => moveRi(this.state),
      F: () => moveF(this.state),
      "F'": () => moveFi(this.state),
      B: () => moveB(this.state),
      "B'": () => moveBi(this.state),
    }
    m[t]!()
    this.refreshTextures()
  }

  focusCanvas(): void {
    this.el.focus()
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  scrollBy(delta: number): void {
    this.host.scrollBy({ top: delta, behavior: 'smooth' })
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }

  dispose(): void {
    if (this.glDisposed) return
    this.glDisposed = true
    cancelAnimationFrame(this.raf)
    this.resizeRo.disconnect()
    this.controls.dispose()
    this.textures.forEach(t => t.dispose())
    if (this.cube.geometry) this.cube.geometry.dispose()
    const mats = this.cube.material
    if (Array.isArray(mats)) mats.forEach(m => m.dispose())
    this.renderer.dispose()
  }
}
