# CrownKeep — Sprint Roadmap

This roadmap is outcome-based. A sprint ends when its exit criteria are met, not merely when code has been written.

Visual summary: `public/crownkeep-sprints.svg`. The same asset is rendered in the repository README and inside CrownKeep.

## Phase 0 — Foundation

### Sprint 0.1 — Repository and project contract — **COMPLETE**

**Outcome:** The repository becomes the durable source of project truth.

Deliverables:

- project context;
- architecture document;
- security boundaries;
- decision log;
- current-status log;
- agent/contributor instructions;
- public-repository secret/data rules;
- initial TypeScript/React/PWA project skeleton.

Exit criteria:

- a new contributor/agent can understand the product without chat history;
- local development can start from the README;
- no real RDC customer data or production secrets are present.

### Sprint 0.2 — Application shell — **VALIDATION PENDING**

**Outcome:** A minimal installable PWA runs on Windows and iPhone-compatible browsers.

Deliverables:

- React/TypeScript application shell;
- responsive conversation layout;
- navigation shell;
- PWA manifest/service-worker setup;
- provider and storage interfaces;
- synthetic demo content only.

Exit criteria:

- local dev build succeeds;
- production build succeeds;
- PWA installation metadata is valid;
- app can render offline shell assets after first load.

---

## Phase 1 — Local Conversation Core

### Sprint 1.1 — Domain + local persistence — **COMPLETE**

**Outcome:** Conversations survive reloads without cloud services.

Deliverables:

- Conversation and Message domain models;
- immutable IDs;
- local repository abstraction;
- IndexedDB implementation;
- create/list/open/rename/delete conversation flows;
- persistence tests.

Exit criteria:

- messages persist across reloads;
- multiple conversations can be created/opened;
- no network service is required.

### Sprint 1.2 — Provider-neutral streaming chat — **COMPLETE**

**Outcome:** The UI can stream from any provider implementing the common contract.

Deliverables:

- `AIProvider` contract;
- provider registry;
- streaming/cancellation lifecycle;
- per-message provider/model metadata;
- mock provider for deterministic testing.

Exit criteria:

- mock responses stream into a conversation;
- generation can be stopped;
- switching providers does not create a new conversation.

---

## Phase 2 — Windows Local AI

### Sprint 2.1 — Foundry Local connectivity — **COMPLETE**

**Outcome:** Windows can discover/connect to Microsoft Foundry Local through a provider adapter.

Deliverables:

- `FoundryLocalProvider`;
- availability/health reporting;
- model discovery where supported;
- no hard-coded runtime port when discovery is available;
- useful setup/diagnostic UI.

Exit criteria:

- provider health can be displayed;
- at least one installed/supported local model can generate a streamed response;
- provider failures do not corrupt conversation state.

### Sprint 2.2 — Windows local experience hardening — **COMPLETE**

#### Sprint 2.2A — Local AI diagnostics and control surface — **COMPLETE**

Focus:

- compact/collapsible provider and model controls;
- visible local runtime health and selected model;
- observed request/first-token/completion timing;
- model/device/variant details where the runtime exposes them;
- poor-performance guidance based on observed behavior;
- keep all diagnostics optional so normal chat remains clean;
- temporal context and reversible message exclusion for active-conversation context management;
- stable development origin so local IndexedDB conversations do not appear to disappear when Vite changes ports.

Defer installer/native-shell work until these provider/runtime contracts are stable.

#### Sprint 2.2B — Runtime lifecycle + first-run setup — **COMPLETE FOR BROWSER FOUNDATION**

Focus:

- define the normal-user local runtime lifecycle behind the provider interface;
- design first-run Foundry/model setup without requiring PowerShell in the final product;
- model recommendation based on observed performance rather than catalog labels alone;
- startup/reconnect/retry behavior;
- idle/unload behavior and resource release;
- preserve the current CLI path as an engineering diagnostic only;
- browser implementation must remain capability-aware and never imply native lifecycle control it does not have;
- use the runtime lifecycle contract as the seam for the later Windows desktop host.

**Outcome:** Foundry Local is usable as the normal Windows provider.

Deliverables:

- model selection;
- loading/error states;
- cancellation;
- basic performance instrumentation;
- startup/provider diagnostics;
- first-run local AI setup that detects/starts Foundry Local, recommends a model, downloads/loads it, benchmarks observed performance, and persists the working choice;
- execution-device/model-variant visibility;
- CPU-only model performance warning and smaller-model fallback guidance;
- time-to-first-token benchmark / observed-performance check so virtual GPU labels are not trusted blindly;
- Foundry SSE compatibility monitoring across preview builds; current SSE path has been validated on two Windows hosts.

Exit criteria:

- user can select a local model and hold a persistent multi-turn conversation;
- application remains usable when the provider is unavailable.

---

## Phase 3 — iPhone Local AI

### Sprint 3.1 — iPhone capability detection + native host — **IN PROGRESS**

**Outcome:** CrownKeep can distinguish native Apple on-device AI from browser-only iPhone use and has a stable bridge boundary for local iPhone inference.

