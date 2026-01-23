# Project Research Summary

**Project:** JoseTunes Distribution Infrastructure
**Domain:** Desktop application distribution (Tauri v1, multi-channel: npm/npx, Homebrew, GitHub Releases)
**Researched:** 2026-01-23
**Confidence:** HIGH

## Executive Summary

JoseTunes is a Tauri v1 desktop audio downloader that needs professional distribution across three channels: GitHub Releases (all platforms), npm packages (developer-friendly npx install), and Homebrew tap (macOS native). The research reveals a clear architectural pattern: use GitHub Releases as the canonical artifact store triggered by semantic version tags, implement the proven esbuild npm pattern with platform-specific optionalDependencies, and create a Homebrew Cask (not Formula) in a custom tap pointing to release artifacts.

The recommended approach follows industry-standard patterns used by esbuild, SWC, and Sentry CLI. The existing CI workflow already uses tauri-apps/tauri-action for builds — it just needs restructuring from branch-push triggers to tag-push triggers with a fan-in release job that coordinates all three channels. The npm distribution requires creating 5 packages (wrapper + 4 platform-specific), each containing installer artifacts (not raw binaries, since Tauri apps need system WebView integration). The Homebrew cask references GitHub Release .dmg files with per-architecture SHA256 checksums, updated automatically on each release.

Key risks center on version synchronization (three files must match: package.json, tauri.conf.json, Cargo.toml), npm package configuration (os/cpu fields must exactly match Node.js values), and macOS notarization complexity (known to hang in CI, requires API keys not passwords). Code signing is optional for v0.1.0 — document Gatekeeper/SmartScreen workarounds instead. Critical pitfall: do NOT bundle yt-dlp as a sidecar (breaks notarization). The version desync issue should be resolved first by using Cargo.toml as the single source of truth.

## Key Findings

### Recommended Stack

The distribution infrastructure leverages existing CI components with strategic additions. GitHub Releases serves as the foundation — the current tauri-action (v0) already builds cross-platform and uploads artifacts, it just needs trigger and workflow restructuring. For npm, the esbuild optionalDependencies pattern is the proven standard for native binary distribution, used successfully by major tooling projects. Homebrew requires a Cask (not Formula) in a custom tap repository, with automated SHA256 updates via repository dispatch events.

**Core technologies:**
- **tauri-apps/tauri-action@v0**: Multi-platform Tauri builds + artifact generation — already in use, well-tested with Tauri v1
- **npm optionalDependencies pattern**: Platform-specific packages resolved via os/cpu fields — industry standard, avoids postinstall download fragility
- **npm OIDC Trusted Publishers**: Tokenless CI publishing (classic tokens deprecated Dec 2025) — more secure, no rotation needed
- **Homebrew Cask + custom tap**: macOS GUI app distribution with livecheck — correct mechanism for .app bundles
- **Justintime50/homebrew-releaser@v3**: Automated cask updates with SHA256 computation — reduces manual toil, reasonable reliability

**Version trigger change:**
- Current: Push to `release` branch
- Target: Push tags matching `v*` (enables standard `npm version` workflow)

**Critical configuration:**
- npm packages: 5 total (wrapper + darwin-arm64, darwin-x64, linux-x64, win32-x64)
- Each platform package: `os`/`cpu` fields matching Node.js values exactly
- Wrapper package: CLI launcher + optionalDependencies + postinstall fallback
- Homebrew tap: Repository named `homebrew-josetunes` (prefix required)

### Expected Features

Distribution for a v0.1.0 desktop tool requires automated builds, multiple install paths, and clear documentation — not enterprise polish like auto-updates or code signing. The CI/CD foundation must come first since both npm and Homebrew reference GitHub Release assets.

