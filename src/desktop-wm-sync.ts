/**
 * Shell dataset mirrors for CSS hooks on #desktop-root.
 */

export function syncShellDataset(
  desktop: HTMLElement,
  windowCount: number,
  maximized: boolean,
): void {
  desktop.dataset.contentCount = String(windowCount)
  desktop.dataset.terminalClosed = '1'
  desktop.dataset.maximized = maximized ? '1' : '0'
}
