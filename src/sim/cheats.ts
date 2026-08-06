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
    isOn: (c) => c.settings.art === "og",
    blurb: "Switch between the original prototype art and the new scene.",
    apply: (c) => {
      c.toggleRetro();
      return "The glen shifts. Old paint, new paint.";
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

export function findCheat(input: string): Cheat | null {
  const code = input.trim().toUpperCase();
  return CHEATS.find((c) => c.code === code) ?? null;
}
