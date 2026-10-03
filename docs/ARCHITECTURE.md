# CrownKeep — Architecture

## Current implementation boundary — 2026-09-30

The system view includes planned components. `AuthProvider` and `SyncProvider` remain contracts, with no working sign-in/sync backend. Windows chat uses installed System Foundry; iPhone chat uses the native Apple Foundation Models host. Older SDK/PWA descriptions below describe earlier milestones.

[Daily-use completion plan](DAILY-USE-COMPLETION-PLAN.md) now prioritizes iOS tool reliability before native account adapters and encrypted continuity. Native Apple automatic-tool evidence must reach the shared message contract with bounded text, outcomes and prompt activity; shared policy/TypeScript loop limits alone do not prove native enforcement. Account, sync consent, local inference and Web Access remain independent states. Synced data needs account isolation, durable outbox/tombstones and a completed key/enrollment ADR before production implementation.

## System view

```mermaid
flowchart LR
    subgraph Device["User Device"]
        UI["React / TypeScript PWA"]
        DB["Local Conversation Store"]
        PR["Provider Registry"]
        FL["Foundry Local Provider"]
        WL["Mobile Local Provider"]
        AF["Azure Cloud Provider Client"]
        SY["Sync Client"]
        AU["Entra Auth Client"]
        CP["ContextProvider Interface"]
        TR["ToolRegistry + Web Access Policy"]
    end

    subgraph WebBoundary["Optional native read-only network tool boundary"]
        NW["Native Web Adapter\nDuckDuckGo Search + Direct Read"]
        WEB["Public Web / Search Provider"]
    end

    subgraph Azure["RDC Azure Tenant"]
        API["CrownKeep API"]
        SS["Encrypted Sync Store"]
        CAI["Cloud AI Service"]
        FCTX["Future RDC Context API\n(not connected now)"]
    end

    UI --> DB
    UI --> PR
    PR --> FL
    PR --> WL
    PR --> AF
    UI --> CP
    UI --> TR
    TR -->|Web Access ON only| NW
    NW --> WEB

    AU --> API
    SY --> API
    AF --> API
    API --> SS
    API --> CAI

    CP -. future only .-> FCTX
```

## Responsibility boundaries

### Client/device

Owns:

- local conversation persistence;
- local provider execution;
- provider selection;
- local/cloud message metadata;
- sync encryption/decryption;
- cloud escalation confirmation;
- offline usability.

Must not contain:

- cloud AI service credentials;
- database credentials;
- Azure service account secrets;
- RDC customer data committed as fixtures.

### RDC Azure

Owns:

- Entra-protected API boundary;
- encrypted sync transport/storage;
- cloud AI credential handling;
- server-side managed identities;
- future protected context API.

Azure synchronization should not require plaintext conversation content.

### Future RDC data systems

Out of current implementation scope.

The client may know only an abstract `ContextProvider` contract. There is no direct database connection from the client and no production RDC context integration.

## Core interfaces

### AIProvider

Approximate responsibilities:

```ts
export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  readonly location: "local" | "cloud";

  getAvailability(): Promise<ProviderAvailability>;
  listModels(): Promise<AIModel[]>;
  probeToolCalling?(modelId: string, signal?: AbortSignal): Promise<boolean | undefined>;
  streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk>;
}
```

Provider-specific SDK/runtime details stay inside adapters.

### ConversationRepository

```ts
export interface ConversationRepository {
  create(input: CreateConversationInput): Promise<Conversation>;
  get(id: string): Promise<Conversation | undefined>;
  list(): Promise<Conversation[]>;
  saveMessage(message: Message): Promise<void>;
  listMessages(conversationId: string): Promise<Message[]>;
}
```

Initial browser/PWA implementation will use IndexedDB behind this interface.

### SyncProvider

```ts
export interface SyncProvider {
  getStatus(): Promise<SyncStatus>;
  push(changes: EncryptedSyncChange[]): Promise<SyncReceipt>;
  pull(cursor?: string): Promise<SyncBatch>;
}
```

The sync service transports encrypted envelopes rather than requiring plaintext message content.

### ContextProvider

```ts
export interface ContextProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  getContext(request: ContextRequest): Promise<ContextPacket>;
}
```

Only synthetic/mock implementations are allowed until real RDC context integration is explicitly scheduled.

## Conversation/provider rule

Provider/model metadata belongs to each assistant message.

```text
Conversation A
 ├─ user message
 ├─ assistant — Foundry Local / model X
 ├─ user message
 ├─ assistant — CrownKeep Cloud / model Y
 ├─ user message
 └─ assistant — mobile local / model Z
```

This preserves conversation continuity while allowing provider changes.

## Local database direction

Use a repository abstraction over IndexedDB for the PWA.

