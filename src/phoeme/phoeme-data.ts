/** Product copy for the `/phoeme/` marketing page. Source of truth: Phoneme docs. */

export interface PhoemeLink {
  readonly label: string
  readonly href: string
  readonly variant?: 'primary' | 'secondary' | 'ghost'
}

export interface PhoemeCard {
  readonly title: string
  readonly kicker?: string
  readonly body: string
}

export interface PhoemePipelineStage extends PhoemeCard {
  readonly signal: string
}

export interface PhoemeFeature extends PhoemeCard {
  readonly tag: string
}

export interface PhoemeComparisonPoint {
  readonly cloud: string
  readonly phoneme: string
}

export interface PhoemeFaq {
  readonly question: string
  readonly answer: string
}

export const PHOEME = {
  name: 'Phoneme',
  tagline: 'Local-first voice transcription for Windows',
  headline: 'Turn voice into a searchable local archive.',
  headlineBefore: 'Turn voice into a searchable ',
  headlineAccent: 'local archive.',
  intro:
    'You think faster than you type. The average person speaks at 150 words per minute but types at only 40. Phoneme bridges that gap. It runs **100% offline** by default, turning your voice into text anywhere. It cleans up the result when asked, and saves everything in a local catalog you can search, edit, export, or automate.',
  repo: 'https://github.com/namefailed/phoneme',
  releases: 'https://github.com/namefailed/phoneme/releases',
  docs: 'https://github.com/namefailed/phoneme/tree/master/docs/README.md',
  license: 'MIT / Apache-2.0',
  heroImage: '/img/portfolio-phoneme.png',
  heroImageAlt:
    'Phoneme recordings catalog with search, tags, waveform, transcript editor, and detail pane',
  ctas: [
    {
      label: 'Download for Windows',
      href: 'https://github.com/namefailed/phoneme/releases',
      variant: 'primary',
    },
    {
      label: 'Documentation',
      href: 'https://github.com/namefailed/phoneme/tree/master/docs/README.md',
      variant: 'secondary',
    },
    {
      label: 'GitHub',
      href: 'https://github.com/namefailed/phoneme',
      variant: 'ghost',
    },
  ] satisfies readonly PhoemeLink[],
  facts: ['Runs local by default', 'Windows today', 'No telemetry', 'Open source'],
  stackChips: ['Rust', 'Tauri 2', 'TypeScript', 'Lit', 'whisper.cpp', 'SQLite', 'ONNX'],
  attribution: 'Built by Matt Grey / namefailed.',
} as const

export const PHOEME_WORKFLOWS: readonly PhoemeCard[] = [
  {
    title: 'Capture thoughts before they evaporate',
    kicker: 'Transcribe-in-Place',
    body: 'Start Transcribe-in-Place (`Ctrl+Alt+I`), focus Slack, Word, Discord, or your editor, then speak. Phoneme records quietly, runs the transcript pipeline locally, and types the finished text into the focused window without missing a beat.',
  },
  {
    title: 'Record calls without losing the thread',
    kicker: 'Meeting Mode',
    body: 'Meeting Mode captures your microphone and system audio as linked tracks on one wall-clock timeline. Open the meeting entry later to review each waveform and transcript together.',
  },
  {
    title: 'Find old thoughts by words or meaning',
    kicker: 'Recall',
    body: 'The catalog stores recordings in SQLite with FTS5 keyword search. Optional semantic search adds an offline ONNX embedding index, so a plain-language query can find notes even when the exact phrase was never spoken.',
  },
  {
    title: 'Wire transcripts into your own system',
    kicker: 'Automation',
    body: 'The CLI is a peer to the GUI, and hooks receive the final transcript as JSON on `stdin`. Use PowerShell, Python, Obsidian, Discord, or a webhook without waiting for a marketplace integration.',
  },
] as const

export const PHOEME_PIPELINE: readonly PhoemePipelineStage[] = [
  {
    title: 'Capture',
    signal: 'Mic / loopback / file',
    body: 'Start from the GUI, `phoneme record`, Meeting Mode, or imported `.wav`, `.mp3`, and `.m4a` audio. Pre-roll can preserve the first syllable before the trigger lands.',
  },
  {
    title: 'Transcribe',
    signal: 'Local first, cloud optional',
    body: 'The default path runs whisper.cpp on your machine. If you choose cloud speed, transcription can use OpenAI, Groq, Deepgram, AssemblyAI, ElevenLabs, or an OpenAI-compatible endpoint.',
  },
  {
    title: 'Process',
    signal: 'Cleanup, summary, translation',
    body: 'Speak naturally to the AI, with pauses and emphasis. Smart Cleanup can remove stutters, format notes, translate, or summarize using Ollama or cloud models. Phoneme preserves raw and cleaned layers so edits are always reversible.',
  },
  {
    title: 'Route',
    signal: 'Catalog, search, hooks',
    body: 'Finished transcripts land in the local SQLite catalog, optional semantic index, exports, and user-owned hook scripts. JSON output pipes directly into Obsidian, Python scripts, or custom webhooks.',
  },
] as const

