# Phase 3: Homebrew Tap - Research

**Researched:** 2026-01-23
**Domain:** Homebrew Cask distribution for macOS (custom tap)
**Confidence:** HIGH

## Summary

This phase creates a custom Homebrew tap repository (`josmanvis/homebrew-josetunes`) containing a cask definition that allows macOS users to install JoseTunes via `brew install josetunes/tap/josetunes`. The cask must support both Apple Silicon (aarch64) and Intel (x64) architectures, referencing architecture-specific `.dmg` files from GitHub Releases.

The standard approach uses a separate GitHub repository named `homebrew-josetunes` containing a `Casks/josetunes.rb` file with `on_arm`/`on_intel` blocks for architecture-specific URLs and SHA256 checksums. Automated updates are achieved by having the main repository's release workflow trigger a `workflow_dispatch` event in the tap repository via GitHub CLI, which downloads the new release artifacts, computes SHA256 checksums, updates the cask file, and pushes the changes.

Key considerations: The app is unsigned/unnotarized (no Apple Developer certificate), so Homebrew's official `homebrew-cask` tap would reject it. A custom tap is the correct approach. Users will need to manually bypass Gatekeeper after installation. The `--no-quarantine` flag is being deprecated in Homebrew 5.0.0, so the cask should not rely on it.

**Primary recommendation:** Create a `josmanvis/homebrew-josetunes` repository with `Casks/josetunes.rb` using `on_arm`/`on_intel` blocks, and add a `workflow_dispatch`-triggered workflow to auto-update version/SHA256 when new releases are published.

## Standard Stack

The established tools for this domain:

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Homebrew Cask DSL | Current (Ruby) | Define macOS app installation | Official Homebrew format for GUI apps |
| GitHub CLI (`gh`) | Latest | Cross-repo workflow triggering | Built into GitHub Actions runners, simpler than repository_dispatch |
| `shasum` | System | SHA256 checksum computation | Standard Unix tool, available on all runners |
| `curl` | System | Download release artifacts for checksumming | Available on all runners, handles redirects |
| `sed` | System | Update cask file version/SHA256 | Inline file editing in CI scripts |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `actions/checkout@v4` | Checkout tap repository in CI | Every workflow run |
| `softprops/action-gh-release@v2` | (Already used) Creates the GitHub Release with artifacts | Already in main CI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `on_arm`/`on_intel` blocks | `arch` interpolation DSL | `arch` only works when SHA256 differs; `on_arm`/`on_intel` is clearer for separate URLs AND checksums |
| `workflow_dispatch` + `gh` | `repository_dispatch` event | `repository_dispatch` only triggers on default branch; `workflow_dispatch` is more flexible and debuggable |
| `sed` for file updates | Regenerate entire file with heredoc | Heredoc is simpler, less error-prone than sed regex patterns |
| Manual SHA256 in cask | `sha256 :no_check` | NEVER use `:no_check` for security; always verify checksums |

**No package installation needed** -- this phase creates repository structure and GitHub Actions workflows, not application code.

## Architecture Patterns

### Recommended Tap Repository Structure
```
homebrew-josetunes/                    # Repository: josmanvis/homebrew-josetunes
├── Casks/
│   └── josetunes.rb                   # Cask definition
├── .github/
│   └── workflows/
│       └── update-cask.yml            # Auto-update workflow
└── README.md                          # Installation instructions
```

### Pattern 1: Architecture-Specific Cask with `on_arm`/`on_intel`
**What:** Separate URL and SHA256 blocks per CPU architecture
**When to use:** When the download URL and checksum differ between arm64 and x64 (which they do for Tauri apps)
**Example:**
```ruby
# Source: https://docs.brew.sh/Cask-Cookbook (architecture-specific configuration)
cask "josetunes" do
  version "0.1.0"

  on_arm do
    url "https://github.com/josmanvis/josetunes/releases/download/v#{version}/josetunes_#{version}_aarch64.dmg"
    sha256 "PLACEHOLDER_ARM64_SHA256"
  end

  on_intel do
    url "https://github.com/josmanvis/josetunes/releases/download/v#{version}/josetunes_#{version}_x64.dmg"
    sha256 "PLACEHOLDER_X64_SHA256"
  end

  name "JoseTunes"
  desc "Cross-platform desktop audio downloader"
  homepage "https://github.com/josmanvis/josetunes"

  app "josetunes.app"

  zap trash: [
    "~/Library/Caches/com.crativo.tunerip",
    "~/Library/Preferences/com.crativo.tunerip.plist",
    "~/Library/WebKit/com.crativo.tunerip",
  ]
end
```

