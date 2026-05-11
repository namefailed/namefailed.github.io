/** `whoami` tile + leftover neofetch-style column for `aboutInfoLines` */

import { ABOUT_ART } from '../../ascii'
import { c } from '../../theme'

export function aboutInfoLines(): string[] {
  return [
    `${c.blue}${c.bold}Matt Grey${c.reset}${c.dim} · github:${c.reset} ${c.cyan}namefailed${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}Role       ${c.reset}Developer · web · TypeScript-first`,
    `${c.pink}Focus      ${c.reset}Shippable UI, clear APIs, maintainable JS`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}Platform   ${c.reset}Windows 11`,
    `${c.pink}Stack      ${c.reset}TypeScript · Vite · browser targets`,
    `${c.pink}Runtime    ${c.reset}Node · Browser engines`,
    `${c.pink}Site theme ${c.reset}${c.dim}try ${c.blue}theme list${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}Location   ${c.reset}Killeen, TX ${c.dim}(US Central)${c.reset}`,
    `${c.pink}Status     ${c.reset}${c.green}open to work${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.dim}I build interfaces people can steer without reading a manual.${c.reset}`,
    `${c.dim}Freelance + product-minded delivery; calm git history matters.${c.reset}`,
    `${c.dim}Recent focus:${c.reset} portfolio OS ${c.dim}(this site)${c.reset}, tightening`,
    `${c.dim}accessibility where it costs little, and shipping with measurable loops.`,
    `${c.dim}Side projects:${c.reset} browser UI experiments, readable CSS/DOM,`,
    `${c.dim}and interfaces that behave under theme and zoom changes.${c.reset}`,
  ]
}

export function whoamiAboutLines(): string[] {
  const art = ABOUT_ART.map(line => `  ${line}`)
  return [
    '',
    `  ${c.pink}${c.bold}About me${c.reset}  ${c.dim}off the hiring packet${c.reset}`,
    '',
    ...art,
    '',
    `  ${c.dim}Deliberate room for ${c.bold}not-work${c.reset}${c.dim} — swap these anytime (same repo as résumé copy).`,
    '',
    `    ${c.yellow}·${c.reset} ${c.dim}Logging miles on gravel around Central TX when sunrise cooperates.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Mechanical keyboards, loud switches, tinkering layouts for fun.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Two cats veto most furniture choices; espresso is a coping strategy.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Rewatching cozy sci‑fi counts as “research”.${c.reset}`,
    '',
  ]
}
