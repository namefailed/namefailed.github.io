/** Viewport-aware placement for desktop folder popups (Portfolio / Apps / Games). */

export interface BoxRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PopupSize {
  width: number
  height: number
}

export type FolderPopupPlacement = 'above' | 'below'

export interface FolderPopupPosition {
  left: number
  top: number
  placement: FolderPopupPlacement
}

export const FOLDER_POPUP_MARGIN_PX = 8
export const FOLDER_POPUP_GAP_PX = 10

/**
 * Pick above vs below from the space around the anchor (which already accounts
 * for the popup's own height), then clamp to the viewport. Shared by all three
 * folder tiles.
 */
export function computeFolderPopupPosition(
  anchor: BoxRect,
  popup: PopupSize,
  viewport: { width: number; height: number },
  margin = FOLDER_POPUP_MARGIN_PX,
  gap = FOLDER_POPUP_GAP_PX,
): FolderPopupPosition {
  const pw = Math.max(1, popup.width)
  const ph = Math.max(1, popup.height)

  let left = anchor.left + anchor.width / 2 - pw / 2
  left = Math.max(margin, Math.min(left, viewport.width - pw - margin))

  const spaceAbove = anchor.top - margin
  const spaceBelow = viewport.height - anchor.bottom - margin
  const need = ph + gap

  const fitsAbove = spaceAbove >= need
  const fitsBelow = spaceBelow >= need

  let placement: FolderPopupPlacement
  if (fitsAbove && fitsBelow) {
    placement = spaceAbove >= spaceBelow ? 'above' : 'below'
  } else if (fitsAbove) {
    placement = 'above'
  } else if (fitsBelow) {
    placement = 'below'
  } else {
    placement = spaceAbove >= spaceBelow ? 'above' : 'below'
  }

  let top =
    placement === 'above'
      ? anchor.top - ph - gap
      : anchor.bottom + gap

  top = Math.max(margin, Math.min(top, viewport.height - ph - margin))

  return { left, top, placement }
}
