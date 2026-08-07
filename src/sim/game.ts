/**
 * The game engine. Owns the state, applies the rules, and emits animation
 * requests. Knows nothing about the DOM or the canvas.
 */
import {
  BALANCE,
  BREEDS,
  CROFT,
  OPEN_QUESTIONS,
  PASTURES,
  START_MONEY,
  TOOLS,
  WEATHER_BAG,
} from "./config";
import { makeRng, pick, randInt, type Rng } from "./rng";
import {
  breedOf,
  buffed,
  canShear,
  gatherCost,
  shearCost,
  dogFoxBias,
  hasDog,
  feedCost,
  flockValue,
  flystrikeExposed,
  foxRisk,
  grade,
  grazing,
  here,
  isFullMoon,
  owns,
  woolPrice,
  readyToShear,
  tapsPerDay,
  weatherOn,
  wolfSummoned,
  wolfWarningDue,
} from "./rules";
import { checkAchievements, loadEarned, type Achievement } from "./achievements";
import { NORMAL, type Lexicon } from "./lexicon";
import type {
  ActionId,
  AnimId,
  BreedId,
  BuffId,
  CroftId,
  Difficulty,
  GameState,
  LogClass,
  RoutineEntry,
  Sheep,
  ToolId,
  WeatherId,
} from "./types";

export interface GameOptions {
  seed?: number;
  /** the scale to play at; a run keeps whichever it was started on */
  difficulty?: Difficulty;
}

export interface ActionDef {
  id: ActionId;
  name: string;
  cozy?: boolean;
  anim: AnimId;
  cost: (g: GameState) => number;
  desc: (g: GameState) => string;
  can: (g: GameState) => boolean;
  run: (game: Game) => void;
}

export function newGame(opts: GameOptions = {}): GameState {
  const seed = opts.seed ?? (Math.random() * 2 ** 32) >>> 0;
  const rng = makeRng(seed);
  const flock: Sheep[] = [];
  for (let i = 0; i < BALANCE.startFlock; i++) {
    flock.push({
      id: i + 1,
      fleece: randInt(rng, BALANCE.startFleeceMin, BALANCE.startFleeceMax),
      breed: "blackface",
      age: 0,
    });
  }
  const forecast: WeatherId[] = [];
  for (let i = 0; i < 3; i++) forecast.push(pick(rng, WEATHER_BAG));

  return {
    day: 1,
    taps: BALANCE.baseTaps,
    money: START_MONEY,
    wool: 0,
    flock,
    nextSheepId: BALANCE.startFlock + 1,
    difficulty: opts.difficulty ?? "steady",
    at: 0,
    pastures: PASTURES.map((p) => ({ ...p })),
    owned: {},
    buffs: {},
    forecast,
    log: [],
    gatheredToday: false,
    didToday: {},
    muckedToday: [],
    building: null,
    actsToday: 0,
    pubs: 0,
    pubToday: false,
    over: null,
    routine: null,
    draft: [],
    recording: false,
    stats: {
      woolSold: 0,
      earned: 0,
      foxLosses: 0,
      strikeLosses: 0,
      sheepBought: 0,
      sheepSold: 0,
      shears: 0,
      daysHungry: 0,
      wolfMaulings: 0,
    },
    achievements: [],
    seed,
  };
}

type Listener = () => void;

export class Game {
  state: GameState;
  rng: Rng;
  private listeners: Listener[] = [];
  /** the UI hands this in: play an animation, call back when it finishes */
  onAnim: (anim: AnimId, after?: () => void, payload?: { breed?: string }) => void = (_a, after) => after?.();
  onAchievement: (a: Achievement) => void = () => {};
  /** true while an animation-driven sequence owns the buttons */
  busy = false;
  /** what things are called this run — TOD swaps the words, never the numbers */
  lex: Lexicon = NORMAL;
  /**
   * ZEN: the day stops running out. Actions still resolve exactly as they
   * do normally — this only stops the tap being deducted, so nothing about
   * the night, the wolf's five-action count or any buff changes shape.
   */
  zen = false;
  /**
   * The tutorial day. Same as zen, but scoped to the first day and cleared
   * the moment it ends — a new player should be able to try everything the
   * hill offers without spending a day they do not yet understand.
   */
  freeTaps = false;

