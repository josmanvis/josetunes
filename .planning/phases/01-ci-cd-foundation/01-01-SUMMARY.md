---
phase: 01-ci-cd-foundation
plan: 01
subsystem: ci-cd
tags: [github-actions, versioning, tauri, bun]
dependency-graph:
  requires: []
  provides: [tag-triggered-ci, version-validation, cargo-version-source-of-truth]
  affects: [01-02, future-releases]
tech-stack:
  added: [oven-sh/setup-bun@v2]
  patterns: [tag-triggered-releases, cargo-version-as-source-of-truth, version-validation-gate]
key-files:
  created: []
  modified: [src-tauri/Cargo.toml, .github/workflows/main.yml]
decisions:
  - id: cargo-version-sot
    choice: "Cargo.toml is single source of truth for version"
    reason: "Tauri reads version from Cargo.toml when tauri.conf.json has 0.0.0 sentinel"
  - id: tag-trigger
    choice: "v* tags trigger CI instead of branch pushes"
    reason: "Industry standard for desktop apps, encodes version info in trigger"
  - id: bun-package-manager
    choice: "bun for frontend dependencies in CI"
    reason: "Matches local development setup, faster than yarn"
metrics:
  duration: "2 minutes"
  completed: 2026-01-23
---

# Phase 01 Plan 01: CI Tag Trigger and Version Sync Summary

**One-liner:** Tag-triggered CI with Cargo.toml as version source of truth and bun package manager

## What Was Done

### Task 1: Version Synchronization
- Updated `src-tauri/Cargo.toml` version from `0.0.0` to `0.1.0`
- Updated description to "Cross-platform audio downloader"
- Updated authors to `["Jose"]`
- Confirmed `tauri.conf.json` retains `"version": "0.0.0"` sentinel (Tauri v1 reads from Cargo.toml when this value is set)

### Task 2: CI Restructure
- Changed workflow trigger from `push: branches: [release]` to `push: tags: [v*]`
- Added `validate-version` job that extracts tag version and Cargo.toml version, fails build if they don't match
- Added `oven-sh/setup-bun@v2` action and replaced `yarn install` with `bun install`
- Changed tag format from `app-v__VERSION__` to `v__VERSION__`
- Changed release name from `App v__VERSION__` to `JoseTunes v__VERSION__`
- Set `releaseDraft: false` for non-draft releases
- Build job (`publish-tauri`) now depends on `validate-version` via `needs:`

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Version source of truth | Cargo.toml | Tauri v1 reads from Cargo.toml when tauri.conf.json has 0.0.0 |
| CI trigger | v* tags | Industry standard, encodes version in trigger |
| Package manager | bun | Matches local dev setup, faster than yarn |
| Release format | Non-draft, v{VERSION} | Clean releases without manual publish step |

## Deviations from Plan

None - plan executed exactly as written.

## Release Workflow

After this change, the release workflow is:
1. Developer updates version in `src-tauri/Cargo.toml`
2. Commits the change
3. Creates git tag: `git tag v0.1.0`
4. Pushes tag: `git push origin v0.1.0`
5. CI validates tag matches Cargo.toml, then builds for all platforms
6. GitHub Release is created automatically with platform binaries

## Next Phase Readiness

- CI is ready to build on tag push
- Version validation prevents mismatched releases
- Plan 01-02 (Cargo.lock and lockfile management) can proceed independently
