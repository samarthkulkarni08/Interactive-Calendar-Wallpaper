export {};

declare global {
  interface Window {
    api: {
      openExternal: (url: string) => Promise<void>;
      openPath: (p: string) => Promise<void>;
      openClockApp: () => Promise<unknown>;
      pickExe: () => Promise<{ exePath: string } | null>;
      storageGetByDate: (dateKey: string) => Promise<{
        events: Array<{ id: string; title: string; time: string; link?: string }>;
        todos: Array<{
          id: string;
          title: string;
          attachedAppName?: string;
          attachedAppId?: string;
          completed: boolean;
        }>;
      }>;
      storageUpsertByDate: (
        dateKey: string,
        payload: {
          events?: Array<{
            id: string;
            title: string;
            time: string;
            link?: string;
          }>;
          todos?: Array<{
            id: string;
            title: string;
            attachedAppName?: string;
            attachedAppId?: string;
            completed: boolean;
          }>;
        }
      ) => Promise<{ ok: boolean }>;
      getInstalledApps: () => Promise<
        Array<{ displayName: string; exePath: string }>
      >;
      resolveAppName: (typedName: string) => Promise<
        Array<{ displayName: string; exePath: string }>
      >;
      forceRescanApps: () => Promise<
        Array<{ displayName: string; exePath: string }>
      >;
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
      getStartApps: () => Promise<Array<{ Name: string; AppID: string }>>;
      launchAppById: (appId: string) => Promise<{ success: boolean; error?: string }>;
      getAutoLaunch: () => Promise<{ enabled: boolean }>;
      setAutoLaunch: (enabled: boolean) => Promise<{ ok: boolean }>;
    };
  }
}