  constructor(state?: GameState, opts: GameOptions = {}) {
    this.state = state ?? newGame(opts);
    this.rng = makeRng((this.state.seed ^ (this.state.day * 2654435761)) >>> 0);
  }

  /* ---------- plumbing ---------- */
  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  changed() {
    for (const l of this.listeners) l();
  }
  say(t: string, cls: LogClass = "") {
    this.state.log.unshift({ t, cls, day: this.state.day });
    if (this.state.log.length > 120) this.state.log.pop();
  }
  private award() {
    for (const a of checkAchievements(this.state)) this.onAchievement(a);
  }

  /* ---------- buffs ---------- */
  buff(id: BuffId, days: number) {
    // refresh, never stack
    this.state.buffs[id] = Math.max(this.state.buffs[id] ?? 0, days);
  }

  /* ---------- taps ---------- */
  costOf(a: ActionDef) {
    return a.cost(this.state);
  }

  private spend(n: number) {
    const g = this.state;
    if (!this.zen && !this.freeTaps) g.taps -= n;
    g.actsToday++;
    if (wolfWarningDue(g)) {
      this.say(`The ${this.lex.flock} will not settle. Something is watching from above the corrie.`, "bad");
    }
    // the wolf is not called here: he comes at night, when you lie down on his
    // ground. Spending the fifth action only sets the conditions — walking back
    // off the corrie before you sleep still gets you out of it.
    this.award();
    this.changed();
  }

  /* ---------- actions ---------- */
  doAction(id: ActionId) {
    const g = this.state;
    if (g.over) return;
    const act = ACTIONS.find((a) => a.id === id);
    if (!act) return;
    const cost = this.costOf(act);
    if (g.taps < cost || !act.can(g)) return;
    if (g.recording) g.draft.push({ kind: "act", act: id });
    act.run(this);
    // what was done, recorded at the point of doing it
    g.didToday[id] = (g.didToday[id] ?? 0) + 1;
    if (id === "muck" && !g.muckedToday.includes(g.at)) g.muckedToday.push(g.at);
    this.onAnim(act.anim, id === "ask" ? () => this.win() : undefined);
    this.spend(cost);
  }

  moveTo(i: number) {
    const g = this.state;
    if (g.over) return;
    if (i === g.at) {
      this.say(`They are already on the ${g.pastures[i].name}.`, "hi");
      this.changed();
      return;
    }
    if (g.taps <= 0) return;
    if (g.recording) g.draft.push({ kind: "move", to: i });
    g.at = i;
    g.gatheredToday = false;
    this.say(this.lex.driveUp(g.pastures[i].name), "hi");
    this.onAnim("move");
    this.spend(1);
  }

  /* ---------- the steading ---------- */
  /**
   * One dog and one instrument, ever.
   *
   * A hirsel is the ground one shepherd and one dog can work — the game is
   * named after the constraint. Letting a player own both dogs would stack
   * the deterrents to ×0.45 and quietly delete the fox, and owning both
   * instruments would turn a choice of playing style into a shopping list.
   */
  private slotTaken(id: ToolId): boolean {
    const g = this.state;
    if (id === "dog") return owns(g, "collie");
    if (id === "collie") return owns(g, "dog");
    if (id === "fiddle") return false; // the pipes are not owned, they are his
    return false;
  }

  buyTool(id: ToolId) {
    const g = this.state;
    const t = TOOLS.find((x) => x.id === id);
    if (!t || owns(g, id) || g.money < t.cost || this.slotTaken(id)) return;
    g.money -= t.cost;
    g.owned[id] = true;
    this.say(`Bought the ${t.name.toLowerCase()} for £${t.cost}.`, "gold");
    if (id === "boots" || id === "lamp") g.taps = Math.min(BALANCE.maxTaps, g.taps + 1);
    this.award();
    this.changed();
  }

  /**
   * Pay for a croft milestone. This buys the materials and starts the work —
   * the days of labour come out of the same taps as everything else, so the
   * road to winning competes with the day instead of running alongside it.
   */
  buyCroft(id: CroftId) {
    const g = this.state;
    const m = CROFT.find((x) => x.id === id);
    if (!m || owns(g, id) || g.money < m.cost || g.building) return;
    if (m.need && !owns(g, m.need)) return;
    g.money -= m.cost;
    g.building = { id, done: 0 };
    this.say(
      id === "ring"
        ? `Paid £${m.cost}. It is being made up for you in Inverness — it is a walk to fetch it.`
        : `Paid £${m.cost} for the materials. Now it wants building.`,
      "gold",
    );
    this.award();
    this.changed();
  }

