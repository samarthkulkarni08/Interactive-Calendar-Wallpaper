import { contextBridge, ipcRenderer } from "electron";

type DateKey = string; // YYYY-MM-DD

type EventItem = {
  id: string;
  title: string;
  time: string;
  link?: string;
};

type TodoItem = {
  id: string;
  title: string;
  attachedAppName?: string;
  attachedAppId?: string;
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

contextBridge.exposeInMainWorld("api", {
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  openPath: (p: string) => ipcRenderer.invoke("open-path", p),
  openClockApp: () => ipcRenderer.invoke("open-clock-app"),

  storageGetByDate: (dateKey: DateKey) =>
    ipcRenderer.invoke("storage-get-by-date", dateKey),
  storageUpsertByDate: (
    dateKey: DateKey,
    payload: { events?: EventItem[]; todos?: TodoItem[] }
  ) => ipcRenderer.invoke("storage-upsert-by-date", dateKey, payload),

  resolveAppName: (typedName: string) =>
    ipcRenderer.invoke("resolve-app-name", typedName) as Promise<
      InstalledAppCandidate[]
    >,

  getStartApps: () =>
    ipcRenderer.invoke("get-start-apps") as Promise<StartAppItem[]>,
  
  launchAppById: (appId: string) =>
    ipcRenderer.invoke("launch-app-by-id", appId) as Promise<{ success: boolean; error?: string }>,

  getAutoLaunch: () =>
    ipcRenderer.invoke("get-auto-launch") as Promise<{ enabled: boolean }>,

  setAutoLaunch: (enabled: boolean) =>
    ipcRenderer.invoke("set-auto-launch", enabled) as Promise<{ ok: boolean }>,

  /** Tell main process whether the mouse should pass through to the desktop */
  setWallpaperMouseMode: (mode: "passthrough" | "interactive") =>
    ipcRenderer.send("wallpaper-mouse-mode", mode)
});

