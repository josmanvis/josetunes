# Codebase Structure

**Analysis Date:** 2026-01-23

## Directory Layout

```
josetunes/
├── src/                        # Frontend (Solid.js + TypeScript)
│   ├── index.tsx              # Entry point: mounts App to DOM
│   ├── App.tsx                # Root component: layout and state provider
│   ├── types/                 # TypeScript type definitions
│   │   ├── index.ts           # Barrel export
│   │   └── downloadTask.ts    # Task type definition
│   ├── contexts/              # Global state (Solid.js context)
│   │   ├── app-state.tsx      # Download state, signals, commands
│   │   └── theme-provider.tsx # Theme context (stub)
│   ├── components/            # UI components (stateless, reusable)
│   │   ├── SearchBox.tsx      # URL input field
│   │   ├── FormatSelect.tsx   # Audio format selector (flac/mp3)
│   │   ├── CTAButton.tsx      # Action button with icon slot
│   │   ├── ListItem.tsx       # Single download task list entry
│   │   ├── BadgeStatus.tsx    # Status indicator with icon
│   │   ├── DownloadingScreen.tsx     # Full-screen download progress
│   │   ├── Footnote.tsx       # Footer notice
│   │   ├── YouTubeThumbnail.tsx      # YouTube video thumbnail
│   │   ├── SoundCloudThumbnail.tsx   # SoundCloud track thumbnail
│   │   └── [component].scss   # Component styles (SCSS modules)
│   ├── containers/            # Layout wrapper components
│   │   ├── AppContainer.tsx   # Main app wrapper
│   │   ├── Toolbar.tsx        # Top toolbar container
│   │   ├── DownloadList.tsx   # Task list container
│   │   └── [container].scss   # Container styles
│   ├── icons/                 # SVG icon components
│   │   ├── CheckIcon.tsx      # Checkmark (completed)
│   │   ├── WarningIcon.tsx    # Warning (failed)
│   │   ├── DeleteIcon.tsx     # Delete/remove task
│   │   ├── DownloadIcon.tsx   # Download indicator
│   │   └── ClockIcon.tsx      # Queued indicator
│   ├── assets/                # Static images/media (if any)
│   ├── App.css                # Global app styles
│   ├── theme.scss             # Theme variables
│   ├── resets.scss            # CSS resets
│   └── vite-env.d.ts          # Vite environment type definitions
├── src-tauri/                 # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── main.rs            # App entry: Tauri builder, command registration
│   │   ├── commands.rs        # Tauri commands (download_audio, fetch_artwork_html, greet)
│   │   ├── bpm.rs             # BPM detection command (stub)
│   │   └── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json        # Tauri app config (window size, bundle ID)
│   ├── icons/                 # App icons for different platforms
│   └── Cargo.lock
├── public/                    # Static files served by dev server
├── index.html                 # HTML template
├── package.json               # Node.js project metadata and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite bundler configuration
└── CLAUDE.md                  # Project instructions (this file)
```

## Directory Purposes

