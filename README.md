# Hirsel

A cozy 8-bit Scottish sheep farming game. You give up your job, take on a hill, and try to
build a life on it. Web-first, one codebase for desktop and phone, no backend.

*A hirsel is the stretch of hill one shepherd and one dog can work, and the flock that lives on it.*

## Running it

```bash
npm install
npm run dev
```

| script | what it does |
| --- | --- |
| `npm run dev` | Vite dev server on **:5313** |
| `npm run build` | typecheck, then production build to `dist/` |
| `npm run preview` | serve the built output |
| `npm test` | Vitest over the simulation |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/make-icons.mjs` | regenerate the PWA PNG icons from the pixel design |

### Why port 5313 and not 5173

`localhost:5173` is a single origin shared by every Vite project on a machine, and service
workers, caches and `localStorage` are all scoped per origin. A worker left behind by another
project will happily serve this one a stale page — which presents as "my changes aren't showing
up". Hirsel gets its own port, with `strictPort` so a clash fails loudly instead of quietly
moving to 5174 and showing you somebody else's app.

Consequence worth knowing: saves live in `localStorage`, so a run started on a different port
won't appear on this one. Settings → Export file moves a run between origins.

## Deploying to Vercel

It is a static Vite build with no server side. Import the repo in Vercel and it will detect
the framework; `vercel.json` pins the settings either way. If the repo root is this folder,
nothing else is needed. If you keep it inside a parent folder, set the Vercel **Root Directory**
to `hirsel`.

## Layout

```
src/
  sim/        the game itself — no DOM, no canvas, fully testable
    config.ts   every tuned number, and the §14 open questions as flags
    rules.ts    pure functions: grading, moon, fox risk, wolf conditions
    game.ts     state machine: actions, the night, the watch, the wolf
    save.ts     versioned save slot + export/import
    cheats.ts   the codes in the settings menu
    glossary.ts what each buff/status does, in Settings — built from BALANCE,
                not a second hand-written copy of the numbers
  ui/
    world-ui.ts    playing by touching the hill: hotspots and sheets
    walk.ts        hold the pasture and he walks over
    sky-feed.ts    the log, drifting up the sky and fading
  render/     canvas: integer scaling, animation queue, two interfaces
    layout.ts      where everything in the glen sits, for any screen shape,
                   and the tap targets — art and hit-testing share it
    sprites.ts     every sprite, shared by both interfaces
    text.ts        pixel type: rendered at 1x, threshold-hardened, blitted
    art/glen.ts    the full-screen scene you play in
    art/hirsel.ts  the older panelled scene (the retro interface)
  audio/      Web Audio: written tunes, rain, one effect per animation
