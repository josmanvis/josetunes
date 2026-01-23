# Feature Landscape: Desktop App Distribution

**Domain:** Native desktop app distribution (Tauri v1, multi-channel: npm/npx, Homebrew, GitHub Releases)
**Researched:** 2026-01-23
**Overall confidence:** MEDIUM-HIGH

## Table Stakes

Features users expect. Missing = product feels incomplete or unprofessional.

### Distribution Channel Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GitHub Releases with platform binaries | Every open-source desktop app provides downloadable binaries on GitHub. Users check Releases first. | Medium | Must include .dmg (macOS), .msi/.exe (Windows), .AppImage + .deb (Linux). CI already builds these; needs tag-triggered release creation. |
| Semantic versioning (0.1.0) | Users and package managers rely on semver for update signaling | Low | Already decided. Tag format: `v0.1.0` |
| npx one-liner install/launch | Developer-audience expects `npx package-name` to "just work" without pre-install steps | High | Requires platform-specific optional deps pattern (esbuild model). JS wrapper detects OS/arch, pulls correct binary. |
| Homebrew tap with `brew install` | macOS power users expect Homebrew for CLI/desktop tools. Single command install. | Medium | Separate `homebrew-tap` repo with Cask formula pointing to GitHub Release .dmg asset. |
| Platform-appropriate installer formats | Users expect native installers, not raw binaries. .dmg for Mac, .msi for Windows, .AppImage for Linux. | Medium | Tauri bundler produces these natively. Ensure all are attached to the Release. |
| Clear prerequisite documentation (yt-dlp) | App has a hard runtime dependency. Users MUST know before installing or they hit a wall. | Low | README must prominently document this with install commands per platform. |

### README / Documentation Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-line install commands per channel | Users scan for copy-pasteable commands. If they have to read paragraphs, they leave. | Low | Three blocks: `npx josetunes`, `brew install ...`, and "Download from Releases" link. |
| Prerequisites section with install commands | yt-dlp dependency is non-obvious. Must show how to install it per platform (brew, pip, winget, etc.) | Low | Platform-tabbed section: macOS (brew install yt-dlp), Windows (winget install yt-dlp), Linux (pip/apt). |
| Platform badges or compatibility table | Users need to know if their OS is supported before investing time | Low | Badges or table: macOS (arm64, x86_64), Windows (x64), Linux (x64). |
| Basic usage section with screenshot/GIF | Desktop apps are visual. A screenshot communicates value faster than text. | Low | One screenshot showing the main UI with a download in progress. |
| Version/release badge | Signals the project is maintained and has actual releases | Low | GitHub Release badge in README header. |

### CI/CD Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tag-triggered automated builds | Pushing a version tag should produce a release without manual steps | Medium | Update existing GitHub Actions workflow: trigger on `v*` tags instead of (or in addition to) `release` branch push. |
| Release assets uploaded automatically | Manual upload is error-prone and blocks releases | Medium | Use `tauri-apps/tauri-action` or equivalent to build + upload to GitHub Release in CI. |
| Checksums for release assets | Security-conscious users verify downloads. Standard practice for binary distribution. | Low | Generate SHA256 checksums file and attach to release. |

## Differentiators

Features that improve install UX but are not expected for a v0.1.0 open-source tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| yt-dlp auto-detection with helpful error | App detects missing yt-dlp at launch and shows a dialog with install instructions instead of silently failing | Medium | Rust-side check: `which yt-dlp` / registry lookup. Frontend shows modal with platform-specific install command. Significantly reduces support burden. |
| Homebrew Cask (not Formula) | Cask installs .app to /Applications like native macOS apps. Formula is for CLI tools. Cask is the correct choice for GUI apps. | Low | Use `cask` DSL in the tap, pointing to .dmg asset URL with version interpolation. |
| npx postinstall fallback | If optionalDependencies fails (--no-optional flag, restricted environments), postinstall script downloads correct binary as backup | Medium | Follows Sentry's combined approach: optionalDeps primary, postinstall fallback. Increases reliability across environments. |
| Animated GIF in README | Shows the full workflow (paste URL, select format, download) in 10 seconds. Much more compelling than static screenshot. | Low | Record with a screen capture tool, optimize to <5MB. |
| Troubleshooting section | Common issues documented upfront: yt-dlp not found, macOS Gatekeeper warning, Windows SmartScreen | Low | FAQ-style section addressing the 3-4 most common first-run issues. |
| macOS Gatekeeper instructions | Unsigned apps show "cannot be verified" dialog. Users need to know to right-click > Open or allow in System Settings. | Low | Document in README and/or Troubleshooting. Critical for unsigned v0.1.0 release. |
| Platform-specific npm packages under scope | `@josetunes/darwin-arm64`, `@josetunes/win32-x64`, etc. Clean namespace. | Medium | Follows esbuild's `@esbuild/` pattern. Requires npm org or scope. |
| Changelog in releases | Users want to know what changed before updating | Low | GitHub Release body with bullet points of changes. Can be auto-generated from commits. |

## Anti-Features

