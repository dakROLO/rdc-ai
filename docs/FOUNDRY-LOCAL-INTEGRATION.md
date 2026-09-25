# CrownKeep — Foundry Local Integration Notes

**Updated:** 2026-09-24

These notes capture current Microsoft-documented behavior that informs Sprint 2.1.

## Current documented integration surface

Foundry Local exposes an OpenAI-compatible REST API.

Relevant CLI operations:

```powershell
foundry server status
foundry server restart
foundry server restart --port 39839 --idle-timeout 0
```

`foundry server status` reports the active local endpoint.

By default, the local server may use a dynamic port. Microsoft documents using a fixed port when an application needs a stable address.

Relevant REST endpoints include:

- `POST /v1/chat/completions`
- `GET /openai/status`
- `GET /foundry/list`
- `GET /openai/models`
- model load/unload endpoints

The JavaScript/native SDK exists, but Microsoft currently describes the native SDK surface as preview/pre-release. CrownKeep therefore keeps Foundry Local behind its own `AIProvider` abstraction rather than coupling the conversation domain directly to the SDK.

## Sprint 2.1 direction

The first browser/PWA integration should prefer the documented local REST service.

Proposed development flow:

1. CrownKeep checks a configured local Foundry endpoint.
2. Provider health calls the local status endpoint.
3. Provider model discovery reads the local model endpoint/catalog.
4. Chat uses the OpenAI-compatible streaming chat-completions endpoint.
5. The endpoint setting is explicit and local-only.
6. No cloud credential is required.

A fixed local development port may be used for the first vertical slice, but the architecture should preserve endpoint configuration/discovery rather than embedding a permanent production port.

## Sources

- Microsoft Learn — Foundry Local CLI reference
- Microsoft Learn — Foundry Local REST API reference
- Microsoft Learn — Integrate inference SDKs with Foundry Local


## Implemented vertical slice

`FoundryLocalProvider` now:

- checks `GET /openai/status`;
- lists locally cached models with `GET /openai/models`;
- loads the selected cached model through `GET /openai/load/{name}`;
- sends `POST /v1/chat/completions` with `stream: true`;
- parses the documented server-sent event stream until `data: [DONE]`;
- stores the Foundry provider/model metadata on Anne's persisted response.

### First development setup

```powershell
foundry server restart --port 39839 --idle-timeout 0
foundry model download phi-4-mini
foundry server status
```

CrownKeep defaults to `http://localhost:39839`. Override it with the public-client environment value `VITE_FOUNDRY_LOCAL_ENDPOINT` when needed.

This setup keeps inference on the Windows device. It does not involve Azure inference or RDC data.
