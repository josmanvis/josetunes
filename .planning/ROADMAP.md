# Roadmap: JoseTunes Distribution

## Overview

JoseTunes is transitioning from a working desktop app to a professionally distributed product. This roadmap takes the existing Tauri v1 application through four phases to establish distribution via GitHub Releases (foundation), npm packages (developer-friendly npx install), Homebrew tap (macOS native), and comprehensive documentation. The approach is dependency-driven: GitHub Releases must exist first since both npm and Homebrew reference release artifacts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: CI/CD Foundation** - Tag-triggered builds producing GitHub Releases
- [ ] **Phase 2: npm Distribution** - Platform-specific packages enabling npx installation
- [ ] **Phase 3: Homebrew Tap** - Custom tap with automated cask updates
- [ ] **Phase 4: Documentation** - README with installation methods and usage guide

## Phase Details

### Phase 1: CI/CD Foundation
**Goal**: Automated builds triggered by version tags produce GitHub Releases with platform installers

**Depends on**: Nothing (first phase)

**Requirements**: CI-01, CI-02, CI-03, CI-04

**Success Criteria** (what must be TRUE):
  1. Developer can push a version tag and CI automatically builds all platforms
  2. GitHub Release is created with .dmg (macOS arm64+x64), .msi (Windows), .deb and .AppImage (Linux) attached
  3. Cargo.toml version matches git tag version (single source of truth)
  4. Checksums are included with all release artifacts

**Plans**: 2 plans

Plans:
- [ ] 01-01: Version synchronization and CI trigger restructure
- [ ] 01-02: Release job fan-in with artifact publishing

### Phase 2: npm Distribution
**Goal**: Users can install JoseTunes via `npx josetunes` with platform-appropriate installer

**Depends on**: Phase 1 (requires GitHub Release artifacts)

**Requirements**: NPM-01, NPM-02, NPM-03, NPM-04

**Success Criteria** (what must be TRUE):
  1. User can run `npx josetunes` and correct platform package is installed
  2. Install command detects platform and opens/runs appropriate installer (open .dmg on macOS, launch .msi on Windows, provide dpkg instructions on Linux)
  3. Installation works with `--no-optional` flag via postinstall fallback
  4. All 5 npm packages published automatically from CI after GitHub Release creation

**Plans**: 3 plans

Plans:
- [ ] 02-01: Create npm package structure with platform-specific packages
- [ ] 02-02: Write install CLI with platform detection and installer launch
- [ ] 02-03: Configure npm OIDC publishing in CI

### Phase 3: Homebrew Tap
**Goal**: macOS users can install via `brew install josetunes/tap/josetunes`

**Depends on**: Phase 1 (requires GitHub Release .dmg files)

**Requirements**: BREW-01, BREW-02

**Success Criteria** (what must be TRUE):
  1. User can run `brew install josetunes/tap/josetunes` on macOS arm64 or x64
  2. Cask installs correct architecture .dmg from GitHub Releases
  3. Cask automatically updates version and SHA256 checksums when new release is published

**Plans**: 2 plans

Plans:
- [ ] 03-01: Create homebrew-josetunes repository with cask definition
- [ ] 03-02: Add automated cask update workflow triggered by releases

### Phase 4: Documentation
**Goal**: Users can discover and understand all installation methods and prerequisites

**Depends on**: Phases 1-3 (documents all distribution channels)

**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04

**Success Criteria** (what must be TRUE):
  1. README shows one-line install commands for npm, Homebrew, and direct download
  2. README explains basic usage workflow (add URL, select format, download)
  3. README clearly states yt-dlp prerequisite with installation instructions per platform
  4. Version 0.1.0 is reflected in all documentation

**Plans**: 1 plan

Plans:
- [ ] 04-01: Write comprehensive README with installation and usage documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CI/CD Foundation | 0/2 | Not started | - |
| 2. npm Distribution | 0/3 | Not started | - |
| 3. Homebrew Tap | 0/2 | Not started | - |
| 4. Documentation | 0/1 | Not started | - |

---
*Last updated: 2026-01-23*
