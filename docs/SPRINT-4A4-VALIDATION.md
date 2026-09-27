# Sprint 4A.4 — System Foundry Convergence Validation

**Branch:** `sprint-4a3-local-platform-convergence`  
**Status:** Windows System Foundry bridge implemented; physical acceptance required.

## 4A.4D–4F contract, roles, and cleanup readiness — 2026-09-27

- The observed Foundry 0.10.3 contract is now typed: `foundry status --output json` supplies `system`, `service`, `models`, and `connectivity`; `foundry server status --output json` supplies the current `webUrls`; and model lists use the single `variants[]` root.
- CrownKeep treats `alias` as the role/startup preference and `variantId` as evidence. `type`, `device`, `executionProvider`, `fileSizeMb`, and `cached` are the current catalog facts; missing task, context-window, and tool-call fields remain unset.
- Packaged endpoint use re-reads server status and retries one fresh endpoint once if a request fails. It does not fall back to port 39839. Normal status uses Foundry's `available`, `loaded`, and `cached` counts without catalog enumeration.
- Foundry status is the primary durable Windows hardware source. The fingerprint excludes transient available memory and includes OS, architecture, CPU, installed RAM, GPU/NPU facts, and Foundry runtime versions.
- Model Analyst groups variants by alias. Quick retains `phi-4-mini` bootstrap; Balanced advances through a small live Chat-family shortlist after current-fingerprint failures; Deep remains gated; Speech is Voice-only. System Foundry chooses the activated variant and CrownKeep synchronizes the API-visible model.
- Diagnostics now perform a read-only inventory of `%USERPROFILE%\\.CrownKeep\\cache\\models` (existence, approximate size, top-level package folders). It is explicitly not used by normal Windows chat and has no deletion control. The remaining `FoundryLocalConfig::new("CrownKeep")` dependency is Windows dictation and dormant legacy commands only.

## 4A.4G–4I final convergence package — 2026-09-27

- Normal status no longer walks the legacy cache. It reports only path, existence, and pending cleanup; the detailed size/package inventory is an explicit diagnostics action on a blocking worker.
- Foundry device values are normalized once at the native bridge (`Gpu`/`Cpu`/`Npu` → `GPU`/`CPU`/`NPU`). Cache-location JSON accepts either a string or `path`/`location`/`cacheLocation`, then uses the single narrow text fallback.
- Windows dictation now loads a System Foundry **Voice alias**, sends the temporary WAV to the current local `/v1/audio/transcriptions` endpoint, and restores the previous chat alias. The legacy SDK transcription command is not registered. Physical Foundry 0.10.3 transcription-endpoint confirmation remains required before acceptance.
- The initial iOS/shared tool proof uses the existing registries: `/search <query>` reads local `Inside the Keep` knowledge and `/url <https://…>` is read-only and explicitly network-marked. Results are supplied to the current provider as tool context; this never switches to a cloud model. Native iOS OCR/image analysis remains the next small proof because no current image bridge is registered.

## 4A.4J — pre-test cleanup and code freeze — 2026-09-27

### Implemented

- Windows Voice captures the currently loaded **Chat alias** before loading Voice, resolves the actual loaded Speech `variantId`, sends that ID to the local transcription endpoint, and restores/verifies the captured Chat alias on success or failure.
- Voice discovery uses `crownkeep_system_foundry_models`; no normal webview speech path calls the old CrownKeep SDK catalog.
- Legacy cache status is cheap and read-only. Detailed size/package inspection is explicit; no delete or migration control exists.

### Automated-validated

- TypeScript, unit tests, lint, and production build pass in this workspace. Native Rust and unsigned iOS builds require the physical build hosts.

### Physical-test-pending

- Confirm the installed Foundry service exposes `/v1/audio/transcriptions`, returns the loaded Speech variant, and restores Quick or Balanced after a real dictation request.
- Confirm Windows/AVD diagnostics and Rolo15 Apple Foundation Models/native speech baseline.

### Deferred

- Foundation Models automatic tool definitions/selection and image analysis. `/search` and `/url` are manual registered tool commands, not automatic model-selected tools.

## 4A.4C bridge hardening findings — 2026-09-27

- The first bridge split human-readable CLI rows on whitespace. That is not a valid application contract because Foundry table output can change or wrap.
- System Foundry candidates also lacked type/task metadata, which could make existing chat classification reject them.
- Endpoint discovery performed too much work and cached a packaged-app endpoint despite System Foundry being able to restart on another port.

The bridge now requests `--output json` for System Foundry status and model lists, keeps the one-value `cache location` command as a documented narrow fallback, and runs CLI work off the Tauri async executor. Packaged Windows requests ask the native host for the current endpoint each time before probing `/v1/models`; browser development behavior is unchanged.

## Implemented contract proofs

- `LocalRuntime` is provider-neutral: shared code asks for capabilities, roles, activation, health, and loaded model without assuming Foundry.
- `ToolRegistry` marks each tool's network, access, authentication, and photo/camera boundary. The initial local-search proof is read-only and keeps inference local.
- `KnowledgeSource` and `KnowledgeRegistry` are generic. `LocalKnowledgeSource` is synthetic/local only; no RDC data is connected.
- Normal model modes are named **Quick**, **Balanced**, and **Deep**. A non-Quick mode still requires a representative-context validated benchmark.
- Windows packaged builds now use the installed `foundry` CLI for cache location, catalog/cache discovery, service control, alias download/load/unload, and cache removal. The provider obtains the active service URL from that same System Foundry instance rather than assuming port 39839.
- CrownKeep saves/restores Quick by alias. After activation it waits for `/v1/models` and adopts the actual System Foundry variant as the chat model ID; a mismatch blocks Send.
- Diagnostics label the System Foundry cache and the untouched legacy CrownKeep cache separately.

## Windows laptop / AVD handoff

Run these in both environments. Do not create environment-specific policy.

1. Run `foundry status --output json`, `foundry server status --output json`, `foundry cache location`, `foundry model list --variants --output json`, and `foundry model list --loaded --variants --output json`; attach only non-sensitive results to the sprint evidence.
2. Start CrownKeep and confirm Diagnostics shows the exact same System Foundry cache location and a separate legacy-cache note. Record runtime version, service URL, loaded model, and selected alias/actual variant.
3. Verify Quick chat, restart, Quick restoration, rerun, and a model download/cache operation through the system Foundry environment. Dictation is intentionally not revalidated for this bridge; it remains on the prior SDK path and must not be used as evidence that System Foundry convergence is complete.
4. Benchmark Balanced. Run its representative-context and normal-chat checks before it becomes selectable. Attempt Deep only after Quick and Balanced are stable.
5. Verify that selected model, System Foundry loaded model, and `/v1/models` model agree before sending; deliberately try a missing alias and verify chat stays blocked with a diagnostic.
6. Inventory, but do not delete, `%USERPROFILE%\.CrownKeep\cache\models`. Record system versus legacy size and the models protected for Quick/Balanced/Deep/Voice. Confirm no new files appear there after a CrownKeep non-Quick download.

## Rolo15 handoff

1. Confirm Apple Foundation Models supplies Quick and no unsupported Balanced/Deep mode is shown as ready.
2. Validate local streaming, conversation/project persistence, native dictation review-before-send, local-search proof, image-analysis proof, and restart behavior.
3. Confirm no cloud-model fallback occurs when the local runtime is unavailable.

## Cleanup gate

Legacy cache cleanup remains **blocked** until all three acceptance paths are recorded. Use Foundry's supported cache lifecycle only; never delete the `.CrownKeep` directory or conversation, Project, settings, tool, knowledge-source, or benchmark data.
