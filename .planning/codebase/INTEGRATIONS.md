# External Integrations

**Analysis Date:** 2026-01-23

## APIs & External Services

**Video/Audio Platforms:**
- YouTube - Video platform for audio extraction via metadata and download
  - SDK/Client: yt-dlp (external binary)
  - Integration: Shell command invocation from `src-tauri/src/commands.rs` via `std::process::Command`
  - Purpose: Extract audio in highest quality (bestaudio format)

- SoundCloud - Audio platform for track downloads
  - SDK/Client: yt-dlp (external binary)
  - Integration: Same command interface as YouTube via `download_audio` command
  - Purpose: Extract audio from SoundCloud tracks

**Metadata/Artwork Services:**
- Generic HTTP endpoints (via `fetch_artwork_html` command)
  - SDK/Client: `reqwest` 0.11 (blocking HTTP client)
  - Integration: `src-tauri/src/commands.rs::fetch_artwork_html()`
  - Purpose: Scrape image URLs from HTML responses
  - Implementation: Makes GET request, extracts JPG URLs via regex pattern `https?://[^\s]+\.jpg`

## Data Storage

**Databases:**
- None - Application uses no persistent database
- All state is in-memory via Solid.js context signals

**File Storage:**
- Local filesystem only
- Downloads saved to `~/Downloads/` via yt-dlp
- No cloud storage integration

**Caching:**
- None - No caching layer implemented
- Each download task fetches fresh data

## Authentication & Identity

**Auth Provider:**
- None - No authentication system implemented
- Application is single-user desktop app with no multi-user features

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service

**Logs:**
- Browser console only (console.log/console.error)
- Locations: `src/contexts/app-state.tsx` (lines 61, 65)
- Rust stderr for yt-dlp command failures captured in `commands.rs`

## CI/CD & Deployment

**Hosting:**
- GitHub Actions - `.github/workflows/main.yml` builds for release branch
- Builds generate platform executables (DMG for macOS, deb for Linux, MSI for Windows)
- No server hosting required - standalone desktop application

**CI Pipeline:**
- GitHub Actions triggers on pushes to `release` branch
- Builds for three platforms: macOS (arm64 + x86_64), Ubuntu (Linux), Windows
- Artifacts are installable packages per platform

## Environment Configuration

**Required env vars:**
- None explicitly required at runtime
- Build time: Rust toolchain and Bun/Node.js

**Secrets location:**
- No secrets used in current implementation
- Application is fully local with no API keys or authentication tokens

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## IPC (Inter-Process Communication)

**Frontend-to-Backend Bridge:**
- Tauri `invoke()` function: `@tauri-apps/api/tauri`
- Commands registered in `src-tauri/src/main.rs`:

  | Command | Location | Purpose | Params | Returns |
  |---------|----------|---------|--------|---------|
  | `download_audio` | `commands.rs::download_audio()` | Execute yt-dlp with format | `url: &str, format: &str` | `String` (success bool) |
  | `fetch_artwork_html` | `commands.rs::fetch_artwork_html()` | Scrape image URLs from HTML | `url: &str` | `Result<String, String>` (JSON array) |
  | `greet` | `commands.rs::greet()` | Demo command | `name: &str` | `String` |
  | `get_bpm` | `bpm.rs::get_bpm()` | BPM detection (stub) | None | Not implemented |

**Call Pattern:**
```typescript
// Frontend (Solid.js)
const resp = await invoke("download_audio", {
  url: task.url,
  format: task.format,
});
```

## External Binary Dependencies

**yt-dlp:**
- Must be installed separately and present in system PATH
- Called with flags: `-f bestaudio --extract-audio --audio-format {format}`
- Supported formats: `flac`, `mp3` (format parameter from UI)
- Output pattern: `~/Downloads/%(title)s.%(ext)s`
- Failure handling: Returns process status as string

---

*Integration audit: 2026-01-23*
