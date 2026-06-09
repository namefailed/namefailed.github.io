/**
 * Interactive 3×3 Rubik's cube tile.
 *
 * Interaction:
 *   Drag a sticker       — quarter-turn that face (drag direction = turn sense)
 *   Tap a sticker        — clockwise quarter-turn (Shift = prime)
 *   Right-drag / scroll  — orbit / zoom the view
 *   Face buttons         — U D L R F B (Shift = prime)
 *   U D L R F B keys     — turn (Shift = prime)
 *   Space                — animated scramble
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
  inferFaceTurnFromScreenDrag,
  turnTokenForFace,
  type CubeMoveFace,
} from './rubik-stickers-layout'
import { createWindowChrome } from './window-chrome'

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

  /** Active sticker drag-turn gesture (left pointer on a face). */
  private pointerTurn: {
    face: CubeMoveFace
    startX: number
    startY: number
    shiftKey: boolean
    pointerId: number
    center: THREE.Vector3
  } | null = null
  private hoveredMesh: THREE.Mesh | null = null

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

    this.el.appendChild(this.buildChrome())
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

  private buildChrome(): HTMLElement {
    const { titlebar } = createWindowChrome({
      title: 'cube',
      onClose: () => {
        this.dispose()
        this.onClose()
      },
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: () => this.notifyFocus(),
    })
    return titlebar
  }

  private buildBody(): HTMLElement {
    const stack = document.createElement('div')
    stack.className = 'rubik-stack'

    // ── Canvas stage (primary — most of the tile height) ─────────────────────
    const stage = document.createElement('div')
    stage.className = 'rubik-stage'

    this.host = document.createElement('div')
    this.host.className = 'rubik-canvas-host'
    this.host.tabIndex = 0

    const hint = document.createElement('p')
    hint.className = 'rubik-stage-hint'
    hint.textContent = 'Drag a face to turn · Right-drag to rotate · Scroll to zoom'

    stage.append(this.host, hint)

    const controls = document.createElement('div')
    controls.className = 'rubik-controls'

    // ── primary toolbar ─────────────────────────────────────────────────────
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

    // ── status row ──────────────────────────────────────────────────────────
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
      const v = Number(speedSlider.value)
      this.speedMultiplier = 1 / Math.max(0.3, v)
    })
    speedLabel.appendChild(speedSlider)

    statusRow.append(this.moveCountEl, this.statusEl, speedLabel)

    // ── compact face pad (6 faces, not 18 notation buttons) ───────────────
    const facePad = document.createElement('div')
    facePad.className = 'rubik-face-pad'
    facePad.setAttribute('role', 'group')
    facePad.setAttribute('aria-label', 'Face turns')

    const faceOrder: CubeMoveFace[] = ['U', 'D', 'L', 'R', 'F', 'B']
    for (const face of faceOrder) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'rubik-face-btn'
      b.dataset.face = face
      b.textContent = face
      b.title = `${face} clockwise · Shift = counter-clockwise`
      b.addEventListener('click', e => {
        if (this.sequenceRunning) return
        const token = (e.shiftKey ? `${face}'` : face) as TurnToken
        this.commitTurnAnimated(token)
        this.notifyFocus()
        this.el.focus()
      })
      facePad.appendChild(b)
    }

    // ── advanced (algorithms + notation) — collapsed by default ─────────────
    const advanced = document.createElement('details')
    advanced.className = 'rubik-advanced'

    const advancedSummary = document.createElement('summary')
    advancedSummary.className = 'rubik-advanced-summary'
    advancedSummary.textContent = 'Algorithms & notation'
    advanced.appendChild(advancedSummary)

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

    this.algInput = document.createElement('input')
    this.algInput.type = 'text'
    this.algInput.className = 'rubik-alg-input'
    this.algInput.placeholder = "R U R' U2 F'"
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
    advanced.appendChild(algRow)

    const help = document.createElement('details')
    help.className = 'rubik-help'
    help.innerHTML = `
      <summary class="rubik-help-summary">Keyboard shortcuts</summary>
      <ul class="rubik-help-list">
        <li><kbd>Drag</kbd> a sticker — turn that face (direction follows your drag)</li>
        <li><kbd>Tap</kbd> a sticker — clockwise · <kbd>Shift</kbd> = prime</li>
        <li><kbd>Right-drag</kbd> — orbit · <kbd>Scroll</kbd> — zoom</li>
        <li><kbd>U D L R F B</kbd> — turn · <kbd>Shift</kbd> = prime · <kbd>Space</kbd> — scramble</li>
      </ul>
    `

    controls.append(toolbar, statusRow, facePad, advanced, help)
    stack.append(stage, controls)
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
        this.setupPointerRouter()
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

    // Orbit with right-drag only — left pointer is reserved for face turns.
    const ctl = new OrbitControls(cam, renderer.domElement)
    ctl.enableDamping = true
    ctl.dampingFactor = 0.07
    ctl.minDistance = 2.6
    ctl.maxDistance = 16
    ctl.rotateSpeed = 0.75
    ctl.target.set(0, 0, 0)
    ctl.enablePan = false
    ctl.mouseButtons = {
      LEFT: null as unknown as MOUSE,
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

    this.glInited = true
    this.resizeRo = new ResizeObserver(() => this.resizeGl())
    this.resizeRo.observe(this.host)
    requestAnimationFrame(() => this.resizeGl())
  }

  // ── Pointer: drag-to-turn, tap, hover highlight ─────────────────────────────

  private setupPointerRouter(): void {
    const el = this.renderer.domElement
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', e => this.onCanvasPointerDown(e))
    el.addEventListener('pointermove', e => this.onCanvasPointerMove(e))
    el.addEventListener('pointerup', e => this.onCanvasPointerUp(e))
    el.addEventListener('pointercancel', e => this.onCanvasPointerUp(e))
    el.addEventListener('pointerleave', () => this.clearStickerHover())
  }

  private raycastSticker(clientX: number, clientY: number): THREE.Mesh | null {
    const el = this.renderer.domElement
    const rect = el.getBoundingClientRect()
    this.pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    this.pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(this.stickerMeshes, false)
    return (hits[0]?.object as THREE.Mesh | undefined) ?? null
  }

  private onCanvasPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return
    if (this.singleTurnAnimating || this.sequenceRunning) return

    const hit = this.raycastSticker(e.clientX, e.clientY)
    if (!hit) return

    e.preventDefault()
    const face = hit.userData.cubeFace as CubeMoveFace
    const idx = hit.userData.faceIndex as number
    const center = latticeStickerCenter(face, idx)

    this.pointerTurn = {
      face,
      startX: e.clientX,
      startY: e.clientY,
      shiftKey: e.shiftKey,
      pointerId: e.pointerId,
      center,
    }
    this.controls.enabled = false
    this.renderer.domElement.setPointerCapture(e.pointerId)
    this.setStickerHover(hit)
  }

  private onCanvasPointerMove(e: PointerEvent): void {
    if (this.pointerTurn) return
    if (this.singleTurnAnimating || this.sequenceRunning) {
      this.clearStickerHover()
      return
    }
    const hit = this.raycastSticker(e.clientX, e.clientY)
    this.setStickerHover(hit)
  }

  private onCanvasPointerUp(e: PointerEvent): void {
    const turn = this.pointerTurn
    if (!turn || e.pointerId !== turn.pointerId) return

    const el = this.renderer.domElement
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    this.pointerTurn = null
    this.controls.enabled = true

    if (this.singleTurnAnimating || this.sequenceRunning) return

    const rect = el.getBoundingClientRect()
    const sense = inferFaceTurnFromScreenDrag(
      turn.face,
      this.camera,
      turn.center,
      turn.startX,
      turn.startY,
      e.clientX,
      e.clientY,
      rect,
    )

    let token: TurnToken
    if (sense) {
      token = turnTokenForFace(turn.face, sense) as TurnToken
    } else {
      token = (turn.shiftKey || e.shiftKey ? `${turn.face}'` : turn.face) as TurnToken
    }

    this.commitTurnAnimated(token)
    this.notifyFocus()
  }

  private setStickerHover(mesh: THREE.Mesh | null): void {
    if (this.hoveredMesh === mesh) return
    if (this.hoveredMesh) {
      this.hoveredMesh.scale.set(1, 1, 1)
      const mat = this.hoveredMesh.material as THREE.MeshBasicMaterial
      if (this.hoveredMesh.userData.baseHex) mat.color.set(this.hoveredMesh.userData.baseHex as string)
    }
    this.hoveredMesh = mesh
    if (mesh) {
      mesh.scale.set(1.06, 1.06, 1.06)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mesh.userData.baseHex = `#${mat.color.getHexString()}`
      mat.color.offsetHSL(0, 0, 0.12)
    }
  }

  private clearStickerHover(): void {
    this.setStickerHover(null)
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
