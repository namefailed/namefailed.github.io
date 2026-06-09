/** Public copy for the `/phoeme/` product page — keep aligned with `projects-catalog.ts`. */

export const PHOEME = {
  name: 'Phoneme',
  tagline: 'Local-first voice transcription for Windows',
  summary:
    'Hold a global hotkey, speak, release — text lands in whatever app you were using. Offline Whisper by default, with optional cloud STT/LLM cleanup when you want polish without giving up local control.',
  repo: 'https://github.com/namefailed/phoneme',
  releases: 'https://github.com/namefailed/phoneme/releases',
  license: 'MIT / Apache-2.0',
  status: 'Early development',
  stack: ['Rust', 'Tauri 2', 'egui', 'Whisper', 'SQLite'],
  heroImage: '/img/portfolio-phoneme.png',
  heroImageAlt: 'Phoneme application screenshot',
} as const

export interface PhoemeFeature {
  readonly title: string
  readonly body: string
}

export const PHOEME_FEATURES: readonly PhoemeFeature[] = [
  {
    title: 'Hold to dictate',
    body: 'Global hotkey capture — press, speak, release. Transcript pastes at the cursor in any app.',
  },
  {
    title: 'Offline by default',
    body: 'Whisper runs locally so drafts stay on your machine. No account required to get useful output.',
  },
  {
    title: 'Cloud when you want it',
    body: 'Optional STT/LLM cleanup passes for tighter prose — opt in per workflow, not by default.',
  },
  {
    title: 'Meeting mode',
    body: 'Dual-track capture for calls and notes — separate mic and system audio when you need context.',
  },
  {
    title: 'Catalog & webhooks',
    body: 'SQLite history, searchable clips, and webhook hooks for automation-minded setups.',
  },
  {
    title: 'CLI included',
    body: 'Script batch jobs, inspect the catalog, and wire Phoneme into your existing toolchain.',
  },
] as const

export const PHOEME_STEPS: readonly PhoemeFeature[] = [
  {
    title: '1 · Bind a hotkey',
    body: 'Pick a chord that will not fight your editor — Phoneme listens globally while it runs in the tray.',
  },
  {
    title: '2 · Speak naturally',
    body: 'Hold the key, talk, release. Audio is transcribed locally; optional cleanup runs if enabled.',
  },
  {
    title: '3 · Paste anywhere',
    body: 'Text is injected into the focused field — docs, terminals, tickets, chat, IDEs.',
  },
] as const
