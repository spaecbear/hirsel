import "./styles.css";

import { Game } from "./sim/game";
import { hasDog } from "./sim/rules";
import { loadSettings, prefersReducedMotion, saveSettings, type Settings } from "./sim/settings";
import { clearSave, exportFile, hasSave, importFile, readSave, saveGame } from "./sim/save";
import { lexicon } from "./sim/lexicon";
import { CHEATS, revealNextCheat } from "./sim/cheats";
import { ACHIEVEMENTS, loadEarned } from "./sim/achievements";
import { tutorialSetup } from "./sim/tutorial";
import type { GameState } from "./sim/types";

import { Animator } from "./render/animator";
import { Screen } from "./render/screen";
import { GLEN_ART } from "./render/art/glen";
import { HIRSEL_ART } from "./render/art/hirsel";
import type { ArtPack } from "./render/art/types";

import { AudioEngine } from "./audio/engine";
import { Score } from "./audio/score";
import { Rain } from "./audio/rain";
import { HIRSEL_AIR, TOD_JIG } from "./audio/tunes";
import { Sfx } from "./audio/sfx";

import { View } from "./ui/view";
import { WorldUi } from "./ui/world-ui";
import { SkyFeed } from "./ui/sky-feed";
import { TutorialUi } from "./ui/tutorial-ui";
import { buildSettings } from "./ui/settings-panel";
import { $, el, toast } from "./ui/dom";

/* ---------- state ---------- */
const settings: Settings = loadSettings();
const packs: Record<string, ArtPack> = { glen: GLEN_ART, retro: HIRSEL_ART };

let game = new Game();
const animator = new Animator();
const canvas = $<HTMLCanvasElement>("scene");
const screen = new Screen(canvas, packs[settings.ui] ?? GLEN_ART);
const audio = new AudioEngine();
const score = new Score(audio);
const rain = new Rain(audio);
const sfx = new Sfx(audio);
const sky = new SkyFeed();
const view = new View(game, animator, settings);
const world = new WorldUi(game, screen, animator, settings);
const tutorial = new TutorialUi(game);
tutorial.onFinish = () => {
  if (!settings.tutorialSeen) applySettings({ tutorialSeen: true });
  game.freeTaps = false;
};
world.onNote = (what) => tutorial.note(what);
// the walkthrough locks everything except the thing it is teaching
world.canInteract = (id) => tutorial.allows(id);
world.onBlocked = () => tutorial.nudge();

/* ---------- opening ---------- */
function openingLines(g: Game) {
  const lex = lexicon(settings.inverse);
  g.say(`You handed in your notice. Six ${lex.beasts}, forty pounds, and a hill.`, "gold");
  g.say(`${lex.woolCap} is worth most between the fourth and ninth day of growth. After that it mats.`, "hi");
}

function wire(g: Game) {
  g.onAnim = (anim, after, payload) => {
    sfx.forAnim(anim, hasDog(g.state));
    animator.play(anim, after, payload);
    render();
  };
  g.onAchievement = (a) => {
    toast(`Achievement — ${a.name}`);
    sky.add(`— ${a.name} —`, "gold", performance.now());
  };
  g.lex = lexicon(settings.inverse);
  g.zen = settings.zen;
  g.subscribe(render);
  g.hydrateAchievements();
}

/** both interfaces redraw from the same signal */
function render() {
  if (settings.ui === "retro") view.render();
  else world.refresh();
  /*
   * A run can end without an animation playing — selling the last beast at
   * the cart, for one. The end screen used to be raised only from the
   * animator going idle, so those endings left the game quietly over with
   * nothing on screen. Anything that finishes a run raises it now; the
   * animator check keeps it from cutting in front of a fox raid or a
   * mauling that is still playing out.
   */
  if (game.state.over && !animator.busy) showEnd();
  tutorial.refresh();
}

