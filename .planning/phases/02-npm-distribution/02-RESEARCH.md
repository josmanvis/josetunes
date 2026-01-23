# Phase 2: npm Distribution - Research

**Researched:** 2026-01-23
**Domain:** npm package distribution, platform-specific binary packages, CLI installer scripts
**Confidence:** HIGH

## Summary

This research addresses the specific gaps identified in general research: how `npx` execution works with platform-specific packages, how to launch installers per platform from Node.js, the npm OIDC Trusted Publisher configuration flow, and the correct package structure for distributing Tauri GUI app installers.

The key architectural insight: JoseTunes is a GUI app, not a CLI tool. Unlike esbuild (which puts executables in platform packages and runs them via bin entry), JoseTunes must distribute installers (.dmg, .msi, .deb) and provide a CLI that **downloads and launches** them. Platform packages should NOT contain the actual installer files (they are 2-10MB each) -- instead, the wrapper's bin script should download from GitHub Releases at runtime. This keeps npm packages small and avoids bundling large binaries.

**Primary recommendation:** Create a wrapper package `josetunes` with a `bin` entry that, when run via `npx josetunes`, detects the platform, downloads the correct installer from GitHub Releases, and opens/launches it with platform-appropriate commands.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | Built-in | Launch installers per platform | No external dependency needed for spawn/exec |
| Node.js `https` | Built-in | Download installers from GitHub Releases | Zero-dependency HTTP client |
| Node.js `os` | Built-in | Platform/arch detection | `process.platform` + `process.arch` |
| Node.js `fs` | Built-in | Write downloaded installer to temp dir | Standard file operations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sudo-prompt` | latest | Linux .deb install with privilege escalation | Only if providing auto-install on Linux (optional) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Download at runtime | Bundle in platform packages | Packages become 5-10MB each; npm install slow; hits npm size concerns |
| `child_process.exec` | `open` npm package | Adds dependency for trivial `open` command on macOS |
| `sudo-prompt` | Print instructions to user | Simpler, no dependency, user handles sudo themselves |

**Installation:** No npm dependencies needed for the wrapper package itself. It uses only Node.js built-ins.

## Architecture Patterns

### Recommended Package Structure (in repo)

```
packages/
  josetunes/                    # Wrapper package (published as "josetunes")
    package.json
    bin/
      josetunes.js              # CLI entry point (bin entry)
    lib/
      platform.js               # Platform detection + asset URL resolution
      download.js               # GitHub Release asset downloader
      install.js                # Platform-specific installer launch logic
