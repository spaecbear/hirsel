# Hirsel — build spec

A cozy 8-bit Scottish sheep farming game. Web-first, works on desktop and phone from
one codebase. You give up your job, take on a hill, and try to build a life on it.

A working prototype exists (`hirsel.html`, single file, ~1100 lines). **Read it before
starting.** Every number below is already tuned and playtested in it. Treat it as the
design reference and the balance source of truth, not as code to port — it is DOM
buttons and a hand-rolled canvas loop, deliberately throwaway.

---

## 1. What to build

A proper project, not a single file.

**Recommended stack** (deviate if you have a good reason, say so if you do):

- Vite + TypeScript
- Canvas 2D for the scene. Pixi.js is fine if the sprite count grows, but the whole
  game currently draws in a few hundred `fillRect` calls — don't reach for a renderer
  it doesn't need yet
- Plain state module or Zustand. No Redux
- No backend. Save to `localStorage`
- PWA manifest + service worker so it installs to a home screen
- Vitest for the simulation logic

**Hard requirements:**

- One codebase, desktop and mobile. Mobile is a first-class target, not a port
- Integer-scaled pixel art. Never let the browser interpolate the canvas
- Respect `prefers-reduced-motion` — collapse all animations to instant
- 60fps on a mid-range phone
- All audio synthesized at runtime via Web Audio (see §8)

---

## 2. Core loop

The day is the unit. You get a small number of taps, you choose what to spend them on,
you sleep, the night resolves, repeat.

**Taps per day:** 3 base, +1 with boots, +1 with lantern, +1 while the `hale` buff is
active. Maximum 6.

This tightness is the whole game. Three taps means move + gather + shear fills the day
and the cozy actions are locked behind money. Tools buy the day back. Do not loosen it.

**Day sequence:**

1. Spend taps on actions in any order
2. Buy from the steading at any point (purchases cost money, never taps)
3. Sleep → night resolves → new day

**Night resolution, in this order:**

1. Grazing and fleece growth
2. Dog auto-gathers if owned and not already gathered
3. Fox check
4. Flystrike check
5. Feed cost deducted
6. Grass regrowth on all pastures
7. Weather and moon advance, buffs decrement
8. Fail-state check

---

## 3. Actions

| id | Name | Tap cost | Effect |
|---|---|---|---|
| `move` | (tap a pasture) | 1 | Move flock. Resets `gatheredToday` |
| `gather` | Gather the flock | 1, **0 with crook** | Sets `gatheredToday`. ×0.35 fox risk |
| `shear` | Shear | 1 | Harvest all fleece ≥4. Blocked in rain and haar |
| `market` | Go to market | 1, **0 with cart** | Sell all wool at today's price |
| `tend` | Tend the flock | 1 | `tended` buff, 3 days. Prevents flystrike, ×1.1 growth |
| `muck` | Muck the pasture | 1 | +38 grass on current pasture. Only if grass ≤85 |
| `pipe` | Smoke a pipe | 1 | Free in money. `steady hands` 2 days: ×1.15 shear yield |
| `music` | Strike up the bagpipes | 1 | Free in money. `settled flock` 2 days: ×1.15 growth, ×0.85 fox risk |
| `pub` | A pint at the inn | 1 | **£8.** `hale` 3 days: +1 tap/day. Increments `pubs` |
| `ask` | Walk down and ask her | 1 | Requires ring + `pubs` ≥ 6. **Wins the game** |

Buff durations are set with `max(existing, n)` — they refresh, they don't stack.

---

## 4. Pastures

| Pasture | Feed quality | Fox risk | Regen/day | Grass cap |
|---|---|---|---|---|
| Low Field | ×0.8 | 10% | 5 | 100 |
| Hill Slope | ×1.0 | 20% | 4 | 100 |
| High Corrie | ×1.35 | 34% | 3 | 100 |

