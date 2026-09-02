#!/usr/bin/env bash
# Capture landing-card thumbnails with headless Chrome, then downsize to JPEG.
# Usage: tools/make_thumbs.sh [port]   (default port 8321; serve repo root over HTTP first)
# To add a page: append one more `shot ...` line below.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${1:-8321}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"; pkill -9 -f "$PROFILE" >/dev/null 2>&1 || true' EXIT

mkdir -p assets/thumbs

shot() {
  local page_url="$1" out_name="$2" raw
  raw="$(mktemp -t thumb).png"
  # chrome --headless=new sometimes keeps running after writing the shot, so
  # `timeout` (exit 124) reaps it; that's expected, not a real failure.
  timeout 60 "$CHROME" \
    --headless=new --hide-scrollbars --window-size=1280,800 --force-device-scale-factor=2 \
    --virtual-time-budget=8000 \
    --user-data-dir="$PROFILE" \
    --screenshot="$raw" \
    "http://127.0.0.1:${PORT}/${page_url}" >/dev/null 2>&1 || true
  pkill -9 -f "$PROFILE" >/dev/null 2>&1 || true
  [ -s "$raw" ] || { echo "FAILED: no screenshot for ${page_url}" >&2; return 1; }
  sips -s format jpeg -s formatOptions 82 --resampleWidth 1280 "$raw" --out "assets/thumbs/${out_name}.jpg" >/dev/null
  rm -f "$raw"
  echo "assets/thumbs/${out_name}.jpg ($(du -h "assets/thumbs/${out_name}.jpg" | cut -f1))"
}

shot "html/ptolemy_model.html?tab=compare&embed=1" "ptolemy_model"
shot "html/altaz_radec.html?tab=grids&embed=1"     "altaz_radec"

# If a WebGL panel renders black, retry that page's `shot` call with:
#   --use-angle=swiftshader --enable-unsafe-swiftshader --use-gl=angle
