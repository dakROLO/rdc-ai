# AGENTS.md

## Purpose

This file defines the working rules for humans and coding agents contributing to RDC AI.

## Source of truth

The repository is the durable project context. Do not rely on chat history as the authoritative record.

Before substantial work, read:

1. `docs/PROJECT-CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/DECISIONS.md`
5. `docs/STATUS.md`
6. `docs/SECURITY.md`

After meaningful work:

- update `docs/STATUS.md`;
- update `docs/DECISIONS.md` when a decision is made or changed;
- update architecture/roadmap docs when scope or design changes;
- do not leave an important decision only in a commit message or chat.

## Product principles

- Local first.
- One shared conversation across providers.
- Local chat should remain usable without RDC Azure.
- Cloud escalation is explicit, never automatic in the initial product.
- Authentication, inference, conversation storage, synchronization, and RDC context are separate concerns.
- Provider/model metadata belongs to assistant messages, not to the conversation itself.
- Prefer one shared TypeScript/React codebase.
- Keep provider implementations behind stable interfaces.
- Keep RDC data integration behind a future `ContextProvider`.

## Public repository rules

Never commit:

- secrets;
- passwords;
- private keys;
- client secrets;
- access/refresh tokens;
- production connection strings;
- real RDC customer data;
- real Blueprint/customer records;
- private conversation exports;
- confidential tenant configuration that is not required by a public client.

Public identifiers such as Entra tenant IDs, app/client IDs, redirect URIs, API audience/scope names, and public service URLs may be committed only when they are intentionally public-client configuration and do not grant access by themselves.

Use environment variables/configuration for deployment-specific values.

## RDC data boundary

Current scope includes the concept and interface for future RDC context, but **no connection to RDC operational/customer data**.

Do not connect to the customer portal database, production Blueprints, dashboards, customer records, or production documents.

Synthetic fixtures are allowed and preferred for development.

## Azure boundary

RDC Azure will provide cloud-side capabilities such as:

- Entra-protected APIs;
- encrypted conversation synchronization;
- device registration if needed;
- cloud AI escalation;
- future context APIs.

Azure must not be required for ordinary local inference or reading existing local conversations.

Prefer managed identity and Key Vault for server-side Azure access. Never place server credentials in the PWA/client.

## Change discipline

Keep changes small and testable. Avoid broad rewrites.

When implementing a sprint:

1. confirm the sprint outcome in `docs/ROADMAP.md`;
2. implement the smallest vertical slice;
3. add/update tests;
4. record completion and remaining gaps in `docs/STATUS.md`;
5. record new architectural decisions in `docs/DECISIONS.md`.

## Non-goals until explicitly scheduled

Do not add these opportunistically:

- RAG/vector databases;
- Ollama;
- MCP;
- autonomous agents;
- voice/transcription;
- document ingestion;
- RDC dashboard/customer data access;
- automatic local-to-cloud routing;
- expensive Azure infrastructure.
