import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  screen,
  Notification,
  nativeImage
} from "electron";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
// auto-launch exports differently depending on module system; treat as any.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AutoLaunch: any = require("auto-launch");
import Store from "electron-store";
import * as fs from "fs";
import * as os from "os";

const execPromise = promisify(exec);

const APP_NAME = "Desktop Productivity Wallpaper";
const STORE_NAME = "desktop-productivity-wallpaper";

/** Debug log under user home — keeps the repo root clean */
function getDebugLogPath(): string {
  const dir = path.join(os.homedir(), ".desktop-productivity-wallpaper", "logs");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return path.join(dir, "debug.log");
}

const DEBUG_LOG_PATH = getDebugLogPath();

function debugLog(message: string) {
  try {
    fs.appendFileSync(
      DEBUG_LOG_PATH,
      `[${new Date().toISOString()}] ${message}\n`,
      "utf8"
    );
  } catch {
    // ignore
  }
}

debugLog("main loaded");

// Windows toasts: must run before the `ready` event (see Electron `setAppUserModelId` docs).
if (process.platform === "win32") {
  app.setAppUserModelId("com.samar.desktop-productivity-wallpaper");
}

type DateKey = string; // YYYY-MM-DD

type EventItem = {
  id: string;
  title: string;
  time: string; // e.g. "09:30"
  link?: string;
};

type TodoItem = {
  id: string;
  title: string;
  attachedAppName?: string; // display name only (no persisted paths)
  attachedAppId?: string; // Windows AppID for launching
  completed: boolean;
};

type InstalledAppCandidate = {
  displayName: string;
  exePath: string;
};

type StartAppItem = {
  Name: string;
  AppID: string;
};

type StoreState = {
  eventsByDate: Record<DateKey, EventItem[]>;
  todosByDate: Record<DateKey, TodoItem[]>;
  settings: {
    autoLaunch: boolean;
  };
  /** Keys `${dateKey}|${eventId}` — avoid duplicate toasts for the same event on that day */
  eventNotificationsFired: Record<string, boolean>;
  installedAppsCache: {
    lastScannedAt: number;
    apps: InstalledAppCandidate[];
  };
};

