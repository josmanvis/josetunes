# Architecture

**Analysis Date:** 2026-01-23

## Pattern Overview

**Overall:** Desktop application using Tauri's IPC (Inter-Process Communication) bridge pattern connecting a Solid.js frontend to a Rust backend.

**Key Characteristics:**
- Frontend and backend are cleanly separated via Tauri's `invoke()` command bridge
- Unidirectional command flow: Frontend → Backend (no server push/events)
- Solid.js reactivity using `createSignal` and `createContext` for state management
- Rust handles external process execution (yt-dlp) and HTTP operations
- No database or persistent storage layer (files saved to system Downloads folder)

## Layers

**Presentation Layer (UI Components):**
- Purpose: Render user interface and capture user interactions
- Location: `src/components/`, `src/containers/`, `src/icons/`
- Contains: Solid.js components with embedded JSX, SCSS styling modules
- Depends on: Global state via `AppStateContext`, type definitions from `src/types/`
- Used by: Container components and root `App.tsx`

**Containers (Layout):**
- Purpose: Wrap and organize groups of UI components with consistent styling
- Location: `src/containers/`
- Contains: Layout wrapper components (`AppContainer`, `Toolbar`, `DownloadList`)
- Depends on: Presentation components
- Used by: `App.tsx` and components

**State Management Layer:**
- Purpose: Centralized global state for download tasks, URL input, format selection
- Location: `src/contexts/app-state.tsx`
- Contains: Solid.js context provider with signals and command handlers
- Depends on: Tauri `invoke()` API, type definitions
- Used by: All components that need global state via `useContext(AppStateContext)`

**Type Definitions:**
- Purpose: Define TypeScript interfaces for type safety
- Location: `src/types/downloadTask.ts`
- Contains: `downloadTask` type with status union type
- Depends on: None
- Used by: State management, components, Rust backend

**Command Interface Layer (IPC Bridge):**
- Purpose: Define commands that can be invoked from frontend to backend
- Location: `src-tauri/src/main.rs` (handler registration), `src-tauri/src/commands.rs` (implementation)
- Contains: Tauri command handlers decorated with `#[command]`
- Depends on: Rust standard library, external crates (reqwest, regex, serde)
- Used by: Frontend via `invoke("command_name")`

**Backend Operations Layer:**
- Purpose: Execute system operations and external processes
- Location: `src-tauri/src/commands.rs`, `src-tauri/src/bpm.rs`
- Contains: Command implementations for audio download, artwork fetching, BPM detection
- Depends on: External binaries (yt-dlp), external HTTP/parsing libraries
- Used by: Tauri command handler

## Data Flow

**Download Add Flow:**

1. User types URL in `SearchBox` component → `onKeyUp` updates `nextURL` signal
2. User selects format in `FormatSelect` → `_format` signal updated
3. User clicks "add" button → `addToDownloadList()` invoked in state
4. State creates new task with ID and status "pending" → `downloadList` signal updated
5. Components subscribe to `downloadList` → UI re-renders with new `ListItem`

**Download Execution Flow:**

1. User clicks "download all" button → `startAllDownloadTasks()` invoked
2. Iterates over `downloadList()` and calls `startDownloadTask()` for each task
3. `startDownloadTask()` sets `currentlyDownloading` to true, changes task status to "downloading"
4. After 200ms timeout, invokes Rust command: `invoke("download_audio", { url, format })`
5. Backend: `download_audio` command executes yt-dlp process with args: `-f bestaudio --extract-audio --audio-format [format] [url]`
6. yt-dlp saves file to `~/Downloads/` with title-based filename
7. Backend returns success status as boolean string
8. Frontend catches response → updates task status to "completed" or "failed" on error
9. Sets `currentlyDownloading` to false → UI switches from `DownloadingScreen` to normal view

**Artwork Fetch Flow (Unused but Defined):**

1. Frontend invokes: `invoke("fetch_artwork_html", { url })`
2. Backend: HTTP GET request to URL → extracts all `.jpg` URLs via regex
3. Returns JSON array of image URLs to frontend

**State Management:**

- State is ephemeral (cleared on app close)
- Single source of truth: `AppStateContext` provider in `src/contexts/app-state.tsx`
- Signals use immutable update pattern: create new array/object rather than mutating
- Status transitions: `pending` → `downloading` → `completed`|`failed`

## Key Abstractions

**Task (downloadTask):**
- Purpose: Represents a single audio download job
- Examples: `src/types/downloadTask.ts`
- Pattern: TypeScript type union with discriminated status field
- Properties: id, url, format (flac|mp3), status, youtubeId, soundcloudId
- Status lifecycle: pending → downloading → completed|failed

**State Context:**
- Purpose: Encapsulates all mutable application state and operations
- Examples: `src/contexts/app-state.tsx`
- Pattern: Solid.js context with createSignal for reactivity
- Operations: `addToDownloadList()`, `removeFromDownloadList()`, `changeTaskStatus()`, `startDownloadTask()`, `startAllDownloadTasks()`

**Component Composition:**
- Purpose: Reusable UI elements with single responsibility
- Examples: `SearchBox`, `FormatSelect`, `CTAButton`, `BadgeStatus`, `ListItem`
- Pattern: Functional Solid.js components receiving props, accessing context as needed

**Icon System:**
- Purpose: Reusable SVG icons with color theming
- Examples: `src/icons/*.tsx` (CheckIcon, WarningIcon, DeleteIcon, DownloadIcon, ClockIcon)
- Pattern: Functional components rendering SVG elements, accepting `color` prop

## Entry Points

**Frontend Entry Point:**
- Location: `src/index.tsx`
- Triggers: Browser page load (via Vite dev server or bundled HTML)
- Responsibilities: Mount root `App` component into DOM element with id "root"

**Root App Component:**
- Location: `src/App.tsx`
- Triggers: `src/index.tsx` render call
- Responsibilities: Wrap application with `AppStateProvider`, render conditional UI based on `currentlyDownloading` state, compose layout with Toolbar, DownloadList, action buttons

**Backend Entry Point:**
- Location: `src-tauri/src/main.rs`
- Triggers: Application launch via Tauri framework
- Responsibilities: Initialize Tauri builder, register command handlers via `generate_handler!` macro, start application window

**Commands (Backend API):**
- Location: `src-tauri/src/commands.rs`
- Available commands: `greet()`, `download_audio()`, `fetch_artwork_html()`
- Triggered by: Frontend `invoke()` calls
- Responsibilities: Execute system operations and return results to frontend

## Error Handling

**Strategy:** Try-catch at frontend command invocation level; backend errors propagate as exceptions.

**Patterns:**

- Frontend: `startDownloadTask()` wraps `invoke()` in try-catch, updates task status to "failed" on error
- Backend: Uses `.expect()` for fatal errors (file operations), `map_err()` for `Result` types in HTTP operations
- User feedback: Task status badges display "failed" with warning icon when error occurs

## Cross-Cutting Concerns

**Logging:**
- Frontend: `console.log()` and `console.error()` used for debugging (line 48 in App.tsx logs downloadList, line 61 in app-state logs success/error)
- Backend: Rust standard output (visible in Tauri console)

**Validation:**
- Frontend: URL extraction via regex patterns in `addToDownloadList()` to detect YouTube and SoundCloud sources
- Backend: yt-dlp itself validates URL and format parameters

**Authentication:**
- Not applicable; no auth system (public URL sources only)

**State Persistence:**
- Not implemented; all state lost on app close
- Files saved to filesystem via yt-dlp output; state about downloads is ephemeral
