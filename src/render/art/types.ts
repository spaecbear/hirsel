import type { Painter } from "../painter";
import type { AnimId, GameState, LogClass } from "../../sim/types";
import type { HotspotId } from "../layout";

/** a line of narration drifting up the sky, newest brightest */
export interface SkyMessage {
  text: string;
  cls: LogClass;
  /** 0 when it appears, 1 when it has faded out */
  age: number;
}

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
  /** narration surfacing in the sky, newest first */
  messages?: SkyMessage[];
  /** what the pointer is over, so it can be picked out of the scene */
  hover?: HotspotId | null;
  /** the thing the player last tapped, pulsing while its sheet is open */
  active?: HotspotId | null;
  /** where he has walked to, if he has been sent somewhere */
  shepherdAt?: { x: number; y: number } | null;
  /** true while he is on his way there, so he walks rather than stands */
  walking?: boolean;
  /** ZEN: the day never runs out, so the HUD shows a count that never falls */
  zen?: boolean;
  /** true when the player has gone inside the croft */
  interior?: boolean;
  /** the tutorial is pointing at this */
  spotlight?: HotspotId | null;
  /** the tutorial is pointing at the bed, which is only inside */
  spotlightBed?: boolean;
  /** logical rows covered by a notch or status bar at the top of the screen */
  safeTop?: number;
}

export interface ArtPack {
  id: "glen" | "retro";
  name: string;
  /**
   * Fluid packs take their logical size from the viewport rather than a fixed
   * one — the full-screen glen has no single resolution, so nothing in it can
   * be drawn at hardcoded coordinates.
   */
  fluid?: boolean;
  /** logical pixel size; the canvas is an integer multiple of it. Fixed packs only. */
  width: number;
  height: number;
  draw(g: Painter, s: Scene): void;
}
