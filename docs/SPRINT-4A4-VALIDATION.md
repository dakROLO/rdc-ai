# Sprint 4A.4 — System Foundry Convergence Validation

**Branch:** `sprint-4a3-local-platform-convergence`  
**Status:** Local Windows/Rolo15 convergence baseline physically proven as recorded below; native direct Web Access implemented and automated-validated; Windows/Rolo15/AVD Web physical acceptance still required.


## 4A.4K–4L — provider-neutral Web Access + native direct transport — 2026-09-28

### Implemented

- Restored the persistent compact status bar showing role/model/execution state, Inside-the-Keep boundary, Ready/Working/Benchmarking/Sleeping/Error, and Web Access OFF/ON without replacing detailed Local AI diagnostics.
- Added persisted `Web Access` state, default **OFF**. `ToolRegistry` rejects a network tool before `isAvailable()` or `execute()` while OFF, so the disabled state cannot trigger a hidden network probe.
- Provider-neutral `WebSearchTool` and `WebReadTool` preserve source metadata and explicitly report when data left the device.
- The initial Azure Function/Web Gateway prototype was removed **before physical acceptance**. Current Web Access has no CrownKeep-hosted network middleman.
- Windows native direct transport:
  - the Tauri/Rust host calls the configured search provider directly;
  - Tavily is the first search adapter;
  - the user-supplied search credential is stored in **Windows Credential Manager**;
  - the React/webview layer can save/remove the credential and read configuration status, but the stored secret is never returned to it;
  - Web Read fetches the selected public HTTP(S) page directly and does not require the search credential.
- iPhone native direct transport:
  - the Swift host calls the configured search provider directly with `URLSession`;
  - Tavily is the first search adapter;
  - the user-supplied search credential is stored in **iOS Keychain** with a device-local, non-synchronizing accessibility class;
  - the JavaScript bridge can save/remove the credential and read configuration status, but the stored secret is never returned to it;
  - Web Read fetches the selected public HTTP(S) page directly and does not require the search credential.
- Browser-only development does not store a live search-provider credential and reports native Web Access unavailable.
- Automatic fallback tool use is bounded to the current prompt only: ordinary/local questions cause no network call; current/external intent may search; source-detail intent may add at most two selected webpage reads. Total read-only web operations are capped at three for one turn.
- `FoundryLocalProvider` supports OpenAI-compatible structured function definitions/tool-call streaming. Model Analyst performs a harmless **local** function-call capability probe only after a candidate passes its normal-context benchmark. Structured tools are enabled only from current-fingerprint observed support; unknown/unsupported models stay on the bounded fallback.
- Native iPhone exposes the same logical `web-search` / `web-read` capabilities as Apple Foundation Models `Tool` objects. Web Access OFF exposes no native network tools.
- Web content is injected back as **untrusted reference data** and never treated as instructions.
- Assistant messages preserve reasoning-provider metadata separately from tool activity, including `Used web search`, `Read N webpages`, failed web attempts, and source URLs/titles. Using the web does not relabel a local reasoning response as cloud AI.
- No RDC customer-data/knowledge connection was added.

### Automated validation

Branch CI after the direct-native transport change proves:

- TypeScript/lint/production build pass;
- shared Playwright UI smoke tests pass;
- policy/unit tests pass;
- Windows Tauri/Rust host compiles with the native secure-store/direct-HTTP implementation;
- unsigned iOS Simulator build compiles with Keychain + direct `URLSession` + Apple Foundation Models Tool integration.

Automated tests also prove:

- Web Access OFF blocks network tools before availability/execution;
- Web Access ON + local/non-current prompt makes zero web calls;
- current-information prompt triggers search without an unnecessary page read;
- source-detail prompt is bounded to one search plus two webpage reads;
- structured tool output returns to the same local provider in the bounded loop;
- native Web Read can remain available without a search credential;
- the search credential is passed to the native transport for secure storage while status returned to the shared layer contains no secret;
- non-HTTP(S) Web Read input is rejected before native execution.

CI does not replace physical device validation.

### Existing physical evidence preserved

**Primary Windows laptop**

- Quick / `phi-4-mini` startup and normal chat: passed.
- Balanced / `mistral-nemo-12b-instruct` CUDA benchmark and normal conversation: passed.
- Exclusive chat-model switching: passed.
- System Foundry CLI local dictation: passed; laptop microphone transcription quality was mediocre but the speech path worked.
- Deep `gpt-oss-20b-cuda-gpu:1`: **failed qualification** at ~19.15 s first token and 45 s benchmark timeout. Normal-context validation did not pass; no Deep winner was selected; Phi Quick was restored. Do not auto-retry/promote it. `foundrylocal.exe` surfaced a Windows memory-read application error during/after cleanup.

