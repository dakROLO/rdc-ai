# CrownKeep

> **Private by default. Powerful by choice.**

**CrownKeep** is a local-first conversational AI application for Windows and iPhone. The assistant inside CrownKeep is **Anne**.

The product is designed around one durable conversation experience that can use device-local AI whenever practical and later move explicitly to RDC-hosted cloud AI without binding a conversation to a single model.

## Current status

**Phase 1 — Local Conversation Core / Sprint 1.1 — Local Persistence** is in progress.

Current build:

- CrownKeep brand and Anne assistant identity;
- local-only IndexedDB conversation storage;
- create/open/rename/delete conversations;
- messages survive browser refresh;
- mock local streaming provider;
- responsive Windows/mobile browser UI;
- future cloud controls intentionally disabled;
- no RDC customer data connection.

## Privacy boundary

The repository is intentionally public, but real user/customer data is not.

Current local conversations are stored in the browser's local IndexedDB database on that device. No Azure synchronization, Entra sign-in, cloud AI, or RDC customer-data integration is connected yet.

## Durable project context

Start here before making changes:

- [Project Context](docs/PROJECT-CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Sprint Roadmap](docs/ROADMAP.md)
- [Decision Log](docs/DECISIONS.md)
- [Security Model](docs/SECURITY.md)
- [Current Status](docs/STATUS.md)
- [Testing Guide](docs/TESTING.md)
- [Brand System](docs/BRAND.md)
- [Foundry Local Device Snapshot](docs/FOUNDRY-LOCAL-DEVICE.md)
- [Naming Notes](docs/NAMING.md)
- [Agent Instructions](AGENTS.md)

Chat conversations are not the system of record. Decisions, completed work, blockers, and architectural changes must be reflected in this repository.

## Local development

Prerequisite: Node.js 22 and Git.

```powershell
git clone https://github.com/dakROLO/rdc-ai.git
Set-Location .\rdc-ai
npm install
npm run dev
```

If the repository is already cloned:

```powershell
Set-Location .\rdc-ai
git pull
npm install
npm run dev
```

For same-network phone testing:

```powershell
npm run dev -- --host
```

Use the Network URL printed by Vite rather than `localhost`.

Validation:

```powershell
npm run lint
npm run build
```

See [Testing Guide](docs/TESTING.md) for the current sprint acceptance procedure.

## Core architectural rule

A conversation does not belong to a model.

Provider/model metadata belongs to individual assistant messages so the same conversation can later contain responses from Anne via Foundry Local, an iPhone-local model, CrownKeep cloud AI, and local AI again.

## Scope boundary

The application contains a future `ContextProvider` interface but does not connect to RDC customer, Blueprint, dashboard, document, or operational data.

## License

A public-source license has not yet been selected. Until one is chosen, normal copyright applies.