Goals:

- offline reads/writes;
- immutable IDs;
- explicit schema migrations;
- local sync metadata;
- no dependence on React component lifecycle.

## Azure API direction

The client authenticates through Entra as a public client and calls an Entra-protected CrownKeep API.

The API, not the client, accesses Azure cloud services requiring credentials.

Prefer managed identity for Azure-to-Azure access and Key Vault only where a secret is genuinely required.

## Encryption direction

The exact key-management mechanism is intentionally not selected in Phase 0.

Before implementing sync encryption, create an ADR covering:

- user/device key hierarchy;
- second-device enrollment;
- key storage on Windows/iPhone;
- key rotation;
- device revocation;
- recovery behavior;
- what metadata remains visible to Azure.

Use established platform cryptography and authenticated-encryption modes.

## Deployment direction

Initial application:

- shared web/PWA artifact;
- local providers run on-device;
- cloud API deployed separately in RDC Azure;
- environment-specific public configuration injected at build/runtime;
- no production secrets in the repository.

## Architecture invariants

1. Local chat does not require Azure.
2. Conversation identity is independent of inference provider.
3. Cloud credentials do not enter the browser/PWA.
4. Sync storage does not need plaintext conversations.
5. Real RDC data remains disconnected until explicitly scheduled.
6. Public repository contents must be safe for anonymous viewing.
7. Web/network tool access is independent from AI provider selection; using a network tool does not imply cloud reasoning.
8. Web Access OFF must block network tools before availability probes or execution.
9. Public-web tools receive only the minimum query or selected URL, never implicit conversation/project/file context.


## Windows desktop distribution direction

CrownKeep's target Windows release is a normal downloadable desktop installer, not a developer workflow that requires PowerShell or a separately installed Foundry Local CLI.

Current direction:

- retain the React/TypeScript UI and provider-neutral conversation architecture;
- add a native Windows desktop shell when packaging work begins;
- embed the current Foundry Local SDK in the desktop application so normal users do not need to install or operate the Foundry CLI;
- use the SDK for hardware detection, execution-provider selection, model discovery/acquisition, loading, inference, and cache management;
- download the chosen model during first-run setup rather than bundling multi-hundred-MB/GB model files into the installer;
- benchmark observed performance during onboarding and persist a known-good model/variant choice;
- keep advanced model/runtime controls available for troubleshooting without requiring them for normal use;
- produce a signed Windows setup executable for direct web download, with MSI/MSIX/Store distribution considered later if useful.

A Tauri 2 desktop shell with the Foundry Local Rust SDK is a strong implementation candidate because it can preserve the current React UI while providing native process/runtime access and Windows installer packaging. This is an implementation direction to validate during the packaging sprint rather than a locked framework dependency.

The existing PWA remains useful for browser/mobile work and as a development surface, but the Windows downloadable product may use a native shell because local runtime/model management is a concrete capability gap that a browser-only PWA cannot reliably own.


## Local runtime lifecycle contract

CrownKeep separates **inference** from **runtime lifecycle management**.

`AIProvider` remains responsible for provider availability, model listing, and chat inference.

`LocalRuntimeManager` is responsible for native lifecycle capabilities such as:

- inspect local runtime state;
- start/stop the runtime;
- install/acquire a model;
- load/unload a model;
- report which lifecycle actions the current host can perform.

The current browser development host uses `BrowserLocalRuntimeManager`. It can inspect Foundry Local and guide setup, but it intentionally cannot start/stop the daemon or install/load/unload models from browser JavaScript.

The future Windows desktop host will implement the same runtime contract with embedded/native capabilities. This lets the existing React onboarding UI survive the transition from the engineering CLI workflow to a normal Windows installer.

First-run state is derived from three stages:

1. runtime reachable;
2. model selected/available;
3. local inference verified through an observed quick check.

Successful verification is stored locally with the selected provider/model and basic observed timing. The stored record is advisory and can be invalidated by changing the model/runtime.

Runtime performance guidance is based on observed first-token and total-response timing, not solely on a CPU/GPU/NPU label.


## iPhone native local-AI direction

The primary iPhone local-inference path is a native Apple host using the Foundation Models framework rather than treating browser WebGPU/WebLLM as the default.

Architecture:

```text
CrownKeep React UI
        |
        v
AppleFoundationModelsProvider
        |
        v
NativeAIHost TypeScript bridge
        |
        v
iPhone native host
        |
        v
Foundation Models framework
        |
        v
SystemLanguageModel.default
```

The React conversation system remains provider-neutral. The native host supplies local inference capability but does not own conversation identity.

### Native/provider boundary