**Rolo15**

- Current shared convergence build built/signed/installed/launched: passed.
- Local Apple Foundation Models chat + follow-up context: passed.
- Native on-device dictation: passed.
- Restart/persistence: passed.

**AVD**

- New physical acceptance remains pending. Use the same adaptive Windows policy; do not create an AVD-specific architecture.

### Native direct Web Access physical acceptance still pending

Search credentials are configured **separately on each native device** through CrownKeep. They must not be placed in Vite variables, source code, the Mac deployment command, conversation storage, or future sync.

For **each** target runtime (Windows laptop, Rolo15, then AVD separately):

1. Confirm a fresh/default profile shows **Web Access OFF**.
2. With OFF, ask a current-information question and confirm no Web Search/Web Read executes; local chat remains usable and Anne does not claim current verification.
3. Open the Web Access/provider setup and confirm direct Web Read is available even before a search credential is saved.
4. Save the Tavily search credential through CrownKeep and confirm the UI reports it stored in the native secure store:
   - Windows: Windows Credential Manager;
   - iPhone: iOS Keychain.
5. Restart/relaunch. Confirm Web Access preference and search-configured status persist without re-entering the credential.
6. Turn Web Access ON and ask a local/non-current question. Confirm no search/read request occurs.
7. Ask a current-information question. Confirm Web Search runs, `Used web search` is visible, source metadata is retained, and the message still shows the actual local reasoning provider.
8. Ask a question requiring source detail. Confirm search is followed by selected direct webpage read(s), source URLs are visible, and the reasoning provider remains unchanged.
9. Force a provider/network failure or temporarily remove the search credential. Confirm the failed web attempt is visible and CrownKeep does not silently switch to cloud reasoning.
10. Confirm direct Web Read can still operate for a selected public URL while the search credential is absent, when network access is available.
11. Turn Web Access OFF again and confirm subsequent automatic/manual network tools are blocked.

For Windows, also record whether Quick/Balanced have an observed structured-tool capability result. If support is not proven, verify the bounded fallback is used without changing models.

For Rolo15, the Tavily credential must be entered **on the phone after installation**. Do not bundle or pass it through the wife’s Mac build/deploy command.

### Deferred after Web Access foundation

- local-first image understanding/OCR proof;
- photo/file bridge;
- provider-neutral image generation;
- explicit visible cloud-image boundary where a cloud generator is chosen.

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

### Physical-test status

- Windows installed-System-Foundry dictation is physically proven on the primary laptop and restores the chat role.
- Rolo15 Apple Foundation Models chat/follow-up, native speech, and restart/persistence are physically proven.
- AVD remains physically pending under the shared Windows policy.
- The native direct Web Access package remains physically pending on all three target runtimes until its per-device credential/network behavior is validated.

### Deferred

- Image analysis/OCR and image generation remain deferred until after the Web Access/tool foundation is physically validated. Automatic public-web tool selection is now implemented in 4A.4K rather than deferred.

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
3. Verify Quick chat, restart, Quick restoration, rerun, and a model download/cache operation through the System Foundry environment. On the primary laptop, System Foundry CLI dictation has already been physically validated; on AVD, voice remains capability-dependent and must not block text-chat acceptance when unavailable.
4. Benchmark Balanced. Run its representative-context and normal-chat checks before it becomes selectable. Attempt Deep only after Quick and Balanced are stable.
5. Verify that selected model, System Foundry loaded model, and `/v1/models` model agree before sending; deliberately try a missing alias and verify chat stays blocked with a diagnostic.
6. Inventory, but do not delete, `%USERPROFILE%\.CrownKeep\cache\models`. Record system versus legacy size and the models protected for Quick/Balanced/Deep/Voice. Confirm no new files appear there after a CrownKeep non-Quick download.

## Rolo15 handoff

The current local baseline is already physically proven: Apple Foundation Models chat/follow-up, native dictation, and restart/persistence passed on Rolo15.

Remaining handoff for this work package:

1. Confirm the restored compact status bar remains readable on-device and Apple Foundation Models still supplies Quick without pretending Balanced/Deep are available.
2. Run the Web Access OFF/ON matrix from 4A.4K using the native Apple Foundation Models tool bridge.
3. Confirm successful/failed web activity and sources are visible while the assistant message remains marked Local.
4. Confirm no cloud-model fallback occurs when Apple local inference, the direct network path, or the configured search provider is unavailable.
5. Keep image-analysis/OCR validation deferred to the next multimodal work package.

## Cleanup gate

Legacy cache cleanup remains **blocked** until all three acceptance paths are recorded. Use Foundry's supported cache lifecycle only; never delete the `.CrownKeep` directory or conversation, Project, settings, tool, knowledge-source, or benchmark data.
