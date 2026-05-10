/** My status cluster: toasts, clock opening the system menu (sound, volume, effects). */
import {
  getSoundVolume,
  isSoundEnabled,
  setSoundVolume,
  toggleSound,
  resumeAudioIfNeeded,
  playOsSound,
} from './os-sound'
import { getRetroFx, setRetroFx } from './retro-fx'
import { getMatrixBgHandle } from './matrix-bg'
import { applyTheme, getThemeId, listThemeSummaries } from './theme'

function syncSettingsSwitch(btn: HTMLElement, on: boolean): void {
  btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  btn.classList.toggle('yasb-settings-switch--off', !on)
}

function syncSoundSwitch(btn: HTMLElement): void {
  const on = isSoundEnabled()
  syncSettingsSwitch(btn, on)
  btn.title = on ? 'Mute UI sounds' : 'Unmute UI sounds'
}

function syncRetroSwitch(btn: HTMLElement | null): void {
  if (!btn) return
  const on = getRetroFx()
  syncSettingsSwitch(btn, on)
  btn.title = on ? 'CRT effects on — click to disable' : 'CRT effects off — click to enable'
}

function syncMatrixSwitch(btn: HTMLElement | null): void {
  if (!btn) return
  const api = getMatrixBgHandle()
  const on = api?.isEnabled() ?? false
  syncSettingsSwitch(btn, on)
  ;(btn as HTMLButtonElement).disabled = !api
  btn.title = api
    ? on
      ? 'Matrix rain on'
      : 'Matrix rain off'
    : 'Matrix backdrop unavailable'
}

function syncVolumeSlider(panelSlider: HTMLInputElement | null): void {
  const pct = Math.round(getSoundVolume() * 100)
  if (panelSlider && document.activeElement !== panelSlider)
    panelSlider.value = String(pct)
}

function buildThemeSelect(select: HTMLSelectElement): void {
  select.replaceChildren()
  for (const { id, label } of listThemeSummaries()) {
    const opt = document.createElement('option')
    opt.value = id
    opt.textContent = label
    select.appendChild(opt)
  }
  syncThemeSelect(select)
}

function syncThemeSelect(select?: HTMLSelectElement | null): void {
  const el = select ?? (document.getElementById('settings-theme-select') as HTMLSelectElement | null)
  if (!el) return
  const cur = getThemeId()
  if ([...el.options].some(o => o.value === cur)) el.value = cur
}

/** I call this after `sound` in the terminal so menu toggles stay in sync. */
export function syncSettingsSoundToggle(): void {
  const sw = document.getElementById('settings-sound-toggle')
  if (sw) syncSoundSwitch(sw)
  syncVolumeSlider(document.getElementById('settings-volume-slider') as HTMLInputElement | null)
  syncRetroSwitch(document.getElementById('settings-retro-toggle'))
  syncMatrixSwitch(document.getElementById('settings-matrix-toggle'))
  syncThemeSelect()
}

export function pushToast(
  message: string,
  durationMs = 4200,
  extraClass?: string,
): void {
  const stack = document.getElementById('toast-stack')
  if (!stack) return
  const el = document.createElement('div')
  el.className = extraClass ? `toast ${extraClass}` : 'toast'
  el.setAttribute('role', 'status')
  el.textContent = message
  stack.appendChild(el)
  playOsSound('notify')
  window.setTimeout(() => {
    el.classList.add('toast-out')
    window.setTimeout(() => el.remove(), 360)
  }, durationMs)
}

export function initSystray(): void {
  const clockBtn = document.getElementById('btn-yasb-clock') as HTMLButtonElement | null
  const panel = document.getElementById('yasb-settings') as HTMLElement | null
  const themeSelect = document.getElementById('settings-theme-select') as HTMLSelectElement | null
  const soundToggle = document.getElementById('settings-sound-toggle') as HTMLButtonElement | null
  const retroToggle = document.getElementById('settings-retro-toggle') as HTMLButtonElement | null
  const matrixToggle = document.getElementById('settings-matrix-toggle') as HTMLButtonElement | null

  if (!clockBtn || !panel) return

  if (themeSelect) buildThemeSelect(themeSelect)

  let panelOpen = false

  const setPanelOpen = (next: boolean): void => {
    panelOpen = next
    panel.classList.toggle('yasb-settings-panel--open', next)
    panel.setAttribute('aria-hidden', next ? 'false' : 'true')
    clockBtn.setAttribute('aria-expanded', next ? 'true' : 'false')
    if (next) {
      syncRetroSwitch(retroToggle)
      syncMatrixSwitch(matrixToggle)
      syncThemeSelect(themeSelect)
    }
  }

  window.addEventListener('mrgrey-theme-change', () => {
    syncThemeSelect(themeSelect)
  })

  clockBtn.addEventListener('click', e => {
    e.stopPropagation()
    setPanelOpen(!panelOpen)
  })

  themeSelect?.addEventListener('change', e => {
    e.stopPropagation()
    const id = themeSelect.value
    if (!id || id === getThemeId()) return
    if (!applyTheme(id)) {
      syncThemeSelect(themeSelect)
      return
    }
    playOsSound('click')
  })

  themeSelect?.addEventListener('click', e => e.stopPropagation())

  const applySoundToggle = async (): Promise<void> => {
    await resumeAudioIfNeeded()
    toggleSound()
    syncSettingsSoundToggle()
    playOsSound('click')
  }

  soundToggle?.addEventListener('click', async e => {
    e.stopPropagation()
    await applySoundToggle()
  })

  retroToggle?.addEventListener('click', e => {
    e.stopPropagation()
    setRetroFx(!getRetroFx())
    syncRetroSwitch(retroToggle)
    playOsSound('click')
  })

  matrixToggle?.addEventListener('click', e => {
    e.stopPropagation()
    const api = getMatrixBgHandle()
    if (!api) return
    api.setEnabled(!api.isEnabled())
    syncMatrixSwitch(matrixToggle)
    playOsSound('click')
  })

  const panelSlider = document.getElementById('settings-volume-slider') as HTMLInputElement | null
  if (panelSlider) {
    panelSlider.addEventListener('input', () => {
      const v = parseInt(panelSlider.value, 10)
      if (Number.isFinite(v)) setSoundVolume(v / 100)
      syncVolumeSlider(panelSlider)
      void resumeAudioIfNeeded()
    })
  }

  document.addEventListener('click', () => {
    if (panelOpen) setPanelOpen(false)
  })

  panel.addEventListener('click', e => e.stopPropagation())

  document.addEventListener(
    'keydown',
    ev => {
      if (ev.key !== 'Escape' || !panelOpen) return
      setPanelOpen(false)
    },
    true,
  )

  syncSettingsSoundToggle()
}
