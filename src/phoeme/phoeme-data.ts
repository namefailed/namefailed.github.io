/** Public copy for the `/phoeme/` product page — aligned with phoneme/docs and README. */

export const PHOEME = {
  name: 'Phoneme',
  tagline: 'Local-first voice transcription for Windows power users',
  summary:
    'Hit a hotkey, speak, get text anywhere. Phoneme runs 100% offline by default with bundled whisper.cpp — no cloud, subscriptions, or telemetry. Mix in cloud STT or LLM cleanup only when you want speed or polish; each pipeline step picks its own provider.',
  repo: 'https://github.com/namefailed/phoneme',
  releases: 'https://github.com/namefailed/phoneme/releases',
  docs: 'https://github.com/namefailed/phoneme/tree/master/docs/README.md',
  license: 'MIT / Apache-2.0',
  status: 'Windows · Open source · No telemetry',
  stack: ['Rust', 'Tauri 2', 'Lit', 'whisper.cpp', 'SQLite', 'ONNX'],
  heroImage:
    'https://raw.githubusercontent.com/namefailed/phoneme/master/docs/screenshots/main.png',
  heroImageAlt:
    'Phoneme main window — recordings catalog, search, tags, and detail pane with waveform',
} as const

export interface PhoemeCopyBlock {
  readonly title: string
  readonly body: string
}

/** README philosophy table — privacy, flexibility, extensibility. */
export const PHOEME_PHILOSOPHY: readonly PhoemeCopyBlock[] = [
  {
    title: 'Privacy first',
    body: 'Voice stays on your machine by default. No forced cloud, no tracking, no accounts required for useful output.',
  },
  {
    title: 'Flexible by design',
    body: 'Transcription, live preview, cleanup, and summary each choose their own provider — local whisper.cpp and Ollama, or OpenAI, Anthropic, Groq, Deepgram, and more.',
  },
  {
    title: 'Extensible',
    body: 'JSON hook payloads, webhooks, and a full CLI peer. Wire Obsidian, Discord, Slack, or your own scripts without forking the app.',
  },
] as const

/** Four core workflows from ROADMAP personas — what people actually use Phoneme for. */
export const PHOEME_WORKFLOWS: readonly PhoemeCopyBlock[] = [
  {
    title: 'Dictate anywhere',
    body: 'Transcribe-in-Place (`Ctrl+Alt+I`): hold a hotkey, speak, release — text types into Slack, Word, VS Code, or any focused field.',
  },
  {
    title: 'Archive meetings',
    body: 'Meeting Mode captures mic + system audio as linked tracks on a shared wall-clock timeline — Zoom, Teams, Meet, or any PC audio.',
  },
  {
    title: 'Search your voice',
    body: 'SQLite catalog with FTS5 keyword search plus offline semantic search — find “that Rust error idea” even if you never said those words.',
  },
  {
    title: 'Automate everything',
    body: 'Every GUI action is a CLI command. Hooks fire after transcription; bind AutoHotkey, Kanata, or Stream Deck to `phoneme record --start`.',
  },
] as const

export const PHOEME_FEATURES: readonly PhoemeCopyBlock[] = [
  {
    title: 'Offline Whisper by default',
    body: 'Bundled whisper.cpp server with a First Run Wizard that detects RAM/VRAM and recommends the right model. Re-transcribe old notes with a bigger model later.',
  },
  {
    title: 'Independent provider system',
    body: 'STT, live preview, LLM cleanup, and AI summary are separate jobs — mix local privacy with cloud speed per step, not all-or-nothing.',
  },
  {
    title: 'Smart cleanup & summaries',
    body: 'Optional LLM pass removes stutters and formats prose. Auto-generate per-recording summaries. Three transcript layers (raw → cleaned → edited) so nothing is lost.',
  },
  {
    title: 'Meeting Mode + diarization',
    body: 'Dual-track WASAPI loopback + mic capture, session grouping, merged conversation view, and optional speaker labels (local speakrs or cloud APIs).',
  },
  {
    title: 'Live preview & pre-roll',
    body: 'Streaming partial transcripts while you record, plus a rolling pre-roll buffer so the first syllable is not clipped when you hit the hotkey.',
  },
  {
    title: 'Catalog, tags & export',
    body: 'Interactive waveforms, notes field, bulk actions, retention policies, and export to JSON, CSV, or TXT — thousands of recordings stay searchable.',
  },
] as const

export const PHOEME_STEPS: readonly PhoemeCopyBlock[] = [
  {
    title: '1 · Install & wizard',
    body: 'Download the MSI, run the First Run Wizard — pick Local & Private or Cloud Speed, download models, set hotkeys, and connect optional API keys.',
  },
  {
    title: '2 · Capture your way',
    body: 'Record to the catalog, dictate in-place, or toggle Meeting Mode. Hold, toggle, pause/resume, or drive it entirely from the CLI.',
  },
  {
    title: '3 · Transcribe → enrich → route',
    body: 'Whisper transcribes locally or in the cloud; optional cleanup and summary run; hooks and webhooks deliver JSON to your toolchain.',
  },
] as const

/** Short comparison hook from README — who should reach for Phoneme. */
export const PHOEME_AUDIENCE =
  'Reach for Phoneme when you want local-first, open-source, Windows-native transcription that stays scriptable — not a locked cloud dictation subscription.'
