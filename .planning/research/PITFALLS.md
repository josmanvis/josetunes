# Domain Pitfalls: Tauri App Distribution

**Domain:** Desktop app distribution (npm binary packages, Homebrew tap, GitHub Releases, code signing)
**Project:** JoseTunes (Tauri v1, yt-dlp dependency, Mac/Windows/Linux)
**Researched:** 2026-01-23

---

## Critical Pitfalls

Mistakes that cause broken releases, failed installs, or require significant rework.

---

### Pitfall 1: macOS Sidecar (yt-dlp) Breaks Notarization

**What goes wrong:** Adding external binaries via `externalBin` in `tauri.conf.json` causes Apple notarization to fail. The bundled sidecar binary (yt-dlp) is not itself code-signed, so the entire app bundle fails notarization. This is a known Tauri bug affecting both v1 and v2 (GitHub issue #11992).

**Why it happens:** Apple requires ALL executables inside a notarized app bundle to be individually signed with a valid Developer ID. yt-dlp distributed as a standalone binary is unsigned. Tauri's bundler does not automatically sign sidecar binaries.

**Consequences:** App cannot be distributed outside the App Store on macOS. Users see "app is damaged" or Gatekeeper blocks execution entirely.

**Prevention:**
- Do NOT bundle yt-dlp as a sidecar for the initial release. Instead, keep the current approach: require yt-dlp in PATH and document installation instructions.
- If bundling is eventually desired: download yt-dlp during CI, sign it with your Developer ID (`codesign --force --options runtime --sign "Developer ID Application: ..."`) BEFORE the Tauri build step, then place the signed binary in the sidecar path.
- Test notarization in CI on every release build, not just occasionally.

**Detection:** Build succeeds but notarization step hangs for 45+ minutes or returns "The signature of the binary is invalid" errors.

**Phase relevance:** Code Signing phase -- must be resolved before any macOS distribution.

**Confidence:** HIGH (verified via Tauri GitHub issues #11992, #7250, official docs)

---

### Pitfall 2: Version Number Desync Across Three Files

**What goes wrong:** Version 0.0.0 exists in `package.json`, `tauri.conf.json`, and `Cargo.toml`. When bumping to 0.1.0, developers update one file but forget the others. The tauri-action uses the version from `tauri.conf.json` to create the GitHub release tag, but Cargo uses its own version for the binary, and npm uses `package.json`. This creates releases where the tag says v0.1.0 but the binary reports v0.0.0.

**Why it happens:** Tauri v1 has no built-in version sync mechanism. The three files serve different ecosystems (npm, Tauri bundler, Rust) and there is no enforcement.

**Consequences:** Users install version 0.1.0 but `--version` shows wrong output. Auto-updater (if added later) may fail version comparisons. npm packages tagged with wrong versions.

**Prevention:**
- Remove the `version` field from `tauri.conf.json` entirely. In Tauri v1, if no version is provided, it falls back to `Cargo.toml`.
- Use `Cargo.toml` as the single source of truth for app version.
- Add a CI check step that verifies `Cargo.toml` version matches the git tag before building.
- For npm publishing, read the version from `Cargo.toml` programmatically in the release workflow.

**Detection:** `grep -r "version" package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml` shows different values.

**Phase relevance:** Must be fixed FIRST, before any release workflow runs.

**Confidence:** HIGH (verified via Tauri discussion #6347, issue #8265, official config docs)

---

### Pitfall 3: npm Platform Package `os`/`cpu` Field Misconfiguration

**What goes wrong:** Platform-specific npm packages (e.g., `@josetunes/darwin-arm64`) have incorrect `os` or `cpu` fields in their `package.json`. npm silently skips installation of the platform package, and the user gets a broken install with no binary.

**Why it happens:** The field values must match Node.js `process.platform` and `process.arch` values exactly. Common mistakes:
- Using `macos` instead of `darwin`
- Using `amd64` instead of `x64`
- Using `aarch64` instead of `arm64`
- Forgetting to set the fields entirely

**Consequences:** `npm install josetunes` succeeds (no error, because optionalDependencies are allowed to fail) but the binary is missing. Users get a confusing runtime error, not an install-time error.

**Prevention:**
- Use the exact Node.js values: `darwin`, `linux`, `win32` for os; `arm64`, `x64` for cpu.
- Reference esbuild's proven pattern: packages named `@scope/platform-arch` with matching `os`/`cpu` fields.
- Add a postinstall fallback script that detects when no platform package was installed and prints a clear error message.
- Test installation on ALL target platforms in CI before publishing.

**Detection:** Run `node -e "console.log(process.platform, process.arch)"` on each target platform and compare against your package.json fields.

**Phase relevance:** npm Publishing phase -- must be correct on first publish since users cache packages.

**Confidence:** HIGH (verified via esbuild pattern, Sentry blog, npm docs)

---

### Pitfall 4: macOS Notarization Hangs Indefinitely in CI

**What goes wrong:** The GitHub Actions build completes code signing but then hangs at "Notarizing..." for 45+ minutes with no error. The CI job times out. This is a recurring issue with Tauri's notarization integration, reported as recently as November 2025 (issue #14579).

**Why it happens:** Apple's notary service sometimes does not respond, or Tauri's notarization polling enters an infinite loop. First builds may succeed, but subsequent builds hang. The issue may be related to Apple's deprecated `altool` vs the newer `notarytool`.

**Consequences:** Release pipelines become unreliable. macOS builds block the entire release.

**Prevention:**
- Set a timeout on the macOS build job (e.g., `timeout-minutes: 30`).
- Use App Store Connect API keys (`APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`) instead of Apple ID/password auth, as API keys are more reliable in CI.
- If the notarization step hangs, implement a retry mechanism or separate the notarization into its own step with `xcrun notarytool` directly.
- Consider submitting notarization manually after the build and polling for status.

**Detection:** CI job exceeds 20 minutes on the macOS build. Logs show "Notarizing" with no subsequent output.

**Phase relevance:** Code Signing phase -- blocks macOS releases.

**Confidence:** HIGH (verified via Tauri issues #14579, #8630, multiple community reports)

---

### Pitfall 5: GitHub Release Artifact Upload Race Condition

**What goes wrong:** With a matrix strategy building Mac (arm64 + x86_64), Linux, and Windows in parallel, multiple jobs try to create and update the same GitHub release simultaneously. This causes "Resource not accessible by integration" or "Not Found" errors, and some artifacts are missing from the final release.

**Why it happens:** The `tauri-action` both creates the release and uploads artifacts. When four jobs run in parallel, they race to create the release. The first one wins; others may fail if the release transitions states (draft -> published) mid-upload.

**Consequences:** Incomplete releases with only some platform binaries. Users on missing platforms cannot download the app.

**Prevention:**
- Set `releaseDraft: true` and let ALL matrix jobs upload to the same draft release. Manually publish the draft after verifying all artifacts are present.
- Alternatively, create the release in a separate job first, then pass the `releaseId` to all matrix builds.
- Use `concurrency` groups in GitHub Actions to prevent simultaneous release modifications.
- Verify artifact count matches expected platforms before publishing.

**Detection:** Release shows fewer artifacts than expected platforms. Check GitHub Actions logs for 404 or permission errors on upload steps.

**Phase relevance:** GitHub Releases phase -- must be resolved before first public release.

**Confidence:** HIGH (verified via tauri-action issues #240, #435, official docs)

---

### Pitfall 6: Windows SmartScreen Blocks Unsigned App

**What goes wrong:** Without an EV code signing certificate, Windows SmartScreen shows "Windows protected your PC" with a scary blue warning. Most users will not click "More info" -> "Run anyway". Even with an OV certificate, SmartScreen still shows warnings until sufficient reputation is built.

**Why it happens:** Microsoft SmartScreen requires reputation OR an EV certificate. New OV certificates have zero reputation. EV certificates provide immediate reputation but cost $400+/year, require hardware tokens, and cannot be easily used in CI without cloud HSM.

**Consequences:** Windows users cannot easily install the app. Downloads appear malicious.

**Prevention:**
- For v0.1.0: Accept the SmartScreen warning as a tradeoff. Document it in the README ("First time running: click More Info -> Run Anyway").
- Long-term: Obtain an EV certificate from a provider that offers cloud-based signing (e.g., SSL.com eSigner, Azure Trusted Signing).
- Important: The old Tauri v1 PFX-based signing guide only applies to OV certificates acquired BEFORE June 1, 2023. Newer certificates require cloud HSM or hardware tokens.
- Use `bundle > windows > signCommand` in `tauri.conf.json` for custom signing tools.

**Detection:** Test the Windows installer on a fresh Windows VM. SmartScreen warning appears immediately.

**Phase relevance:** Windows Code Signing -- can be deferred past v0.1.0 if budget is limited, but must be documented.

**Confidence:** HIGH (verified via Tauri Windows signing docs, multiple community discussions)

---

## Moderate Pitfalls

Mistakes that cause delays, user confusion, or technical debt.

---

### Pitfall 7: Homebrew Tap Repository Naming Wrong

**What goes wrong:** The tap repository is not named with the `homebrew-` prefix (e.g., named `josetunes-tap` instead of `homebrew-josetunes`). Users cannot use the short form `brew tap user/josetunes` and must use the full repository URL.

**Why it happens:** The `homebrew-` prefix requirement is not obvious and differs from typical GitHub repo naming conventions.

**Prevention:**
- Name the repository exactly `homebrew-josetunes` on GitHub.
- The install command then becomes `brew tap crativo/josetunes && brew install josetunes`.
- Test the tap with `brew tap` before announcing it publicly.

**Detection:** `brew tap user/name` returns "Error: Invalid tap name."

**Phase relevance:** Homebrew Tap phase -- trivial to get right if done correctly from the start; painful to rename later as users have bookmarked the old name.

**Confidence:** HIGH (verified via official Homebrew documentation)

---

### Pitfall 8: Homebrew SHA256 Checksum Stale After Release

**What goes wrong:** A new GitHub release is published, but the Homebrew formula still references the old version's SHA256 checksum. Users who `brew install` get a checksum mismatch error and cannot install.

**Why it happens:** The formula in the tap repository is not automatically updated when a new release is created. The SHA256 must be recalculated from the new release archive.

**Prevention:**
- Automate formula updates using `mislav/bump-homebrew-formula-action` in the release workflow.
- The action computes the new SHA256 automatically from the release archive URL.
- Gate the formula update on successful completion of ALL platform builds.
- Alternative: Use a workflow_dispatch in the tap repo triggered by the main repo's release workflow.

**Detection:** `brew install` fails with "SHA256 mismatch" errors immediately after a new release.

**Phase relevance:** Homebrew Tap phase -- must be automated from the start.

**Confidence:** MEDIUM (verified via mislav/bump-homebrew-formula-action docs and community patterns)

---

### Pitfall 9: npm Token Expiration Breaks Publishing Pipeline

**What goes wrong:** The npm access token stored as a GitHub secret expires (max 90 days since mid-October 2025), and the next release attempt fails silently or with an auth error. Nobody notices until the release is already tagged and partially published.

**Why it happens:** As of late 2025, npm removed legacy (non-expiring) tokens entirely. All granular tokens now have a maximum expiration of 90 days. Teams set up publishing once and forget about token rotation.

**Prevention:**
- Use npm Trusted Publishing (OIDC) instead of access tokens. This eliminates tokens entirely and uses short-lived credentials generated during the CI workflow.
- If OIDC is not feasible: set a calendar reminder 14 days before token expiration.
- Add a CI step that validates the npm token is still valid before building (e.g., `npm whoami`).
- Store token expiration date as a comment in your secrets documentation.

**Detection:** Release workflow fails at the `npm publish` step with 401/403 errors.

**Phase relevance:** npm Publishing phase -- should use OIDC from the start.

**Confidence:** HIGH (verified via npm blog, GitHub changelog "Strengthening npm security")

---

### Pitfall 10: Workflow Uses `yarn install` But Project Uses `bun`

**What goes wrong:** The existing CI workflow (`.github/workflows/main.yml`) runs `yarn install` but the project uses `bun` as its package manager. This may install slightly different dependency versions, or fail entirely if there is no `yarn.lock` file.

**Why it happens:** The workflow was scaffolded from a Tauri template and the package manager line was not updated to match the actual project tooling.

**Prevention:**
- Change the workflow to use `bun install` and set up bun in CI with `oven-sh/setup-bun@v1`.
- Ensure `bun.lockb` (or `bun.lock`) is committed to the repository.
- Remove any `yarn.lock` or `package-lock.json` if they exist to avoid confusion.

**Detection:** CI installs succeed but use different resolved versions than local development. Or CI fails with "yarn: command not found."

**Phase relevance:** Must be fixed before any release workflow is used.

**Confidence:** HIGH (verified by reading the project's package.json and workflow file directly)

---

### Pitfall 11: Tauri Universal Binary Breaks Updater Signatures

**What goes wrong:** Building a universal macOS binary (`--target universal-apple-darwin`) produces a different binary than building separate arm64/x86_64 targets. If the auto-updater's `latest.json` has the signature from the universal build but users downloaded the arch-specific build (or vice versa), updates fail with `UnexpectedKeyId`.

**Why it happens:** Tauri signs each build artifact with a unique signature. Universal binaries produce different signatures than arch-specific builds. Mixing these in `latest.json` causes validation failures.

**Prevention:**
- Pick ONE strategy and stick with it: either separate per-arch builds OR universal binary. Do not mix.
- For v0.1.0: Use separate per-arch builds (arm64 + x86_64) since the CI already does this. Universal binaries add complexity.
- If adding an updater later: generate `latest.json` from the same build that produces the downloadable artifacts.

**Detection:** Users on macOS report "update failed" errors after installing a new version. Check if `.sig` file content matches what is in `latest.json`.

**Phase relevance:** If auto-updater is added post-v0.1.0, this becomes relevant.

**Confidence:** HIGH (verified via Tauri issue #950, updater documentation)

---

### Pitfall 12: npm `--no-optional` and `--ignore-scripts` Break Installs

**What goes wrong:** Users who run `npm install --no-optional` (or use pnpm which disables scripts by default) get no platform-specific binary at all. The main package installs but the actual executable is missing.

**Why it happens:** The optionalDependencies pattern relies on the package manager actually attempting to install optional packages. Some security-conscious environments and CI pipelines disable this.

**Prevention:**
- Implement a dual strategy like Sentry/esbuild: use optionalDependencies as the primary mechanism, but include a postinstall fallback that downloads the binary directly from GitHub Releases if the platform package is missing.
- Document in README that `--no-optional` is not supported.
- The postinstall script should detect if the binary already exists (from optionalDependencies) and skip the download if so.

**Detection:** Test installation with `npm install --no-optional josetunes` and verify the binary is still available.

**Phase relevance:** npm Publishing phase -- should be in the initial implementation.

**Confidence:** HIGH (verified via esbuild issue #789, Sentry blog)

---

### Pitfall 13: `GITHUB_TOKEN` Permissions Insufficient for Release Creation

**What goes wrong:** The workflow fails with "Resource not accessible by integration" when trying to create a release or upload artifacts.

**Why it happens:** By default, `GITHUB_TOKEN` has read-only permissions in some repository configurations. The workflow needs `contents: write` permission to create releases and upload artifacts.

**Prevention:**
- The existing workflow already has `permissions: contents: write` -- keep this.
- If the repository has restrictive org-level settings, verify that Actions are allowed to create releases.
- For npm OIDC publishing, additional `id-token: write` permission is needed.

**Detection:** First workflow run fails with 403 errors on release creation.

**Phase relevance:** GitHub Releases phase -- verify on first test run.

**Confidence:** HIGH (verified via tauri-action docs and GitHub Actions documentation)

---

## Minor Pitfalls

Mistakes that cause annoyance but are quickly fixable.

---

### Pitfall 14: Homebrew Formula Class Name vs Filename Mismatch

**What goes wrong:** The formula file is named `josetunes.rb` but the Ruby class inside is named `Josetunes` instead of `Josetunes` (or vice versa with hyphens). Homebrew rejects the formula with a cryptic Ruby error.

**Prevention:**
- Filename must be lowercase: `josetunes.rb`
- Class name must be strict CamelCase of the filename: `class Josetunes < Formula`
- If the name contains hyphens (e.g., `jose-tunes`), class becomes `JoseTunes`
- Run `brew audit --strict --online` on the formula before committing.

**Phase relevance:** Homebrew Tap phase.

**Confidence:** HIGH (verified via Homebrew Formula Cookbook docs)

---

### Pitfall 15: Missing Executable Permissions on Linux/Mac Binaries in npm Package

**What goes wrong:** The Tauri-built binary loses its executable permission bit when downloaded and packaged into npm. Users get "Permission denied" when trying to run it.

**Why it happens:** npm does not preserve file permissions from tarballs on all platforms. GitHub Actions upload/download-artifact also strips executable flags.

**Prevention:**
- Add a postinstall script that runs `chmod +x` on the binary path (Linux/macOS only).
- In the npm package's `package.json`, set the `bin` field correctly -- npm will attempt to set +x on `bin` entries.
- Test installation from the registry (not just local `npm link`) to verify permissions.

**Detection:** Users report "Permission denied" or "EACCES" when running the installed command.

**Phase relevance:** npm Publishing phase.

**Confidence:** HIGH (verified via Sentry blog, esbuild pattern)

---

### Pitfall 16: macOS Runner Architecture Mismatch in CI

**What goes wrong:** GitHub Actions `macos-latest` now resolves to ARM (M1+) runners by default. The workflow expects x86_64 for Intel builds but gets arm64. The x86_64 build fails because it cannot find the cross-compilation target.

**Why it happens:** GitHub changed the default macOS runner from Intel to ARM in 2024-2025. Workflows written before this change assume `macos-latest` is Intel.

**Prevention:**
- Use explicit runner versions: `macos-14` or `macos-15` for ARM, `macos-13` for Intel.
- Or: keep `macos-latest` (ARM) and add BOTH Rust targets (`aarch64-apple-darwin` and `x86_64-apple-darwin`) to cross-compile.
- The current workflow uses `macos-latest` for both arch targets which should work with cross-compilation, but verify.

**Detection:** CI fails with "linker not found" or "target not installed" errors on macOS builds.

**Phase relevance:** GitHub Actions phase -- verify early.

**Confidence:** MEDIUM (based on GitHub Actions runner documentation and community reports)

---

### Pitfall 17: Homebrew Cask vs Formula Confusion

**What goes wrong:** The team creates a Homebrew formula (for CLI tools built from source) instead of a cask (for pre-built GUI applications). The formula approach requires building from source, adding Rust as a dependency, and is inappropriate for a pre-built Tauri app.

**Prevention:**
- JoseTunes is a GUI desktop app -- use a **cask**, not a formula.
- Casks reference a `.dmg` or `.zip` download URL containing the pre-built app.
- The tap repo should contain a `Casks/` directory, not a `Formula/` directory.
- Cask definition references the GitHub Release asset URL and SHA256.

**Detection:** `brew install` tries to compile from source instead of downloading a pre-built binary.

**Phase relevance:** Homebrew Tap phase -- fundamental architecture decision.

**Confidence:** HIGH (verified via Homebrew Cask documentation)

---

### Pitfall 18: Bundle Identifier Mismatch with Apple Developer Account

**What goes wrong:** The bundle ID in `tauri.conf.json` (`com.crativo.tunerip`) does not match what is registered in the Apple Developer portal. Notarization fails with "Team not yet configured" or signing fails silently.

**Prevention:**
- Register the exact bundle ID `com.crativo.tunerip` in the Apple Developer Identifiers page BEFORE attempting to sign.
- Consider whether the bundle ID should be updated to match the product name (e.g., `com.crativo.josetunes`) for consistency.
- The bundle ID, once published, should NEVER change as it identifies the app to the OS for updates and preferences.

**Detection:** Notarization returns "No suitable application record was found" or signing identity lookup fails.

**Phase relevance:** Code Signing phase -- must be resolved before first signed build.

**Confidence:** HIGH (verified via Tauri macOS signing docs, Apple developer documentation patterns)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Version Setup | Version desync across 3 files (#2) | Remove version from tauri.conf.json, use Cargo.toml as source of truth |
| CI Workflow Fix | Wrong package manager in CI (#10) | Switch from yarn to bun in workflow |
| Code Signing (macOS) | Notarization hang (#4), sidecar issues (#1) | Use API keys, do NOT bundle yt-dlp, set timeouts |
| Code Signing (Windows) | SmartScreen block (#6) | Document warning for v0.1.0, plan EV cert for later |
| GitHub Releases | Artifact race condition (#5), permissions (#13) | Use draft releases, verify permissions |
| npm Publishing | Token expiration (#9), os/cpu fields (#3), --no-optional (#12) | Use OIDC, test all platforms, dual install strategy |
| Homebrew Tap | Repo naming (#7), SHA256 staleness (#8), cask vs formula (#17) | Correct naming from start, automate updates, use cask |

---

## Sources

### Official Documentation (HIGH confidence)
- [Tauri v1 macOS Code Signing](https://v1.tauri.app/v1/guides/distribution/sign-macos/)
- [Tauri v1 Windows Code Signing](https://v1.tauri.app/v1/guides/distribution/sign-windows/)
- [Tauri v1 Sidecar/External Binary](https://v1.tauri.app/v1/guides/building/sidecar/)
- [Tauri v2 GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/)
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew Tap Documentation](https://docs.brew.sh/Taps)
- [Homebrew Cask Cookbook](https://docs.brew.sh/Cask-Cookbook)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)

### GitHub Issues/Discussions (HIGH confidence - verified bugs)
- [Tauri #11992: macOS Sidecar + Notarization Bug](https://github.com/tauri-apps/tauri/issues/11992)
- [Tauri #14579: Build Stuck at Notarizing](https://github.com/tauri-apps/tauri/issues/14579)
- [Tauri #8265: Version Sync Feature Request](https://github.com/tauri-apps/tauri/issues/8265)
- [Tauri Discussion #6347: Version Number Sync](https://github.com/tauri-apps/tauri/discussions/6347)
- [tauri-action #950: UnexpectedKeyId Updater Bug](https://github.com/tauri-apps/tauri-action/issues/950)
- [tauri-action #240: No Artifacts Found](https://github.com/tauri-apps/tauri-action/issues/240)
- [esbuild #789: Platform-Specific Binary Strategy](https://github.com/evanw/esbuild/issues/789)
- [npm/cli #4828: Platform-Specific optionalDependencies Lockfile Bug](https://github.com/npm/cli/issues/4828)

### Community/Blog (MEDIUM confidence - cross-verified)
- [Sentry: How to Publish Binaries on npm](https://sentry.engineering/blog/publishing-binaries-on-npm)
- [esbuild optionalDependencies Pattern (DeepWiki)](https://deepwiki.com/evanw/esbuild/6.2-platform-specific-binaries)
- [GitHub Blog: npm Security Token Changes](https://github.blog/changelog/2025-09-29-strengthening-npm-security-important-changes-to-authentication-and-token-management/)
- [mislav/bump-homebrew-formula-action](https://github.com/mislav/bump-homebrew-formula-action)
- [Orhun: Packaging Rust for npm](https://blog.orhun.dev/packaging-rust-for-npm/)
