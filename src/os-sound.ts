/** Short UI sounds via Web Audio; mute state persisted under `mrgrey-os-sound` / volume under `mrgrey-os-volume`. */

const STORAGE_KEY = 'mrgrey-os-sound'
const VOLUME_KEY = 'mrgrey-os-volume'

let enabled = true
/** Linear gain multiplier 0–1 (applied when sounds are on). */
let volume = 0.72
let audioCtx: AudioContext | null = null

export function initOsSound(): void {
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    enabled = true
  }
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw != null) {
      const v = parseFloat(raw)
      if (Number.isFinite(v)) volume = Math.min(1, Math.max(0, v))
    }
  } catch {
    /* ignore */
  }
}

export function getSoundVolume(): number {
  return volume
}

export function setSoundVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v))
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    /* ignore */
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function toggleSound(): boolean {
  setSoundEnabled(!enabled)
  return enabled
}

function ctx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

/** Resume AudioContext after user gesture if suspended */
export async function resumeAudioIfNeeded(): Promise<void> {
  const c = ctx()
  if (c?.state === 'suspended') await c.resume().catch(() => {})
}

export type OsSoundKind = 'focus' | 'click' | 'notify' | 'boot'

export function playOsSound(kind: OsSoundKind): void {
  if (!enabled) return
  const c = ctx()
  if (!c) return

  const now = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)

  let freq = 880
  let dur = 0.04
  let vol = 0.06

  switch (kind) {
    case 'focus':
      freq = 740
      dur = 0.035
      vol = 0.05
      break
    case 'click':
      freq = 520
      dur = 0.028
      vol = 0.04
      break
    case 'notify':
      freq = 660
      dur = 0.06
      vol = 0.07
      break
    case 'boot':
      freq = 330
      dur = 0.08
      vol = 0.05
      break
    default:
      break
  }

  vol *= volume

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.start(now)
  osc.stop(now + dur + 0.02)
}