// electron-store types vary across versions; keep the store typed as `any` for flexibility.
const store: any = new Store({
  name: STORE_NAME,
  defaults: {
    eventsByDate: {} as Record<DateKey, EventItem[]>,
    todosByDate: {} as Record<DateKey, TodoItem[]>,
    settings: {
      autoLaunch: false
    },
    eventNotificationsFired: {} as Record<string, boolean>,
    installedAppsCache: {
      lastScannedAt: 0,
      apps: [] as InstalledAppCandidate[]
    }
  }
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Use workArea instead of fullscreen to avoid blocking taskbar
  const { workArea } = screen.getPrimaryDisplay();
  
  mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    show: false,
    frame: false,
    // Not all Electron type versions expose `alwaysOnBottom` in the constructor options.
    alwaysOnBottom: true as any,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  } as any);

  mainWindow.webContents.on("did-finish-load", () => {
    debugLog("did-finish-load");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_evt, errorCode, errorDescription, validatedURL) => {
      debugLog(
        `did-fail-load: ${errorCode} ${errorDescription} ${validatedURL}`
      );
    }
  );

  mainWindow.once("ready-to-show", () => {
    debugLog("ready-to-show");
    mainWindow?.show();
    // Explicitly ensure window stays at bottom layer
    // Use setAlwaysOnTop(false) for compatibility
    if (mainWindow) {
      try {
        if (typeof (mainWindow as any).setAlwaysOnBottom === 'function') {
          (mainWindow as any).setAlwaysOnBottom(true);
          debugLog("Window set to always on bottom using setAlwaysOnBottom");
        } else {
          mainWindow.setAlwaysOnTop(false);
          debugLog("Window set to not always on top (fallback)");
        }
      } catch (err) {
        debugLog(`Error setting window position: ${err}`);
      }
      // OS-level click-through: transparent windows still capture the HWND on Windows.
      // forward:true keeps mousemove in the renderer so we can toggle when over UI.
      mainWindow?.setIgnoreMouseEvents(true, { forward: true });
      debugLog("Mouse events: passthrough mode (forwarding moves for hit-testing)");
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  if (!app.isPackaged) {
    debugLog(`loadURL: ${devUrl}`);
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, "..", "renderer", "index.html");
    debugLog(`loadFile: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }
}

function getDateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getEventsForDate(dateKey: DateKey): EventItem[] {
  return store.get(`eventsByDate.${dateKey}`) ?? [];
}

function getTodosForDate(dateKey: DateKey): TodoItem[] {
  return store.get(`todosByDate.${dateKey}`) ?? [];
}

function getLocalHHMM(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/** Normalize HTML time / user input to HH:MM for comparison */
function normalizeEventTimeString(time: string): string {
  const s = time.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, "0");
  return `${hh}:${mm}`;
}

function pruneEventNotificationFiredKeys(todayKey: DateKey) {
  const fired: Record<string, boolean> =
    store.get("eventNotificationsFired") ?? {};
  const next: Record<string, boolean> = {};
  const prefix = `${todayKey}|`;
  for (const [k, v] of Object.entries(fired)) {
    if (k.startsWith(prefix)) next[k] = v;
  }
  if (Object.keys(next).length !== Object.keys(fired).length) {
    store.set("eventNotificationsFired", next);
  }
}

function getWindowsNotificationIcon(): Electron.NativeImage | undefined {
  if (process.platform !== "win32") return undefined;
  try {
    const img = nativeImage.createFromPath(process.execPath);
    if (!img.isEmpty()) return img;
  } catch {
    // ignore
  }
  return undefined;
}

function buildEventNotificationOptions(
  title: string,
  body: string
): Electron.NotificationConstructorOptions {
  const opts: Electron.NotificationConstructorOptions = {
    title,
    body,
    silent: false
  };
  if (process.platform === "win32") {
    opts.timeoutType = "default";
    const icon = getWindowsNotificationIcon();
    if (icon) opts.icon = icon;
  }
  return opts;
}

function checkDueEventNotifications() {
  if (!Notification.isSupported()) {
    debugLog("Event notifications skipped: Notification.isSupported() is false");
    return;
  }

  const now = new Date();
  const todayKey = getDateKey(now);
  const nowHHMM = getLocalHHMM(now);

  pruneEventNotificationFiredKeys(todayKey);

  const events = getEventsForDate(todayKey);
  if (!events.length) return;

  const fired: Record<string, boolean> =
    store.get("eventNotificationsFired") ?? {};

  for (const ev of events) {
    const evTime = normalizeEventTimeString(ev.time);
    if (!evTime || evTime !== nowHHMM) continue;

    const fireKey = `${todayKey}|${ev.id}`;
    if (fired[fireKey]) continue;

    let body = ev.time;
    if (ev.link) body += " · Tap to open link";

    const title =
      ev.title && ev.title.trim().length > 0
        ? `Event: ${ev.title.trim()}`
        : "Calendar event";

    try {
      const n = new Notification(
        buildEventNotificationOptions(title, body || ev.time)
      );

      if (ev.link) {
        n.on("click", () => {
          openExternal(ev.link!).catch(() => undefined);
        });
      }

      n.show();
      // Only mark after a successful show so a failed toast can retry next tick
      fired[fireKey] = true;
      store.set("eventNotificationsFired", fired);
      debugLog(`Event notification shown: ${ev.title} @ ${ev.time}`);
    } catch (err) {
      debugLog(`Event notification error: ${err}`);
    }
  }
}

let eventNotificationInterval: ReturnType<typeof setInterval> | null = null;

function startEventNotificationScheduler() {
  if (eventNotificationInterval) return;
  checkDueEventNotifications();
  // Frequent enough to hit the correct local minute; Windows toasts are sensitive to timing
  eventNotificationInterval = setInterval(
    () => checkDueEventNotifications(),
    10 * 1000
  );
  debugLog("Event notification scheduler started (10s interval)");
}

async function openExternal(url: string) {
  await shell.openExternal(url);
}

async function openPath(p: string) {
  await shell.openPath(p);
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function scanInstalledApps(): Promise<InstalledAppCandidate[]> {
  debugLog("scanInstalledApps: Starting .lnk file scan");
  const results: InstalledAppCandidate[] = [];
  const seen = new Set<string>();

  // Get current user's home directory
  const userHome = process.env.USERPROFILE || process.env.HOME || "";
  
  // Start Menu directories to scan
  const startMenuDirs = [
    path.join(userHome, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs")
  ];

  async function scanDirectory(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".lnk")) {
          // Extract app name from .lnk filename
          const displayName = entry.name.replace(/\.lnk$/i, "").trim();
          
          // Skip system files and duplicates
          if (displayName && !seen.has(displayName.toLowerCase())) {
            seen.add(displayName.toLowerCase());
            results.push({ 
              displayName, 
              exePath: fullPath  // Store .lnk path, will be resolved when launching
            });
          }
        }
      }
    } catch (err) {
      debugLog(`scanDirectory error for ${dir}: ${err}`);
    }
  }

  for (const dir of startMenuDirs) {
    if (fs.existsSync(dir)) {
      debugLog(`Scanning: ${dir}`);
      await scanDirectory(dir);
    } else {
      debugLog(`Directory not found: ${dir}`);
    }
  }

  debugLog(`scanInstalledApps: Found ${results.length} apps from .lnk files`);
  return results;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s._-]+/g, "").trim();
}

async function ensureInstalledAppsCache(): Promise<InstalledAppCandidate[]> {
  const cache = store.get("installedAppsCache");
  const last = cache?.lastScannedAt ?? 0;
  const staleMs = 1000 * 60 * 60 * 24 * 7; // 7 days
  debugLog(`ensureInstalledAppsCache: cache exists=${!!cache?.apps}, count=${cache?.apps?.length ?? 0}, age=${Date.now() - last}ms`);
  
  if (cache?.apps?.length && Date.now() - last < staleMs) {
    debugLog(`ensureInstalledAppsCache: Using cached ${cache.apps.length} apps`);
    return cache.apps;
  }

  // Scan and cache.
  debugLog("ensureInstalledAppsCache: Cache stale or empty, scanning...");
  const apps = await scanInstalledApps();
  debugLog(`ensureInstalledAppsCache: Scan complete, caching ${apps.length} apps`);
  store.set("installedAppsCache", {
    lastScannedAt: Date.now(),
    apps
  });
  return apps;
}

function resolveCandidatesByName(
  candidates: InstalledAppCandidate[],
  typedName: string
): InstalledAppCandidate[] {
  const q = normalizeName(typedName);
  if (!q) return [];

  const scored = candidates
    .map((c) => {
      const dn = normalizeName(c.displayName);
      let score = 0;
      if (dn === q) score += 1000;
      if (dn.includes(q)) score += 200;
      if (q.includes(dn)) score += 50;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return top N to keep the UI snappy.
  return scored.slice(0, 12).map((x) => x.c);
}

ipcMain.handle("open-external", async (_evt, url: string) => openExternal(url));
ipcMain.handle("open-path", async (_evt, p: string) => openPath(p));

ipcMain.handle("storage-get-by-date", async (_evt, dateKey: DateKey) => {
  return {
    events: getEventsForDate(dateKey),
    todos: getTodosForDate(dateKey)
  };
});

ipcMain.handle(
  "storage-upsert-by-date",
  async (
    _evt,
    dateKey: DateKey,
    payload: { events?: EventItem[]; todos?: TodoItem[] }
  ) => {
    if (payload.events) store.set(`eventsByDate.${dateKey}`, payload.events);
    if (payload.todos) store.set(`todosByDate.${dateKey}`, payload.todos);
    return { ok: true };
  }
);

ipcMain.handle("resolve-app-name", async (_evt, typedName: string) => {
  debugLog(`IPC: resolve-app-name called with: "${typedName}"`);
  const apps = await ensureInstalledAppsCache();
  const candidates = resolveCandidatesByName(apps, typedName);
  debugLog(`IPC: resolve-app-name found ${candidates.length} candidates for "${typedName}"`);
  return candidates;
});

ipcMain.handle("open-clock-app", async () => {
  // Reliable and fast: protocol-based launch.
  try {
    await shell.openExternal("ms-clock:");
    return { used: "protocol" };
  } catch {
    // If protocol fails for any reason, fall back to name-based resolution.
  }

  const apps = await ensureInstalledAppsCache();
  const candidates = resolveCandidatesByName(apps, "clock");
  const best = candidates.find((c) =>
    normalizeName(c.displayName).includes("clock")
  );

  if (best?.exePath && fileExists(best.exePath)) {
    await shell.openPath(best.exePath);
    return { used: "exe", path: best.exePath };
  }

  return { used: "none" };
});

ipcMain.handle("get-start-apps", async () => {
  debugLog("IPC: get-start-apps called");
  try {
    const psCommand = `Get-StartApps | Select-Object Name, AppID | ConvertTo-Json`;
    const { stdout, stderr } = await execPromise(
      `powershell -NoProfile -Command "${psCommand}"`,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr) {
      debugLog(`get-start-apps: PowerShell stderr: ${stderr}`);
    }

    if (!stdout || stdout.trim() === "") {
      debugLog("get-start-apps: No output from PowerShell");
      return [];
    }

    let apps: StartAppItem[] = [];
    try {
      const parsed = JSON.parse(stdout);
      apps = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseErr) {
      debugLog(`get-start-apps: JSON parse error: ${parseErr}`);
      return [];
    }

    debugLog(`get-start-apps: Found ${apps.length} apps`);
    return apps;
  } catch (err) {
    debugLog(`get-start-apps: Error: ${err}`);
    return [];
  }
});

ipcMain.handle("launch-app-by-id", async (_evt, appId: string) => {
  debugLog(`IPC: launch-app-by-id called with: ${appId}`);
  try {
    const command = `explorer.exe shell:appsFolder\\${appId}`;
    await execPromise(command, { timeout: 5000 });
    debugLog(`launch-app-by-id: Launched ${appId}`);
    return { success: true };
  } catch (err) {
    debugLog(`launch-app-by-id: Error launching ${appId}: ${err}`);
    return { success: false, error: String(err) };
  }
});

/** Windows: use Electron login item (Settings → Startup). Other OS: auto-launch package. */
function applyOpenAtLogin() {
  const shouldEnable = !!store.get("settings.autoLaunch");
  const exePath = app.getPath("exe");

  if (process.platform === "win32") {
    try {
      app.setLoginItemSettings({
        openAtLogin: shouldEnable,
        path: exePath
      });
      debugLog(
        `setLoginItemSettings: openAtLogin=${shouldEnable} path=${exePath}`
      );
    } catch (err) {
      debugLog(`setLoginItemSettings failed: ${err}`);
    }
    return;
  }

  const launcher = new AutoLaunch({
    name: APP_NAME,
    path: exePath
  });
  if (shouldEnable) {
    launcher.enable().catch(() => undefined);
  } else {
    launcher.disable().catch(() => undefined);
  }
}

ipcMain.handle("set-auto-launch", async (_evt, enabled: boolean) => {
  store.set("settings.autoLaunch", !!enabled);
  applyOpenAtLogin();
  return { ok: true };
});

ipcMain.handle("get-auto-launch", async () => ({
  enabled: !!store.get("settings.autoLaunch")
}));

/**
 * Wallpaper window: pass mouse to the desktop except over interactive UI.
 * `passthrough` true => clicks go to desktop/icons; false => normal Electron hit-testing.
 */
ipcMain.on(
  "wallpaper-mouse-mode",
  (_evt, mode: "passthrough" | "interactive") => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      if (mode === "passthrough") {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    } catch (err) {
      debugLog(`wallpaper-mouse-mode error: ${err}`);
    }
  }
);

app.whenReady().then(() => {
  debugLog("app.whenReady");

  createWindow();

  // Default: start with Windows (first run)
  const current = store.get("settings.autoLaunch");
  if (typeof current !== "boolean") {
    store.set("settings.autoLaunch", true);
  }

  applyOpenAtLogin();
  startEventNotificationScheduler();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Keep running in the background for a wallpaper-like experience.
app.on("window-all-closed", () => {
  // No-op: keep running for wallpaper behavior.
});

