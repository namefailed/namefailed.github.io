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
import { applyTheme, getThemeId, getActivePack, listThemeSummaries } from './theme'

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

function refreshMeta(el: HTMLElement | null): void {
  if (!el) return
  el.textContent = getActivePack().label
}

/** Strip vendor prefix so chips stay short (e.g. "Catppuccin Mocha" → "Mocha"). */
function themeChipCaption(fullLabel: string): string {
  return fullLabel.replace(/^Catppuccin\s+/i, '').trim()
}

function syncThemeChips(container?: HTMLElement | null): void {
  const el = container ?? document.getElementById('yasb-theme-chips')
  if (!el) return
  const cur = getThemeId()
  for (const btn of el.querySelectorAll<HTMLButtonElement>('.yasb-theme-chip')) {
    const id = btn.dataset.themeId
    const active = id === cur
    btn.classList.toggle('yasb-theme-chip--active', active)
    btn.setAttribute('aria-checked', active ? 'true' : 'false')
    btn.tabIndex = active ? 0 : -1
  }
}

function buildThemeChips(container: HTMLElement): void {
  container.replaceChildren()
  for (const { id, label } of listThemeSummaries()) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'yasb-theme-chip'
    btn.dataset.themeId = id
    btn.setAttribute('role', 'radio')
    btn.setAttribute('aria-checked', 'false')
    btn.title = `${label} (${id})`
    btn.textContent = themeChipCaption(label)
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (id === getThemeId()) return
      if (applyTheme(id)) {
        playOsSound('click')
        syncThemeChips(container)
        refreshMeta(document.getElementById('yasb-settings-meta'))
      }
    })
    container.appendChild(btn)
  }
  syncThemeChips(container)
}

/** I call this after `sound` in the terminal so menu toggles stay in sync. */
export function syncSettingsSoundToggle(): void {
  const sw = document.getElementById('settings-sound-toggle')
  if (sw) syncSoundSwitch(sw)
  syncVolumeSlider(document.getElementById('settings-volume-slider') as HTMLInputElement | null)
  syncRetroSwitch(document.getElementById('settings-retro-toggle'))
  syncMatrixSwitch(document.getElementById('settings-matrix-toggle'))
  syncThemeChips()
  refreshMeta(document.getElementById('yasb-settings-meta'))
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
    window.setTimeout(() => el.remove(), 280)
  }, durationMs)
}

export function initSystray(): void {
  const clockBtn = document.getElementById('btn-yasb-clock') as HTMLButtonElement | null
  const panel = document.getElementById('yasb-settings') as HTMLElement | null
  const themeChipsRoot = document.getElementById('yasb-theme-chips') as HTMLElement | null
  const soundToggle = document.getElementById('settings-sound-toggle') as HTMLButtonElement | null
  const retroToggle = document.getElementById('settings-retro-toggle') as HTMLButtonElement | null
  const matrixToggle = document.getElementById('settings-matrix-toggle') as HTMLButtonElement | null

  if (!clockBtn || !panel) return

  if (themeChipsRoot) buildThemeChips(themeChipsRoot)

  let panelOpen = false

  const onThemeChipKeydown = (ev: KeyboardEvent): void => {
    if (!themeChipsRoot || ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return
    ev.preventDefault()
    const chips = [...themeChipsRoot.querySelectorAll<HTMLButtonElement>('.yasb-theme-chip')]
    if (chips.length === 0) return
    const i = chips.findIndex(c => c === document.activeElement)
    const from = i >= 0 ? i : chips.findIndex(c => c.dataset.themeId === getThemeId())
    const dir = ev.key === 'ArrowRight' ? 1 : -1
    const next = (from + dir + chips.length) % chips.length
    chips[next]?.focus()
  }

  themeChipsRoot?.addEventListener('keydown', onThemeChipKeydown)

  const setPanelOpen = (next: boolean): void => {
    panelOpen = next
    panel.hidden = !next
    clockBtn.setAttribute('aria-expanded', next ? 'true' : 'false')
    if (next) {
      syncRetroSwitch(retroToggle)
      syncMatrixSwitch(matrixToggle)
      syncThemeChips(themeChipsRoot)
      refreshMeta(document.getElementById('yasb-settings-meta'))
    }
  }

  window.addEventListener('mrgrey-theme-change', () => {
    syncThemeChips(themeChipsRoot)
    refreshMeta(document.getElementById('yasb-settings-meta'))
  })

  clockBtn.addEventListener('click', e => {
    e.stopPropagation()
    setPanelOpen(!panelOpen)
  })

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