export const PHOEME_FEATURES: readonly PhoemeFeature[] = [
  {
    title: 'First Run Wizard',
    tag: 'Setup',
    body: 'Choose Local & Private, Cloud Speed, or Advanced. The wizard can download local dependencies, connect API keys, test the mic, enable preview and summary, and choose destinations.',
  },
  {
    title: 'Independent providers',
    tag: 'Providers',
    body: 'Transcription, live preview, cleanup, and summary each choose their own provider and model. For example: final transcription local, preview through Groq, cleanup in Ollama, summary through Claude.',
  },
  {
    title: 'Hardware-aware Whisper',
    tag: 'Models',
    body: 'Local setup checks RAM and VRAM, recommends Tiny/Base, Small/Medium, or Large-v3, and downloads the selected model to your device.',
  },
  {
    title: 'Dual-track Meeting Mode',
    tag: 'Meetings',
    body: 'Mic and WASAPI loopback are captured as separate tracks with the same total duration. Sparse system audio is placed at the wall-clock moment it actually played, not shoved to the start.',
  },
  {
    title: 'Speaker diarization',
    tag: 'Speakers',
    body: 'Optional offline diarization can label different speakers on the system track, turning a call recording into something closer to meeting notes instead of one long blob.',
  },
  {
    title: 'Three transcript layers',
    tag: 'Editing',
    body: 'Every recording can keep the raw machine transcript, the cleaned-but-unedited transcript, and the current edited text. Restore raw or unedited when cleanup overreaches.',
  },
  {
    title: 'Catalog, tags, and export',
    tag: 'Archive',
    body: 'The detail pane gives you waveform playback, transcript editing, notes, summaries, and tags. Export JSON, CSV, TXT, or a backup archive when you want data out.',
  },
  {
    title: 'Offline semantic search',
    tag: 'Search',
    body: 'When enabled, a small ONNX embedding model runs locally and indexes completed transcripts. Keyword search handles exact names; semantic search handles concepts and paraphrases.',
  },
  {
    title: 'Hooks you can read',
    tag: 'Automation',
    body: 'Reference hooks copy to `%APPDATA%/phoneme/hooks/` on first run and are never overwritten by the installer. Chain commands, trigger by keyword, or test with `phoneme hook test`.',
  },
] as const

export const PHOEME_COMPARISON = {
  eyebrow: 'Why this exists',
  title: 'Cloud dictation is not the only model.',
  lead:
    'Subscription dictation tools are useful when you want someone else to run the pipeline. Phoneme is for the other preference: local defaults, swappable providers, and an archive you can inspect.',
  points: [
    {
      cloud: 'Cloud subscriptions bundle transcription, cleanup, and storage behind an account.',
      phoneme:
        'Phoneme defaults to local whisper.cpp, local SQLite, local files, and optional cloud providers only where you configure them.',
    },
    {
      cloud: 'Most dictation apps focus on text insertion.',
      phoneme:
        'Phoneme keeps a searchable catalog with waveforms, notes, tags, summaries, transcript layers, and re-run controls.',
    },
    {
      cloud: 'Meeting capture often needs a vendor integration or call bot.',
      phoneme:
        'Meeting Mode records your microphone plus system audio on Windows, grouped under one meeting with a shared wall-clock timeline.',
    },
    {
      cloud: 'Automation is limited to what the vendor exposes.',
      phoneme:
        'The CLI, hook payload, and JSON-line daemon protocol make it scriptable from your own shortcuts, shells, and note systems.',
    },
  ] satisfies readonly PhoemeComparisonPoint[],
} as const

export const PHOEME_FAQS: readonly PhoemeFaq[] = [
  {
    question: 'Is Phoneme free? Is my audio sent to the cloud?',
    answer:
      'Phoneme is open source under MIT / Apache-2.0. The default configuration is 100% local with Whisper running on your machine. Audio or text only leaves your PC if you opt into a cloud transcription provider or cloud LLM cleanup/summary.',
  },
  {
    question: 'Does Phoneme work on macOS or Linux?',
    answer:
      'Windows only today. macOS and Linux are on the v2.0 roadmap; Meeting Mode on macOS will require a virtual loopback device.',
  },
  {
    question: "What's the difference between Record and Meeting Mode?",
    answer:
      'Record captures one stream, usually your microphone. Meeting Mode captures microphone plus system audio as two linked tracks with a shared timeline, which is better for Zoom, Teams, Meet, videos, and calls.',
  },
  {
    question: 'Can I re-transcribe with a better model later?',
    answer:
      'Yes. Select a recording, choose Re-transcribe, and pick a model. The original transcript is preserved, so trying a better model does not erase the earlier layer.',
  },
  {
    question: 'Keyword search vs semantic search?',
    answer:
      'Use keyword search for exact names, IDs, and phrases. Use semantic search for meaning-based recall, like finding a recording about a bug even when you cannot remember the words you used.',
  },
  {
    question: 'What is a hook?',
    answer:
      'A hook is an external script Phoneme runs after transcription. The daemon sends one JSON payload on `stdin`, then your script can copy text, append a note, post a webhook, or call another local tool.',
  },
  {
    question: 'Can hooks run only sometimes?',
    answer:
      'Yes. You can disable automatic hook runs and re-fire the hook per recording, or configure keyword-triggered rules for phrases such as action items.',
  },
] as const