function startGame(state?: GameState, opts: { intro?: boolean } = {}) {
  endShown = false;
  animator.clear();
  sky.clear();
  tutorial.stop();
  game = new Game(state);
  view.setGame(game);
  world.setGame(game);
  tutorial.setGame(game);
  wire(game);

  // a brand new run, by a player who has never had one: walk them through it
  const teaching = !state && !settings.tutorialSeen && settings.ui === "glen";
  if (teaching) {
    tutorialSetup(game.state);
    game.freeTaps = true;
  }
  if (!state) openingLines(game);
  if (teaching) tutorial.start();
  view.goTab("day");
  lastDay = game.state.day;
  // the day you walked out, before the first day on the hill
  if (opts.intro && settings.ui === "glen" && !prefersReducedMotion(settings)) {
    animator.play("quit");
  }
  render();
}

/* ---------- settings application ---------- */
function applySettings(patch: Partial<Settings>) {
  const wasUi = settings.ui;
  Object.assign(settings, patch);
  saveSettings(settings);
  audio.setLevels({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
  animator.reduced = prefersReducedMotion(settings);
  animator.speed = settings.swift ? 2 : 1;
  document.body.classList.toggle("no-motion", animator.reduced);
  score.setTune(settings.inverse ? TOD_JIG : HIRSEL_AIR);
  game.lex = lexicon(settings.inverse);
  game.zen = settings.zen;

  if (settings.ui !== wasUi || !canvas.parentElement) applyUiMode();
  soundBtn.textContent = settings.muted ? "Sound off" : "Sound on";
  soundBtn.setAttribute("aria-pressed", String(!settings.muted));
  render();
}

/** move the one canvas between the two shells and re-fit it */
function applyUiMode() {
  const glen = settings.ui === "glen";
  document.body.classList.toggle("mode-glen", glen);
  document.body.classList.toggle("mode-retro", !glen);
  const host = $(glen ? "glen-stage" : "retro-stage");
  if (glen) host.appendChild(canvas);
  else host.insertBefore(canvas, $("tabs"));
  world.close();
  screen.setPack(packs[settings.ui] ?? GLEN_ART);
  screen.fit();
  measureScene();
}

const soundBtn = $<HTMLButtonElement>("btn-sound");

const settingsUi = buildSettings({
  settings,
  apply: (patch) => applySettings(patch),
  newGame: () => {
    startGame(undefined, { intro: true });
    closeSettings();
    hideTitle();
    toast("A new hill.");
  },
  saveNow: () => toast(saveGame(game.state) ? "Saved." : "Could not save."),
  loadSaved: () => {
    const f = readSave();
    if (!f) return toast("No save found.");
    startGame(f.state);
    closeSettings();
    hideTitle();
    toast(`Loaded — day ${f.state.day}.`);
  },
  exportSave: () => exportFile(game.state),
  importSave: (file) => {
    void importFile(file).then((state) => {
      if (!state) return toast("That file is not a Hirsel save.");
      startGame(state);
      closeSettings();
      hideTitle();
      toast(`Loaded — day ${state.day}.`);
    });
  },
  deleteSave: () => {
    clearSave();
    toast("Save deleted.");
    settingsUi.draw();
  },
  hasSave,
  replayTutorial: () => {
    // clearing the flag is what makes startGame teach it again
    applySettings({ tutorialSeen: false });
    startGame(undefined, { intro: true });
    closeSettings();
    hideTitle();
    toast("Back to the first day.");
  },
  cheatContext: () => ({
    game,
    settings,
    toggleRetro: () => applySettings({ ui: settings.ui === "retro" ? "glen" : "retro" }),
    toggleInverse: () => applySettings({ inverse: !settings.inverse }),
    toggleZen: () => applySettings({ zen: !settings.zen }),
    toggleSwift: () => applySettings({ swift: !settings.swift }),
    setSpeed: () => {},
    closeSettings: () => closeSettings(),
  }),
});

/* ---------- overlays ---------- */
function openSettings() {
  settingsUi.draw();
  $("settings").classList.add("on");
  document.body.classList.add("modal");
}
function closeSettings() {
  $("settings").classList.remove("on");
  document.body.classList.remove("modal");
}
$("btn-settings").addEventListener("click", openSettings);
$("settings-close").addEventListener("click", closeSettings);
soundBtn.addEventListener("click", () => applySettings({ muted: !settings.muted }));
$("over-again").addEventListener("click", () => {
  $("over").classList.remove("on");
  startGame(undefined, { intro: true });
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSettings();
});

/* ---------- the credits ---------- */

/**
 * Shown for finishing a run with nothing left to find — every achievement
 * earned and every code known. Not for winning; for finishing it.
 */
function everythingFound(): boolean {
  const earned = new Set(loadEarned());
  const allAchievements = ACHIEVEMENTS.every((a) => earned.has(a.id));
  const found = new Set(settings.cheatsFound);
  const allCheats = CHEATS.every((c) => found.has(c.code));
  return allAchievements && allCheats;
}

const CREDITS: [string, string][] = [
  ["Design", "Joseph Ceccarelli"],
  ["Code", "Joseph Ceccarelli"],
  ["Pixel art", "Joseph Ceccarelli"],
  ["Animation", "Joseph Ceccarelli"],
  ["Music", "Joseph Ceccarelli"],
  ["Sound", "Joseph Ceccarelli"],
  ["Writing", "Joseph Ceccarelli"],
  ["Balance", "Joseph Ceccarelli"],
  ["Testing", "Joseph Ceccarelli"],
  ["Production", "Joseph Ceccarelli"],
  ["Special thanks", "Joseph Ceccarelli"],
];

function showCredits() {
  const box = $("credits-scroll");
  box.innerHTML = "";
  box.appendChild(el("h2", {}, "Hirsel"));
  box.appendChild(el("div", { class: "note" }, "a hill, a flock, and a life to build on it"));
  for (const [role, name] of CREDITS) {
    box.appendChild(el("div", { class: "role" }, role));
    box.appendChild(el("div", { class: "name" }, name));
  }
  box.appendChild(
    el(
      "div",
      { class: "note" },
      `Every achievement found, every word known, and the croft finished on day ${game.state.day}.<br><br>` +
        "Wolves were hunted out of Scotland some time in the 1680s.<br>Thank you for keeping the last one company.",
    ),
  );
  // restart the roll from the bottom every time it is opened
  const scroll = box as HTMLElement;
  scroll.style.animation = "none";
  void scroll.offsetWidth;
  scroll.style.animation = "";
  world.close(); // nothing else on screen while it rolls
  document.body.classList.add("rolling");
  $("credits").classList.add("on");
  // when the roll runs out, go back to the menu rather than dropping the
  // player onto a hill whose run is already over
  scroll.addEventListener("animationend", closeCredits, { once: true });
}

/** the credits end at the menu, not back on a finished hill */
function closeCredits() {
  $("credits").classList.remove("on");
  document.body.classList.remove("rolling");
  $("over").classList.remove("on");
  showTitle();
}
$("credits-close").addEventListener("click", closeCredits);

/* ---------- the title ---------- */
function showTitle() {
  const save = readSave();
  const cont = $<HTMLButtonElement>("title-continue");
  cont.disabled = !save;
  cont.style.display = save ? "" : "none";
  $("title-foot").textContent = save ? `a run is waiting — day ${save.state.day}` : "";
  $("title").classList.add("on");
}
function hideTitle() {
  $("title").classList.remove("on");
  if (!settings.seenTitle) applySettings({ seenTitle: true });
}
$("title-new").addEventListener("click", () => {
  firstGesture();
  hideTitle();
  startGame(undefined, { intro: true });
});
$("title-continue").addEventListener("click", () => {
  firstGesture();
  const f = readSave();
  hideTitle();
  if (f) {
    startGame(f.state);
    game.say(`— Picked up where you left off, day ${f.state.day}. —`, "cozy");
  } else startGame(undefined, { intro: true });
});
$("title-settings").addEventListener("click", () => {
  firstGesture();
  openSettings();
});

/* ---------- audio starts on the first gesture ---------- */
function firstGesture() {
  if (audio.started) return;
  if (audio.start()) {
    audio.setLevels({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
    score.start();
    rain.start();
  }
}
for (const evt of ["pointerdown", "keydown", "touchstart"]) {
  addEventListener(evt, firstGesture, { passive: true });
}

/* ---------- night bookkeeping the UI owns ---------- */
let lastDay = 1;
animator.onStart = (anim) => {
  // the opening gets the screen to itself; the walkthrough waits until he
  // has actually arrived on the hill
  if (anim === "quit") tutorial.suspend(true);
  if (anim === "sleep" && settings.ui === "retro" && innerWidth <= 760) view.goTab("glen");
  if (anim === "wolf" || anim === "wolflost") score.cue("wolf");
  else if (anim === "fox") score.cue("fox");
};
animator.onIdle = () => {
  tutorial.suspend(false);
  render();
  const g = game.state;
  // autosave lands only once the night (and any raid) has fully played out
  if (settings.autosave && g.day !== lastDay && !g.over) {
    lastDay = g.day;
    saveGame(g);
  }
  if (g.over) showEnd();
};

/*
 * Raised once per ending. It has to be idempotent because it writes settings
 * (the revealed code), which triggers a render, which is one of the things
 * that raises it — without this guard a single win recursed through the whole
 * cheat list and handed over every code at once.
 */
let endShown = false;
function showEnd() {
  const o = game.state.over;
  if (!o || endShown) return;
  endShown = true;
  $("over-title").textContent = o.title;
  $("over-body").textContent = o.body;

  const box = $("over-reward");
  box.innerHTML = "";
  box.style.display = "none";
  if (o.kind === "win") {
    // finishing a run hands over a code you did not have, for the next one
    const prize = revealNextCheat(settings.cheatsFound);
    if (prize) {
      applySettings({ cheatsFound: [...settings.cheatsFound, prize.code] });
      box.style.display = "";
      box.innerHTML =
        `<div class="reward-label">For the next hill, a word you did not have</div>` +
        `<div class="reward-code">${prize.code}</div>` +
        `<div class="reward-blurb">${prize.blurb}</div>` +
        `<div class="reward-foot">It is in Settings → Cheat codes from now on.</div>`;
    } else {
      box.style.display = "";
      box.innerHTML = `<div class="reward-label">You have them all now. There is nothing left to tell you.</div>`;
    }
  }
  $("over").classList.add("on");

  // and for a run that finished with nothing left to find
  if (o.kind === "win" && everythingFound()) {
    setTimeout(() => {
      $("over").classList.remove("on");
      showCredits();
    }, 2600);
  }
}

/**
 * The cutscene lines, as DOM text rather than canvas pixels.
 *
 * They used to be drawn with the bitmap font at 7px and hardened to 1-bit,
 * which no amount of backing plate made readable. These are the only words in
 * the opening and they carry the whole reason the run is happening, so they
 * get the same crisp text as the Sound and Settings chips.
 */
/**
 * The word of the glen, as text. Each line is a real element: main writes its
 * opacity and drift every frame from the age the feed reports, which keeps the
 * fade the canvas version had without the canvas font nobody could read.
 */
const skyLogEl = $("sky-log");
let skyKey = "";
function updateSkyLog(now: number) {
  if (settings.ui !== "glen") {
    if (skyKey !== "") {
      skyKey = "";
      skyLogEl.innerHTML = "";
    }
    return;
  }
  const lines = sky.list(now);
  const key = lines.map((l) => `${l.cls}:${l.text}`).join("|");
  if (key !== skyKey) {
    skyKey = key;
    skyLogEl.innerHTML = "";
    for (const l of lines) {
      const node = document.createElement("div");
      node.className = `line ${l.cls}`;
      node.textContent = l.text;
      skyLogEl.appendChild(node);
    }
  }
  // in fast, out slow: readable before it starts leaving
  const kids = skyLogEl.children;
  for (let i = 0; i < kids.length && i < lines.length; i++) {
    const age = lines[i].age;
    const fade = age < 0.1 ? age / 0.1 : age > 0.62 ? 1 - (age - 0.62) / 0.38 : 1;
    const node = kids[i] as HTMLElement;
    node.style.opacity = String(Math.max(0, Math.min(1, fade)));
    node.style.transform = `translateY(${-Math.round(age * 8)}px)`;
  }
}

const hintEl = $("hint");
let hintText = "";
function updateHint() {
  const want = settings.ui === "glen" && !animator.busy ? world.hintText() : "";
  if (want === hintText) return;
  hintText = want;
  hintEl.textContent = want;
  hintEl.classList.toggle("on", want !== "");
}

const captionEl = $("caption");
let captionText = "";
function updateCaption(anim: string | null, p: number) {
  let want = "";
  if (anim === "quit") {
    if (p < 0.4) want = "You handed in your notice.";
    else if (p >= 0.66) want = "A hill, and whatever you can make of it.";
  }
  if (want === captionText) return;
  captionText = want;
  captionEl.textContent = want;
  captionEl.classList.toggle("on", want !== "");
}

/* ---------- the frame loop ---------- */
function frame(now: number) {
  animator.tick(now);
  updateCaption(animator.current, animator.p);
  const g = game.state;
  const isRaining = g.forecast[0] === "rain";
  score.mood = {
    night: animator.current === "sleep" || animator.current === "fox" || animator.current === "wolf",
    rain: isRaining,
  };
  rain.setActive(isRaining);
  sky.sync(g.log, now);
  updateSkyLog(now);
  updateHint();
  const shepherdAt = world.walk.tick(now);

  screen.painter.cx.save();
  (packs[settings.ui] ?? GLEN_ART).draw(screen.painter, {
    state: g,
    anim: animator.current,
    p: animator.p,
    time: now,
    reduced: animator.reduced,
    inverse: settings.inverse,
    payload: animator.payload,
    hover: settings.ui === "glen" ? world.hover : null,
    active: settings.ui === "glen" ? world.active : null,
    shepherdAt: settings.ui === "glen" ? shepherdAt : null,
    walking: settings.ui === "glen" && world.walk.walking,
    facing: world.walk.facing,
    zen: settings.zen,
    interior: settings.ui === "glen" && world.interior,
    spotlight: settings.ui === "glen" && !world.interior ? tutorial.spotlight : null,
    spotlightBed: settings.ui === "glen" && world.interior && tutorial.pointingAtBed,
  });
  screen.painter.cx.restore();
  requestAnimationFrame(frame);
}

/* the retro day panel's header sticks below the scene, so it needs its height */
const sceneEl = document.querySelector<HTMLElement>(".scene");
function measureScene() {
  if (sceneEl) document.documentElement.style.setProperty("--scene-h", `${sceneEl.offsetHeight}px`);
}
if (sceneEl && "ResizeObserver" in window) new ResizeObserver(measureScene).observe(sceneEl);

addEventListener("resize", () => {
  screen.fit();
  measureScene();
});
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => applySettings({}));

/* ---------- boot ---------- */
applyUiMode();
applySettings({});
const existing = readSave();
startGame(existing && settings.autosave ? existing.state : undefined);
showTitle();
screen.fit();
requestAnimationFrame(frame);

/* ---------- dev handles, for poking at the running game in the console ---------- */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).hirsel = {
    get game() {
      return game;
    },
    audio,
    score,
    rain,
    sfx,
    animator,
    settings,
    screen,
    world,
    sky,
    tutorial,
  };
}

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline play is a bonus, not a requirement */
    });
  });
}
