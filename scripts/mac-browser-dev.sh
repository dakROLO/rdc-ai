#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "This launch path requires an Apple Silicon Mac."
  exit 2
fi
for TOOL in foundry node npm; do
  if ! command -v "$TOOL" >/dev/null 2>&1; then
    echo "$TOOL is required. See docs/MAC-QUICKSTART.md."
    exit 3
  fi
done
if [[ ! -d node_modules ]]; then npm ci; fi
# The browser dev proxy uses this fixed loopback port. This restarts the local
# service; it does not migrate/delete model caches or app conversation data.
foundry server restart --port 39839
foundry model load "${CROWNKEEP_MAC_MODEL:-phi-4-mini}"
echo "Open http://localhost:5173 on this Mac. Ctrl+C stops the UI server."
echo "Browser mode supports local chat and image OCR; native web/speech/image generation are unavailable here."
VITE_CROWNKEEP_DEFAULT_PROVIDER=foundry-local npm run dev -- --host 127.0.0.1