Grazing consumes `flock.length × 4` grass, capped at what's there.
`fed = eaten / (flock × 4)`. If `fed < 0.6`, warn the player the grass is thin.

Regrowth multipliers: rain ×2.2, sun ×1.2.

---

## 5. Weather and moon

Three-day forecast, visible to the player. This is what makes the game plannable
rather than reactive — do not hide it.

| Weather | Graze | Shearing | Fox bias |
|---|---|---|---|
| Sun | ×1.4 | yes | ×0.9 |
| Overcast | ×1.0 | yes | ×1.45 |
| Rain | ×0.7 | **no** | ×1.0 |
| Haar (mist) | ×0.9 | **no** | ×1.7 |

Draw weights: sun 2, overcast 2, rain 2, haar 1.

**Moon:** 8-day cycle. `phase = (day - 1) % 8`. Full moon at phase 4, so days
5, 13, 21, 29… Display the name in the HUD and on all three forecast days. Draw it at
its true phase, moving along an arc across the night sky as the cycle turns.

---

## 6. Sheep, wool, and threats

**Fleece value curve** — the central tension. Wool gains value, peaks, then rots:

```
fleece < 4    → f × 0.5          "short"
4 ≤ f < 9     → f × 1.0          "prime"
9 ≤ f < 12    → 9 - (f-9) × 1.2  "heavy"
f ≥ 12        → max(1, 5.4 - (f-12) × 1.1)  "matted"
```

Growth per night: `fed × pastureQuality × weatherGraze × settledBuff × tendedBuff × breed.growth`

**Breeds** (buyable repeatedly from the steading):

| Breed | Cost | Growth | Value | Colour |
|---|---|---|---|---|
| Scottish Blackface | £24 | ×1.00 | ×1.00 | cream fleece, black face |
| Cheviot | £38 | ×1.20 | ×1.05 | white fleece, pale face |
| Hebridean | £34 | ×0.85 | ×1.40 | near-black |
| Shetland | £54 | ×1.05 | ×1.60 | fawn |

Player starts with 6 Blackface, fleece randomised 2–5.

**Foxes.** Nightly roll:
```
risk = pastureRisk × weatherFoxBias
     × (gatheredToday ? 0.35 : 1)
     × (dog ? 0.6 : 1)
     × (settledFlock ? 0.85 : 1)
```
With the wolf pelt this is overridden to a flat **1%**.
On a hit, lose one sheep — but **remove it only after the raid animation finishes.**
Seeing the counter drop before the fox arrives was a real complaint in playtest.

**Flystrike.** If any sheep has fleece ≥11, `tended` is not active, and it isn't
raining: 30% chance to lose the heaviest-fleeced sheep. This is what stops the player
hoarding fleece indefinitely, and it's authentic husbandry.

**Feed cost.** `ceil(flock.length / 2)` pounds every night.

**Market price.** `round(62 + sin(day × 1.7) × cos(day × 0.6) × 32)` pence per stone.
Roughly 30–95p. Stable within a day, so the player can choose to hold wool.

---

## 7. Progression

**Tools** (one of each):

| Item | Cost | Effect |
|---|---|---|
| Shepherd's crook | £18 | Gathering costs no tap |
| Stout boots | £26 | +1 tap/day |
| Blade shears | £32 | ×1.2 shear yield |
| Storm lantern | £44 | +1 tap/day |
| Shetland sheepdog | £58 | Auto-gathers nightly, ×0.6 fox risk |
| Pony and cart | £74 | Market costs no tap |
| Brass pocket watch | £165 | Record and replay a day (§9) |
| Highland broadsword | £185 | **Described as pure decoration. Secretly essential.** |

The sword's description must give nothing away. Current wording:
*"Hangs well above the fire. Bonny thing. Not much use for keeping foxes off, mind."*

**The croft** — the long goal, strictly sequential:

