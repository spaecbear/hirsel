import { $, el, toast } from "./dom";
import { ACHIEVEMENTS, clearEarned, loadEarned } from "../sim/achievements";
import { CHEATS, findCheat, type CheatContext } from "../sim/cheats";
import { buffGlossary, statusGlossary, type GlossaryEntry } from "../sim/glossary";
import type { Settings } from "../sim/settings";

export interface SettingsApi {
  settings: Settings;
  apply: (patch: Partial<Settings>) => void;
  newGame: () => void;
  saveNow: () => void;
  loadSaved: () => void;
  exportSave: () => void;
  importSave: (f: File) => void;
  deleteSave: () => void;
  hasSave: () => boolean;
  replayTutorial: () => void;
  cheatContext: () => CheatContext;
}

export function buildSettings(api: SettingsApi) {
  const box = $("settings-body");
  const draw = () => {
    const s = api.settings;
    box.innerHTML = "";

    /* ---- sound ---- */
    const sound = group("Sound");
    sound.appendChild(
      slider("Master", s.master, (v) => api.apply({ master: v, muted: v === 0 ? s.muted : false })),
    );
    sound.appendChild(slider("Music", s.music, (v) => api.apply({ music: v })));
    sound.appendChild(slider("Effects", s.sfx, (v) => api.apply({ sfx: v })));
    sound.appendChild(
      seg("Audio", [["On", !s.muted], ["Muted", s.muted]], (i) => api.apply({ muted: i === 1 })),
    );
    box.appendChild(sound);

    /* ---- look ---- */
    const look = group("Look");
    // the interface switch is a real preference now, not a hidden extra:
    // "retro" is the whole panelled build, which some players will prefer
    look.appendChild(
      seg("Interface", [["Glen", s.ui === "glen"], ["Retro", s.ui === "retro"]], (i) =>
        api.apply({ ui: i === 0 ? "glen" : "retro" }),
      ),
    );
    look.appendChild(
      seg(
        "Motion",
        [
          ["System", s.motion === "auto"],
          ["Full", s.motion === "full"],
          ["Reduced", s.motion === "reduced"],
        ],
        (i) => api.apply({ motion: (["auto", "full", "reduced"] as const)[i] }),
      ),
    );
    look.appendChild(
      el(
        "div",
        { class: "note" },
        "Glen is the full-screen hill: tap the things in it to work them. Retro is the older " +
          "panelled build, kept as it was. Reduced motion collapses every animation to instant.",
      ),
    );
    box.appendChild(look);

    /* ---- the game ---- */
    const game = group("The game");
    game.appendChild(seg("Autosave", [["On", s.autosave], ["Off", !s.autosave]], (i) => api.apply({ autosave: i === 0 })));
    const btns = el("div", { class: "set-btns" });
    btns.appendChild(mkBtn("Save now", () => api.saveNow()));
    btns.appendChild(mkBtn("Load save", () => api.loadSaved(), !api.hasSave()));
    btns.appendChild(mkBtn("Export file", () => api.exportSave()));
    btns.appendChild(mkBtn("Import file", () => pickFile((f) => api.importSave(f))));
    btns.appendChild(mkBtn("Delete save", () => api.deleteSave(), !api.hasSave(), true));
    btns.appendChild(mkBtn("New run", () => api.newGame(), false, true));
    btns.appendChild(mkBtn("Replay the first day", () => api.replayTutorial(), false, true));
    game.appendChild(btns);
    game.appendChild(
      el("div", { class: "note" }, "Autosave writes one slot at the end of every night — never mid-day, so a reload can't land inside a half-resolved night."),
    );
    game.appendChild(
      el(
        "div",
        { class: "note" },
        "Replaying the first day starts a fresh run with the walkthrough — the taps are free that day and the flock starts one short.",
      ),
    );
    box.appendChild(game);

    /* ---- buffs & status: what the HUD's terse "tended (3d)" actually means ---- */
    const gloss = group("Buffs & status");
    const glossGrid = el("div", { class: "gloss" });
    const glossEntry = (e: GlossaryEntry) =>
      el("div", { class: e.secret && e.name === "?????" ? "locked" : "" }, `<b>${e.name}</b><i>${e.meta}</i><span>${e.effect}</span>`);
    for (const e of buffGlossary()) glossGrid.appendChild(glossEntry(e));
    for (const e of statusGlossary()) glossGrid.appendChild(glossEntry(e));
    gloss.appendChild(glossGrid);
    box.appendChild(gloss);

    /* ---- cheats ---- */
    const cheats = group("Cheat codes");
    const row = el("div", { class: "cheat-row" });
    const input = el("input", { type: "text", placeholder: "type a code", "aria-label": "Cheat code" }) as HTMLInputElement;
    const go = mkBtn("Enter", () => {
      const c = findCheat(input.value);
      if (!c) {
        toast("Nothing happens.");
        return;
      }
      const msg = c.apply(api.cheatContext());
      const found = new Set([...api.settings.cheatsFound, c.code]);
      api.apply({ cheatsFound: [...found] });
      input.value = "";
      toast(msg);
      draw();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go.click();
    });
    row.appendChild(input);
    row.appendChild(go);
    cheats.appendChild(row);

    // found codes stay found, across runs. Tap one to fire it again rather
    // than retyping it every playthrough.
    const known = new Set(s.cheatsFound);
    const list = el("div", { class: "ach cheat-list" });
    for (const c of CHEATS) {
      if (!known.has(c.code)) {
        list.appendChild(el("div", {}, `?????<span>not found yet</span>`));
        continue;
      }
      const on = c.kind === "toggle" && c.isOn?.(api.cheatContext());
      const mark = c.kind === "toggle" ? `<i>${on ? "on" : "off"}</i>` : `<i>use</i>`;
      const b = el(
        "button",
        { type: "button", class: `got${on ? " lit" : ""}` },
        `<b class="k">${c.code}${mark}</b><span>${c.blurb}</span>`,
      ) as HTMLButtonElement;
      b.addEventListener("click", () => {
        toast(c.apply(api.cheatContext()));
        draw();
      });
      list.appendChild(b);
    }
    cheats.appendChild(list);
    cheats.appendChild(
      el("div", { class: "note" }, "Codes stay found between runs — work them from here rather than typing them again."),
    );
    if (s.inverse) cheats.appendChild(el("div", { class: "note" }, "TOD is on. Enter it again to put the glen back the right way round."));
    box.appendChild(cheats);

    /* ---- achievements ---- */
    const ach = group("Achievements");
    const earned = new Set(loadEarned());
    const grid = el("div", { class: "ach" });
    for (const a of ACHIEVEMENTS) {
      const got = earned.has(a.id);
      if (a.secret && !got) {
        grid.appendChild(el("div", {}, `?????<span>something is out there</span>`));
        continue;
      }
      grid.appendChild(el("div", { class: got ? "got" : "" }, `${a.name}<span>${a.hint}</span>`));
    }
    ach.appendChild(grid);
    ach.appendChild(el("div", { class: "note" }, `${earned.size} of ${ACHIEVEMENTS.length} earned.`));
    const wipe = el("div", { class: "set-btns" });
    wipe.appendChild(
      mkBtn(
        "Forget achievements",
        () => {
          clearEarned();
          toast("Cleared.");
          draw();
        },
        false,
        true,
      ),
    );
    ach.appendChild(wipe);
    box.appendChild(ach);
  };

  return { draw };
}

