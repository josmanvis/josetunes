# JoseTunes

## What This Is

JoseTunes is a cross-platform desktop audio downloader that lets users batch download audio from YouTube and SoundCloud in FLAC or MP3 format. Built with Tauri v1 (Solid.js frontend, Rust backend), it shells out to yt-dlp for the actual downloading.

## Core Value

Users can paste a URL and get high-quality audio files on their machine with minimal friction.

## Requirements

### Validated

- ✓ Desktop app runs on Mac, Windows, Linux — existing (Tauri v1)
- ✓ User can add YouTube/SoundCloud URLs to download queue — existing
- ✓ User can select audio format (FLAC or MP3) — existing
- ✓ User can batch download all queued items — existing
- ✓ Download status tracking (pending/downloading/completed/failed) — existing
- ✓ Artwork thumbnails display for queued items — existing

### Active

- [ ] Users can install via `npx josetunes` (platform-specific binary packages)
- [ ] Users can install via `brew install josetunes/tap/josetunes` (custom Homebrew tap)
- [ ] Users can download binaries from GitHub Releases (Mac arm64+x86_64, Windows, Linux)
- [ ] Pushing a version tag triggers automated CI builds and GitHub Release creation
- [ ] README documents all installation methods clearly
- [ ] README includes usage guide (add URLs, pick format, download)
- [ ] README documents yt-dlp as a prerequisite with install instructions
- [ ] First release is version 0.1.0

### Out of Scope

- Homebrew core submission — requires review process, custom tap is sufficient for now
- Contributing/developer guide — focus on end-user docs first
- Auto-update mechanism — users can re-install for updates
- yt-dlp bundling — users install it separately (keeps binary size small)

## Context

- Existing GitHub Actions workflow builds for Mac (arm64 + x86_64), Ubuntu, and Windows on pushes to `release` branch
- Current CI needs to be updated to trigger on version tags and create GitHub Releases
- npm distribution of native binaries follows the esbuild/turbo pattern: platform-specific optional deps with a JS wrapper
- Homebrew tap requires a separate GitHub repo (e.g., `homebrew-tap`) with a formula pointing to release assets
- yt-dlp must be in the user's PATH — this is a hard runtime dependency

## Constraints

- **Runtime dependency**: yt-dlp must be installed separately by the user — no bundling
- **Tauri v1**: Staying on v1 for this release (migration to v2 is a separate effort)
- **Package manager**: Bun for development, but npm publish for distribution
- **Bundle ID**: `com.crativo.tunerip` (existing, keep consistent)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| npm via platform-specific packages | Same pattern as esbuild — proven for native binary distribution | — Pending |
| Custom Homebrew tap over core | Faster to ship, no review process, full control | — Pending |
| Version 0.1.0 | Early release, signals expect changes | — Pending |
| Automated releases on tag push | Removes manual steps, ensures consistent builds | — Pending |

---
*Last updated: 2026-01-23 after initialization*