```

NOTE: No separate platform packages with os/cpu fields. The "download from GitHub Releases" approach eliminates the need for 4 additional npm packages entirely.

### Revised Architecture Decision: Single Package vs Platform Packages

After deep research, the esbuild pattern (optionalDependencies + platform packages) is designed for **CLI tools with small binaries** (~10MB executables). JoseTunes distributes GUI **installers** (.dmg, .msi, .deb) that are 2-10MB each. Two viable approaches:

**Option A: Single wrapper package (RECOMMENDED)**
- One npm package: `josetunes`
- `npx josetunes` downloads the correct installer from GitHub Releases at runtime
- Pros: Simpler publishing (1 package, not 5), no org/scope needed, smaller npm footprint
- Cons: Requires network at runtime, slightly slower first run

**Option B: Platform packages (original plan)**
- 5 npm packages: `josetunes` + `@josetunes/darwin-arm64` etc.
- Platform packages contain actual installer files
- Pros: Works offline after install
- Cons: 5 packages to publish/maintain, npm org required, 5-10MB per platform package, complex CI

**Recommendation: Option A.** The installer is a one-time use artifact. Users run `npx josetunes` once to install the desktop app, then never use the npm package again. Downloading at runtime is acceptable for this use case. It also matches the "provide install instructions" requirement better -- the CLI can show progress, verify checksums, and provide clear feedback.

However, if the requirement "NPM-02: npm package structure follows platform-specific pattern" is a hard constraint, Option B with the 4 platform packages is viable. The platform packages would contain the installer files bundled during CI.

### Pattern 1: npx Execution Flow

**What:** When user runs `npx josetunes`, npm temporarily installs the `josetunes` package to its cache, resolves the `bin` entry, and executes it.

**Execution sequence:**
1. User runs `npx josetunes`
2. npm downloads `josetunes` package to npx cache (`~/.npm/_npx/`)
3. npm resolves `bin.josetunes` field --> `bin/josetunes.js`
4. npm executes `node bin/josetunes.js`
5. Script detects platform via `process.platform` and `process.arch`
6. Script downloads installer from GitHub Releases URL
7. Script launches installer with platform-specific command
8. Script exits

**Key facts about npx:**
- npx DOES run lifecycle scripts (postinstall) for temporarily installed packages
- npx DOES install optionalDependencies (respecting os/cpu fields)
- npx prompts user before installing (suppress with `npx -y josetunes`)
- npx caches packages but cache lifetime is not guaranteed
- bin entry must match package name OR be the only bin entry

### Pattern 2: GitHub Release Asset Download

**What:** Download the correct installer from a known GitHub Release URL at runtime.

**URL pattern (based on existing CI output):**
```
https://github.com/josmanvis/josetunes/releases/download/v{version}/josetunes_{version}_{arch_suffix}.{ext}
```

**Actual artifact names from CI workflow (Tauri v1 output):**
| Platform | Artifact Name Pattern |
|----------|----------------------|
| macOS ARM64 | `josetunes_{ver}_aarch64.dmg` |
| macOS x64 | `josetunes_{ver}_x64.dmg` |
| Linux x64 | `josetunes_{ver}_amd64.deb` |
| Linux x64 | `josetunes_{ver}_amd64.AppImage` |
| Windows x64 | `josetunes_{ver}_x64_en-US.msi` |
| Windows x64 | `josetunes_{ver}_x64-setup.exe` (NSIS) |

**Download implementation:**
```javascript
// Source: Node.js built-in https module
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

function downloadAsset(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      // Handle GitHub redirects (302 to S3)
      if (response.statusCode === 302) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}
```

**Critical: GitHub Releases redirects.** Asset download URLs return 302 redirects to S3. The download code MUST follow redirects (at least one level).

### Pattern 3: Platform-Specific Installer Launch

**What:** After downloading, launch the installer using platform-appropriate commands.

```javascript
const { execSync, spawn } = require('child_process');

