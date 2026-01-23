# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Users can paste a URL and get high-quality audio files on their machine with minimal friction.

**Current focus:** Phase 2 - npm Distribution

## Current Position

Phase: 2 of 4 (npm Distribution)
Plan: 3 of 3 in progress (02-01, 02-02 done, 02-03 checkpoint-paused)
Status: Checkpoint paused — awaiting npm OIDC setup verification
Last activity: 2026-01-23 — Executing 02-03-PLAN.md (Task 1 complete, Task 2 checkpoint)

Progress: [██████░░░░] 64%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~1.1 minutes
- Total execution time: ~0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-ci-cd-foundation | 2/2 | ~3min | ~1.5min |
| 02-npm-distribution | 2/3 | ~2.3min | ~1.1min |

**Recent Trend:**
- Last 5 plans: 01-01 (~2min), 01-02 (~1min), 02-01 (~46s), 02-02 (~88s)
- Trend: Accelerating

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- npm via platform-specific packages — Same pattern as esbuild for native binary distribution
- Custom Homebrew tap over core — Faster to ship, no review process, full control
- Version 0.1.0 — Early release, signals expect changes
- Automated releases on tag push — Removes manual steps, ensures consistent builds
- Fan-in release pattern — Prevents race conditions from parallel matrix jobs creating releases
- SHA256 checksums in releases — Standard verification for download integrity
- Zero npm dependencies for installer — Uses only Node.js built-ins to minimize supply chain risk
- Node >=16.0.0 engine requirement — Matches LTS support window
- Files whitelist over .npmignore — More explicit control of published package contents
- Best-effort checksum verification — Warns on SHA256 mismatch but continues (does not block install)
- No auto-sudo on Linux — Prints dpkg instructions for user to run manually
- Redirect limit of 5 — Handles GitHub multi-layer redirects safely
- OIDC over npm tokens — Uses Trusted Publishing for npm auth (no secrets needed)
- Version stamped from git tag — Package version set at publish time from tag ref

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-23T20:52Z
Stopped at: 02-03-PLAN.md checkpoint (Task 2: npm OIDC setup verification)
Resume file: None
