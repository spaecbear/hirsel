/**
 * Plain-English reference for every buff and status, for Settings.
 *
 * The numbers are built from BALANCE at call time rather than written out by
 * hand, so a future tuning pass (see the market price and wolf-survivor
 * changes) can't silently leave this appendix describing the wrong game.
 */
import { BALANCE } from "./config";
import { loadEarned } from "./achievements";

export interface GlossaryEntry {
  id: string;
  name: string;
  meta: string; // duration and how it's got
  effect: string;
  /** true if this entry describes something the wolf gates — masked until earned */
  secret?: boolean;
}

const pct = (mult: number) => `${mult >= 1 ? "+" : ""}${Math.round((mult - 1) * 100)}%`;

export function buffGlossary(): GlossaryEntry[] {
  return [
    {
      id: "tended",
      name: "Tended",
      meta: `${BALANCE.tendDays} days · Tend the flock`,
      effect: `${pct(BALANCE.tendedGrowth)} fleece growth. No sheep can be lost to flystrike while it holds.`,
    },
    {
      id: "steady hands",
      name: "Steady hands",
      meta: `${BALANCE.cozyBuffDays} days · Smoke a pipe`,
      effect: `${pct(BALANCE.steadyHandsBonus)} wool from every shearing.`,
    },
    {
      id: "settled flock",
      name: "Settled flock",
      meta: `${BALANCE.cozyBuffDays} days · Strike up the bagpipes`,
      effect: `${pct(BALANCE.settledGrowth)} fleece growth. Fox risk ×${BALANCE.settledFoxBias}.`,
    },
    {
      id: "hale",
      name: "Hale",
      meta: `${BALANCE.haleDays} days · A pint at the inn (£${BALANCE.pintCost})`,
      effect: `One extra tap a day (taps still cap at ${BALANCE.maxTaps}).`,
    },
  ];
}

export function statusGlossary(): GlossaryEntry[] {
  const peltEarned = loadEarned().includes("pelt");
  return [
    {
      id: "gathered",
      name: "Gathered",
      meta: "Rest of the day · Gather the flock (free with the crook)",
      effect: `Lasts until you move pastures or sleep. That night's fox risk ×${BALANCE.gatheredFoxBias}.`,
    },
    {
      id: "pelt",
      name: peltEarned ? "The last wolf's pelt" : "?????",
      meta: peltEarned ? "Forever, once taken" : "?????",
      effect: peltEarned
        ? `Fox risk becomes a flat ${Math.round(BALANCE.peltFoxRisk * 100)}%, every night, on any ground. Taken on the High Corrie under a full moon.`
        : "Something is out there.",
      secret: true,
    },
  ];
}

