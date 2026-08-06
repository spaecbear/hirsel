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
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | typecheck, then production build to `dist/` |
| `npm run preview` | serve the built output |
| `npm test` | Vitest over the simulation |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/make-icons.mjs` | regenerate the PWA PNG icons from the pixel design |

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

### Art packs

Two looks, switchable in Settings → Look, or with the `RETRO` cheat.

- **Hirsel** (default): the croft is in the scene and gets built as you buy it — roof, smoke
  from the hearth, the byre, a lit window at night. Each pasture is its own place. Sheep graze,
  lift their heads and cast shadows, and fleece changes their silhouette.
- **Retro (OG)**: the original single-file prototype's scene, ported unchanged.

Adding a third is one file implementing `ArtPack` in `src/render/art/`.

### Audio

Everything is synthesized at runtime — no audio files. The generative score is D Dorian at
68bpm, and it reacts to state (night thins the melody, rain thins it further). The engine
exposes `setRecordedBed(buffer)`, which plays a recorded loop on the same music bus, with the
same reverb and tape roll-off, alongside the synth layer rather than replacing it.

### Cheat codes

Settings → Cheat codes. `RETRO`, `SILLER`, `TOD`, `HIRSEL`, `LANGDAY`, `HAAR`.
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
