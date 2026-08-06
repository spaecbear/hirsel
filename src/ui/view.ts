import { $, button, el } from "./dom";
import { ACTIONS, type Game } from "../sim/game";
import { BALANCE, BREEDS, CROFT, TOOLS } from "../sim/config";
import {
  flockValue,
  grade,
  isFullMoon,
  moonName,
  owns,
  priceOn,
  readyToShear,
  tapsPerDay,
} from "../sim/rules";
import { WEATHER } from "../sim/config";
import { lexicon } from "../sim/lexicon";
import type { Animator } from "../render/animator";
import type { Settings } from "../sim/settings";
import type { BreedId, CroftId, ToolId } from "../sim/types";

export type TabId = "day" | "land" | "shop" | "glen";
/** the day panel is split so the whole day fits without scrolling */
export type WorkTabId = "work" | "cozy" | "watch";

export class View {
  tab: TabId = "day";
  workTab: WorkTabId = "work";

  constructor(
    private game: Game,
    private anim: Animator,
    private settings: Settings,
  ) {
    document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((b) => {
      b.addEventListener("click", () => this.goTab(b.dataset.go as TabId));
    });
    this.goTab("day");
  }

  setGame(game: Game) {
    this.game = game;
  }

  goTab(t: TabId) {
    this.tab = t;
    document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.go === t));
    document.querySelectorAll<HTMLElement>(".panel").forEach((p) => p.classList.toggle("show", p.dataset.tab === t));
  }

  private get busy() {
    return this.anim.busy || this.game.busy;
  }

  render() {
    const g = this.game.state;
    const lex = lexicon(this.settings.inverse);
    this.renderHud(lex.flockCap, lex.woolCap);
    this.renderRecent();
    this.renderActions();
    this.renderPastures();
    this.renderFlock();
    this.renderShop();
    this.renderGlen();
    $("foot").textContent = `day ${g.day} · seed ${g.seed.toString(16)}${this.settings.inverse ? " · tod" : ""}`;
  }

  private renderHud(flockLabel: string, woolLabel: string) {
    const g = this.game.state;
    const hud = $("hud");
    hud.innerHTML = "";
    const stat = (k: string, v: string, cls = "") => {
      hud.appendChild(el("div", { class: "stat" }, `<div class="k">${k}</div><div class="v ${cls}">${v}</div>`));
    };
    stat("Day", String(g.day));
    stat("Taps left", String(g.taps), g.taps === 0 ? "warn" : "good");
    stat(flockLabel, String(g.flock.length));
    stat("Purse", `£${g.money}`, g.money < 10 ? "warn" : "");
    stat(woolLabel, `${g.wool} st`);
    stat("Weather", WEATHER[g.forecast[0]].name);
    // the full name would wrap the HUD onto a second line; the forecast has it in full
    stat("Moon", moonName(g.day).replace("Waxing", "Wax.").replace("Waning", "Wan.").replace("crescent", "cres."), isFullMoon(g.day) ? "good" : "");
  }

  /**
   * The last lines of narration, banded under the art so they are on screen
   * whatever tab you are on. Only rewritten when the log actually changes —
   * otherwise every state change would replay the flash and re-announce it.
   */
  private lastLogKey = "";
  private renderRecent() {
    const g = this.game.state;
    const latest = g.log.slice(0, 3);
    const key = latest.map((l) => `${l.day}:${l.t}`).join("|");
    if (key === this.lastLogKey) return;
    this.lastLogKey = key;
    $("recent").innerHTML = latest
      .map((l, i) => `<div class="${l.cls}${i === 0 ? " new" : ""}">${l.t}</div>`)
      .join("");
  }

  private renderActions() {
    const g = this.game.state;
    const a = $("actions");
    a.innerHTML = "";

    const hasWatch = owns(g, "watch");
    if (this.workTab === "watch" && !hasWatch) this.workTab = "work";

    // Sleep and the sub-tabs live in a header that stays put while the list
    // scrolls underneath it
    const head = el("div", { class: "day-head" });
    head.appendChild(
      button(
        "act sleep pin",
        `<span class="n">Sleep</span><span class="d">${
          g.taps > 0 ? `You still have ${g.taps} tap${g.taps > 1 ? "s" : ""} in you.` : "The day is spent."
        }</span>`,
        () => this.game.sleep(),
        this.busy,
      ),
    );

    // sub-tabs: the day's ten actions split into short lists
    const groups: [WorkTabId, string][] = [
      ["work", "Work"],
      ["cozy", "Comforts"],
    ];
    if (hasWatch) groups.push(["watch", "Watch"]);
    const bar = el("div", { class: "subtabs" });
    for (const [id, label] of groups) {
      const doable = this.groupActions(id).some((act) => act.can(g) && g.taps >= this.game.costOf(act));
      const b = el(
        "button",
        { type: "button", class: `${this.workTab === id ? "on" : ""}${doable ? " live" : ""}` },
        label,
      ) as HTMLButtonElement;
      b.addEventListener("click", () => {
        this.workTab = id;
        this.render();
      });
      bar.appendChild(b);
    }
    head.appendChild(bar);
    a.appendChild(head);

    if (this.workTab === "watch") {
      if (g.recording) {
        a.appendChild(
          button(
            "act watch",
            `<span class="n">Recording the day · ${g.draft.length} set</span><span class="d">Work as you mean it to go. The watch stops when you sleep.</span>`,
            () => {
              this.game.stopRecording();
              this.game.changed();
            },
            this.busy,
          ),
        );
      } else if (g.routine) {
        a.appendChild(
          button(
            "act watch",
            `<span class="n">Run the day by the watch · ${g.routine.length} turns</span><span class="d">It will skip anything that cannot be done today.</span>`,
            () => this.game.runRoutine(),
            this.busy,
          ),
        );
        a.appendChild(
          button("act watch small", `<span class="n">Set the watch again</span>`, () => this.game.startRecording(), this.busy),
        );
      } else {
        a.appendChild(
          button(
            "act watch",
            `<span class="n">Set the watch</span><span class="d">Record today, and the watch will keep that day for you after.</span>`,
            () => this.game.startRecording(),
            this.busy,
          ),
        );
      }
      return;
    }

    const lex = lexicon(this.settings.inverse);
    for (const act of this.groupActions(this.workTab)) {
      const cost = this.game.costOf(act);
      const name = act.id === "gather" ? lex.gather : act.id === "shear" ? lex.shear : act.name;
      a.appendChild(
        button(
          `act${act.cozy ? " cozy" : ""}`,
          `<span class="n">${name}${cost === 0 ? ' <em>free</em>' : ""}</span><span class="d">${act.desc(g)}</span>`,
          () => this.game.doAction(act.id),
          g.taps < cost || !act.can(g) || this.busy,
        ),
      );
    }
  }

  /** work is the hill; comforts are the things that compete with it */
  private groupActions(tab: WorkTabId) {
    if (tab === "watch") return [];
    return ACTIONS.filter((a) => (tab === "cozy" ? !!a.cozy : !a.cozy));
  }

  private renderPastures() {
    const g = this.game.state;
    const ps = $("pastures");
    ps.innerHTML = "";
    g.pastures.forEach((p, i) => {
      const d = el(
        "div",
        { class: `past${i === g.at ? " here" : ""}` },
        `<div class="nm">${p.name}${i === g.at ? "  ← flock here" : ""}</div>` +
          `<div class="meta">grass ${Math.round(p.grass)}% · feed ×${p.quality} · fox risk ${Math.round(p.risk * 100)}%</div>` +
          `<div class="bar"><i style="width:${p.grass}%"></i></div>`,
      );
      if (!this.busy) d.addEventListener("click", () => this.game.moveTo(i));
      ps.appendChild(d);
    });
  }

  /** hover for breed, fleece grade and age */
  private renderFlock() {
    const g = this.game.state;
    const lex = lexicon(this.settings.inverse);
    const box = $("flock");
    box.innerHTML = "";
    const tiles = el("div", { class: "tiles" });
    for (const s of g.flock.slice(0, 40)) {
      const gr = grade(s.fleece);
      tiles.appendChild(
        el(
          "div",
          {
            class: `tile ${gr.label}`,
            title: `${lex.breeds[s.breed]} · ${lex.wool} ${s.fleece.toFixed(1)} (${gr.label}) · ${s.age} day${s.age === 1 ? "" : "s"} in the ${lex.flock}`,
          },
          `<b>${lex.breeds[s.breed].split(" ")[0]}</b>${gr.label}`,
        ),
      );
    }
    box.appendChild(tiles);
    if (g.flock.length) {
      box.appendChild(
        el(
          "div",
          { class: "note" },
          `${readyToShear(g.flock)} ready · about ${Math.round(flockValue(g.flock))} stone standing on the hill · feed £${Math.ceil(g.flock.length / 2)} a night`,
        ),
      );
    }
  }

  private renderShop() {
    const g = this.game.state;
    const sh = $("shop");
    sh.innerHTML = "";

    const lex = lexicon(this.settings.inverse);
    sh.appendChild(el("div", { class: "shead" }, lex.stock));
    (Object.keys(BREEDS) as BreedId[]).forEach((k) => {
      const b = BREEDS[k];
      const owned = g.flock.filter((s) => s.breed === k).length;
      sh.appendChild(
        button(
          "act buy stock",
          `<span class="n">${lex.breeds[k]} · £${b.cost}${owned ? `  <em>×${owned} in the ${lex.flock}</em>` : ""}</span>` +
            `<span class="d">${b.note} · fleece ×${b.growth.toFixed(2)} growth, ×${b.value.toFixed(2)} value</span>`,
          () => this.game.buyEwe(k),
          g.money < b.cost || this.busy,
        ),
      );
    });

    sh.appendChild(el("div", { class: "shead" }, "Tools — one of each"));
    for (const t of TOOLS) {
      const has = owns(g, t.id);
      sh.appendChild(
        button(
          `act buy${has ? " owned" : ""}`,
          `<span class="n">${t.name}${has ? "" : ` · £${t.cost}`}</span><span class="d">${has ? `In the steading. ${t.what}` : t.what}</span>`,
          () => this.game.buyTool(t.id as ToolId),
          has || g.money < t.cost || this.busy,
        ),
      );
    }

    sh.appendChild(el("div", { class: "shead" }, "The croft — what it is all for"));
    for (const m of CROFT) {
      const has = owns(g, m.id);
      const locked = m.need ? !owns(g, m.need) : false;
      const first = m.need ? CROFT.find((x) => x.id === m.need)?.name.toLowerCase() : "";
      sh.appendChild(
        button(
          `act buy life${has ? " owned" : ""}`,
          `<span class="n">${m.name}${has ? "" : ` · £${m.cost}`}</span>` +
            `<span class="d">${has ? "Done." : locked ? `First: ${first}.` : m.what}</span>`,
          () => this.game.buyCroft(m.id as CroftId),
          has || locked || g.money < m.cost || this.busy,
        ),
      );
    }

    if (owns(g, "pelt")) {
      const t = button("act buy owned pelt", `<span class="n">The last wolf's pelt</span><span class="d">Taken on the High Corrie under a full moon. Foxes will not come near this ground.</span>`, () => {}, true);
      sh.appendChild(t);
    }
  }

  private renderGlen() {
    const g = this.game.state;
    $("forecast").innerHTML = g.forecast
      .map(
        (k, i) =>
          `<div>${i === 0 ? "today" : i === 1 ? "tomorrow" : "after"}<b>${WEATHER[k].name}</b>` +
          `<i class="${isFullMoon(g.day + i) ? "full" : ""}">${moonName(g.day + i)}</i></div>`,
      )
      .join("");

    const buffs = Object.entries(g.buffs).map(([k, v]) => `${k} (${v}d)`);
    const extra: string[] = [];
    extra.push(`taps ${tapsPerDay(g)}/day`);
    extra.push(`wool ${priceOn(g.day)}p a stone today`);
    if (readyToShear(g.flock) >= 1 && !WEATHER[g.forecast[0]].shear) extra.push("no shearing in this");
    if (g.flock.some((s) => s.fleece >= BALANCE.flystrikeFleece)) extra.push("fleece running heavy");
    $("buffs").textContent = (buffs.length ? `In you: ${buffs.join(", ")} · ` : "") + extra.join(" · ");

    $("log").innerHTML = g.log.map((l) => `<div class="${l.cls}">${l.t}</div>`).join("");
  }
}
