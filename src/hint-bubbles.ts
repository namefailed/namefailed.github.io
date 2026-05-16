/**
 * Speech-bubble hints anchored to portfolio tiles on first visit.
 * Persistent until clicked or until "Show hints again" is invoked.
 */

export interface Hint {
  targetCmd: string
  text: string
}

export const HINTS: Hint[] = [
  { targetCmd: 'resume',   text: '← start here · full resume' },
  { targetCmd: 'projects', text: "← things I've built" },
  { targetCmd: 'whoami',   text: '← whoami, in detail' },
  { targetCmd: 'links',    text: '← reach out' },
]

const KEY_PREFIX = 'mrgrey-hint-'

export function hintKey(targetCmd: string): string {
  return `${KEY_PREFIX}${targetCmd}`
}

export function isHintDismissed(targetCmd: string): boolean {
  return window.localStorage.getItem(hintKey(targetCmd)) === '1'
}

export function dismissHint(targetCmd: string): void {
  window.localStorage.setItem(hintKey(targetCmd), '1')
}

export function resetAllHints(): void {
  for (const hint of HINTS) {
    window.localStorage.removeItem(hintKey(hint.targetCmd))
  }
}