### Pattern 2: Cross-Repository Workflow Dispatch for Auto-Updates
**What:** Main repo triggers tap repo update on new release
**When to use:** When you want the cask to auto-update without manual intervention
**Example (in main repo CI, after release step):**
```yaml
# Source: https://josh.fail/2023/automate-updating-custom-homebrew-formulae-with-github-actions/
- name: Trigger Homebrew tap update
  run: |
    gh workflow run update-cask.yml \
      -f version=${GITHUB_REF_NAME#v} \
      -R josmanvis/homebrew-josetunes
  env:
    GITHUB_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
```

### Pattern 3: Tap Update Workflow (SHA256 Computation)
**What:** Workflow in tap repo that downloads artifacts, computes SHA256, updates cask
**When to use:** Triggered by workflow_dispatch from main repo
**Example:**
```yaml
# Source: https://builtfast.dev/blog/automating-homebrew-tap-updates-with-github-actions/
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (without v prefix)'
        required: true
        type: string

jobs:
  update-cask:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Compute SHA256 checksums
        run: |
          VERSION="${{ github.event.inputs.version }}"
          BASE_URL="https://github.com/josmanvis/josetunes/releases/download/v${VERSION}"

          SHA_ARM=$(curl -sL "${BASE_URL}/josetunes_${VERSION}_aarch64.dmg" | shasum -a 256 | awk '{print $1}')
          SHA_INTEL=$(curl -sL "${BASE_URL}/josetunes_${VERSION}_x64.dmg" | shasum -a 256 | awk '{print $1}')

          echo "SHA_ARM=${SHA_ARM}" >> $GITHUB_ENV
          echo "SHA_INTEL=${SHA_INTEL}" >> $GITHUB_ENV
          echo "VERSION=${VERSION}" >> $GITHUB_ENV

      - name: Update cask file
        run: |
          cat > Casks/josetunes.rb << EOF
          cask "josetunes" do
            version "${VERSION}"
            # ... regenerate entire file
          EOF

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Casks/josetunes.rb
          git commit -m "Update josetunes to ${VERSION}"
          git push
```

### Anti-Patterns to Avoid
- **Using `sha256 :no_check`:** Never skip checksum verification. Always compute and include real SHA256 values.
- **Hardcoding architecture in tap name:** The cask itself handles architecture selection. Do not create separate casks per architecture.
- **Using `repository_dispatch`:** It only works on the default branch and is harder to debug than `workflow_dispatch`.
- **Relying on `--no-quarantine`:** This flag is deprecated in Homebrew 5.0.0. Document the Gatekeeper workaround in README instead.
- **Using `GITHUB_TOKEN` for cross-repo triggers:** The default `GITHUB_TOKEN` cannot trigger workflows in other repositories. A PAT with `actions:write` scope is required.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA256 computation | Custom hash script | `curl -sL URL \| shasum -a 256 \| awk '{print $1}'` | Standard Unix pipeline, handles redirects, streaming |
| Cross-repo triggering | Custom webhook or API call | `gh workflow run` | Built into GitHub CLI, handles auth, available in Actions |
| Cask file generation | Template engine | Heredoc (`cat << EOF`) | Ruby files are simple text; no templating needed |
| Version extraction | Regex parsing | `${GITHUB_REF_NAME#v}` | Bash parameter expansion strips `v` prefix cleanly |

**Key insight:** Homebrew cask files are simple Ruby DSL. The automation challenge is SHA256 computation and cross-repo triggering, not cask complexity. Use standard Unix tools and GitHub CLI rather than building custom solutions.

