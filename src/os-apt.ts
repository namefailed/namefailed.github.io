import { c } from './theme'

import {
  aptRemove,
  attemptAptInstall,
  type AptInstallOutcome,
  listInstalledPackages,
} from './os-packages'

function installPageantry(pkgDisplay: string): string[] {
  const p = c.pink

  const d = c.dim

  const g = c.green

  const x = c.reset

  return [
    '',

    `       ${p}╔════════════════════════════╗${x}`,

    `       ${p}║ ${g}◆ Portfolio pkg-droid ◆ ${p}║${x}`,

    `       ${p}╚════════════════════════════╝${x}`,

    `                    ${g}\\  ^__^${x}`,

    `                     ${g}\\ (oo)\\_______${x}`,

    `                       ${g}(__)\\       )\\/\\${x}`,

    `                           ${g}||────w │${x}  ${d}fetching blobs…${x}`,

    '',

    `  ${d}Reading package lists … Done${x}`,

    `  ${d}Building dependency tree … Done${x}`,

    `  ${d}Calculating upgrade … Done${x}`,

    '',

    `  ${g}Unpacking ${pkgDisplay}${x} ${d}(hypothetical) … ${g}████████████${d}░░ ${g}78%${x}`,

    `  ${d}Setting up substitutes (imagination-main) … ${g}Done${x}`,

    `  ${d}Processing triggers for sarcasm-base (1.9.2) … ${g}Done${x}`,

    '',
  ]
}

function installFinale(
  pkgDisplay: string,
  outcome: AptInstallOutcome,
): string[] {
  switch (outcome) {
    case 'new':
      return [
        `  ${c.green}(✓)${c.reset} ${c.dim}cowsay is on disk (pretend-but-real listing). Run ${c.blue}cowsay moo${c.reset}${c.dim}.${c.reset}`,

        '',
      ]

    case 'already':
      return [
        `  ${c.green}(✓)${c.reset} ${c.dim}${pkgDisplay}: already at newest (${c.green}imaginary/rolling${c.reset}${c.dim}).${c.reset}`,

        '',
      ]

    case 'unknown':
      return [
        `  ${c.dim}…then the conveyor belt politely jammed.${c.reset}`,

        `  ${c.red}(✗)${c.reset} ${c.blue}${pkgDisplay}${c.reset} ${c.dim}has no binaries here —`,

        `${c.green}cowsay${c.dim} is the only honoured guest.${c.reset}`,

        '',
      ]
  }
}

export function runApt(args: string[]): string[] {
  const sub = args[0]?.toLowerCase()

  if (!sub || sub === 'help' || sub === '--help') {
    return [
      '',

      `  ${c.dim}apt${c.reset} — ${c.dim}cosmetic installs; useful list is ${c.blue}apt install cowsay${c.reset}`,

      `  ${c.blue}apt list${c.reset}${c.dim} · ${c.blue}apt search${c.reset}${c.dim} · ${c.blue}install/remove${c.reset}${c.dim} · ${c.blue}update${c.reset}`,

      '',
    ]
  }

  if (sub === 'list' || sub === 'ls') {
    const pkgs = listInstalledPackages()

    if (pkgs.length === 0)
      return [
        `  ${c.dim}(empty — try ${c.blue}apt install cowsay${c.reset}${c.dim})${c.reset}`,
      ]

    return ['', ...pkgs.map((p) => `  ${c.green}ii${c.reset}  ${p}`), '']
  }

  if (sub === 'install') {
    const raw = args[1]?.trim()

    if (!raw)
      return [`  ${c.red}E:${c.reset} ${c.dim}need a package name.${c.reset}`]

    const display = raw

    return [
      ...installPageantry(display),
      ...installFinale(display, attemptAptInstall(raw)),
    ]
  }

  if (sub === 'remove' || sub === 'purge') {
    const pkg = args[1]?.toLowerCase()

    if (!pkg)
      return [`  ${c.red}E:${c.reset} ${c.dim}need a package name.${c.reset}`]

    const err = aptRemove(pkg)

    if (err) return [`  ${err}`]

    return [`  ${c.dim}Removing ${pkg} … ${c.green}done${c.reset}`]
  }

  if (sub === 'update' || sub === 'upgrade') {
    return [
      `  ${c.dim}Hit:${c.reset} https://repo.mrgrey.dev/rolling InRelease`,

      `  ${c.dim}Reading package lists … Done${c.reset}`,

      `  ${c.dim}Nothing pending.${c.reset}`,
    ]
  }

  if (sub === 'search' || sub === 'find') {
    const needle = args.slice(1).join(' ').toLowerCase().trim()

    type Row = { id: string; blurb: string }
    const shelf: readonly Row[] = [
      {
        id: 'cowsay',
        blurb: 'ASCII cow theologian · the only honoured install target',
      },
      {
        id: 'neofetch-hallucination',
        blurb: '',
      },
      {
        id: 'docker-for-tabs',
        blurb:
          'hypothetical — each browser tab already is a container spiritually',
      },
      {
        id: 'systemd-simp',
        blurb: 'meta-package if you lovingly screenshot fake boot spikes',
      },
      {
        id: 'left-pad-memorial',
        blurb: 'empty tarball with feelings',
      },
    ]

    const formatBlurb = (r: Row): string => {
      if (r.id === 'neofetch-hallucination') {
        return `${c.dim}blocked by ergonomics — try the ${c.blue}whoami${c.reset}${c.dim} About tile.${c.reset}`
      }

      return `${c.dim}${r.blurb}${c.reset}`
    }

    const hay = (r: Row): string => `${r.id} ${r.blurb}`.toLowerCase()

    const hits = needle ? shelf.filter((r) => hay(r).includes(needle)) : shelf

    if (!hits.length)
      return [
        `  ${c.dim}no phantom packages match ${c.blue}${needle || '∅'}${c.reset}`,
        '',
      ]

    const lines: string[] = [
      '',
      `  ${c.dim}browsing repo.mrgrey.dev/imaginary …${c.reset}`,
      '',
      ...hits.map(
        (r) => `  ${c.green}${r.id.padEnd(22)}${c.reset}  ${formatBlurb(r)}`,
      ),
      '',
      `  ${c.dim}(install path still ceremonial — ${c.blue}apt install cowsay${c.reset}${c.dim} works.)${c.reset}`,
      '',
    ]

    return lines
  }

  return [
    `  ${c.red}E:${c.reset} Unknown — try ${c.blue}apt${c.reset}${c.dim} alone.${c.reset}`,
  ]
}
