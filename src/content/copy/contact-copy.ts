/** `links` / Contact tile — outbound lines for the shell */

import { c } from '../../theme'
import { dimInterpunct, dimRule } from './ansi-widgets'

export function linksAndContactLines(): string[] {
  return [
    '',
    `  ${c.pink}contact${c.reset}  ${c.dim}— outbound + direct lines${c.reset}`,
    `  ${dimRule(44)}`,
    '',
    `  ${c.yellow}site${c.reset}       mrgrey.dev`,
    `  ${c.yellow}github${c.reset}     github.com/namefailed`,
    `  ${c.yellow}linkedin${c.reset}   https://www.linkedin.com/in/matthew-grey-215615179/`,
    `            ${c.dim}Software engineer / web dev · SNHU · Killeen–Temple.${c.reset}`,
    '',
    `  ${c.yellow}email${c.reset}      namefailedx@gmail.com`,
    `            ${c.dim}Best for scope, attachments, threaded detail.${c.reset}`,
    '',
    `  ${c.yellow}phone${c.reset}      +1 254-534-9544`,
    `            ${c.dim}Voice / SMS · US Central.${c.reset}`,
    '',
    `  ${dimInterpunct} ${c.dim}Résumé:${c.reset} ${c.blue}resume${c.reset}${c.dim} tile · formal PDF on request.${c.reset}`,
    '',
  ]
}
