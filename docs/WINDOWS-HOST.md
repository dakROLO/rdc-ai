# CrownKeep Windows Product Host

Phase 4A turns the validated Windows browser-development experience into a native desktop product host while preserving the existing React application.

## Current scope — Sprint 4A.1

This sprint proves only the native shell and bridge boundary.

Included:

- Tauri 2 desktop shell;
- existing Vite/React CrownKeep UI;
- native host identity command;
- TypeScript runtime-manager selection;
- browser mode remains supported.

Not included yet:

- Foundry Local SDK lifecycle ownership;
- model download/install from CrownKeep;
- model load/unload from CrownKeep;
- installer/bundle generation;
- production code signing;
- browser-storage migration;
- Azure/cloud features.

## Windows development prerequisites

Tauri requires:

- Rust with the MSVC toolchain;
- Microsoft C++ Build Tools;
- Microsoft Edge WebView2;
- Node/npm for the existing React frontend.

Typical Rust setup:

```powershell
winget install --id Rustlang.Rustup
rustup default stable-msvc
```

After the required Microsoft C++ Build Tools are installed, restart the terminal before validation.

## First native-host validation

From the repository root on Windows:

```powershell
git checkout phase-4a-windows-product-host
git pull
npm install
npm run desktop:dev
```

Expected result:

1. a desktop window titled **CrownKeep** opens;
2. the existing CrownKeep React UI is rendered;
3. existing browser-oriented conversation/provider code remains unchanged;
4. with Foundry Local selected, the Local AI setup area reports:
   **Native Windows host connected. Foundry Local lifecycle control is the next Phase 4A slice.**

Browser regression check:

```powershell
npm run dev
```

The normal browser build should continue to report the external-development runtime behavior.

## Host boundary

The React application detects the Tauri host through the official Tauri JavaScript API and switches only the runtime lifecycle manager:

```text
Browser             -> BrowserLocalRuntimeManager
CrownKeep desktop   -> TauriLocalRuntimeManager
```

The current Rust command:

```text
crownkeep_host_info
```

returns host/platform/architecture/version information. It does not control Foundry Local yet.

## Next slice — Sprint 4A.2

After the shell proof is physically validated, integrate the official Foundry Local Rust SDK using the Windows `winml` feature.

Target lifecycle:

```text
CrownKeep
  -> detect hardware/catalog
  -> recommend model
  -> acquire model when needed
  -> load model
  -> verify observed performance
  -> persist working choice
  -> unload/release resources when appropriate
```

Normal users should not need to operate the Foundry CLI.

## Official references

- Tauri 2 existing frontend / Vite setup: https://v2.tauri.app/start/create-project/
- Tauri Vite configuration: https://v2.tauri.app/start/frontend/vite/
- Tauri Windows prerequisites: https://v2.tauri.app/start/prerequisites/
- Foundry Local current SDK reference: https://learn.microsoft.com/en-us/azure/foundry-local/reference/reference-sdk-current
