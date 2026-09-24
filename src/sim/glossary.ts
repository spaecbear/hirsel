/**
 * Plain-English reference for every buff and status, for Settings.
 *
 * The numbers are built from BALANCE at call time rather than written out by
 * hand, so a future tuning pass (see the market price and wolf-survivor
 * changes) can't silently leave this appendix describing the wrong game.
 */
import { BALANCE, SEASON_DAYS, SEASON_ORDER, SEASONS } from "./config";
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
      id: "fiddled",
      name: "Fiddled",
      meta: `${BALANCE.fiddleDays} days · Strike up the fiddle`,
      effect: `${pct(BALANCE.fiddleGrowth)} fleece growth. Nothing against a fox — that is the trade.`,
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

/** how the day's work grows with the flock */
export function workGlossary(): GlossaryEntry[] {
  return [
    {
      id: "shearing",
      name: "Shearing",
      meta: `1 tap per ${BALANCE.shearPerTap} beasts · ${BALANCE.shearPerTapWithShears} with blade shears`,
      effect: `Never more than ${BALANCE.shearMaxTaps} taps, so a day can always hold one clip.`,
    },
    {
      id: "gathering",
      name: "Gathering",
      meta: `2 taps past ${BALANCE.bigFlock} beasts, on your own`,
      effect: "A dog does the running for you, and the crook takes a tap off either way.",
    },
    {
      id: "dogs",
      name: "The dog's years",
      meta: `In her prime for ${BALANCE.dogOldDays} days on the hill · retires after ${BALANCE.dogRetireDays}`,
      effect: `Once she is getting on she still gathers, but is worth ${Math.round(BALANCE.oldDogStrength * 100)}% of what she was. Retired, she lies by the fire and the cart will sell you another; each retired dog still takes fox risk ×${BALANCE.retiredFoxBias}, up to ${BALANCE.retiredCounted} of them.`,
    },
    {
      id: "lambing",
      name: "Lambing",
      meta: `The tup goes in over the autumn · lambs over the first ${BALANCE.lambingDays} days of spring`,
      effect: `About ${Math.round(BALANCE.tupRate * 100)}% of the ewes are in lamb by winter; a hungry winter night can cost one her lamb. About one ewe in ${Math.round(1 / BALANCE.twinChance)} has twins. In the byre every lamb lives; out on a wet night ${Math.round(BALANCE.lambLossBadNight * 100)}% are lost, half that if the flock is tended. Lambs carry half a fleece, are grown after ${BALANCE.lambGrowDays} days, and sell for ${Math.round(BALANCE.lambPrice * 100)}% of a ewe's price — ${Math.round(BALANCE.lambPrice * BALANCE.lambPriceAutumn * 100)}% at the autumn sales.`,
    },
    {
      id: "hay",
      name: "Hay",
      meta: `Cut hay (summer, a dry day): ${BALANCE.hayCutBales} bales · the cart: ${BALANCE.hayLot} for £${BALANCE.hayLotCost}, £${BALANCE.hayLotCostWinter} in winter`,
      effect: `Fed out at night in winter only, when the ground falls short. A bale stands in for ${BALANCE.hayGrass} grass. On a day of snow the grass is buried and hay is all they have.`,
    },
  ];
}

/** what each part of the year does, straight from the numbers */
export function seasonGlossary(): GlossaryEntry[] {
  const x = (m: number) => (m === 1 ? null : m === 0 ? "none" : pct(m));
  return SEASON_ORDER.map((id, i) => {
    const s = SEASONS[id];
    const parts = [
      x(s.regen) && `grass regrowth ${x(s.regen)}`,
      x(s.growth) && `fleece growth ${x(s.growth)}`,
      x(s.price) && `wool price ${x(s.price)}`,
      x(s.foxBias) && `fox risk ${x(s.foxBias)}`,
      x(s.strike) && `flystrike ${x(s.strike)}`,
    ].filter(Boolean);
    const extra =
      id === "winter"
        ? " Snow in the weather: the grass is buried, and a hungry night out in it can cost a beast unless the byre is built. No mucking frozen ground."
        : id === "summer"
          ? " The only time hay can be cut."
          : "";
    return {
      id,
      name: s.name,
      meta: `${SEASON_DAYS} days · days ${i * SEASON_DAYS + 1}–${(i + 1) * SEASON_DAYS} of each year`,
      effect: `${parts.length ? parts.join(", ") : "The hill as it is"}.${extra}`,
    };
  });
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

