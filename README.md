# Dadei Frontend

## Overview

Dadei Frontend is an npm workspaces monorepo that ships two production surfaces for the same product: a **browser SPA** and an **Electron desktop** client. Both share a **typed React UI layer** and API/realtime conventions, so product behavior stays consistent while each runtime handles its own constraints (tabs vs. native audio, OS keychain, installers).

## Why This Is Hard

- **Realtime + rich UI:** live voice and push-driven updates have to stay coherent across reconnects, duplicate events, and partial payloads without confusing the user.
- **Two runtimes, one product:** the website and desktop app each need auth, streaming, and conversation flows without duplicating domain logic or drifting out of sync.
- **Desktop security and lifecycle:** Electron separates main, preload, and renderer on purpose; tokens and sensitive work stay out of the renderer while the UI still feels like a modern web app.
- **Voice in the browser:** on-device wake-word detection, streaming PCM to the server for transcription, and client-side end-of-utterance timing all have to stay in sync without duplicating models or WASM across apps.
- **Shipping installers:** native modules, code signing, and automated builds across platforms raise the bar beyond “it works on my machine.”

## Architecture Highlights

- **Monorepo layout:** `apps/website` (Vite + React), `apps/desktop` (Electron + Vite renderer), and `packages/ui` (`@dadei/ui`) for shared components and client plumbing.
- **Layered React apps:** contexts and services orchestrate auth, API access, audio/realtime, and notifications so screens stay composable as the product grows.
- **HTTP + WebSockets:** a shared mental model of versioned REST (`/api/v1`, `/api/v2` where configured) alongside resilient WebSocket clients (heartbeats, backoff, fan-out to UI).
- **Electron process model:** main process owns window lifecycle, OAuth handoff, updates, and compatibility checks; preload exposes a narrow IPC surface; renderer stays a standard React app with `contextIsolation` and without broad Node exposure.
- **Desktop-specific concerns:** OS-backed secret storage for credentials, optional auto-update flow, and packaging via **electron-builder** with CI producing Windows and macOS artifacts.

## Voice and Audio

All voice behavior lives in `@dadei/ui` and is identical in the website and desktop renderer. There are **no per-app `public/` folders** for audio assets — models and runtime wiring are centralized so nothing is duplicated between apps.

### Wake-word detection (on-device)