function group(title: string) {
  const g = el("div", { class: "set-group" });
  g.appendChild(el("h4", {}, title));
  return g;
}

function slider(label: string, value: number, onInput: (v: number) => void) {
  const row = el("div", { class: "row" });
  row.appendChild(el("label", {}, label));
  const input = el("input", { type: "range", min: "0", max: "100", value: String(Math.round(value * 100)) }) as HTMLInputElement;
  const val = el("span", { class: "val" }, `${Math.round(value * 100)}`);
  input.addEventListener("input", () => {
    val.textContent = input.value;
    onInput(Number(input.value) / 100);
  });
  row.appendChild(input);
  row.appendChild(val);
  return row;
}

function seg(label: string, options: [string, boolean][], onPick: (i: number) => void) {
  const row = el("div", { class: "row" });
  row.appendChild(el("label", {}, label));
  const box = el("div", { class: "seg" });
  options.forEach(([text, on], i) => {
    const b = el("button", { type: "button", class: on ? "on" : "" }, text) as HTMLButtonElement;
    b.addEventListener("click", () => {
      box.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      onPick(i);
    });
    box.appendChild(b);
  });
  row.appendChild(box);
  return row;
}

function mkBtn(text: string, onClick: () => void, disabled = false, danger = false) {
  const b = el("button", { type: "button", class: danger ? "danger" : "" }, text) as HTMLButtonElement;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function pickFile(cb: (f: File) => void) {
  const input = el("input", { type: "file", accept: "application/json" }) as HTMLInputElement;
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) cb(f);
  });
  input.click();
}