test/         Vitest over sim/
```

## Starting a run

A title screen, and then the day you walked out: three beats — the desk you are leaving, the
door, and the hill you are climbing. It is the only time the game shows you anywhere but the
glen, which is the point. It plays on a new run only, is skipped under reduced motion, and
never plays when continuing a save.

## The first day

A brand new player gets a walkthrough: the day's taps are switched off, the flock starts one
short at the ordinary £40, and each step points at a thing to tap and waits until they have
done it.

**The sixth ewe is earned, not given.** The order is gather → shear → sell → buy, and the
first clip is rigged to pay for exactly one Blackface: `tutorialSetup` works backwards from
the ewe's price through day one's fixed market rate to the number of stone needed, then
spreads that across the flock inside the "prime" band. Being handed the money taught nothing;
earning it in the first three steps teaches the whole economy — fleece becomes wool, wool
becomes money, money becomes another beast — before anything is asked of the player.

It teaches the loop, the fleece value curve, matting, the weather that blocks shearing, tools,
the house, the night, and **both ways a run ends badly**. It teaches nothing about how one ends
*well* — no croft goal, no ring, no her, and nothing whatsoever about the sword or the high
ground on a full moon. `tutorial.test.ts` asserts that, with a word-boundary check over every
line of the script, so a future edit cannot quietly leak a secret into the opening.

Two things it must keep doing, both learned the hard way:

- **Steps latch.** Conditions describe a moment of *becoming* done, and live state comes
  undone: moving the flock clears `gatheredToday`, which sent the walkthrough back to "gather
  them in" and looped it there.
- **A skipped step is retired, not deferred.** Shearing skips itself when nothing is ready, but
  fleece grows overnight — so it un-skipped and reappeared on day two telling the player to
  shear. Passing a step retires it for good.

Settings → The game → **Replay the first day** starts a fresh run with the walkthrough on, for
anyone who skipped it or wants to see it again.

**The walkthrough locks the scene to its lesson.** Prompted to shear, you could tap the house
instead, sleep the day away, and the lesson never happened — the run carried on with the
walkthrough still pointing at the flock. `allowsInteraction` now answers for exactly one
target at a time, a refused tap nudges the prompt rather than saying nothing, and wandering
is off for the duration. Two things stay open regardless: the door, so nobody is ever shut
inside the house, and the house itself when the lesson is the bed, so someone who stepped out
can get back in.

Every step still keeps its skip guard even though day one is rigged: nothing should be able to
park a new player on a step the weather or an empty hill has made impossible.

The first day's weather is forced fair. Shearing and selling are the whole economy, and with
rain rolled for day one the walkthrough skipped both — a new player could finish it never
having been shown where money comes from. Everything after day one is as random as ever.

## Two interfaces

**Glen** (default) is the full-screen scene. The canvas is the whole game: you work the hill
by touching the things in it, and the narration surfaces in the sky rather than in a panel.

| tap | what opens |
| --- | --- |
| a sheep | gather, shear, tend |
| open grass | the pasture's own work (muck) |
| yourself | the comforts — pipe, pipes, pint, the ask — and the pocket watch |
| the croft | the four croft milestones, and sleeping the night |
| the cart | sell wool, sell a beast, buy stock, buy tools |
| the hills | which pasture to graze |
| the sky | the three-day forecast, the moon, what's running in you, recent word |

The door out of the house carries a standing **OUT** label. Hover labels only exist on a
mouse, so on a phone the way back to the hill was invisible — you had to guess the door was
tappable.

Tapping the croft **goes inside it**. Everything bought is on the wall or by the fire — the
broadsword above the hearth exactly as its description says, the dog stretched out in front of
it, the ring on the mantel — because a croft you are paying for should be somewhere you stand,
not a row of ticks in a shop. **You sleep by going to the bed**, which is why the interior
exists at all.

**Hold** a finger on open ground and he walks there. It costs no tap and touches nothing in
the sim — a hill you can only look at reads as a menu; one you can wander reads as a place.
The position deliberately lives in `ui/walk.ts` rather than the game state, so it is never
something a save has to carry or a player can lose progress over.

**Retro** is the older panelled build — HUD, small scene, tabs, sub-tabs. Kept whole rather
than deleted: it is the version that was balanced and playtested. Settings → Look → Interface,
or the `RETRO` code.

### Three pastures, three places

They used to be one hillside in three tints, which made moving the flock a number change
rather than a journey. `render/terrain.ts` draws each from somewhere real:

| | drawn from | what you see |
| --- | --- | --- |
| Low Field | Rannoch Moor | wet bog, a burn winding through tussocks and rushes, peat pools, cloud sitting down on the tops |
| Hill Slope | a glen in heather | purple banks, and ridge behind ridge going back into haze |
| High Corrie | the Quiraing | tawny gold grass over stepped rock terraces, the land dropped away, a great deal of sky |

Atmospheric perspective does the work on the slope: each ridge is mixed further toward the sky
colour, which is what makes distance read rather than just stacking silhouettes.

### The sky

Flat bands with a dithered seam at each join, rather than dithering every row. `paintSkyBands`
is shared by the glen and the opening — the intro kept its own copy of the old row dither, so
the sky the game opened on did not match the sky it then played in. Mixing the
whole sky produced a field of horizontal dashes that read as scan lines over the top half of
the screen — the noise was louder than the picture, and it made the narration unreadable.
Ordered dither belongs at the joins, where it blends two flat colours. Cloud is drawn as
shapes with a lit top edge and a ragged dithered underside; haar is deliberately flat and
featureless, because that is the character of it.

Heather is stippled, never blocked out. Drawn as rectangles with a lit top edge and a dark
bottom it was built exactly like the scree in the same file, and read as purple rocks lying on
the grass — a player said so. It is a soft mat now: a dark woody base with bloom speckled over
it in banks, so there is no silhouette to mistake for a stone.

Sky messages carry a dark backing plate — over open sky bare text was fine, but over cloud, a
hillside or the moon it disappeared.

**The HUD and the two cutscene lines are DOM text, not canvas pixels.** The bitmap font renders at 7px and
is hardened to 1-bit, and no amount of backing plate made those readable; they are the only
words in the opening and they carry the whole reason the run is happening, so they get the same
crisp text as the Sound and Settings chips. `updateCaption` in `main.ts` drives the captions
off the animation's progress; `WorldUi.drawHud` writes the top strip.

**Everything the player reads is DOM text.** The canvas draws the world; the words about the
world are text over the top of it. That covers the HUD, the narration drifting over the hill,
the hover hint, the cutscene lines, the walkthrough and every sheet.

This took four rounds of "I still can't read that" to land, so it is worth stating plainly:
the pixel font was a mistake for anything longer than a word. It rendered at 7px and was
hard-thresholded to 1-bit, which no backing plate could rescue. `render/text.ts` has been
deleted rather than left lying around for someone to reach for again — if a future feature
wants text on the hill, it wants a DOM element positioned over the canvas, not a bitmap font.

The walkthrough is suspended for the length of the opening, so its first prompt lands when he
has actually arrived on the hill rather than over the top of the cutscene. Over open sky bare text was fine, but over cloud, a
hillside or the moon it disappeared — and it is the game's whole voice.

The HUD offsets itself by the top safe-area inset, measured from a zero-size probe element,
since the glen canvas runs full-bleed under the notch and status bar.

### Built for the shape of the screen

The glen has no fixed resolution. `render/screen.ts` picks a whole-number scale first (aiming
at a narrower logical width in portrait, so a phone is closer to the hill) and the logical size
falls out of it, which keeps the pixel grid honest at any viewport. `render/layout.ts` then
composes for the orientation: landscape gets a wide vista with the croft at one end and the
cart at the other; portrait gets a hillside receding upward with more rows of sheep in depth.
**The horizon also moves with the pasture** — the Low Field is hemmed in by hills, the High
Corrie is mostly sky, because standing higher means seeing further.

Two things that were bugs and are now rules:

- **Sky and hills must not overlap as hotspots.** Whichever is listed first swallows every tap
  meant for the other.
- **The flock is many small targets, not one box.** As a single bounding box it covered the
  whole field, so tapping grass between two sheep opened flock work and the pasture's own work
  was unreachable. Each animal is its own target and the gaps fall through to the ground —
  measured at 73% of the field reaching the pasture, 9% the sheep.

### Finishing a run

Marrying reveals a cheat code you did not have, for the next run — one per win, and `1680`
is held back until every other code is known, since it is the only one that gives the wolf
away. `revealNextCheat` is tested for exactly that ordering.

### The hill is alive

`render/wander.ts`. Sheep and the dog drift around their marks and edge towards the shepherd
when he is near — each on its own rhythm, from a hash of its id, so the flock does not sway in
unison. It is computed from the clock and needs no state, so it survives a reload and cannot
desync from the simulation, which never sees it.

The shepherd has idle ticks from the same file: he takes his bunnet off and wipes his brow,
stretches, or turns and looks out over the hill — about one minute in six, and only when he is
genuinely idle, never mid-animation or walking. At 13 seconds apart it read as fidgeting.

**Nothing here touches the sim.** If a future change wants animals to actually move between
pastures, that belongs in `sim/`, not in this file.

### Facing

`drawShepherd` takes `facing` (1, -1 or 0) and mirrors the whole sprite about its own width.
Square-on he shows two eyes, which read as "looking at you" whatever he was doing — including
squaring up to a wolf coming down the hill. In profile he shows one eye and the bunnet's peak
leads. `back` is a third view, used for the intro's climb.

One trap worth knowing: the sprite mirrors about `SHEPHERD_SPAN / 2`, so **anything drawn at
that midpoint lands back on itself**. The profile eye sat there at first and he looked
identical turned either way. Verified by rendering the sprite offscreen and reading the eye
pixel's x, not by eye.

### The inn

The one room in the game with other people in it: the landlord behind the bar and the lass
with her tray — the one the croft is quietly being built for, drawn to be recognised, since
by the sixth pint the writing assumes you know who is being talked about.

Everyone in there is sized from the room rather than drawn at a fixed size, because the canvas
has no fixed resolution. Two things learned building it: a figure is **mostly leg with a small
head** (roughly 18/42/40, and never more than a third as wide as it is tall) — blocked out at
half its height wide it reads as furniture, not a person. And the two at the near side are
drawn taller than the landlord: at the same height their heads sat against the dark bar front
where nothing could be made out.

### The dog and the instrument are slots

One dog, ever, and one instrument. A hirsel *is* the ground one shepherd and one dog can work
— the game is named after the constraint — and letting both be owned would compound the
deterrents to ×0.51 and quietly delete the fox, while owning both instruments would turn a
choice of playing style into a shopping list. `Game.slotTaken` refuses the second, and the
cart shows the closed option with the reason rather than hiding it.

They are **sidegrades at one price**, not upgrades. Measured over 60 seeded 30-day runs on one
fixed policy:

| | median purse | sheep lost / run |
| --- | --- | --- |
| no dog | £64 | 1.25 |
| Shetland sheepdog | £66 | 0.73 |
| Border collie | £71 | 0.93 |
| pipes (free) | £77 | 0.97 |
| fiddle | £89 | 1.25 |

A sheep costs £24 and up, so in both pairs the productive pick's extra income is roughly paid
for by the extra animal it fails to save. The choice is flock safety against income, not a
better and a worse option — `collieFoxBias` was 0.75 first, which left the collie ahead on
both counts, and 0.9 made her not worth having.

**The bark is the dog's receipt.** Her whole worth is the raids that never happen, which meant
£58 bought something the player could never once see. When the night's roll would have got in
without her and misses with her, she gets the credit out loud.

### Design invariants

Things that are easy to break by accident:

- **Three taps is the game.** Tools buy the day back; nothing else should loosen it.
- **The fox takes its sheep only after the raid animation ends.** Same for the wolf mauling.
  Watching the counter drop before the animal arrives was a real playtest complaint.
- **Which sheep the fox takes is chance, not position.** It used to be `flock.pop()` — the
  array's last element, which is always the most recently bought ewe, since `buyEwe` appends.
  A player reported replacing a stolen sheep only to have the fox take the replacement next,
  every time; it wasn't bad luck, it was the code. Fixed to a uniform pick via the seeded rng
  at the moment the raid lands. `flystrikeExposed` staying targeted at the heaviest fleece is
  correct and unrelated — the spec calls that out by name as the mechanic that stops hoarding
  fleece; it never said anything of the kind about the fox.
- **The sword, the wolf and the summon conditions are never explained in the UI.**
  Not in tooltips, not in achievements (those two are hidden), not in cheat codes. The pelt
  is the exception the player earns: once taken, the shepherd wears it in every scene.
- **Both wolf warnings stay.** Dawn of the full moon, and the fourth action on the corrie
  with one tap still in hand.
- **`test/setup.ts` installs a real in-memory `localStorage` for every test run, unconditionally.**
  This machine's Node has a global `localStorage` that exists but is broken — a bare `{}`
  with no methods, downstream of the experimental `--localstorage-file` flag pointing nowhere
  valid. `saveEarned`/`saveSettings`/`saveGame` all swallow storage errors on purpose (a failed
  save shouldn't crash the game), so a broken global fails silently: a test can call
  `saveEarned(["pelt"])`, get no error, and read an empty array back. Found via the glossary
  appendix's own test for the pelt reveal — trust the polyfill, not the host's Node build.
- **The three-day forecast is public.** It is what makes the game plannable.
- **Autosave writes at the end of a night only** — never mid-day, never mid-animation.
- **`showEnd` must stay idempotent.** It writes settings (the revealed code), which triggers a
  render, which is one of the things that raises it — without the guard a single win recursed
  through the whole cheat list and handed over every code at once.
- **A run can end with no animation playing** (selling the last beast at the cart). The end
  screen is raised from the render signal as well as from the animator going idle, or those
  endings leave the game quietly over with nothing on screen.
- **Nothing grazes through a wall.** Sheep laid out on top of the croft or the cart looked
  like they were standing on the roof; the layout nudges them clear.
- **Sleep is pinned above the action lists**, so the day can always be ended without
  scrolling. The ten actions are split into Work / Comforts sub-tabs to keep each list short.

### Audio

Everything is synthesized at runtime — there are no audio files anywhere in the project.

The soundtrack is a written tune, not a random walk: **The Hirsel**, a slow air in D Dorian at
68bpm, in `src/audio/tunes.ts` as note data. It moves between D and C rather than D and A —
the double tonic, which is the most Scottish thing you can do to a tune. `tunes.test.ts`
checks every bar fills exactly and every pitch is in the mode, so a mistyped duration fails
the suite instead of quietly knocking the tune out of time.

There is a second tune. With the `TOD` code on — foxes kept, sheep coming off the hill — the
score switches to **The Tod**, written in the idiom of the old folk song about the fox that
goes out on a chilly night: a 6/8 lilt, brisk and loping, in D mixolydian with the flat
seventh doing the work. It is an original tune, not that one: the traditional melody is public
domain but every recorded arrangement of it belongs to somebody, so this way the tune is ours.
Everything about it is the opposite of the air — compound time instead of four, a major third
instead of a minor one, and a bar going by in 1.2s against the air's 3.5s.

Metre-specific things (the harp's chord shapes, its spacing, which beats the drum lands on)
live on the tune, not in the sequencer, so a tune in 6/8 doesn't get a 4/4 backbeat.

`score.ts` sequences whichever is loaded a bar at a time and picks the arrangement from the
game state:

| | melody | accompaniment |
| --- | --- | --- |
| day | whistle, with cuts | harp arpeggios, drone, low bodhrán pulse |
| night | harp, an octave down | drone an octave down, no pulse, no ornaments |
| rain | whistle, softer | drone and pulse only |

**Note for future edits:** do not add a quiet, short, high-frequency layer on a fixed
subdivision. An earlier version pinged a 1.9kHz bandpassed noise burst on beat three of every
bar, and a faint periodic high ping is indistinguishable from an audio watermark. The pulse is
a low bodhrán thud for that reason.

Two cues take the glen over when they fire, ducking the air out through its own bus and
bringing it back afterwards: the **wolf** (D against A flat — the tritone, about as far from a
Dorian air as two notes get — over a heartbeat that quickens as he comes down the hill) and the
**fox** (tense rather than evil: the tonic with a minor second rubbing against it, and four
clipped notes falling). They are triggered from the animation, not the game state.

The engine exposes `setRecordedBed(buffer)`, which plays a recorded loop on the same music bus
with the same reverb and tape roll-off — a real recorded theme drops in *alongside* the synth
layer rather than replacing the system.

### Rain

`src/audio/rain.ts`. A steady lowpass-filtered noise hush, plus individual drip ticks layered
over it, both generated at runtime — no files. Fades in and out over 1.4s as the day's weather
changes, driven by the same `forecast[0] === "rain"` check the score already uses to thin
itself, and routed through the existing `sfxBus` so the Effects slider and Mute already
control it without a new setting.

The drips are short and high-frequency, which is the exact shape that read as a watermark last
time (see the pulse note above) — the difference is the schedule. Each drip's timing is drawn
from a randomised interval (`DRIP_MIN_GAP + random × DRIP_JITTER`), never a fixed subdivision.
`AudioEngine.noiseBed()` is the reusable piece — a persistent looping filtered-noise source
whose gain the caller fades — so a future ambience layer (wind for the haar, the burn in
spate) can reuse it rather than growing its own noise-loop plumbing.

### Buffs & status appendix

Settings → Buffs & status. The HUD only ever shows a buff as `tended (3d)` — this is where
"tended" gets explained. `src/sim/glossary.ts` builds the four buff entries and two status
entries (Gathered, and the pelt) from the live `BALANCE` constants rather than a hand-written
second copy of the numbers, so a future tuning pass can't leave it describing a game that no
longer exists — the same discipline as the market-price fix.

The pelt entry stays masked as `?????` until the `pelt` achievement has ever been earned
(checked via the same `loadEarned()` the Achievements section already reads), matching the
design invariant above: nothing about the wolf is explained before it's earned. Once revealed
it names the ground and the moon, matching the existing owned-pelt shop tile — a place and a
time, not the summon recipe. `glossary.test.ts` pins that distinction directly: it asserts the
revealed text never contains `crook`, `boots`, `sword`, `five action`, or `summon`, while a
separate test confirms mentioning the crook's ordinary, already-public effect elsewhere (the
Gathered entry) is fine — the rule is "never state the trigger," not "never say the word."

Buffs refresh rather than stack — see `Game.buff()` below.

### Buffs don't stack

`Game.buff(id, days)` is `Math.max(existing, days)`, always. Playing the bagpipes twice in one
day does not double the fox-risk reduction or extend past `cozyBuffDays` — the second pipe
just re-confirms the same 2 days already running. This is spec behaviour (§3: "Buff durations
are set with `max(existing, n)` — they refresh, they don't stack"), and every temporary buff
(`tended`, `steady hands`, `settled flock`, `hale`) goes through the same one method, so there's
no per-buff special case to accidentally get wrong.

### Cheat codes

Settings → Cheat codes. `RETRO`, `SILLER`, `TOD`, `HIRSEL`, `LANGDAY`, `HAAR`, `1680`.

A code stays found for good — `cheatsFound` lives in settings, not the save file — and every
found code becomes a button in that list, so later runs work them from the menu instead of
retyping. `RETRO` and `TOD` hold state and show `on`/`off`; the rest are one-shots marked `use`.

Codes show as `?????` until entered, which is what keeps `1680` from giving the secret away
to a player who hasn't gone looking for it. It summons the wolf with none of the real
conditions met — but what happens when he arrives is unchanged, and still decided by whether
the broadsword is on the wall. The flock is still not cut until the animation has played.
`TOD` turns the glen over: you keep foxes, and it is sheep that come off the hill at night.
The simulation is untouched — only the words and the sprites swap.

### Tools beyond the spec

Two additions, both chosen to add a decision without touching the tap economy:

- **Salt lick** (£28) — the flock takes a quarter less grass for the same growth, which makes
  thin ground and the High Corrie survivable for longer.
- **Waxed oilskin** (£36) — lets you shear through a haar. Rain is still rain, so it converts
  one of the two dead weather types into a working day rather than both.

### Open questions

`src/sim/config.ts` → `OPEN_QUESTIONS` holds the ones the design doc flagged, at their
current values, with notes. Change them there rather than hunting for numbers:

1. opening difficulty at £40 (`startMoney`) — now the live default, so this one is under test
2. crook vs dog overlap — no flag, needs playtest data
3. survivors after a wolf mauling (`survivorsAfterWolf`, currently 1)
4. the wolf punishing the two best early purchases — by design, watch it
5. the pelt ending the fox game — fine as a victory lap, seasons are the answer
6. seasons — not built. The day loop is structured so a season layer can sit on top
7. dog ageing and retirement — not built; `Sheep.age` exists as the pattern to follow

### Starting money

£40, the ship value, with no test mode. The spec's §13 £1000 test purse has been removed
along with its settings toggle — testing is done with the `SILLER` code (+£500), which keeps
one code path through the opening instead of two.

The number lives in `OPEN_QUESTIONS.startMoney`. It is open question §14.1: if reaching the
crook takes more than about fifteen days, raise this. Never hand out taps — the scarcity is
the game.

### Market price — raised after a player report

The spec's 62±32p (30–95p) was simulated headlessly: a modest, tool-free policy across 40
seeded 30-day runs came out with a **median final purse of £40** — flat against the £40
start — and a **worst case of £2**, one bad-weather streak from starving. That matched a
direct report ("a run of rain and I can't get to market before I starve"). Rain and haar
together are ~43% of days in `WEATHER_BAG`, so a multi-day dead streak isn't a tail case; the
per-sheep margin over feed has to survive it, not just the average day.

Raised to **80±34p (46–114p)** (`BALANCE.marketBase` / `marketSwing`). Same simulation: median
final £63, worst case £21, zero busts. The reasoning is written next to the constants in
`config.ts` rather than only here, since that's where the next tuning pass will be looking.
