# Codebase Concerns

**Analysis Date:** 2026-01-23

## Tech Debt

**State Management Refactoring Needed:**
- Issue: Batch download handling incomplete. Code comment explicitly marks this area as needing rework: "TODO: needs to be reworked after the switch to batch downloads"
- Files: `src/contexts/app-state.tsx:10`
- Impact: `currentlyDownloading` state is global boolean and doesn't accurately track multiple concurrent downloads. Prevents proper batch download workflow.
- Fix approach: Refactor state to track per-task download status rather than global flag. Move to task-level status management in the download list.

**Race Condition in Download Sequencing:**
- Issue: `startAllDownloadTasks` loops through tasks and invokes `startDownloadTask` for each, but each task has a 200ms setTimeout before invoking Rust. No queuing or sequential guarantee.
- Files: `src/contexts/app-state.tsx:72-76` (startAllDownloadTasks), `src/contexts/app-state.tsx:52-70` (startDownloadTask)
- Impact: Multiple downloads may start simultaneously, potentially overwhelming yt-dlp or system resources. User receives no feedback on actual concurrency limits.
- Fix approach: Implement async queue with configurable concurrency limit. Add promise chains or use task pool pattern to ensure ordered downloads.

**Arbitrary setTimeout Delay:**
- Issue: 200ms hardcoded setTimeout before invoking download_audio command with no documented reason
- Files: `src/contexts/app-state.tsx:55`
- Impact: Introduces unexplained latency in user workflows. If removed or changed, behavior is unpredictable.
- Fix approach: Remove setTimeout and immediately invoke IPC command, or document why delay is necessary and make it configurable.

**Overly Permissive Type Safety:**
- Issue: Widespread use of `any` type throughout codebase instead of proper TypeScript interfaces
- Files: `src/App.tsx:28`, `src/contexts/app-state.tsx:7,43`, `src/components/*.tsx` (16+ instances), `src/containers/*.tsx` (multiple instances)
- Impact: Loss of compile-time type checking on context usage. Props types are unchecked. Refactoring breaks silently at runtime.
- Fix approach: Create proper TypeScript interface for AppStateContext. Type all component props instead of using `any`. Use `useContext<AppContextType>(AppStateContext)`.

## Known Bugs

**Hardcoded Download Path with Tilde Expansion Issue:**
- Symptoms: Files may not save to correct location on non-Unix systems. Tilde (~) expansion may not work in yt-dlp subprocess context.
- Files: `src-tauri/src/commands.rs:28`
- Trigger: Running download_audio command on Windows or in certain shell environments
- Workaround: Manually expand ~ to full home directory path using proper Tauri/Rust APIs before passing to yt-dlp

**Incomplete BPM Detection:**
- Symptoms: BPM command returns hardcoded "BPM" string. Feature stub never implemented.
- Files: `src-tauri/src/bpm.rs:1-12`
- Trigger: Any call to get_bpm command
- Workaround: None. Command registered but non-functional. UI does not expose this feature yet.

**Boolean Success Check Doesn't Capture Error Details:**
- Symptoms: Download command returns "true" or "false" string instead of descriptive error. Frontend cannot distinguish between different failure modes.
- Files: `src-tauri/src/commands.rs:33`
- Trigger: When yt-dlp process fails for any reason (missing binary, invalid URL, format unavailable, etc.)
- Workaround: Check frontend console logs to see rust stderr output. User sees only "failed" status.

**Shell Injection Vulnerability in fetch_artwork_html:**
- Symptoms: HTTP request is made to user-provided URL without validation or scheme verification
- Files: `src-tauri/src/commands.rs:47-65`
- Trigger: User URL from search field is passed directly to reqwest::get() without sanitization
- Workaround: Carefully validate input before using. Restrict to HTTPS only in frontend validation.

## Security Considerations

**External Binary Dependency Without Fallback:**
- Risk: Application completely depends on yt-dlp being in system PATH. No version pinning, no hash verification, no fallback mechanism.
- Files: `src-tauri/src/commands.rs:19`
- Current mitigation: None documented. CI/CD and distribution do not package yt-dlp.
- Recommendations:
  - Bundle yt-dlp binary with application or verify it exists at startup
  - Add version check and hash verification of yt-dlp binary
  - Provide clear error message if binary not found instead of panic
  - Document installation requirements prominently