| Milestone | Cost | Unlocks |
|---|---|---|
| Slate the cottage roof | £240 | — |
| Build up the hearth | £330 | after roof |
| Raise a stone byre | £420 | after hearth |
| A silver ring, Inverness | £520 | after byre |

£1510 total.

**Win condition.** The `ask` action requires **all four croft milestones built** and
6+ pub visits. Taking it ends the game with a win screen reporting flock size and days
survived. The action's description names the next missing piece, so the player is never
guessing what's left.

She asks for the croft herself. From the second pub visit onward, each pint surfaces a
line about whatever is still missing — the roof letting rain in, a house with no proper
fire being four walls and a draught, nowhere to put the flock in bad weather — and once
it's all built, she simply stops asking. The requirement is diegetic, not a checklist.

The pub is doing four jobs at once — a gamble on a tap, a route to the wolf, the entire
courtship, and the delivery mechanism for the croft goals. Keep this. It's the best
thing in the design.

**Fail states.** Flock reaches 0, or money goes below 0.

---

## 8. The secret boss — the last wolf

Wolves were hunted out of Scotland around the 1680s. This is the last one.

**Summon conditions, all simultaneously:**

- Own crook **and** boots (the sword is *not* required to summon)
- Standing on the High Corrie
- Full moon
- Have taken **5 actions** that day
- Flock not empty

Fires the instant the fifth action is spent. No prompt, no confirmation.

Note the tap arithmetic: 3 base + boots = 4, so reaching 5 actions requires either the
lantern or a pint that day. Two routes, one of them the pub. This is deliberate.

**With the sword:** you win. Gain the **last wolf's pelt** → fox risk drops to a flat
1% forever. Six-second set piece: huge low moon, wolf on the skyline with gold eyes,
sword raised catching moonlight, white clash frame, shepherd standing with the pelt.

**Without the sword:** the flock is reduced to **one surviving ewe**. The wolf can be
summoned again on a later full moon.

**This must be telegraphed.** Two warnings, neither mentioning a wolf:

1. Dawn of every full moon: *"Full moon tonight. The high ground is no place to be
   caught out late."*
2. On the corrie, on the **fourth** action — one tap still in hand, so escape is
   possible: *"The flock will not settle. Something is watching from above the corrie."*

A player who ignores both earned it. A player with no warning was mugged. Keep both.

---

## 9. The pocket watch

