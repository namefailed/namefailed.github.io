/**
 * `whoami` tile (About me) + `aboutInfoLines` neofetch column.
 * Long-form personal copy pulls from: résumé facts, `old/` portfolio HTML, projects catalog,
 * `docs/ARCHITECTURE.md` voice — not live social scraping.
 * SCA awards line is sourced from Kingdom of Ansteorra order of precedence (public OP URL in copy).
 */

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
  return [
    '',
    `  ${c.pink}${c.bold}Matt Grey${c.reset}  ${c.dim}software engineer · Killeen, TX ·${c.reset} ${c.cyan}mrgrey.site${c.reset}`,
    `  ${c.dim}I build interfaces people can navigate without reading the manual.${c.reset}`,
    `  ${c.dim}(Except this one — type ${c.reset}${c.blue}help${c.reset}${c.dim} if you get lost.)${c.reset}`,
    '',
    `  ${c.pink}${c.bold}Work${c.reset}`,
    `  ${c.dim}Freelance web since 2017 — ${c.bold}scoping → building → shipping${c.reset}${c.dim} for small businesses,${c.reset}`,
    `  ${c.dim}nonprofits, and product teams. TypeScript-first, with a bias toward${c.reset}`,
    `  ${c.dim}layouts that survive edge cases: narrow viewports, zoom, reduced-motion.${c.reset}`,
    `  ${c.dim}Finishing a B.S. in Software Engineering at SNHU / Kenzie Academy.${c.reset}`,
    '',
    `  ${c.pink}${c.bold}This site${c.reset}`,
    `  ${c.dim}An in-browser window manager — tiling layout, xterm.js terminal,${c.reset}`,
    `  ${c.dim}toy filesystem, seven colour themes, Three.js, and Web Audio.${c.reset}`,
    `  ${c.dim}Pure TypeScript + Vite, no framework. Source at ${c.cyan}github.com/namefailed${c.reset}${c.dim}.${c.reset}`,
    `  ${c.dim}Type ${c.reset}${c.blue}help${c.reset}${c.dim} to see what the terminal can do, or ${c.reset}${c.blue}theme list${c.reset}${c.dim} to switch palettes.${c.reset}`,
    '',
    `  ${c.pink}${c.bold}SCA — Graee na Uile${c.reset}`,
    `  ${c.dim}Member of the ${c.bold}Society for Creative Anachronism${c.reset}${c.dim}, Kingdom of ${c.cyan}Ansteorra${c.reset}${c.dim}${c.reset}`,
    `  ${c.dim}(Texas + Oklahoma). I fence, do scribal work, and show up to events${c.reset}`,
    `  ${c.dim}with good feast gear and worse parking-lot navigation.${c.reset}`,
    `  ${c.dim}Awards: ${c.bold}Queen's Rapier of Ansteorra${c.reset}${c.dim} · ${c.bold}Award of Arms${c.reset}${c.dim} (Nov 2024).${c.reset}`,
    '',
    `  ${c.pink}${c.bold}Outside the terminal${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Dad first — the real deadlines are bedtime stories and school pickup.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Longboarding before the Texas heat wins.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Mechanical keyboards, custom layouts, cats who own the chair.${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.dim}Doom Emacs, org-mode notes, and an unhealthy interest in CSS.${c.reset}`,
    '',
    `  ${c.pink}${c.bold}Links${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}gh${c.reset}   ${c.dim}github.com/namefailed${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}in${c.reset}   ${c.dim}linkedin.com/in/matthew-grey-215615179${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}mail${c.reset} ${c.dim}namefailedx@gmail.com${c.reset}`,
    `    ${c.yellow}·${c.reset} ${c.green}op${c.reset}   ${c.dim}op.ansteorra.org/people/id/12122${c.reset}`,
    '',
  ]
}
