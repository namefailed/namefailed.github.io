/**
 * Pure key-chord helpers for modal editor vim modes (no DOM).
 */

/** INSERT mode: Esc or Ctrl+[ returns to NORMAL. */
export function insertModeKeyAction(
  key: string,
  opts: { ctrlKey: boolean; metaKey: boolean },
): 'leave-normal' | 'pass' {
  if (key === 'Escape' || (opts.ctrlKey && key === '[')) return 'leave-normal'
  return 'pass'
}

/** NORMAL mode count prefix — returns updated digits or null if not a count key. */
export function tryAppendCountDigit(digits: string, key: string): string | null {
  if (/^[1-9]$/.test(key) || (key === '0' && digits !== '')) {
    let next = digits + key
    if (next.length > 6) next = next.slice(0, 6)
    return next
  }
  return null
}
