/**
 * 3×3 Rubik's cube tile — powered by cubing.js (MPL-2.0).
 * @see https://github.com/cubing/cubing.js
 */

import { TwistyPlayer } from 'cubing/twisty'
import { randomScrambleForEvent } from 'cubing/scramble'
import {
  CANONICAL_ALGORITHMS,
  normalizeNotationInput,
  invertSequence,
} from './rubik-model'
import { createWindowChrome } from './window-chrome'

export interface RubikWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

type CubeMoveFace = 'U' | 'D' | 'L' | 'R' | 'F' | 'B'

const CUBING_REPO = 'https://github.com/cubing/cubing.js'

/**
 * Rubik's cube tile built on cubing.js `TwistyPlayer`. Scramble / solve / reset and
 * free-typed algorithms run behind a `busy` gate so inputs can't overlap a running
 * animation. `dispose()` tears the player down.
 */
export class RubikWindow {
  readonly el: HTMLElement
  readonly command = 'cube' as const
  readonly onFocus: () => void

  private player: TwistyPlayer | null = null
  private busy = false

  private statusEl!: HTMLElement
  private moveCountEl!: HTMLElement
  private host!: HTMLElement
  private algInput!: HTMLInputElement
  private algSelect!: HTMLSelectElement
  private scrambleBtn!: HTMLButtonElement
  private solveBtn!: HTMLButtonElement
  private stopBtn!: HTMLButtonElement
  private resetBtn!: HTMLButtonElement

  private disposed = false
  private movePollTimer = 0

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

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window rubik-app rubik-app--3d'
    this.el.dataset.app = 'cube'
    this.el.tabIndex = -1

    this.el.appendChild(this.buildChrome())
    this.el.appendChild(this.buildBody())

    this.el.addEventListener('keydown', e => this.onKey(e), true)
    this.el.addEventListener('mousedown', () => this.notifyFocus())

