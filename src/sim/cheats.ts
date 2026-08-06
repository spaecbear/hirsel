/**
 * Cheat codes. Typed into the box in Settings.
 *
 * Deliberately none of these mention the sword, the wolf, or the summon
 * conditions — §15 stands, cheats included.
 */
import type { Game } from "./game";

export interface CheatContext {
  game: Game;
  toggleRetro: () => void;
  toggleInverse: () => void;
  setSpeed: (mult: number) => void;
}

export interface Cheat {
  code: string;
  name: string;
  blurb: string;
  apply: (c: CheatContext) => string;
}

export const CHEATS: Cheat[] = [
  {
    code: "RETRO",
    name: "Retro",
    blurb: "Switch between the original prototype art and the new scene.",
    apply: (c) => {
      c.toggleRetro();
      return "The glen shifts. Old paint, new paint.";
    },
  },
  {
    code: "SILLER",
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
    blurb: "The glen turns over. You keep foxes, and the sheep come off the hill for them.",
    apply: (c) => {
      c.toggleInverse();
      return "Something has gone the wrong way round.";
    },
  },
  {
    code: "HIRSEL",
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
    code: "HAAR",
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
