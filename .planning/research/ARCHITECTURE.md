# Architecture: Distribution Infrastructure

**Project:** JoseTunes (Tauri v1 desktop app)
**Researched:** 2026-01-23
**Confidence:** HIGH (patterns verified against official docs and real-world implementations)

## Executive Summary

JoseTunes needs three distribution channels: npm packages (esbuild-style platform packages), Homebrew tap (macOS cask), and automated GitHub Releases (all platforms). The CI pipeline flows from git tag push through parallel platform builds, then fans in to publish artifacts across all channels.

**Key architectural constraint:** Unlike esbuild (a CLI binary), JoseTunes is a GUI desktop app requiring system WebView. The npm distribution pattern must be adapted -- platform packages contain installers (.dmg, .msi, .deb), not raw executables. A wrapper package provides a cross-platform `install` command rather than a `bin` entry.

---

## Component Architecture

### Overview Diagram

```
Git Tag Push (v1.0.0)
        |
        v
+------------------+
| CI: Build Matrix |  (4 parallel jobs)
|  - macOS arm64   |
|  - macOS x86_64  |
|  - Linux x86_64  |
|  - Windows x64   |
+------------------+
        |
        v (upload-artifact)
+------------------+
| CI: Release Job  |  (needs: build)
|  - Create GH Release
|  - Upload assets
|  - Publish npm packages
|  - Update Homebrew tap
+------------------+
        |
        +---> GitHub Releases (all platforms)
        +---> npm Registry (wrapper + 4 platform packages)
        +---> Homebrew Tap Repo (macOS cask update)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `josetunes` (npm wrapper) | Entry point, resolves platform, provides `install` CLI | Platform packages, npm registry |
| `@josetunes/darwin-arm64` | Contains macOS ARM .dmg installer | Wrapper package |
| `@josetunes/darwin-x64` | Contains macOS Intel .dmg installer | Wrapper package |
| `@josetunes/linux-x64` | Contains Linux .deb + .AppImage | Wrapper package |
| `@josetunes/win32-x64` | Contains Windows .msi installer | Wrapper package |
| `homebrew-josetunes` (tap repo) | Homebrew cask definition | GitHub Releases (asset URLs) |
| CI Workflow (`release.yml`) | Orchestrates build, package, publish | All components |

---

## 1. npm Package Structure

### Wrapper Package: `josetunes`

The main package users install. It declares platform packages as `optionalDependencies` and provides an `install` CLI command that launches the appropriate installer.

```
packages/josetunes/
  package.json
  install.js          # Postinstall: verify platform package exists
  bin/
    josetunes-install # CLI: opens/runs the installer for current platform
  lib/
    resolve-binary.js # Finds the correct platform package
```

**package.json:**
```json
{
  "name": "josetunes",
  "version": "1.0.0",
  "description": "Cross-platform desktop audio downloader",
  "bin": {
    "josetunes-install": "bin/josetunes-install"
  },
  "scripts": {
    "postinstall": "node install.js"
  },
  "optionalDependencies": {
    "@josetunes/darwin-arm64": "1.0.0",
    "@josetunes/darwin-x64": "1.0.0",
    "@josetunes/linux-x64": "1.0.0",
    "@josetunes/win32-x64": "1.0.0"
  }
}
```

**Why `optionalDependencies`:** Package managers (npm, yarn, pnpm, bun) respect the `os` and `cpu` fields in each platform package's `package.json`. Only the matching platform's package is actually installed, saving bandwidth and disk space. The `install.js` postinstall script serves as fallback detection if `optionalDependencies` resolution fails.

### Platform Packages: `@josetunes/<platform>-<arch>`

Each contains the built installer for one platform/architecture combination.

```
packages/darwin-arm64/
  package.json
  installer/
    josetunes_<version>_aarch64.dmg