    queueMicrotask(() => this.mountPlayer())
  }

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

    const stage = document.createElement('div')
    stage.className = 'rubik-stage'

    this.host = document.createElement('div')
    this.host.className = 'rubik-canvas-host rubik-player-host'
    this.host.tabIndex = 0

    const hint = document.createElement('p')
    hint.className = 'rubik-stage-hint'
    hint.textContent = 'Drag a sticker to turn that layer · Right-drag to orbit · Scroll to zoom'

    stage.append(this.host, hint)

    const controls = document.createElement('div')
    controls.className = 'rubik-controls'

    const toolbar = document.createElement('div')
    toolbar.className = 'rubik-toolbar'

    this.scrambleBtn = this.makeToolButton('Scramble', 'WCA random-state scramble', () => {
      void this.runScramble()
    })
    this.solveBtn = this.makeToolButton('Solve', 'Animate inverse of current sequence', () => {
      void this.runSolve()
    })
    this.stopBtn = this.makeToolButton('Stop', 'Pause playback', () => this.stopPlayback())
    this.stopBtn.disabled = true
    this.resetBtn = this.makeToolButton('Reset', 'Return to solved state', () => this.resetCube())

    toolbar.append(this.scrambleBtn, this.solveBtn, this.stopBtn, this.resetBtn)

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
    speedSlider.min = '0.4'
    speedSlider.max = '2.4'
    speedSlider.step = '0.1'
    speedSlider.value = '1.0'
    speedSlider.className = 'rubik-speed-slider'
    speedSlider.title = 'Animation tempo'
    speedSlider.addEventListener('input', () => {
      const player = this.player
      if (!player) return
      player.tempoScale = Number(speedSlider.value)
    })
    speedLabel.appendChild(speedSlider)

    statusRow.append(this.moveCountEl, this.statusEl, speedLabel)

    const turnTip = document.createElement('p')
    turnTip.className = 'rubik-turn-tip'
    turnTip.textContent =
      'Turn layers by dragging the cube — whichever sticker you grab is the layer that moves, even after scrambling or spinning the view.'

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

    const runAlgBtn = this.makeToolButton('Run', 'Animate selected algorithm', () => {
      const key = this.algSelect.value
      if (!key) return
      const alg = CANONICAL_ALGORITHMS[key]
      if (!alg) return
      void this.runAlg(alg.moves)
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
    const applyBtn = this.makeToolButton('Apply', 'Animate custom notation', () => {
      void this.applyAlgInput()
    })

    algRow.append(this.algSelect, runAlgBtn, this.algInput, applyBtn)
    advanced.appendChild(algRow)

    const credit = document.createElement('p')
    credit.className = 'rubik-credit'
    credit.innerHTML =
      `3D cube by <a href="${CUBING_REPO}" target="_blank" rel="noopener noreferrer">cubing.js</a> (MPL-2.0)`
    advanced.appendChild(credit)

    const help = document.createElement('details')
    help.className = 'rubik-help'
    help.innerHTML = `
      <summary class="rubik-help-summary">Keyboard shortcuts</summary>
      <ul class="rubik-help-list">
        <li><kbd>Drag</kbd> a sticker — turns the layer you grabbed (follows the 3D view)</li>
        <li><kbd>Right-drag</kbd> — orbit · <kbd>Scroll</kbd> — zoom</li>
        <li><kbd>Space</kbd> — scramble</li>
        <li><kbd>U D L R F B</kbd> — fixed cuber notation (ignores camera); <kbd>Shift</kbd> = ↺</li>
      </ul>
    `

    controls.append(toolbar, statusRow, turnTip, advanced, help)
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

  private mountPlayer(): void {
    if (this.disposed || this.player) return

    try {
      const player = new TwistyPlayer({
        puzzle: '3x3x3',
        alg: '',
        background: 'none',
        colorScheme: 'dark',
        hintFacelets: 'none',
        controlPanel: 'none',
        backView: 'none',
        cameraLatitude: 35,
        cameraLongitude: -25,
        cameraDistance: 4.2,
        tempoScale: 1,
        experimentalDragInput: 'auto',
      })
      player.classList.add('rubik-twisty-player')
      this.host.appendChild(player)
      this.player = player
      this.startMovePolling()
      this.refreshButtonState()
      this.updateStatus()
    } catch {
      this.host.innerHTML =
        '<p class="rubik-gl-fallback">Could not start the cube viewer — try another browser or reload the tile.</p>'
    }
  }

  private startMovePolling(): void {
    const poll = (): void => {
      if (this.disposed) return
      void this.updateStatus()
      this.movePollTimer = window.setTimeout(poll, 450)
    }
    poll()
  }

  private async algString(): Promise<string> {
    const player = this.player
    if (!player) return ''
    try {
      const alg = await player.experimentalGet.alg()
      return alg?.toString() ?? ''
    } catch {
      return ''
    }
  }

  private countMoves(alg: string): number {
    return alg.trim().split(/\s+/).filter(Boolean).length
  }

  private async updateStatus(message?: string): Promise<void> {
    const alg = await this.algString()
    const moves = this.countMoves(alg)
    this.moveCountEl.textContent = `Moves: ${moves}`
    if (message !== undefined) {
      this.statusEl.textContent = message
    } else if (this.busy) {
      this.statusEl.textContent = 'Animating…'
    } else {
      this.statusEl.textContent = moves === 0 ? '✓ solved' : ''
    }
    this.refreshButtonState()
  }

  private refreshButtonState(): void {
    this.scrambleBtn.disabled = this.busy
    this.resetBtn.disabled = this.busy
    this.stopBtn.disabled = !this.busy
    void this.algString().then(alg => {
      this.solveBtn.disabled = this.busy || this.countMoves(alg) === 0
    })
  }

  private stopPlayback(): void {
    this.player?.pause()
    this.busy = false
    void this.updateStatus('Paused')
  }

  private resetCube(): void {
    const player = this.player
    if (!player || this.busy) return
    player.pause()
    player.alg = ''
    player.experimentalSetupAlg = ''
    player.experimentalSetupAnchor = 'start'
    player.jumpToStart()
    void this.updateStatus()
  }

  private markPlayback(durationMs: number, status: string, onDone?: () => void): void {
    this.busy = true
    void this.updateStatus(status)
    // The estimate assumes 1× tempo; the player actually animates at tempoScale
    // (0.4–2.4 from the speed slider), so scale the wait to match — otherwise a
    // slow tempo re-enables the buttons while the cube is still turning.
    const tempo = this.player?.tempoScale ?? 1
    const wait = tempo > 0 ? durationMs / tempo : durationMs
    window.setTimeout(() => {
      if (this.disposed) return
      this.busy = false
      onDone?.()
      void this.updateStatus()
    }, wait)
  }

  private async runScramble(): Promise<void> {
    const player = this.player
    if (!player || this.busy) return
    try {
      const scramble = await randomScrambleForEvent('333')
      const algStr = scramble.toString()
      player.pause()
      player.experimentalSetupAnchor = 'start'
      player.experimentalSetupAlg = ''
      player.alg = algStr
      player.jumpToStart()
      player.play()
      this.markPlayback(Math.max(1500, this.countMoves(algStr) * 380), 'Scrambling…')
    } catch {
      void this.updateStatus('Scramble failed — try again')
    }
  }

  private async runSolve(): Promise<void> {
    const player = this.player
    if (!player || this.busy) return
    const current = await this.algString()
    if (!current.trim()) return

    try {
      const inverse = invertSequence(current)
      player.pause()
      player.experimentalSetupAnchor = 'end'
      player.alg = inverse
      player.jumpToStart()
      player.play()
      // Restore the setup anchor only when playback actually ends — markPlayback
      // owns the (tempo-scaled) timing, so a slow solve no longer resets the
      // anchor mid-animation.
      this.markPlayback(Math.max(1200, this.countMoves(inverse) * 380), 'Solving…', () => {
        player.experimentalSetupAnchor = 'start'
      })
    } catch {
      void this.updateStatus('Could not solve from current state')
    }
  }

  private async runAlg(moves: string): Promise<void> {
    const player = this.player
    if (!player || this.busy) return
    player.pause()
    player.experimentalSetupAnchor = 'start'
    player.experimentalSetupAlg = ''
    player.alg = moves
    player.jumpToStart()
    player.play()
    this.markPlayback(Math.max(900, this.countMoves(moves) * 380), 'Running algorithm…')
  }

  private queueKeyboardTurn(face: CubeMoveFace, prime: boolean): void {
    const player = this.player
    if (!player || this.busy) return
    player.jumpToEnd()
    player.experimentalAddMove(prime ? `${face}'` : face)
    void this.updateStatus()
  }

  private async applyAlgInput(): Promise<void> {
    if (this.busy) return
    const raw = this.algInput.value.trim()
    if (!raw) return

    const normalized = normalizeNotationInput(raw)
    if (!normalized) {
      void this.updateStatus("Couldn't parse — use spaced WCA tokens like R U R' U2")
      window.setTimeout(() => void this.updateStatus(), 2400)
      return
    }

    this.algInput.value = ''
    await this.runAlg(normalized)
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.player) return

    if (e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      void this.runScramble()
      return
    }

    const faceMap: Record<string, CubeMoveFace> = {
      KeyU: 'U', KeyD: 'D', KeyL: 'L', KeyR: 'R', KeyF: 'F', KeyB: 'B',
    }
    const base = faceMap[e.code]
    if (!base) return
    e.preventDefault()
    e.stopPropagation()
    void this.queueKeyboardTurn(base, e.shiftKey)
  }

  /** Focus the window element (not the canvas) so WM chords route here. */
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
    if (this.disposed) return
    this.disposed = true
    window.clearTimeout(this.movePollTimer)
    this.player?.pause()
    this.player?.remove()
    this.player = null
  }
}
