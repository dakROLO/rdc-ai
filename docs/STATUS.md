# CrownKeep — Current Status

**Updated:** 2026-09-24

## Active phase

Phase 2 — Windows Local AI

## Active sprint

Sprint 2.1 — Foundry Local connectivity

Sprint 0.2 implementation is complete, with install/offline validation still pending.

## Completed

- Public repository established with durable architecture, security, roadmap, decisions, testing, and agent context.
- CrownKeep selected as the working product identity.
- Tagline selected: **Private by default. Powerful by choice.**
- Assistant identity selected: **Anne**.
- Brand palette established: Graphite, Deep Jade, Jade Glow, Burnished Copper, and Stone.
- CrownKeep Inner Keep logo added as SVG plus 192×192 and 512×512 PWA icons.
- React/TypeScript/PWA application shell and CI established.
- Mock provider streaming and cancellation path established.
- Windows local Vite UI test passed.
- Added secure-context-safe local ID generation to avoid reliance on `crypto.randomUUID()` over LAN HTTP.
- Added native IndexedDB conversation repository with schema version 1.
- Added create/list/open/rename/delete conversation flows.
- Added persistent message storage.
- Added automatic local-only conversation titles from the first user message.
- Added local-only state language: **Inside the Keep** / **Stored on this device**.
- Recorded the development PC's observed Foundry Local model catalog for Phase 2 planning.

## In progress

- Validate the IndexedDB version-2 ordering migration on existing conversations.
- Connect CrownKeep to the Foundry Local daemon on Windows.
- Validate cached-model discovery and automatic model loading.
- Generate a real streamed Anne response through Foundry Local.
- Validate provider failure handling without corrupting local conversation history.
- Validate Windows PWA installation/offline shell.

## Next exit target

Close Sprint 2.1 after confirming:

- CrownKeep reports Foundry Local health;
- at least one cached local model appears in the model selector;
- Anne can stream a real response from that model;
- refreshing preserves the correct user/assistant message order;
- stopping or failing a Foundry response does not corrupt the conversation.

## Current blockers

None identified.

## Validation evidence

- GitHub Actions foundation CI: **passed**.
- GitHub Actions Sprint 1.1 compile/lint validation: **passed**.
- Windows Vite UI and mock chat: **passed**.
- Same-network phone test before fix: **failed with background-only render**.
- Likely compatibility issue addressed by removing direct dependency on `crypto.randomUUID()`.
- Sprint 1.1 manual persistence validation: **passed by user**.
- PWA installation/offline validation: **pending**.

## Open architectural decisions

- Exact iPhone local model/provider selection after capability testing.
- Azure sync persistence service.
- Sync key hierarchy and recovery/enrollment model.
- Cloud AI model/deployment selection.
- Public-source license.


## User validation — 2026-09-24

- Sprint 1.1 persistence flows reported working correctly.
- User identified one carryover UX issue: Enter did not submit chat on Windows.
- Sprint 1.2 now implements **Enter to send** and **Shift+Enter for newline**.
- Provider registry added.
- Provider/model selectors added.
- Two development mock providers are available in Vite development mode specifically to validate that provider switching does not fork the conversation.


## User validation — provider-neutral sprint

- Enter-to-send worked.
- Provider switching worked inside one conversation.
- The user identified a reload ordering defect: messages created in the same millisecond could reload in the wrong order.
- IndexedDB schema is now version 2 and stores an explicit per-conversation `sequence` for every message.
- Legacy version-1 messages are migrated to deterministic sequence positions on database upgrade.
- Sprint 1.2 is complete; Sprint 2.1 is active.
- `FoundryLocalProvider` now implements health, cached-model discovery, model load, and SSE streaming through the documented local REST API.
