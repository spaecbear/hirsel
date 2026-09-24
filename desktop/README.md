# Hirsel on the desktop (Steam)

The web build, wrapped in Electron, with Steamworks for achievements, the overlay and
cloud saves. Everything desktop-specific lives in this folder; the game itself is built
at the repo root and copied in, so the Steam build and the web build are the same game by
construction.

## Running it

```bash
cd desktop
npm install
npm start               # builds the web game, stages it, compiles the shell, opens a window
npm test                # the file store and achievement names
npm run package:linux   # release/linux-unpacked/
npm run package:win     # release/win-unpacked/ (build on Windows, or with Wine)
npm run achievements    # the table below, from the game's own list
```

Steam does not need to be running. Without it the shell logs one warning and the game plays
exactly the same; achievements just stay in the game's own list. **F11** toggles fullscreen,
**F12** opens devtools in unpackaged builds.

## How it fits together

| file | job |
| --- | --- |
| `src/main.ts` | the window, the `app://hirsel/` scheme the game is served from, Steam init, IPC |
| `src/preload.ts` | puts `window.hirselPlatform` in place before the game loads — nothing else from Node reaches the page |
| `src/store.ts` | one JSON file per storage key, written atomically (temp file, then rename) |
| `scripts/stage-web.mjs` | copies `../dist` to `web/`, minus the service worker and manifest |
| `scripts/achievements.mjs` | prints the achievements for the partner site |

The game finds the bridge in `src/platform/index.ts` at the repo root. That is the only file
in the game that knows there is more than one platform; saves, settings and achievements
all go through it. Quit and Fullscreen appear in the game only when the bridge offers them.

**Why `app://` and not `file://`:** module scripts and fetches from `file://` run into
Chromium's origin rules. A registered, secure, standard scheme behaves like the https origin
the web build is written for. Only files inside the staged build are ever served, and the
page gets a Content-Security-Policy that allows nothing but its own files.

## Steamworks setup

### App id

`STEAM_APP_ID` in `src/main.ts` is **480** — Valve's public test app (Spacewar), so init
and the overlay can be tried before Hirsel has an id of its own. Replace it with the real
id from the partner site. Once it is real, a packaged build started outside Steam relaunches
itself through Steam (`restartAppIfNecessary`), which is what makes the overlay,
achievements and cloud work.

### Saves and Steam Auto-Cloud

Saves are files in the Electron user-data folder, under `saves/`:

| OS | folder |
| --- | --- |
| Windows | `%APPDATA%\Hirsel\saves` |
| Linux / Steam Deck | `~/.config/Hirsel/saves` |
| macOS | `~/Library/Application Support/Hirsel/saves` |

In the partner site, **Cloud → Auto-Cloud**, add a root for each:

| root | subdirectory | pattern | OS |
| --- | --- | --- | --- |
| `WinAppDataRoaming` | `Hirsel/saves` | `*.json` | Windows |
| `LinuxHome` | `.config/Hirsel/saves` | `*.json` | Linux |
| `MacAppSupport` | `Hirsel/saves` | `*.json` | macOS |

No code is involved beyond saving to that stable path. `window.json` (window size and
fullscreen) sits one level up on purpose: it is per-machine and should not sync.

### Achievements

Enter these under **Stats & Achievements**. The API name is the game's id in upper case
with underscores (`steamAchievementName` in `src/store.ts`). Hidden ones use the game's own
post-unlock line as their description, which Steam, like the game, only shows once earned.
Each needs a 64×64 icon, earned and unearned.

| API name | name | description | hidden |
| --- | --- | --- | --- |
| `FIRST_POUND` | First silver | Sell wool at market. |  |
| `CROOK` | A hand free | Buy the shepherd's crook. |  |
| `COLLIE` | Good lass | Take on the sheepdog. |  |
| `TEN_STRONG` | Ten on the hill | Keep ten sheep at once. |  |
| `TWENTY_STRONG` | A proper hirsel | Keep twenty sheep at once. |  |
| `PRIME` | Prime clip | Sell 40 stone of wool in a run. |  |
| `HUNDRED` | A hundred pound | Earn £100 from wool in a run. |  |
| `ROOF` | Dry at last | Slate the cottage roof. |  |
| `HEARTH` | A fire in it | Build up the hearth. |  |
| `BYRE` | Somewhere to put them | Raise the stone byre. |  |
| `RING` | In your coat pocket | Buy the ring in Inverness. |  |
| `LOCAL` | Kent face | Six evenings at the inn. |  |
| `THIRTY` | A season on | Reach day 30. |  |
| `HUNDRED_DAYS` | Still here | Reach day 100. |  |
| `CLEAN` | No fox got in | Reach day 20 without losing a sheep to a fox. |  |
| `AYE` | She said aye | Finish the croft and ask her. |  |
| `TIPPY` | Tippy | The collie found the warmest spot in the house before you did. | yes |
| `ARROW` | Arrow | Twice round by the fire, because you came back. | yes |
| `PELT` | The last wolf in Scotland | You had the reach of him. He is on your back now. | yes |
| `MAULED` | Caught out late | The high ground was no place to be, and you were told. | yes |

A run that used a code which changes the game earns none of these — see "Cheat codes" in
the root README.

## Still to do

Tracked in `prototype/steam-plan.md`. The big one is §1.5, keyboard and controller play,
which Steam Deck Verified requires. Also: pause and duck the audio when the window loses
focus; the Steam on-screen keyboard for the cheat-code field on the Deck; a default Steam
Input configuration; icons for the achievements and the executable.