  /** one day's work on whatever is being built */
  buildOnce() {
    const g = this.state;
    if (!g.building) return;
    const m = CROFT.find((x) => x.id === g.building!.id);
    if (!m) return;
    g.building.done++;
    if (g.building.done < m.work) {
      this.say(
        m.id === "ring" ? "A long walk, and a longer one back." : `Another day on it. ${m.work - g.building.done} to go.`,
        "hi",
      );
      return;
    }
    g.owned[m.id] = true;
    g.building = null;
    this.say(`${m.name}. Done.`, "gold");
    if (m.id === "ring") this.say("It is in your coat pocket now. You keep checking it is still there.", "cozy");
    this.award();
  }

  buyEwe(breed: BreedId) {
    const g = this.state;
    const b = BREEDS[breed];
    if (g.money < b.cost) return;
    g.money -= b.cost;
    // she is not in the flock until she has walked into the field — otherwise
    // the counter goes up and the animation then walks a second one in
    this.onAnim(
      "buysheep",
      () => {
        g.flock.push({ id: g.nextSheepId++, fleece: 1, breed, age: 0 });
        g.stats.sheepBought++;
        this.say(`Bought a ${this.lex.breeds[breed]} ${this.lex.unit} for £${b.cost}.`, "gold");
        this.award();
        this.changed();
      },
      { breed },
    );
    this.changed(); // the money goes now; she arrives in her own time
  }

  /**
   * Sell a beast at the cart. Costs no tap, like every other trade.
   *
   * You take a loss on her — `sellbackRate` — so this is a way out of a bad
   * week rather than a way to farm money by churning stock. Selling the
   * flock down to nothing is allowed and ends the run the same as losing
   * them: a shepherd with no sheep is a shepherd with no sheep.
   */
  sellEwe(id: number) {
    const g = this.state;
    if (g.over) return;
    const i = g.flock.findIndex((s) => s.id === id);
    if (i < 0) return;
    const sheep = g.flock[i];
    const b = BREEDS[sheep.breed];
    const take = Math.max(1, Math.round(b.cost * BALANCE.sellbackRate));
    g.flock.splice(i, 1);
    g.money += take;
    g.stats.sheepSold++;
    g.stats.earned += take;
    this.say(`Sold a ${this.lex.breeds[sheep.breed]} ${this.lex.unit} at the cart. £${take}.`, "gold");
    if (g.flock.length === 0) {
      this.lose(this.lex.soldLast.title, this.lex.soldLast.body);
    }
    this.award();
    this.changed();
  }

  /** what the cart would pay for her today */
  sellPrice(id: number): number {
    const sheep = this.state.flock.find((s) => s.id === id);
    if (!sheep) return 0;
    return Math.max(1, Math.round(BREEDS[sheep.breed].cost * BALANCE.sellbackRate));
  }

  /* ---------- the last wolf ---------- */

  /**
   * The cheat path: he comes whether the ground, the moon and the day's work
   * agree or not. What happens when he arrives is unchanged — that is still
   * decided by whether the broadsword is on the wall.
   */
  forceWolf(): "pelt" | "mauled" | "none" {
    const g = this.state;
    if (g.over) return "none";
    if (owns(g, "pelt")) {
      this.say("Nothing comes down off the skyline. There was only ever the one, and you have his pelt.", "cozy");
      this.changed();
      return "none";
    }
    const armed = owns(g, "sword");
    if (!g.flock.length && !armed) {
      this.say("Something moves above the corrie and finds nothing worth coming down for.", "bad");
      this.changed();
      return "none";
    }
    this.wolf();
    // normal play reaches the wolf through spend(), which does these two
    // afterwards; the cheat path has to do them itself or the pelt is taken
    // without the achievement firing or the HUD noticing
    this.award();
    this.changed();
    return armed ? "pelt" : "mauled";
  }

