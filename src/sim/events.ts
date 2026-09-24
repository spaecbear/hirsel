/**
 * Things that happen.
 *
 * The day loop is the same three taps whatever the season, and by the second
 * year the hill had nothing new to say. These are the world coming to the
 * door: a letter from the life you left, the dealer on the road, Callum over
 * the burn, the show, her. Each one arrives at dawn — at most one a day,
 * rolled from the run's seed like everything else — and waits on a choice.
 *
 * Every choice costs what it says on it and nothing else. A choice that costs
 * nothing is always offered, so no event can leave the player stuck, and an
 * event left unanswered overnight takes that choice for them.
 *
 * None of them mentions the sword, the wolf or the summon conditions (§15).
 */
import { BALANCE, BREEDS, SEASON_DAYS, TOOLS } from "./config";
import { breedOf, buffed, dogIsOld, grade, hasDog, owns, season } from "./rules";
import type { Game } from "./game";
import type { Lexicon } from "./lexicon";
import type { BreedId, EventId, GameState, ToolId } from "./types";

type Data = Record<string, string | number>;

export interface EventChoice {
  id: string;
  label: string;
  detail?: string;
  /** taps it takes out of today */
  taps?: number;
  money?: number;
  /** the choice taken for a player who never answered. Always free */
  fallback?: boolean;
  /** anything beyond the taps and the money that would stop it */
  can?: (g: GameState) => boolean;
  run: (game: Game, data: Data) => void;
}

export interface GameEvent {
  id: EventId;
  title: (g: GameState, data: Data, lex: Lexicon) => string;
  body: (g: GameState, data: Data, lex: Lexicon) => string;
  choices: (g: GameState, data: Data, lex: Lexicon) => EventChoice[];
  /**
   * Whether it comes this dawn, and with what. Called once a dawn for each
   * event in order until one says yes; `roll` is the game's seeded dice.
   * Return the event's data to fire it, or null.
   */
  due: (g: GameState, roll: () => number) => Data | null;
}

/** the neighbour's name: the one other shepherd in the glen */
export const NEIGHBOUR = "Callum";

/* ---------- the numbers ---------- */

export const EVENTS_BALANCE = {
  /** no events before this day — the first week is the hill and nothing else */
  firstDay: 6,
  dealerChance: 0.1,
  dealerEvery: 24,
  dealerEweRate: 0.75,
  dealerToolRate: 0.8,
  neighbourChance: 0.1,
  neighbourEvery: 18,
  /** hands given before he pays one back */
  goodwillForGift: 2,
  giftHay: 20,
  giftMoney: 15,
  strayChance: 0.05,
  strayEvery: 40,
  /** the show is on this day of each summer */
  showDay: 18,
  showFirst: 25,
  showSecond: 12,
  trialPrize: 20,
  trialCollie: 0.55,
  trialSheltie: 0.35,
  visitChance: 0.25,
  visitPubs: 3,
  /** the ceilidh is on this day of each autumn */
  ceilidhDay: 10,
  ceilidhCost: 4,
  motherMoney: 10,
} as const;

const E = EVENTS_BALANCE;

/* ---------- helpers ---------- */

const lastOn = (g: GameState, id: EventId) => g.eventDays[id];
const since = (g: GameState, id: EventId) => g.day - (lastOn(g, id) ?? -Infinity);
const once = (g: GameState, id: EventId) => lastOn(g, id) === undefined;
/** a letter comes on its day, or the first dawn after it if something else was on */
const letterDue = (g: GameState, id: EventId, day: number) => (g.day >= day && once(g, id) ? {} : null);