- `src/native/NativeAIHost.ts` defines the JavaScript-side native bridge.
- `src/providers/AppleFoundationModelsProvider.ts` adapts that bridge to `AIProvider`.
- `native/ios/CrownKeepFoundationModelsService.swift` is the initial Swift service boundary.
- The bridge must surface model availability explicitly and must not silently route unavailable local requests to cloud.
- Safari/PWA mode remains useful for the CrownKeep UI and local conversation storage, but it cannot claim access to Apple's Foundation Models framework unless the native host is present.

### Apple availability

CrownKeep must distinguish at least:

- model available;
- device not eligible;
- Apple Intelligence not enabled;
- model not ready;
- unknown/unhandled availability.

### Model/session strategy

For the first device vertical slice, the native host may return a complete non-streaming response as one `ChatChunk` to prove the bridge.

After the bridge works, Sprint 3.2 will add native streaming, cancellation, token/context instrumentation, and mobile resource handling.

WebLLM/WebGPU remains an optional fallback/experimental provider rather than the primary iPhone implementation.


## Phase 4A Windows product host

CrownKeep's Windows productization path preserves the existing React conversation application and adds a native desktop host only for capabilities the browser cannot own reliably.

Target shape:

```text
CrownKeep React UI
        |
        +---- AIProvider ----------------------> conversation inference
        |
        +---- LocalRuntimeManager
                     |
                     +-- browser development -> BrowserLocalRuntimeManager
                     |
                     +-- Windows desktop -----> TauriLocalRuntimeManager
                                                    |
                                                    v
                                               Tauri/Rust host
                                                    |
                                      Phase 4A.2: Foundry Local Rust SDK
                                                    |
                                               Windows WinML
```

Sprint 4A.1 exposes only a native host identity command. It intentionally does not start/stop Foundry Local or install/load/unload models yet.

The first native command is:

```text
crownkeep_host_info
```

The TypeScript runtime selector chooses `TauriLocalRuntimeManager` only when the frontend is actually running inside Tauri. Ordinary browser/PWA development continues to use `BrowserLocalRuntimeManager`.

### Windows host invariants

1. The React conversation/domain/provider layer remains shared.
2. The native host owns OS/runtime lifecycle capabilities, not conversation identity.
3. Browser mode remains usable for engineering and regression testing.
4. Native runtime actions are surfaced through `LocalRuntimeManager`, not direct UI shell commands.
5. Foundry Local SDK integration must not require Azure or cloud credentials.
6. The installed product must eventually use a stable local storage location/origin and explicitly handle migration/export from browser-development storage.

## Sprint 4A.3 shared model and speech boundaries

`modelPolicy.ts` contains the host-label-neutral family/task/memory/benchmark policy. `ModelAnalyst` coordinates native lifecycle operations without touching conversation storage. Device fingerprints are local hashes of hardware/driver/OS/provider/catalog characteristics; no machine serial or user identity is gathered. Preferred families retain observed variants only for matching fingerprints.

`SpeechInputProvider` separates capture, stopping, transcription, cancellation, and capability reporting. `DictationControl` only appends reviewed text to the composer. Windows uses a bounded WebView microphone capture and native Foundry `AudioClient`; iOS exposes Apple Speech through the native bridge. No browser cloud speech API or cloud fallback is used. Speech and chat/benchmark/lifecycle actions are mutually excluded in the shared UI. Speech releases immediately after each recording, including restoration of prior Windows chat models, rather than retaining both models in GPU memory.


## Sprint 4A.4 Web Access and automatic-tool boundary

CrownKeep treats public-web access as a **tool capability**, not an AI provider or cloud reasoning service.

```text
User request
   |
   v
Selected local Anne provider
   |
   +-- request does not need external/current data --> local answer
   |
   +-- Web Access OFF -----------------------------> local answer / explicit current-info limitation
   |
   +-- Web Access ON
          |
          v
      ToolRegistry policy
          |
          v
      Native Web Adapter
          |
          +-- Web Search --> DuckDuckGo HTML search
          |                  (minimal query only; no key)
          |
          +-- Web Read ----> selected public HTTP(S) page
                             (selected URL only)
          |
          v
      untrusted tool result + source metadata
          |
          v
      same selected local Anne provider
          |
          v
      final answer
```

There is **no CrownKeep Web Gateway, search API account, or API key** in the current architecture. The earlier Azure Function/Web Gateway and Tavily credential-store prototypes were removed before physical acceptance.

### ToolRegistry policy

`ToolRegistry` is the authoritative execution boundary.

Current defaults:

- `webAccess = off`;
- write tools remain denied unless a future explicit approval flow enables them;
- a network tool is rejected **before** `isAvailable()` or `execute()` when Web Access is OFF;
- tool execution never changes the selected `AIProvider`.

Turning Web Access ON authorizes only the registered network tools. It does not authorize cloud-model fallback, bulk context upload, or alternate search-provider fallback.

