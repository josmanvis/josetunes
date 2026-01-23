---
phase: 03-homebrew-tap
plan: 01
subsystem: distribution
tags: [homebrew, cask, tap, macos, github-actions]
dependency-graph:
  requires: [01-01, 01-02]
  provides: [homebrew-tap, cask-definition, cask-auto-update]
  affects: [03-02]
tech-stack:
  added: []
  patterns: [homebrew-cask-dsl, cross-repo-workflow-dispatch, heredoc-template-with-sed]
key-files:
  created:
    - ../homebrew-josetunes/Casks/josetunes.rb
    - ../homebrew-josetunes/.github/workflows/update-cask.yml
    - ../homebrew-josetunes/README.md
  modified: []
decisions:
  - id: placeholder-sha256
    choice: "Use PLACEHOLDER_WILL_BE_UPDATED_BY_CI as initial SHA256 value"
    reason: "No release exists yet; first workflow_dispatch run will set real checksums"
  - id: quoted-heredoc-with-sed
    choice: "Single-quoted heredoc ('CASK') + sed substitution for cask generation"
    reason: "Prevents shell from expanding Ruby #{version} interpolation while allowing SHA256/version injection via sed"
  - id: retry-loop-for-assets
    choice: "5 attempts with 30s sleep for release asset availability"
    reason: "GitHub Release asset uploads can lag behind release creation"
metrics:
  duration: "~100s"
  completed: "2026-01-23"
---

# Phase 3 Plan 1: Homebrew Tap Repository Summary

**One-liner:** Custom Homebrew tap with architecture-aware cask and automated SHA256 update workflow via workflow_dispatch

## What Was Done

Created the complete `josmanvis/homebrew-josetunes` GitHub repository containing:

1. **Cask Definition** (`Casks/josetunes.rb`) - Homebrew cask with `on_arm`/`on_intel` blocks targeting architecture-specific DMG files from GitHub Releases. Includes unsigned app Gatekeeper caveats and zap cleanup paths.

2. **Update Workflow** (`.github/workflows/update-cask.yml`) - Triggered via `workflow_dispatch` with a version input. Downloads both DMGs, computes SHA256 checksums, regenerates the cask file using a quoted heredoc template with sed substitution, and commits/pushes the update.

3. **README** - Documents one-liner and two-step installation, Gatekeeper workaround, and upgrade command.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create tap repository structure with cask definition | 9b69685 | Casks/josetunes.rb, README.md |
| 2 | Add automated cask update workflow | c155dee | .github/workflows/update-cask.yml |
| 3 | Push tap repository to GitHub | (push to remote) | josmanvis/homebrew-josetunes |

## Decisions Made

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Initial SHA256 values | Placeholder strings | No release exists yet; update workflow will set real values |
| Heredoc strategy | Single-quoted delimiter + sed | Prevents Ruby `#{version}` expansion, allows shell var injection |
| Asset availability | Retry loop (5x, 30s intervals) | Handles GitHub Release upload lag |

## Deviations from Plan

None - plan executed exactly as written.

## Architecture Notes

- The tap repo lives at `/Users/jose/Developer/homebrew-josetunes` (sibling to main project)
- Remote: `https://github.com/josmanvis/homebrew-josetunes`
- Installation: `brew install josmanvis/josetunes/josetunes`
- The update workflow expects to be triggered by the main repo's release workflow via `gh workflow run` with a `HOMEBREW_TAP_TOKEN` secret (PAT with `actions:write` scope on the tap repo)

## Next Phase Readiness

- **For 03-02:** The tap update workflow is ready. Plan 03-02 needs to add the cross-repo trigger step to the main repo's release workflow (`.github/workflows/main.yml`) and document the `HOMEBREW_TAP_TOKEN` secret requirement.
- **Blocker:** A PAT with `actions:write` scope on `josmanvis/homebrew-josetunes` must be created and stored as `HOMEBREW_TAP_TOKEN` secret in the main repo before the trigger will work.

## Verification Results

All 7 verification criteria passed:
1. Cask file exists at expected path
2. Workflow file exists at expected path
3. README exists at expected path
4. Remote repo confirmed public on GitHub
5. Cask contains `on_arm` and `on_intel` blocks
6. Cask URLs match GitHub Release pattern
7. Workflow has `workflow_dispatch` trigger with version input
