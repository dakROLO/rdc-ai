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