## Common Pitfalls

### Pitfall 1: Wrong PAT Permissions for Cross-Repo Triggering
**What goes wrong:** The release workflow in the main repo fails to trigger the tap update because `GITHUB_TOKEN` cannot dispatch workflows in other repositories.
**Why it happens:** `GITHUB_TOKEN` is scoped to the current repository only.
**How to avoid:** Create a Personal Access Token (or Fine-Grained Token) with `actions:write` permission on the tap repository. Store it as `HOMEBREW_TAP_TOKEN` secret in the main repo.
**Warning signs:** "Resource not accessible by integration" error in the release workflow.

### Pitfall 2: SHA256 Mismatch Due to GitHub Release Asset Not Ready
**What goes wrong:** The tap update workflow runs before release assets are fully uploaded, resulting in a 404 or partial download that produces an incorrect SHA256.
**Why it happens:** The cross-repo trigger fires immediately after the release step, but asset uploads may still be in progress.
**How to avoid:** Add a retry/wait loop or use `gh release view` to verify assets exist before downloading. Alternatively, add a delay or only trigger after confirming release status.
**Warning signs:** SHA256 changes on subsequent downloads, or `curl` returns HTML error page instead of binary.

### Pitfall 3: DMG Filename Mismatch in Cask URL
**What goes wrong:** The cask URL does not match the actual filename in GitHub Releases, causing installation to fail with a 404.
**Why it happens:** Tauri's DMG naming uses `productName` from `tauri.conf.json` -- mismatched casing or underscores break the URL.
**How to avoid:** Verify exact filenames from a real release. For this project: `josetunes_{version}_aarch64.dmg` and `josetunes_{version}_x64.dmg` (all lowercase, underscores).
**Warning signs:** `brew install` fails with "Download failed" or HTTP 404.

### Pitfall 4: Cask Token Uniqueness
**What goes wrong:** Homebrew rejects the cask because the token (filename minus `.rb`) conflicts with an existing cask in `homebrew-cask`.
**Why it happens:** Homebrew requires globally unique cask tokens across all taps.
**How to avoid:** Check `brew info --cask josetunes` before publishing. If conflicted, prefix with username: `josmanvis-josetunes`.
**Warning signs:** `brew audit` warnings about token conflicts.

### Pitfall 5: App Bundle Name Inside DMG
**What goes wrong:** The `app` stanza in the cask references the wrong `.app` name, causing "Application not found" errors.
**Why it happens:** Tauri uses `productName` as-is for the `.app` bundle name. If `productName` is `josetunes`, the app is `josetunes.app`.
**How to avoid:** Verify by mounting a built DMG locally: `hdiutil attach josetunes_0.1.0_aarch64.dmg` and `ls /Volumes/*/`.
**Warning signs:** `brew install` succeeds but no app appears in `/Applications/`.

### Pitfall 6: Unsigned App Gatekeeper Block
**What goes wrong:** Users install via `brew install` but macOS blocks the app from opening with "cannot be opened because the developer cannot be verified."
**Why it happens:** The app is not signed with an Apple Developer certificate or notarized.
**How to avoid:** Document the workaround clearly in the tap README: `xattr -cr /Applications/josetunes.app`. Consider adding a `caveats` block to the cask.
**Warning signs:** User reports of "app is damaged" or "developer cannot be verified."

## Code Examples

Verified patterns from official sources:

### Complete Cask Definition (josetunes.rb)
```ruby
# Source: https://docs.brew.sh/Cask-Cookbook
cask "josetunes" do
  version "0.1.0"

  on_arm do
    url "https://github.com/josmanvis/josetunes/releases/download/v#{version}/josetunes_#{version}_aarch64.dmg"
    sha256 "PLACEHOLDER_ARM64_SHA256"
  end

  on_intel do
    url "https://github.com/josmanvis/josetunes/releases/download/v#{version}/josetunes_#{version}_x64.dmg"
    sha256 "PLACEHOLDER_X64_SHA256"
  end

  name "JoseTunes"
  desc "Cross-platform desktop audio downloader"
  homepage "https://github.com/josmanvis/josetunes"

  app "josetunes.app"

  caveats <<~EOS
    josetunes is not signed with an Apple Developer certificate.
    On first launch, macOS may block the app. To allow it, run:
      xattr -cr /Applications/josetunes.app
  EOS

  zap trash: [
    "~/Library/Caches/com.crativo.tunerip",
    "~/Library/Preferences/com.crativo.tunerip.plist",
    "~/Library/WebKit/com.crativo.tunerip",
  ]
end
```

