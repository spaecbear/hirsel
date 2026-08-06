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
import { canShear, here, isFullMoon, moonName, owns, priceOn, readyToShear, tapsPerDay } from "../sim/rules";
import { hitTest, layoutWorld, type HotspotId } from "../render/layout";
import { Walk } from "./walk";
import type { Screen } from "../render/screen";
import type { Animator } from "../render/animator";
import type { Settings } from "../sim/settings";
import type { BreedId, CroftId, ToolId } from "../sim/types";

interface Row {
  label: string;
  detail: string;
  disabled?: boolean;
  tone?: "cozy" | "gold" | "stock" | "life";
  /** not a choice — something to read. Rendered as text, not a dimmed button. */
  info?: boolean;
  onPick: () => void;
}

export class WorldUi {
  /** what the pointer is over, for the hint line */
  hover: HotspotId | null = null;
  /** what has a sheet open, so the scene can pick it out */
  active: HotspotId | null = null;
  private sheet: HTMLElement;
  private onChange: () => void = () => {};
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
    const L = layoutWorld(this.screen.W, this.screen.H, this.game.state, {
      shepherdAt: this.walk.position,
    });
    return hitTest(L, x, y);
  }

  /** walk him to a point of open ground; false if that spot isn't walkable */
  private sendHim(clientX: number, clientY: number): boolean {
    if (this.game.state.over || this.busy) return false;
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
    if (this.active && this.sheet.classList.contains("on")) this.open(this.active);
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
          `act${r.tone ? ` ${r.tone}` : ""}`,
          `<span class="n">${r.label}</span><span class="d">${r.detail}</span>`,
          () => {
            r.onPick();
            // trades keep the sheet open so you can buy more than one thing;
            // anything that spends a tap plays an animation, so it closes
            if (id === "cart" || id === "croft") this.refresh();
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
        return `The cart · wool ${priceOn(g.day)}p a stone`;
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
      label: `${tapsPerDay(g)} taps a day · wool ${priceOn(g.day)}p a stone`,
      detail: buffs.length ? `In you: ${buffs.join(", ")}` : "Nothing running in you just now.",
      info: true,
      onPick: () => {},
    });

    for (const line of g.log.slice(0, 4)) {
      rows.push({ label: line.t, detail: `day ${line.day}`, info: true, onPick: () => {} });
    }
    return rows;
  }

  private actionRows(ids: string[]): Row[] {
    const g = this.game.state;
    const lex = this.game.lex;
    return ACTIONS.filter((a) => ids.includes(a.id)).map((a) => {
      const cost = this.game.costOf(a);
      const name = a.id === "gather" ? lex.gather : a.id === "shear" ? lex.shear : a.name;
      return {
        label: `${name}${cost === 0 ? " · free" : ""}`,
        detail: a.desc(g),
        disabled: g.taps < cost || !a.can(g),
        tone: a.cozy ? ("cozy" as const) : undefined,
        onPick: () => this.game.doAction(a.id),
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
    const rows: Row[] = CROFT.map((m) => {
      const has = owns(g, m.id);
      const locked = m.need ? !owns(g, m.need) : false;
      const first = m.need ? CROFT.find((x) => x.id === m.need)?.name.toLowerCase() : "";
      return {
        label: `${m.name}${has ? "" : ` · £${m.cost}`}`,
        detail: has ? "Done." : locked ? `First: ${first}.` : m.what,
        disabled: has || locked || g.money < m.cost,
        tone: "life" as const,
        onPick: () => this.game.buyCroft(m.id as CroftId),
      };
    });
    rows.push({
      label: "Sleep the night",
      detail: g.taps > 0 ? `You still have ${g.taps} tap${g.taps > 1 ? "s" : ""} in you.` : "The day is spent.",
      tone: "gold",
      onPick: () => this.game.sleep(),
    });
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
      detail: market.desc(g),
      disabled: g.taps < cost || !market.can(g),
      tone: "gold",
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
        detail: `${b.note} · fleece ×${b.growth.toFixed(2)} growth, ×${b.value.toFixed(2)} value`,
        disabled: g.money < b.cost,
        tone: "stock",
        onPick: () => this.game.buyEwe(breed),
      });
    }

    // buy tools
    for (const t of TOOLS) {
      const has = owns(g, t.id);
      if (has) continue;
      rows.push({
        label: `${t.name} · £${t.cost}`,
        detail: t.what,
        disabled: g.money < t.cost,
        onPick: () => this.game.buyTool(t.id as ToolId),
      });
    }
    return rows;
  }

  /** the hint line under the scene, for players who haven't found a target yet */
  idleHint(): string {
    const g = this.game.state;
    if (g.over) return "";
    if (this.busy) return "";
    if (!canShear(g) && readyToShear(g.flock) > 0) return "No shearing in this weather.";
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
