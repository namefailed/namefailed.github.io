/**
 * `whoami` tile (About me) + `aboutInfoLines` neofetch column.
 * Long-form personal copy pulls from: résumé facts, `old/` portfolio HTML, projects catalog,
 * `docs/ARCHITECTURE.md` voice — not live social scraping.
 * SCA awards line is sourced from Kingdom of Ansteorra order of precedence (public OP URL in copy).
 */

import { ABOUT_ART } from '../../ascii'
import { c } from '../../theme'

export function aboutInfoLines(): string[] {
  return [
    `${c.blue}${c.bold}Matt Grey${c.reset}${c.dim} · github:${c.reset} ${c.cyan}namefailed${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}LinkedIn   ${c.reset}${c.dim}linkedin.com/in/matthew-grey-215615179${c.reset}`,
    `${c.pink}Role       ${c.reset}Software engineer · web · TypeScript-first`,
    `${c.pink}Focus      ${c.reset}Shippable UI, clear APIs, maintainable JS`,
    `${c.pink}SCA        ${c.reset}Graee na Uile · Kingdom of ${c.cyan}Ansteorra${c.reset}`,
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
    `${c.dim}accessibility where it costs little, and shipping with measurable loops.${c.reset}`,
    `${c.dim}Side projects:${c.reset} browser UI experiments, readable CSS/DOM,`,
    `${c.dim}and interfaces that behave under theme and zoom changes.${c.reset}`,
  ]
}

export function whoamiAboutLines(): string[] {
  const art = ABOUT_ART.map(line => `  ${line}`)
  return [
    '',
    `  ${c.pink}${c.bold}Matt Grey${c.reset}  ${c.dim}engineer · Killeen / Central TX ·${c.reset} ${c.cyan}mrgrey.dev${c.reset}`,
    `  ${c.dim}Building things you can steer without README archaeology.${c.reset}`,
    '',
    ...art,
    '',
    `  ${c.pink}${c.bold}At the keyboard${c.reset}`,
    `  ${c.dim}Interfaces with legible hierarchy, layouts that behave when the viewport lies,${c.reset}`,
    `  ${c.dim}and the unglamorous glue — Git hygiene, ticket trails, READMEs someone will read.${c.reset}`,
    `  ${c.dim}Freelance web since 2017 (${c.bold}scope → build → launch${c.reset}${c.dim}). SNHU Software Engineering.${c.reset}`,
    '',
    `  ${c.pink}${c.bold}SCA — persona Graee na Uile${c.reset}`,
    `  ${c.dim}Outside work I play in the ${c.bold}Society for Creative Anachronism${c.reset}${c.dim}: research and recreation${c.reset}`,
    `  ${c.dim}of pre-17th-century skills — fencing, scribal quirks, feast gear, muddy parking-lot castles.${c.reset}`,
    `  ${c.dim}Kingdom of ${c.cyan}Ansteorra${c.reset}${c.dim} (${c.bold}Texas + Oklahoma${c.reset}${c.dim}, loosely) keeps the calendar full.${c.reset}`,
    `  ${c.dim}Kingdom records list me as Graee na Uile — Irish-flavored spelling, sincere pageantry.${c.reset}`,
    `  ${c.dim}Orders of precedence show ${c.bold}Queen’s Rapier of Ansteorra${c.reset}${c.dim} (9 Nov 2024)${c.reset}`,
    `  ${c.dim}and an ${c.bold}Award of Arms${c.reset}${c.dim} (16 Nov 2024); if you duel in a hat feather, come say hi.${c.reset}`,
    '',
    `  ${c.pink}${c.bold}Kid + craft${c.reset}`,
    `  ${c.dim}Parent first — deadlines make more sense when someone’s counting on dinner.${c.reset}`,
    `  ${c.dim}Still reach for a camera for bands, posters, and outdoor light; this fake OS is ${c.bold}TypeScript + Vite${c.reset}${c.dim}.${c.reset}`,
    `  ${c.dim}Older static shell lives in ${c.cyan}/old${c.reset}${c.dim} if you like time capsules.${c.reset}`,
    '',
    `  ${c.pink}${c.bold}Links${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}in${c.reset}  ${c.dim}https://www.linkedin.com/in/matthew-grey-215615179/${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}gh${c.reset}  ${c.dim}https://github.com/namefailed${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}op${c.reset}  ${c.dim}https://op.ansteorra.org/people/id/12122 · kingdom order of precedence${c.reset}`,
    '',
    `  ${c.pink}${c.bold}Off the clock${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Gravel before the Texas heat clocks in.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Clicky keyboards, layout experiments, cats who own the couch.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Rewatching soft sci-fi and calling it culture study.${c.reset}`,
    '',
  ]
}
