/** Optional apt install cowsay — persists for apt list; cowsay CLI does not depend on this. */

import { storageGetJson, storageSetJson } from './storage'

const STORAGE_KEY = 'mrgrey-pkgs-v1'

const KNOWN = new Set(['cowsay'])

let installed = new Set<string>()

function load(): void {
  const arr = storageGetJson<unknown>(STORAGE_KEY, null)
  if (!Array.isArray(arr)) {
    installed = new Set()
    return
  }
  installed = new Set(arr.filter((x): x is string => typeof x === 'string'))
}

function save(): void {
  storageSetJson(STORAGE_KEY, [...installed])
}

load()

export type AptInstallOutcome = 'new' | 'already' | 'unknown'

export function listInstalledPackages(): string[] {
  return [...installed].sort()
}

/** Only `cowsay` is recognized; anything else returns `unknown` for the caller to reject with flair. */
export function attemptAptInstall(rawName: string): AptInstallOutcome {
  const name = rawName.trim().toLowerCase()

  if (!KNOWN.has(name)) return 'unknown'

  if (installed.has(name)) return 'already'

  installed.add(name)

  save()

  return 'new'
}

export function aptRemove(name: string): string | null {
  const n = name.trim().toLowerCase()

  if (!installed.has(n)) return `Package '${n}' is not installed.`

  installed.delete(n)

  save()

  return null
}

/** Classic cowsay bubble */

export function cowsayFormat(message: string): string[] {
  const text = message.trim() || 'moo'

  const len = Math.min(Math.max(text.length, 3), 40)

  const border = '_'.repeat(len + 2)

  return [
    ` ${border}`,

    `< ${text.padEnd(len, ' ')} >`,

    ` ${'-'.repeat(len + 2)}`,

    '        \\   ^__^',

    '         \\  (oo)\\_______',

    '            (__)\\       )\\/\\',

    '                ||----w |',

    '                ||     ||',
  ]
}
