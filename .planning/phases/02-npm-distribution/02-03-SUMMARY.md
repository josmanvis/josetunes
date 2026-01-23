---
phase: 02-npm-distribution
plan: 03
subsystem: ci-cd
tags: [npm, oidc, github-actions, publish, ci]
dependency-graph:
  requires: ["02-01", "02-02"]
  provides: ["npm-publish-automation"]
  affects: ["03-homebrew-distribution"]
tech-stack:
  added: []
  patterns: ["oidc-trusted-publishing", "version-stamping-from-tag"]
key-files:
  created: []
  modified: [".github/workflows/main.yml"]
decisions:
  - OIDC over npm tokens for publish auth
  - Version stamped from git tag at publish time
  - Node 24.x for publish job
metrics:
  duration: ~38s
  completed: 2026-01-23
status: checkpoint-paused
---

# Phase 2 Plan 3: npm Publish CI Job Summary

**One-liner:** OIDC-based npm publish job appended to CI workflow, triggered after GitHub Release creation.

## What Was Done

### Task 1: Add publish-npm job to CI workflow (COMPLETE)

Added a `publish-npm` job as the 4th job in the CI pipeline:

- **Dependency chain:** validate-version -> build -> release -> publish-npm
- **OIDC auth:** Uses `id-token: write` permission for npm Trusted Publishing (no secrets/tokens needed)
- **Version stamping:** Extracts version from git tag (`v*` -> `*`) and stamps package.json before publish
- **Node 24.x:** Uses latest Node for the publish step
- **Registry:** Configured with `registry-url: https://registry.npmjs.org`
- **Publish command:** `npm publish --access public` from `packages/josetunes`

### Task 2: Verify npm OIDC setup requirements (CHECKPOINT - AWAITING)

Paused for human verification of npm OIDC Trusted Publisher configuration.

## Deviations from Plan

None - plan executed exactly as written.

## Key Implementation Details

The publish-npm job runs only after a successful release (all build artifacts uploaded and GitHub Release created). The OIDC approach means:

1. No npm tokens stored as GitHub secrets
2. Authentication is tied to the specific repository and workflow
3. More secure than long-lived tokens (short-lived, scoped)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 73cf505 | feat(02-03): add publish-npm job to CI workflow |

## Next Steps (after checkpoint)

Once the human verifies:
1. Initial placeholder package published to npm
2. OIDC Trusted Publisher configured on npmjs.com
3. The pipeline will be ready for the first tag push

## Next Phase Readiness

Phase 3 (Homebrew distribution) can proceed independently of this checkpoint since it uses GitHub Releases (not npm) as its artifact source.