Local wake-word detection uses the [openWakeWord](https://github.com/dscripka/openWakeWord) pipeline via `onnxruntime-web`:

- **Implementation:** `packages/ui/src/renderer/audio/wakeWordDetector.ts`
- **Models:** `packages/ui/src/renderer/audio/models/` (bundled by Vite with `?url` imports)
  - `melspectrogram.onnx` — mel feature extractor
  - `embedding_model.onnx` — embedding network
  - `hey_jarvis.onnx` — wake classifier (placeholder until a custom `dadei.onnx` is trained and dropped in)
- **ORT WASM:** loaded from jsDelivr CDN (`onnxruntime-web@1.26.0`), not self-hosted in the repo
- **Behavior:** runs on the mic stream in parallel with command capture; on detection it transitions to `listening` — transcription is **WebSocket-only** on the server

To swap in a custom wake word, replace the classifier ONNX in `models/` and update the import in `wakeWordDetector.ts`. No changes needed in `apps/website` or `apps/desktop`.

### Command capture and end-of-utterance

After wake (or manual start), PCM16 chunks stream to the backend over the realtime WebSocket. The client does **not** run Silero VAD or any other neural speech-activity model.

- **Streaming:** `AudioContext` downsamples to 16 kHz mono and sends `command_audio_*` messages
- **End-of-utterance:** RMS threshold on the mic analyser (`COMMAND_SPEECH_RMS` + `COMMAND_UTTERANCE_END_SILENCE_MS` in `packages/ui/src/lib/voice/session/constants.ts`)
- **Follow-up window:** after the assistant responds, a timed follow-up state lets the user continue without saying the wake word again

### Transcript wake-word fallback

Server-side ASR can also recognize spoken wake phrases. `packages/ui/src/lib/wakeWordDetection.ts` normalizes transcripts (handles “Dadei” spelling variants, “Assistant”, “Jarvis”, leading disfluencies) and strips wake tokens from submitted command text.

### Removed: client-side Silero VAD

The old setup copied Silero VAD worklets, VAD ONNX models, and self-hosted ORT WASM binaries into each app’s `public/` folder. That duplicated ~35 MB per app and required splitting model files across website and desktop. That approach is gone; all ONNX assets now live once in `@dadei/ui`.

## Engineering Decisions and Tradeoffs

- **Workspaces over separate repos:** one dependency graph and shared `@dadei/ui` package; slightly more discipline on boundaries, much less copy-paste across web and desktop.
- **Shared audio assets in `@dadei/ui`:** wake models ship with the UI package and Vite bundles them for both apps — no per-app `public/` copies.
- **CDN-hosted ORT WASM:** avoids checking in large WASM binaries; tradeoff is a runtime dependency on jsDelivr (same version pin as `onnxruntime-web` in `packages/ui`).
- **RMS over neural VAD for utterance boundaries:** simpler and lighter than Silero; server transcription handles the heavy lifting once capture starts.
- **Security over convenience in Electron:** explicit IPC instead of giving the renderer full Node reduces risk and keeps the attack surface reviewable.
- **Resilience over strict immediacy:** combining realtime streams with REST recovery helps the UI self-heal when messages arrive out of order or after a reconnect.
- **Env at the monorepo root:** `frontend/.env` drives both Vite apps so local and CI behavior stay aligned (see `apps/website/vite.config.ts` and `apps/desktop/main/env.ts`).
- **TypeScript throughout:** shared types and explicit contracts make refactors safer when backend APIs evolve in parallel with the backend service’s versioned API story.

## Reliability and Quality Signals

- **Typed client boundaries:** API and realtime URL composition live in shared modules so both apps agree on how to reach the backend.
- **Defensive UI patterns:** deduplication, ordering, and conflict-aware updates reduce impossible states in conversation and session views.
- **Graceful wake-word degradation:** if the local wake detector fails to initialize, passive mic capture and manual command start still work.
- **CI/CD for desktop:** GitHub Actions workflows under `.github/workflows` build and package installers, including the native-module and cross-platform concerns desktop shipping implies.
- **Modern toolchain:** React 19, Vite 7, TypeScript 5, Tailwind CSS 4, and ESLint-backed consistency on the website side.

## Impact

- **Users:** one product experience in the browser or on the desktop, with realtime feedback and navigable history after live sessions.
- **The team:** a single frontend codebase can evolve features once in `@dadei/ui` or shared client code and land in both clients.
- **Hiring signal:** this repo demonstrates full-stack *client* ownership—SPA architecture, realtime systems, Electron hardening, and release engineering—not only component-level UI work.

## Minimal Development Notes

```bash
npm install
```

Create `frontend/.env` at the monorepo root (both apps read it) with at least:

- `API_URL` — backend base URL (defaults to `http://localhost:8000` if omitted)
- `BETA` — optional; `true` when exercising beta API routing where applicable

Production builds (`vite build` for the website or desktop renderer) read **`API_URL` from the monorepo root** via `loadEnv` (`.env.production` or environment variables such as on Vercel). The desktop installer workflow writes that root `.env.production` before packaging so the renderer bundle matches the API the Electron main process uses.

Both Vite apps set `assetsInclude: ['**/*.onnx']` so wake-word models imported from `@dadei/ui` are emitted as static assets in the build output.

Common commands from the repo root:

```bash
npm run dev              # website + desktop together
npm run dev:website      # browser client only (Vite, port 5173)
npm run dev:desktop      # Electron dev loop
npm run build:website    # production SPA build
npm run package:desktop  # desktop build + installer (no publish)
```

Point `API_URL` at your running API (for example `http://localhost:8000` when the backend is up locally).