function launchInstaller(filePath, platform) {
  switch (platform) {
    case 'darwin':
      // Opens DMG in Finder - user drags to Applications
      execSync(`open "${filePath}"`);
      console.log('\nDMG opened! Drag JoseTunes to your Applications folder.');
      break;

    case 'win32':
      // Launch MSI installer (non-blocking, shows GUI)
      spawn('msiexec', ['/i', filePath], { detached: true, stdio: 'ignore' });
      console.log('\nInstaller launched! Follow the installation wizard.');
      break;

    case 'linux':
      // Print instructions - don't auto-sudo
      console.log(`\nTo install, run:`);
      console.log(`  sudo dpkg -i "${filePath}"`);
      console.log(`\nOr for AppImage:`);
      console.log(`  chmod +x "${filePath}" && ./"${path.basename(filePath)}"`);
      break;
  }
}
```

### Anti-Patterns to Avoid

- **Running `sudo` from npm script:** Never auto-escalate privileges from an npm package. Print instructions instead.
- **Blocking the terminal on Windows:** Use `spawn` with `detached: true` for .msi, not `execSync`.
- **Hardcoding version in download URL:** Read version from package.json at runtime.
- **Skipping redirect handling:** GitHub Release asset URLs always 302 redirect.
- **Not cleaning up temp files:** Download to `os.tmpdir()`, provide cleanup instructions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP redirects | Custom redirect handler | Follow 302 with `https.get` on `response.headers.location` | GitHub always redirects; simple one-level follow is sufficient |
| Platform detection | Custom OS parsing | `process.platform` + `process.arch` | Exact values npm uses for os/cpu fields |
| Temp directory | Custom path logic | `os.tmpdir()` | Cross-platform, always writable |
| File permissions (Linux) | Manual chmod | `fs.chmodSync(path, 0o755)` | For AppImage executable bit |
| Progress display | Custom progress bar | Simple `process.stdout.write` with `\r` | No dependency needed for basic progress |

**Key insight:** The entire CLI can be written with zero npm dependencies using only Node.js built-ins (https, fs, os, path, child_process). This is ideal for an npx-distributed package -- fewer dependencies means faster install.

## Common Pitfalls

### Pitfall 1: NODE_AUTH_TOKEN Blocks OIDC

**What goes wrong:** Setting `NODE_AUTH_TOKEN` (even as empty string) prevents npm from using OIDC trusted publishing.
**Why it happens:** npm CLI checks for NODE_AUTH_TOKEN first. If set (even to `""`), it uses that instead of OIDC.
**How to avoid:** Do NOT set NODE_AUTH_TOKEN in the publish workflow. Remove any `env: NODE_AUTH_TOKEN` blocks. OIDC authentication is automatic when `id-token: write` permission is granted.
**Warning signs:** "401 Unauthorized" or "403 Forbidden" during npm publish in CI despite OIDC being configured.

### Pitfall 2: First Publish Requires Manual Step

**What goes wrong:** npm OIDC Trusted Publishers cannot be configured for a package that doesn't exist yet.
**Why it happens:** npm requires the package to exist on the registry before you can configure trusted publishing.
**How to avoid:** Publish a placeholder version (0.0.1) manually from local machine first, then configure OIDC. Use `npx setup-npm-trusted-publish josetunes` to automate this.
**Warning signs:** "404 Not Found" when trying to configure trusted publisher on npmjs.com.

### Pitfall 3: npm CLI Version Too Old for OIDC

**What goes wrong:** OIDC publish fails silently or with cryptic errors.
**Why it happens:** Trusted publishing requires npm CLI >= 11.5.1. GitHub Actions Node 20.x ships with npm 10.x. Node 22.x ships with npm 10.9.4.
**How to avoid:** Use Node.js 24.x in CI (ships with npm 11.6.2+), OR explicitly upgrade npm: `npm install -g npm@latest` after setup-node.
**Warning signs:** npm version < 11.5.1 in CI logs.

### Pitfall 4: GitHub Release Asset 302 Redirect Not Followed

**What goes wrong:** Download gets HTML page instead of binary file.
**Why it happens:** GitHub Release download URLs return 302 redirect to S3/CDN. Node.js `https.get` does NOT auto-follow redirects.
**How to avoid:** Check `response.statusCode === 302`, then make second request to `response.headers.location`.
**Warning signs:** Downloaded file is very small (HTML page) or starts with `<!DOCTYPE`.

### Pitfall 5: Windows MSI Needs Architecture Suffix

**What goes wrong:** Wrong installer downloaded for Windows.
**Why it happens:** Tauri v1 names Windows MSI as `josetunes_0.1.0_x64_en-US.msi` (includes locale suffix). The NSIS exe is `josetunes_0.1.0_x64-setup.exe`.
**How to avoid:** Use exact naming pattern from CI output. Prefer NSIS .exe over .msi for per-user install (no admin rights needed).
**Warning signs:** 404 when downloading Windows installer.

### Pitfall 6: Scoped Packages Need Organization

**What goes wrong:** Cannot publish `@josetunes/darwin-arm64` without an npm org.
**Why it happens:** Scoped packages require an npm organization to be created first on npmjs.com.
**How to avoid (if using Option B):** Create `josetunes` organization on npmjs.com before first publish. All scoped packages need `--access public` on first publish.
**Warning signs:** "403 Forbidden" or "You need to pay for private packages" on publish.

### Pitfall 7: npx Prompts for Install Confirmation

**What goes wrong:** User runs `npx josetunes` and gets an interactive prompt asking "Need to install the following packages: josetunes. Ok to proceed? (y)"
**Why it happens:** npm security feature to prevent typosquatting. Cannot be suppressed from package side.
**How to avoid:** Document that users should run `npx -y josetunes` for non-interactive use, or `npx josetunes` and confirm with `y`. This is expected behavior, not a bug.
**Warning signs:** Users confused by the prompt (document it in README).

## Code Examples

### Complete bin/josetunes.js (CLI Entry Point)

```javascript
#!/usr/bin/env node
// Source: Node.js built-in modules only
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const VERSION = require('../package.json').version;
const GITHUB_REPO = 'josmanvis/josetunes';

