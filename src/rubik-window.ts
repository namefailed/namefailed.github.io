/** Interactive 3×3 cube: sticker plates, slice rotation, toolbar + keyboard + undo/alg strip. */

import * as THREE from 'three'
import { SRGBColorSpace } from 'three'
import { MOUSE } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  type CubeFaces,
  type CubeFaceKey,
  MOVE_MAP,
  isSolved,
  scrambleCube,
  solvedCube,
  cloneCube,
  applyNotationStrict,
  normalizeNotationInput,
} from './rubik-model'
import {
  FACET_FACE_ORDER,
  animAxisAndAngle,
  faceOutward,
  gridTripleFromSticker,
  latticeStickerCenter,
  stickerInAnimatedLayer,
  turnFaceFromWorldNormal,
  type CubeMoveFace,
} from './rubik-stickers-layout'

export interface RubikWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

const COLOR_HEX = ['#f5f5f7', '#eb6f92', '#a6e3a1', '#fab387', '#cba6f7', '#89b4fa']

const STICKER = (2 / 3) * 0.9

const MOVE_MS = 280

const INVALID_MOUSE_ACTION = 999 as unknown as MOUSE

type TurnToken = keyof typeof MOVE_MAP

export class RubikWindow {
  readonly el: HTMLElement
  readonly command = 'cube' as const
  readonly onFocus: () => void

  private state: CubeFaces
  private stickerMeshes: THREE.Mesh[] = []

  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls
  private stickerRoot!: THREE.Group
  private raycaster = new THREE.Raycaster()
  private pointerNdc = new THREE.Vector2()

  private statusEl!: HTMLElement
  private moveCountEl!: HTMLElement
  private host!: HTMLElement
  private algInput!: HTMLInputElement

  private raf = 0
  private resizeRo: ResizeObserver | null = null
  private glDisposed = false
  /** Set after WebGL + scene boot completes — `dispose` is a no-op until then. */
  private glInited = false
  /** Clears mount-animation listeners / fallback timer if GL boot is cancelled or completes. */
  private glBootCleanup: (() => void) | null = null
  private animating = false

  private undoStack: Array<{ cube: CubeFaces; moveCount: number }> = []
  private moveCount = 0

  /** Shared PlaneGeometry across all sticker meshes — disposed once */
  private sharedStickerGeom: THREE.BufferGeometry | null = null

  /** Pointer → distinguish click vs orbit drag */
  private ptrDown: { x: number; y: number; button: number } | null = null
  private readonly dragSlop = 5

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void
  private notifyFocus: () => void

