# Getting Hirsel onto Steam

Everything for the store and the Steamworks partner site in one place. The code side
(the desktop shell, file saves, achievements, controller play, the demo, CI builds) is
done; what is left is the partner site, the art, and testing on real machines.

| file | what it is |
| --- | --- |
| `store-page.md` | drafts of the store text: short and long description, tags, content survey, requirements, price |
| `screenshots/` | eight 1920×1080 shots from the game, and `capture.cjs` to take them again |
| `steampipe/` | the upload: a build template and `upload.sh` around SteamCMD |
| `../desktop/README.md` | the desktop shell, the achievement table and Steam Input |

## The order, and the waits Valve sets

1. **Partner account**: sign up at partner.steamgames.com, sign the distribution
   agreement, tax interview, bank details, identity check.
2. **Pay the $100 app fee.** That creates Hirsel's App ID. **A 30-day clock starts here**:
   nothing can be released until it runs out. Create the demo app under the game's (free).
3. **Put the App IDs in the game**: `STEAM_APP_ID` and `STEAM_DEMO_APP_ID` in
   `desktop/src/main.ts` (both are 480, Valve's test app, until then), and the depot ids
   in `steampipe/ids.env`.
4. **Set the app up** (below), and upload a first build to a beta branch.
5. **Store page**: text from `store-page.md`, the screenshots, capsule art, a trailer if
   there is one. Submit it for review (a few business days). **It must be public as
   "Coming Soon" for at least two weeks before launch.**
6. **Test** on a Windows PC and a Steam Deck, through Steam (checklist below).
7. **Demo**: set `VITE_STORE_URL` in `.env.demo` to the store page, rebuild, upload, release.
   Steam Next Fest is worth aiming at if one falls inside the window.
8. **Submit the build for review** (a few business days), then release.

Realistically five to six weeks from paying the fee.

## Setting the app up in the partner site

### Depots and launch options

Two depots per app, Windows and Linux (the Deck runs the Linux one). Steamworks makes
the first depot for you; add the second and set each one's operating system.

| | executable | arguments |
| --- | --- | --- |
| game, Windows | `Hirsel.exe` | |
| game, Linux | `hirsel` | `--no-sandbox` |
| demo, Windows | `Hirsel Demo.exe` | |
| demo, Linux | `hirsel` | `--no-sandbox` |

**Why `--no-sandbox` on Linux.** Electron's Chromium sandbox needs its `chrome-sandbox`
helper to be setuid root, which a Steam depot cannot deliver, and Steam's Linux runtime
container usually blocks the fallback it would try next, so without the flag the game is
likely to exit at launch on the Deck. The game only ever loads its own files (see the
Content-Security-Policy in `desktop/src/main.ts`), so there is nothing untrusted for the
sandbox to contain. **Confirm this on a Deck**: try it without the flag first; if it starts,
leave the flag off.

### Steam Cloud

App Admin → Steam Cloud: turn on Auto-Cloud, a quota of 1 MB and 10 files is plenty.

| root | subdirectory | pattern |
| --- | --- | --- |
| `WinAppDataRoaming` | `Hirsel/saves` | `*.json` |
| `LinuxXdgConfigHome` | `Hirsel/saves` | `*.json` |

For the demo the same, with `Hirsel Demo/saves`. The saves are written atomically through a
`.tmp` file, which `*.json` leaves out.

### Achievements

28, listed with their exact API names in `desktop/README.md` (regenerate with
`npm run achievements` in `desktop/`). Tick **Hidden** on the four secret ones. Each wants
two 64×64 icons, earned and locked: 56 images, the biggest art job left.

### Steam Input

Choose the **Gamepad** template as the default configuration and mark full controller
support. See `desktop/README.md`.

## Uploading a build

When the Actions minutes are back: merge the work into `steam`, let CI build, and download
the four artifacts (`hirsel-win`, `hirsel-linux`, `hirsel-demo-win`, `hirsel-demo-linux`).
Then, with SteamCMD installed:

```bash
cd store/steampipe
cp ids.env.example ids.env        # and fill in the app and depot ids
# unzip hirsel-win into content/game/win/, hirsel-linux into content/game/linux/,
# and the demo's into content/demo/win/ and content/demo/linux/
./upload.sh game <builder-login> beta
./upload.sh demo <builder-login> beta
```

It refuses to run if a build is missing. With a branch name the build goes live on that
beta branch (make it in the partner site first); the public branch is always set live by
hand in the partner site. `ids.env`, `content/` and `output/` are ignored by git.

Use a separate Steam account with only build rights for uploading, not your own.

## Testing through Steam

On a Windows PC:

- It starts from the Steam library, and restarts through Steam if launched from the exe
- The overlay opens (Shift+Tab)
- An achievement unlocks in Steam, not only in the game's own list
- A save made on one machine is there on another
- Fullscreen (F11 and the setting), and the window size is remembered
- Sound stops when the window loses focus

On a Steam Deck:

- It starts (see `--no-sandbox` above)
- The text is readable at 1280×800
- Every screen can be played with the pad alone
- The on-screen keyboard comes up for the cheat-code field
- Suspend and resume in the middle of a day
- Then ask Valve for a Deck compatibility review

## Not done yet

- Capsule art, the achievement icons, and the executable's icon
- A trailer
- A playtest to a first win, to confirm the length and set the price
- Mac: left out of the launch; it needs an Apple developer account ($99 a year), code
  signing and notarisation, and a Mac to test on
