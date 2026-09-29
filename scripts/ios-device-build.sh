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

TEAM_ID="${CROWNKEEP_TEAM_ID:-QJ9HLPX482}"
DEVICE_ID="${CROWNKEEP_DEVICE_ID:-}"

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

DEPENDENCIES_OK=1
if [[ ! -d "$ROOT/node_modules" || ! -d "$ROOT/node_modules/@tauri-apps/api" ]]; then
  DEPENDENCIES_OK=0
elif ! npm ls --depth=0 >/dev/null 2>&1; then
  DEPENDENCIES_OK=0
fi

if [[ "$DEPENDENCIES_OK" -ne 1 ]]; then
  if [[ -f "$ROOT/package-lock.json" ]]; then
    echo "Refreshing CrownKeep web dependencies from package-lock.json…"
    npm ci
  else
    echo "Refreshing CrownKeep web dependencies…"
    npm install
  fi
fi

echo "Building CrownKeep React UI…"
npm run build

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "CrownKeep web build did not produce dist/index.html"
  exit 5
fi

echo "Preparing CrownKeep iOS app icon…"
bash "$ROOT/scripts/prepare-ios-icon.sh"

rm -rf "$DERIVED"

xcodebuild   -project "$PROJECT"   -scheme "$SCHEME"   -configuration Debug   -destination "generic/platform=iOS"   -derivedDataPath "$DERIVED"   DEVELOPMENT_TEAM="$TEAM_ID"   CODE_SIGN_STYLE=Automatic   -allowProvisioningUpdates   build

if [[ ! -d "$APP" ]]; then
  echo "Built app not found at $APP"
  exit 3
fi

echo "Installing CrownKeep…"
INSTALL_OK=0
for ATTEMPT in 1 2 3; do
  if xcrun devicectl device install app --device "$DEVICE_ID" "$APP"; then
    INSTALL_OK=1
    break
  fi

  if [[ "$ATTEMPT" -lt 3 ]]; then
    echo "Wireless device connection dropped during install (attempt $ATTEMPT/3)."
    echo "Keep the iPhone awake/unlocked and on the same network; retrying in 5 seconds…"
    sleep 5
  fi
done

if [[ "$INSTALL_OK" -ne 1 ]]; then
  echo "CrownKeep was built successfully, but wireless installation failed after 3 attempts."
  echo "Current CoreDevice visibility:"
  xcrun devicectl list devices || true
  exit 7
fi

echo "Launching CrownKeep…"
LAUNCH_OK=0
for ATTEMPT in 1 2 3; do
  if xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"; then
    LAUNCH_OK=1
    break
  fi

  if [[ "$ATTEMPT" -lt 3 ]]; then
    echo "Wireless device connection dropped during launch (attempt $ATTEMPT/3); retrying in 3 seconds…"
    sleep 3
  fi
done

if [[ "$LAUNCH_OK" -ne 1 ]]; then
  echo "CrownKeep installed successfully, but automatic launch failed."
  echo "Open CrownKeep manually on the iPhone or rerun the launch step."
  exit 8
fi

echo "CrownKeep launched on the paired iPhone."

if [[ "${CROWNKEEP_SLEEP_AFTER:-0}" == "1" ]]; then
  echo "Returning the Mac to sleep in 5 seconds…"
  sleep 5
  /usr/bin/osascript -e 'tell application "System Events" to sleep' || {
    echo "CrownKeep deployed successfully, but the Mac could not be put to sleep automatically."
    exit 0
  }
fi
