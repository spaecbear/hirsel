/**
 * Playing the game by touching the hill.
 *
 * Every action in the sim is reachable by tapping the thing it is about: the
 * flock for flock work, yourself for the comforts, the cart to trade, the
 * house to build it up, the hills to move, the ground under your feet for the
 * ground's own work. Tapping opens a sheet listing what can be done there.
 *
 * The sheets are DOM rather than drawn into the canvas on purpose — they carry
 * prices, reasons an action is unavailable, and long descriptive lines, and
 * they inherit the panel styling the game already had. The world is pixels;
 * the words about the world are text.
 */
import { $, button, el } from "./dom";
import { ACTIONS, type Game } from "../sim/game";
import { BREEDS, CROFT, TOOLS, WEATHER } from "../sim/config";
import { actionName, toolWhat } from "../sim/lexicon";
import { startSpin } from "../render/dog-spin";
import { tippyWalking } from "../render/tippy";
import { canShear, here, isFullMoon, moonName, owns, woolPrice, readyToShear, tapsPerDay } from "../sim/rules";
import { hitTest, layoutInterior, layoutWorld, type HotspotId } from "../render/layout";
import { Walk } from "./walk";
import type { Screen } from "../render/screen";
import type { Animator } from "../render/animator";
import type { Settings } from "../sim/settings";
import type { ActionId, BreedId, CroftId, ToolId } from "../sim/types";

interface Row {
  label: string;
  detail: string;
  disabled?: boolean;
  /** already taken care of today — marked rather than hidden */
  done?: boolean;
  tone?: "cozy" | "gold" | "stock" | "life";
  /** not a choice — something to read. Rendered as text, not a dimmed button. */
  info?: boolean;
  /**
   * Close the sheet after picking this, so whatever it sets off is visible.
   * Buying a beast walks her onto the hill and selling wool sends the cart
   * off down the road — on a phone the sheet covered both of them.
   */
  closes?: boolean;
  onPick: () => void;
}

export class WorldUi {
  /** what the pointer is over, for the hint line */
  hover: HotspotId | null = null;
  /** what has a sheet open, so the scene can pick it out */
  active: HotspotId | null = null;
  private sheet: HTMLElement;
  private onChange: () => void = () => {};
  /** the tutorial watches for things the game state doesn't record */
  onNote: (what: string) => void = () => {};
  /** the walkthrough locks everything except the thing it is teaching */
  canInteract: (id: HotspotId) => boolean = () => true;
  /** told when a tap was refused, so the prompt can ask for attention */
  onBlocked: () => void = () => {};
  /** true once the player has stepped inside the croft */
  interior = false;
  /** hold a finger on the pasture and he walks over */
  readonly walk = new Walk();
  private holdTimer = 0;
  private holdFrom: { x: number; y: number } | null = null;

