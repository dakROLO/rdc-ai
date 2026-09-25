# RDC AI

**RDC AI** is a local-first conversational AI application for Windows and iPhone.

The goal is one conversation experience that can move between device-local AI and an RDC-hosted cloud AI provider without binding a conversation to any single model.

## Current status

**Phase 0 — Foundation** is in progress.

The repository is intentionally public. It contains application code, architecture, interfaces, synthetic test data, and deployment templates only. It must not contain RDC customer data, production credentials, secrets, access tokens, private Blueprint content, or production connection strings.

## Product direction

- Windows local inference through Microsoft Foundry Local.
- iPhone local inference through a small on-device model, initially using a browser/PWA-compatible provider.
- Offline-capable local conversations.
- Local persistent conversation storage.
- Microsoft Entra ID for authenticated RDC cloud capabilities.
- Client-side authenticated encryption for cross-device conversation synchronization.
- Explicit **Take to Cloud** escalation when stronger cloud reasoning is wanted.
- A future `ContextProvider` extension point for RDC data, with **no RDC data connection in the current project scope**.

## Durable project context

Start here before making changes:

- [Project Context](docs/PROJECT-CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Sprint Roadmap](docs/ROADMAP.md)
- [Decision Log](docs/DECISIONS.md)
- [Security Model](docs/SECURITY.md)
- [Current Status](docs/STATUS.md)
- [Agent Instructions](AGENTS.md)

Chat conversations are not the system of record. Decisions, completed work, blockers, and architectural changes must be reflected in this repository.

## Core architectural rule

A conversation does not belong to a model.

Provider and model metadata belong to individual assistant messages so one conversation can contain local Windows responses, local iPhone responses, cloud responses, and later local responses again.

## Scope boundary

The application may define interfaces for future RDC customer/project context, but it must not connect to RDC customer data, Blueprint data, dashboard data, or customer portal production resources until a later explicitly approved phase.

## License

A public-source license has not yet been selected. Until one is chosen, normal copyright applies.
