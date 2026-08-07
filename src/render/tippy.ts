/**
 * Tippy going to the fire.
 *
 * A border collie who has a lit hearth to lie in front of will lie in front
 * of it, and will not be talked out of it. Two ways you can meet that:
 *
 *  - the hearth is finished while you are standing in the room, and she gets
 *    up and walks over to it
 *  - you already had the hearth, or you were outside when it was built, and
 *    she is simply there when you walk in
 *
 * Presentation only: nothing here is saved and nothing in the rules reads it.
 * It watches what it is asked to draw from one frame to the next, which is
 * why the painter can tell the two cases apart without the sim telling it.
 */

/** how long she takes to cross the room */
export const WALK_MS = 1500;

let walkStart = -Infinity;
/** what the last drawn frame looked like, to spot the change */
let sawRoom = false;
let sawFire = false;

export interface TippyState {
  /** 0 while she is still on her way, 1 once she is down at the fire */
  there: number;
  walking: boolean;
}

/**
 * Call once per drawn interior frame.
 *
 * `fire` is "she has a hearth to lie at" — the collie and the built hearth
 * together. The walk only starts when that turns true in a room that was
 * already on screen; arriving to find it true means she is already down.
 */
export function tippyFrame(time: number, inRoom: boolean, fire: boolean): TippyState {
  if (!inRoom || !fire) {
    // leaving the room, or no fire yet: forget any walk in progress
    if (!fire) walkStart = -Infinity;
    sawRoom = inRoom;
    sawFire = inRoom && fire;
    return { there: fire ? 1 : 0, walking: false };
  }

  // it has just become true while the room was already being drawn
  if (sawRoom && !sawFire && walkStart === -Infinity) walkStart = time;
  sawRoom = true;
  sawFire = true;

  if (walkStart === -Infinity) return { there: 1, walking: false }; // already there
  const t = (time - walkStart) / WALK_MS;
  if (t >= 1) return { there: 1, walking: false };
  return { there: Math.max(0, t), walking: true };
}

/** true while she is still crossing the room, for anything waiting on her */
export function tippyWalking(time: number): boolean {
  if (walkStart === -Infinity) return false;
  return time - walkStart < WALK_MS;
}

export function resetTippy() {
  walkStart = -Infinity;
  sawRoom = false;
  sawFire = false;
}
