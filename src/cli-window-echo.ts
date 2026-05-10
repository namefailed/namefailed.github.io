/** Short terminal banner lines after Desktop opens a window from the shell. */
import { c } from './theme'

function pick(xs: readonly string[]): string {
  return xs[Math.floor(Math.random() * xs.length)]!
}

/** Lines printed in the terminal right after Desktop accepts a window spawn. */
export function windowSpawnEcho(cmd: string, args: readonly string[]): string[] {
  const uri = (): string =>
    args.length ? (args.join(' ').length > 56 ? args.join(' ').slice(0, 54) + '…' : args.join(' ')) : ''

  switch (cmd) {
    case 'resume':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}raising résumé tile (${c.blue}portfolio export${c.dim}) …${c.reset}`,
        `  ${c.dim}${pick(['paper PDF still validates in elevators', 'JPEG portrait optional lore', 'HIRING=yes in this universe'])}.${c.reset}`,
        '',
      ]
    case 'links':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}links panel — outbound tubes warming …${c.reset}`,
        '',
      ]
    case 'skills':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}skills radar chart… ${pick(['stats are honorary', 'bars logarithmic vibes', 'grinding acknowledged'])}.${c.reset}`,
        '',
      ]
    case 'projects':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}project mosaic tiling … ${pick([
          'ship logs attached later',
          'demos queued behind courage',
          'README empathy included',
        ])}.${c.reset}`,
        '',
      ]
    case 'contact':
      return [
        '',
        `  ${c.green}►${c.reset} ${c.dim}contact card — pigeon RFC optional …${c.reset}`,
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
    case 'cube':
      return ['', `  ${c.green}►${c.reset} ${c.dim}3×3 gremlin containment field … U/D/L/R/F/B drive faces.${c.reset}`, '']
    case 'snake':
      return ['', `  ${c.green}►${c.reset} ${c.dim}Snake HUD allocated — collisions are pedagogical.${c.reset}`, '']
    case 'pong':
      return ['', `  ${c.green}►${c.reset} ${c.dim}CRT paddle physics — WASD ⇄ arrows rivalry.${c.reset}`, '']
    case 'edit':
    case 'editor':
    case 'vim': {
      const f = args[0]?.trim() || 'welcome.txt'
      return ['', `  ${c.green}►${c.reset} ${c.dim}mini‑vim ⇢ ${c.blue}${f}${c.reset}${c.dim} · ${pick([
        ':wq writes to fake disk',
        'hjkl diplomacy',
        'buffers are bravery',
      ])}.${c.reset}`, '']
    }
    default:
      return ['', `  ${c.green}►${c.reset} ${c.dim}Compositor allocated tile: ${cmd}${c.reset}`, '']
  }
}