**Must have (table stakes):**
- GitHub Releases with platform binaries (.dmg, .msi, .deb, .AppImage) — every open-source desktop app provides this
- Semantic versioning (v0.1.0 tags) — package managers and users rely on semver
- npx one-liner install (npx josetunes) — developer-audience expects it to "just work"
- Homebrew tap with brew install — macOS power users' preferred method
- Platform-appropriate installers — users expect native formats, not raw binaries
- Clear yt-dlp prerequisite documentation — hard runtime dependency, must document upfront
- README with one-line install commands per channel — copy-paste is faster than reading paragraphs
- Tag-triggered automated builds — version tag should produce release without manual steps
- Checksums for release assets — security-conscious users verify downloads

**Should have (competitive):**
- yt-dlp auto-detection with helpful error — reduces support burden significantly
- Homebrew Cask (not Formula) — correct choice for GUI apps, installs to /Applications
- npx postinstall fallback — handles --no-optional flags and restricted environments
- Platform-specific npm packages under scope (@josetunes/*) — clean namespace following esbuild pattern
- Troubleshooting section — document Gatekeeper/SmartScreen workarounds upfront
- Changelog in releases — users want to know what changed before updating

**Defer (v2+):**
- Auto-update mechanism — significant complexity, overkill for v0.1.0 with few users
- macOS code signing + notarization — requires $99/year Apple Developer, certificate management, CI secrets, known bugs with sidecars
- Windows EV code signing — expensive ($400-600/year), SmartScreen warnings are annoying but not blocking
- yt-dlp bundling as sidecar — breaks notarization, increases binary size, licensing issues, goes stale quickly
- Homebrew core submission — requires review, maintained by Homebrew team, premature for v0.1.0
- Contributing/developer guide — end-user docs are the priority
- Multi-architecture Linux packages — .deb arm64, .rpm, Snap, Flatpak add CI complexity

### Architecture Approach

The distribution pipeline flows from git tag push through parallel platform builds, then fans in to a single release job that coordinates artifact publishing across all three channels. GitHub Releases is the foundation that other channels depend on — npm platform packages download from release assets, Homebrew cask references release .dmg URLs.

**Major components:**
1. **CI Build Matrix (parallel)** — Four jobs building macOS arm64/x64, Linux x64, Windows x64 using existing tauri-action. Outputs platform-specific Tauri bundles (.dmg, .msi, .deb, .AppImage) as GitHub Actions artifacts. Duration ~10-15 minutes.
2. **Release Job (sequential fan-in)** — Waits for all builds, downloads artifacts, creates GitHub Release with assets, packages and publishes 5 npm packages, dispatches Homebrew tap update with version + SHA256. Duration ~3-5 minutes. Requires permissions: contents:write, id-token:write.
3. **npm Package Structure (5 packages)** — Main wrapper (josetunes) declares 4 platform packages as optionalDependencies. Each platform package has os/cpu fields matching Node.js values. Wrapper provides install CLI that opens the appropriate installer for current platform. Platform packages contain installer files (not raw binaries).
4. **Homebrew Tap Repository (separate repo)** — Repository named homebrew-josetunes containing Casks/josetunes.rb. Cask references GitHub Release .dmg URLs with arch-specific SHA256 checksums. Workflow triggered by repository dispatch updates version and checksums automatically.
5. **Version Synchronization** — Single source of truth: Cargo.toml. Remove version from tauri.conf.json (falls back to Cargo.toml). CI reads Cargo.toml version, stamps all package.json files before publishing.

**Data flow:**
```
Developer: git tag v1.0.0 && git push --tags
    |
    v
[CI triggered by v* tag]
    |
    v
[4 parallel build jobs] → [upload artifacts]
    |
    v
[Release job: fan-in]
    |
    +---> GitHub Release (all platform assets)
    +---> npm Registry (5 packages published)
    +---> Repository Dispatch → Homebrew tap update
```

**Key architectural constraint:** Unlike CLI tools (esbuild), JoseTunes is a GUI app requiring system WebView. Platform packages must contain installers (.dmg, .msi, .deb) not raw executables. The wrapper provides an install command, not a direct bin entry.

### Critical Pitfalls

Research identified 18 pitfalls across three severity levels. The top 5 critical issues can break releases, fail installs, or require significant rework.

1. **Version desync across 3 files (Cargo.toml, tauri.conf.json, package.json)** — Tauri v1 has no sync mechanism. Different files serve different ecosystems. Users install v0.1.0 but binary reports v0.0.0. **Solution:** Remove version from tauri.conf.json entirely (falls back to Cargo.toml). Use Cargo.toml as single source of truth. Add CI check verifying Cargo.toml version matches git tag before building.

2. **npm platform package os/cpu field misconfiguration** — Fields must match Node.js process.platform/process.arch exactly. Common mistakes: "macos" instead of "darwin", "amd64" instead of "x64", "aarch64" instead of "arm64". npm silently skips installation (optionalDependencies allowed to fail), user gets missing binary with confusing runtime error. **Solution:** Use exact Node.js values. Test installation on all platforms before publishing.

3. **macOS notarization hangs indefinitely in CI** — Apple's notary service sometimes doesn't respond, or Tauri's notarization polling loops infinitely. Issue affects both v1 and v2 (GitHub issue #14579). **Solution:** Set timeout on macOS build job (30 minutes). Use App Store Connect API keys instead of Apple ID/password (more reliable). For v0.1.0: skip notarization, document Gatekeeper workaround.

4. **GitHub Release artifact upload race condition** — Matrix strategy building 4 platforms in parallel creates race where multiple jobs try to create/update same release simultaneously. Results in "Resource not accessible by integration" errors, missing artifacts. **Solution:** Set releaseDraft:true, let all jobs upload to draft, manually publish after verifying all artifacts. Or create release in separate job first, pass releaseId to matrix builds.

5. **macOS sidecar (yt-dlp) breaks notarization** — External binaries via externalBin in tauri.conf.json fail Apple notarization. Bundled sidecar is unsigned, entire app fails. Known Tauri bug (issue #11992). **Solution:** Do NOT bundle yt-dlp. Require in PATH, document installation per platform. If bundling eventually needed: download yt-dlp in CI, sign with Developer ID before Tauri build.

**Moderate pitfalls:**
- npm token expiration (max 90 days since Oct 2025) — Use OIDC Trusted Publishers to eliminate tokens
- Homebrew SHA256 stale after release — Automate with homebrew-releaser or repository dispatch workflow
- Workflow uses yarn but project uses bun — Change CI to bun install, remove yarn.lock
- npm --no-optional breaks installs — Implement postinstall fallback downloading from GitHub Releases
- GITHUB_TOKEN permissions insufficient — Already has contents:write, add id-token:write for npm OIDC

## Implications for Roadmap

Based on dependency analysis and architectural constraints, the implementation naturally divides into three sequential phases. Phase ordering is critical — both npm and Homebrew depend on GitHub Release artifacts existing, so CI foundation must come first.

### Phase 1: CI/CD Foundation
**Rationale:** GitHub Releases is the canonical artifact store. Both npm platform packages and Homebrew cask reference release asset URLs. This phase unblocks all downstream channels.

**Delivers:** Tag-triggered automated builds producing GitHub Releases with all platform installers attached. Version synchronization resolved.

**Addresses (from FEATURES.md):**
- Tag-triggered automated builds (table stakes)
- GitHub Releases with platform binaries (table stakes)
- Semantic versioning (table stakes)
- Checksums for release assets (table stakes)

**Avoids (from PITFALLS.md):**
- Version desync (#2): Remove version from tauri.conf.json, use Cargo.toml as source of truth
- Artifact race condition (#5): Restructure to fan-in release job
- Workflow package manager mismatch (#10): Switch from yarn to bun
- GITHUB_TOKEN permissions (#13): Verify contents:write, add id-token:write for later npm phase

**Implementation order:**
1. Fix version synchronization (remove tauri.conf.json version field)
2. Add CI version check script (git tag matches Cargo.toml)
3. Convert workflow trigger from branch-push to tag-push (on: push: tags: ['v*'])
4. Restructure workflow: build matrix (parallel) → release job (fan-in)
5. Replace tauri-action release creation with softprops/action-gh-release in release job
6. Change yarn to bun in install steps
7. Test with pre-release tag (v0.1.0-alpha.1)

**Research flags:** Standard patterns. Well-documented in tauri-action and GitHub Actions docs. Skip phase-specific research.

### Phase 2: npm Distribution
**Rationale:** Developer-audience install path. Most complex channel due to multi-package structure and platform resolution. Depends on Phase 1 release artifacts being available.

**Delivers:** npx josetunes one-liner that installs the correct platform package and provides an install command to open/run the installer.

**Addresses (from FEATURES.md):**
- npx one-liner install (table stakes)
- Platform-specific packages under scope (competitive)
- npx postinstall fallback (competitive)

**Uses (from STACK.md):**
- npm optionalDependencies pattern with os/cpu fields
- npm OIDC Trusted Publishers for CI publishing
- Dual strategy: optionalDeps primary + postinstall fallback

**Avoids (from PITFALLS.md):**
- os/cpu field misconfiguration (#3): Use exact Node.js values (darwin, linux, win32, arm64, x64)
- npm token expiration (#9): Use OIDC Trusted Publishers, eliminate tokens
- --no-optional breaks installs (#12): Implement postinstall fallback downloading from GitHub Releases
- Missing executable permissions (#15): postinstall script runs chmod +x on binaries

**Implementation order:**
1. Create packages/ directory structure (josetunes, darwin-arm64, darwin-x64, linux-x64, win32-x64)
2. Write platform package.json files with os/cpu fields
3. Write wrapper package.json with optionalDependencies
4. Write bin/josetunes-install CLI (platform detection, installer launch)
5. Write install.js postinstall script (fallback to GitHub Releases)
6. Configure npm OIDC Trusted Publisher on npmjs.com
7. Add npm publish steps to release job (after GitHub Release creation)
8. Test with --no-optional flag to verify fallback works

**Research flags:** Complex integration. May need phase-specific research for installer launch mechanisms per platform (open .dmg vs dpkg vs msiexec). Consider gsd:research-phase if complexity emerges during planning.

### Phase 3: Homebrew Tap
**Rationale:** macOS users' preferred install method. Simplest channel — just a cask definition referencing release URLs. Depends on Phase 1 .dmg files being in GitHub Releases.

**Delivers:** brew install crativo/josetunes/josetunes one-liner for macOS.

**Addresses (from FEATURES.md):**
- Homebrew tap with brew install (table stakes)
- Homebrew Cask (not Formula) (competitive)

**Avoids (from PITFALLS.md):**
- Tap repository naming (#7): Name repo exactly homebrew-josetunes
- SHA256 stale after release (#8): Automate with repository dispatch + tap workflow
- Cask vs Formula confusion (#17): Use Cask for GUI app, not Formula
- Formula class name mismatch (#14): Filename josetunes.rb, class name Josetunes

**Implementation order:**
1. Create homebrew-josetunes GitHub repository
2. Create Casks/ directory
3. Write Casks/josetunes.rb with arch-specific URLs and SHA256
4. Write .github/workflows/update-cask.yml in tap repo (triggered by repository_dispatch)
5. Add repository dispatch step to main repo release job
6. Test brew install on both ARM and Intel Macs

**Research flags:** Standard patterns. Well-documented in Homebrew docs. Skip phase-specific research.

### Phase Ordering Rationale

**Why this order:**
- GitHub Releases MUST come first — both npm and Homebrew consume release artifacts
- npm before Homebrew — higher complexity, targets wider audience (all platforms vs macOS only)
- Each phase is independently testable and delivers user value

**Dependency chain:**
```
Phase 1 (CI/CD) → produces GitHub Release artifacts
    |
    +---> Phase 2 (npm) → downloads artifacts, packages, publishes
    |
    +---> Phase 3 (Homebrew) → references .dmg URLs, auto-updates checksums
```

**Pitfall avoidance strategy:**
- Phase 1 resolves all version and CI infrastructure issues upfront
- Phase 2 tackles npm complexity in isolation after foundation is solid
- Phase 3 is straightforward once release artifacts are reliably produced

**What NOT to build (deferred post-v0.1.0):**
- Code signing / notarization — optional for initial release, document workarounds
- Auto-update mechanism — reinstall workflow acceptable for early users
- yt-dlp bundling — breaks notarization, keep as documented prerequisite
- Windows EV code signing — expensive, SmartScreen warnings tolerable initially

### Research Flags

**Needs phase-specific research:**
- **Phase 2 (npm):** Installer launch mechanisms per platform may require deeper research. How to programmatically open .dmg, run .msi silently, handle .deb installation with sudo prompts. Consider gsd:research-phase if complexity exceeds expectations during planning.

**Standard patterns (skip phase-specific research):**
- **Phase 1 (CI/CD):** Tag-triggered workflows, GitHub Actions matrix builds, tauri-action usage — all well-documented in official sources
- **Phase 3 (Homebrew):** Cask syntax, tap repository structure, livecheck — official Homebrew documentation is comprehensive

**Overall research confidence:** HIGH. All patterns verified against official documentation and real-world implementations (esbuild, SWC, Sentry). Critical pitfalls identified with proven solutions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified with official sources. tauri-action already in use. npm optionalDependencies pattern proven by major projects (esbuild, SWC, Sentry). Homebrew cask is standard for GUI apps. |
| Features | MEDIUM-HIGH | Table stakes features clear from desktop app conventions. Anti-features confirmed by PROJECT.md constraints. Some uncertainty on nice-to-have vs must-have for v0.1.0 (addressed by deferring polish). |
| Architecture | HIGH | npm package structure verified from esbuild source. Tauri build pipeline documented in official guides. Homebrew tap structure from official docs. CI fan-in pattern is standard GitHub Actions. |
| Pitfalls | HIGH | 18 pitfalls sourced from official Tauri GitHub issues, npm documentation, Homebrew docs. Version desync (#2), notarization hang (#4), and sidecar issue (#1) all confirmed in active Tauri issues. |

**Overall confidence:** HIGH

The distribution infrastructure follows established patterns with strong documentation. The architectural approach (GitHub Releases → npm + Homebrew) is proven. Critical pitfalls have known mitigations. The main uncertainty is npm Phase 2 installer launch complexity — may need phase research.

### Gaps to Address

1. **Installer launch UX per platform** — Research focused on packaging/distribution, less on the user experience of running installers from npm. macOS "open .dmg" is simple, but Linux .deb installation requires sudo prompts, Windows .msi may trigger UAC. The bin/josetunes-install script needs platform-specific logic that may require iteration. Consider gsd:research-phase for Phase 2 if this becomes complex during planning.

2. **Code signing long-term viability** — Research confirmed code signing is optional for v0.1.0, but Homebrew announced that unsigned casks will be deprecated by September 2026 (Homebrew 5.0.0 release notes). This gives ~18 months runway. Post-v0.1.0, code signing becomes necessary for Homebrew distribution. Budget $99/year Apple Developer, investigate CI signing flows.

3. **npm OIDC Trusted Publisher configuration** — Research confirmed this is the correct approach (classic tokens deprecated Dec 2025), but the actual npmjs.com configuration flow for trusted publishers is not documented in research. First-time setup may require trial and error. Fallback: test with manual npm publish from local machine before automating in CI.

4. **Windows .msi silent install flags** — npm wrapper should ideally launch Windows installer without UAC prompts or blocking dialogs. Research did not cover .msi command-line flags for silent/passive install. May need to consult Tauri Windows bundler docs or test empirically.

5. **Homebrew cask livecheck reliability** — Research suggests livecheck with strategy :github_latest works, but no verification of actual reliability or update latency. Users may experience delays between release publication and brew upgrade detecting new version. Acceptable for v0.1.0, monitor user feedback.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [Tauri v1 Building Guide](https://v1.tauri.app/v1/guides/building/) — Build process, artifact outputs
- [Tauri v1 macOS Signing](https://v1.tauri.app/v1/guides/distribution/sign-macos/) — Code signing, notarization flow
- [Tauri v1 Windows Signing](https://v1.tauri.app/v1/guides/distribution/sign-windows/) — EV certificate requirements as of June 2023
- [Tauri v1 Sidecar Guide](https://v1.tauri.app/v1/guides/building/sidecar/) — External binary bundling (identified as notarization pitfall)
- [tauri-apps/tauri-action GitHub](https://github.com/tauri-apps/tauri-action) — CI action usage, matrix builds, release creation
- [Homebrew: How to Create and Maintain a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) — Tap structure, naming conventions
- [Homebrew Cask Cookbook](https://docs.brew.sh/Cask-Cookbook) — Cask DSL, arch-specific URLs, SHA256
- [Homebrew 5.0.0 Release Notes](https://brew.sh/2025/11/12/homebrew-5.0.0/) — Unsigned cask deprecation timeline
- [npm Trusted Publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/) — Tokenless CI publishing
- [npm package.json os/cpu fields](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) — Platform-specific dependencies
- [esbuild Platform-Specific Binaries (DeepWiki)](https://deepwiki.com/evanw/esbuild/6.2-platform-specific-binaries) — optionalDependencies pattern
- [esbuild package.json on GitHub](https://github.com/evanw/esbuild/blob/main/npm/esbuild/package.json) — Verified implementation

**GitHub Issues (verified bugs):**
- [Tauri #11992](https://github.com/tauri-apps/tauri/issues/11992) — macOS sidecar breaks notarization
- [Tauri #14579](https://github.com/tauri-apps/tauri/issues/14579) — Build stuck at notarizing
- [Tauri #8265](https://github.com/tauri-apps/tauri/issues/8265) — Version sync feature request
- [Tauri Discussion #6347](https://github.com/tauri-apps/tauri/discussions/6347) — Version number sync
- [tauri-action #240](https://github.com/tauri-apps/tauri-action/issues/240) — Artifact upload race condition
- [tauri-action #950](https://github.com/tauri-apps/tauri-action/issues/950) — Universal binary updater signature mismatch
- [esbuild #789](https://github.com/evanw/esbuild/issues/789) — Platform-specific binary strategy
- [npm/cli #4828](https://github.com/npm/cli/issues/4828) — optionalDependencies lockfile bug

### Secondary (MEDIUM confidence)

**Engineering Blogs:**
- [Sentry: Publishing Binaries on npm](https://sentry.engineering/blog/publishing-binaries-on-npm) — Dual strategy (optionalDeps + postinstall fallback)
- [GitHub Blog: npm Trusted Publishing](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) — OIDC GA announcement
- [GitHub Blog: Strengthening npm Security](https://github.blog/changelog/2025-09-29-strengthening-npm-security-important-changes-to-authentication-and-token-management/) — Classic token deprecation

**Tools:**
- [Justintime50/homebrew-releaser](https://github.com/Justintime50/homebrew-releaser) — Automated cask updates
- [softprops/action-gh-release](https://github.com/marketplace/actions/upload-files-to-a-github-release) — Alternative to tauri-action release creation
- [mislav/bump-homebrew-formula-action](https://github.com/mislav/bump-homebrew-formula-action) — Formula bump automation

### Tertiary (LOW confidence)

- [Distribute with Homebrew Taps Guide](https://casraf.dev/2025/01/distribute-open-source-tools-with-homebrew-taps-a-beginners-guide/) — Blog post, single source
- [Orhun: Packaging Rust for npm](https://blog.orhun.dev/packaging-rust-for-npm/) — Community blog, patterns validated elsewhere

---
*Research completed: 2026-01-23*
*Ready for roadmap: Yes*