**Unwrap/Expect Without Graceful Error Handling:**
- Risk: Three instances of `.expect()` that will panic application if conditions fail
- Files: `src-tauri/src/bpm.rs:7`, `src-tauri/src/commands.rs:31`, `src-tauri/src/main.rs:16`
- Current mitigation: None. Panics crash the entire Tauri application.
- Recommendations:
  - Replace all `.expect()` with proper `Result` handling and error propagation
  - Use `?` operator to bubble errors up to Tauri command handler
  - Return meaningful error messages to frontend instead of crashing

**Unvalidated User Input in Download Command:**
- Risk: User-provided URL passed directly to shell command execution via yt-dlp. No URL validation, whitelist, or sanitization.
- Files: `src-tauri/src/commands.rs:18-39`
- Current mitigation: yt-dlp's own URL validation (limited)
- Recommendations:
  - Validate URL format before passing to yt-dlp
  - Restrict to known safe domains (YouTube, SoundCloud) or use whitelist
  - Escape/validate format parameter (currently passes through directly)
  - Add audit logging of download requests

**No Output Validation from yt-dlp:**
- Risk: yt-dlp stdout/stderr not captured or validated. Success only checked via exit code boolean.
- Files: `src-tauri/src/commands.rs:30-33`
- Current mitigation: None
- Recommendations:
  - Capture stdout/stderr for debugging and user feedback
  - Parse yt-dlp output to verify download actually completed
  - Validate output file exists before returning success

## Performance Bottlenecks

**Synchronous File I/O in BPM Detection:**
- Problem: `std::fs::read()` is synchronous blocking call in Tauri command handler
- Files: `src-tauri/src/bpm.rs:7`
- Cause: No async Rust or tokio runtime used. Blocks entire Tauri window during file read.
- Improvement path: Use async file operations or move to background task. Implement proper async command if feature is completed.

**Regex Compilation on Each Request:**
- Problem: Regex for JPG URL extraction is compiled fresh on every fetch_artwork_html call
- Files: `src-tauri/src/commands.rs:53`
- Cause: Regex created inside function body instead of compiled once lazily/statically
- Improvement path: Use lazy_static or regex crate's lazy compilation feature. Compile pattern once at module level.

**No Concurrent Download Limit:**
- Problem: Starting all downloads simultaneously via startAllDownloadTasks may spawn unlimited yt-dlp processes
- Files: `src/contexts/app-state.tsx:72-76`
- Cause: forEach loop directly calls async startDownloadTask for every item without queue
- Improvement path: Implement semaphore or task pool with configurable concurrency (e.g., 3 simultaneous downloads max)

## Fragile Areas

**Download State Transition Logic:**
- Files: `src/contexts/app-state.tsx:41-50` (changeTaskStatus), `src/contexts/app-state.tsx:52-70` (startDownloadTask)
- Why fragile: State updates via map-and-reconstruct pattern scattered across code. No validation of state transitions (can jump from pending to completed without downloading, etc.). Race conditions possible if task removed while downloading.
- Safe modification: Create centralized state machine for download lifecycle. Validate all transitions explicitly. Add guards to prevent duplicate downloads or status changes after completion.
- Test coverage: No tests exist. State logic is completely untested.

**Artwork Fetching URL Extraction:**
- Files: `src-tauri/src/commands.rs:47-65`
- Why fragile: Regex pattern assumes all JPGs end with `.jpg` literal. Will miss query params, fragments, encoded URLs. HTML parsing not done (raw regex on full HTML). Assumes successful response regardless of MIME type.
- Safe modification: Use proper HTML parsing with scraper crate already in dependencies. Target specific image elements. Validate URLs before returning.
- Test coverage: No tests. Regex pattern untested against real HTML.

**Component Prop Types:**
- Files: All components use `(props: any)` or destructure without type safety
- Why fragile: Props can be passed incorrectly with no compile-time error. Required props easily forgotten. Refactoring parent component breaks child silently at runtime.
- Safe modification: Create interface for each component's props. Use TypeScript strict mode. Example: `interface ListItemProps { task: downloadTask }` instead of destructuring any.
- Test coverage: No component tests exist.

## Scaling Limits

