---
phase: 03-homebrew-tap
plan: 02
subsystem: infra
tags: [github-actions, homebrew, ci-cd, cross-repo]
requires: ["03-01"]
provides: ["automated-tap-updates"]
affects: []
tech-stack:
  added: []
  patterns: ["cross-repo-workflow-dispatch"]
key-files:
  created: []
  modified: [".github/workflows/main.yml"]
key-decisions:
  - "Use gh workflow run for cross-repo triggering (not repository_dispatch)"
  - "Fine-grained PAT scoped to tap repo only"
metrics:
  duration: "~1 min"
  completed: "2026-01-23"
---

# Phase 3 Plan 2: Add Cross-Repo Trigger Summary

Added Homebrew tap trigger step to main CI release workflow, completing the automation chain.

## Accomplishments

- Added "Trigger Homebrew tap update" step to release job in `.github/workflows/main.yml`
- Step fires after GitHub Release creation, dispatches `update-cask.yml` in `josmanvis/homebrew-josetunes`
- Uses `HOMEBREW_TAP_TOKEN` secret (Fine-Grained PAT with Actions read+write on tap repo)
- Version stripped of `v` prefix and passed as workflow_dispatch input

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/main.yml` | Modified | Added trigger step after release creation |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

- Fine-Grained PAT (repo-scoped) used over classic PAT for better security

## Performance

- Duration: ~1 min
- Tasks: 2/2 (1 auto + 1 checkpoint)
- Commit: d0f2fb7

## Next Step

Phase 3 complete. Ready for Phase 4 (Documentation).
