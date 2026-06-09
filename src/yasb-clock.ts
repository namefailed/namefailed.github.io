/** YASB status-bar clock — minute resolution is enough for HH:MM display. */

export function initYasbClock(elementId = 'yasb-clock-text'): void {
  const el = document.getElementById(elementId)
  if (!el) return

  const tick = (): void => {
    el.textContent = new Date().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  tick()
  window.setInterval(tick, 60_000)
}
