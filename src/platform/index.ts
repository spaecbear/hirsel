/**
 * Everything the game asks of the machine it runs on.
 *
 * The web build keeps its saves in `localStorage` and has no achievements
 * service and no Quit. A desktop build (Electron, for Steam) puts a
 * `hirselPlatform` bridge on the window before the game loads, and the game
 * uses that instead — so the sim, the save format and every call site are the
 * same in both, and only this file knows there is more than one.
 *
 * Storage calls are synchronous on purpose. Saves are small and written once a
 * night; making them async would ripple through every caller for nothing.
 */
export interface Platform {
  /** "web" or "steam" — for the few places that show different things, like Quit */
  readonly kind: "web" | "steam";
  read(key: string): string | null;
  /** throws on failure; callers decide whether a failed write is worth mentioning */
  write(key: string, value: string): void;
  remove(key: string): void;
  /** tell the storefront an achievement was earned. Safe to call repeatedly */
  unlockAchievement(id: string): void;
  /** desktop only: leave the game */
  quit?(): void;
  /** desktop only */
  setFullscreen?(on: boolean): void;
  isFullscreen?(): boolean;
}

/**
 * Reads `localStorage` at call time, not import time, so the test setup's
 * in-memory storage (installed after modules load) is the one used.
 */
export const webPlatform: Platform = {
  kind: "web",
  read: (key) => localStorage.getItem(key),
  write: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  unlockAchievement: () => {
    /* the web build keeps its own list; there is nobody else to tell */
  },
};

function detect(): Platform {
  const bridge = (globalThis as { hirselPlatform?: Platform }).hirselPlatform;
  return bridge ?? webPlatform;
}

export const platform: Platform = detect();