```

**Platform package.json (example: darwin-arm64):**
```json
{
  "name": "@josetunes/darwin-arm64",
  "version": "1.0.0",
  "description": "JoseTunes installer for macOS ARM64",
  "os": ["darwin"],
  "cpu": ["arm64"],
  "files": ["installer/"]
}
```

### Platform-to-Package Mapping

| Platform | npm Package Name | `os` | `cpu` | Installer Format |
|----------|-----------------|------|-------|------------------|
| macOS M1+ | `@josetunes/darwin-arm64` | `darwin` | `arm64` | `.dmg` |
| macOS Intel | `@josetunes/darwin-x64` | `darwin` | `x64` | `.dmg` |
| Linux x64 | `@josetunes/linux-x64` | `linux` | `x64` | `.deb` + `.AppImage` |
| Windows x64 | `@josetunes/win32-x64` | `win32` | `x64` | `.msi` |

### Tauri Artifact Naming Convention

Tauri v1 outputs artifacts with this pattern (based on `productName` and `version` in `tauri.conf.json`):

| Platform | Tauri Output Path | Filename Pattern |
|----------|-------------------|------------------|
| macOS arm64 | `target/aarch64-apple-darwin/release/bundle/dmg/` | `josetunes_<ver>_aarch64.dmg` |
| macOS x64 | `target/x86_64-apple-darwin/release/bundle/dmg/` | `josetunes_<ver>_x64.dmg` |
| Linux x64 | `target/release/bundle/deb/` | `josetunes_<ver>_amd64.deb` |
| Linux x64 | `target/release/bundle/appimage/` | `josetunes_<ver>_amd64.AppImage` |
| Windows x64 | `target/release/bundle/msi/` | `josetunes_<ver>_x64_en-US.msi` |

### install.js Logic (Wrapper Postinstall)

```javascript
// Simplified logic:
// 1. Detect current platform/arch
// 2. Try to require.resolve the matching @josetunes/* package
// 3. If found: log success, binary is available
// 4. If not found: warn user (optionalDependencies may have been skipped)
//    Provide manual download URL from GitHub Releases as fallback
```

### bin/josetunes-install Logic

```javascript
// 1. Resolve platform package location
// 2. Find installer file in installer/ directory
// 3. Platform-specific open:
//    - macOS: `open <file>.dmg`
//    - Linux: `sudo dpkg -i <file>.deb` or launch AppImage
//    - Windows: `start <file>.msi`
```

### Version Synchronization

All 5 packages (wrapper + 4 platform) MUST have identical versions. Use a single `version.txt` file at the monorepo root (esbuild pattern) or derive from `tauri.conf.json`'s `package.version`.

**Recommended:** Derive version from `src-tauri/tauri.conf.json` as the source of truth. The CI pipeline reads this version and stamps all npm packages with it before publishing.

---

## 2. Homebrew Tap Repository

### Repository: `homebrew-josetunes`

A separate GitHub repository following Homebrew naming conventions. Users install with:

```bash
brew install crativo/josetunes/josetunes
# or
brew tap crativo/josetunes
brew install josetunes
```

### Repository Structure

```
homebrew-josetunes/
  Casks/
    josetunes.rb        # Cask definition
  .github/
    workflows/
      update-cask.yml   # Triggered by main repo's release
  README.md
```

### Cask Definition: `Casks/josetunes.rb`

```ruby
cask "josetunes" do
  arch arm: "aarch64", intel: "x64"

  version "1.0.0"
  sha256 arm:   "<sha256-of-arm64-dmg>",
         intel: "<sha256-of-x64-dmg>"

  url "https://github.com/crativo/josetunes/releases/download/v#{version}/josetunes_#{version}_#{arch}.dmg",
      verified: "github.com/crativo/josetunes/"

  name "JoseTunes"
  desc "Cross-platform desktop audio downloader"
  homepage "https://github.com/crativo/josetunes"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "josetunes.app"

  zap trash: [
    "~/Library/Application Support/com.crativo.tunerip",
    "~/Library/Caches/com.crativo.tunerip",
    "~/Library/Preferences/com.crativo.tunerip.plist",
  ]