// Map Node.js platform/arch to Tauri artifact names
const PLATFORM_MAP = {
  'darwin-arm64': { file: `josetunes_${VERSION}_aarch64.dmg`, label: 'macOS (Apple Silicon)' },
  'darwin-x64':  { file: `josetunes_${VERSION}_x64.dmg`, label: 'macOS (Intel)' },
  'linux-x64':   { file: `josetunes_${VERSION}_amd64.deb`, label: 'Linux (Debian/Ubuntu)' },
  'win32-x64':   { file: `josetunes_${VERSION}_x64-setup.exe`, label: 'Windows' },
};

const platformKey = `${process.platform}-${process.arch}`;
const platform = PLATFORM_MAP[platformKey];

if (!platform) {
  console.error(`\n  Unsupported platform: ${platformKey}`);
  console.error(`  Supported: ${Object.keys(PLATFORM_MAP).join(', ')}`);
  console.error(`\n  Download manually: https://github.com/${GITHUB_REPO}/releases/tag/v${VERSION}\n`);
  process.exit(1);
}

const assetUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${platform.file}`;
const destPath = path.join(os.tmpdir(), platform.file);

console.log(`\n  JoseTunes v${VERSION} Installer`);
console.log(`  Platform: ${platform.label}\n`);

// Download with redirect following
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'josetunes-npm' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect (GitHub -> S3)
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }
      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;
      const file = fs.createWriteStream(dest);
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes) {
          const pct = Math.round((downloadedBytes / totalBytes) * 100);
          process.stdout.write(`\r  Downloading... ${pct}%`);
        }
      });
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\r  Download complete!     ');
        resolve();
      });
    });
    request.on('error', reject);
  });
}

async function main() {
  try {
    console.log(`  Downloading from GitHub Releases...`);
    await download(assetUrl, destPath);

    console.log(`  Saved to: ${destPath}\n`);

    switch (process.platform) {
      case 'darwin':
        execSync(`open "${destPath}"`);
        console.log('  DMG opened! Drag JoseTunes to your Applications folder.');
        console.log('  After installing, you can delete the DMG from your temp folder.\n');
        break;

      case 'win32':
        // Use NSIS exe (per-user, no admin needed)
        spawn(destPath, [], { detached: true, stdio: 'ignore' }).unref();
        console.log('  Installer launched! Follow the installation wizard.');
        console.log('  This terminal can be closed.\n');
        break;

      case 'linux':
        console.log('  To install the .deb package, run:\n');
        console.log(`    sudo dpkg -i "${destPath}"\n`);
        console.log('  If you encounter dependency issues:\n');
        console.log('    sudo apt-get install -f\n');
        break;
    }
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    console.error(`\n  Download manually: https://github.com/${GITHUB_REPO}/releases/tag/v${VERSION}\n`);
    process.exit(1);
  }
}

