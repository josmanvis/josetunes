# JoseTunes

Cross-platform desktop audio downloader. Download audio from YouTube and SoundCloud in FLAC or MP3 format.

![Version](https://img.shields.io/badge/version-0.1.0-blue)

## Features

- Batch download audio from YouTube and SoundCloud
- FLAC and MP3 format support
- Cross-platform: macOS (arm64 + Intel), Windows, Linux
- Simple paste-and-download workflow
- Files saved directly to `~/Downloads/`

## Prerequisites

JoseTunes requires [yt-dlp](https://github.com/yt-dlp/yt-dlp) for audio extraction. Install it for your platform:

**macOS:**

```bash
brew install yt-dlp
```

**Windows:**

```bash
winget install yt-dlp
```

or

```bash
scoop install yt-dlp
```

**Linux:**

```bash
sudo apt install yt-dlp
```

or

```bash
pip install yt-dlp
```

## Installation

### Homebrew (macOS)

```bash
brew install josmanvis/josetunes/josetunes
```

Since the app is unsigned, after first install run:

```bash
xattr -cr /Applications/josetunes.app
```

### npm (cross-platform)

```bash
npx josetunes
```

Downloads and launches the platform-appropriate installer. Requires Node.js >= 16.

### Direct Download

Download the latest release for your platform from [GitHub Releases](https://github.com/josmanvis/josetunes/releases/latest):

| Platform | Format |
|----------|--------|
| macOS (Apple Silicon) | `.dmg` (arm64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows | `.msi` |
| Linux | `.deb` or `.AppImage` |

## Usage

1. Open JoseTunes
2. Paste a YouTube or SoundCloud URL into the search box
3. Select audio format (FLAC or MP3)
4. Click "Download All" to start downloading
5. Files are saved to `~/Downloads/`

## Development

```bash
bun install
bun run tauri dev
```

Requires: Rust toolchain, Node.js, Bun, and [Tauri v1 prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites).

## License

MIT
