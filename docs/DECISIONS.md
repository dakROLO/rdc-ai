# RDC AI — Decision Log

This file records project decisions that must survive beyond chat history.

## ADR-0001 — Public application repository

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

`dakROLO/rdc-ai` is a public repository.

The repository may contain application code, architecture, public-client configuration, deployment templates, and synthetic fixtures.

It must not contain real RDC customer data, private conversations, production credentials, tokens, secrets, or connection strings.

### Reason

The project is intended to be shareable while keeping sensitive RDC systems behind authenticated Azure APIs.

---

## ADR-0002 — RDC tenant is the cloud/security boundary

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

RDC Azure will host cloud-side resources for this project, including future encrypted synchronization and cloud AI capabilities.

### Constraint

Local inference and existing local conversation history must remain usable when RDC Azure is unavailable.

---

## ADR-0003 — Microsoft Entra ID for cloud authentication

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Use the existing RDC Microsoft Entra tenant for authentication to protected cloud capabilities.

Do not create a separate username/password system.

The PWA/client is treated as a public client and must not contain a client secret.

---

## ADR-0004 — No RDC production-data connection in current project scope

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

The architecture will define a future `ContextProvider`, but the application will not connect to RDC customer, Blueprint, dashboard, project, document, or operational data in the current roadmap.

Synthetic fixtures may be used to validate the interface.

---

## ADR-0005 — Local-first, provider-neutral conversations

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

A conversation is not bound to one model/provider.

Assistant messages record provider ID, model ID, and local/cloud classification individually.

---

## ADR-0006 — Shared TypeScript/React PWA first

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Prefer one TypeScript/React application delivered first as an installable PWA for iPhone and Windows-capable browsers.

Do not introduce a native wrapper unless a concrete capability requires it.

---

## ADR-0007 — Initial local providers

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Initial provider targets are:

- Windows: Microsoft Foundry Local.
- iPhone/web: WebLLM/WebGPU-style on-device provider where supported.
- Cloud: Azure-hosted provider behind the RDC API in a later phase.

Ollama is not part of the initial implementation.

---

## ADR-0008 — Client-side encrypted synchronization

**Status:** Accepted in principle; key design pending  
**Date:** 2026-09-24

### Decision

Cross-device synchronization will use client-side authenticated encryption so the Azure sync store does not require plaintext conversation contents.

### Open decision

The key hierarchy, enrollment, recovery, rotation, and device-revocation design must be completed before implementation.

---

## ADR-0009 — Repository documentation is the project system of record

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Important decisions, completed work, blockers, and architecture changes must be reflected in repository documentation.

Chat history is not authoritative project context.


---

## ADR-0010 — Foundation web toolchain

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Use the current official Vite React/TypeScript application pattern as the Phase 0 foundation.

Initial dependency baseline:

- React 19.3;
- Vite 8.3;
- TypeScript 6.0.x;
- official Vite React plugin;
- Oxlint for the initial lint step.

### Reason

This keeps the foundation close to the current upstream Vite React TypeScript template and minimizes custom build tooling before local inference work begins.


---

## ADR-0011 — CrownKeep product identity and Anne assistant

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

The working product identity is **CrownKeep** with the tagline:

> **Private by default. Powerful by choice.**

The conversational assistant is named **Anne**.

The canonical palette is:

- Graphite `#0F1F1E`
- Deep Jade `#115E4F`
- Jade Glow `#2EE6B8`
- Burnished Copper `#C97F5B`
- Stone `#E8E4DA`

The canonical visual direction is the Inner Keep mark documented in `docs/BRAND.md`.

---

## ADR-0012 — Native IndexedDB for first local persistence implementation

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Use browser-native IndexedDB behind the existing `ConversationRepository` abstraction for the first persistent local store.

### Reason

It keeps Sprint 1.1 dependency-light, works offline, is available in the PWA/browser target, and preserves the ability to replace the storage implementation later without changing the conversation domain.

### Constraint

IndexedDB is an implementation detail. UI and provider code must depend on the repository abstraction rather than IndexedDB directly.

---

## ADR-0013 — IDs must work on LAN HTTP development origins

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Do not depend directly on `crypto.randomUUID()` for application IDs.

Use `crypto.getRandomValues()` when available, with a development fallback, so basic same-network phone testing does not fail solely because the app is being served over a non-HTTPS LAN origin.


---

## ADR-0014 — Message order uses a persisted sequence

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Every persisted message receives a monotonic `sequence` within its conversation.

`createdAt` remains a timestamp, but it is not the authoritative ordering key.

### Reason

