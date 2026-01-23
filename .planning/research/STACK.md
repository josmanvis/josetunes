# Technology Stack: JoseTunes Distribution

**Project:** JoseTunes (Tauri v1 desktop audio downloader)
**Dimension:** Distribution -- npm, Homebrew, GitHub Releases
**Researched:** 2026-01-23
**Overall Confidence:** HIGH (patterns well-established, verified with official sources)

---

## Executive Summary

Distributing a Tauri v1 desktop binary via three channels requires: (1) GitHub Releases as the canonical artifact store triggered by version tags, (2) npm platform-specific packages using the esbuild `optionalDependencies` pattern, and (3) a Homebrew **Cask** (not Formula) custom tap for macOS `.dmg` distribution. The existing `tauri-apps/tauri-action@v0` already handles building and uploading to GitHub Releases -- it just needs to trigger on tags instead of branch pushes.

---

## Recommended Stack

### GitHub Releases (CI/CD)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `tauri-apps/tauri-action` | `@v0` (currently v0.6.1) | Build Tauri app + create GitHub Release | Already in use; handles cross-platform matrix builds, auto-creates releases, uploads artifacts. Works with both Tauri v1 and v2. | HIGH |
| `actions/checkout` | `@v4` | Checkout code | Standard. Already in use. | HIGH |
| `actions/setup-node` | `@v4` | Node.js for frontend build | Standard. Already in use. | HIGH |
| `dtolnay/rust-toolchain` | `@stable` | Rust compiler | Standard for Tauri. Already in use. | HIGH |

**Key change from current CI:** Switch trigger from `push to release branch` to `push tags: ['v*']`. The tauri-action `tagName` input should use `v__VERSION__` (not `app-v__VERSION__`).

### npm Distribution (Platform-Specific Packages)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| npm `optionalDependencies` | npm >=7 | Platform resolution | The esbuild pattern. Package managers read `os`/`cpu` fields and only install matching packages. No postinstall download needed for primary path. | HIGH |
| npm OIDC Trusted Publishers | npm CLI >=11.5.1 | Tokenless publishing | Classic tokens permanently deprecated Dec 2025. OIDC is the only supported path for CI publishing now. | HIGH |
| `actions/setup-node` | `@v4` | npm registry auth | Configures registry URL for publish. | HIGH |

**Package structure (5 packages total):**

| Package Name | `os` | `cpu` | Binary |
|--------------|------|-------|--------|
| `@josetunes/darwin-arm64` | `["darwin"]` | `["arm64"]` | Tauri `.app` bundle (tar.gz) |
| `@josetunes/darwin-x64` | `["darwin"]` | `["x64"]` | Tauri `.app` bundle (tar.gz) |
| `@josetunes/linux-x64` | `["linux"]` | `["x64"]` | AppImage binary |
| `@josetunes/win32-x64` | `["win32"]` | `["x64"]` | `.exe` installer (NSIS) |
| `josetunes` | (none) | (none) | Wrapper: CLI launcher + `optionalDependencies` |

### Homebrew Distribution (macOS only)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Homebrew **Cask** (not Formula) | N/A | macOS GUI app distribution | Tauri produces `.app` bundles inside `.dmg`. Casks are for GUI apps; Formulas are for CLI tools built from source. | HIGH |
| `Justintime50/homebrew-releaser` | `@v3` | Auto-update cask on release | Watches GitHub Releases, computes SHA256, pushes updated `.rb` to tap repo. | MEDIUM |
| Custom tap repository | N/A | `homebrew-josetunes` | Separate GitHub repo. Naming convention required by Homebrew. | HIGH |

**Alternative to homebrew-releaser:** Manual SHA256 update script in CI. More control but more maintenance. Homebrew-releaser handles the common case well.

---

## Detailed Architecture: npm Platform Packages

### The esbuild Pattern (Verified via Official Source)

This is the industry standard for distributing native binaries via npm. Used by esbuild, SWC, Turbopack, Sentry CLI, and many others.

**How it works:**

1. Main wrapper package (`josetunes`) declares platform packages as `optionalDependencies`
2. Each platform package has `os` and `cpu` fields in its `package.json`
3. `npm install` reads these fields and only downloads the matching platform package
4. Wrapper's `bin/cli.js` resolves and executes the correct binary at runtime

