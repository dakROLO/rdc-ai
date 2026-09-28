# CrownKeep

> **Private by default. Powerful by choice.**

**CrownKeep** is a local-first conversational AI application for Windows and iPhone. The assistant inside CrownKeep is **Anne**.

The product is designed around one durable conversation experience that can use device-local AI whenever practical and later move explicitly to RDC-hosted cloud AI without binding a conversation to a single model.

## Roadmap

![CrownKeep Sprint Roadmap](public/crownkeep-sprints.svg)

The visual above is shared with the CrownKeep app. Detailed sprint definitions and exit criteria live in [docs/ROADMAP.md](docs/ROADMAP.md).

## Current status

**Phase 4A — Local Platform Convergence / Sprint 4A.4 acceptance is active.**

Current baseline:

- shared provider-neutral CrownKeep conversation experience on Windows and iPhone;
- Windows System Foundry authority with Quick/Balanced/Deep role policy and observed benchmark evidence;
- physical Windows Quick, Balanced Mistral Nemo, exclusive model switching, and local dictation validated;
- Rolo15 current convergence build physically validated for Apple Foundation Models chat, follow-up context, native on-device dictation, and restart/persistence;
- persistent compact status bar restored with role/model/execution, Inside-the-Keep boundary, runtime state, and Web Access state;
- provider-neutral Web Access foundation implemented with **OFF by default**, bounded read-only Web Search/Web Read tools, source/activity metadata, and no search-provider secret in the client;
- Windows structured tool use is enabled only when function-calling support is observed; otherwise CrownKeep uses the bounded provider-neutral fallback; iPhone uses the matching Apple Foundation Models Tool boundary;
- the narrow CrownKeep Web Gateway implementation exists, but live gateway deployment/configuration and physical Web OFF/ON acceptance are still pending;
- AVD acceptance remains pending under the same adaptive Windows policy;
- no silent cloud-model fallback and no live RDC customer-data connection.

Next acceptance work is to keep CI green, deploy/configure the test Web Gateway, physically validate Web Access on the Windows laptop and Rolo15, and then run the same shared acceptance policy on AVD. Multimodal/image work follows this web/tool foundation and remains an explicit privacy boundary.

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

See [Testing Guide](docs/TESTING.md) for the current sprint acceptance procedure, including the **Fresh Windows machine** setup path.

### Foundry Local development

The first real Windows-local integration expects Foundry Local on a stable loopback port:

```powershell
foundry server restart --port 39839 --idle-timeout 0
foundry model download phi-4-mini
foundry model load phi-4-mini
foundry server status
```

Then run CrownKeep and choose **Anne · Foundry Local**.

## Core architectural rule

A conversation does not belong to a model.

Provider/model metadata belongs to individual assistant messages so the same conversation can later contain responses from Anne via Foundry Local, an iPhone-local model, CrownKeep cloud AI, and local AI again.

## Scope boundary

The application contains a future `ContextProvider` interface but does not connect to RDC customer, Blueprint, dashboard, document, or operational data.

## License

A public-source license has not yet been selected. Until one is chosen, normal copyright applies.


## End a local development session

If you are finished with local AI for the day, the simplest cleanup is:

```powershell
foundry server stop
```

That stops the Foundry Local daemon and local inference service.

If you want to keep the daemon running but free the loaded model from memory:

```powershell
foundry model unload phi-4-mini
```

Downloaded model files remain in the Foundry cache, so unloading or stopping the server does not require re-downloading the model next time.