#### Sprint 3.1A — Capability + provider boundary — **IMPLEMENTED FOUNDATION**

Deliverables:

- native `AppleFoundationModelsProvider` adapter behind the existing `AIProvider` contract;
- `NativeAIHost` bridge contract for the iPhone host;
- iPhone/iPad browser capability detection;
- explicit Safari/PWA unsupported-local-AI provider instead of attempting Windows Foundry;
- Apple availability-state mapping for device eligibility, Apple Intelligence state, and model readiness;
- first Swift `CrownKeepFoundationModelsService` scaffold using `SystemLanguageModel` and `LanguageModelSession`.

#### Sprint 3.1B — Minimal native iPhone host — **COMPLETE**

Deliverables:

- minimal Xcode iPhone host;
- shared CrownKeep React UI loaded inside the native app;
- bridge implementation that exposes `window.crownKeepNativeAI`;
- availability + model descriptor calls wired end-to-end;
- first on-device response returned through the existing provider-neutral conversation path;
- device test on a supported iPhone.

WebLLM/WebGPU remains a fallback/experimental path for devices or distribution modes where the native Apple model is unavailable; it is no longer the primary iPhone strategy.

Exit criteria:

- Safari/PWA and native-host states are explicit;
- a supported native iPhone can report Apple model availability through CrownKeep;
- the Windows provider path remains unaffected.

### Sprint 3.2 — Mobile local conversation — **COMPLETE · BASIC BASELINE VALIDATED**

**Outcome:** A supported iPhone can produce local responses in the shared conversation system.

Deliverables:

- local model generation;
- streaming where supported;
- cancellation;
- mobile-friendly memory/resource handling.

Exit criteria:

- a persisted conversation can be continued with the mobile local provider;
- conversation metadata matches the same domain model used on Windows.

---

## Phase 4A — Windows Product Host — **ACTIVE**

### Sprint 4A.1 — Native shell proof

**Outcome:** The existing CrownKeep React application runs unchanged inside a Windows native desktop host and can prove the native host boundary without breaking browser development.

Deliverables:

- Tauri 2 shell around the existing Vite/React application;
- fixed development URL/origin compatible with the existing local-storage assumptions;
- native host identity command exposed to the React layer;
- runtime-manager selection between browser development and native Windows host;
- no Foundry Local lifecycle ownership yet;
- browser/PWA mode remains functional.

Exit criteria:

- `npm run desktop:dev` opens CrownKeep in a native Windows window;
- CrownKeep reports that the native Windows host is connected;
- existing conversations/projects render normally;
- existing Foundry Local browser-development path still works outside Tauri;
- normal web build/lint/typecheck remain green.

### Sprint 4A.2 — Embedded Foundry Local lifecycle

**Outcome:** The Windows host owns the local runtime/model lifecycle so a normal user does not need to operate the Foundry CLI.

Deliverables:

- integrate the official Foundry Local Rust SDK with Windows WinML support;
- inspect compatible models for the current hardware;
- acquire/install a selected model;
- load/unload model lifecycle;
- runtime start/stop or equivalent host-owned lifecycle;
- expose lifecycle operations through the existing `LocalRuntimeManager` contract;
- retain observed-performance verification before persisting a recommended model choice.

Exit criteria:

- a clean Windows test host can reach a ready local-model state from CrownKeep without manual Foundry CLI commands;
- runtime/model failures surface through CrownKeep without corrupting conversations;
- the browser build remains capability-aware and does not pretend to own native lifecycle actions.

### Sprint 4A.3 — Stable desktop storage + installer proof

**Outcome:** CrownKeep behaves like an installed Windows product rather than a development web origin.

Deliverables:

- stable desktop application storage/origin validation;
- local conversation/project migration/export strategy from the browser-development origin;
- first Windows setup executable proof;
- CrownKeep icon/product metadata;
- install/update/uninstall behavior documented;
- code-signing/reputation plan documented before public distribution.

Exit criteria:

- install on a second Windows machine does not require Vite, PowerShell, or a separately managed Foundry CLI;
- local conversations survive normal application restart/update behavior;
- uninstall/data-retention behavior is explicit.

---

## Phase 4B — RDC Cloud Identity & API Foundation

### Sprint 4B.1 — Entra authentication

**Outcome:** Cloud features can authenticate an RDC user without coupling local chat to sign-in.

Deliverables:

- MSAL/public-client integration;
- sign-in/out state;
- API access-token acquisition;
- protected-route/API-call helper;
- no client secret.

Exit criteria:

- local chat still works while signed out;
- authenticated API calls can obtain a scoped token;
- secrets are not present in the client.

### Sprint 4B.2 — Minimal Azure API foundation

**Outcome:** A small RDC-hosted API exists as the cloud boundary.

Deliverables:

- Entra-protected API;
- health/version endpoint;
- infrastructure/configuration documentation;
- managed identity for server-side Azure access where applicable;
- deployment configuration without committed secrets.

Exit criteria:

- unauthenticated protected calls are rejected;
- authenticated RDC calls succeed;
- API contains no RDC customer-data integration.

---

