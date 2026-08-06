/** Player preferences. Separate from the save file — they outlive any one run. */
export type ArtStyle = "hirsel" | "og";
export type MotionPref = "auto" | "full" | "reduced";

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  art: ArtStyle;
  motion: MotionPref;
  autosave: boolean;
  /** "TOD" — you keep foxes, and the sheep come for them */
  inverse: boolean;
  /** codes the player has ever entered, so the cheat list can show what's known */
  cheatsFound: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.85,
  music: 0.3,
  sfx: 0.55,
  muted: false,
  art: "hirsel",
  motion: "auto",
  autosave: true,
  inverse: false,
  cheatsFound: [],
};

const KEY = "hirsel.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
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