### Tap Update Workflow (update-cask.yml in tap repo)
```yaml
# Source: https://builtfast.dev/blog/automating-homebrew-tap-updates-with-github-actions/
name: Update Cask

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (without v prefix)'
        required: true
        type: string

jobs:
  update-cask:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Download and compute SHA256
        run: |
          VERSION="${{ github.event.inputs.version }}"
          BASE_URL="https://github.com/josmanvis/josetunes/releases/download/v${VERSION}"

          # Wait for release assets to be available
          for i in {1..5}; do
            STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "${BASE_URL}/josetunes_${VERSION}_aarch64.dmg")
            if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
              break
            fi
            echo "Waiting for release assets... (attempt $i)"
            sleep 30
          done

          SHA_ARM=$(curl -sL "${BASE_URL}/josetunes_${VERSION}_aarch64.dmg" | shasum -a 256 | awk '{print $1}')
          SHA_INTEL=$(curl -sL "${BASE_URL}/josetunes_${VERSION}_x64.dmg" | shasum -a 256 | awk '{print $1}')

          echo "ARM64 SHA256: ${SHA_ARM}"
          echo "x64 SHA256: ${SHA_INTEL}"

          echo "VERSION=${VERSION}" >> $GITHUB_ENV
          echo "SHA_ARM=${SHA_ARM}" >> $GITHUB_ENV
          echo "SHA_INTEL=${SHA_INTEL}" >> $GITHUB_ENV

      - name: Generate cask file
        run: |
          cat > Casks/josetunes.rb << CASK
          cask "josetunes" do
            version "${VERSION}"

            on_arm do
              url "https://github.com/josmanvis/josetunes/releases/download/v#{version}/josetunes_#{version}_aarch64.dmg"
              sha256 "${SHA_ARM}"
            end

            on_intel do
              url "https://github.com/josmanvis/josetunes/releases/download/v#{version}/josetunes_#{version}_x64.dmg"
              sha256 "${SHA_INTEL}"
            end

            name "JoseTunes"
            desc "Cross-platform desktop audio downloader"
            homepage "https://github.com/josmanvis/josetunes"

            app "josetunes.app"

            caveats <<~EOS
              josetunes is not signed with an Apple Developer certificate.
              On first launch, macOS may block the app. To allow it, run:
                xattr -cr /Applications/josetunes.app
            EOS

            zap trash: [
              "~/Library/Caches/com.crativo.tunerip",
              "~/Library/Preferences/com.crativo.tunerip.plist",
              "~/Library/WebKit/com.crativo.tunerip",
            ]
          end
          CASK

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Casks/josetunes.rb
          git commit -m "Update josetunes to ${VERSION}"
          git push

```

### Cross-Repo Trigger (added to main repo release workflow)
```yaml
# Source: https://josh.fail/2023/automate-updating-custom-homebrew-formulae-with-github-actions/
# Add after the 'Create GitHub Release' step in .github/workflows/main.yml
- name: Trigger Homebrew tap update
  run: |
    VERSION=${GITHUB_REF_NAME#v}
    gh workflow run update-cask.yml \
      -f version=${VERSION} \
      -R josmanvis/homebrew-josetunes
  env:
    GITHUB_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
```

