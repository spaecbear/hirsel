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
  render/     canvas: integer scaling, animation queue, two art packs
    art/hirsel.ts  the default scene
    art/og.ts      the original prototype scene, ported faithfully
  audio/      Web Audio: generative score, one effect per animation
  ui/         panels, HUD, settings
test/         Vitest over sim/
```

### Design invariants

Things that are easy to break by accident:

- **Three taps is the game.** Tools buy the day back; nothing else should loosen it.
- **The fox takes its sheep only after the raid animation ends.** Same for the wolf mauling.
  Watching the counter drop before the animal arrives was a real playtest complaint.
- **The sword, the wolf and the summon conditions are never explained in the UI.**
  Not in tooltips, not in achievements (those two are hidden), not in cheat codes.
- **Both wolf warnings stay.** Dawn of the full moon, and the fourth action on the corrie
  with one tap still in hand.
- **The three-day forecast is public.** It is what makes the game plannable.
- **Autosave writes at the end of a night only** — never mid-day, never mid-animation.
- **Sleep is pinned above the action lists**, so the day can always be ended without
  scrolling. The ten actions are split into Work / Comforts sub-tabs to keep each list short.

### Art packs

Two looks. The switch in Settings → Look is hidden until the `RETRO` code has been entered;
before that, the retro scene isn't mentioned in the UI at all.

- **Hirsel** (default): the croft is in the scene and gets built as you buy it — roof, smoke
  from the hearth, the byre, a lit window at night. Each pasture is its own place. Sheep graze,
  lift their heads and cast shadows, and fleece changes their silhouette.
- **Retro (OG)**: the original single-file prototype's scene, ported unchanged.

Adding a third is one file implementing `ArtPack` in `src/render/art/`.

### Audio

Everything is synthesized at runtime — there are no audio files anywhere in the project.

The soundtrack is a written tune, not a random walk: **The Hirsel**, a slow air in D Dorian at
68bpm, in `src/audio/tunes.ts` as note data. It moves between D and C rather than D and A —
the double tonic, which is the most Scottish thing you can do to a tune. `tunes.test.ts`
checks every bar fills exactly and every pitch is in the mode, so a mistyped duration fails
the suite instead of quietly knocking the tune out of time.

`score.ts` sequences it a bar at a time and picks the arrangement from the game state:

| | melody | accompaniment |
| --- | --- | --- |
| day | whistle, with cuts | harp arpeggios, drone, low bodhrán pulse |
| night | harp, an octave down | drone an octave down, no pulse, no ornaments |
| rain | whistle, softer | drone and pulse only |

**Note for future edits:** do not add a quiet, short, high-frequency layer on a fixed
subdivision. An earlier version pinged a 1.9kHz bandpassed noise burst on beat three of every
bar, and a faint periodic high ping is indistinguishable from an audio watermark. The pulse is
a low bodhrán thud for that reason.

The engine exposes `setRecordedBed(buffer)`, which plays a recorded loop on the same music bus
with the same reverb and tape roll-off — a real recorded theme drops in *alongside* the synth
layer rather than replacing the system.

### Cheat codes

Settings → Cheat codes. `RETRO`, `SILLER`, `TOD`, `HIRSEL`, `LANGDAY`, `HAAR`, `1680`.

Codes show as `?????` until entered, which is what keeps `1680` from giving the secret away
to a player who hasn't gone looking for it. It summons the wolf with none of the real
conditions met — but what happens when he arrives is unchanged, and still decided by whether
the broadsword is on the wall. The flock is still not cut until the animation has played.
`TOD` turns the glen over: you keep foxes, and it is sheep that come off the hill at night.
The simulation is untouched — only the words and the sprites swap.

### Open questions

`src/sim/config.ts` → `OPEN_QUESTIONS` holds the ones the design doc flagged, at their
current values, with notes. Change them there rather than hunting for numbers:

1. opening difficulty at £40 (`startMoneyShip`)
2. crook vs dog overlap — no flag, needs playtest data
3. survivors after a wolf mauling (`survivorsAfterWolf`, currently 1)
4. the wolf punishing the two best early purchases — by design, watch it
5. the pelt ending the fox game — fine as a victory lap, seasons are the answer
6. seasons — not built. The day loop is structured so a season layer can sit on top
7. dog ageing and retirement — not built; `Sheep.age` exists as the pattern to follow

### Test mode

Starting money is £1000 by default, with a line in the opening log. Settings → The game →
Purse switches to the £40 ship value. It takes effect on a new run.
