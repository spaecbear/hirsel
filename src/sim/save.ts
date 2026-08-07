/**
 * Save system, deliberately designed (§15 forbade using localStorage until it was).
 *
 * - one versioned slot, plus export/import as a file so a run can be moved or kept
 * - autosave happens at one point only: the end of a night. Never mid-animation,
 *   never mid-action, so a reload can never land inside a half-resolved day
 * - unknown or future versions are refused rather than half-loaded
 */
import type { GameState } from "./types";
import { newGame } from "./game";

const SLOT = "hirsel.save.v1";
export const SAVE_VERSION = 1;

export interface SaveFile {
  v: number;
  savedAt: number;
  state: GameState;
}

export function serialise(state: GameState): SaveFile {
  return { v: SAVE_VERSION, savedAt: Date.now(), state };
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SLOT, JSON.stringify(serialise(state)));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SLOT);
    if (!raw) return null;
    const f = JSON.parse(raw) as SaveFile;
    if (!validate(f)) return null;
    return { ...f, state: hydrate(f.state) };
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return readSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SLOT);
  } catch {
    /* ignore */
  }
}

/**
 * Fill in anything a save predates.
 *
 * `validate` requires every key a fresh game has, so adding a field to
 * GameState would otherwise silently reject every existing save — the player
 * loses their run to a feature they never asked for. Anything missing is
 * taken from a fresh game, top level and inside `stats`.
 */
export function hydrate(state: GameState): GameState {
  const fresh = newGame();
  const merged = { ...fresh, ...state } as GameState;
  merged.stats = { ...fresh.stats, ...(state.stats ?? {}) };
  return merged;
}

export function validate(f: unknown): f is SaveFile {
  if (!f || typeof f !== "object") return false;
  const s = f as SaveFile;
  if (s.v !== SAVE_VERSION) return false;
  const g = s.state;
  if (!g || typeof g !== "object") return false;
  // shape check against a fresh game: same top-level keys, same primitive kinds
  /*
   * Only the shape the game cannot run without. Requiring every key meant
   * every new field broke every existing save; anything absent is filled in
   * by `hydrate` instead.
   */
  const core: (keyof GameState)[] = ["day", "money", "flock", "pastures", "forecast", "owned", "buffs"];
  for (const k of core) {
    if (!(k in g)) return false;
  }
  return Array.isArray(g.flock) && Array.isArray(g.pastures) && Array.isArray(g.forecast);
}

export function exportFile(state: GameState) {
  const blob = new Blob([JSON.stringify(serialise(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hirsel-day-${state.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importFile(file: File): Promise<GameState | null> {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    return validate(parsed) ? hydrate(parsed.state) : null;
  } catch {
    return null;
  }
}