end
```

### Key Cask Details

- **Architecture handling:** The `arch arm: "aarch64", intel: "x64"` stanza maps to the Tauri naming convention for the DMG files.
- **SHA256 per arch:** Separate checksums for ARM and Intel builds, computed during CI.
- **Livecheck:** `strategy :github_latest` allows Homebrew to auto-detect new versions from GitHub Releases.
- **Zap stanza:** Cleans up app data on uninstall (uses Tauri bundle identifier `com.crativo.tunerip`).
- **Codesigning note (2025+):** As of Homebrew 5.0.0, casks without codesigning are deprecated. JoseTunes should be codesigned with an Apple Developer certificate for long-term Homebrew compatibility. This is non-blocking initially but becomes required by September 2026.

### Updating the Cask on Release

Two approaches:

**Option A (Recommended): Repository Dispatch from main repo CI**
The main repo's release workflow dispatches to `homebrew-josetunes` with version + SHA256 values. The tap repo's workflow updates the cask file.

**Option B: Cron-based livecheck**
Rely on `brew livecheck` and community/bot PRs to update. Less reliable for custom taps.

---

## 3. CI Pipeline: Tag to Release

### Current State vs. Target State

| Aspect | Current | Target |
|--------|---------|--------|
| Trigger | Push to `release` branch | Push tag `v*` |
| Release creation | `tauri-action` (per-matrix-job) | Dedicated release job (fan-in) |
| npm publish | None | Automated in release job |
| Homebrew update | None | Repository dispatch in release job |
| Artifact naming | Tauri defaults | Tauri defaults + npm packaging |

### Target Workflow: `release.yml`

```yaml
name: Release
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  # ============================================================
  # STAGE 1: Build (parallel matrix)
  # ============================================================
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
            npm_pkg: darwin-arm64
          - platform: macos-latest
            target: x86_64-apple-darwin
            npm_pkg: darwin-x64
          - platform: ubuntu-22.04
            target: ""
            npm_pkg: linux-x64
          - platform: windows-latest
            target: ""
            npm_pkg: win32-x64
    runs-on: ${{ matrix.platform }}
    steps:
      - checkout
      - setup-node (lts/*)
      - setup-rust (stable + targets)
      - install system deps (ubuntu: webkit, etc.)
      - install frontend deps (bun install)
      - run: bun run tauri build ${{ matrix.target && format('--target {0}', matrix.target) }}
      - upload-artifact:
          name: build-${{ matrix.npm_pkg }}
          path: src-tauri/target/**/release/bundle/**/*

  # ============================================================
  # STAGE 2: Package npm + Create Release (sequential after build)
  # ============================================================
  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write   # For npm OIDC trusted publishing
    steps:
      # --- Download all build artifacts ---
      - download-artifact (all 4 builds)

      # --- Extract version from tag ---
      - extract version from ${{ github.ref_name }} (strip 'v' prefix)

      # --- Create GitHub Release ---
      - softprops/action-gh-release:
          tag_name: ${{ github.ref_name }}
          name: "JoseTunes ${{ github.ref_name }}"
          generate_release_notes: true
          files: |
            **/*.dmg
            **/*.msi
            **/*.deb
            **/*.AppImage

      # --- Package npm platform packages ---
      - for each platform:
          - stamp version in platform package.json
          - copy installer into platform package directory
          - npm publish @josetunes/<platform>

      # --- Publish wrapper package ---
      - stamp version + optionalDependencies versions in wrapper package.json
      - npm publish josetunes

      # --- Update Homebrew tap ---
      - compute SHA256 for both .dmg files
      - repository-dispatch to homebrew-josetunes with:
          version, sha256_arm, sha256_intel

  # ============================================================
  # STAGE 3: Update Homebrew Tap (triggered by dispatch)
  # ============================================================
  # (Lives in homebrew-josetunes repo, not here)
```

### Pipeline Stage Details

#### Stage 1: Build

**Inputs:** Git tag (version source), source code
**Outputs:** Platform-specific Tauri bundles as GitHub Actions artifacts
**Duration:** ~10-15 minutes (parallel across 4 runners)
**Key considerations:**
- macOS builds need both targets on the same `macos-latest` runner (ARM native, x86_64 cross-compiled)
- Ubuntu needs webkit/GTK dev packages
- Windows needs no special setup (WebView2 bootstrapped by installer)

#### Stage 2: Release + Publish

**Inputs:** Downloaded artifacts from Stage 1, version from git tag
**Outputs:** GitHub Release with assets, published npm packages
**Duration:** ~3-5 minutes
**Key considerations:**
- Must wait for ALL build jobs to complete (fan-in)
- npm publish uses OIDC trusted publishing (no long-lived tokens)
- Version derived from git tag, stamped into all package.json files
- SHA256 computed from actual built .dmg files for Homebrew

#### Stage 3: Homebrew Update (separate repo)

**Inputs:** Repository dispatch event with version + SHA256 values
**Outputs:** Updated `Casks/josetunes.rb` committed to tap repo
**Duration:** ~1 minute
**Trigger:** `repository_dispatch` event from main repo

---

## 4. Monorepo Layout for npm Packages

The npm package sources live alongside the Tauri app in the main repo:

```
josetunes/
  src/                      # Frontend (Solid.js)
  src-tauri/                # Backend (Rust)
  packages/                 # npm distribution packages
    josetunes/              # Wrapper package
      package.json
      install.js
      bin/
        josetunes-install
      lib/
        resolve-binary.js
    darwin-arm64/           # Platform: macOS ARM
      package.json
    darwin-x64/             # Platform: macOS Intel
      package.json
    linux-x64/              # Platform: Linux
      package.json
    win32-x64/              # Platform: Windows
      package.json
  scripts/                  # CI helper scripts
    stamp-version.js        # Reads version, stamps all package.json files
    package-platform.sh     # Copies built artifacts into platform packages
    compute-checksums.sh    # SHA256 for Homebrew cask
  .github/
    workflows/
      release.yml           # Tag-triggered release pipeline
```

**Note:** Platform package directories contain only `package.json` in source. The actual installer files (.dmg, .msi, .deb) are copied in during CI, just before `npm publish`.

---

## 5. Data Flow: Tag to All Channels

```
Developer pushes tag v1.2.3
        |
        v
[CI: extract version "1.2.3" from tag]
        |
        v
[CI: Build Matrix - 4 parallel jobs]
  |           |           |            |
  v           v           v            v
macOS ARM   macOS x64   Linux x64   Windows x64
  |           |           |            |
  v           v           v            v
.dmg        .dmg        .deb/.AI     .msi
  |           |           |            |
  +-----+-----+-----+-----+
        |
        v (upload-artifact)
[CI: Release Job]
        |
        +---> GitHub Release
        |       - All .dmg, .msi, .deb, .AppImage as assets
        |
        +---> npm Registry
        |       - @josetunes/darwin-arm64@1.2.3 (contains .dmg)
        |       - @josetunes/darwin-x64@1.2.3 (contains .dmg)
        |       - @josetunes/linux-x64@1.2.3 (contains .deb)
        |       - @josetunes/win32-x64@1.2.3 (contains .msi)
        |       - josetunes@1.2.3 (wrapper)
        |
        +---> Repository Dispatch to homebrew-josetunes
                - version: "1.2.3"
                - sha256_arm: "<computed>"
                - sha256_intel: "<computed>"
                      |
                      v
              [Homebrew Tap: update cask, commit, push]
```

---

## 6. Build Order and Dependencies

### What Depends on What

| Step | Depends On | Blocks |
|------|-----------|--------|
| Build (all 4 platforms) | Source code, tag push | Release job |
| GitHub Release creation | All 4 builds complete | Homebrew update (needs asset URLs) |
| npm platform publish | Build artifacts downloaded | Wrapper publish |
| npm wrapper publish | All platform packages published | Nothing |
| Homebrew tap update | SHA256 from built DMGs | Nothing |

### Suggested Implementation Order (Phases)

1. **Phase 1: Tag-triggered GitHub Releases**
   - Convert current branch-push trigger to tag-push trigger
   - Restructure into build matrix + release fan-in job
   - Use `softprops/action-gh-release` instead of tauri-action's release creation
   - **Why first:** Foundation that other channels depend on

2. **Phase 2: npm Package Infrastructure**
   - Create `packages/` directory structure
   - Write wrapper package (install.js, bin/josetunes-install, resolve-binary.js)
   - Write platform package.json files with os/cpu fields
   - Write `scripts/stamp-version.js` and `scripts/package-platform.sh`
   - Add npm publish steps to release job
   - **Why second:** Most complex component, needs build artifacts from Phase 1

3. **Phase 3: Homebrew Tap**
   - Create `homebrew-josetunes` repository
   - Write cask definition with arch-specific URLs/checksums
   - Write tap repo's `update-cask.yml` workflow
   - Add repository dispatch step to main repo's release job
   - **Why third:** Simplest component, depends on GitHub Release URLs from Phase 1

---

## 7. Anti-Patterns to Avoid

### Anti-Pattern: Raw Binary Distribution for GUI Apps

**What:** Distributing the Tauri executable directly (from `target/release/`) without the installer.
**Why bad:** On Windows, this skips WebView2 bootstrapping. On macOS, loses .app bundle structure. On Linux, loses desktop integration.
**Instead:** Always distribute the proper installer format (.dmg, .msi, .deb/.AppImage).

### Anti-Pattern: Per-Job Release Creation

**What:** Each matrix job creates/updates the GitHub Release independently (current tauri-action behavior).
**Why bad:** Race conditions, partial releases if one job fails, can't atomically publish npm packages.
**Instead:** Fan-in to a single release job that runs after all builds complete.

### Anti-Pattern: Hardcoded Versions in Platform Packages

**What:** Manually updating version in each platform package.json.
**Why bad:** Version drift, forgotten updates, publish failures.
**Instead:** Single version source (tauri.conf.json or git tag), stamped by CI script.

### Anti-Pattern: Long-Lived npm Tokens

**What:** Storing npm publish tokens as repository secrets.
**Why bad:** Tokens can leak, have broad scope, don't expire.
**Instead:** Use npm OIDC trusted publishing (available since July 2025). Configure the package on npmjs.com to trust your specific workflow file.

### Anti-Pattern: Unversioned Homebrew Cask

**What:** Using `version :latest` with `sha256 :no_check` in the cask.
**Why bad:** No integrity verification, users can't pin versions, breaks `brew audit`.
**Instead:** Explicit version + per-arch SHA256 checksums, updated by CI on each release.

---

## 8. Scalability and Future Considerations

| Concern | Current (v1) | Future |
|---------|-------------|--------|
| New platform (Linux ARM) | Add matrix entry + new platform package | Extend npm scope |
| Code signing (macOS) | Optional now | Required for Homebrew by Sept 2026 |
| Windows code signing | Not needed for npm | Needed for SmartScreen bypass |
| Auto-update (Tauri updater) | Not configured | Can use GitHub Release assets as endpoint |
| Universal macOS binary | Two separate DMGs | Could merge with `lipo` for single package |
| npm package size | ~10-50MB per platform | Consider download-on-demand for large installers |

---

## Sources

- [esbuild Platform-Specific Binaries (DeepWiki)](https://deepwiki.com/evanw/esbuild/6.2-platform-specific-binaries)
- [Publishing Binaries on npm (Sentry Engineering)](https://sentry.engineering/blog/publishing-binaries-on-npm)
- [npm package.json os/cpu fields (npm Docs)](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [How to Create and Maintain a Tap (Homebrew Docs)](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
- [Cask Cookbook (Homebrew Docs)](https://docs.brew.sh/Cask-Cookbook)
- [Homebrew 5.0.0 Release Notes](https://brew.sh/2025/11/12/homebrew-5.0.0/)
- [tauri-action (GitHub)](https://github.com/tauri-apps/tauri-action)
- [Tauri v1 Building Guide](https://v1.tauri.app/v1/guides/building/)
- [Tauri Standalone Binary Discussion](https://github.com/tauri-apps/tauri/discussions/3048)
- [npm Trusted Publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/)
- [softprops/action-gh-release](https://github.com/marketplace/actions/upload-files-to-a-github-release)
- [Multi-Platform Releases with GitHub Actions](https://www.lucavall.in/blog/how-to-create-a-release-with-multiple-artifacts-from-a-github-actions-workflow-using-the-matrix-strategy)
