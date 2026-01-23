# Technology Stack

**Analysis Date:** 2026-01-23

## Languages

**Primary:**
- TypeScript 5.2.2 - Frontend (Solid.js components and utilities)
- Rust (Edition 2021) - Backend (Tauri commands and business logic)

**Build/Configuration:**
- SCSS 1.77.8 - Styling modules throughout components

## Runtime

**Environment:**
- Tauri v1 (Desktop application framework) - Cross-platform desktop runtime
- Node.js/Bun - Development and build time only

**Package Manager:**
- Bun - Fast JavaScript/TypeScript package manager
- Lockfile: `bun.lockb` (present)
- Cargo - Rust package manager for backend dependencies

## Frameworks

**Core Frontend:**
- Solid.js 1.7.8 - Reactive frontend framework with TypeScript support
- Vite 5.3.1 - Frontend bundler and dev server

**Desktop/Backend:**
- Tauri 1.6.0 (@tauri-apps/cli, @tauri-apps/api) - Desktop application framework enabling IPC between frontend and Rust backend

**Styling:**
- Sass 1.77.8 - SCSS preprocessing for component modules

## Key Dependencies

**Critical:**
- `@tauri-apps/api` 1.x - Provides JavaScript bridge to Rust commands via `invoke()`
- `solid-js` 1.7.8 - Core reactive framework (signals, context API, components)
- `vite-plugin-solid` 2.8.0 - Vite integration for Solid.js compilation
- `tauri` 1.x - Rust backend framework with command handlers

**Backend (Rust):**
- `serde` 1.x + `serde_json` 1.x - JSON serialization/deserialization for IPC
- `reqwest` 0.11 (with blocking, json features) - HTTP client for fetching artwork HTML
- `scraper` 0.13 - HTML parsing for extracting image URLs
- `regex` 1.5 - Pattern matching for URL extraction
- `url` 2.2 - URL parsing and validation
- `tauri-build` 1.x - Tauri build-time dependencies

**Build/Dev:**
- `typescript` 5.2.2 - TypeScript compiler
- `sass` 1.77.8 - SCSS compilation

## Configuration

**Environment:**
- No `.env` files detected - configuration is static in source code
- Window size hardcoded: 1000x600px, non-resizable
- Bundle identifier: `com.crativo.tunerip`

**TypeScript:**
- `tsconfig.json`: ES2020 target, strict mode enabled, JSX preset to `solid-js`
- Path aliases: Standard Node resolver with bundler mode

**Build Configuration:**
- `vite.config.ts`: Vite dev server on port 1420, integrates Solid.js plugin
- `src-tauri/tauri.conf.json`: Tauri app config with security settings (CSP: null), shell open capability enabled

## Platform Requirements

**Development:**
- Bun runtime (for package management and dev scripts)
- Rust toolchain (for backend compilation)
- yt-dlp binary must be in PATH (external dependency for audio downloading)

**Production:**
- macOS (arm64 + x86_64) - GitHub Actions builds configured
- Linux (Ubuntu) - GitHub Actions builds configured
- Windows (x64) - GitHub Actions builds configured
- Tauri window framework handles platform differences
- yt-dlp binary required at runtime for audio extraction functionality

**Key External Binary:**
- `yt-dlp` - YouTube/SoundCloud downloader with audio extraction capability
  - Invoked via Rust `std::process::Command`
  - Must support `--extract-audio` and `--audio-format` flags
  - Outputs files to `~/Downloads/`

---

*Stack analysis: 2026-01-23*