  constructor(opts: RubikWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus
    this.notifyFocus = opts.onFocus

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
    bar.addEventListener('mousedown', () => this.notifyFocus())

    const toolbar = document.createElement('div')
    toolbar.className = 'rubik-toolbar'
    const btnScramble = this.mkToolBtn('Scramble', 'Random quarter-turns', () => {
      scrambleCube(this.state, 28)
      this.flushUndo()
      this.moveCount = 0
      this.syncStickerMaterials()
      this.updateStatus()
    })
    const btnReset = this.mkToolBtn('Reset', 'Solved state', () => {
      this.state = solvedCube()
      this.flushUndo()
      this.moveCount = 0
      this.syncStickerMaterials()
      this.updateStatus()
    })
    const btnUndo = this.mkToolBtn('Undo', 'Revert last turn (stack 64)', () => {
      this.undo()
    })
    toolbar.append(btnScramble, btnReset, btnUndo)

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'rubik-status'
    this.statusEl.setAttribute('aria-live', 'polite')

    this.moveCountEl = document.createElement('div')
    this.moveCountEl.className = 'rubik-movecount'
    this.moveCountEl.textContent = 'Moves: 0'

    const algWrap = document.createElement('div')
    algWrap.className = 'rubik-alg-row'
    const algLabel = document.createElement('label')
    algLabel.className = 'rubik-alg-label'
    algLabel.htmlFor = 'rubik-alg-field'
    algLabel.textContent = 'Alg'
    this.algInput = document.createElement('input')
    this.algInput.id = 'rubik-alg-field'
    this.algInput.type = 'text'
    this.algInput.className = 'rubik-alg-input'
    this.algInput.placeholder = 'e.g. R U Rprime U prime'
    this.algInput.autocomplete = 'off'
    this.algInput.spellcheck = false
    this.algInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void this.applyAlgLine()
      }
    })
    const algApply = this.mkToolBtn('Apply', 'Apply notation to cube', () => {
      void this.applyAlgLine()
    })
    algWrap.append(algLabel, this.algInput, algApply)

    const help = document.createElement('div')
    help.className = 'rubik-help'
    help.innerHTML = `
      <div class="rubik-help-title">Controls</div>
      <ul class="rubik-help-list">
        <li><kbd>Click</kbd> a sticker — quarter-turn that face (⌘/Ctrl+click or Shift+click prime)</li>
        <li><kbd>Right-drag</kbd> orbit · <kbd>Middle-drag</kbd> / <kbd>Scroll</kbd> zoom</li>
        <li><kbd>U D L R F B</kbd> turns · <kbd>Shift</kbd> prime · <kbd>⌘/Ctrl</kbd> same as Shift here</li>
        <li><kbd>Space</kbd> scramble · Alg accepts <code>U R U'</code>, <code>rprime</code>, <code>U2</code></li>
      </ul>`

    this.host = document.createElement('div')
    this.host.className = 'rubik-canvas-host'
    this.host.tabIndex = 0

    const moveRow = document.createElement('div')
    moveRow.className = 'rubik-moves'
    for (const m of ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'rubik-move-btn os-toolbar-btn'
      b.textContent = m
      b.addEventListener('click', () => {
        this.commitTurnAnimated(m)
        this.notifyFocus()
        this.el.focus()
      })
      moveRow.appendChild(b)
    }

    const stack = document.createElement('div')
    stack.className = 'rubik-stack'
    stack.appendChild(toolbar)
    stack.appendChild(this.statusEl)
    stack.appendChild(this.moveCountEl)
    stack.appendChild(algWrap)
    stack.appendChild(help)
    stack.appendChild(this.host)
    stack.appendChild(moveRow)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    this.el.addEventListener('keydown', e => this.onKey(e), true)
    this.el.addEventListener('mousedown', () => this.notifyFocus())

    /*
     * WebGL is unreliable while the WM mount animation applies 3D transforms / blur
     * to this tile (black canvas or lost context). Wait for `wm-window-mount` to end
     * (or a fallback timeout — reduced-motion disables CSS animation so `animationend`
     * may never fire).
     */
    queueMicrotask(() => this.scheduleGlBootAfterWmMount())
  }

  /** After `appendToRightPane` + `wm-animate-mount` — see `Desktop.playMountAnim`. */
  private scheduleGlBootAfterWmMount(): void {
    if (this.glDisposed || this.glInited) return

    const boot = (): void => {
      if (this.glDisposed || this.glInited) return
      try {
        this.initThree()
        this.setupStickerClickRouter()
        this.syncStickerMaterials()
        this.updateStatus()
      } catch (err) {
        console.error('[rubik-window] WebGL boot failed', err)
        this.host.innerHTML =
          '<p class="rubik-gl-fallback">WebGL did not start in this tile — try closing other GPU tabs, resizing the window, or another browser.</p>'
      }
    }

    let finished = false
    const runOnce = (): void => {
      if (finished) return
      finished = true
      this.glBootCleanup?.()
      this.glBootCleanup = null
      if (this.glDisposed) return
      requestAnimationFrame(boot)
    }

    const onEnd = (e: AnimationEvent): void => {
      if (e.target !== this.el) return
      if (e.animationName !== 'wm-window-mount') return
      runOnce()
    }

    this.el.addEventListener('animationend', onEnd)
    const tid = window.setTimeout(runOnce, 720)

    this.glBootCleanup = (): void => {
      this.el.removeEventListener('animationend', onEnd)
      window.clearTimeout(tid)
    }
  }

  private mkToolBtn(label: string, title: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'rubik-tool-btn os-toolbar-btn os-toolbar-btn--accent'
    b.textContent = label
    b.title = title
    b.addEventListener('click', () => {
      fn()
      this.notifyFocus()
      this.el.focus()
    })
    return b
  }

  private flushUndo(): void {
    this.undoStack = []
  }

  private pushUndo(): void {
    this.undoStack.push({ cube: cloneCube(this.state), moveCount: this.moveCount })
    if (this.undoStack.length > 64) this.undoStack.shift()
  }

  private undo(): void {
    if (this.animating) return
    const snap = this.undoStack.pop()
    if (!snap) return
    this.state = snap.cube
    this.moveCount = snap.moveCount
    this.resetAllStickerPoses()
    this.syncStickerMaterials()
    this.updateStatus()
  }

  private initThree(): void {
    console.log('[rubik-window] initThree() starting...')
    if (this.glDisposed) {
      console.log('[rubik-window] initThree() aborted - already disposed')
      return
    }
    const scene = new THREE.Scene()
    this.scene = scene
    console.log('[rubik-window] Scene created')

    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    cam.position.set(2.9, 2.2, 3.8)
    this.camera = cam

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    if (!renderer.getContext()) {
      renderer.dispose()
      throw new Error('WebGLRenderer.getContext() returned null')
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x0c0c12, 1)
    renderer.outputColorSpace = SRGBColorSpace
    this.renderer = renderer
    this.host.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.74))
    const d = new THREE.DirectionalLight(0xffffff, 0.5)
    d.position.set(4, 8, 6)
    scene.add(d)

    const plastic = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#14141c'),
      depthWrite: true,
    })
    /* Slightly smaller than the ±1 sticker shell so depth tests stay stable. */
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.94, 1.94, 1.94), plastic)
    scene.add(core)

    this.stickerRoot = new THREE.Group()
    scene.add(this.stickerRoot)

    const geom = new THREE.PlaneGeometry(STICKER, STICKER)
    this.sharedStickerGeom = geom
    let slot = 0
    for (const face of FACET_FACE_ORDER) {
      for (let i = 0; i < 9; i++) {
        const mesh = new THREE.Mesh(
          geom,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color('#888'),
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          }),
        )
        mesh.renderOrder = 1
        mesh.userData.slot = slot
        mesh.userData.cubeFace = face
        mesh.userData.faceIndex = i
        const g = gridTripleFromSticker(face, i)
        mesh.userData.gx = g.gx
        mesh.userData.gy = g.gy
        mesh.userData.gz = g.gz
        this.poseSticker(mesh, face, i)
        this.stickerRoot.add(mesh)
        this.stickerMeshes.push(mesh)
        slot++
      }
    }

    /* After Orbit attaches pointer listeners (incl. setPointerCapture), route sticker clicks via `click`. */
    const ctl = new OrbitControls(cam, renderer.domElement)
    ctl.enableDamping = true
    ctl.dampingFactor = 0.06
    ctl.minDistance = 2.6
    ctl.maxDistance = 16
    ctl.rotateSpeed = 0.65
    ctl.target.set(0, 0, 0)
    ctl.mouseButtons = {
      LEFT: INVALID_MOUSE_ACTION,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.ROTATE,
    }
    this.controls = ctl

    const animate = (): void => {
      this.raf = requestAnimationFrame(animate)
      if (this.el.classList.contains('minimized')) return
      ctl.update()
      renderer.render(scene, cam)
    }
    animate()

    /* Before `observe` — ResizeObserver can fire synchronously and call `resizeGl`. */
    this.glInited = true
    this.resizeRo = new ResizeObserver(() => this.resizeGl())
    this.resizeRo.observe(this.host)
    requestAnimationFrame(() => this.resizeGl())
  }

  /**
   * Use `click` (not pointerup) so we stay compatible with OrbitControls'
   * pointer capture on the same canvas.
   */
  private setupStickerClickRouter(): void {
    const el = this.renderer.domElement
    el.style.touchAction = 'none'

    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      this.ptrDown = { x: e.clientX, y: e.clientY, button: e.button }
    })

    el.addEventListener('pointercancel', () => {
      this.ptrDown = null
    })

    el.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0) return
      if (!this.ptrDown) return
      const dx = e.clientX - this.ptrDown.x
      const dy = e.clientY - this.ptrDown.y
      const moved = Math.hypot(dx, dy)
      this.ptrDown = null
      if (moved > this.dragSlop || this.animating) return

      const r = el.getBoundingClientRect()
      const rw = Math.max(1, r.width)
      const rh = Math.max(1, r.height)
      this.pointerNdc.x = ((e.clientX - r.left) / rw) * 2 - 1
      this.pointerNdc.y = -((e.clientY - r.top) / rh) * 2 + 1
      this.raycaster.setFromCamera(this.pointerNdc, this.camera)
      const hits = this.raycaster.intersectObjects(this.stickerMeshes, false)
      const hit = hits[0]
      if (!hit?.face) return

      const nWorld = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const clicked = hit.object.userData.cubeFace as CubeFaceKey
      const hinted = turnFaceFromWorldNormal(nWorld)
      const face =
        hinted && (hinted === clicked || this.normalsRoughlySame(nWorld, faceOutward(clicked)))
          ? clicked
          : hinted ?? clicked

      const prime = e.shiftKey || e.metaKey || e.ctrlKey
      this.commitTurnFromFace(face, prime)
      this.onFocus()
    })
  }

  private normalsRoughlySame(a: THREE.Vector3, b: THREE.Vector3): boolean {
    return a.dot(b) > 0.92
  }

  private poseSticker(mesh: THREE.Mesh, face: CubeFaceKey, idx: number): void {
    const center = latticeStickerCenter(face, idx)
    const normal = faceOutward(face)
    mesh.position.copy(center)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
  }

  private resetAllStickerPoses(): void {
    let s = 0
    for (const face of FACET_FACE_ORDER) {
      for (let i = 0; i < 9; i++) {
        this.poseSticker(this.stickerMeshes[s]!, face, i)
        s++
      }
    }
  }

  private syncStickerMaterials(): void {
    let s = 0
    for (const face of FACET_FACE_ORDER) {
      for (let i = 0; i < 9; i++) {
        const col = COLOR_HEX[this.state[face][i]!] ?? '#888'
        ;(this.stickerMeshes[s]!.material as THREE.MeshBasicMaterial).color.set(col)
        s++
      }
    }
  }

  private resizeGl(): void {
    if (this.glDisposed) return
    const r = this.host.getBoundingClientRect()
    const w = Math.max(160, r.width)
    const h = Math.max(160, r.height)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private updateStatus(): void {
    this.statusEl.textContent = isSolved(this.state) ? 'Solved.' : ''
    this.moveCountEl.textContent = `Moves: ${this.moveCount}`
  }

  private easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3
  }

  /** Click uses outward face + modifier for prime quarter-turns. */
  private commitTurnFromFace(face: CubeMoveFace, prime: boolean): void {
    const token = (prime ? `${face}'` : face) as TurnToken
    this.commitTurnAnimated(token)
  }

  private async animateSliceTurn(token: TurnToken): Promise<void> {
    console.log('[rubik-window] animateSliceTurn starting:', token)
    this.animating = true

    const fn = MOVE_MAP[token]
    if (!fn) {
      console.log('[rubik-window] No move function for token:', token)
      this.animating = false
      return
    }
    console.log('[rubik-window] Move function found for:', token)

    const faceLetter = token[0] as CubeMoveFace
    const isDouble = token.endsWith('2')
    const isPrime = !isDouble && token.endsWith("'")
    const angleBase = animAxisAndAngle(faceLetter, false)[1]
    const axis = animAxisAndAngle(faceLetter, false)[0]
    const totalAngle = isDouble ? angleBase * 2 : animAxisAndAngle(faceLetter, isPrime)[1]
    const duration = isDouble ? MOVE_MS * 1.55 : MOVE_MS

    const layerPick = (i: number) => stickerInAnimatedLayer(faceLetter, i)
    const affected = this.stickerMeshes.filter((_, i) => layerPick(i))

    const pivot = new THREE.Group()
    this.scene.add(pivot)
    for (const m of affected) pivot.attach(m)

    const t0 = performance.now()

    await new Promise<void>(resolve => {
      const step = (now: number): void => {
        const u = Math.min(1, (now - t0) / duration)
        const e = this.easeOutCubic(u)
        pivot.quaternion.identity()
        pivot.rotateOnWorldAxis(axis, totalAngle * e)
        if (u < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })

    for (const m of [...pivot.children]) this.stickerRoot.attach(m as THREE.Mesh)
    pivot.removeFromParent()

    fn(this.state)
    this.animating = false
    this.resetAllStickerPoses()
    this.syncStickerMaterials()
    this.updateStatus()
  }

  /** Animated slice + undo snapshot + move counter. */
  private commitTurnAnimated(token: TurnToken): void {
    if (!this.glInited) return
    if (this.animating) return
    if (!MOVE_MAP[token]) return

    this.pushUndo()
    const inc = token.endsWith('2') ? 2 : 1
    this.moveCount += inc

    void this.animateSliceTurn(token)
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.glInited) return
    if (e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      if (this.animating) return
      scrambleCube(this.state, 26)
      this.flushUndo()
      this.moveCount = 0
      this.resetAllStickerPoses()
      this.syncStickerMaterials()
      this.updateStatus()
      return
    }

    const map: Record<string, CubeMoveFace> = {
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
    const prime = e.shiftKey
    const token = (prime ? `${base}'` : base) as TurnToken
    this.commitTurnAnimated(token)
  }

  private applyAlgLine(): void {
    if (this.animating) return
    const raw = this.algInput.value.trim()
    if (!raw) return

    const norm = normalizeNotationInput(raw)
    if (!norm) {
      const prevSolve = this.statusEl.textContent
      this.statusEl.textContent =
        'Alg: could not parse — use spaced tokens like R U Rprime F2 Ui'
      window.setTimeout(() => {
        this.statusEl.textContent = prevSolve
        this.updateStatus()
      }, 2800)
      return
    }

    const next = cloneCube(this.state)
    if (!applyNotationStrict(next, norm)) {
      const prevSolve = this.statusEl.textContent
      this.statusEl.textContent = 'Alg: unknown move token in sequence.'
      window.setTimeout(() => {
        this.statusEl.textContent = prevSolve
        this.updateStatus()
      }, 2800)
      return
    }

    const nt = norm.split(/\s+/).filter(Boolean).length
    this.pushUndo()
    this.state = next
    this.moveCount += nt
    this.syncStickerMaterials()
    this.algInput.value = ''
    this.updateStatus()
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
    this.glBootCleanup?.()
    this.glBootCleanup = null
    cancelAnimationFrame(this.raf)
    if (!this.glInited) return
    this.resizeRo?.disconnect()
    this.resizeRo = null
    this.controls.dispose()
    for (const m of this.stickerMeshes) {
      const mat = m.material
      if (Array.isArray(mat)) mat.forEach(x => x.dispose())
      else (mat as THREE.Material).dispose()
    }
    this.sharedStickerGeom?.dispose()
    this.sharedStickerGeom = null
    this.renderer.dispose()
  }
}
