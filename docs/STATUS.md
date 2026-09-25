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


## Foundry Local API compatibility finding — 2026-09-24

- The development machine's current Foundry Local daemon returned HTTP 404 for the root path and the older `/openai/status` and `/openai/models` management routes.
- Current Microsoft Foundry Local examples use the OpenAI-compatible `/v1` service surface for external clients.
- CrownKeep now probes `/v1/models` first and falls back to the older management surface only when available.
- CrownKeep development also uses a Vite same-origin proxy to `http://127.0.0.1:39839` to avoid browser CORS becoming part of the local inference test.
- The current CLI requires a model to be loaded separately for this vertical slice; use `foundry model load phi-4-mini`.
- Conversation-history scrolling was changed so the app frame remains fixed and only the message pane scrolls.
- A floating **Latest** button appears when the user scrolls away from the bottom; after generation completes while away, it changes to **Anne finished**.


## Foundry Local live validation and responsive UX — 2026-09-24

- User confirmed CrownKeep discovered the loaded `phi-4-mini-instruct-openvino-gpu` model through `/v1/models`.
- User confirmed Anne generated a real local response through Foundry Local.
- This proves the first Windows local inference vertical slice is functioning.
- Anne's CrownKeep awareness comes from the explicit runtime system prompt plus conversation history; the local model does not automatically read the repository or RDC data.
- Canonical Anne runtime context moved to `src/assistant/anne.ts` with durable explanation in `docs/ANNE.md`.
- New-chat welcome text no longer incorrectly claims the mock provider when Foundry Local is selected later.
- Responsive layout hardening added for narrow portrait windows and medium-width desktop windows.
- Message cards now wrap aggressively and retain horizontal breathing room instead of touching/clipping the right edge.


## Shared roadmap visual — 2026-09-24

- Added `public/crownkeep-sprints.svg` as the shared at-a-glance project roadmap.
- The README now renders that SVG directly.
- CrownKeep now exposes a **Build Roadmap** viewer using the same SVG asset.
- `docs/ROADMAP.md` remains the detailed source of sprint scope and exit criteria.
- Added README guidance for ending a Foundry Local session: stop the server when finished, or unload the model if the server should remain running.


## UX / organization backlog note — 2026-09-24

- Move **Provider / Model selection** into a collapsible menu so inference controls do not permanently consume conversation-header space.
- Move the **conversation list** into a collapsible/navigation menu so the chat area can use more screen space, especially on narrow windows and mobile.
- Add a **Projects** concept for organizing groups of related conversations.
- Projects should group conversations without changing the core rule that each conversation remains provider-neutral and independently persisted.
- Project implementation is deferred; no data model or sync contract has been selected yet.


## Church AV PC Foundry Local validation — 2026-09-25

- CrownKeep successfully connected to Foundry Local on a second Windows machine.
- Foundry selected and loaded `phi-4-mini-instruct-generic-cpu`.
- During generation, total CPU reached roughly 98%; `foundrylocald` used the majority of CPU and about 3.5 GB memory.
- The response took at least 1–2 minutes to begin/complete, indicating that the generic CPU execution path is functionally compatible but not a good interactive default on this hardware.
- This is a hardware/performance limitation rather than evidence that CrownKeep's provider path is broken.
- Sprint 2.2 should surface execution-device/model-variant information and warn when a CPU-only model is likely to be slow.


## AVD execution-provider finding — 2026-09-25

- A church Azure Virtual Desktop with no physical GPU available was offered/loaded the `qwen2.5-0.5b-instruct-generic-gpu` variant using `WebGpuExecutionProvider`.
- Direct inference was extremely slow despite the catalog reporting Device=GPU.
- Conclusion: CrownKeep must not treat a catalog GPU label as proof of useful hardware acceleration in virtualized environments.
- For this AVD, explicitly force the CPU variant `qwen2.5-0.5b-instruct-generic-cpu` for comparison.
- Sprint 2.2 should add a lightweight local-inference benchmark / time-to-first-token check and recommend fallback variants when observed performance is poor.


## AVD CPU baseline — 2026-09-25

- Forced `qwen2.5-0.5b-instruct-generic-cpu:4` on the church AVD using `CPUExecutionProvider`.
- Direct non-streaming `/v1/chat/completions` request completed in approximately **0.97 seconds**.
- This proves the AVD can run a small local model interactively on CPU.
- The model did not follow the exact-response instruction reliably, which is a model-quality limitation rather than a runtime-performance problem.
- `foundry complete qwen2.5-0.5b ...` also returned quickly but ignored the exact wording request.
- Because direct API inference is fast while CrownKeep previously remained on an empty streamed response, the next debugging target is CrownKeep's streaming/SSE handling against the current Foundry Local build.