  private wolf() {
    const g = this.state;
    if (owns(g, "sword")) {
      this.say("Something is standing on the skyline that is not a fox.", "bad");
      this.say("The last wolf in Scotland. You draw the broadsword.", "gold");
      // the pelt is not yours until you have watched him lose it — the same
      // rule the fox and the bought ewe follow
      this.onAnim("wolf", () => {
        g.owned.pelt = true;
        this.say("You take the pelt. No fox will come near this ground again.", "gold");
        this.award();
        this.changed();
      });
    } else {
      const keep = Math.min(g.flock.length, OPEN_QUESTIONS.survivorsAfterWolf);
      const lost = g.flock.length - keep;
      const survivors = g.flock.slice(0, keep);
      g.stats.wolfMaulings++;
      this.say("Something is standing on the skyline that is not a fox.", "bad");
      this.say("The last wolf in Scotland, and nothing in your hands but a crook.", "bad");
      // the flock is not gone until you have watched it go
      this.onAnim("wolflost", () => {
        g.flock = survivors;
        this.say(
          this.lex.maulSurvivors(lost, keep),
          "bad",
        );
        this.award();
        this.changed();
      });
    }
  }

  /* ---------- night ---------- */
  sleep() {
    const g = this.state;
    if (g.over) return;
    // the night ends the day, and with it anything the watch was still doing
    this.cancelRoutine();
    this.stopRecording();

    /*
     * The night is two beats with whatever happens in the dark between them.
     * It used to be one: dusk, dark, sunrise — and then the fox raid played
     * *after* the sun was up, which read as a raid the following morning.
     */
    this.onAnim("sleep", () => this.changed());

    const p = here(g);
    const w = weatherOn(g);

    /*
     * The last wolf, if the day and the ground have called him. He comes after
     * the night falls and before anything else in it: no fox is coming near
     * ground he has walked over, so the fox check is skipped when he does.
     */
    const wolfCame = wolfSummoned(g);
    if (wolfCame) this.wolf();

    // 1. grazing and fleece growth
    const { eaten, fed, growth } = grazing(g);
    p.grass -= eaten;
    for (const s of g.flock) {
      s.fleece += growth * breedOf(s).growth;
      s.age++;
    }
    if (g.flock.length && fed < BALANCE.hungryBelow) {
      g.stats.daysHungry++;
      this.say(this.lex.hungry(p.name), "bad");
    }

    // 2. the dog brings them in
    if (hasDog(g) && !g.gatheredToday) {
      g.gatheredToday = true;
      this.say(
        owns(g, "collie")
          ? "She had them in and settled before you thought to look for her."
          : "She brought them in herself while you were seeing to other things.",
        "cozy",
      );
    }

    // 3. fox check — resolved after the raid animation, never before
    const risk = foxRisk(g);
    /*
     * The night she earned her keep. A dog's whole worth is the raids that
     * never happen, which meant her £58 bought something the player could
     * never once see. If the roll would have hit without her and missed with
     * her, she gets the credit out loud.
     */
    const roll = this.rng();
    if (!wolfCame && hasDog(g) && roll >= risk && roll < risk / dogFoxBias(g) && g.flock.length > 0) {
      this.say("Barking, away down the hill, and then quiet. Nothing got in.", "cozy");
      this.onAnim("bark");
    }
    if (!wolfCame && roll < risk && g.flock.length > 0) {
      // any sheep, picked when the raid actually lands — not whichever was
      // pushed on last. flock.pop() took the most recently bought ewe every
      // time, since buyEwe always appends: a real bug, reported by a player
      // who kept replacing a lost sheep only to see the new one taken next.
      const takenIndex = Math.floor(this.rng() * g.flock.length);
      this.onAnim("fox", () => {
        const lost = g.flock.splice(takenIndex, 1)[0];
        if (lost) g.stats.foxLosses++;
        this.say(this.lex.raidLine(hasDog(g)), "bad");
        if (g.flock.length === 0) this.lose(this.lex.lastGone.title, this.lex.lastGone.body);
        this.changed();
      });
    }

    // 4. flystrike
    const struck = flystrikeExposed(g);
    if (struck && this.rng() < BALANCE.flystrikeChance) {
      g.flock.splice(g.flock.indexOf(struck), 1);
      g.stats.strikeLosses++;
      this.say(this.lex.strike, "bad");
    }

    // 5. feed
    const feed = feedCost(g);
    g.money -= feed;
    if (feed) this.say(`Winter feed and odds and ends: £${feed}.`);

    // 6. regrowth
    for (const x of g.pastures) {
      let r = x.regen;
      if (w.id === "rain") r *= BALANCE.regenRain;
      if (w.id === "sun") r *= BALANCE.regenSun;
      x.grass = Math.min(x.cap, x.grass + r);
    }

    // the sky comes back up last, after the wolf and the fox have had the dark
    this.onAnim("dawn");

    // 7. weather, moon, buffs
    g.forecast.shift();
    g.forecast.push(pick(this.rng, WEATHER_BAG));
    for (const k of Object.keys(g.buffs) as BuffId[]) {
      const v = (g.buffs[k] ?? 0) - 1;
      if (v <= 0) delete g.buffs[k];
      else g.buffs[k] = v;
    }

    g.day++;
    this.freeTaps = false; // the free day is over the moment it ends
    g.gatheredToday = false;
    g.pubToday = false;
    g.didToday = {};
    g.muckedToday = [];
    g.actsToday = 0;
    g.taps = tapsPerDay(g);
    this.say(`— Day ${g.day}. ${weatherOn(g).name} over the glen. —`, "gold");
    if (isFullMoon(g.day) && !owns(g, "pelt")) {
      this.say("Full moon tonight. The high ground is no place to be caught out late.", "bad");
    }

    // 8. fail state
    if (g.flock.length === 0) {
      this.lose(this.lex.lastGone.title, this.lex.lastGone.body);
    } else if (g.money < 0) {
      this.lose("The purse is empty", "You cannot feed them and you cannot feed yourself. You go back to the job you left.");
    }

    this.award();
    this.changed();
  }

