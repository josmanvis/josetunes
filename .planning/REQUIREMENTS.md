# Requirements: JoseTunes Distribution

## v1 Requirements (version 0.1.0)

### CI/CD Infrastructure

**CI-01**: Pushing a version tag (v*) triggers automated CI builds
- Version tag follows semver (e.g., v0.1.0)
- Triggers build workflow automatically

**CI-02**: Automated builds produce platform-specific installers
- macOS: .dmg for arm64 and x86_64
- Windows: .msi for x64
- Linux: .deb and .AppImage for x64

**CI-03**: CI creates GitHub Release with all platform installers attached
- Release created automatically after successful builds
- All platform artifacts uploaded to release
- Checksums included for verification

**CI-04**: Version synchronization works correctly across project files
- Cargo.toml is single source of truth
- tauri.conf.json falls back to Cargo.toml version
- CI validates git tag matches Cargo.toml version

### npm Distribution

**NPM-01**: Users can install via `npx josetunes` command
- Works on macOS (arm64 and x64), Windows x64, Linux x64
- Platform-specific package automatically selected

**NPM-02**: npm package structure follows platform-specific pattern
- Wrapper package (josetunes) with optionalDependencies
- Platform packages: @josetunes/darwin-arm64, @josetunes/darwin-x64, @josetunes/linux-x64, @josetunes/win32-x64
- Each platform package contains installer for that platform

**NPM-03**: npx command provides install instructions for user's platform
- Detects user's platform automatically
- Provides clear instructions to run/open installer
- Handles unsupported platforms gracefully

**NPM-04**: npm packages published automatically from CI
- Uses npm OIDC Trusted Publishers (no token management)
- Publishes after GitHub Release creation
- All 5 packages published in single release

### Homebrew Distribution

**BREW-01**: Users can install via `brew install josetunes/tap/josetunes`
- Custom Homebrew tap (not core submission)
- Works on macOS arm64 and x64

**BREW-02**: Homebrew Cask references GitHub Release artifacts
- Cask definition points to release .dmg URLs
- Architecture-specific URLs and SHA256 checksums
- Auto-updates on new releases

### Documentation

**DOC-01**: README documents all installation methods clearly
- npm/npx installation instructions
- Homebrew installation instructions
- Direct download from GitHub Releases
- One-line commands where possible

**DOC-02**: README includes usage guide
- How to add URLs to download queue
- How to select audio format (FLAC/MP3)
- How to start download
- Where files are saved

**DOC-03**: README documents yt-dlp prerequisite
- States yt-dlp must be installed separately
- Provides installation instructions per platform
- Explains why it's required

**DOC-04**: First release is version 0.1.0
- Version set in Cargo.toml
- Tagged as v0.1.0
- Released to all distribution channels

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CI-01 | Phase 1 | Complete |
| CI-02 | Phase 1 | Complete |
| CI-03 | Phase 1 | Complete |
| CI-04 | Phase 1 | Complete |
| NPM-01 | Phase 2 | Complete |
| NPM-02 | Phase 2 | Superseded (single wrapper package used instead) |
| NPM-03 | Phase 2 | Complete |
| NPM-04 | Phase 2 | Complete |
| BREW-01 | Phase 3 | Complete |
| BREW-02 | Phase 3 | Complete |
| DOC-01 | Phase 4 | Complete |
| DOC-02 | Phase 4 | Complete |
| DOC-03 | Phase 4 | Complete |
| DOC-04 | Phase 4 | Complete |

## v2+ Requirements (deferred)

These are explicitly out of scope for v0.1.0:

- Code signing and notarization (macOS/Windows)
- Auto-update mechanism
- yt-dlp bundling as sidecar
- Homebrew core submission
- Contributing/developer guide documentation
- Multi-architecture Linux packages (arm64, rpm, snap, flatpak)

---
*Last updated: 2026-01-23*
