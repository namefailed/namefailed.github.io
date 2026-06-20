// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initOsSound,
  getSoundVolume,
  setSoundVolume,
  isSoundEnabled,
  setSoundEnabled,
  toggleSound,
  resumeAudioIfNeeded,
  playOsSound,
  type OsSoundKind,
} from './os-sound'

const STORAGE_KEY = 'mrgrey-os-sound'
const VOLUME_KEY = 'mrgrey-os-volume'

// --- AudioContext stub ----------------------------------------------------
// Records every oscillator/gain created plus the parameter calls so tests can
// assert the exact frequencies, gains, and timings the module schedules.

interface ParamCall {
  type: 'setValueAtTime' | 'exponentialRampToValueAtTime'
  value: number
  time: number
}

class FakeAudioParam {
  calls: ParamCall[] = []
  setValueAtTime(value: number, time: number) {
    this.calls.push({ type: 'setValueAtTime', value, time })
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push({ type: 'exponentialRampToValueAtTime', value, time })
    return this
  }
}

class FakeOscillator {
  type = ''
  frequency = new FakeAudioParam()
  connectedTo: unknown = null
  started: number | null = null
  stopped: number | null = null
  connect(dest: unknown) {
    this.connectedTo = dest
  }
  start(t: number) {
    this.started = t
  }
  stop(t: number) {
    this.stopped = t
  }
}