**Single-Threaded Download Processing:**
- Current capacity: Sequential downloads only (intended). Batch mode starts all simultaneously (unintended).
- Limit: System resources (file handles, network bandwidth, CPU for transcoding) will be overwhelmed if many large videos queued.
- Scaling path: Implement proper download queue with configurable worker count (start at 2-3 concurrent, allow user to adjust).

**In-Memory Download List:**
- Current capacity: Entire download list stored in Solid.js signal in RAM
- Limit: UI will degrade with 100+ downloads in list. No pagination or virtualization.
- Scaling path: Implement windowed/virtual scrolling in DownloadList. Consider persisting to IndexedDB for resume-on-restart.

**No Download Progress Tracking:**
- Current capacity: Only binary status (pending/downloading/completed/failed)
- Limit: User cannot see download progress, time remaining, or speed
- Scaling path: Implement progress callback from yt-dlp via Tauri events. Update task with percentage complete.

## Dependencies at Risk

**Tauri v1 (Deprecated):**
- Risk: Tauri v1 is outdated. v2 released with breaking changes. Security updates will eventually stop.
- Impact: Future Rust dependency updates may require Tauri upgrade. Security vulnerabilities in Tauri v1 unfixed.
- Migration plan: Plan migration to Tauri v2. Review breaking changes in bundling, IPC, and window configuration. Prioritize this for next major version.

**yt-dlp External Binary (Unmanaged):**
- Risk: Not part of dependency tree. Users must install separately. Version skew across installations.
- Impact: App may break if yt-dlp changes CLI arguments. Users with old yt-dlp versions may get different behavior.
- Migration plan: Either bundle yt-dlp binary in release or provide clear installation script. Consider libary wrapper if one exists.

**reqwest Blocking Client:**
- Risk: Using blocking reqwest in async context is antipattern. Should use async reqwest.
- Impact: All HTTP calls in Tauri handler block the entire app. Artwork fetching locks UI.
- Migration plan: Use `reqwest::Client` with async/await instead of `blocking::get`. Update to async command handlers.

## Missing Critical Features

**Error Context Missing:**
- Problem: Download failures return boolean. No information why download failed (invalid URL, format unavailable, network error, yt-dlp not installed, etc.)
- Blocks: Users cannot troubleshoot failures. Cannot implement retry logic. Cannot provide helpful error messages.

**Download Progress Not Shown:**
- Problem: Task shows "downloading" status but user cannot see progress, time remaining, or file size
- Blocks: Users don't know if download is working or stuck. Cannot make informed decision to cancel.

**Download Queue Management:**
- Problem: No pause/resume, no ability to reorder queue, no priority levels, no concurrent limit control
- Blocks: Users cannot manage batch downloads. Must download all at once or none.

**Settings/Preferences:**
- Problem: Download location hardcoded to ~/Downloads. Format selection on per-item basis but no defaults. No concurrent download limit setting.
- Blocks: Cannot customize download behavior. Multi-disk workflows not supported.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: All Rust commands (download_audio, fetch_artwork_html, get_bpm). All state management functions. All components.
- Files: `src-tauri/src/commands.rs`, `src/contexts/app-state.tsx`, `src/components/**`, `src/containers/**`
- Risk: State transition bugs, regex issues, type mismatches, prop passing errors go undetected until runtime in production.
- Priority: High. Recommend adding:
  - Command unit tests for download_audio error cases
  - State management tests for download lifecycle
  - Component snapshot tests for UI consistency

**No Integration Tests:**
- What's not tested: IPC communication between frontend and Rust. Real yt-dlp execution. HTML parsing with real URLs.
- Files: Frontend-to-Rust invoke calls, fetch_artwork_html with real websites
- Risk: IPC serialization bugs, command argument passing errors, regex failures on real HTML not caught.
- Priority: High. Recommend adding:
  - Mock Tauri invoke for frontend testing
  - Integration test with mock yt-dlp binary
  - Real website test for artwork scraping

**No E2E Tests:**
- What's not tested: Full download flow from URL entry to file completion. Error recovery. Multi-download batches.
- Files: All app flow
- Risk: Critical user workflows untested. Regressions in batch download feature will cause data loss if downloads fail silently.
- Priority: Medium-High. Recommend WebdriverIO or Tauri test harness for full app flow.

---

*Concerns audit: 2026-01-23*
