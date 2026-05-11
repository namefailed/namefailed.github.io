/** `links` / Contact tile — outbound lines for the shell */

import { c } from '../../theme'
import { dimInterpunct, dimRule } from './ansi-widgets'

export function linksAndContactLines(): string[] {
  return [
    '',
    `  ${c.pink}contact${c.reset}  ${c.dim}— outbound + direct lines${c.reset}`,
    `  ${c.dim}Photo rail on the left — add portrait.jpg under site root, or enjoy the neon placeholder.${c.reset}`,
    `  ${dimRule(44)}`,
    '',
    `  ${c.yellow}site${c.reset}       mrgrey.dev`,
    `  ${c.yellow}github${c.reset}     github.com/namefailed`,
    `  ${c.yellow}email${c.reset}      namefailedx@gmail.com`,
    `            ${c.dim}Best for scope, attachments, threaded detail.${c.reset}`,
    '',
    `  ${c.yellow}phone${c.reset}      +1 254-534-9544`,
    `            ${c.dim}Voice / SMS · US Central.${c.reset}`,
    '',
    `  ${dimInterpunct} ${c.dim}Embedded browser:${c.reset} ${c.blue}browse${c.reset}`,
    `  ${dimInterpunct} ${c.dim}Smoke test:${c.reset} ${c.blue}browse https://example.com${c.reset}`,
    '',
    `  ${c.dim}Bookmark bar favors hosts that allow iframes; many block embedding.${c.reset}`,
    '',
    `  ${dimInterpunct} ${c.dim}Résumé:${c.reset} ${c.blue}resume${c.reset}${c.dim} tile · formal PDF on request.${c.reset}`,
    `  ${dimInterpunct} ${c.dim}Typical reply within a business day.${c.reset}`,
    '',
  ]
}