class FakeGain {
  gain = new FakeAudioParam()
  connectedTo: unknown = null
  connect(dest: unknown) {
    this.connectedTo = dest
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: 'running' | 'suspended' | 'closed' = 'running'
  currentTime = 5
  destination = { kind: 'destination' }
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  createOscillator() {
    const o = new FakeOscillator()
    this.oscillators.push(o)
    return o
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
}

const origAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext

function installAudio(): typeof FakeAudioContext {
  FakeAudioContext.instances = []
  ;(globalThis as { AudioContext?: unknown }).AudioContext =
    FakeAudioContext as unknown
  return FakeAudioContext
}

function last(): FakeAudioContext {
  return FakeAudioContext.instances[FakeAudioContext.instances.length - 1]
}

beforeEach(() => {
  localStorage.clear()
  installAudio()
  // Reset module state to a known baseline via the public API + storage.
  initOsSound()
})

afterEach(() => {
  localStorage.clear()
  // The module caches its AudioContext in a module-level variable that survives
  // between tests. Mark every context we created as 'closed' so the module's
  // next ctx() call rebuilds a fresh instance instead of reusing a stale one.
  for (const c of FakeAudioContext.instances) c.state = 'closed'
  if (origAudioContext === undefined) {
    delete (globalThis as { AudioContext?: unknown }).AudioContext
  } else {
    ;(globalThis as { AudioContext?: unknown }).AudioContext = origAudioContext
  }
})

describe('initOsSound', () => {
  it('defaults to enabled with volume 0.72 when storage is empty', () => {
    localStorage.clear()
    initOsSound()
    expect(isSoundEnabled()).toBe(true)
    expect(getSoundVolume()).toBeCloseTo(0.72)
  })

  it('reads persisted disabled state and volume', () => {
    localStorage.setItem(STORAGE_KEY, '0')
    localStorage.setItem(VOLUME_KEY, '0.3')
    initOsSound()
    expect(isSoundEnabled()).toBe(false)
    expect(getSoundVolume()).toBeCloseTo(0.3)
  })

  it('clamps an out-of-range persisted volume into 0..1', () => {
    localStorage.setItem(VOLUME_KEY, '5')
    initOsSound()
    expect(getSoundVolume()).toBe(1)

    localStorage.setItem(VOLUME_KEY, '-2')
    initOsSound()
    expect(getSoundVolume()).toBe(0)
  })

  it('falls back to default volume on a non-numeric persisted value', () => {
    localStorage.setItem(VOLUME_KEY, 'not-a-number')
    initOsSound()
    expect(getSoundVolume()).toBeCloseTo(0.72)
  })
})

describe('setSoundVolume', () => {
  it('clamps the value to 0..1 and persists it as a string', () => {
    setSoundVolume(0.5)
    expect(getSoundVolume()).toBe(0.5)
    expect(localStorage.getItem(VOLUME_KEY)).toBe('0.5')

    setSoundVolume(2)
    expect(getSoundVolume()).toBe(1)
    expect(localStorage.getItem(VOLUME_KEY)).toBe('1')

    setSoundVolume(-1)
    expect(getSoundVolume()).toBe(0)
    expect(localStorage.getItem(VOLUME_KEY)).toBe('0')
  })
})

describe('enabled state', () => {
  it('setSoundEnabled persists 1/0 and isSoundEnabled reflects it', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0')

    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('toggleSound flips state, returns the new value, and persists it', () => {
    setSoundEnabled(true)
    expect(toggleSound()).toBe(false)
    expect(isSoundEnabled()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0')

    expect(toggleSound()).toBe(true)
    expect(isSoundEnabled()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })
})

describe('resumeAudioIfNeeded', () => {
  it('resumes the context when it is suspended', async () => {
    // Trigger context creation, then put it into a suspended state.
    playOsSound('click')
    const c = last()
    c.state = 'suspended'
    await resumeAudioIfNeeded()
    expect(c.resume).toHaveBeenCalledTimes(1)
    expect(c.state).toBe('running')
  })

  it('does not resume a running context', async () => {
    playOsSound('click')
    const c = last()
    c.state = 'running'
    await resumeAudioIfNeeded()
    expect(c.resume).not.toHaveBeenCalled()
  })

  it('swallows a rejected resume() without throwing', async () => {
    playOsSound('click')
    const c = last()
    c.state = 'suspended'
    c.resume = vi.fn(async () => {
      throw new Error('nope')
    })
    await expect(resumeAudioIfNeeded()).resolves.toBeUndefined()
  })

  it('is a no-op when AudioContext is unavailable', async () => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext
    await expect(resumeAudioIfNeeded()).resolves.toBeUndefined()
    expect(FakeAudioContext.instances).toHaveLength(0)
  })
})

describe('playOsSound', () => {
  it('does nothing when sound is disabled', () => {
    setSoundEnabled(false)
    playOsSound('click')
    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it('does nothing when AudioContext is unavailable', () => {
    setSoundEnabled(true)
    delete (globalThis as { AudioContext?: unknown }).AudioContext
    expect(() => playOsSound('click')).not.toThrow()
    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it('wires oscillator -> gain -> destination and uses a sine wave', () => {
    setSoundEnabled(true)
    setSoundVolume(1)
    playOsSound('notify')
    const c = last()
    const osc = c.oscillators[0]
    const gain = c.gains[0]
    expect(osc.type).toBe('sine')
    expect(osc.connectedTo).toBe(gain)
    expect(gain.connectedTo).toBe(c.destination)
  })

  const cases: Array<{ kind: OsSoundKind; freq: number; dur: number; vol: number }> = [
    { kind: 'focus', freq: 740, dur: 0.035, vol: 0.05 },
    { kind: 'click', freq: 520, dur: 0.028, vol: 0.04 },
    { kind: 'notify', freq: 660, dur: 0.06, vol: 0.07 },
    { kind: 'boot', freq: 330, dur: 0.08, vol: 0.05 },
  ]

  for (const { kind, freq, dur, vol } of cases) {
    it(`schedules the right frequency/timing for "${kind}"`, () => {
      setSoundEnabled(true)
      setSoundVolume(1) // so vol *= volume keeps the base value
      playOsSound(kind)
      const c = last()
      const now = c.currentTime
      const osc = c.oscillators[0]
      const gain = c.gains[0]

      // Frequency set once, at `now`.
      expect(osc.frequency.calls).toEqual([
        { type: 'setValueAtTime', value: freq, time: now },
      ])

      // Gain envelope: start near-zero, ramp up at +0.008, ramp down at +dur.
      expect(gain.gain.calls).toEqual([
        { type: 'setValueAtTime', value: 0.0001, time: now },
        { type: 'exponentialRampToValueAtTime', value: vol, time: now + 0.008 },
        { type: 'exponentialRampToValueAtTime', value: 0.0001, time: now + dur },
      ])

      // Oscillator scheduled to start now and stop after the tail.
      expect(osc.started).toBe(now)
      expect(osc.stopped).toBeCloseTo(now + dur + 0.02)
    })
  }

  it('scales the peak gain by the current volume', () => {
    setSoundEnabled(true)
    setSoundVolume(0.5)
    playOsSound('notify') // base vol 0.07
    const gain = last().gains[0]
    const ramp = gain.gain.calls.find(
      (c) => c.type === 'exponentialRampToValueAtTime' && c.value !== 0.0001,
    )
    expect(ramp?.value).toBeCloseTo(0.07 * 0.5)
  })

  it('schedules no envelope and never starts the oscillator when volume is 0', () => {
    setSoundEnabled(true)
    setSoundVolume(0)
    playOsSound('click')
    const c = last()
    const osc = c.oscillators[0]
    const gain = c.gains[0]
    // Nodes are constructed before the vol<=0 guard, so they exist & connect,
    // but the guard returns before any envelope / start / stop is scheduled.
    expect(osc.frequency.calls).toEqual([])
    expect(gain.gain.calls).toEqual([])
    expect(osc.started).toBeNull()
    expect(osc.stopped).toBeNull()
    expect(osc.type).toBe('') // never set to 'sine'
  })

  it('reuses one AudioContext across multiple sounds', () => {
    setSoundEnabled(true)
    setSoundVolume(1)
    playOsSound('click')
    playOsSound('focus')
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(last().oscillators).toHaveLength(2)
  })

  it('recreates the AudioContext after it has been closed', () => {
    setSoundEnabled(true)
    setSoundVolume(1)
    playOsSound('click')
    expect(FakeAudioContext.instances).toHaveLength(1)
    last().state = 'closed'
    playOsSound('click')
    expect(FakeAudioContext.instances).toHaveLength(2)
  })
})