## Phase 5 — Encrypted Cross-Device Sync

### Sprint 5.1 — Sync protocol + key design

**Outcome:** The sync model and key lifecycle are documented/testable before production cryptography is wired in.

Deliverables:

- sync record/version contract;
- conflict strategy;
- device identity design;
- encryption envelope format;
- key-management ADR;
- threat-model update.

Exit criteria:

- plaintext conversation content is not required by the synchronization store;
- key recovery/second-device enrollment behavior has an explicit design.

### Sprint 5.2 — Encrypted synchronization service

**Outcome:** Encrypted conversation payloads can round-trip through RDC Azure.

Deliverables:

- sync API;
- inexpensive Azure-native persistence;
- client authenticated encryption;
- delta/version synchronization;
- replay/idempotency handling.

Exit criteria:

- two clients can sync a synthetic conversation;
- Azure persistence contains ciphertext rather than message plaintext;
- offline edits queue and later synchronize.

### Sprint 5.3 — Multi-device conflict and recovery UX

**Outcome:** Sync behaves predictably when both devices edit while offline.

Deliverables:

- conflict handling;
- sync health/status;
- retry/backoff;
- device registration/revocation UX if required.

Exit criteria:

- common offline/edit/reconnect cases have deterministic outcomes;
- failures do not destroy local history.

---

## Phase 6 — Explicit Cloud Escalation

### Sprint 6.1 — Azure cloud AI provider

**Outcome:** `AzureFoundryProvider` can generate responses through the RDC cloud boundary.

Deliverables:

- server-side cloud AI integration;
- provider health/model metadata;
- token-safe client API;
- cost/telemetry guardrails.

Exit criteria:

- cloud credentials never reach the client;
- a cloud response stores provider/model metadata like any other assistant message.

### Sprint 6.2 — Take to Cloud / Return to Local

**Outcome:** One conversation can move between local and cloud providers.

Deliverables:

- explicit confirmation before sending context;
- Take to Cloud action;
- Return to Local action;
- clear per-response local/cloud indicators.

Exit criteria:

- provider switching does not fork or duplicate the conversation;
- user can see which provider generated each assistant response.

---

## Phase 7 — Product Hardening

### Sprint 7.1 — Reliability, testing, security

**Outcome:** Core flows are safe to use as a sustained personal/internal prototype.

Deliverables:

- unit/integration/e2e coverage for critical paths;
- CSP and browser security review;
- dependency/security scanning;
- logging that avoids conversation-content leakage;
- sync/inference error recovery.

### Sprint 7.2 — Installability + release workflow

**Outcome:** CrownKeep can be downloaded and installed by a normal Windows user without requiring PowerShell or a separately managed Foundry CLI, while repeatable iPhone installation/deployment paths also exist.

Deliverables:

- downloadable Windows setup executable;
- native desktop shell around the existing React UI where required for local runtime ownership;
- embedded Foundry Local SDK integration for normal-user installs;
- first-run model download/benchmark/setup flow;
- code-signing and Windows trust/reputation plan;
- release/versioning approach;
- CI build/test/release workflow;
- deployment environment conventions;
- install/update documentation;
- backup/export strategy for local conversation data.

---

## Phase 8 — Future RDC Context Contract (No Data Connection)

### Sprint 8.1 — ContextProvider contract

**Outcome:** The application has a stable extension point for future RDC context without accessing production RDC data.

Deliverables:

- `ContextProvider` interface;
- explicit context packet/domain types;
- synthetic provider/fixtures;
- permission/consent model notes;
- architecture for a future Entra-protected RDC Context API.

Exit criteria:

- providers can receive optional synthetic context separately from conversation history;
- no customer portal, Blueprint, dashboard, customer, or operational data is connected.

## Later / deliberately unscheduled

- real RDC Context API integration;
- RAG/vector search;
- document ingestion;
- MCP/tools;
- agents;
- voice/transcription;
- Ollama;
- additional native wrappers beyond the Windows desktop distribution path unless justified by a concrete capability gap.


---

## Backlog items to place in future sprints

### Collapsible navigation / controls

- Collapse Provider / Model controls behind a compact menu or settings surface.
- Make conversation navigation collapsible so the active chat gets priority screen space.
- Preserve quick visibility of the currently selected provider/model even when controls are collapsed.

### Projects

Introduce a Project entity that can group multiple conversations.

Initial design questions to resolve before implementation:

- whether a conversation can belong to one project or multiple projects;
- project title/description/metadata;
- local-only project persistence first;
- how projects sync across devices later;
- whether future ContextProvider data attaches at the project level;
- project archive/delete behavior without accidentally deleting conversations.

Projects should be implemented as an organizational layer above conversations, not as a replacement for the conversation model.

### Cross-conversation local recall

- Allow Anne to intentionally retrieve relevant recent content from other local conversations without automatically stuffing every conversation into the active prompt.
- Preserve explicit timestamps and conversation identity in retrieved context.
- Keep this local-first and permission-aware before any future cloud synchronization/context integration.
- Do not conflate this with the current active-conversation history, which remains isolated by default.
