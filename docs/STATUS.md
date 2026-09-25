# CrownKeep — Current Status

**Updated:** 2026-09-24

## Active phase

Phase 1 — Local Conversation Core

## Active sprint

Sprint 1.2 — Provider-neutral streaming chat

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

- Validate Enter-to-send and Shift+Enter behavior on Windows.
- Validate provider/model selection without creating a new conversation.
- Validate switching between the two development mock providers in the same conversation.
- Validate Windows PWA installation/offline shell.
- Establish an HTTPS test deployment for iPhone PWA validation.

## Next exit target

Close Sprint 1.2 after confirming:

- Enter sends and Shift+Enter creates a newline;
- provider selection does not create a new conversation;
- model/provider metadata remains attached to assistant messages;
- streaming and cancellation still work after provider changes.

Then begin Sprint 2.1 — Foundry Local connectivity.

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
