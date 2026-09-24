/**
 * Keyboard and gamepad, turned into a handful of intents.
 *
 * The game was built for a finger and a mouse. A Steam Deck, a controller on a
 * sofa, or a player who would rather keep their hands on the keys all need the
 * same small set of things: move a selection, choose it, back out, open the
 * menu, look at the sky. Everything below reduces both devices to those, so
 * the code that acts on them (ui/nav.ts) never asks which one it was.
 *
 * Nothing here touches the game or the DOM beyond listening; it reports what
 * was asked and which device asked it.
 */

export type Dir = "up" | "down" | "left" | "right";
export type Intent = Dir | "confirm" | "back" | "menu" | "sky";
/** which of the three ways in was used last — decides whether a focus ring shows */
export type Device = "pointer" | "keys" | "pad";

/**
 * What a key means, or null if it means nothing to the game.
 *
 * WASD as well as the arrows, since a hand on the keys is usually already
 * there. Enter and Space both choose. Escape backs out; Backspace does too,
 * since on some keyboards that is where the hand goes for "back".
 */
export function keyIntent(key: string): Intent | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    case "Enter":
    case " ":
      return "confirm";
    case "Escape":
    case "Backspace":
      return "back";
    case "f":
    case "F":
      return "sky";
    default:
      return null;
  }
}

/**
 * The standard gamepad layout (what Steam Input presents to the game, and
 * what an Xbox or PlayStation pad reports in a browser): A chooses, B backs
 * out, Start is the menu, View/Select is the sky, and the d-pad moves.
 */
export const PAD_BUTTONS: Partial<Record<number, Intent>> = {
  0: "confirm",
  1: "back",
  8: "sky",
  9: "menu",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

/** below this the stick is resting, not being pushed */
export const DEADZONE = 0.5;
/** how long a held direction waits before it starts repeating, and how fast after */
export const REPEAT_FIRST = 380;
export const REPEAT_EVERY = 140;

/** which way a stick is being pushed, if it is being pushed hard enough to mean it */
export function stickDir(x: number, y: number, dead = DEADZONE): Dir | null {
  if (Math.abs(x) < dead && Math.abs(y) < dead) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}

/** the parts of a Gamepad this reads — so tests can hand it a plain object */
export interface PadLike {
  buttons: ReadonlyArray<{ pressed: boolean }>;
  axes: ReadonlyArray<number>;
}

/**
 * Turns successive gamepad snapshots into intents: a button press fires once
 * when it goes down, and a held direction (d-pad or left stick) fires once
 * and then repeats, the way a held key does.
 */
export class PadReader {
  private down = new Set<number>();
  private held: Dir | null = null;
  private heldSince = 0;
  private lastRepeat = 0;

  /** returns the intents this snapshot adds, and the right stick for walking */
  read(pad: PadLike, now: number): { intents: Intent[]; walk: { x: number; y: number } | null } {
    const intents: Intent[] = [];
    let dpad: Dir | null = null;

    pad.buttons.forEach((b, i) => {
      const intent = PAD_BUTTONS[i];
      if (!intent) return;
      const isDir = intent === "up" || intent === "down" || intent === "left" || intent === "right";
      if (b.pressed) {
        if (isDir) dpad = intent as Dir;
        else if (!this.down.has(i)) intents.push(intent);
        this.down.add(i);
      } else {
        this.down.delete(i);
      }
    });

    // the d-pad wins over the stick; either repeats while held
    const dir = dpad ?? stickDir(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    if (dir !== this.held) {
      this.held = dir;
      this.heldSince = now;
      this.lastRepeat = now;
      if (dir) intents.push(dir);
    } else if (dir && now - this.heldSince >= REPEAT_FIRST && now - this.lastRepeat >= REPEAT_EVERY) {
      this.lastRepeat = now;
      intents.push(dir);
    }

    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;
    const walk = Math.hypot(rx, ry) > DEADZONE * 0.6 ? { x: rx, y: ry } : null;
    return { intents, walk };
  }

  /** anything at all being pressed or pushed — the pad has been picked up */
  static active(pad: PadLike): boolean {
    return pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a) > DEADZONE);
  }
}
