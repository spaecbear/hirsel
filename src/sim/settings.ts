/** Player preferences. Separate from the save file — they outlive any one run. */

/**
 * Which whole interface you play in.
 *
 * `glen`   the full-screen scene: you work the hill by tapping the things in
 *          it, and the narration surfaces in the sky
 * `retro`  the original panelled build — HUD, a small scene, and tabs. Kept
 *          intact rather than deleted, since it is the version that was
 *          balanced and playtested.
 *
 * This replaced an art-pack switch (`hirsel`/`og`). The old prototype-port
 * pack is gone; `retro` now means the panelled UI, not a second set of sprites.
 */
export type UiMode = "glen" | "retro";
export type MotionPref = "auto" | "full" | "reduced";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  ui: UiMode;
  motion: MotionPref;
  autosave: boolean;
  /** "TOD" — you keep foxes, and the sheep come for them */
  inverse: boolean;
  /** codes the player has ever entered, so the cheat list can show what's known */
  cheatsFound: string[];
  /** the title screen is skipped once a run is under way */
  seenTitle: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.85,
  music: 0.3,
  sfx: 0.55,
  muted: false,
  ui: "glen",
  motion: "auto",
  autosave: true,
  inverse: false,
  cheatsFound: [],
  seenTitle: false,
};

const KEY = "hirsel.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Settings> & { art?: string };
    const s = { ...DEFAULT_SETTINGS, ...saved };
    // migrate the old art-pack setting: anyone who had the prototype port
    // selected wanted the old look, which is now the retro interface
    if (saved.art && !saved.ui) s.ui = saved.art === "og" ? "retro" : "glen";
    delete (s as { art?: string }).art;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(s: Settings): boolean {
  if (s.motion === "reduced") return true;
  if (s.motion === "full") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
