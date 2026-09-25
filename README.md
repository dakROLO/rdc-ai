# RDC AI

**RDC AI** is a local-first conversational AI application for Windows and iPhone.

The goal is one conversation experience that can move between device-local AI and an RDC-hosted cloud AI provider without binding a conversation to any single model.

## Current status

**Phase 0 — Foundation / Sprint 0.2 — Application Shell** is in progress.

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
- [Testing Guide](docs/TESTING.md)
- [Naming Notes](docs/NAMING.md)
- [Agent Instructions](AGENTS.md)

Chat conversations are not the system of record. Decisions, completed work, blockers, and architectural changes must be reflected in this repository.

## Local development

Prerequisite: a current Node.js 22 release.

From the folder where you want the project to live:

```powershell
git clone https://github.com/dakROLO/rdc-ai.git
Set-Location .\rdc-ai
npm install
npm run dev
```

**Important:** after cloning, change into the new `rdc-ai` folder before running `npm install`. If npm reports that it cannot find `package.json`, check that your prompt ends in `\rdc-ai>`.

Validation:

```powershell
npm run lint
npm run build
```

The current application uses a mock local provider so the conversation/provider plumbing can be tested before Foundry Local is connected. See [Testing Guide](docs/TESTING.md) for the current Windows and PWA test procedure.

## Current foundation structure

```text
src/
├── auth/       # Entra-facing abstraction; no live auth yet
├── context/    # Future RDC context contract; no RDC data connection
├── domain/     # Conversation/message model
├── providers/  # AIProvider contract + mock provider
├── storage/    # Local conversation repository contract
└── sync/       # Encrypted sync transport contract
```

PWA metadata and the service worker live under `public/`.

## Configuration

`.env.example` contains public-client placeholders only.

Never place a secret in a `VITE_*` variable because Vite client variables are shipped to the browser.

## Core architectural rule

A conversation does not belong to a model.

Provider and model metadata belong to individual assistant messages so one conversation can contain local Windows responses, local iPhone responses, cloud responses, and later local responses again.

## Scope boundary

The application may define interfaces for future RDC customer/project context, but it must not connect to RDC customer data, Blueprint data, dashboard data, or customer portal production resources until a later explicitly approved phase.

## License

A public-source license has not yet been selected. Until one is chosen, normal copyright applies.