  private lose(title: string, body: string) {
    if (this.state.over) return;
    this.state.over = { kind: "lose", title, body: `${body} You lasted ${this.state.day} days.` };
  }

  win() {
    const g = this.state;
    if (g.over) return;
    g.over = {
      kind: "win",
      title: "She said aye",
      body: this.lex.winBody(g.flock.length, g.day),
    };
    this.award();
    this.changed();
  }

  /* ---------- the pocket watch ---------- */
  startRecording() {
    const g = this.state;
    g.recording = true;
    g.draft = [];
    this.say("You set the watch. Work the day as you mean it to go.", "cozy");
    this.changed();
  }

  stopRecording() {
    const g = this.state;
    if (!g.recording) return;
    g.recording = false;
    if (g.draft.length) {
      const cap = OPEN_QUESTIONS.routineTurnCap;
      g.routine = cap > 0 ? g.draft.slice(0, cap) : g.draft.slice();
      this.say(`The watch has your day: ${g.routine.length} turns of work.`, "cozy");
    }
    g.draft = [];
  }

  /**
   * Which run of the watch is current.
   *
   * The step chain lives in animation callbacks, so anything that interrupts
   * the day mid-sequence has to be able to disown those callbacks. Without
   * it, sleeping partway through left `busy` true forever: every action was
   * dead until the page was reloaded, which is what rebuilt the Game.
   */
  private routineRun = 0;

  /** stop the watch's sequence and give the day back to the player */
  cancelRoutine() {
    this.routineRun++;
    if (this.busy) {
      this.busy = false;
      this.changed();
    }
  }

  runRoutine() {
    const g = this.state;
    if (!g.routine?.length || this.busy || g.over) return;
    this.busy = true;
    const run = ++this.routineRun;
    const steps = [...g.routine];
    const step = () => {
      if (run !== this.routineRun) return; // a later run, or a cancel, owns the day now
      const g2 = this.state;
      if (g2.over || !steps.length || g2.taps <= 0) {
        this.busy = false;
        this.changed();
        return;
      }
      const e = steps.shift() as RoutineEntry;
      if (e.kind === "move") {
        if (e.to === g2.at) return step();
        g2.at = e.to;
        g2.gatheredToday = false;
        this.say(`The watch has you on the ${g2.pastures[e.to].name}.`, "hi");
        this.onAnim("move", step);
        this.spend(1);
        return;
      }
      const act = ACTIONS.find((a) => a.id === e.act);
      // skip anything that cannot be done today
      if (!act || !act.can(g2) || g2.taps < this.costOf(act)) return step();
      act.run(this);
      this.onAnim(act.anim, step);
      this.spend(this.costOf(act));
    };
    step();
  }

  /** carried over between runs so the display never forgets what you've done */
  hydrateAchievements() {
    const earned = loadEarned();
    this.state.achievements = [...new Set([...this.state.achievements, ...earned])];
  }
}

