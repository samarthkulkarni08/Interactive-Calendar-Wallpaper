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
  pickExe: () => ipcRenderer.invoke("pick-exe") as Promise<{
    exePath: string;
  } | null>,

  storageGetByDate: (dateKey: DateKey) =>
    ipcRenderer.invoke("storage-get-by-date", dateKey),
  storageUpsertByDate: (
    dateKey: DateKey,
    payload: { events?: EventItem[]; todos?: TodoItem[] }
  ) => ipcRenderer.invoke("storage-upsert-by-date", dateKey, payload),

  getInstalledApps: () =>
    ipcRenderer.invoke("get-installed-apps") as Promise<InstalledAppCandidate[]>,
  
  resolveAppName: (typedName: string) =>
    ipcRenderer.invoke("resolve-app-name", typedName) as Promise<
      InstalledAppCandidate[]
    >,
  
  forceRescanApps: () =>
    ipcRenderer.invoke("force-rescan-apps") as Promise<InstalledAppCandidate[]>,
  
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send("set-ignore-mouse-events", ignore, options),
  
  getStartApps: () =>
    ipcRenderer.invoke("get-start-apps") as Promise<StartAppItem[]>,
  
  launchAppById: (appId: string) =>
    ipcRenderer.invoke("launch-app-by-id", appId) as Promise<{ success: boolean; error?: string }>,

  getAutoLaunch: () =>
    ipcRenderer.invoke("get-auto-launch") as Promise<{ enabled: boolean }>,

  setAutoLaunch: (enabled: boolean) =>
    ipcRenderer.invoke("set-auto-launch", enabled) as Promise<{ ok: boolean }>
});

