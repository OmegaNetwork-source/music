# Music Studio

A Suno-like AI music generator. Pick a genre, add or generate lyrics, and create music with AI.

## Features

- **Genre selection** – Pop, Rock, Hip-Hop, Electronic, and more
- **Lyrics** – Paste your own or generate with AI (Groq, free tier)
- **Style controls** – Mood, theme, and style prompts for music
- **Music generation** – Replicate MusicGen (~$0.10 per track)
- **Download** – Save generated tracks as MP3

## Setup

### 1. Install dependencies

```bash
cd music-studio
npm install
```

### 2. API keys

Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Then add your API keys:

- **Replicate** – [Get token](https://replicate.com/account/api-tokens)  
  - Used for music generation (~$0.10 per track)

- **Groq** – [Get API key](https://console.groq.com/keys)  
  - Used for lyrics generation (free tier)

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech stack

- Next.js 16 + React 19
- Tailwind CSS
- Replicate (MusicGen) – music generation
- Groq – AI lyrics generation

## Deployment

Deploy to [Vercel](https://vercel.com) for free. Add `REPLICATE_API_TOKEN` and `GROQ_API_KEY` as environment variables in your project settings.
