#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/public/crownkeep-mark.svg"
OUTPUT="$ROOT/native/ios/CrownKeepNative/CrownKeepNative/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

if [[ ! -f "$SOURCE" ]]; then
  echo "CrownKeep runtime SVG icon source was not found: $SOURCE"
  exit 6
fi

if ! command -v qlmanage >/dev/null 2>&1; then
  echo "macOS qlmanage is required to render the CrownKeep SVG app icon."
  exit 6
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$(dirname "$OUTPUT")"
echo "Rendering CrownKeep iOS app icon from the runtime vector mark…"
qlmanage -t -s 1024 -o "$TMP_DIR" "$SOURCE" >/dev/null 2>&1

PREVIEW="$TMP_DIR/$(basename "$SOURCE").png"
if [[ ! -f "$PREVIEW" ]]; then
  echo "CrownKeep SVG preview was not generated at $PREVIEW"
  exit 6
fi

sips -s format png -z 1024 1024 "$PREVIEW" --out "$OUTPUT" >/dev/null
echo "Prepared CrownKeep iOS icon: $OUTPUT"
