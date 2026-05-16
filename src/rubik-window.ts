/**
 * Interactive 3×3 Rubik's cube tile.
 *
 * Interaction:
 *   Left-drag on canvas   — orbit camera (spin the cube)
 *   Left-click a sticker  — quarter-turn that face (Shift/Ctrl/⌘ = prime)
 *   Middle-drag / scroll  — zoom
 *   Right-drag            — pan
 *   U D L R F B keys      — turn (Shift = prime)
 *   Space                 — animated scramble
 *
 * Toolbar buttons drive animated sequences:
 *   Scramble — generates a no-repeat random sequence then plays it
 *   Solve    — plays inverse of full move history (returns to solved)
 *   Algorithm picker — runs a canonical alg (Sune, T-perm, etc.)
 *   Stop     — aborts an in-progress sequence
 */

import * as THREE from 'three'
import { SRGBColorSpace, MOUSE } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  type CubeFaces,
  type CubeFaceKey,
  MOVE_MAP,
  isSolved,
  solvedCube,
  cloneCube,
  applyNotationStrict,
  normalizeNotationInput,
  invertSequence,
  generateScrambleSequence,
  CANONICAL_ALGORITHMS,
} from './rubik-model'
import {
  FACET_FACE_ORDER,
  animAxisAndAngle,
  faceOutward,
  latticeStickerCenter,
  stickerInAnimatedLayer,
  type CubeMoveFace,
} from './rubik-stickers-layout'

export interface RubikWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

/** Catppuccin-leaning sticker palette: U/R/F/D/L/B → white/red/green/orange/purple/blue. */
const COLOR_HEX = ['#f5f5f7', '#eb6f92', '#a6e3a1', '#fab387', '#cba6f7', '#89b4fa']

const STICKER_SIZE = (2 / 3) * 0.9

/** Base duration for a quarter-turn animation. Speed slider scales this. */
const BASE_TURN_MS = 280

/** Delay between sequence steps — kept small so playback feels continuous. */
const SEQUENCE_STEP_GAP_MS = 60

type TurnToken = keyof typeof MOVE_MAP

export class RubikWindow {
  readonly el: HTMLElement
  readonly command = 'cube' as const
  readonly onFocus: () => void

  // ── Model state ─────────────────────────────────────────────────────────────
  private state: CubeFaces
  /** Full move history since last "Reset" — used to compute Solve as inverse. */
  private moveHistory: TurnToken[] = []
  /** True while a sequence (scramble/solve/algorithm) is running. */
  private sequenceRunning = false
  /** Flipped by Stop button — checked between sequence steps. */
  private sequenceAbort = false
  /** Set during a single turn's animation; blocks new turns. */
  private singleTurnAnimating = false
  /** Animation speed multiplier (1.0 = BASE_TURN_MS; larger = slower). */
  private speedMultiplier = 1.0

  // ── Three.js scene ──────────────────────────────────────────────────────────
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls
  private stickerRoot!: THREE.Group
  private stickerMeshes: THREE.Mesh[] = []
  private sharedStickerGeom: THREE.BufferGeometry | null = null
  private raycaster = new THREE.Raycaster()
  private pointerNdc = new THREE.Vector2()

  // ── DOM refs ────────────────────────────────────────────────────────────────
  private statusEl!: HTMLElement
  private moveCountEl!: HTMLElement
  private host!: HTMLElement
  private algInput!: HTMLInputElement
  private algSelect!: HTMLSelectElement
  private scrambleBtn!: HTMLButtonElement
  private solveBtn!: HTMLButtonElement
  private stopBtn!: HTMLButtonElement
  private resetBtn!: HTMLButtonElement

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  private raf = 0
  private resizeRo: ResizeObserver | null = null
  private glDisposed = false
  private glInited = false
  private glBootCleanup: (() => void) | null = null

  /** Pointer-down position — used to distinguish click from drag. */
  private ptrDown: { x: number; y: number } | null = null
  private readonly dragSlopPx = 5

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

    this.el.appendChild(this.buildTitleBar())
    this.el.appendChild(this.buildBody())

    this.el.addEventListener('keydown', e => this.onKey(e), true)
    this.el.addEventListener('mousedown', () => this.notifyFocus())