Buy it, tap "Set the watch", and it records every action and pasture move you make
that day. Recording stops at sleep. From then on, "Run the day by the watch" replays
the sequence with full animations, skipping anything that can't be done that day
(shearing in rain, mucking a full pasture, anything you can't afford the taps for).
"Set the watch again" re-records.

**Open concern:** this may be solving a problem that no longer exists. It was added
when the event log was buried in a tab and the game read as numbers going up. Now that
recent events surface inline, the day may not want skipping. Watch for players tapping
the watch and sleeping ten days straight. If that happens, cap the routine at 3–4
recorded turns so it handles chores and leaves decisions alone.

---

## 10. Interface

**Desktop:** everything visible at once — HUD, scene, actions, pastures, steading, log.
Hover for sheep detail (breed, fleece grade, age).

**Mobile:** four tabs — Day, Land, Steading, Glen. HUD + scene + tab bar lock together
as one sticky header; only the panel scrolls beneath it. Do not create two separate
sticky elements at `top: 0` — they collide, which was a real bug.

**Critical:** the last three log lines appear inline at the top of the Day panel,
newest at full brightness with a brief flash, older ones dimmed. The narration is most
of this game's character, and when it lived only in a separate tab, mobile players
never saw it. After sleeping, mobile switches to the Glen tab automatically — the
night is the one moment the full log is genuinely the content.

**Palette** (peat and heather, deliberately not the default warm-neutral look):

```
--peat    #14170f    --peat-2  #1e2317
--moss    #3c4a2e    --grass   #7d9a55
--heather #8a6a9c    --gorse   #e0a33c
--wool    #ddd9c8    --stone   #6d7263
--fox     #b4472c    --ink     #0b0d08
```

Monospace type, wide letter-spacing on headings, uppercase small-caps labels.

**Touch:** 46px minimum targets, suppress tap highlight and double-tap zoom, disable
overscroll, honour safe-area insets.

---

## 11. Animations

Every action gets a set piece. Buttons lock while one plays. They need a completion
callback and a queue — the fox raid runs *after* the night animation, and the routine
player chains actions off animation completion.

`gather` `shear` `market` `tend` `muck` `pipe` `music` `pub` `move` `sleep`
`buysheep` `fox` `wolf` `wolflost`

Notable ones: the pub leaves the pasture entirely for a dark room with a fire and a
pint filling — that's what makes an £8 pint feel like an event. The fox raid darkens
to night and the flock scatters based on proximity. Sleep runs dusk → stars → moon at
true phase → dawn.

A persistent shepherd sprite works the field. The sheepdog is tricolour — black
saddle, tan points, white blaze, ruff, socks and tail tip — and must remain visible
during the night animation.

---

## 12. Audio

All synthesized via Web Audio. No audio files. Start on first user gesture, with a
visible on/off toggle.

**Score:** generative, D Dorian, 68bpm. Drone on D/A shifting every 4 bars, sparse
plucked pentatonic melody above it (three detuned voices under a fast decay), soft
bodhrán-like pulse, convolution reverb from decaying noise, lowpass roll-off, slow
pitch wobble for tape feel. Reacts to state: night thins the melody and darkens the
drone, rain thins it further.

**Effects,** one per animation: bleat, shears, cartwheels, coins, fox yip, dog bark,
bagpipe drone, pub murmur, sword ring, wolf howl, purchase chime, wind.

**Worth knowing:** the owner plays guitar and banjo and writes songs. The generative
score is a good reactive layer and a good fallback, but the main theme is a candidate
for real recorded playing. Structure the audio module so a recorded loop can be
dropped in alongside the synth layer rather than replacing the whole system.

---

## 13. Currently in test mode

Starting money is **£1000** for testing, with a note in the opening log. Ship value is
**£40**. Make this a config flag rather than a magic number.

---

## 14. Known open questions

Don't silently resolve these. Build them as tunable config and flag them.

1. **Opening difficulty.** At £40, does the player reach the crook before losing
   interest? If it takes more than ~15 days, raise starting money rather than taps.
2. **Crook vs dog overlap.** Both address gathering. Does buying the crook feel wasted
   once the dog exists?
3. **One ewe after a wolf mauling** may be unrecoverable, since restocking costs money
   that comes from wool you no longer have. Consider leaving two.
4. **The wolf punishes the two best early purchases** (crook and boots), so the danger
   window lands exactly when a new player feels safe. Either excellent or infuriating.
5. **The pelt ends the fox game entirely.** Pasture choice, gathering and the dog all
   stop mattering. Fine as a victory lap, but if the game should continue afterward,
   seasons need to carry the tension instead.
6. **Seasons are designed but not built.** Spring lambing, summer shearing, autumn
   market, winter survival where nothing grows. This is the obvious next system and
   the answer to (5). Build the day loop so a season layer can sit on top.
7. **Dog ageing and retirement.** Dogs should age and retire to live in the house
   rather than dying — retired dogs by the fire as a visible record of survival, with
   a small passive bonus. Designed, not built.

---

## 15. What not to do

- Don't port the prototype's DOM-button architecture. Rebuild it properly
- Don't add taps to make it friendlier. The scarcity *is* the game
- Don't explain the sword, the wolf, or the summon conditions anywhere in the UI
- Don't cut the warning messages to make the wolf more surprising
- Don't let the cozy actions become free. They compete with work — that's the point
- Don't use localStorage for anything until the save system is deliberately designed
