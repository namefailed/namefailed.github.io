/**
 * Shell dataset mirrors for CSS hooks on #desktop-root.
 */

export function syncShellDataset(
  desktop: HTMLElement,
  termWin: HTMLElement,
  windowCount: number,
  maximized: boolean,
): void {
  desktop.dataset.contentCount = String(windowCount)
  desktop.dataset.terminalClosed = termWin.classList.contains('terminal-closed') ? '1' : '0'
  desktop.dataset.maximized = maximized ? '1' : '0'
}