/* ---------- the action table ---------- */

const one = () => 1;

export const ACTIONS: ActionDef[] = [
  {
    id: "gather",
    name: "Gather the flock",
    anim: "gather",
    cost: gatherCost,
    desc: (g) => {
      if (g.gatheredToday) return "Already gathered today.";
      const big = g.flock.length > BALANCE.bigFlock && !hasDog(g);
      return big
        ? `Bring them in close. Cuts tonight's fox risk hard — though ${g.flock.length} of them is a long walk on your own.`
        : "Bring them in close. Cuts tonight's fox risk hard.";
    },
    can: (g) => !g.gatheredToday,
    run: (game) => {
      game.state.gatheredToday = true;
      game.say("You walk the ground and bring the flock in tight.", "hi");
    },
  },
  {
    id: "shear",
    name: "Shear",
    anim: "shear",
    cost: shearCost,
    desc: (g) => {
      if (!canShear(g)) {
        return weatherOn(g).id === "mist"
          ? "The haar has soaked the fleeces through. Nothing to be done bare-handed."
          : "Wet wool cannot be shorn. It would rot in the sack.";
      }
      const n = readyToShear(g.flock);
      return n === 0
        ? "No fleece worth taking yet."
        : `${n} sheep ready · about ${Math.round(flockValue(g.flock))} stone of wool`;
    },
    can: (g) => canShear(g) && readyToShear(g.flock) > 0,
    run: (game) => {
      const g = game.state;
      let got = 0;
      let matted = 0;
      for (const s of g.flock) {
        if (s.fleece >= BALANCE.shearMinFleece) {
          const gr = grade(s.fleece);
          got += gr.v * breedOf(s).value;
          if (gr.label === "matted") matted++;
          s.fleece = 0;
        }
      }
      got = Math.round(
        got * (buffed(g, "steady hands") ? BALANCE.steadyHandsBonus : 1) * (owns(g, "shears") ? BALANCE.shearsBonus : 1),
      );
      g.wool += got;
      g.stats.shears++;
      game.say(`Sheared. ${got} stone into the sack.${matted ? ` ${matted} fleece came off matted.` : ""}`, "gold");
      if (matted) game.say("Left too long. That wool will fetch little.", "bad");
    },
  },
  {
    id: "market",
    name: "Go to market",
    anim: "market",
    cost: (g) => (owns(g, "cart") ? 0 : 1),
    desc: (g) =>
      g.wool === 0
        ? "Nothing in the sack to sell."
        : `${g.wool} stone · ${woolPrice(g)}p a stone · about £${Math.round((g.wool * woolPrice(g)) / 100)}`,
    can: (g) => g.wool > 0,
    run: (game) => {
      const g = game.state;
      const p = woolPrice(g);
      const take = Math.round((g.wool * p) / 100);
      g.money += take;
      g.stats.woolSold += g.wool;
      g.stats.earned += take;
      game.say(`Sold ${g.wool} stone at ${p}p. £${take} in the purse.`, "gold");
      g.wool = 0;
    },
  },
  {
    id: "tend",
    name: "Tend the flock",
    anim: "tend",
    cost: one,
    desc: (g) => {
      const at = g.flock.filter((s) => s.fleece >= BALANCE.flystrikeFleece).length;
      return at
        ? `${at} carrying heavy fleece. Strike will take one if you leave it.`
        : "Check feet and fleece. Three days safe from strike, and they thrive on the attention.";
    },
    can: (g) => g.flock.length > 0,
    run: (game) => {
      game.buff("tended", BALANCE.tendDays);
      game.say("You go through them one by one. Feet, fleece, eyes.", "hi");
    },
  },
  {
    id: "build",
    name: "Work on the croft",
    anim: "build",
    cost: one,
    desc: (g) => {
      const b = g.building;
      if (!b) return "Nothing wants building. The materials come from the cart.";
      const m = CROFT.find((x) => x.id === b.id)!;
      const left = m.work - b.done;
      if (m.id === "ring") return `Walk down for it. ${left} day${left === 1 ? "" : "s"} of walking left.`;
      return `${m.name}. ${b.done} of ${m.work} days into it.`;
    },
    can: (g) => g.building !== null,
    run: (game) => game.buildOnce(),
  },
  {
    id: "muck",
    name: "Muck the pasture",
    anim: "muck",
    cost: one,
    desc: (g) => {
      const p = here(g);
      return p.grass > BALANCE.muckMaxGrass
        ? `The ${p.name} is in good heart already.`
        : `Spread muck and lime on the ${p.name}. Brings the grass back fast.`;
    },
    can: (g) => here(g).grass <= BALANCE.muckMaxGrass,
    run: (game) => {
      const p = here(game.state);
      p.grass = Math.min(p.cap, p.grass + BALANCE.muckGain);
      game.say(`Muck and lime across the ${p.name}. It will come back green.`, "hi");
    },
  },
  {
    id: "ask",
    name: "Walk down and ask her",
    anim: "pub",
    cozy: true,
    cost: one,
    desc: (g) => {
      const missing = CROFT.filter((m) => !owns(g, m.id));
      if (missing.length) return `Not yet. ${missing[0].name.toLowerCase()} first.`;
      if (g.pubs < BALANCE.pubsToAsk)
        return `You hardly know her. ${g.pubs} evening${g.pubs === 1 ? "" : "s"} at the inn so far.`;
      return "The croft is finished and the ring is in your pocket. Go on.";
    },
    can: (g) => CROFT.every((m) => owns(g, m.id)) && g.pubs >= BALANCE.pubsToAsk,
    run: () => {},
  },
  {
    id: "pipe",
    name: "Smoke a pipe",
    cozy: true,
    anim: "pipe",
    cost: one,
    desc: () => "Free. Sit a while. Steadies your hands for tomorrow's shearing.",
    can: () => true,
    run: (game) => {
      game.buff("steady hands", BALANCE.cozyBuffDays);
      game.say("You sit on the dyke and let the day go quiet.", "cozy");
    },
  },
  {
    id: "music",
    name: "Strike up the bagpipes",
    cozy: true,
    anim: "music",
    cost: one,
    desc: (g) =>
      owns(g, "fiddle")
        ? `Free. ${BALANCE.fiddleDays} days of it: they put on more fleece. It will not keep a fox off.`
        : "Free. The flock settles. Foxes are a shade warier for a night or two.",
    can: () => true,
    run: (game) => {
      const g = game.state;
      if (owns(g, "fiddle")) {
        game.buff("fiddled", BALANCE.fiddleDays);
        game.say("A reel, out over the hill. They graze the better for it.", "cozy");
      } else {
        game.buff("settled flock", BALANCE.cozyBuffDays);
        game.say("The drone carries down the glen. The sheep stop fidgeting.", "cozy");
      }
    },
  },
  {
    id: "pub",
    name: "A pint at the inn",
    cozy: true,
    anim: "pub",
    cost: one,
    desc: (g) =>
      g.pubToday
        ? "You have had your pint. There is a limit, and you are at it."
        : g.money < BALANCE.pintCost
          ? `£${BALANCE.pintCost}. You cannot spare it.`
          : `£${BALANCE.pintCost}. Three days hale and hearty: one more tap a day.`,
    // one a night: the pint is an event, and the courtship is paced by it
    can: (g) => g.money >= BALANCE.pintCost && !g.pubToday,
    run: (game) => {
      const g = game.state;
      g.money -= BALANCE.pintCost;
      game.buff("hale", BALANCE.haleDays);
      g.pubs++;
      g.pubToday = true;
      game.say(`£${BALANCE.pintCost} gone on beer and talk. Worth it, probably.`, "cozy");
      if (g.pubs === 2) game.say("The lass behind the bar knows your order now.", "cozy");
      if (g.pubs === 4) game.say("She kept you talking well past when she should have been closing.", "cozy");
      // she wants to know there is something to come home to
      if (g.pubs >= 2) {
        if (!owns(g, "roof")) game.say("She asked whether the roof still lets the rain in. You said it did.", "cozy");
        else if (!owns(g, "hearth")) game.say("She said a house with no proper fire is just four walls and a draught.", "cozy");
        else if (!owns(g, "byre")) game.say("She asked where you'd put the flock come the bad weather. You had no answer.", "cozy");
        else if (!owns(g, "ring")) game.say("She has stopped asking about the croft. She just looks at you now.", "cozy");
        else if (g.pubs < BALANCE.pubsToAsk) game.say("The ring is burning a hole in your coat pocket.", "cozy");
      }
    },
  },
];
