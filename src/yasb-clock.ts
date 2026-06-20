/** YASB status-bar clock — HH:MM display, ticking on the minute boundary. */

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
  // Align to the next minute first; a bare 60s interval started mid-minute
  // would leave HH:MM stale for up to ~59s after each rollover.
  window.setTimeout(() => {
    tick()
    window.setInterval(tick, 60_000)
  }, 60_000 - (Date.now() % 60_000))
}
