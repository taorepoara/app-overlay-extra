# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun dev              # Run dev mode (server on :3001, Vite client on :3002, concurrently)
bun run build        # Build client via Vite into dist/
bun run start        # Start production server
bun run check        # Run Biome linter on src/
```

There are no tests in this project.

## Architecture

This is a **Twitch streaming overlay** system with three interacting pieces: an admin control panel, a browser overlay display, and a Bun WebSocket/HTTP server.

### Applications

| Entry Point | File | Role |
|---|---|---|
| `admin.html` | `src/client/admin.ts` | Captures camera/screen, controls scenes and audio |
| `overlay.html` | `src/client/overlay.ts` | Displays feeds, Twitch stats, plays background music |
| `src/server/index.ts` | — | Routes WebSocket messages, serves files, handles Twitch OAuth |

Vite bundles all three HTML entry points into `dist/`. The server serves `dist/` in production and proxies to Vite's dev server (`localhost:3002`) in development.

### Data Flow

1. **Admin → Server → Overlay (scenes/audio):** Admin sends WebSocket messages (`setScene`, `setSoundMuted`, `setInterfaceVisibility`) → `WebSocketManager` updates state and broadcasts to overlay.
2. **Admin → Overlay (media):** Admin adds camera/screen tracks via `RTCPeerConnection`; overlay receives them via `onTrack` and routes to `<video>` elements.
3. **Twitch → Server → Overlay:** `TwitchClient` emits follower/subscriber/chat events → `WebSocketManager` buffers them until overlay connects, then flushes.

### Key Modules

**`src/server/WebSocketManager.ts`** — Central hub. Maintains current scene, mute states, interface visibility, and registered admin/overlay connections. All WebSocket routing goes through here.

**`src/server/TwitchClient.ts`** — Wraps `@twurple/api`, `@twurple/auth`, `@twurple/chat`. Requires `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` env vars. Handles OAuth redirect at `/redirect`.

**`src/client/ConnectionManager.ts`** — Singleton. Manages the WebSocket connection and `RTCPeerConnection` signaling (offer/answer/ICE). Initialized as `"admin"` (sends tracks) or `"overlay"` (receives tracks).

**`src/client/AudioManager.ts`** — Singleton. Uses Web Audio API to manage independent gain nodes for `"camera"`, `"screen"`, and `"music"` tracks. Background music loops with `MusicTrackPart`/`MusicPartGroup` sequencing. Gain transitions are 0.3s linear ramps.

**`src/types.ts`** — All WebSocket message types shared between client and server. Scenes are: `"start"`, `"transition"`, `"camera"`, `"screen"`, `"camera & screen"`, `"end"`.

### Scene System

The overlay's root element carries a `data-scene` attribute. CSS in `overlay.css` drives all visual transitions based on this attribute. Music gain levels change per scene via `AudioManager`.

### Environment

- `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are required for Twitch features.
- A reference client ID is in `data/env.json`.
- Audio assets (`.mp3`) live in `data/sound/`; intro video in `data/`.

## Linting

Biome is configured in `biome.json`. Double quotes are enforced; `noForEach` rule is disabled.
