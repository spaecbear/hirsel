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
    return validate(f) ? f : null;
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

export function validate(f: unknown): f is SaveFile {
  if (!f || typeof f !== "object") return false;
  const s = f as SaveFile;
  if (s.v !== SAVE_VERSION) return false;
  const g = s.state;
  if (!g || typeof g !== "object") return false;
  // shape check against a fresh game: same top-level keys, same primitive kinds
  const ref = newGame();
  for (const k of Object.keys(ref) as (keyof GameState)[]) {
    if (!(k in g)) return false;
    if (typeof ref[k] !== typeof g[k]) return false;
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
    return validate(parsed) ? parsed.state : null;
  } catch {
    return null;
  }
}
