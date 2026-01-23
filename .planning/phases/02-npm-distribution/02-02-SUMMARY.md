---
phase: 02-npm-distribution
plan: 02
subsystem: cli-installer
tags: [node, cli, download, checksum, platform-detection]
dependency-graph:
  requires: [02-01]
  provides: [complete-cli-installer, platform-detection, checksum-verification]
  affects: [02-03]
tech-stack:
  added: []
  patterns: [redirect-following-download, sha256-verification, platform-specific-launch]
key-files:
  created: []
  modified: [packages/josetunes/bin/josetunes.js]
decisions:
  - id: best-effort-checksum
    choice: "Warn on checksum mismatch but continue installation"
    reason: "Users downloading from GitHub Releases have implicit trust; blocking on checksum would frustrate when SHA256SUMS.txt is missing"
  - id: redirect-limit-5
    choice: "Follow up to 5 redirects for downloads"
    reason: "GitHub releases redirect through multiple layers (github.com -> objects.githubusercontent.com); 5 is generous while preventing infinite loops"
  - id: no-auto-sudo
    choice: "Print dpkg instructions on Linux instead of auto-running"
    reason: "Never escalate privileges without explicit user consent"
metrics:
  duration: ~88s
  completed: 2026-01-23
---

# Phase 02 Plan 02: CLI Download and Platform Detection Summary

**Complete npx installer CLI with platform detection, redirect-following download, SHA256 verification, and platform-specific launch -- zero external dependencies.**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement download and platform detection logic | 382caef | packages/josetunes/bin/josetunes.js |

## What Was Built

The CLI stub from 02-01 was replaced with a fully functional 283-line installer script that handles the complete `npx josetunes` flow:

1. **Platform Detection** - Maps `process.platform-process.arch` to 4 targets (darwin-arm64, darwin-x64, linux-x64, win32-x64) with human-readable labels and correct asset filenames
2. **Download Engine** - HTTPS download with automatic redirect following (GitHub -> S3), progress display using carriage returns, and proper error handling
3. **Checksum Verification** - Downloads SHA256SUMS.txt from the same release, parses it, and verifies the downloaded file hash (best-effort: warns but continues on mismatch or missing checksums)
4. **Installer Launch** - Platform-specific: `open` for macOS DMGs, detached `spawn` for Windows NSIS exe (no terminal blocking), printed `dpkg` instructions for Linux
5. **Error Fallback** - Any failure prints the manual download URL for the releases page

## Key Technical Decisions

- **Zero external dependencies**: Only Node.js built-ins (https, fs, path, os, crypto, child_process) for minimal supply chain risk
- **ES5-compatible function bodies**: Uses `var`, `function`, and Promise constructors (not fetch) for Node 16 compatibility
- **Best-effort checksum**: Verifies when SHA256SUMS.txt is available, warns on mismatch but does not block installation
- **Detached Windows spawn**: Uses `spawn(..., { detached: true, stdio: 'ignore' }).unref()` so the CLI exits immediately after launching the installer

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Node.js syntax check: PASS
- Runtime test: Prints header with version 0.1.0 and platform label, then fails with expected 404 (no release exists), prints fallback URL
- PLATFORM_MAP references: 3
- SHA256/createHash references: 3
- Line count: 283 (minimum 120)

## Next Phase Readiness

Ready for 02-03 (postinstall and npm publish workflow). The CLI is complete and will work end-to-end once GitHub Releases contain the expected asset files.