Features to explicitly NOT build for v0.1.0. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-update mechanism | Adds significant complexity (update server, signing keys, Tauri updater config). Overkill for v0.1.0 with very few users. PROJECT.md explicitly excludes this. | Users reinstall via their package manager (`brew upgrade`, `npx josetunes@latest`) or download new release. |
| macOS code signing + notarization | Requires Apple Developer Program ($99/year), certificate management, CI secrets. First-time notarization can take hours. Known bugs with Tauri sidecar + notarization. | Document Gatekeeper workaround in README. Revisit when user base grows. |
| Windows code signing (EV certificate) | Expensive ($200-600/year), complex procurement process. SmartScreen warnings are annoying but not blocking. | Document SmartScreen bypass in README. |
| yt-dlp bundling as sidecar | Increases binary size significantly (yt-dlp is ~40MB). Licensing complications (GPLv3). yt-dlp updates frequently and bundled version goes stale fast. PROJECT.md explicitly excludes this. | Document yt-dlp as prerequisite. Users install via their preferred package manager. |
| Homebrew core submission | Requires review, must meet quality bar, formula maintained by Homebrew team (not you). | Use custom tap for full control. Submit to core only after proven stability. |
| Contributing/developer guide | Scope creep for a distribution milestone. End-user docs are the priority. | Defer to a separate milestone. CLAUDE.md already serves dev needs. |
| App Store distribution (Mac/Windows) | Review process, sandboxing requirements, revenue share. Not appropriate for v0.1.0 of an open-source tool. | GitHub Releases + Homebrew + npm cover the target audience. |
| Multi-architecture Linux packages | .deb for arm64, .rpm, Snap, Flatpak -- each adds CI complexity and testing burden | Ship x64 AppImage + .deb only. AppImage is distro-agnostic. |
| Interactive install wizard | Over-engineering for a developer-audience tool. Copy-paste commands are faster. | One-liner commands in README. |

## Feature Dependencies

```
GitHub Releases (foundation)
  |
  +---> Homebrew Cask formula (references Release .dmg URL)
  |
  +---> npm platform packages (download from Release assets)
  |
  +---> Checksums (generated from Release assets)

CI tag-triggered builds (enables)
  |
  +---> GitHub Releases (CI creates the release)
  |
  +---> Automated asset upload (CI attaches binaries)

README documentation (depends on)
  |
  +---> All channels being functional (can't document what doesn't exist)
  |
  +---> Screenshot/GIF (app must be in a presentable state)
```

Key ordering insight: CI automation must come FIRST because both Homebrew and npm reference GitHub Release asset URLs. You cannot set up downstream channels until releases are being produced.

## MVP Recommendation

For the v0.1.0 distribution milestone, prioritize in this order:

1. **CI tag-triggered builds producing GitHub Releases** - Foundation for everything else
2. **GitHub Releases with all platform installers** - Immediate download path for users
3. **README with install instructions, prerequisites, and screenshot** - Users need to know how to install and what to expect
4. **Homebrew Cask tap** - macOS users' preferred install method, low complexity once releases exist
5. **npm/npx distribution** - Developer-audience install path, highest complexity

Defer to post-v0.1.0:
- Code signing/notarization: Cost and complexity not justified for initial release
- Auto-update: Reinstall workflow is acceptable for early users
- yt-dlp auto-detection dialog: Nice UX but not blocking for distribution
- Changelog automation: Manual release notes are fine initially

## Complexity Budget

| Channel | Setup Effort | Maintenance Effort | User Friction |
|---------|-------------|-------------------|---------------|
| GitHub Releases | Medium (CI config) | Low (tag and push) | Low (download + install) |
| Homebrew Cask | Medium (tap repo + formula) | Low (update URL on release) | Very Low (one command) |
| npm/npx | High (multi-package setup) | Medium (publish on release) | Low (one command, needs Node.js) |

## Sources

- [Tauri v1 Sidecar Documentation](https://v1.tauri.app/v1/guides/building/sidecar/) - HIGH confidence (official docs)
- [Tauri v1 Updater Documentation](https://v1.tauri.app/v1/guides/distribution/updater/) - HIGH confidence (official docs)
- [Tauri v1 macOS Signing Guide](https://v1.tauri.app/v1/guides/distribution/sign-macos/) - HIGH confidence (official docs)
- [esbuild optionalDependencies PR #1621](https://github.com/evanw/esbuild/pull/1621) - HIGH confidence (primary source)
- [Sentry: Publishing Binaries on npm](https://sentry.engineering/blog/publishing-binaries-on-npm) - MEDIUM confidence (engineering blog, verified pattern)
- [Homebrew Tap Documentation](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) - HIGH confidence (official docs)
- [Homebrew Cask Documentation](https://formulae.brew.sh/cask/) - HIGH confidence (official docs)
- [npm bin field documentation](https://docs.npmjs.com/cli/v8/commands/npx/) - HIGH confidence (official docs)
- [yt-dlp Installation Wiki](https://github.com/yt-dlp/yt-dlp/wiki/Installation) - HIGH confidence (official wiki)
- [binary-install npm package](https://www.npmjs.com/package/binary-install) - MEDIUM confidence (npm registry)
- [OpenCode multi-binary distribution](https://opencode.ai/docs/) - MEDIUM confidence (real-world example)
- [macOS distribution gist](https://gist.github.com/rsms/929c9c2fec231f0cf843a1a746a416f5) - MEDIUM confidence (developer reference)
- [Distribute with Homebrew Taps Guide](https://casraf.dev/2025/01/distribute-open-source-tools-with-homebrew-taps-a-beginners-guide/) - LOW confidence (single blog post)
