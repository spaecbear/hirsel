# Hirsel — the road to Steam

A plan for two pieces of work that run side by side: **making the game ready to ship on
Steam**, and **making it more of a complete game**. Written against the code as it stands
(149 tests green, 59 KB gzipped bundle, web-first PWA on Vercel).

Read `hirsel-spec.md` and the README first. Everything here builds on them, and the design
invariants in the README still hold — in particular: three taps is the game, the wolf is
never explained, and the sim stays free of the DOM.

---

## 0. Branch strategy

Two games, two branches:

| branch | what it is | where it runs |
| --- | --- | --- |
| `main` | **the original Hirsel**, as it was before this plan: the web game | Vercel |
| `steam` | **the Steam version**: everything in this plan — the desktop shell, and the seasons, breeding and other new content | Steam |

`main` is kept as it is. All new work in this document — platform, input and content
alike — lands on `steam`. The original stays playable on the web, unchanged, rather than
turning into the Steam game one feature at a time.

What that means in practice:

1. **New work branches from `steam` and merges back into `steam`.** Nothing here goes to
   `main`.
2. **A bug in the original game gets fixed on `main` and merged into `steam`** — a plain
   merge, never a rebase — so both builds carry the fix. The reverse direction does not
   happen: `steam` never merges into `main`.
3. **The web build still exists on `steam`.** `npm run dev` there runs the Steam version in
   a browser, which remains the quickest way to play-test new content. Only `desktop/`
   needs Electron.
4. **The demo (§1.7) is cut from `steam`**, not `main`, since it is a taste of the Steam
   game. Whether the free web version on Vercel keeps serving `main`, switches to the demo,
   or comes down is §4's open question 8.

---

## 1. Ready for Steam

> **Progress.** Phases 1 and 2 of §3 are in: the platform seam, the bundled font and the
> cheated flag on the game side, and the Electron shell in `desktop/` (see its README). The
> Linux build is packaged and tested headless; Windows is configured but not yet built.
> Steamworks is wired against Valve's test app id (480) until Hirsel has its own.

### 1.1 Desktop wrapper

