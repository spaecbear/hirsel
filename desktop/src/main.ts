/**
 * Hirsel on the desktop: one window, the web build loaded from disk, and
 * Steamworks for achievements and the overlay.
 *
 * The game itself is not built here. `npm run stage` copies the root web build
 * into `web/`, and this file serves it — so the Steam build and the web build
 * are the same game, and everything desktop-specific lives in this folder.
 */
import { app, BrowserWindow, ipcMain, Menu, net, protocol, shell } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { FileStore, steamAchievementName } from "./store";

/*
 * 480 is Valve's public test app (Spacewar). Achievements will not appear
 * against it, but init, the overlay and the calls themselves can be tested
 * before Hirsel has its own id. Replace this with the real app id from the
 * Steamworks partner site; Steam also passes it as SteamAppId when it
 * launches the game.
 */
const STEAM_APP_ID = 480;

/*
 * The name decides the user-data folder, which is where saves live and what
 * Steam Auto-Cloud is pointed at. Pinned here so a development run and a
 * packaged one use the same folder.
 */
app.setName("Hirsel");
const appId = Number(process.env.SteamAppId) || STEAM_APP_ID;

/** where the staged web build lives: next to out/ in dev, inside the app when packaged */
const WEB_DIR = join(__dirname, "..", "web");

/* ---------- Steam ---------- */

type SteamClient = ReturnType<typeof import("steamworks.js").init>;
let steam: SteamClient | null = null;

try {
  const steamworks = require("steamworks.js") as typeof import("steamworks.js");
  /*
   * A released build that was started by double-clicking the exe rather than
   * through Steam is relaunched through Steam, which is what makes the overlay,
   * achievements and cloud work. Skipped for the test id and in development.
   */
  if (app.isPackaged && STEAM_APP_ID !== 480 && steamworks.restartAppIfNecessary(STEAM_APP_ID)) {
    app.exit(0);
  }
  steam = steamworks.init(appId);
  // must be called before the window exists
  steamworks.electronEnableSteamOverlay();
} catch (e) {
  // Steam not running, or no Steam at all: the game plays exactly the same,
  // achievements just stay in the game's own list
  console.warn(`[hirsel] Steam unavailable, carrying on without it: ${(e as Error).message}`);
  steam = null;
}

/* ---------- storage ---------- */

const store = new FileStore(join(app.getPath("userData"), "saves"));

type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
function reply<T>(fn: () => T): Reply<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

ipcMain.on("store:read", (e, key: string) => (e.returnValue = reply(() => store.read(key))));
ipcMain.on("store:write", (e, key: string, value: string) => (e.returnValue = reply(() => store.write(key, value))));
ipcMain.on("store:remove", (e, key: string) => (e.returnValue = reply(() => store.remove(key))));

ipcMain.on("steam:achievement", (_e, id: string) => {
  if (!steam || typeof id !== "string") return;
  try {
    steam.achievement.activate(steamAchievementName(id));
  } catch (err) {
    console.warn(`[hirsel] could not unlock ${id}: ${(err as Error).message}`);
  }
});

/* ---------- the window ---------- */

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  fullscreen: boolean;
}

const windowFile = join(app.getPath("userData"), "window.json");

function loadWindowState(): WindowState {
  // the Deck is a handheld: always fullscreen there, whatever was saved
  const deck = steam?.utils.isSteamRunningOnSteamDeck() ?? false;
  const fallback: WindowState = { width: 1280, height: 800, fullscreen: deck };
  try {
    if (!existsSync(windowFile)) return fallback;
    const s = { ...fallback, ...(JSON.parse(readFileSync(windowFile, "utf8")) as Partial<WindowState>) };
    if (deck) s.fullscreen = true;
    return s;
  } catch {
    return fallback;
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const b = win.getNormalBounds();
    const s: WindowState = { width: b.width, height: b.height, x: b.x, y: b.y, fullscreen: win.isFullScreen() };
    writeFileSync(windowFile, JSON.stringify(s));
  } catch {
    /* a window size is never worth failing a quit over */
  }
}

/*
 * The game is served from app://hirsel/ rather than file://. Module scripts
 * and fetches from file:// run into origin rules; a registered, secure,
 * standard scheme behaves like the https origin the web build is written for.
 */
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self'",
].join("; ");

function serveWeb() {
  protocol.handle("app", async (req) => {
    const { pathname } = new URL(req.url);
    const rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
    const file = normalize(join(WEB_DIR, rel));
    // nothing outside the staged build is ever served
    if (!file.startsWith(WEB_DIR + sep)) return new Response("not found", { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    if (!file.endsWith(".html")) return res;
    // the page only ever loads its own files; inline styles are how the UI positions things
    const headers = new Headers(res.headers);
    headers.set("Content-Security-Policy", CSP);
    return new Response(res.body, { status: res.status, headers });
  });
}

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 500,
    fullscreen: state.fullscreen,
    backgroundColor: "#14170f", // --peat, so there is no white flash before the game paints
    title: "Hirsel",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // the scene clock keeps running in the background otherwise, and a
      // player who alt-tabs away should not come back to a night already over
      backgroundThrottling: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // F11 for fullscreen, as on every other desktop game; F12 opens devtools in development
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === "F12" && !app.isPackaged) {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });

  // the game never opens windows or navigates away; links, if any, go to the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://hirsel/")) e.preventDefault();
  });

  win.on("close", () => saveWindowState(win));

  ipcMain.on("window:fullscreen", (_e, on: boolean) => win.setFullScreen(Boolean(on)));
  ipcMain.on("window:is-fullscreen", (e) => (e.returnValue = reply(() => win.isFullScreen())));

  void win.loadURL("app://hirsel/index.html");
  return win;
}

ipcMain.on("app:quit", () => app.quit());

// one copy of the game at a time: a second launch focuses the first
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    serveWeb();
    createWindow();
  });

  app.on("window-all-closed", () => app.quit());
}
