// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getRetroFx,
  setRetroFx,
  toggleRetroFx,
  initRetroFxFromStorage,
} from './retro-fx'

const CLASS = 'retro-fx'
const STORAGE_KEY = 'mrgrey-retro-fx'

describe('retro-fx', () => {
  beforeEach(() => {
    document.documentElement.classList.remove(CLASS)
    localStorage.clear()
  })

  afterEach(() => {
    document.documentElement.classList.remove(CLASS)
    localStorage.clear()
  })

  describe('getRetroFx', () => {
    it('returns false when the class is absent', () => {
      expect(getRetroFx()).toBe(false)
    })

    it('returns true when the class is present on <html>', () => {
      document.documentElement.classList.add(CLASS)
      expect(getRetroFx()).toBe(true)
    })
  })

  describe('setRetroFx', () => {
    it('adds the class and persists "1" when enabled', () => {
      setRetroFx(true)
      expect(document.documentElement.classList.contains(CLASS)).toBe(true)
      expect(getRetroFx()).toBe(true)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    })

    it('removes the class and persists "0" when disabled', () => {
      document.documentElement.classList.add(CLASS)
      setRetroFx(false)
      expect(document.documentElement.classList.contains(CLASS)).toBe(false)
      expect(getRetroFx()).toBe(false)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
    })

    it('is idempotent when enabling twice', () => {
      setRetroFx(true)
      setRetroFx(true)
      expect(document.documentElement.classList.contains(CLASS)).toBe(true)
      // toggle(class, true) never duplicates the token
      expect(
        document.documentElement.className.split(/\s+/).filter((c) => c === CLASS).length,
      ).toBe(1)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    })
  })

  describe('toggleRetroFx', () => {
    it('turns on from the default off state and returns true', () => {
      const result = toggleRetroFx()
      expect(result).toBe(true)
      expect(getRetroFx()).toBe(true)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    })

    it('turns off when currently on and returns false', () => {
      setRetroFx(true)
      const result = toggleRetroFx()
      expect(result).toBe(false)
      expect(getRetroFx()).toBe(false)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
    })

    it('round-trips back to the original state across two toggles', () => {
      expect(getRetroFx()).toBe(false)
      toggleRetroFx()
      toggleRetroFx()
      expect(getRetroFx()).toBe(false)
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
    })
  })

  describe('initRetroFxFromStorage', () => {
    it('defaults to off when nothing is stored', () => {
      initRetroFxFromStorage()
      expect(getRetroFx()).toBe(false)
      // setRetroFx writes the resolved default back out
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0')
    })

    it('restores the on state when "1" is stored', () => {
      localStorage.setItem(STORAGE_KEY, '1')
      initRetroFxFromStorage()
      expect(getRetroFx()).toBe(true)
    })

    it('restores the off state when "0" is stored', () => {
      document.documentElement.classList.add(CLASS)
      localStorage.setItem(STORAGE_KEY, '0')
      initRetroFxFromStorage()
      expect(getRetroFx()).toBe(false)
    })

    it('treats any non-"0"/"false" stored value as on', () => {
      localStorage.setItem(STORAGE_KEY, 'whatever')
      initRetroFxFromStorage()
      expect(getRetroFx()).toBe(true)
    })

    it('treats the literal "false" string as off', () => {
      localStorage.setItem(STORAGE_KEY, 'false')
      initRetroFxFromStorage()
      expect(getRetroFx()).toBe(false)
    })
  })
})