Two messages can be created within the same millisecond. Timestamp-only sorting allowed an assistant response and its triggering user message to swap positions after an IndexedDB reload.

IndexedDB schema version 2 migrates version-1 records to deterministic sequence positions.

---

## ADR-0015 — Foundry Local REST provider with configurable fixed development endpoint

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

CrownKeep's first Windows Foundry Local integration uses the documented OpenAI-compatible REST service behind `FoundryLocalProvider`.

Development defaults to:

```text
http://localhost:39839
```

The endpoint is configurable through `VITE_FOUNDRY_LOCAL_ENDPOINT`.

### Reason

A browser application cannot execute `foundry server status` directly. Microsoft Foundry Local normally uses a dynamic port, but its CLI supports starting/restarting the daemon on a fixed port for application integration.

The fixed port is a development/distribution convention, not a credential or permanent architectural coupling.


---

## ADR-0016 — Prefer the current OpenAI-compatible Foundry Local /v1 surface

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

CrownKeep probes and consumes the current Foundry Local OpenAI-compatible HTTP surface first:

- `GET /v1/models`
- `POST /v1/chat/completions`

The older `/openai/*` management surface is compatibility fallback only.

For the first browser-based Windows vertical slice, model loading is performed through the Foundry CLI rather than relying on an HTTP management endpoint.

### Reason

The active development-machine CLI reported Ready but returned 404 for the older management routes. Current Microsoft examples for external clients use the `/v1` base URL.

A Vite development proxy forwards `/foundry-local/*` to the loopback Foundry service to avoid CORS coupling during development.


---

## ADR-0017 — Stable development origin for local storage

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Vite development uses port `5173` with `strictPort: true`.

If port 5173 is already occupied, CrownKeep development must fail visibly rather than silently moving to another port.

### Reason

Browser IndexedDB is scoped to the web origin. Because the port is part of the origin, `http://localhost:5173` and `http://localhost:5174` receive different local databases. Silent Vite port fallback made existing conversations appear to disappear even though they remained stored under the original origin.

This is a development-only concern. The future installed Windows application must use a stable application storage location/origin.

---

## ADR-0018 — Temporal context and reversible message exclusion

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Every inference request receives device-generated temporal metadata:

- current device-local date/time;
- device IANA time zone when available;
- current UTC timestamp;
- conversation creation timestamp;
- original persisted timestamps attached to included historical messages.

CrownKeep also allows an individual persisted message to be marked `excludedFromContext`.

Excluded messages remain visible in local conversation history but are omitted from future inference requests until restored.

### Reason

Anne needs explicit time metadata to answer relative-time questions such as “today,” “earlier,” or “what did we discuss in the last 20 minutes.”

Context management should not require deleting the user's local record. Reversible exclusion separates **conversation history** from **active model context**.

### Scope

This enables temporal reasoning within the active conversation. It does not yet provide automatic recall across separate conversations. Cross-conversation local recall remains a later feature.


---

## ADR-0019 — Separate inference from runtime lifecycle management

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Keep local AI inference behind `AIProvider`, and manage native runtime/model lifecycle behind a separate `LocalRuntimeManager` contract.

The browser development implementation may inspect an externally managed Foundry Local service but must not pretend it can install, start, stop, load, or unload native runtime resources.

A later Windows desktop host will implement those lifecycle actions natively while reusing the same React first-run setup UI.

### Reason

This avoids coupling conversation/provider logic to PowerShell or a particular desktop wrapper and provides a stable seam for moving from today's developer workflow to a downloadable Windows application.

Observed model performance remains part of setup validation so CrownKeep can avoid preferring a poorly performing device variant merely because it is labeled GPU.


---

## ADR-0021 — Projects are a local organizational layer above conversations

**Status:** Accepted for MVP  
**Date:** 2026-09-25

### Decision

Introduce a `Project` entity above conversations for organization.

For the first implementation:

- a conversation belongs to zero or one project;
- projects are stored locally in IndexedDB;
- assigning or moving a conversation does not change its provider-neutral identity or message history;
- deleting a project does **not** delete its conversations; affected conversations become unassigned;
- deleting a conversation remains an explicit, separate action;
- Projects do not automatically add other project conversations to Anne's inference context.

### Reason

A single optional `projectId` keeps the local data model simple and deterministic while leaving room for later sync and project-level context features.

Project deletion must be non-destructive because Projects are an organizational structure, not the owner of conversation data.

### Future

Encrypted sync will eventually need to synchronize Project records and conversation membership.

Project-level context/recall is a separate capability and must not be inferred merely from organizational membership.