### User Installation Commands
```bash
# First-time installation
brew install josmanvis/josetunes/josetunes

# Or tap first, then install
brew tap josmanvis/josetunes
brew install --cask josetunes

# After Gatekeeper blocks the app
xattr -cr /Applications/josetunes.app

# Upgrade to new version
brew upgrade --cask josetunes
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--no-quarantine` flag | Deprecated; code signing required for official taps | Homebrew 5.0.0 (2025) | Custom taps still work for unsigned apps, but users must manually clear quarantine |
| `sha256 arm:, intel:` only | `on_arm`/`on_intel` blocks | Homebrew/brew PR #13703 (2022) | Preferred when URL also differs per arch |
| `repository_dispatch` | `workflow_dispatch` + `gh` CLI | 2023+ community consensus | More reliable, debuggable, not limited to default branch |
| Manual cask updates | Automated via GitHub Actions | 2023+ | Eliminates manual version/SHA updates |

**Deprecated/outdated:**
- `--no-quarantine`: Being removed from Homebrew; don't document as installation method
- `if Hardware::CPU.intel?` in cask files: Replaced by `on_arm`/`on_intel` blocks (enforced by rubocops)
- `cask "token" do ... end` without version: Always include explicit version

## Open Questions

1. **Exact `.app` bundle name in DMG**
   - What we know: `productName` in `tauri.conf.json` is `"josetunes"` (lowercase), so the app should be `josetunes.app`
   - What's unclear: Whether Tauri capitalizes it or keeps it exactly as configured
   - Recommendation: Verify by building locally or checking a real release artifact before finalizing the cask. Use `josetunes.app` as the working assumption.

2. **Cask token uniqueness**
   - What we know: The token `josetunes` must be globally unique across all Homebrew taps
   - What's unclear: Whether any existing cask uses this token
   - Recommendation: Check `brew info --cask josetunes` before publishing. Likely unique since the app is new.

3. **PAT vs Fine-Grained Token for cross-repo**
   - What we know: A token with `actions:write` scope on the tap repo is needed
   - What's unclear: Whether a Fine-Grained PAT (more secure, repo-scoped) works for `gh workflow run` or if a classic PAT is required
   - Recommendation: Try Fine-Grained PAT first (scoped to `josmanvis/homebrew-josetunes` with Actions read/write). Fall back to classic PAT if it fails.

4. **Release asset availability timing**
   - What we know: There can be a delay between release creation and asset availability
   - What's unclear: Exact delay for GitHub Releases with multiple large DMG files
   - Recommendation: Include retry loop (shown in code examples) with 30-second intervals, up to 5 attempts

## Sources

### Primary (HIGH confidence)
- [Homebrew Tap Documentation](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) - Tap creation, naming, directory structure
- [Homebrew Cask Cookbook](https://docs.brew.sh/Cask-Cookbook) - Cask DSL reference, `on_arm`/`on_intel`, `sha256`, `arch` stanza
- [Homebrew/brew PR #13703](https://github.com/Homebrew/brew/pull/13703) - `on_arch` blocks and `sha256 arm:, intel:` usage

### Secondary (MEDIUM confidence)
- [BuiltFast: Automating Homebrew Tap Updates](https://builtfast.dev/blog/automating-homebrew-tap-updates-with-github-actions/) - Cross-repo workflow pattern, SHA256 computation
- [josh.fail: Automate Custom Homebrew Formulae](https://josh.fail/2023/automate-updating-custom-homebrew-formulae-with-github-actions/) - `gh workflow run` pattern, heredoc file generation
- [Homebrew/brew #20755](https://github.com/Homebrew/brew/issues/20755) - `--no-quarantine` deprecation details
- [Tauri v1 macOS Bundle docs](https://v1.tauri.app/v1/guides/building/macos/) - DMG naming, productName behavior

### Tertiary (LOW confidence)
- Various GitHub examples of Tauri casks (ChatGPT desktop, Tauri-Deduper) - Pattern confirmation but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Homebrew documentation is definitive
- Architecture: HIGH - Cask DSL is well-documented, multiple verified sources agree
- Pitfalls: HIGH - PAT requirements and unsigned app behavior are well-documented
- Automation pattern: MEDIUM - Community patterns verified with multiple sources but not official Homebrew documentation

**Research date:** 2026-01-23
**Valid until:** 2026-03-23 (Homebrew cask DSL is stable; 60 days is reasonable)
