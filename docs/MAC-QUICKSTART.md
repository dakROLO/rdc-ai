# Open CrownKeep on an Apple Silicon Mac

The first supported engineering path is the shared browser UI with a Mac-local Foundry service. This is not a native macOS release and does not use the iPhone Apple Foundation Models bridge. The Windows Tauri host currently depends on WinML; do not try to build it on macOS as-is.

This path has not been physically validated on Dakota's wife's Mac. It provides local chat, local conversation storage, prompt inspection and bundled image OCR. Native web search/read, dictation, Image Playground and the Windows image-generation adapter are unavailable in this browser path. Sign-in/sync is still pending, so existing phone/Windows conversations do not appear automatically.

## One-time setup

Use Terminal on the Mac. Verify `uname -m` returns `arm64`. Homebrew and the Xcode command-line tools must already be installed; the existing iPhone development Mac may already have them.

```bash
brew install node@22 git
brew tap microsoft/foundrylocal
brew install foundrylocal
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node --version
foundry --version
foundry model list
```

Confirm `phi-4-mini` is offered for this Mac. If it is not, select a small chat-model alias from the actual catalog, rather than copying a Windows GPU variant.

```bash
foundry model download phi-4-mini
```

Use the existing repository checkout on the Mac. After these changes are published and pulled:

```bash
cd /path/to/rdc-ai
bash scripts/mac-browser-dev.sh
```

For a new checkout after publication:

```bash
mkdir -p ~/Developer
cd ~/Developer
git clone --branch sprint-4a3-local-platform-convergence https://github.com/dakROLO/rdc-ai.git
cd rdc-ai
bash scripts/mac-browser-dev.sh
```

Open **http://localhost:5173** on that Mac. Keep the same hostname and port every time because the browser stores conversation history by origin. The launcher selects the real Foundry provider, not the development mock provider.

The launcher restarts the local Foundry server on port 39839 to match the existing development proxy, loads the chosen alias, and starts the UI on loopback only. This briefly interrupts other apps using that same Foundry service. It does not delete caches or conversations.

To use a different observed alias:

```bash
CROWNKEEP_MAC_MODEL="your-small-chat-alias" bash scripts/mac-browser-dev.sh
```

Ctrl+C stops the UI server. The Foundry service is separate; use `foundry server stop` if you want to release it after closing CrownKeep. You can later use Safari's Add to Dock for a convenient window, but the development server still needs to run.

## Physical acceptance

Verify real local response/provider labels, restart/history preservation, prompt inspector, and local English OCR. Confirm no image/search/model request is routed to a remote service. Do not describe this as native Mac feature parity.

A full macOS product needs its own capability adapter and packaging/build gate: either a Mac Apple-native host or a Mac-compatible Foundry host. Keep the shared conversation/domain/UI and optional tool interfaces; do not fork the product.

References checked 2026-10-03: [Foundry Local CLI installation and macOS Apple Silicon support](https://learn.microsoft.com/en-us/azure/foundry-local/how-to/how-to-use-foundry-local-cli), [CLI server management](https://learn.microsoft.com/en-us/azure/foundry-local/reference/reference-cli).