main();
```

### Wrapper package.json

```json
{
  "name": "josetunes",
  "version": "0.1.0",
  "description": "Cross-platform desktop audio downloader - installer",
  "bin": {
    "josetunes": "bin/josetunes.js"
  },
  "files": [
    "bin/",
    "lib/",
    "package.json"
  ],
  "keywords": ["audio", "downloader", "youtube", "soundcloud", "desktop"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/josmanvis/josetunes.git"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### CI Workflow: npm Publish Job (OIDC)

```yaml
  publish-npm:
    needs: release
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for OIDC trusted publishing
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24.x'  # Ships with npm 11.6.2+ (OIDC support)
          registry-url: 'https://registry.npmjs.org'

      - name: Stamp version from tag
        run: |
          VERSION=${GITHUB_REF_NAME#v}
          cd packages/josetunes
          npm version $VERSION --no-git-tag-version --allow-same-version

      - name: Publish to npm
        run: |
          cd packages/josetunes
          npm publish --access public
        # NO NODE_AUTH_TOKEN - OIDC handles auth automatically
```

### If Using Option B (Platform Packages): Platform package.json Example

```json
{
  "name": "@josetunes/darwin-arm64",
  "version": "0.1.0",
  "description": "JoseTunes macOS ARM64 installer",
  "os": ["darwin"],
  "cpu": ["arm64"],
  "files": ["installer/"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/josmanvis/josetunes.git"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm Classic Tokens | OIDC Trusted Publishers | Dec 2025 (tokens revoked) | MUST use OIDC; no token fallback |
| `NODE_AUTH_TOKEN` in CI | No token needed | July 2025 (OIDC GA) | Remove all TOKEN env vars |
| npm 10.x | npm 11.5.1+ required | July 2025 | Use Node 24.x in CI |
| `setup-node@v4` | `setup-node@v4` (still current) | Still v4 | Works fine, just set registry-url |
| Bundled binaries in npm | Download from GitHub Releases | Growing trend 2024-2025 | Smaller packages, faster installs |

**Deprecated/outdated:**
- npm Classic Tokens: Permanently revoked Dec 9, 2025. Cannot create or use them.
- `--provenance` flag: Redundant with OIDC (provenance auto-generated).
- Node 20.x for npm publish in CI: npm version too old for OIDC.

## npm OIDC Trusted Publisher: Step-by-Step Setup

This section documents the exact setup flow since it was flagged as a gap.

### Prerequisites
1. npm account (npmjs.com)
2. Package must already exist on npm (even as placeholder v0.0.1)
3. GitHub Actions workflow file committed to repository
4. npm CLI >= 11.5.1 (Node 24.x in CI)

### Step 1: Initial Manual Publish (one-time)

```bash
# From local machine, authenticated to npm
cd packages/josetunes
npm publish --access public
# This publishes v0.0.1 as placeholder
```

Or use the automation tool:
```bash
npx setup-npm-trusted-publish josetunes
# Creates placeholder and provides npmjs.com access URL
```

### Step 2: Configure on npmjs.com

1. Go to https://www.npmjs.com/package/josetunes/access
2. Under "Trusted Publisher", click "GitHub Actions"
3. Fill in:
   - **Organization/username:** `josmanvis`
   - **Repository:** `josetunes`
   - **Workflow filename:** `main.yml` (must match exactly, including extension)
   - **Environment:** (leave empty unless using GitHub Environments)
4. Save configuration

### Step 3: Workflow Configuration

```yaml
jobs:
  publish-npm:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # This is the critical permission
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24.x'
          registry-url: 'https://registry.npmjs.org'
      - run: npm publish --access public
        working-directory: packages/josetunes
        # NO env.NODE_AUTH_TOKEN - OIDC is automatic
```

### Step 4: Verify

- Push a tag, confirm publish succeeds
- Check package on npmjs.com shows provenance badge
- Verify no `NODE_AUTH_TOKEN` appears anywhere in workflow

### Gotchas
- If workflow filename changes, update npmjs.com config
- If using reusable workflows, specify the CALLER workflow (not the reusable one)
- Empty `NODE_AUTH_TOKEN: ""` breaks OIDC -- must be completely absent
- Self-hosted runners NOT supported (GitHub-hosted only)
- Provenance only works for public repos publishing public packages

## Platform-Specific Installer Behavior

### macOS (.dmg)

```bash
open /path/to/josetunes_0.1.0_aarch64.dmg
```
- Opens Finder window showing the DMG contents
- User sees the .app and an Applications folder shortcut
- User drags .app to Applications
- DMG can be ejected and deleted after

**No privilege escalation needed.** The `open` command is non-blocking and returns immediately.

### Windows (.exe NSIS installer)

```javascript
spawn(installerPath, [], { detached: true, stdio: 'ignore' }).unref();
```
- NSIS installer shows a GUI wizard
- Per-user install by default (no UAC prompt needed)
- Non-blocking: script exits, installer continues

**MSI alternative (requires admin):**
```bash
msiexec /i "josetunes_0.1.0_x64_en-US.msi" /passive /norestart
```
- `/passive`: Shows progress bar, no prompts
- `/quiet` or `/qn`: Completely silent (no UI)
- `/norestart`: Don't restart after install
- Triggers UAC prompt (system-wide install)

**Recommendation:** Use NSIS `.exe` over `.msi` for npm distribution. Per-user install matches developer expectations and avoids UAC.

### Linux (.deb)

```
sudo dpkg -i /path/to/josetunes_0.1.0_amd64.deb
sudo apt-get install -f  # Fix any missing dependencies
```
- Requires `sudo` (root privileges)
- Cannot/should not auto-escalate from npm script
- Print instructions and let user run manually

**AppImage alternative (no install needed):**
```bash
chmod +x josetunes_0.1.0_amd64.AppImage
./josetunes_0.1.0_amd64.AppImage
```
- No root needed
- Just make executable and run
- Good fallback for users without sudo

**Recommendation:** Download .deb by default, print both .deb and AppImage instructions. Let user choose.

## Open Questions

1. **Package name availability**
   - What we know: `josetunes` needs to be available on npmjs.com
   - What's unclear: Is it already taken?
   - Recommendation: Check availability with `npm view josetunes` before planning. If taken, use a scoped package `@josmanvis/josetunes` instead.

2. **NSIS vs MSI for Windows**
   - What we know: The CI builds BOTH .msi and .exe (NSIS). NSIS is per-user (no admin), MSI is system-wide (needs admin).
   - What's unclear: Which does the requirement specify?
   - Recommendation: Use NSIS .exe for npm distribution (better UX, no UAC). Keep .msi available on GitHub Releases for enterprise/admin use.

3. **Checksum verification**
   - What we know: CI generates SHA256SUMS.txt with all checksums in the release
   - What's unclear: Should the npm CLI verify checksum after download?
   - Recommendation: YES. Download SHA256SUMS.txt, verify the downloaded installer. Adds security without external deps (use Node.js `crypto` module).

4. **Option A vs Option B (single package vs platform packages)**
   - What we know: Requirement NPM-02 says "platform-specific pattern (wrapper + 4 platform packages with os/cpu fields)"
   - What's unclear: Is this a hard requirement or a suggestion?
   - Recommendation: If NPM-02 is a hard requirement, implement Option B with platform packages containing installers. If flexible, Option A (single wrapper that downloads) is simpler and more maintainable.

## Sources

### Primary (HIGH confidence)
- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/) - OIDC configuration steps
- [npm npx docs](https://docs.npmjs.com/cli/commands/npx/) - Execution flow, bin resolution
- [npm package.json os/cpu fields](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) - Platform filtering
- [msiexec command-line options](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msiexec) - Silent install flags
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - spawn, exec, execFile
- [esbuild Platform-Specific Binaries (DeepWiki)](https://deepwiki.com/evanw/esbuild/6.2-platform-specific-binaries) - Pattern reference

### Secondary (MEDIUM confidence)
- [Sentry: Publishing Binaries on npm](https://sentry.engineering/blog/publishing-binaries-on-npm) - Dual strategy pattern
- [GitHub Blog: npm OIDC GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) - OIDC availability
- [azu/setup-npm-trusted-publish](https://github.com/azu/setup-npm-trusted-publish) - First publish automation
- [Tauri v1 Windows Installer docs](https://v1.tauri.app/v1/guides/building/windows/) - NSIS vs MSI
- [Tauri v1 macOS Bundle docs](https://v1.tauri.app/v1/guides/building/macos/) - DMG output

### Tertiary (LOW confidence)
- [Orhun: Packaging Rust for npm](https://blog.orhun.dev/packaging-rust-for-npm/) - Community pattern validation
- [npm/cli #4828](https://github.com/npm/cli/issues/4828) - optionalDependencies lockfile bug (known issue)
- [npm/cli #7961](https://github.com/npm/cli/issues/7961) - os/cpu pruning bug (Dec 2024)

## Metadata

**Confidence breakdown:**
- npx execution flow: HIGH - verified with official npm docs
- Installer launch per platform: HIGH - verified with official OS docs
- npm OIDC setup: HIGH - verified with npm official docs + multiple guides
- Package structure recommendation: MEDIUM - architectural decision, both options viable
- GitHub Release download pattern: HIGH - standard HTTPS redirect pattern

**Research date:** 2026-01-23
**Valid until:** 2026-03-23 (60 days - npm OIDC is stable, unlikely to change)
