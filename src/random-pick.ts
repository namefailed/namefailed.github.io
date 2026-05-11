/** Uniform choice from a fixed list (CLI flavor text, fortunes, spinner copy). */

export function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}
