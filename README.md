
# Vibe Coding+ (Private Mode)

Voice → Plan → Patch → Test — all kept local for private testing.

## Quick Start
1. **Install** (Node 18+):  
   ```bash
   npm i
   npm run dev
   ```
   Open http://127.0.0.1:5173

2. You can click **Speak** to simulate ASR (no microphone needed). For real ASR & LLM, see below.

## Private ASR (optional)
- Build **whisper.cpp** and run its HTTP server locally, e.g. on `127.0.0.1:8080`.  
  Replace the `simulateSpeechToText` function in `src/lib/localAsr.ts` with a fetch call to your local server.

## Private LLM (optional)
- Run **llama.cpp** or an OpenAI-compatible local server at `http://127.0.0.1:8081/v1/chat/completions`.
- Adjust `MODEL`/`ENDPOINT` in `src/lib/localLlm.ts`.
- Click **Plan** to generate a plan using your local LLM. If the server isn't up, it falls back to an offline static plan.

## What’s Included
- React + Vite + TypeScript
- Private-mode UI with transcript, intent chips, planning, patch preview
- Local-only stubs for ASR/LLM so nothing leaves your machine

## Notes
- This is a prototype for local testing. No cloud calls are performed.
- You can later add tools for file reads/edits/tests gated by explicit approval.


---
## Private stack wiring (exact steps)

### 1) Run the local proxy (keeps browser simple; still private)
In one terminal:
```bash
npm i
npm run server
# listens on http://127.0.0.1:8787
```

Or run app + proxy together:
```bash
npm run dev:all
# WEB on 5173, API on 8787
```

### 2) Start whisper.cpp HTTP server (ASR)
Build whisper.cpp and run any HTTP demo that accepts a multipart file on /transcribe at 127.0.0.1:8080.
You can also put a reverse proxy that converts to whatever your local whisper server expects, then point WHISPER_HTTP env to it before `npm run server`:
```bash
WHISPER_HTTP=http://127.0.0.1:8080/transcribe npm run server
```

### 3) Start llama.cpp in OpenAI-compatible mode (LLM)
Run an OpenAI-style server on 127.0.0.1:8081 with a local instruction model (e.g., Llama 3.1 8B instruct).
Then click **Plan** in the app. You can change the model name in `src/lib/config.ts`.

**All traffic stays on localhost (127.0.0.1). No cloud calls.**