  constructor(
    private game: Game,
    private screen: Screen,
    private anim: Animator,
    private settings: Settings,
  ) {
    this.sheet = $("sheet");
    const cv = screen.canvas;

    cv.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const spot = this.spotAt(e.clientX, e.clientY);
      const next = spot?.id ?? null;
      if (next !== this.hover) {
        this.hover = next;
        cv.style.cursor = next && next !== "sky" ? "pointer" : "default";
      }
    });
    cv.addEventListener("pointerleave", () => {
      this.hover = null;
    });
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.holdFrom = { x: e.clientX, y: e.clientY };
      window.clearTimeout(this.holdTimer);
      // a press that stays put on open ground sends him there instead of
      // opening anything; a quick tap still opens the sheet as before
      this.holdTimer = window.setTimeout(() => {
        if (!this.holdFrom) return;
        const sent = this.sendHim(this.holdFrom.x, this.holdFrom.y);
        if (sent) this.holdFrom = null;
      }, 340);
    });
    const endHold = (e: PointerEvent) => {
      window.clearTimeout(this.holdTimer);
      if (!this.holdFrom) return; // the hold already sent him
      const moved = Math.hypot(e.clientX - this.holdFrom.x, e.clientY - this.holdFrom.y);
      this.holdFrom = null;
      if (moved < 12) this.tap(e.clientX, e.clientY);
    };
    cv.addEventListener("pointerup", endHold);
    cv.addEventListener("pointercancel", () => {
      window.clearTimeout(this.holdTimer);
      this.holdFrom = null;
    });

    // tapping outside the sheet closes it
    document.addEventListener("pointerdown", (e) => {
      if (!this.sheet.classList.contains("on")) return;
      if (this.sheet.contains(e.target as Node)) return;
      if (e.target === cv) return; // the canvas handler decides for itself
      this.close();
    });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }

  setGame(game: Game) {
    this.game = game;
    this.walk.reset();
    this.interior = false;
    this.close();
  }

  subscribe(fn: () => void) {
    this.onChange = fn;
  }

  private get busy() {
    return this.anim.busy || this.game.busy;
  }

  private spotAt(clientX: number, clientY: number) {
    const { x, y } = this.screen.toLogical(clientX, clientY);
    if (this.interior) {
      return hitTest(layoutInterior(this.screen.W, this.screen.H), x, y);
    }
    const L = layoutWorld(this.screen.W, this.screen.H, this.game.state, {
      shepherdAt: this.walk.position,
      time: performance.now(),
    });
    return hitTest(L, x, y);
  }

  /** walk him to a point of open ground; false if that spot isn't walkable */
  private sendHim(clientX: number, clientY: number): boolean {
    if (this.game.state.over || this.busy) return false;
    // wandering teaches nothing and only muddles the walkthrough
    if (!this.canInteract("ground")) return false;
    const spot = this.spotAt(clientX, clientY);
    if (!spot || (spot.id !== "ground" && spot.id !== "flock")) return false;
    const { x, y } = this.screen.toLogical(clientX, clientY);
    const L = layoutWorld(this.screen.W, this.screen.H, this.game.state, {
      shepherdAt: this.walk.position,
    });
    // keep him on the near ground, and clear of the very edges
    const ty = Math.max(L.groundY + 4, Math.min(this.screen.H - 30, y - 20));
    const tx = Math.max(4, Math.min(this.screen.W - 18, x - 6));
    this.walk.go(L.shepherd.x, L.shepherd.y, tx, ty, performance.now());
    this.close();
    return true;
  }

  private tap(clientX: number, clientY: number) {
    if (this.game.state.over) return;
    const spot = this.spotAt(clientX, clientY);
    if (!spot) {
      this.close();
      return;
    }
    if (!this.canInteract(spot.id)) {
      this.close();
      this.onBlocked(); // the walkthrough is on something else just now
      return;
    }

    /*
     * Nothing that acts on the world answers while an animation or the
     * watch's sequence is running. The sheet's buttons were already disabled
     * for this, but the house, the door and the bed bypassed the sheet
     * entirely — so you could walk in and sleep in the middle of the watch
     * running a recorded day.
     */
    if (this.busy) return;

    /*
     * The dog answers a tap herself rather than opening a sheet. A sheltie
     * turns a circle because she is pleased to see you; a collie does not,
     * she just looks up. Two turns in quick succession is the Arrow.
     */
    if (spot.id === "dog") {
      const g = this.game.state;
      if (owns(g, "collie")) {
        this.game.bark();
      } else {
        const quick = startSpin(performance.now());
        this.game.bark();
        if (quick) this.game.markSpun();
      }
      this.close();
      return;
    }

    // stepping in and out of the house
    if (!this.interior && spot.id === "croft") {
      this.interior = true;
      this.onNote("went-inside");
      this.close();
      return;
    }
    if (this.interior && spot.id === "door") {
      this.interior = false;
      this.close();
      return;
    }
    if (this.interior && spot.id === "bed") {
      // the day ends where you sleep
      this.close();
      this.interior = false;
      this.game.sleep();
      return;
    }
    if (this.active === spot.id && this.sheet.classList.contains("on")) {
      this.close();
      return;
    }
    this.open(spot.id);
  }

  close() {
    this.sheet.classList.remove("on");
    this.active = null;
  }

  /** rebuild the open sheet in place, so a purchase updates what's on screen */
  refresh() {
    /*
     * Tippy is earned by being in the room and watching her settle, not by
     * owning a collie and a hearth at the same moment — the point of it is
     * seeing where she chooses to lie. The painter runs her walk; this waits
     * until she is down before the achievement lands.
     */
    const g = this.game.state;
    if (this.interior && owns(g, "collie") && owns(g, "hearth") && !g.stats.sawTippy) {
      if (!tippyWalking(performance.now())) this.game.markTippy();
    }
    this.drawHud();
    if (this.active && this.sheet.classList.contains("on")) this.open(this.active);
  }

  /**
   * The top strip. Text, not pixels — these are the numbers the game is
   * played by, and the canvas bitmap font could not be read at the size the
   * strip allows.
   */
  private drawHud() {
    const g = this.game.state;
    const taps = this.settings.zen
      ? `TAPS <span class="taps">&infin;</span>`
      : g.taps === 0
        ? `<span class="taps spent">SPENT</span>`
        : `TAPS <span class="taps">${g.taps}/${tapsPerDay(g)}</span>`;
    $("hud-left").innerHTML = `DAY ${g.day} &nbsp; ${taps}`;
    // the weather is falling on the hill in front of you; the moon is not
    $("hud-mid").innerHTML = isFullMoon(g.day)
      ? "FULL MOON"
      : `<span class="moon">${moonName(g.day).toLowerCase()}</span>`;
    $("hud-right").textContent = `£${g.money}  ·  ${g.wool} st`;
  }

  open(id: HotspotId) {
    const rows = this.rowsFor(id);
    if (!rows.length) return;
    this.active = id;
    this.sheet.innerHTML = "";

    const head = el("div", { class: "sheet-head" });
    head.appendChild(el("h3", {}, this.titleFor(id)));
    const close = el("button", { class: "sheet-x", type: "button", "aria-label": "Close" }, "×") as HTMLButtonElement;
    close.addEventListener("click", () => this.close());
    head.appendChild(close);
    this.sheet.appendChild(head);

    const body = el("div", { class: "sheet-body" });
    for (const r of rows) {
      if (r.info) {
        body.appendChild(
          el("div", { class: "sheet-info" }, `<span class="n">${r.label}</span><span class="d">${r.detail}</span>`),
        );
        continue;
      }
      body.appendChild(
        button(
          `act${r.tone ? ` ${r.tone}` : ""}${r.done ? " done" : ""}`,
          `<span class="n">${r.label}</span><span class="d">${r.detail}</span>`,
          () => {
            r.onPick();
            /*
             * Trades normally keep the sheet open, so several things can be
             * bought in a row without reopening it. Anything with something
             * to watch closes instead — the animation is the point.
             */
            if ((id === "cart" || id === "croft") && !r.closes) this.refresh();
            else this.close();
            this.onChange();
          },
          r.disabled || this.busy,
        ),
      );
    }
    this.sheet.appendChild(body);
    this.sheet.classList.add("on");
  }

  private titleFor(id: HotspotId): string {
    const g = this.game.state;
    switch (id) {
      case "croft":
        return "The croft";
      case "cart":
        return `The cart · ${this.game.lex.wool} ${woolPrice(g)}p a stone`;
      case "flock":
        return `${this.game.lex.flockCap} · ${g.flock.length} on the hill`;
      case "shepherd":
        return "Yourself";
      case "ground":
        return here(g).name;
      case "hills":
        return "Where to graze them";
      case "sky":
        return "Word of the glen";
      case "hearth":
        return "The croft";
      case "kit":
        return "What you have";
      default:
        return "";
    }
  }

  /* ---------- what can be done where ---------- */

  private rowsFor(id: HotspotId): Row[] {
    switch (id) {
      case "flock":
        return this.actionRows(["gather", "shear", "tend"]);
      case "ground":
        return this.actionRows(["muck"]);
      case "shepherd":
        return [...this.actionRows(["pipe", "music", "pub", "ask"]), ...this.watchRows()];
      case "hills":
        return this.pastureRows();
      case "croft":
        return this.croftRows();
      case "cart":
        return this.cartRows();
      case "sky":
        return this.skyRows();
      case "hearth":
        return this.croftRows();
      case "kit":
        return this.kitRows();
      default:
        return [];
    }
  }

  /**
   * What the sky knows: the three-day forecast, the moon, and what is running
   * in you. The spec is emphatic that the forecast is what makes the game
   * plannable rather than reactive and must not be hidden — in a UI with no
   * panels, the sky is where it belongs.
   */
  private skyRows(): Row[] {
    const g = this.game.state;
    const rows: Row[] = g.forecast.map((w, i) => {
      const day = g.day + i;
      const wx = WEATHER[w];
      const when = i === 0 ? "Today" : i === 1 ? "Tomorrow" : "The day after";
      const notes: string[] = [`grazing ×${wx.graze}`];
      notes.push(wx.shear ? "shearing fine" : "no shearing");
      if (isFullMoon(day)) notes.push("full moon");
      return {
        label: `${when} · ${wx.name}`,
        detail: `${moonName(day).toLowerCase()} · ${notes.join(" · ")}`,
        info: true,
        onPick: () => {},
      };
    });

    const buffs = Object.entries(g.buffs).map(([k, v]) => `${k} (${v}d)`);
    rows.push({
      label: `${tapsPerDay(g)} taps a day · ${this.game.lex.wool} ${woolPrice(g)}p a stone`,
      detail: buffs.length ? `In you: ${buffs.join(", ")}` : "Nothing running in you just now.",
      info: true,
      onPick: () => {},
    });

    for (const line of g.log.slice(0, 4)) {
      rows.push({ label: line.t, detail: `day ${line.day}`, info: true, onPick: () => {} });
    }
    return rows;
  }

  /**
   * Things already done today.
   *
   * Some actions simply cannot be repeated (gathering, the pint) and some can
   * but rarely want to be (mucking ground already mucked). Without a mark
   * players re-open a sheet and wonder whether the tap went in, or spend one
   * on something they already have.
   */
  private doneToday(id: string): boolean {
    const g = this.game.state;
    /*
     * Read from what was recorded, never inferred from the effects.
     *
     * Inferring got two things wrong. The fiddle sets a different buff from
     * the pipes, so playing it never ticked and could be played all day; and
     * mucking was reading "the grass is above the threshold" as "you have
     * mucked", which ticked it on ground nobody had touched.
     */
    if (id === "muck") return g.muckedToday.includes(g.at);
    if (id === "gather") return g.gatheredToday; // cleared by moving them
    if (id === "pub") return g.pubToday;
    return (g.didToday[id as ActionId] ?? 0) > 0;
  }

  private actionRows(ids: string[]): Row[] {
    const g = this.game.state;
    const lex = this.game.lex;
    return ACTIONS.filter((a) => ids.includes(a.id)).map((a) => {
      const cost = this.game.costOf(a);
      const name = actionName(lex, a.id, owns(g, "fiddle")) || a.name;
      const done = this.doneToday(a.id);
      return {
        // a cost above one has to be on the button: the whole decision is
        // whether a day with three taps in it can afford this
        label: `${done ? "✓ " : ""}${name}${cost === 0 ? " · free" : cost > 1 ? ` · ${cost} taps` : ""}`,
        done,
        detail: a.desc(g, lex),
        disabled: g.taps < cost || !a.can(g),
        tone: a.cozy ? ("cozy" as const) : undefined,
        onPick: () => {
          this.game.doAction(a.id);
          if (a.id === "muck") this.onNote("did-muck");
          if (a.cozy) this.onNote("did-comfort");
        },
      };
    });
  }

  private watchRows(): Row[] {
    const g = this.game.state;
    if (!owns(g, "watch")) return [];
    if (g.recording) {
      return [
        {
          label: `Stop the watch · ${g.draft.length} set`,
          detail: "It keeps what you have done so far.",
          onPick: () => {
            this.game.stopRecording();
            this.game.changed();
          },
        },
      ];
    }
    const rows: Row[] = [
      {
        label: g.routine ? "Set the watch again" : "Set the watch",
        detail: "Record today, and it will keep that day for you after.",
        onPick: () => this.game.startRecording(),
      },
    ];
    if (g.routine) {
      rows.unshift({
        label: `Run the day by the watch · ${g.routine.length} turns`,
        detail: "It skips anything that cannot be done today.",
        onPick: () => this.game.runRoutine(),
      });
    }
    return rows;
  }

  private pastureRows(): Row[] {
    const g = this.game.state;
    return g.pastures.map((p, i) => ({
      label: `${p.name}${i === g.at ? " · they are here" : ""}`,
      detail: `grass ${Math.round(p.grass)}% · feed ×${p.quality} · fox risk ${Math.round(p.risk * 100)}%`,
      disabled: i === g.at || g.taps <= 0,
      onPick: () => {
        this.walk.reset(); // new ground, back to his mark
        this.game.moveTo(i);
      },
    }));
  }

  private croftRows(): Row[] {
    const g = this.game.state;
    const rows: Row[] = [];

    // whatever is going up gets the top of the list, with its progress
    if (g.building) {
      const m = CROFT.find((x) => x.id === g.building!.id)!;
      const build = ACTIONS.find((a) => a.id === "build")!;
      const left = m.work - g.building.done;
      rows.push({
        label: `${m.id === "ring" ? "Walk down for the ring" : `Work on it · ${g.building.done}/${m.work}`}`,
        detail: build.desc(g, this.lexicon),
        disabled: g.taps < this.game.costOf(build),
        tone: "gold",
        onPick: () => this.game.doAction("build"),
      });
      rows.push({
        label: m.name,
        detail: `Paid for. ${left} day${left === 1 ? "" : "s"} of work left in it.`,
        info: true,
        onPick: () => {},
      });
    }

    // whatever is up is shown above; don't list it again as something to buy
    rows.push(...CROFT.filter((m) => m.id !== g.building?.id).map((m) => {
      const has = owns(g, m.id);
      const locked = m.need ? !owns(g, m.need) : false;
      const first = m.need ? CROFT.find((x) => x.id === m.need)?.name.toLowerCase() : "";
      const busy = g.building !== null;
      return {
        label: `${m.name}${has ? "" : ` · £${m.cost}`}`,
        detail: has
          ? "Done."
          : locked
            ? `First: ${first}.`
            : busy
              ? "One thing at a time. Finish what is up first."
              : `${m.what} · ${m.work} days of work once it is paid for.`,
        disabled: has || locked || busy || g.money < m.cost,
        tone: "life" as const,
        onPick: () => this.game.buyCroft(m.id as CroftId),
      };
    }));
    // no Sleep here any more: you sleep by going to the bed, which is the
    // whole reason the inside of the house exists
    return rows;
  }

  /** everything owned, as a list, for the wall of kit */
  private kitRows(): Row[] {
    const g = this.game.state;
    const rows: Row[] = [];
    for (const t of TOOLS) {
      if (!owns(g, t.id)) continue;
      // the broadsword is never explained, here least of all
      rows.push({ label: t.name, detail: t.id === "sword" ? "Hangs well above the fire." : toolWhat(this.lexicon, t.id, t.what), info: true, onPick: () => {} });
    }
    if (owns(g, "pelt")) {
      rows.push({ label: "The last wolf's pelt", detail: "No fox comes near this ground.", info: true, onPick: () => {} });
    }
    if (!rows.length) {
      rows.push({ label: "Bare walls", detail: "Nothing bought yet. The cart is out on the hill.", info: true, onPick: () => {} });
    }
    return rows;
  }

  private cartRows(): Row[] {
    const g = this.game.state;
    const lex = this.game.lex;
    const rows: Row[] = [];

    // sell what is in the sack
    const market = ACTIONS.find((a) => a.id === "market")!;
    const cost = this.game.costOf(market);
    rows.push({
      label: `Sell the ${lex.wool}${cost === 0 ? " · free" : ""}`,
      detail: market.desc(g, this.lexicon),
      disabled: g.taps < cost || !market.can(g),
      tone: "gold",
      closes: true, // the cart rolls off down the road
      onPick: () => this.game.doAction("market"),
    });

    // sell a beast — no tap, and a loss on her
    for (const breed of Object.keys(BREEDS) as BreedId[]) {
      const held = g.flock.filter((s) => s.breed === breed);
      if (!held.length) continue;
      const worst = held.reduce((a, b) => (a.fleece <= b.fleece ? a : b));
      const price = this.game.sellPrice(worst.id);
      rows.push({
        label: `Sell a ${lex.breeds[breed]} · £${price}`,
        detail: `${held.length} in the ${lex.flock}. The cart pays under what she cost.`,
        onPick: () => this.game.sellEwe(worst.id),
      });
    }

    // buy stock
    for (const breed of Object.keys(BREEDS) as BreedId[]) {
      const b = BREEDS[breed];
      rows.push({
        label: `Buy a ${lex.breeds[breed]} · £${b.cost}`,
        detail: `${lex.breedNotes[breed]} · ${lex.fleeceWord} ×${b.growth.toFixed(2)} growth, ×${b.value.toFixed(2)} value`,
        disabled: g.money < b.cost,
        tone: "stock",
        closes: true, // she walks onto the hill; the sheet was covering her
        onPick: () => this.game.buyEwe(breed),
      });
    }

    // buy tools
    for (const t of TOOLS) {
      const has = owns(g, t.id);
      if (has) continue;
      // one dog, ever: the other is shown, closed, so the choice is visible
      const takenBy = t.id === "dog" && owns(g, "collie") ? "collie" : t.id === "collie" && owns(g, "dog") ? "dog" : null;
      if (takenBy) {
        rows.push({
          label: t.name,
          detail: "You have a dog. One shepherd, one dog — that is what a hirsel is.",
          info: true,
          onPick: () => {},
        });
        continue;
      }
      rows.push({
        label: `${t.name} · £${t.cost}`,
        detail: toolWhat(this.lexicon, t.id, t.what),
        disabled: g.money < t.cost,
        onPick: () => this.game.buyTool(t.id as ToolId),
      });
    }
    return rows;
  }

  /**
   * What the thing under the pointer is. Written here rather than in the art
   * because it needs the game state and TOD's vocabulary — and because it is
   * text, which the canvas has no business rendering.
   */
  hintText(): string {
    const g = this.game.state;
    if (g.over) return "";
    if (this.interior) {
      switch (this.hover) {
        case "bed":
          return "The bed — sleep the night";
        case "hearth":
          return "The hearth";
        case "door":
          return "Out to the hill";
        case "kit":
          return "What you have";
        default:
          return owns(g, "hearth") ? "" : "Four walls and a draught.";
      }
    }
    switch (this.hover) {
      case "croft":
        return owns(g, "ring") ? "The croft — finished" : "The croft — go in";
      case "cart":
        return `The cart — ${this.lexicon.wool} ${woolPrice(g)}p a stone`;
      case "flock":
        return `${this.lexicon.flockCap} — ${g.flock.length} on the hill`;
      case "shepherd":
        return "Yourself";
      case "ground":
        return `${here(g).name} — grass ${Math.round(here(g).grass)}%`;
      case "hills":
        return "The hills — move them";
      case "sky":
        return "Word of the glen";
      default:
        return "";
    }
  }

  /** the hint line under the scene, for players who haven't found a target yet */
  idleHint(): string {
    const g = this.game.state;
    if (g.over) return "";
    if (this.busy) return "";
    if (!canShear(g) && readyToShear(g.flock) > 0) return `No ${this.game.lex.shear.toLowerCase()} in this weather.`;
    if (g.taps <= 0) return "The day is spent — tap the croft to sleep.";
    return "";
  }

  /** keep TOD's vocabulary out of the settings-only path */
  get lexicon() {
    return this.game.lex;
  }

  /** used by the frame loop */
  get settingsRef() {
    return this.settings;
  }
}
