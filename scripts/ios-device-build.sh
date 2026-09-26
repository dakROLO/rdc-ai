#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Support common Homebrew/Node locations in non-interactive SSH shells.
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Support user-local NVM installs in non-interactive SSH shells.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi
PROJECT="$ROOT/native/ios/CrownKeepNative/CrownKeepNative.xcodeproj"
SCHEME="CrownKeepNative"
BUNDLE_ID="com.royaldigitalclarity.crownkeep.dev"
DERIVED="${CROWNKEEP_DERIVED_DATA:-/tmp/CrownKeepDerived}"
APP="$DERIVED/Build/Products/Debug-iphoneos/CrownKeepNative.app"

TEAM_ID="${CROWNKEEP_TEAM_ID:-}"
DEVICE_ID="${CROWNKEEP_DEVICE_ID:-}"

if [[ -z "$TEAM_ID" ]]; then
  echo "CROWNKEEP_TEAM_ID is required."
  echo "Find it with:"
  echo "  security find-identity -v -p codesigning"
  exit 2
fi

if [[ -z "$DEVICE_ID" ]]; then
  echo "CROWNKEEP_DEVICE_ID is required."
  echo "Find it with:"
  echo "  xcrun devicectl list devices"
  exit 2
fi

echo "== CrownKeep iPhone device build =="
echo "Project: $PROJECT"
echo "Device:  $DEVICE_ID"
echo "Team:    $TEAM_ID"

cd "$ROOT"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required on the Mac to build the shared CrownKeep UI."
  exit 4
fi

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "Installing CrownKeep web dependencies…"
  npm install
fi

echo "Building CrownKeep React UI…"
npm run build

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "CrownKeep web build did not produce dist/index.html"
  exit 5
fi

rm -rf "$DERIVED"

xcodebuild   -project "$PROJECT"   -scheme "$SCHEME"   -configuration Debug   -destination "generic/platform=iOS"   -derivedDataPath "$DERIVED"   DEVELOPMENT_TEAM="$TEAM_ID"   CODE_SIGN_STYLE=Automatic   -allowProvisioningUpdates   build

if [[ ! -d "$APP" ]]; then
  echo "Built app not found at $APP"
  exit 3
fi

echo "Installing CrownKeep…"
xcrun devicectl device install app   --device "$DEVICE_ID"   "$APP"

echo "Launching CrownKeep…"
xcrun devicectl device process launch   --device "$DEVICE_ID"   "$BUNDLE_ID"

echo "CrownKeep launched on the paired iPhone."