/** the beast that would go to the show: the best fleece for her breed */
export function showScore(g: GameState): { score: number; breed: BreedId } | null {
  const grown = g.flock.filter((s) => !s.lamb);
  if (!grown.length) return null;
  let best = grown[0];
  let bestScore = -1;
  for (const s of grown) {
    const sc = grade(s.fleece).v * breedOf(s).value;
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  // turned out well: a tended flock shows better
  return { score: bestScore * (buffed(g, "tended") ? 1.2 : 1), breed: best.breed };
}

/** her chance at the trial: the collie is the trials dog, and an old dog is slower */
export function trialChance(g: GameState): number {
  if (!hasDog(g)) return 0;
  const base = owns(g, "collie") ? E.trialCollie : E.trialSheltie;
  return base * (dogIsOld(g) ? 0.5 : 1);
}

/* ---------- the events ---------- */

export const EVENTS: GameEvent[] = [
  /* ---- letters from the life you left, on their days ---- */
  {
    id: "letter-boss",
    due: (g) => letterDue(g, "letter-boss", 9),
    title: () => "A letter, forwarded",
    body: () =>
      "From the office. They have taken on someone to do what you did, and they would be grateful if you could explain the " +
      "filing. There is a line at the bottom in his own hand: the door is open, if the hill does not work out.",
    choices: () => [
      { id: "fire", label: "Put it in the fire", fallback: true, run: (game) => game.say("It went up quicker than you thought paper would.", "cozy") },
      { id: "keep", label: "Keep it, just in case", run: (game) => game.say("You put it in a drawer, and do not look at the drawer.", "hi") },
    ],
  },
  {
    id: "letter-mother",
    due: (g) => letterDue(g, "letter-mother", 40),
    title: () => "A letter from your mother",
    body: () =>
      "Three pages about the neighbours and one line about you: she hopes you are eating. Folded inside, a ten pound note, " +
      "and the words 'for the sheep, not for the pub'.",
    choices: () => [
      {
        id: "take",
        label: `Take the £${E.motherMoney}`,
        fallback: true,
        run: (game) => {
          game.state.money += E.motherMoney;
          game.say(`£${E.motherMoney} from your mother. For the sheep.`, "gold");
        },
      },
    ],
  },
  {
    id: "letter-friend",
    due: (g) => letterDue(g, "letter-friend", 110),
    title: () => "A postcard from the city",
    body: () =>
      "A friend from before. A picture of the river at night, all lights. 'Nobody here has seen a sheep. We talk about you like " +
      "you went to sea.'",
    choices: () => [
      { id: "mantel", label: "Put it on the mantel", fallback: true, run: (game) => game.say("The city looks very small, up there beside the clock.", "cozy") },
    ],
  },
  {
    id: "letter-sister",
    due: (g) => letterDue(g, "letter-sister", 190),
    title: () => "A letter from your sister",
    body: (g) =>
      g.pubs >= 2
        ? "She has heard, from someone who heard in the post office, that there is a lass at the inn. She wants to know " +
          "everything, and she is not asking twice."
        : "She wants to know if you are lonely up there. She has a friend. She has several friends.",
    choices: (g) => [
      {
        id: "write",
        label: g.pubs >= 2 ? "Write back, and tell her nothing" : "Write back: you are fine",
        fallback: true,
        run: (game) => game.say("You wrote a page and said less than you meant to.", "cozy"),
      },
    ],
  },

  /* ---- the show, once a summer ---- */
  {
    id: "show",
    due: (g) => {
      const s = season(g);
      return s.id === "summer" && s.day === E.showDay && g.flock.some((x) => !x.lamb) ? {} : null;
    },
    title: () => "The Highland show",
    body: (g, _d, lex) =>
      `It is the show in the town today — the pens, the judges in their hats, the whole glen in its good coat. ` +
      `You could take your best ${lex.unit} down${hasDog(g) ? ", or run the dog in the trial" : ""}. It is a day off the hill either way.`,
    choices: (g, _d, lex) => {
      const best = showScore(g);
      const out: EventChoice[] = [];
      if (best) {
        out.push({
          id: "ewe",
          label: `Show your best ${lex.unit}`,
          detail: `A ${lex.breeds[best.breed]}. The judges look at the breed, the ${lex.fleeceWord}, and whether she has been cared for.`,
          taps: 1,
          run: (game) => {
            const g2 = game.state;
            const sc = showScore(g2)?.score ?? 0;
            const p = Math.max(0.1, Math.min(0.85, sc / 14));
            const r = game.rng();
            if (r < p * 0.4) {
              g2.money += E.showFirst;
              g2.stats.rosettes++;
              game.say(`First in her class. A red rosette, and £${E.showFirst}.`, "gold");
            } else if (r < p) {
              g2.money += E.showSecond;
              g2.stats.rosettes++;
              game.say(`Second in her class. A blue rosette, and £${E.showSecond}.`, "gold");
            } else {
              game.say("No ticket. The judge said she was a good sort, which is what judges say.", "hi");
            }
          },
        });
      }
      if (hasDog(g)) {
        out.push({
          id: "trial",
          label: "Run the dog in the trial",
          detail: `Three sheep, a pen, and a whistle. ${
            owns(g, "collie") ? "The collie was bred for this." : "The sheltie is keen, if not built for it."
          }${dogIsOld(g) ? " She is not as quick as she was." : ""}`,
          taps: 1,
          run: (game) => {
            const g2 = game.state;
            if (game.rng() < trialChance(g2)) {
              g2.money += E.trialPrize;
              g2.stats.rosettes++;
              game.say(`She penned them clean, first time. First in the trial, and £${E.trialPrize}.`, "gold");
            } else {
              game.say("A fair run. One of the three would not be told, and that was that.", "hi");
            }
          },
        });
      }
      out.push({ id: "stay", label: "Stay on the hill — there is work", fallback: true, run: (game) => game.say("You heard the pipe band from the top field, faintly, all afternoon.", "cozy") });
      return out;
    },
  },

  /* ---- the ceilidh, once an autumn, once you know her ---- */
  {
    id: "ceilidh",
    due: (g) => {
      const s = season(g);
      return s.id === "autumn" && s.day === E.ceilidhDay && g.pubs >= 2 && g.pubs < BALANCE.pubsToAsk ? {} : null;
    },
    title: () => "A ceilidh in the hall",
    body: () => "There is a ceilidh in the village hall tonight. She will be there. She mentioned it twice.",
    choices: () => [
      {
        id: "go",
        label: "Go, and dance",
        detail: "It counts for an evening, and you will be hale for a day or two after.",
        taps: 1,
        money: E.ceilidhCost,
        run: (game) => {
          game.state.pubs++;
          game.buff("hale", 2);
          game.say("You danced the Gay Gordons badly and the Dashing White Sergeant worse. She did not seem to mind.", "cozy");
        },
      },
      { id: "stay", label: "Stay in", fallback: true, run: (game) => game.say("You could hear it from the road. You went to bed.", "hi") },
    ],
  },

  /* ---- she comes up the hill, once ---- */
  {
    id: "visit",
    due: (g, roll) =>
      once(g, "visit") && g.pubs >= E.visitPubs && g.pubs < BALANCE.pubsToAsk && season(g).id !== "winter" && roll() < E.visitChance
        ? {}
        : null,
    title: () => "Her afternoon off",
    body: (_g, _d, lex) => `She has walked up the glen on her afternoon off, to see the ${lex.flock} she has heard so much about.`,
    choices: (_g, _d, lex) => [
      {
        id: "walk",
        label: "Walk the hill with her",
        detail: "It counts for an evening at the inn.",
        taps: 1,
        run: (game) => {
          game.state.pubs++;
          game.say(`You showed her the ${lex.flock}, the burn, and where the croft will have a byre. She asked good questions.`, "cozy");
        },
      },
      {
        id: "work",
        label: "You are behind with the work",
        fallback: true,
        run: (game) => game.say("She said she understood. She walked back down on her own.", "hi"),
      },
    ],
  },

  /* ---- Callum pays back a kindness ---- */
  {
    id: "neighbour-gift",
    due: (g) => {
      if (g.goodwill < E.goodwillForGift) return null;
      const s = season(g).id;
      return { kind: s === "autumn" || s === "winter" ? "hay" : "money" };
    },
    title: () => `${NEIGHBOUR} over the burn`,
    body: (_g, d) =>
      d.kind === "hay"
        ? `${NEIGHBOUR} has come over the burn with his cart. He says he had more hay than sense this year, and you were good to him.`
        : `${NEIGHBOUR} stopped by with an envelope. His clip did well, he says, and a share of it is owed for the help.`,
    choices: (_g, d) => [
      {
        id: "thank",
        label: d.kind === "hay" ? `Thank him: ${E.giftHay} bales` : `Thank him: £${E.giftMoney}`,
        fallback: true,
        run: (game) => {
          const g2 = game.state;
          g2.goodwill -= E.goodwillForGift;
          g2.stats.neighbourGifts++;
          if (d.kind === "hay") {
            g2.hay += E.giftHay;
            game.say(`${E.giftHay} bales from ${NEIGHBOUR}. ${g2.hay} in the barn.`, "gold");
          } else {
            g2.money += E.giftMoney;
            game.say(`£${E.giftMoney} from ${NEIGHBOUR}, and a nod.`, "gold");
          }
        },
      },
    ],
  },

  /* ---- the dealer on the road ---- */
  {
    id: "dealer",
    due: (g, roll) => {
      if (season(g).id === "winter" || since(g, "dealer") < E.dealerEvery || roll() >= E.dealerChance) return null;
      return dealerOffer(g, roll);
    },
    title: () => "A dealer on the road",
    body: (_g, d, lex) =>
      d.kind === "ewe"
        ? `A man with a trailer has stopped at the gate. He has a ${lex.breeds[d.id as BreedId]} ${lex.unit} he would let go for £${d.price} — under what the cart asks, and he knows it.`
        : `A man with a van has stopped at the gate. Among the rest of it there is ${String(d.name).toLowerCase()}, and he would let it go for £${d.price}.`,
    choices: (_g, d) => [
      {
        id: "buy",
        label: "Buy it",
        money: Number(d.price),
        can: (g2) => (d.kind === "ewe" ? true : !owns(g2, String(d.id))),
        run: (game) => {
          const g2 = game.state;
          if (d.kind === "ewe") {
            game.onAnim(
              "buysheep",
              () => {
                g2.flock.push({ id: g2.nextSheepId++, fleece: 1, breed: d.id as BreedId, age: 0 });
                g2.stats.sheepBought++;
                game.award();
                game.changed();
              },
              { breed: String(d.id) },
            );
            game.say(`Bought her off the dealer for £${d.price}.`, "gold");
          } else {
            game.grantTool(d.id as ToolId);
            game.say(`Bought ${String(d.name).toLowerCase()} off the dealer for £${d.price}.`, "gold");
          }
        },
      },
      { id: "no", label: "Send him on his way", fallback: true, run: (game) => game.say("He tipped his cap and went on down the road.", "hi") },
    ],
  },

  /* ---- Callum needs a hand ---- */
  {
    id: "neighbour",
    due: (g, roll) => (since(g, "neighbour") >= E.neighbourEvery && roll() < E.neighbourChance ? {} : null),
    title: (_g, _d, lex) => `${NEIGHBOUR}'s ${lex.beasts} are out`,
    body: (_g, _d, lex) =>
      `${NEIGHBOUR} from over the burn is at the gate, out of breath. His ${lex.beasts} are through the dyke and all over the road.`,
    choices: (_g, _d, lex) => [
      {
        id: "help",
        label: "Give him a hand",
        detail: "A kindness is remembered, up here.",
        taps: 1,
        run: (game) => {
          game.state.goodwill++;
          game.say(`You had his ${lex.beasts} back behind the dyke by the time the kettle boiled. He owes you one, he says.`, "cozy");
        },
      },
      {
        id: "no",
        label: `You have your own ${lex.flock} to see to`,
        fallback: true,
        run: (game) => game.say("He said fair enough, and went off down the road after them.", "hi"),
      },
    ],
  },

  /* ---- a stray ---- */
  {
    id: "stray",
    due: (g, roll) =>
      season(g).id !== "winter" && since(g, "stray") >= E.strayEvery && roll() < E.strayChance ? {} : null,
    title: (_g, _d, lex) => `A stray ${lex.unit}`,
    body: (_g, _d, lex) =>
      `A ${lex.breeds.blackface} ${lex.unit} with ${NEIGHBOUR}'s mark on her has come over onto your ground in the night, and seems to like it.`,
    choices: (_g, _d, lex) => [
      {
        id: "return",
        label: `Walk her back to ${NEIGHBOUR}`,
        detail: "He will know who brought her.",
        taps: 1,
        run: (game) => {
          game.state.goodwill++;
          game.say(`${NEIGHBOUR} had not even missed her. He will not forget it.`, "cozy");
        },
      },
      {
        id: "keep",
        label: "Keep her — who is to know",
        fallback: true,
        run: (game) => {
          const g2 = game.state;
          g2.flock.push({ id: g2.nextSheepId++, fleece: 2, breed: "blackface", age: 0 });
          g2.goodwill = Math.max(0, g2.goodwill - 1);
          game.say(`One more ${lex.unit} on the hill. ${NEIGHBOUR} looked at your ${lex.flock} a long time at the market.`, "hi");
        },
      },
    ],
  },
];

/** what the dealer has on him today: a good ewe under the cart price, or a tool you lack */
function dealerOffer(g: GameState, roll: () => number): Data | null {
  const offers: Data[] = [];
  for (const b of ["cheviot", "hebridean", "shetland"] as BreedId[]) {
    offers.push({ kind: "ewe", id: b, price: Math.round(BREEDS[b].cost * E.dealerEweRate) });
  }
  const dogTaken = hasDog(g);
  for (const t of TOOLS) {
    if (owns(g, t.id) || t.id === "sword" || t.id === "watch") continue;
    if ((t.id === "dog" || t.id === "collie") && dogTaken) continue;
    offers.push({ kind: "tool", id: t.id, name: t.name, price: Math.round(t.cost * E.dealerToolRate) });
  }
  return offers.length ? offers[Math.floor(roll() * offers.length)] : null;
}

export const eventDef = (id: EventId) => EVENTS.find((e) => e.id === id)!;

/** the order they are asked in at dawn: the dated ones first, so a chance one never pushes a letter off its day */
export const EVENT_ORDER: EventId[] = [
  "letter-boss",
  "letter-mother",
  "letter-friend",
  "letter-sister",
  "show",
  "ceilidh",
  "neighbour-gift",
  "visit",
  "dealer",
  "neighbour",
  "stray",
];

/** the day of the Highland show in a given year */
export const showDayOfYear = (year = 1) => (year - 1) * SEASON_DAYS * 4 + SEASON_DAYS + E.showDay;
