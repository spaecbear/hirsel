/**
 * Cheat codes. Typed into the box in Settings.
 *
 * Deliberately none of these mention the sword, the wolf, or the summon
 * conditions — §15 stands, cheats included.
 */
import type { Game } from "./game";
import type { Settings } from "./settings";

export interface CheatContext {
  game: Game;
  settings: Settings;
  toggleRetro: () => void;
  toggleInverse: () => void;
  toggleZen: () => void;
  toggleSwift: () => void;
  setSpeed: (mult: number) => void;
  /** get out of the way — some codes have something to show you */
  closeSettings: () => void;
}

export interface Cheat {
  code: string;
  name: string;
  blurb: string;
  /**
   * `toggle` codes hold a state and show it; `action` codes do a thing once.
   * Either way, once a code is found it stays found and can be worked from the
   * menu in any later run without being typed again.
   */
  kind: "toggle" | "action";
  /** toggles only: is it currently on? */
  isOn?: (c: CheatContext) => boolean;
  apply: (c: CheatContext) => string;
}

export const CHEATS: Cheat[] = [
  {
    code: "RETRO",
    name: "Retro",
    kind: "toggle",
    isOn: (c) => c.settings.ui === "retro",
    blurb: "Play the old panelled build instead of the full-screen glen.",
    apply: (c) => {
      c.toggleRetro();
      return "The glen shifts. Old build, new build.";
    },
  },
  {
    code: "SILLER",
    kind: "action",
    name: "Siller",
    blurb: "£500 in the purse. For testing, and for the shameless.",
    apply: (c) => {
      c.game.state.money += 500;
      c.game.say("A stranger settled a debt you had forgotten. £500.", "gold");
      c.game.changed();
      return "£500 in the purse.";
    },
  },
  {
    code: "TOD",
    name: "Tod",
    kind: "toggle",
    isOn: (c) => c.settings.inverse,
    blurb: "The glen turns over. You keep foxes, and the sheep come off the hill for them.",
    apply: (c) => {
      c.toggleInverse();
      return "Something has gone the wrong way round.";
    },
  },
  {
    code: "HIRSEL",
    kind: "action",
    name: "Hirsel",
    blurb: "Twelve more beasts on the ground.",
    apply: (c) => {
      const g = c.game.state;
      for (let i = 0; i < 12; i++) g.flock.push({ id: g.nextSheepId++, fleece: 3, breed: "blackface", age: 0 });
      c.game.say("Twelve strangers wandered onto your ground and stayed.", "gold");
      c.game.changed();
      return "Twelve more on the hill.";
    },
  },
  {
    code: "LANGDAY",
    kind: "action",
    name: "Lang day",
    blurb: "Fill the taps back up. Once per use, not permanent.",
    apply: (c) => {
      c.game.state.taps += 3;
      c.game.say("The light holds longer than it has any right to.", "cozy");
      c.game.changed();
      return "Three taps back.";
    },
  },
  {
    // the last wolf in Scotland was killed some time in the 1680s
    code: "1680",
    name: "1680",
    kind: "action",
    blurb: "He comes down off the skyline whether the night agrees or not. What happens after that is between him and whatever is hanging above your fire.",
    apply: (c) => {
      c.closeSettings();
      switch (c.game.forceWolf()) {
        case "pelt":
          return "You had the reach of him.";
        case "mauled":
          return "You had nothing in your hands but a crook.";
        default:
          return "The hill stays quiet.";
      }
    },
  },
  {
    code: "ZEN",
    name: "Zen",
    kind: "toggle",
    isOn: (c) => c.settings.zen,
    blurb: "The day never runs out. Work the hill as long as you like.",
    apply: (c) => {
      c.toggleZen();
      return c.settings.zen ? "The light holds. Take your time." : "The day is a day again.";
    },
  },
  {
    code: "SKELP",
    name: "Skelp",
    kind: "toggle",
    isOn: (c) => c.settings.swift,
    blurb: "Everything moves at twice the pace. The nights and the inn are long on purpose, but not everyone has the evening.",
    apply: (c) => {
      c.toggleSwift();
      return c.settings.swift ? "Away at a fair skelp." : "Back to the ordinary pace of things.";
    },
  },
  {
    code: "HAAR",
    kind: "action",
    name: "Haar",
    blurb: "Roll the forecast over. Sometimes that is all you need.",
    apply: (c) => {
      const g = c.game.state;
      g.forecast = ["sun", "sun", "sun"];
      c.game.say("The cloud lifts off the glen and stays off.", "cozy");
      c.game.changed();
      return "Three days of sun.";
    },
  },
];

/**
 * The order codes are handed over in, one per finished run.
 *
 * Weakest and most quality-of-life first, so an early win changes how the
 * game feels rather than how hard it is; the ones that actually undo the
 * game are the reward for playing it a lot.
 *
 *   RETRO    cosmetic
 *   SKELP    pace only, nothing about the game changes
 *   HAAR     three days of weather, once
 *   LANGDAY  three taps, once
 *   HIRSEL   twelve beasts — powerful, but you still have to farm them
 *   1680     dangerous rather than strong, if you do not know what you are
 *            doing. By here the player has won five times and has almost
 *            certainly met him, so it gives nothing away that is still secret
 *   TOD      the strangest thing in the game, saved as a treat
 *   SILLER   money, which skips the part the game is about
 *   ZEN      unlimited days, which skips the rest of it
 */
export const REVEAL_ORDER = ["RETRO", "SKELP", "HAAR", "LANGDAY", "HIRSEL", "1680", "TOD", "SILLER", "ZEN"];

export function revealNextCheat(found: string[]): Cheat | null {
  const have = new Set(found);
  for (const code of REVEAL_ORDER) {
    if (have.has(code)) continue;
    const cheat = CHEATS.find((c) => c.code === code);
    if (cheat) return cheat;
  }
  // anything not listed above, so a new code can never be unreachable
  return CHEATS.find((c) => !have.has(c.code)) ?? null;
}

export function findCheat(input: string): Cheat | null {
  const code = input.trim().toUpperCase();
  return CHEATS.find((c) => c.code === code) ?? null;
}
