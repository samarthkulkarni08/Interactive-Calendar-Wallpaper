# Building & releasing (Windows)

## 1. Build the installer

`electron-builder` is configured under `"build"` in [package.json](package.json).

```bash
npm install
npm run package
```

This runs `npm run build` (TypeScript main + Vite renderer) then produces an NSIS installer under `dist/` (e.g. `Desktop Productivity Wallpaper Setup x.x.x.exe`).

## 2. Auto-start on Windows boot

On **Windows**, startup uses Electron’s **`app.setLoginItemSettings`** (same as *Settings → Apps → Startup*), driven by `settings.autoLaunch` in `electron-store` (default `true` on first run).

- Renderer can call `window.api.getAutoLaunch()` / `window.api.setAutoLaunch(true|false)` if you add a settings toggle later.
- On **macOS/Linux**, the `auto-launch` npm package is still used.

## 3. Event notifications

For **today’s** events, when the system clock reaches the event’s time (same local **HH:MM**), the app shows a **Windows toast** (Electron `Notification`). Each event fires **once per day**. If the event has a **link**, clicking the notification opens it in the default browser.

**Note:** The app must be running (tray/background) for the scheduler to run. Windows may require **notifications enabled** for the app in *Settings → System → Notifications*.

## 4. Test checklist

1. Install the generated `.exe` on a test PC.
2. Confirm the wallpaper starts and **Startup** entry appears when auto-launch is enabled.
3. Add an event **for today** a minute or two ahead; wait for the toast.
4. Add todos/events and confirm persistence after restart.
5. Test **Attach app** / launch from a todo.

## 5. Distribution options

- **GitHub Releases:** Upload the NSIS `.exe` as a release asset.
- **Direct download:** Host the installer on your site.
- **Microsoft Store:** Separate packaging/signing process (not covered here).