### Main Wrapper Package (`josetunes/package.json`)

```json
{
  "name": "josetunes",
  "version": "0.1.0",
  "description": "Cross-platform desktop audio downloader",
  "bin": {
    "josetunes": "bin/cli.js"
  },
  "scripts": {
    "postinstall": "node install.js"
  },
  "optionalDependencies": {
    "@josetunes/darwin-arm64": "0.1.0",
    "@josetunes/darwin-x64": "0.1.0",
    "@josetunes/linux-x64": "0.1.0",
    "@josetunes/win32-x64": "0.1.0"
  }
}
```

### Platform Package (`@josetunes/darwin-arm64/package.json`)

```json
{
  "name": "@josetunes/darwin-arm64",
  "version": "0.1.0",
  "os": ["darwin"],
  "cpu": ["arm64"],
  "description": "JoseTunes macOS ARM64 binary",
  "files": ["bin/"]
}
```

### Launcher Script (`josetunes/bin/cli.js`)

```javascript
#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const PLATFORMS = {
  'darwin-arm64': '@josetunes/darwin-arm64',
  'darwin-x64': '@josetunes/darwin-x64',
  'linux-x64': '@josetunes/linux-x64',
  'win32-x64': '@josetunes/win32-x64',
};

const platformKey = `${process.platform}-${process.arch}`;
const pkg = PLATFORMS[platformKey];

if (!pkg) {
  console.error(`Unsupported platform: ${platformKey}`);
  process.exit(1);
}

const binaryName = process.platform === 'win32' ? 'josetunes.exe' : 'josetunes';

function getBinaryPath() {
  try {
    return require.resolve(`${pkg}/bin/${binaryName}`);
  } catch (e) {
    // Fallback: binary downloaded by postinstall
    return path.join(__dirname, '..', binaryName);
  }
}

execFileSync(getBinaryPath(), process.argv.slice(2), { stdio: 'inherit' });
```

### Fallback Install Script (`josetunes/install.js`)

```javascript
const fs = require('fs');
const path = require('path');
const https = require('https');

// Only runs if optionalDependencies failed (e.g., --ignore-optional flag)
// Downloads binary from GitHub Release as fallback
const platformKey = `${process.platform}-${process.arch}`;
const binaryName = process.platform === 'win32' ? 'josetunes.exe' : 'josetunes';

function isPlatformPackageInstalled() {
  const PLATFORMS = {
    'darwin-arm64': '@josetunes/darwin-arm64',
    'darwin-x64': '@josetunes/darwin-x64',
    'linux-x64': '@josetunes/linux-x64',
    'win32-x64': '@josetunes/win32-x64',
  };
  try {
    require.resolve(`${PLATFORMS[platformKey]}/bin/${binaryName}`);
    return true;
  } catch (e) {
    return false;
  }
}

if (isPlatformPackageInstalled()) {
  process.exit(0); // Already installed via optionalDependencies
}

// Fallback: download from GitHub Releases
// Implementation downloads the correct binary for the platform
console.log('Platform package not found, downloading from GitHub Releases...');
// ... download logic using https module
```

---

## Detailed Architecture: GitHub Releases Workflow

### Tag-Triggered Workflow (replaces current branch-triggered)

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: npm install

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'JoseTunes v__VERSION__'
          releaseBody: 'See assets below to download for your platform.'
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

### Key Changes from Current Workflow