### Native Web Search / Web Read transport

The shared application exposes two provider-neutral read-only tools:

- `web-search`: sends one minimized search query and receives parsed titles, URLs, and snippets;
- `web-read`: sends one selected public HTTP(S) URL and receives bounded readable content.

**Windows**

- the Tauri/Rust host performs HTTPS requests;
- Web Search requests DuckDuckGo's public non-JavaScript HTML search surface;
- returned HTML is parsed locally into result titles, destination URLs, and snippets;
- DuckDuckGo redirect links are unwrapped locally;
- Web Read fetches the selected public page directly.

**iPhone**

- the Swift host performs HTTPS requests with `URLSession`;
- Web Search uses the same DuckDuckGo non-JavaScript HTML search surface;
- result parsing and redirect unwrapping happen locally;
- Web Read fetches the selected public page directly;
- Apple Foundation Models remains the local reasoning provider.

**Browser-only development**

- does not perform live native web search;
- reports native Web Access unavailable;
- shared policy/tool behavior remains testable through injected test transports.

### DuckDuckGo is discovery, not reasoning

DuckDuckGo is used only to locate public pages. CrownKeep does not delegate answer generation or reasoning to DuckDuckGo.

Only the minimized query is sent to DuckDuckGo. Search results return to CrownKeep, selected pages are read directly, and the same local Anne provider produces the answer.

DuckDuckGo HTML/Lite search is a public browser-facing surface rather than a formal developer API. Therefore:

- parser changes, rate limits, or interactive verification may cause search failure;
- CrownKeep reports that failure visibly;
- CrownKeep does not bypass interactive verification;
- CrownKeep does not silently switch to Google, Bing, Brave, Tavily, another search service, or cloud AI.

### Automatic tool use by runtime

**Windows / System Foundry**

- structured local-model tool calling is used only when current-device evidence proves support;
- otherwise CrownKeep uses the bounded provider-neutral read-only fallback;
- all tool results return to the same selected local provider;
- the current loop is capped at three read-only web operations for one turn.

**Native iPhone / Apple Foundation Models**

- the same logical Web Search/Web Read definitions are exposed as Foundation Models `Tool` objects;
- Web Access ON exposes both tools with no credential prerequisite;
- Web Access OFF exposes no network tools;
- reasoning remains Apple on-device.

**Models without structured tool calling**

- the fallback examines only the current prompt;
- ordinary/local questions make no web request;
- current/external intent may trigger one search;
- source-detail intent may add at most two selected page reads;
- conversation history, local knowledge, attachments, and unrelated project context are not sent to search.

### Network and trust boundary

For current Web Access tools, only these values may leave the device:

- the minimized public search query sent to DuckDuckGo; or
- the single selected public URL requested by Web Read.

CrownKeep does **not** send entire conversation history, projects, local knowledge, attachments, files, images, or unrelated context through these tools.

Retrieved web content is treated as untrusted reference data, not instructions.

### Status and visibility

The persistent status bar continues to show:

- Quick / Balanced / Deep role where applicable;
- actual model and execution device/provider;
- Ready / Working / Benchmarking / Sleeping / Error;
- Inside the Keep versus network boundary;
- Web Access OFF/ON;
- `Local reasoning · keyless web` when the native keyless web tools are available.

Assistant messages retain web-tool activity and source URLs separately from provider metadata, so a locally reasoned response can visibly show that public-web retrieval occurred.

### Image/multimodal continuation

The next capability layer should reuse this same ToolRegistry/policy/result-metadata foundation:

- image understanding/OCR should remain local-first where a supported device capability exists;
- image generation remains a provider-neutral tool;
- any cloud image generation must expose an explicit visible boundary;
- images/prompts must not be silently uploaded.

## October 3 — Request diagnostics and image adapters

`PromptInspector` holds a session-only request snapshot; provider callbacks capture structured-loop rounds and the Apple host reports flattened instructions/prompt. `requestBudget.ts` preserves current/system messages, bounds newest history and reports omissions. Apple web prefetch uses shared registry/native transport before generation; bounded evidence persists in tool activity.

`ImageWorkbench` prepares a bounded preview, invokes native Vision or bundled Tesseract OCR and requires editable review before attaching text to a user message. `Message.attachments` persists previews/text in existing IndexedDB records. Models receive extracted text, not image pixels. Native generation uses explicit Image Playground presentation or `crownkeep_generate_image` with loopback-only URL validation, no proxy/redirect, finite timeout and bounded response. No image data or chat context is automatically sent to web search. Image payload sync/encryption limits must be designed before account sync ships.

Mac browser development selects the existing Foundry provider and loopback Vite proxy; it does not imply native Mac feature parity.
