/**
 * Shape of one shell keyword — `terminal.ts` walks this map after parsing argv.
 * `loadMs` is a fake delay hint used when printing “opening …” theatre.
 * I keep the name `Command` because `terminal.ts` maps argv[0] onto these keys — reads fine in tracebacks.
 */

export interface Command {
  description: string
  hidden?: boolean
  loadMs?: number
  run: (args: string[]) => string[]
}
