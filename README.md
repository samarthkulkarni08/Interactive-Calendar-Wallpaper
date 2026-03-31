# DeskZen

A **Windows** desktop app built with **Electron** and **React (Vite)**. It draws an **always-on-bottom**, transparent “wallpaper” layer over your work area so you can keep a **calendar**, **events**, **to-dos**, and **optional Windows app shortcuts** on screen while still clicking through to the desktop where there’s no UI.

---

## Commands

Run these from the **project root** (where `package.json` lives).

### First time

| Command | What it does |
|--------|----------------|
| `npm install` | Installs dependencies (`node_modules/`). Run once per clone or after dependency changes. |

### Daily development

| Command | What it does |
|--------|----------------|
| `npm run dev` | **Main workflow.** Starts three things together: Vite dev server for the UI, TypeScript watch for the main process, and Electron pointed at `http://localhost:5173`. Stops all when you press Ctrl+C. |
| `npm run start` | Runs **only** Electron with `dist/main/main.js`. Use after a successful **`npm run build`** (see below). Not for first-time dev without building. |

### Production build (no installer)

| Command | What it does |
|--------|----------------|
| `npm run build` | Compiles **main process** → `dist/main/` and **renderer** → `dist/renderer/`. Use before packaging or to test a production-like bundle locally with `npm run start`. |
| `npm run build:main` | TypeScript only: `main-process/` → `dist/main/` (`.js` + source maps). |
| `npm run build:renderer` | Vite only: `src/renderer/` + `index.html` → `dist/renderer/`. |

### Installer (Windows)

| Command | What it does |
|--------|----------------|
| `npm run package` | Runs **`npm run build`**, then **electron-builder** to produce an **NSIS installer** under `dist/` (e.g. `DeskZen Setup x.x.x.exe`). |
| `npm run clean` | Deletes the entire **`dist/`** folder (compiled app + any previous installer output). Run before a fresh **`npm run build`** or **`npm run package`** if you want a clean tree. |

### Lower-level dev scripts (used by `npm run dev`)

You rarely need these alone; they’re listed for clarity.

| Command | What it does |
|--------|----------------|
| `npm run dev:renderer` | Vite on **port 5173** (`--strictPort`). |
| `npm run dev:main:compile` | `tsc -p tsconfig.main.json --watch` → outputs to `dist/main/`. |
| `npm run dev:electron` | Waits for `http://localhost:5173`, then launches Electron with `dist/main/main.js` (and reload flag in dev). |

---

## Project layout

### Top-level folders (source vs generated)

```
DeskZen/
├── main-process/          # Electron main + preload (TypeScript source)
├── src/
│   └── renderer/          # React UI source
├── build/                 # Optional assets for electron-builder (icons, etc.)
├── scripts/               # Node maintenance scripts
├── docs/                  # Extra markdown docs
├── dist/                  # GENERATED — do not edit; created by build/package
└── …config files (package.json, vite.config.ts, tsconfig*.json, index.html)
```

#### `main-process/` — backend of the desktop app

| Item | Role |
|------|------|
| `main.ts` | Creates the wallpaper `BrowserWindow`, **IPC** handlers, **electron-store** persistence, event **notifications**, Windows startup integration, etc. |
| `preload.ts` | Safe bridge: exposes a small **`window.api`** to the React app via `contextBridge` (no raw `nodeIntegration` in the page). |
| `types/` | TypeScript declarations for things like `auto-launch` if needed. |

Compiled output: **`dist/main/`** (e.g. `main.js`, `preload.js`). `package.json` field **`"main"`** points at `dist/main/main.js`.

#### `src/renderer/` — frontend (what you see)

| Item | Role |
|------|------|
| `main.tsx` | React entry (mounts the app). |
| `App.tsx` | Top-level layout: time widget, calendar cluster, date panel. |
| `components/` | UI pieces: `CalendarView`, `DatePanel`, `TimeWidget`, `AppPickerModal`, etc. |
| `hooks/` | React hooks (e.g. wallpaper mouse passthrough for click-through vs UI). |
| `styles/global.css` | Global styles, responsive tokens, calendar/panel sizing. |

In **development**, Vite serves this from **`index.html`** at the repo root. In **production**, Vite writes static files under **`dist/renderer/`** and Electron loads that folder from the packaged app.

#### `build/`

Placeholder or assets for **electron-builder** (e.g. `icon.ico`). Can be empty; see [electron-builder docs](https://www.electron.build/).

#### `scripts/`

| Script | Role |
|--------|------|
| `clean-dist.js` | Removes `dist/` (invoked by `npm run clean`). |

#### `docs/`

Human-written guides, e.g. **[Building & releasing](docs/RELEASING.md)** (installer, startup, notifications checklist).

#### `dist/` — build output (gitignored)

| Path | Contents |
|------|----------|
| `dist/main/` | Compiled **main process** from `main-process/`. |
| `dist/renderer/` | Production **HTML/JS/CSS** from Vite. |
| `*.exe` (after package) | NSIS installer from `npm run package`. |

If you ever see an old **`dist/electron/`** folder, it’s from a **previous layout**. Delete it or run **`npm run clean`** and rebuild—current output is only **`dist/main/`** for the main bundle.

---

## Requirements

- **Windows** (target platform)
- **Node.js** (LTS recommended)

---

## Docs & debugging

- [Building & releasing](docs/RELEASING.md)

Runtime debug log (not in the repo):

`%USERPROFILE%\.deskzen\logs\debug.log`
