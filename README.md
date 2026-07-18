# Percussion Engine

Browser-based procedural percussion sequencer built with **Next.js (App Router)**, **Tailwind CSS**, **Shadcn-style UI components**, and **Tone.js**.

## Features

- Purely synthesized kick, snare/noise, and hi-hat engines (no pre-recorded samples).
- Clickable 16-step grid with three drum channels.
- Tempo control (60-180 BPM) and loop length control (1, 2, 4, or 8 bars).
- Build-up automation curves (linear/exponential) targeting:
  - Snare Pitch
  - Noise Filter Cutoff
  - Decay Time
- Offline loop rendering with Tone.js and browser download as **24-bit / 44.1kHz WAV**.

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.