**src/**
- Purpose: All frontend TypeScript/Solid.js code
- Contains: Components, containers, contexts, types, styles, icons
- Key files: `index.tsx` (entry), `App.tsx` (root), `contexts/app-state.tsx` (state)

**src/types/**
- Purpose: Shared TypeScript type definitions
- Contains: Type exports and interfaces
- Key files: `downloadTask.ts` (core task model), `index.ts` (barrel export)

**src/contexts/**
- Purpose: Solid.js context providers for global state
- Contains: Context definitions and signal setup
- Key files: `app-state.tsx` (download state), `theme-provider.tsx` (stub)

**src/components/**
- Purpose: Presentational, reusable UI components
- Contains: Functional Solid.js components with single responsibility
- Key files: `SearchBox.tsx`, `FormatSelect.tsx`, `ListItem.tsx`, `BadgeStatus.tsx`
- Note: Each component has a `.scss` module for styling

**src/containers/**
- Purpose: Layout wrapper components that organize child components
- Contains: Grid/flex layout containers with semantic structure
- Key files: `AppContainer.tsx` (main wrapper), `Toolbar.tsx`, `DownloadList.tsx`
- Note: Each container has a `.scss` module for styling

**src/icons/**
- Purpose: SVG icon components used throughout the UI
- Contains: Solid.js components rendering inline SVG elements
- Key files: `CheckIcon.tsx`, `WarningIcon.tsx`, `DeleteIcon.tsx`, `DownloadIcon.tsx`, `ClockIcon.tsx`
- Pattern: Icons accept optional `color` prop for theming

**src-tauri/src/**
- Purpose: Rust backend code for system operations
- Contains: Tauri command handlers, process execution, HTTP requests
- Key files: `main.rs` (app entry), `commands.rs` (command implementations), `bpm.rs` (BPM stub)

**src-tauri/tauri.conf.json**
- Purpose: Tauri framework configuration
- Contains: Window size (1000x600, non-resizable), bundle identifier, security settings
- Key configs: `windows[0].width/height`, `bundle.identifier` = "com.crativo.tunerip"

## Key File Locations

**Entry Points:**
- `src/index.tsx`: Frontend boot; mounts `App` to DOM root element
- `src-tauri/src/main.rs`: Backend boot; initializes Tauri builder and registers commands

**Configuration:**
- `package.json`: Node.js dependencies (solid-js, @tauri-apps/api, vite, typescript, sass)
- `tsconfig.json`: TypeScript compiler options
- `vite.config.ts`: Vite dev server config (port 1420, watch ignores src-tauri)
- `src-tauri/tauri.conf.json`: Tauri window and app settings
- `src-tauri/Cargo.toml`: Rust dependencies (tauri, reqwest, regex, serde_json)

**Core Logic:**
- `src/contexts/app-state.tsx`: State signals, task operations, Tauri invocations
- `src/types/downloadTask.ts`: Core task type definition
- `src-tauri/src/commands.rs`: Implementation of `download_audio`, `fetch_artwork_html` commands

**Global Styles:**
- `src/App.css`: Global app styles
- `src/theme.scss`: Theme variables and utilities
- `src/resets.scss`: CSS resets (margin, padding, box-sizing)

**Testing:**
- Not configured; no test files present

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `SearchBox.tsx`, `ListItem.tsx`)
- Containers: PascalCase (e.g., `AppContainer.tsx`, `DownloadList.tsx`)
- Types: camelCase files containing type definitions (e.g., `downloadTask.ts`)
- Contexts: camelCase with hyphen for composites (e.g., `app-state.tsx`, `theme-provider.tsx`)
- Icons: PascalCase ending with "Icon" (e.g., `CheckIcon.tsx`, `WarningIcon.tsx`)
- Styles: Match component/container name with `.scss` extension (e.g., `SearchBox.scss`)

**Directories:**
- Plural for collections: `components/`, `containers/`, `contexts/`, `icons/`, `assets/`, `types/`
- Lowercase: `src/`, `src-tauri/`, `public/`, `.github/`

**Functions & Variables:**
- Components/Hooks: PascalCase (e.g., `SearchBox`, `AppContainer`)
- Signals & state: camelCase for accessor, underscore-prefixed for setter (e.g., `downloadList()`, `_downloadList()`)
- Regular functions: camelCase (e.g., `addToDownloadList`, `startDownloadTask`)
- Commands: snake_case (Rust convention; e.g., `download_audio`, `fetch_artwork_html`, `get_bpm`)

**Types:**
- Type names: camelCase (e.g., `downloadTask`)
- Status union values: lowercase (e.g., `"pending"`, `"downloading"`, `"completed"`, `"failed"`)

## Where to Add New Code

**New Feature (UI-focused):**
- Primary code:
  - Component: `src/components/[NewFeature].tsx`
  - State logic: Add signals and actions to `src/contexts/app-state.tsx`
  - Types: Define type in `src/types/[newType].ts`, export from `src/types/index.ts`
  - Styling: Create `src/components/[NewFeature].scss` with component styles
- Tests: No test files currently; add tests to same directory as code (`*.test.tsx`)

**New Component/Module:**
- Implementation: `src/components/[Name].tsx` (if presentational) or `src/containers/[Name].tsx` (if layout)
- Styling: Sibling `.scss` file with same name
- State integration: Use `useContext(AppStateContext)` to access global state
- Example structure:
  ```typescript
  import { useContext } from "solid-js";
  import "./ComponentName.scss";
  import { AppStateContext } from "../contexts/app-state";

  const ComponentName = () => {
    const { signal1, action1 } = useContext<any>(AppStateContext);
    return <div>{/* JSX */}</div>;
  };

  export default ComponentName;
  ```

**New Backend Command:**
- Implementation: `src-tauri/src/commands.rs` (add new `#[command]` function)
- Registration: Add command name to `generate_handler!` macro in `src-tauri/src/main.rs`
- Invocation from frontend: Call `invoke("command_name", { ...args })` from state context
- Example:
  ```rust
  #[command]
  pub fn my_command(param: &str) -> String {
      // implementation
  }
  ```
  Then in `main.rs`:
  ```rust
  .invoke_handler(tauri::generate_handler![
      commands::my_command,
      // ... other commands
  ])
  ```

**Utilities/Helpers:**
- Shared helpers: Create in new `src/utils/` directory (does not exist yet)
- Approach: Group by concern (e.g., `src/utils/url.ts` for URL validation, `src/utils/format.ts` for format handling)
- Export from barrel file: `src/utils/index.ts`

**Global State Additions:**
- Add signal to `AppStateProvider()` in `src/contexts/app-state.tsx`
- Create getter/setter signals using `createSignal()`
- Add to `contextValue` object for provider
- Access in components via `useContext(AppStateContext)`

## Special Directories

**src/assets/**
- Purpose: Static images, fonts, media files
- Generated: No (manually added)
- Committed: Yes
- Note: Import and reference in components as needed

**public/**
- Purpose: Static files served directly by dev server (favicon, etc)
- Generated: No (manually added)
- Committed: Yes
- Note: Copied to build output root

**src-tauri/icons/**
- Purpose: Platform-specific app icons (PNG, ICNS, ICO formats)
- Generated: Initially scaffolded by Tauri CLI
- Committed: Yes
- Note: Configured in `tauri.conf.json` bundle section

**/dist**
- Purpose: Built frontend output (generated during build)
- Generated: Yes (by Vite during `vite build`)
- Committed: No (should be in .gitignore)

**/src-tauri/target**
- Purpose: Compiled Rust binaries and artifacts
- Generated: Yes (by Cargo during build)
- Committed: No (should be in .gitignore)
