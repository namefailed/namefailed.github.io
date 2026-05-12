/** Short terminal banner lines after Desktop opens a window from the shell. */
import { randomPick } from './random-pick'
import { c } from './theme'

/** Lines printed in the terminal right after Desktop accepts a window spawn. */
export function windowSpawnEcho(cmd: string, args: readonly string[]): string[] {
  const uri = (): string =>
    args.length ? (args.join(' ').length > 56 ? args.join(' ').slice(0, 54) + '…' : args.join(' ')) : ''

  switch (cmd) {
    case 'resume':
    case 'skills':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}raising résumé tile (${c.blue}portfolio + skill matrix${c.dim}) …${c.reset}`,
        `  ${c.dim}${randomPick(['paper PDF still validates in elevators', 'skills rail tucks beside the story on wide layouts', 'HIRING=yes in this universe'])}.${c.reset}`,
        '',
      ]
    case 'links':
    case 'contact':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}contact tile — photo rail + GitHub/LinkedIn/email/phone …${c.reset}`,
        '',
      ]
    case 'projects':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}project mosaic tiling … ${randomPick([
          'ship logs attached later',
          'demos queued behind courage',
          'README empathy included',
        ])}.${c.reset}`,
        '',
      ]
    case 'whoami':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}about-me tile — ${randomPick([
          'SCA stories live next to the engineer ones',
          'Graee na Uile / Ansteorra in the copy',
          'off‑clock anecdotes, no KPIs',
        ])}.${c.reset}`,
        '',
      ]
    case 'browse': {
      const hint = uri() || '(default start URL)'
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}iframe browser ⇢ ${c.reset}${c.blue}${hint}${c.reset}`,
        `  ${c.dim}(embed blockers apply — blank frame → Open tab.)${c.reset}`,
        '',
      ]
    }
    case 'explorer': {
      const p = uri() || 'cwd'
      return ['', `  ${c.green}►${c.reset} ${c.dim}file browser @ ${p} … clipboard glue ready.${c.reset}`, '']
    }
    case 'paint':
      return ['', `  ${c.green}►${c.reset} ${c.dim}MS Paint energy unlocked — Undo is therapy.${c.reset}`, '']
    case 'snake':
      return ['', `  ${c.green}►${c.reset} ${c.dim}Snake HUD allocated — collisions are pedagogical.${c.reset}`, '']
    case 'pong':
      return ['', `  ${c.green}►${c.reset} ${c.dim}CRT paddle physics — WASD ⇄ arrows rivalry.${c.reset}`, '']
    case 'edit':
    case 'editor':
    case 'vim': {
      const f = args[0]?.trim() || 'notes.txt'
      return ['', `  ${c.green}►${c.reset} ${c.dim}mini‑vim ⇢ ${c.blue}${f}${c.reset}${c.dim} · ${randomPick([
        ':wq writes to fake disk',
        'hjkl diplomacy',
        'buffers are bravery',
      ])}.${c.reset}`, '']
    }
    default:
      return ['', `  ${c.green}►${c.reset} ${c.dim}Compositor allocated tile: ${cmd}${c.reset}`, '']
  }
}
