# Coding Conventions

**Analysis Date:** 2026-01-23

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `SearchBox.tsx`, `CTAButton.tsx`, `ListItem.tsx`)
- Contexts: kebab-case (e.g., `app-state.tsx`, `theme-provider.tsx`)
- Icons: PascalCase exported as named exports (e.g., `DownloadIcon.tsx`, `DeleteIcon.tsx`)
- Types: kebab-case files with lowercase exports (e.g., `downloadTask.ts`)
- Styles: Match component name in kebab-case (e.g., `SearchBox.scss`, `ListItem.scss`)

**Functions:**
- Hooks and utility functions: camelCase (e.g., `createSignal`, `createContext`, `useContext`)
- Component functions: PascalCase (e.g., `SearchBox`, `CTAButton`, `BadgeStatus`)
- Event handlers: camelCase with `handle` prefix (e.g., `handleClick`, `handleChange`)
- State setters: camelCase with underscore prefix (e.g., `_nextURL`, `_format`, `_displayFootnote`)

**Variables:**
- Regular variables: camelCase (e.g., `youtubeId`, `soundcloudId`, `downloadList`)
- Boolean flags: camelCase with clear intent (e.g., `currentlyDownloading`, `displayFootnote`)
- Constants: camelCase or UPPER_SNAKE_CASE depending on scope

**Types:**
- Type names: PascalCase (e.g., `downloadTask`)
- Type exports: Located in `src/types/` directory
- Exported via barrel file: `src/types/index.ts` re-exports all types

## Code Style

**Formatting:**
- No ESLint or Prettier configured
- TypeScript strict mode enabled: `strict: true`
- Enforced: `noUnusedLocals`, `noUnusedParameters`, `noFalltthoughCasesInSwitch`
- Target: ES2020
- Module system: ESNext

**Linting:**
- No linting framework active (no .eslintrc)
- No formatting framework active (no .prettierrc)
- Reliance on TypeScript compiler for type safety only

**Common Code Patterns:**
- Use of destructuring in function parameters with type annotations
- Inline prop destructuring in component definitions (e.g., `{ task }: { task: downloadTask }`)
- Flexible use of `any` type in context destructuring due to Solid.js context limitations

## Import Organization

**Order:**
1. Solid.js imports (`import { ... } from "solid-js"`)
2. Tauri API imports (`import { ... } from "@tauri-apps/api/tauri"`)
3. Relative component imports
4. Relative context imports
5. Relative type imports
6. Relative styles (SCSS)
7. Relative icon imports

**Path Aliases:**
- No path aliases configured in TypeScript
- Relative imports use standard `../` paths

**Example from `src/App.tsx`:**
```typescript
import { useContext } from "solid-js";
import "./resets.scss";
import "./App.css";
import "./theme.scss";
import Footnote from "./components/Footnote";
import SearchBox from "./components/SearchBox";
import AppContainer from "./containers/AppContainer";
import Toolbar from "./containers/Toolbar";
import { AppStateContext, AppStateProvider } from "./contexts/app-state";
import FormatSelect from "./components/FormatSelect";
import CTAButton from "./components/CTAButton";
import DownloadList from "./containers/DownloadList";
import ListItem from "./components/ListItem";
import { downloadTask } from "./types";
import DownloadingScreen from "./components/DownloadingScreen";
import { DownloadIcon } from "./icons/DownloadIcon";
```

## Error Handling

**Frontend (TypeScript/Solid.js):**
- Try-catch blocks in async operations
- Example in `src/contexts/app-state.tsx`:
```typescript
try {
  const resp = await invoke("download_audio", {
    url: task.url,
    format: task.format,
  });
  console.log("Downloaded Successfully", resp);
  changeTaskStatus(task.id, "completed");
  _currentlyDownloading(false);
} catch (error) {
  console.error("Download failed", error);
  changeTaskStatus(task.id, "failed");
  _currentlyDownloading(false);
}
```

**Backend (Rust):**
- Use of `Result<T, String>` for fallible operations
- `map_err` for converting errors to strings
- `.expect()` for panicking on unrecoverable errors (e.g., `src-tauri/src/commands.rs`)
- Example from `src-tauri/src/commands.rs`:
```rust
pub fn fetch_artwork_html(url: &str) -> Result<String, String> {
    let response = get(url).map_err(|err| err.to_string())?;
    let body = response.text().map_err(|err| err.to_string())?;
    let re = Regex::new(r"https?://[^\s]+\.jpg").map_err(|err| err.to_string())?;
    // ...
    Ok(json)
}
```

## Logging

**Framework:** `console` object (browser API)

**Patterns:**
- `console.log()` for informational logs (e.g., "Downloaded Successfully", "downloadList state")
- `console.error()` for error conditions (e.g., "Download failed")
- No structured logging framework in use

**Usage:**
- `src/App.tsx` line 48: `console.log("downloadList", downloadList())`
- `src/contexts/app-state.tsx` line 61: `console.log("Downloaded Successfully", resp)`
- `src/contexts/app-state.tsx` line 65: `console.error("Download failed", error)`
- `src/components/SoundCloudThumbnail.tsx`: `console.log(art)` for debugging artwork fetch

## Comments

**When to Comment:**
- Inline comments for non-obvious logic or workarounds
- TODO comments for incomplete features (e.g., `// TODO: needs to be reworked after the switch to batch downloads` in `app-state.tsx` line 10)
- Explanatory comments for regex patterns (e.g., YouTube/SoundCloud ID extraction in `app-state.tsx`)

**JSDoc/TSDoc:**
- Not used in this codebase
- Component props documented via TypeScript inline type annotations

## Function Design

**Size:**
- Small, focused functions preferred
- Most components under 35 lines
- Context provider functions handle state management centrally

**Parameters:**
- Explicit typed destructuring in function signatures
- Example: `const ListItem = ({ task }: { task: downloadTask })`
- All props typed inline, no separate interface files

**Return Values:**
- Components return JSX elements
- Hooks return signal tuples: `const [state, setState] = createSignal(initialValue)`
- Async functions return Promise results or void
- Rust commands return `String` or `Result<String, String>`

## Module Design

**Exports:**
- Default exports for components: `export default ComponentName`
- Named exports for icons: `export const IconName = (...) => (...)`
- Named exports for contexts: `export const ContextName = createContext()`

**Barrel Files:**
- `src/types/index.ts` re-exports all types from subdirectories
- No other barrel files in use

**Example from `src/types/index.ts`:**
```typescript
export type { downloadTask } from "./downloadTask";
```

## Type Annotations

**Context Usage with `any`:**
- All `useContext()` calls use `useContext<any>()` due to Solid.js context typing limitations
- Context value typing relies on runtime access patterns, not static typing

**Props Typing:**
- Inline prop interfaces in component function signatures
- Example: `const CTAButton = ({ handleClick, label, children }: { children?: any; handleClick: any; label: string })`

---

*Convention analysis: 2026-01-23*
