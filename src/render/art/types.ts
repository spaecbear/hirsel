import type { Painter } from "../painter";
import type { AnimId, GameState } from "../../sim/types";

export interface Scene {
  state: GameState;
  anim: AnimId | null;
  /** 0 → 1 across the current animation */
  p: number;
  /** ms, for idle motion */
  time: number;
  reduced: boolean;
  /** TOD cheat: the flock is foxes and the raider is a ram */
  inverse: boolean;
  /** for animations about something not yet in the state — the bought ewe */
  payload?: { breed?: string };
}

export interface ArtPack {
  id: "hirsel" | "og";
  name: string;
  /** logical pixel size of the scene; the canvas is an integer multiple of it */
  width: number;
  height: number;
  draw(g: Painter, s: Scene): void;
}
