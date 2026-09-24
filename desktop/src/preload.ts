/**
 * The bridge between the game and the desktop.
 *
 * Puts `window.hirselPlatform` in place before the game's own scripts run;
 * `src/platform/index.ts` in the game finds it and uses it instead of
 * localStorage. Nothing else from Node or Electron is exposed to the page.
 *
 * Storage is synchronous IPC on purpose: the game's save calls are
 * synchronous, the files are a few kilobytes, and a write happens once a
 * night.
 */
import { contextBridge, ipcRenderer } from "electron";

type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

function call<T>(channel: string, ...args: unknown[]): T {
  const r = ipcRenderer.sendSync(channel, ...args) as Reply<T>;
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

contextBridge.exposeInMainWorld("hirselPlatform", {
  kind: "steam",
  read: (key: string) => call<string | null>("store:read", key),
  write: (key: string, value: string) => call<void>("store:write", key, value),
  remove: (key: string) => call<void>("store:remove", key),
  unlockAchievement: (id: string) => ipcRenderer.send("steam:achievement", id),
  quit: () => ipcRenderer.send("app:quit"),
  setFullscreen: (on: boolean) => ipcRenderer.send("window:fullscreen", on),
  isFullscreen: () => call<boolean>("window:is-fullscreen"),
});
