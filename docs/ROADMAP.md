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

### Sprint 2.2 — Windows local experience hardening — **IN PROGRESS**

#### Sprint 2.2A — Local AI diagnostics and control surface — **IMPLEMENTED · VALIDATION PENDING**

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

#### Sprint 2.2B — Runtime lifecycle + first-run setup — **IMPLEMENTED FOUNDATION · VALIDATION PENDING**

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

### Sprint 3.1 — Mobile capability detection + model lifecycle

**Outcome:** The PWA can determine whether local mobile inference is supported.

Deliverables:

- `WebLLMProvider` adapter;
- WebGPU/browser capability checks;
- model download/cache state;
- storage/quota messaging;
- unsupported-device fallback UX.

Exit criteria:

- supported/unsupported state is explicit;
- model lifecycle does not block access to saved conversations.

### Sprint 3.2 — Mobile local conversation

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

## Phase 4 — RDC Cloud Identity & API Foundation

### Sprint 4.1 — Entra authentication

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

### Sprint 4.2 — Minimal Azure API foundation

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

### Projects — MVP IMPLEMENTED ON `feature-projects`

Introduce a Project entity that can group multiple conversations.

MVP decisions:

- a conversation belongs to zero or one project;
- projects persist locally first;
- project deletion unassigns conversations rather than deleting them;
- project membership is organizational and does not automatically enter model context;
- project records and membership will need sync treatment later.

Implemented on the feature branch:

- create / rename / delete projects;
- All chats / Unassigned / project filters;
- assign or move conversations;
- create a new conversation directly inside the selected project.

Future work:

- project descriptions/metadata;
- archive behavior;
- cross-device sync;
- intentional project-level local recall/context;
- possible future ContextProvider attachment at project level.

Projects remain an organizational layer above conversations, not a replacement for the conversation model.

### Cross-conversation local recall

- Allow Anne to intentionally retrieve relevant recent content from other local conversations without automatically stuffing every conversation into the active prompt.
- Preserve explicit timestamps and conversation identity in retrieved context.
- Keep this local-first and permission-aware before any future cloud synchronization/context integration.
- Do not conflate this with the current active-conversation history, which remains isolated by default.