    /*
     * WebGL is unreliable while the WM mount animation applies 3D transforms.
     * Wait for `wm-window-mount` animationend (or a 720ms fallback for
     * reduced-motion users where the animation never fires).
     */
    queueMicrotask(() => this.scheduleGlBootAfterWmMount())
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  private buildTitleBar(): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left"><span class="win-title">cube</span></div>
      <div class="win-traffic">
        <span class="dot dot-min"   title="minimize (ctrl+m)"></span>
        <span class="dot dot-max"   title="maximize / restore (ctrl+f)"></span>
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
    return bar
  }

  private buildBody(): HTMLElement {
    const stack = document.createElement('div')
    stack.className = 'rubik-stack'

    // ── primary toolbar: scramble · solve · stop · reset ────────────────────
    const toolbar = document.createElement('div')
    toolbar.className = 'rubik-toolbar'

    this.scrambleBtn = this.makeToolButton('Scramble', 'Animate a 25-move scramble', () => {
      void this.runScrambleAnimated(25)
    })
    this.solveBtn = this.makeToolButton('Solve', 'Animate inverse of move history', () => {
      void this.runSolveAnimated()
    })
    this.stopBtn = this.makeToolButton('Stop', 'Abort the in-progress sequence', () => {
      this.sequenceAbort = true
    })
    this.stopBtn.disabled = true
    this.resetBtn = this.makeToolButton('Reset', 'Restore solved state', () => {
      if (this.sequenceRunning) return
      this.state = solvedCube()
      this.moveHistory = []
      this.resetAllStickerPoses()
      this.syncStickerMaterials()
      this.updateStatus()
    })

    toolbar.append(this.scrambleBtn, this.solveBtn, this.stopBtn, this.resetBtn)

    // ── status row: move count + solved indicator + speed slider ────────────
    const statusRow = document.createElement('div')
    statusRow.className = 'rubik-status-row'

    this.moveCountEl = document.createElement('div')
    this.moveCountEl.className = 'rubik-movecount'
    this.moveCountEl.textContent = 'Moves: 0'

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'rubik-status'
    this.statusEl.setAttribute('aria-live', 'polite')

    const speedLabel = document.createElement('label')
    speedLabel.className = 'rubik-speed-label'
    speedLabel.textContent = 'Speed'
    const speedSlider = document.createElement('input')
    speedSlider.type = 'range'
    speedSlider.min = '0.3'
    speedSlider.max = '2.5'
    speedSlider.step = '0.1'
    speedSlider.value = '1.0'
    speedSlider.className = 'rubik-speed-slider'
    speedSlider.title = 'Animation speed (faster ←→ slower)'
    speedSlider.addEventListener('input', () => {
      // Slider value is "speed" — invert for duration multiplier.
      const v = Number(speedSlider.value)
      this.speedMultiplier = 1 / Math.max(0.3, v)
    })
    speedLabel.appendChild(speedSlider)

    statusRow.append(this.moveCountEl, this.statusEl, speedLabel)

    // ── algorithm picker dropdown ───────────────────────────────────────────
    const algRow = document.createElement('div')
    algRow.className = 'rubik-alg-row'

    this.algSelect = document.createElement('select')
    this.algSelect.className = 'rubik-alg-select'
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = '— pick an algorithm —'
    placeholder.disabled = true
    placeholder.selected = true
    this.algSelect.appendChild(placeholder)
    for (const [key, alg] of Object.entries(CANONICAL_ALGORITHMS)) {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = `${alg.label}  —  ${alg.moves}`
      opt.title = alg.description
      this.algSelect.appendChild(opt)
    }

    const runAlgBtn = this.makeToolButton('Run', 'Apply selected algorithm to the cube', () => {
      const key = this.algSelect.value
      if (!key) return
      const alg = CANONICAL_ALGORITHMS[key]
      if (!alg) return
      void this.runSequence(alg.moves.split(/\s+/).filter(Boolean) as TurnToken[])
    })

    // ── free-form notation input ────────────────────────────────────────────
    this.algInput = document.createElement('input')
    this.algInput.type = 'text'
    this.algInput.className = 'rubik-alg-input'
    this.algInput.placeholder = "custom notation: R U R' U2 F'"
    this.algInput.autocomplete = 'off'
    this.algInput.spellcheck = false
    this.algInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void this.applyAlgInput()
      }
    })
    const applyBtn = this.makeToolButton('Apply', 'Animate the custom notation', () => {
      void this.applyAlgInput()
    })

    algRow.append(this.algSelect, runAlgBtn, this.algInput, applyBtn)

    // ── manual move buttons ─────────────────────────────────────────────────
    const moveRow = document.createElement('div')
    moveRow.className = 'rubik-moves'
    const tokens: TurnToken[] = [
      'U', "U'", 'U2',
      'D', "D'", 'D2',
      'L', "L'", 'L2',
      'R', "R'", 'R2',
      'F', "F'", 'F2',
      'B', "B'", 'B2',
    ]
    for (const tok of tokens) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'rubik-move-btn os-toolbar-btn'
      b.textContent = tok
      b.addEventListener('click', () => {
        if (this.sequenceRunning) return
        this.commitTurnAnimated(tok)
        this.notifyFocus()
        this.el.focus()
      })
      moveRow.appendChild(b)
    }

    // ── help text ───────────────────────────────────────────────────────────
    const help = document.createElement('details')
    help.className = 'rubik-help'
    help.innerHTML = `
      <summary class="rubik-help-summary">Controls</summary>
      <ul class="rubik-help-list">
        <li><kbd>Left-drag</kbd> on canvas — spin the cube (orbit)</li>
        <li><kbd>Click</kbd> a sticker — quarter-turn that face (<kbd>Shift</kbd>/<kbd>Ctrl</kbd> = prime)</li>
        <li><kbd>Middle-drag</kbd> / <kbd>Scroll</kbd> — zoom · <kbd>Right-drag</kbd> — pan</li>
        <li><kbd>U D L R F B</kbd> — turn that face · <kbd>Shift</kbd> = prime</li>
        <li><kbd>Space</kbd> — scramble · Custom notation accepts <code>R U R' U2 F'</code></li>
      </ul>
    `

    // ── canvas host ─────────────────────────────────────────────────────────
    this.host = document.createElement('div')
    this.host.className = 'rubik-canvas-host'
    this.host.tabIndex = 0

    stack.append(toolbar, statusRow, algRow, moveRow, help, this.host)
    return stack
  }

  private makeToolButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'rubik-tool-btn os-toolbar-btn os-toolbar-btn--accent'
    b.textContent = label
    b.title = title
    b.addEventListener('click', () => {
      onClick()
      this.notifyFocus()
      this.el.focus()
    })
    return b
  }

  // ── WebGL boot ──────────────────────────────────────────────────────────────

  private scheduleGlBootAfterWmMount(): void {
    if (this.glDisposed || this.glInited) return

    const boot = (): void => {
      if (this.glDisposed || this.glInited) return
      try {
        this.initThree()
        this.setupStickerClickRouter()
        this.syncStickerMaterials()
        this.updateStatus()
      } catch {
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

  private initThree(): void {
    if (this.glDisposed) return

    const scene = new THREE.Scene()
    this.scene = scene

    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    cam.position.set(3.0, 2.4, 3.8)
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
    const dir = new THREE.DirectionalLight(0xffffff, 0.5)
    dir.position.set(4, 8, 6)
    scene.add(dir)

    // Black plastic body, slightly inset so stickers sit cleanly on top.
    const plastic = new THREE.MeshBasicMaterial({ color: 0x14141c, depthWrite: true })
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.94, 1.94, 1.94), plastic)
    scene.add(core)

    this.stickerRoot = new THREE.Group()
    scene.add(this.stickerRoot)

    const geom = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE)
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
        this.poseSticker(mesh, face, i)
        this.stickerRoot.add(mesh)
        this.stickerMeshes.push(mesh)
        slot++
      }
    }

    // OrbitControls — LEFT=rotate is the natural "spin the cube" feel.
    const ctl = new OrbitControls(cam, renderer.domElement)
    ctl.enableDamping = true
    ctl.dampingFactor = 0.07
    ctl.minDistance = 2.6
    ctl.maxDistance = 16
    ctl.rotateSpeed = 0.75
    ctl.target.set(0, 0, 0)
    ctl.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    }
    this.controls = ctl

    const animate = (): void => {
      this.raf = requestAnimationFrame(animate)
      if (this.el.classList.contains('minimized')) return
      ctl.update()
      renderer.render(scene, cam)
    }
    animate()

    this.glInited = true
    this.resizeRo = new ResizeObserver(() => this.resizeGl())
    this.resizeRo.observe(this.host)
    requestAnimationFrame(() => this.resizeGl())
  }

  // ── Sticker click → quarter-turn ────────────────────────────────────────────

  private setupStickerClickRouter(): void {
    const el = this.renderer.domElement
    el.style.touchAction = 'none'

    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      this.ptrDown = { x: e.clientX, y: e.clientY }
    })
    el.addEventListener('pointercancel', () => {
      this.ptrDown = null
    })

    el.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0) return
      if (!this.ptrDown) return
      const moved = Math.hypot(e.clientX - this.ptrDown.x, e.clientY - this.ptrDown.y)
      this.ptrDown = null
      if (moved > this.dragSlopPx) return
      if (this.singleTurnAnimating || this.sequenceRunning) return

      const rect = el.getBoundingClientRect()
      this.pointerNdc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      this.pointerNdc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      this.raycaster.setFromCamera(this.pointerNdc, this.camera)
      const hits = this.raycaster.intersectObjects(this.stickerMeshes, false)
      const hit = hits[0]
      if (!hit) return

      const face = hit.object.userData.cubeFace as CubeFaceKey
      const prime = e.shiftKey || e.metaKey || e.ctrlKey
      const token = (prime ? `${face}'` : face) as TurnToken
      this.commitTurnAnimated(token)
    })
  }

  // ── Sticker positioning ─────────────────────────────────────────────────────

  private poseSticker(mesh: THREE.Mesh, face: CubeFaceKey, idx: number): void {
    const center = latticeStickerCenter(face, idx)
    const normal = faceOutward(face)
    mesh.position.copy(center)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
  }

  private resetAllStickerPoses(): void {
    for (const mesh of this.stickerMeshes) {
      const face = mesh.userData.cubeFace as CubeFaceKey
      const idx = mesh.userData.faceIndex as number
      this.poseSticker(mesh, face, idx)
    }
  }

  private syncStickerMaterials(): void {
    let slot = 0
    for (const face of FACET_FACE_ORDER) {
      for (let i = 0; i < 9; i++) {
        const colorIdx = this.state[face][i]!
        const hex = COLOR_HEX[colorIdx] ?? '#888'
        ;(this.stickerMeshes[slot]!.material as THREE.MeshBasicMaterial).color.set(hex)
        slot++
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

  // ── Status / button state ───────────────────────────────────────────────────

  private updateStatus(message?: string): void {
    if (message !== undefined) {
      this.statusEl.textContent = message
    } else if (this.sequenceRunning) {
      this.statusEl.textContent = ''
    } else {
      this.statusEl.textContent = isSolved(this.state) ? '✓ solved' : ''
    }
    this.moveCountEl.textContent = `Moves: ${this.moveHistory.length}`
    this.refreshButtonState()
  }

  private refreshButtonState(): void {
    this.scrambleBtn.disabled = this.sequenceRunning
    this.solveBtn.disabled = this.sequenceRunning || this.moveHistory.length === 0
    this.resetBtn.disabled = this.sequenceRunning
    this.stopBtn.disabled = !this.sequenceRunning
  }

  // ── Turn animation ──────────────────────────────────────────────────────────

  private easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3
  }

  /** Animate a single turn. Updates `state` and `moveHistory` on completion. */
  private async animateSingleTurn(token: TurnToken): Promise<void> {
    const fn = MOVE_MAP[token]
    if (!fn) return

    this.singleTurnAnimating = true

    const faceLetter = token[0] as CubeMoveFace
    const isDouble = token.endsWith('2')
    const isPrime = !isDouble && token.endsWith("'")
    const [axis, baseAngle] = animAxisAndAngle(faceLetter, false)
    const [, primeAngle] = animAxisAndAngle(faceLetter, isPrime)
    const totalAngle = isDouble ? baseAngle * 2 : primeAngle
    const duration = (isDouble ? BASE_TURN_MS * 1.55 : BASE_TURN_MS) * this.speedMultiplier

    const affected = this.stickerMeshes.filter((_, i) => stickerInAnimatedLayer(faceLetter, i))
    const pivot = new THREE.Group()
    this.scene.add(pivot)
    for (const mesh of affected) pivot.attach(mesh)

    const t0 = performance.now()
    await new Promise<void>(resolve => {
      const step = (now: number): void => {
        const u = Math.min(1, (now - t0) / duration)
        const eased = this.easeOutCubic(u)
        pivot.quaternion.identity()
        pivot.rotateOnWorldAxis(axis, totalAngle * eased)
        if (u < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })

    for (const m of [...pivot.children]) this.stickerRoot.attach(m as THREE.Mesh)
    pivot.removeFromParent()

    fn(this.state)
    this.moveHistory.push(token)
    this.resetAllStickerPoses()
    this.syncStickerMaterials()
    this.singleTurnAnimating = false
  }

  /** Public entry — fire-and-forget single turn (manual button / keyboard). */
  private commitTurnAnimated(token: TurnToken): void {
    if (!this.glInited) return
    if (this.singleTurnAnimating || this.sequenceRunning) return
    if (!MOVE_MAP[token]) return
    void (async () => {
      await this.animateSingleTurn(token)
      this.updateStatus()
    })()
  }

  // ── Sequence playback (scramble / solve / algorithm) ────────────────────────

  /** Animate a list of tokens in order, one at a time. Aborts on `sequenceAbort`. */
  private async runSequence(tokens: TurnToken[]): Promise<void> {
    if (this.sequenceRunning || this.singleTurnAnimating) return
    if (tokens.length === 0) return

    this.sequenceRunning = true
    this.sequenceAbort = false
    this.refreshButtonState()
    this.updateStatus(`Running ${tokens.length} moves…`)

    for (const token of tokens) {
      if (this.sequenceAbort) break
      if (!MOVE_MAP[token]) continue
      await this.animateSingleTurn(token)
      this.updateStatus(`Running ${tokens.length} moves…`)
      if (this.sequenceAbort) break
      // Tiny gap so the eye can register each move at slow speeds.
      await new Promise(r => setTimeout(r, SEQUENCE_STEP_GAP_MS))
    }

    this.sequenceRunning = false
    this.sequenceAbort = false
    this.updateStatus()
  }

  private async runScrambleAnimated(length: number): Promise<void> {
    const seq = generateScrambleSequence(length) as TurnToken[]
    await this.runSequence(seq)
  }

  private async runSolveAnimated(): Promise<void> {
    if (this.moveHistory.length === 0) return
    // Inverse of the full move history brings the cube back to solved.
    const inverse = invertSequence(this.moveHistory.join(' ')).split(/\s+/).filter(Boolean) as TurnToken[]
    // Wipe history BEFORE playback so the inverse moves we append don't get
    // counted again. Length displayed counts the moves we're about to play.
    this.moveHistory = []
    this.updateStatus()
    await this.runSequence(inverse)
    // After a successful inverse, history will equal `inverse` — clear it
    // so the cube reports 0 moves at the solved end.
    if (!this.sequenceAbort) {
      this.moveHistory = []
      this.updateStatus()
    }
  }

  // ── Keyboard handler ────────────────────────────────────────────────────────

  private onKey(e: KeyboardEvent): void {
    if (!this.glInited) return
    if (e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      if (this.sequenceRunning || this.singleTurnAnimating) return
      void this.runScrambleAnimated(25)
      return
    }

    const faceMap: Record<string, CubeMoveFace> = {
      KeyU: 'U', KeyD: 'D', KeyL: 'L', KeyR: 'R', KeyF: 'F', KeyB: 'B',
    }
    const base = faceMap[e.code]
    if (!base) return
    e.preventDefault()
    e.stopPropagation()
    const token = (e.shiftKey ? `${base}'` : base) as TurnToken
    this.commitTurnAnimated(token)
  }

  // ── Notation input ──────────────────────────────────────────────────────────

  private async applyAlgInput(): Promise<void> {
    if (this.sequenceRunning) return
    const raw = this.algInput.value.trim()
    if (!raw) return

    const normalized = normalizeNotationInput(raw)
    if (!normalized) {
      this.flashStatus("Couldn't parse — use spaced WCA tokens like  R U R' U2 F'")
      return
    }

    // Dry-run on a clone so we reject unknown tokens before animating.
    const dryRun = cloneCube(this.state)
    if (!applyNotationStrict(dryRun, normalized)) {
      this.flashStatus('Unknown move token in sequence.')
      return
    }

    this.algInput.value = ''
    const tokens = normalized.split(/\s+/).filter(Boolean) as TurnToken[]
    await this.runSequence(tokens)
  }

  private flashStatus(message: string): void {
    this.updateStatus(message)
    window.setTimeout(() => this.updateStatus(), 2400)
  }

  // ── External API ────────────────────────────────────────────────────────────

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
    this.sequenceAbort = true
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
