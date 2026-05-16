/** Uniform choice from a fixed non-empty list (CLI flavor text, fortunes, spinner copy). */

export function randomPick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError('randomPick: items must be non-empty')
  }
  return items[Math.floor(Math.random() * items.length)]!
}