| Current | Recommended | Why |
|---------|-------------|-----|
| Trigger: `push to release branch` | Trigger: `push tags: ['v*']` | Tags are the standard for versioned releases; enables `npm version` workflow |
| `tagName: app-v__VERSION__` | `tagName: v__VERSION__` | Simpler, matches npm/semver conventions |
| `releaseDraft: true` | `releaseDraft: false` | Drafts block Homebrew (can't download draft assets); use pre-releases instead if needed |
| `yarn install` | `npm install` | Project uses bun for dev, but CI should use npm for reproducibility and npm publish compatibility |

---

## Detailed Architecture: Homebrew Cask

### Tap Repository Structure (`homebrew-josetunes`)

```
homebrew-josetunes/
├── Casks/
│   └── josetunes.rb
└── README.md
```

### Cask File (`Casks/josetunes.rb`)

```ruby
cask "josetunes" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.0"

  on_arm do
    sha256 "ARM64_SHA256_HERE"
  end
  on_intel do
    sha256 "X64_SHA256_HERE"
  end

  url "https://github.com/jose/josetunes/releases/download/v#{version}/josetunes_#{version}_#{arch}.dmg"
  name "JoseTunes"
  desc "Cross-platform desktop audio downloader"
  homepage "https://github.com/jose/josetunes"

  app "josetunes.app"

  zap trash: [
    "~/Library/Preferences/com.crativo.tunerip.plist",
    "~/Library/Application Support/com.crativo.tunerip",
  ]
end
```

### Installation Command

```bash
brew tap jose/josetunes
brew install --cask josetunes
```

---

## npm Publishing Workflow (Separate Job, After Tauri Build)

```yaml
  publish-npm:
    needs: publish-tauri  # Wait for binaries to be uploaded to release
    runs-on: ubuntu-latest
    permissions:
      id-token: write    # Required for OIDC trusted publishing
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          registry-url: 'https://registry.npmjs.org'

      - name: Download release assets
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          # Download each platform binary from the GitHub Release
          # Place into respective platform package directories

      - name: Publish platform packages
        run: |
          for pkg in packages/*/; do
            cd "$pkg"
            npm publish --access public
            cd ../..
          done

      - name: Publish wrapper package
        run: npm publish --access public
        # No NODE_AUTH_TOKEN needed -- OIDC handles auth
```

**Critical:** npm classic tokens were permanently deprecated December 9, 2025. You MUST use OIDC Trusted Publishers for CI publishing. This requires:
1. Configure trusted publisher on npmjs.com (Settings > Trusted Publishers)
2. Specify: GitHub org/user, repository, workflow filename
3. Workflow job needs `permissions: id-token: write`
4. Do NOT set `NODE_AUTH_TOKEN` -- OIDC replaces it

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| GitHub Release action | `tauri-apps/tauri-action@v0` | `softprops/action-gh-release@v2` | tauri-action already builds AND creates release. softprops would require separate build step. |
| npm binary pattern | `optionalDependencies` + `os`/`cpu` | Single package + postinstall download | postinstall-only is fragile (scripts can be disabled, supply chain risk). optionalDependencies is the proven standard. |
| npm auth | OIDC Trusted Publishers | npm Granular Access Tokens | Classic tokens deprecated. OIDC is more secure, no token rotation needed, auto-generates provenance. |
| Homebrew | Custom Cask tap | Custom Formula tap | Tauri produces GUI `.app` bundles -- Cask is the correct Homebrew mechanism for GUI apps. Formula is for CLI tools built from source. |
| Homebrew automation | `Justintime50/homebrew-releaser@v3` | Manual SHA256 script / `dawidd6/action-homebrew-bump-formula` | homebrew-releaser handles the full flow (clone tap, compute checksum, push formula). dawidd6 action is for bumping homebrew-core formulas, not custom taps. |
| Homebrew tap type | Cask (Casks/ directory) | Formula (Formula/ directory) | JoseTunes is a GUI desktop app distributed as .dmg, not a CLI tool. Homebrew explicitly says "GUI-only programs" should use Cask. |

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| npm Classic Tokens | **Permanently deprecated** December 9, 2025. All existing classic tokens revoked. Cannot be created or restored. |
| `softprops/action-gh-release` standalone | Redundant -- `tauri-apps/tauri-action` already creates releases. Would add unnecessary complexity. |
| Homebrew Formula (for macOS app) | Wrong tool. Formulas compile from source or use bottles. Casks install pre-built `.app`/`.dmg` bundles. |
| `brew bump-formula-pr` / `dawidd6/action-homebrew-bump-formula` | For updating formulas in homebrew-core (the official repository). Not for custom taps with casks. |
| Single fat npm package with all binaries | ~50MB+ download for every platform. The esbuild pattern exists precisely to avoid this. |
| `npm publish --provenance` flag | Redundant with OIDC Trusted Publishers (provenance is automatic). Still works but unnecessary. |
| Branch-based release triggers | Tags are the standard. They integrate with `npm version`, create clear version history, and are expected by consumers. |
| Draft releases | Homebrew cask URLs cannot download from draft releases. Drafts block the automation chain. |

---

## Version Synchronization Strategy

All three distribution channels must reference the same version. The recommended flow:

```bash
# Developer bumps version (updates package.json AND tauri.conf.json)
npm version patch  # or minor/major

# This creates a git tag (v0.1.1) and commits the version bump
# Push tag triggers CI:
git push && git push --tags
```

**Important:** Version must be synchronized in TWO files:
- `package.json` (npm)
- `src-tauri/tauri.conf.json` (`package.version` field)

The tauri-action reads version from `tauri.conf.json`. The npm publish reads from `package.json`. These MUST match.

Consider a pre-commit hook or CI check that verifies version parity.

---

## Release Flow (End-to-End)

```
Developer: npm version 0.1.0 && git push --tags
                    |
                    v
GitHub Actions: tag v0.1.0 detected
                    |
          +---------+---------+
          |                   |
    publish-tauri        (waits)
    (matrix build)            |
          |                   |
    Builds for:               |
    - macOS arm64             |
    - macOS x64               |
    - Linux x64               |
    - Windows x64             |
          |                   |
    Creates GitHub Release    |
    Uploads all artifacts     |
          |                   |
          +----->  publish-npm
                   |
                   Downloads artifacts from Release
                   Packages into @josetunes/* dirs
                   Publishes 4 platform packages
                   Publishes 1 wrapper package
                   |
                   +----->  update-homebrew
                            |
                            Updates Casks/josetunes.rb
                            Computes SHA256 from .dmg
                            Pushes to homebrew-josetunes tap
```

---

## Infrastructure Requirements

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| npm account with org scope | Not set up | Create `@josetunes` org on npmjs.com |
| OIDC Trusted Publisher config | Not set up | Configure on npmjs.com after first manual publish |
| `homebrew-josetunes` GitHub repo | Not created | Create public repo with `Casks/` directory |
| GitHub PAT for tap repo | Not created | Create fine-grained token with `contents:write` for tap repo |
| Version sync (package.json + tauri.conf.json) | Versions are 0.0.0 | Bump both to 0.1.0 before first release |
| Code signing (macOS) | Not configured | Optional but recommended; without it users get Gatekeeper warnings |
| Apple notarization | Not configured | Required for unsigned apps to avoid "damaged" error on macOS Sequoia+ |

---

## Sources

- [esbuild Platform-Specific Binaries (DeepWiki)](https://deepwiki.com/evanw/esbuild/6.2-platform-specific-binaries) -- HIGH confidence
- [esbuild package.json (GitHub)](https://github.com/evanw/esbuild/blob/main/npm/esbuild/package.json) -- HIGH confidence
- [Sentry Engineering: Publishing Binaries on npm](https://sentry.engineering/blog/publishing-binaries-on-npm) -- HIGH confidence
- [npm Trusted Publishing with OIDC (GitHub Changelog)](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) -- HIGH confidence
- [tauri-apps/tauri-action (GitHub)](https://github.com/tauri-apps/tauri-action) -- HIGH confidence
- [tauri-apps/tauri-action Releases](https://github.com/tauri-apps/tauri-action/releases) -- HIGH confidence
- [Homebrew: Adding Software](https://docs.brew.sh/Adding-Software-to-Homebrew) -- HIGH confidence
- [Homebrew: How to Create and Maintain a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) -- HIGH confidence
- [Justintime50/homebrew-releaser (GitHub)](https://github.com/Justintime50/homebrew-releaser) -- MEDIUM confidence
- [softprops/action-gh-release (GitHub)](https://github.com/softprops/action-gh-release) -- HIGH confidence (verified but NOT recommended for this project)
- [Tauri v1: macOS Bundle](https://v1.tauri.app/v1/guides/building/macos/) -- HIGH confidence
- [npm package.json os/cpu fields (npm Docs)](https://docs.npmjs.com/cli/v9/configuring-npm/package-json/) -- HIGH confidence
