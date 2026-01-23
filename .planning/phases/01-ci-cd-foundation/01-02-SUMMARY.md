# Phase 01 Plan 02: Fan-in Release Pipeline Summary

**One-liner:** Fan-in CI pattern with parallel build matrix uploading artifacts to a single release job that generates SHA256 checksums and creates one GitHub Release via softprops/action-gh-release@v2.

## Metadata

- **Phase:** 01-ci-cd-foundation
- **Plan:** 02
- **Subsystem:** CI/CD
- **Tags:** github-actions, fan-in, artifacts, checksums, release
- **Duration:** ~1 minute
- **Completed:** 2026-01-23

## Dependency Graph

- **Requires:** 01-01 (tag trigger and version validation)
- **Provides:** Race-condition-free release pipeline with checksum verification
- **Affects:** Future release workflows, distribution channels

## Tech Tracking

### Patterns Established

- Fan-in CI pattern: parallel build -> single release collector
- Artifact-based job communication (upload-artifact/download-artifact)
- SHA256 checksum generation for release integrity verification

### Actions Used

- `actions/upload-artifact@v4` (build jobs)
- `actions/download-artifact@v4` with `merge-multiple: true` (release job)
- `softprops/action-gh-release@v2` (release creation)

## What Was Done

### Task 1: Convert build matrix to artifact-uploading jobs

- Renamed `publish-tauri` job to `build`
- Removed tauri-action release fields (tagName, releaseName, releaseBody, releaseDraft, prerelease)
- Removed GITHUB_TOKEN env from tauri-action (not needed for build-only)
- Added `Upload build artifacts` step with platform-specific naming pattern
- Artifact paths cover: .dmg, .app.tar.gz, .sig (macOS), .deb, .AppImage (Linux), .msi, .exe (Windows)
- Commit: `018cb97`

### Task 2: Add fan-in release job with checksums

- Added `release` job with `needs: build` dependency
- Downloads all artifacts with merge-multiple into single directory
- Flattens nested artifact paths into release-assets/
- Generates SHA256SUMS.txt covering all release files
- Creates GitHub Release with platform download table in body
- Includes verification instructions (`sha256sum -c SHA256SUMS.txt`)
- Commit: `29c45af`

## Key Files

### Modified

- `.github/workflows/main.yml` — Three-stage pipeline: validate-version -> build (4 parallel) -> release (single)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| softprops/action-gh-release@v2 over tauri-action for release | Decouples build from release, prevents race conditions |
| merge-multiple: true for artifact download | Simplifies artifact collection into single directory |
| SHA256SUMS.txt as separate release asset | Standard verification format, users can verify with one command |
| Artifact naming with strategy.job-index | Prevents naming collisions between matrix jobs on same platform |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. Workflow has 3 jobs: validate-version, build, release -- PASS
2. build needs validate-version; release needs build -- PASS (2 needs: statements)
3. Build matrix has 4 entries -- PASS
4. Build jobs upload artifacts (no release creation) -- PASS
5. Release job downloads artifacts, generates checksums, creates release -- PASS
6. softprops/action-gh-release@v2 used -- PASS
7. SHA256SUMS.txt included in release assets -- PASS
8. No race condition possible (single release job) -- PASS
9. YAML is valid syntax -- PASS (validated with Python yaml parser)

## Next Phase Readiness

Phase 01 CI/CD Foundation is now complete:
- Plan 01-01: Tag-triggered workflow with version validation
- Plan 01-02: Fan-in release pipeline with checksums

The workflow is ready for testing with a real tag push (e.g., `v0.1.0`).
