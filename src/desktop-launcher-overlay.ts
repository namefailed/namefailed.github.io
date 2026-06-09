/**
 * Launcher overlay state (Ctrl+D show-desktop + Applications button) and DOM sync.
 */

export interface LauncherOverlayFlags {
  showingDesktop: boolean
  launcherOpen: boolean
}

export function launcherOverlayVisible(flags: LauncherOverlayFlags): boolean {
  return flags.showingDesktop || flags.launcherOpen
}

export function closeLauncherOverlayFlags(flags: LauncherOverlayFlags): boolean {
  if (!launcherOverlayVisible(flags)) return false
  flags.showingDesktop = false
  flags.launcherOpen = false
  return true
}

export function toggleShowDesktopFlags(flags: LauncherOverlayFlags): void {
  flags.showingDesktop = !flags.showingDesktop
  if (!flags.showingDesktop) flags.launcherOpen = false
}

/** Open Applications overlay; returns false when caller should close instead. */
export function openLauncherFromButtonFlags(flags: LauncherOverlayFlags): boolean {
  if (launcherOverlayVisible(flags)) return false
  flags.launcherOpen = true
  return true
}

/** Mirror overlay visibility to shell chrome + ARIA. */
export function syncLauncherOverlayDom(
  show: boolean,
  desktopEl: HTMLElement,
  doc: Document = document,
): void {
  desktopEl.classList.toggle('launchers-visible', show)

  const shell = doc.getElementById('launcher-shell')
  if (shell && !show) {
    const ae = doc.activeElement
    if (ae instanceof HTMLElement && shell.contains(ae)) ae.blur()
  }

  if (shell) shell.setAttribute('aria-hidden', show ? 'false' : 'true')

  doc.getElementById('btn-applications')?.setAttribute('aria-expanded', show ? 'true' : 'false')

  if (!show) {
    const input = doc.getElementById('launcher-search') as HTMLInputElement | null
    if (input?.value) {
      input.value = ''
      doc.querySelectorAll('#desktop-icons .desktop-icon').forEach(btn => {
        ;(btn as HTMLElement).style.display = ''
      })
    }
  }
}

export function initLauncherSearchFilter(
  onInput?: (query: string) => void,
  doc: Document = document,
): void {
  const input = doc.getElementById('launcher-search') as HTMLInputElement | null
  if (!input) return
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase()
    if (onInput) {
      onInput(q)
      return
    }
    doc.querySelectorAll('#desktop-icons .desktop-icon').forEach(btn => {
      const label =
        btn.querySelector('.desktop-icon-label')?.textContent?.toLowerCase() ?? ''
      ;(btn as HTMLElement).style.display = !q || label.includes(q) ? '' : 'none'
    })
  })
}
