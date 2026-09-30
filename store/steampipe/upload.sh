#!/usr/bin/env bash
#
# Upload a build of Hirsel (or the demo) to Steam with SteamCMD.
#
#   ./upload.sh game <steam-builder-login> [beta-branch]
#   ./upload.sh demo <steam-builder-login> [beta-branch]
#
# Before the first run:
#   1. Install SteamCMD (https://developer.valvesoftware.com/wiki/SteamCMD).
#   2. cp ids.env.example ids.env, and fill in the app and depot ids.
#   3. Put the packaged builds in place — the CI artifacts, unzipped:
#        content/game/win/    ← hirsel-win         (Hirsel.exe and the rest,
#        content/game/linux/  ← hirsel-linux        with or without the *-unpacked folder)
#        content/demo/win/    ← hirsel-demo-win
#        content/demo/linux/  ← hirsel-demo-linux
#
# With a branch name the build goes live on that beta branch (make the
# branch in the partner site first). Without one it is uploaded and left
# for you to set live by hand — Steam never lets a script set the public
# default branch live, which is as it should be.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
kind="${1:-}"
login="${2:-}"
branch="${3:-}"

if [[ "$kind" != "game" && "$kind" != "demo" ]] || [[ -z "$login" ]]; then
  sed -n '3,8p' "$0"
  exit 1
fi
if [[ ! -f "$here/ids.env" ]]; then
  echo "No ids.env: copy ids.env.example and fill in the app and depot ids." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$here/ids.env"

if [[ "$kind" == "game" ]]; then
  app="$HIRSEL_APP_ID"; win="$HIRSEL_WIN_DEPOT"; linux="$HIRSEL_LINUX_DEPOT"; exe="Hirsel.exe"
else
  app="$HIRSEL_DEMO_APP_ID"; win="$HIRSEL_DEMO_WIN_DEPOT"; linux="$HIRSEL_DEMO_LINUX_DEPOT"; exe="Hirsel Demo.exe"
fi
for v in app win linux; do
  if [[ -z "${!v}" ]]; then echo "ids.env is missing an id for the $kind ($v)." >&2; exit 1; fi
done

content="$here/content/$kind"
# the CI artifacts unzip with a win-unpacked/ or linux-unpacked/ folder inside: take either layout
pick() { if [[ -d "$content/$1/$1-unpacked" ]]; then echo "$1/$1-unpacked"; else echo "$1"; fi; }
winPath="$(pick win)"
linuxPath="$(pick linux)"
# the right thing in the right place, or nothing is uploaded
[[ -f "$content/$winPath/$exe" ]] || { echo "Missing $content/$winPath/$exe — unzip the Windows build into content/$kind/win/." >&2; exit 1; }
[[ -f "$content/$linuxPath/hirsel" ]] || { echo "Missing $content/$linuxPath/hirsel — unzip the Linux build into content/$kind/linux/." >&2; exit 1; }
chmod +x "$content/$linuxPath/hirsel"

version="$(node -p "require('$here/../../package.json').version" 2>/dev/null || echo unknown)"
commit="$(git -C "$here" rev-parse --short HEAD 2>/dev/null || echo unknown)"
out="$here/output"
mkdir -p "$out"
vdf="$out/app_build_$kind.vdf"
sed -e "s|@APP_ID@|$app|" \
    -e "s|@WIN_DEPOT@|$win|" \
    -e "s|@LINUX_DEPOT@|$linux|" \
    -e "s|@WIN_PATH@|$winPath|" \
    -e "s|@LINUX_PATH@|$linuxPath|" \
    -e "s|@CONTENT@|$content|" \
    -e "s|@OUTPUT@|$out|" \
    -e "s|@BRANCH@|$branch|" \
    -e "s|@DESC@|Hirsel $kind $version ($commit)|" \
    "$here/app_build.vdf.template" > "$vdf"

echo "Uploading the $kind to app $app${branch:+, live on '$branch'}…"
steamcmd +login "$login" +run_app_build "$vdf" +quit