**Electron + [`steamworks.js`](https://github.com/ceifa/steamworks.js).** Tauri builds are
far smaller, but Steamworks support there is thinner, and the game is 165 KB of JS — the
Electron runtime's size is the cost of the mature path, not a problem to solve.

- [x] `desktop/src/main.ts`: one `BrowserWindow`, loads `dist/index.html` (Vite already builds
      with `base: "./"`, so relative paths work from disk)
- [x] `desktop/src/preload.ts`: exposes a narrow `window.hirselPlatform` bridge — saves,
      achievements, quit, fullscreen. `contextIsolation: true`, no `nodeIntegration`
- [x] Packaging with `electron-builder` for **Windows x64** and **Linux x64**
      (the Steam Deck runs the Linux build, or the Windows one under Proton); macOS is optional
      and costs a notarisation account
- [x] Do not register the service worker under Electron (`public/sw.js` exists to cache a
      web page; on disk it only gets in the way), and drop the manifest's
      `orientation: portrait`
- [x] **Bundle the font.** `styles.css` asks for DejaVu Sans Mono, which Windows does not
      have, so every Windows player currently sees Consolas. DejaVu's licence permits
      shipping it; add it as an `@font-face` from `public/`. The web build on `main` has the
      same problem; port it there too if the original should look right on Windows
- [ ] Steam overlay: `steamworks.js` needs `electronEnableSteamOverlay()` and the overlay is
      known to be fiddly under Electron. Test it early; it is not a launch blocker if it
      misbehaves, but Shift+Tab should not break the game

**Done when:** `npm run package` produces a Windows and a Linux build that start, play a
full day, and quit cleanly.

### 1.2 The platform seam

Today three modules talk to `localStorage` directly: `sim/save.ts`, `sim/settings.ts`,
`sim/achievements.ts`. Put one interface between them and the storage:

```ts
// src/platform/index.ts
export interface Platform {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  unlockAchievement(id: string): void;   // web: no-op
  quit?(): void;                          // web: absent — no Quit button
  setFullscreen?(on: boolean): void;
}
```

- [x] Web implementation wraps `localStorage` exactly as now, keeping the swallow-errors
      behaviour the README warns about
- [x] Steam implementation (Steam branch only) writes JSON files under
      `app.getPath("userData")`, synchronously through the preload bridge so the existing
      call sites do not become async
- [x] `test/setup.ts` keeps working — the web platform is what the tests run against

**Done when:** `steam` has no direct `localStorage` call outside `src/platform/`, and all
tests still pass.

### 1.3 Saves and Steam Cloud

- [x] File saves as above: `save.json`, `settings.json`, `achievements.json`
- [x] Write atomically (write to `.tmp`, then rename) — a crash mid-write must not eat a run
- [x] **Steam Auto-Cloud** in the Steamworks partner site, rooted at the userData folder for
      each OS (`WinAppDataRoaming`, `LinuxXdgDataHome`). No code needed beyond saving to a
      stable path
- [x] Settings → Export/Import stays; it becomes a backup rather than the only way to move
      a run
- [x] Autosave still writes at the end of a night only (design invariant)

### 1.4 Steam achievements

The 22 in `sim/achievements.ts` map one-to-one; Steam supports hidden achievements, so the
four secret ones (`tippy`, `arrow`, `pelt`, `mauled`) stay secret.

- [ ] Register all 22 in Steamworks with the same ids; hidden flag on the four secret ones,
      with their existing `hint` as the post-unlock description
- [x] `checkAchievements` → `platform.unlockAchievement(id)` for each fresh one
- [x] On start-up, re-send every locally earned id — covers achievements earned offline
      or before Steam was running
- [ ] **64×64 icons for each, earned and unearned** (44 images). Pixel art, integer-scaled
- [x] **Cheated runs earn nothing**. Today `SILLER` (+£500) and `1680`
      (summons the wolf) can earn the croft and pelt achievements. Add `cheated: boolean`
      to `GameState` — `hydrate` back-fills it for old saves — set it when any code that
      changes the run is used, and skip achievement checks while it is true. Show it on
      the end screen so it is never a surprise. `RETRO`, `TOD` and other purely cosmetic
      codes should not set it
- [x] Consider whether `ZEN` (unlimited taps) and `SKELP` (double pace) count: `ZEN` should,
      `SKELP` should not

### 1.5 Input — the largest piece of engineering

Today the game is pointer-only; the only key it reads is Escape. Steam players on desktop
expect a keyboard, and **Steam Deck Verified requires full controller play** — the Deck's
touchscreen works, but Valve does not count it.

The good news is the seam already exists: `render/layout.ts` hands back every tap target as
a `Hotspot` list, and the art and the hit-testing both read it. Focus navigation can be
built on the same list.

- [ ] **Focus model** (`ui/focus.ts`): a current hotspot; direction input picks
      the nearest hotspot in that direction from the current one's centre. Sheep are many
      small targets — treat the flock as one stop that expands into per-sheep focus on
      confirm, or the d-pad becomes a slog across twenty animals
- [ ] A visible focus ring drawn over the focused hotspot, only while keyboard/pad is the
      last-used input (mouse and touch look exactly as today)
- [ ] Sheets, the settings panel and the title screen: real `<button>`s already, so
      standard DOM focus plus arrow-key handling
- [ ] **Keyboard:** arrows/WASD to move focus, Enter/Space to confirm, Escape to back out,
      and a few direct keys (`S` sleep, `M` market, `Tab` cycle pasture) for players who
      learn them
- [ ] **Gamepad:** the Gamepad API works in Electron. D-pad/left stick = focus, A = confirm,
      B = back, Start = settings. "Hold to walk" becomes the right stick moving him directly
- [ ] Button prompts in the UI switch between mouse, keyboard and Xbox/Deck glyphs by last
      input
- [ ] Steam Input: ship a default controller configuration so the Deck needs no setup
- [ ] Deck checks: text legible at 1280×800 (the DOM-text decision helps a lot here),
      the on-screen keyboard appears for the cheat-code field
      (`steamworks.js` can show it), suspend/resume does not lose a day

**Done when:** a full run — title to croft — can be played on a controller alone, and on a
keyboard alone.

### 1.6 Desktop basics

- [x] **Quit to desktop** in Settings and on the title screen (Steam build only — the web
      build has no Quit)
- [x] Fullscreen / windowed toggle; remember window size and position
- [ ] Pause the scene clock and duck audio when the window loses focus
- [ ] **Retro interface:** hide it in the Steam build (keep the `RETRO` code working if you
      like). A second whole interface doubles the controller and Deck QA surface for a
      feature few Steam players will look for

### 1.7 The web version and a demo

Decide what happens to the free Vercel build once there is a paid one. Recommended:

- [ ] **Turn it into the demo**: the same game capped at, say, the end of day 10, with a
      "wishlist on Steam" link on the cap screen. Implement as a build flag on `steam`
      (`VITE_DEMO_DAYS=10`) so the demo is never a third fork
- [ ] Ship the same demo on Steam as a separate demo app — a Steam demo, especially during
      **Steam Next Fest**, is one of the strongest sources of wishlists a small game gets

### 1.8 Store and business

**Steamworks setup**

- [ ] Steamworks partner account, tax interview, bank details
- [ ] **Steam Direct fee: $100** per game (recouped after $1,000 gross)
- [ ] Valve imposes a **30-day wait** between paying for your first app and releasing it —
      start this early, it runs in parallel with everything else
- [ ] **Coming Soon page live at least 2 weeks before release**; store page and build are each
      reviewed by Valve (allow a few working days each)

**Store assets** — all pixel art integer-scaled, never smoothed

| asset | size |
| --- | --- |
| header capsule | 920×430 |
| small capsule | 462×174 |
| main capsule | 1232×706 |
| vertical capsule | 748×896 |
| library capsule | 600×900 |
| library hero | 3840×1240 |
| library logo | 1280 wide max, transparent |
| screenshots | at least 5, 1920×1080 |
| achievement icons | 64×64 × 44 (see §1.4) |
| trailer | optional but strongly recommended; 30–60s |

The Glen interface in landscape is the screenshot view. Good moments: the three pastures
(Rannoch, the heather glen, the Quiraing), the inn, inside the croft with the sword over the
fire, a night with the full moon, and one tasteful hint of the wolf that gives nothing away.

**Store copy and survey**

- [ ] Short description (≤300 chars), long description, tags (Cozy, Farming Sim, Pixel
      Graphics, Relaxing, Management, Singleplayer, Short)
- [ ] Content survey: discloses **tobacco** (the pipe) and **alcohol** (the pint)
- [ ] Privacy: no network, no telemetry, no accounts — say so
- [ ] Music: all three tunes are original, written as note data in `audio/tunes.ts`. Keep a
      note on file that you wrote them; the README already records why The Tod is original
      rather than the traditional tune
- [ ] Price: a $6–10 cozy game expects roughly 4–8 hours to a first win (see §2)
- [ ] Localization: launch English only. The Scots voice is the charm and is expensive to
      translate well; revisit after launch

---

## 2. A more complete game

The core is strong and should not change: the three-tap day, the public forecast, the fleece
value curve, the croft asked for by her rather than listed, the pub doing four jobs, and the
wolf. The gap is **the middle of a run**. The croft costs £1,510; the tuned balance has a
median purse of £164 at day 90. That is a long stretch of the same loop, and the README's
own measurement is that spare taps mostly go to filler.

Everything below lands on `steam`. The original game on `main` stays as it is.

### 2.1 Seasons — the headline feature (spec §14.6)

> **Built.** 24-day seasons (three moons each), spring first and unchanged; hay cut in summer
> or bought at the cart; snow in winter; the byre houses the flock on snow nights. Spring
> lambing waits for §2.2. See "Seasons" in the README for the numbers and the measurement.

The spec calls this the obvious next system and the answer to the pelt ending the fox game.
It gives a 100-day run a shape.

- [x] A season layer on top of the day loop: e.g. 28-day seasons, starting in spring
- [ ] **Spring** — lambing (§2.2); grass regrows fast; flystrike begins
- [x] **Summer** — the main clip; fleece grows fastest; flystrike peaks
- [x] **Autumn** — the big market: better prices for wool and store lambs; the tup sales
- [x] **Winter** — nothing grows; snow joins the weather bag; flock must be fed hay (§2.3)
      or brought into the byre, which gives the byre a mechanical job, not just a milestone
- [x] Seasons show on the forecast and change the palette of the glen (the terrain and sky
      are already drawn from constants — winter is a palette pass plus snow)
- [x] Night resolution order in spec §2 gains a season step; add it at a fixed point and
      test the order the way the current night is tested
- [x] Rebalance after: the headless 30- and 90-day simulations in the README are the tool.
      Re-run them per difficulty

### 2.2 Lambing and breeding

The flock only grows by buying today.

- [ ] A tup (ram) as a purchase — one slot, like the dog
- [ ] Ewes with the tup in autumn lamb in spring; lambs have the ewe's breed
- [ ] Lambs can be kept (flock grows, feed rises) or sold at the autumn sales
- [ ] Gives the four breeds a long-term identity: which ones you breed from, not just buy
- [ ] `Sheep.age` already exists; old ewes stop lambing and sell cheaply — a reason to renew

### 2.3 Work that fills the empty days

The README names the next levers: actions that are investment rather than filler.

- [ ] **Repair a dyke** — multi-day work like the croft; each stretch mended lowers fox risk
      on that pasture permanently
- [ ] **Dip the flock** — prevents flystrike for longer than tending, costs money and a tap
- [ ] **Cut and stack hay** in summer — the winter feed stock
- [ ] **Cut peat** — fuel for the hearth; a warm house keeps the `hale` buff going in winter
- [ ] Each should make a *future* day better, so a spare tap becomes a plan

### 2.4 The dog grows old (spec §14.7)

Cheap to build and it will land hard, with Tippy and Arrow already in the game.

- [ ] Dogs age; after N seasons she slows (smaller bonus), then retires to the house
- [ ] A retired dog lies by the fire in the interior — the visible record of a run — and
      gives a small passive bonus
- [ ] A pup can be taken on; it starts weaker and learns
- [ ] One working dog at a time is still the rule; retired dogs do not count against the slot

### 2.5 People and events

The inn is the only social space and she is the only arc.

- [ ] **More beats in the courtship** between the second pint and the ring — she is the
      emotional spine of the game and has the fewest scenes
- [ ] **A neighbour** on the next hill — lends a hand, gossips, occasionally needs help
- [ ] **A travelling dealer** — sometimes has a rare breed or a tool at a price
- [ ] **The Highland show / a sheepdog trial** in late summer — enter your best ewe or your
      dog; a prize and a mid-run milestone
- [ ] **Letters from the life you left** — a few, spaced out; they give the opening's desk
      scene a thread to pull
- [ ] Events are seeded like everything else in the sim, so a save replays the same run

### 2.6 After she says aye

Decide whether the game ends at the win or carries on.

- [ ] Recommended: the win ends the story and rolls the proposal cinematic, then offers
      **"Stay on the hill"** — the run continues with her at the croft, seasons turning, the
      pelt on your back. Steam players often keep playing past an ending if the game lets
      them, and reviews notice when it does
- [ ] A final achievement or two for the long game (a tenth winter, a hundred lambs)

### 2.7 Replay and polish

- [ ] **Three save slots** rather than one
- [ ] **A dawn summary card** — what the night did, in one glance, before the day's first tap
- [ ] **A run history** in Settings: past runs, how they ended, on what day
- [ ] **Seeded runs** — share a seed; optionally a daily seed
- [ ] New achievements for the new systems (first lamb, a winter with no losses, a prize at
      the show, a retired dog by the fire)
- [ ] A pause menu reachable at any moment, not only between actions

---

## 3. Suggested order

Rough, for one developer working part-time. The Steam calendar items (fee wait, Coming Soon
page) run in parallel with the code.

| phase | what | branch | done when |
| --- | --- | --- | --- |
| **1. Foundations** | platform seam, bundled font, cheated flag | `steam` | no direct `localStorage` outside `platform/`; tests green |
| **2. Steam shell** | Electron, file saves, Steamworks, achievements, Quit/fullscreen | `steam` | a packaged build plays a full day and unlocks an achievement |
| **3. Business, started** | pay the fee, fill in tax/bank, start the 30-day clock | — | account active |
| **4. Input** | focus model, keyboard, gamepad, prompts, Steam Input config | `steam` | a full run on controller alone |
| **5. Seasons** | seasons, winter, hay; rebalance | `steam` | 90-day sims per difficulty within target |
| **6. Store page** | capsules, screenshots, copy, Coming Soon live | — | page approved and public |
| **7. Lambing + work** | tup, lambs, dyke, dipping, peat | `steam` | new sims; new achievements |
| **8. Demo** | demo flag; web demo; Steam demo; Next Fest if timing allows | `steam` | demo live with a wishlist link |
| **9. Characters** | dog ageing, neighbour, dealer, show, letters, courtship beats | `steam` | playtested |
| **10. Launch** | Deck testing, release build review, release | `steam` | out |

Phases 1–4 are the minimum for a Steam release of the game as it is today. Phases 5 and 7
are what make it worth the asking price. Phase 9 can be split: some before launch, some in
a post-launch update, which also gives the store page some news to post.

---

## 4. Open decisions

Like the spec's §14, these are flagged rather than settled:

1. **Price** — $6–10 depending on how much of §2 is in at launch
2. **Demo length** — 10 days is a guess; the right cap is "just after the first tool is
   bought and the first full moon has passed"
3. **Does the run continue after the win?** (§2.6)
4. **Retro interface on Steam** — hidden (recommended) or supported
5. **macOS** — worth the notarisation cost only if wishlists show demand
6. **Season length** — built at 24 days (three moons); a run is about two and a half years.
   Worth playtesting whether that feels long
7. **Does the pelt still end the fox game** once seasons exist, or does it become one
   season's peace?
8. **What Vercel serves** once Steam exists: the original from `main` (free, unchanged), the
   demo cut from `steam`, or nothing
