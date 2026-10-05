/*
 * A made-up but legal run for the store art and the trailer, and the glen
 * drawn from it by the game's own renderer at a given logical size.
 */
import { Painter } from "../../src/render/painter";
import { GLEN_ART } from "../../src/render/art/glen";
import { newGame } from "../../src/sim/game";
import type { AnimId, BreedId, GameState, Sheep, WeatherId } from "../../src/sim/types";

/* ------------------------------------------------------------------ *
 * the run the pictures are of
 * ------------------------------------------------------------------ */

const BREEDS: BreedId[] = ["blackface", "blackface", "cheviot", "hebridean", "blackface", "shetland", "cheviot", "blackface"];

export function run(
  o: { day?: number; at?: number; weather?: WeatherId; ewes?: number; lambs?: number; seed?: number; owned?: Record<string, boolean> } = {},
): GameState {
  const st = newGame({ seed: o.seed ?? 11 });
  const ewes = o.ewes ?? 9;
  const lambs = o.lambs ?? 3;
  const flock: Sheep[] = [];
  for (let i = 0; i < ewes; i++) flock.push({ id: i + 1, fleece: 5 + (i % 4), breed: BREEDS[i % BREEDS.length], age: 60 + i });
  for (let i = 0; i < lambs; i++) flock.push({ id: 100 + i, fleece: 1, breed: BREEDS[i % 3], age: 2, lamb: true });
  st.flock = flock;
  st.day = o.day ?? 30;
  st.at = o.at ?? 0;
  st.forecast = [o.weather ?? "sun", "sun", "sun"];
  st.owned = { ...st.owned, crook: true, dog: true, boots: true, shears: true, lamp: true, roof: true, hearth: true, saltlick: true, cart: true, ...(o.owned ?? {}) };
  st.hay = 40;
  return st;
}

/** the glen at a logical size, as the game would draw it at that window size */
export function glen(W: number, H: number, st: GameState, time = 4200, o: { anim?: AnimId | null; p?: number; interior?: boolean; payload?: { croft?: string; breed?: string } } = {}): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = new Painter(c.getContext("2d")!, W, H);
  (g as unknown as { W: number; H: number }).W = W;
  (g as unknown as { W: number; H: number }).H = H;
  GLEN_ART.draw(g, { state: st, anim: o.anim ?? null, p: o.p ?? 0, time, reduced: false, inverse: false, interior: o.interior, payload: o.payload });
  return c;
}

