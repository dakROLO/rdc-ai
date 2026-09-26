# CrownKeep — Current Status

**Updated:** 2026-09-26

## Active phase

Phase 4A — Windows Product Host

## Active sprint

Sprint 4A.2 — Embedded Foundry Local lifecycle.

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
- Sprint 1.2 is complete; Sprint 2.1 is complete; Sprint 2.2 is active.
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


## AVD CPU vs virtual-WebGPU benchmark — 2026-09-25

Observed on the church Azure Virtual Desktop:

### WebGPU / generic GPU variant
- Model: `qwen2.5-0.5b-instruct-generic-gpu:4`
- Execution path: WebGpuExecutionProvider on an AVD with no physical GPU
- Foundry telemetry request time: **49,876 ms**
- Result: functionally executes, but is unsuitable for interactive CrownKeep use on this host.

### Forced CPU variant
- Model: `qwen2.5-0.5b-instruct-generic-cpu`
- Execution path: CPUExecutionProvider
- Streaming request: 40 prompt tokens + 9 completion tokens
- HTTP request duration: **979.5 ms**
- Approximate end-to-end completion throughput: **9.2 completion tokens/sec (~550 tokens/min)** for this very short request.
- Approximate post-tokenization generation window: **~26 completion tokens/sec (~1,570 tokens/min)**; treat this as a rough short-sample estimate rather than a sustained benchmark.
- Foundry stream emitted normal SSE deltas and `data: [DONE]`.

Conclusion: on virtualized Windows hosts, CrownKeep must benchmark observed execution performance rather than preferring a model solely because its catalog variant is labeled GPU.


## Sprint 2.1 completion / second-machine validation — 2026-09-25

- CrownKeep successfully generated a streamed Foundry Local response on the church Azure Virtual Desktop using `qwen2.5-0.5b-instruct-generic-cpu`.
- CrownKeep request contained **307 prompt tokens** and completed end-to-end in **3,799.8 ms**.
- Foundry emitted the expected SSE response and CrownKeep rendered the assistant response correctly.
- The same Foundry provider has now been validated on the primary Windows development machine and a second Windows/AVD environment.
- The AVD test also established that virtual WebGPU model selection can be dramatically slower than an explicitly forced CPU variant.
- Sprint 2.1 exit criteria are satisfied. **Sprint 2.1 is complete; Sprint 2.2 is active.**
- Sprint 2.2 should focus on execution-device visibility, observed performance instrumentation, model guidance, startup/provider diagnostics, and UX hardening rather than basic connectivity.


## Next action package — Sprint 2.2A Windows local experience hardening

Immediate goal: make CrownKeep explain what local runtime/model it is using, how well it is performing, and what the user should do next without requiring Task Manager or Foundry CLI logs.

Planned work:

1. Add a compact Local AI status/control surface that can replace the always-visible provider/model controls.
2. Surface provider health, selected model, model variant/device when available, and local/private state.
3. Capture per-response performance telemetry that CrownKeep can observe directly: request start, first streamed token, completion time, output character/token estimate, and cancellation/error state.
4. Show a small post-response performance summary in diagnostics rather than cluttering normal chat.
5. Add model-performance guidance for obvious poor-runtime cases; do not trust a GPU label alone.
6. Preserve the current manual Foundry/CLI setup for engineering validation while keeping the UI/runtime abstractions compatible with a later embedded Foundry Local SDK.
7. After diagnostics are stable, move conversation navigation into a collapsible surface and then address Projects separately.

Do not begin Windows installer/Tauri packaging in this package. Packaging remains a later distribution milestone after the local runtime UX and contracts are stable.


## Sprint 2.2A implementation — 2026-09-25

Implementation is complete; user validation is pending.

Delivered:

- Provider/model controls moved into a compact collapsible **Local AI** surface.
- Local AI surface now shows provider health, selected provider/model, inferred model device when the model ID exposes CPU/GPU/NPU, and whether inference remains Inside the Keep.
- Foundry SSE usage metadata is now captured when present, including prompt/completion/total token counts.
- CrownKeep measures request-to-first-token time, total response time, completion throughput, run outcome, and output size.
- Diagnostics remain hidden by default and can be expanded from the Local AI surface.
- Observed-performance guidance warns on slow starts, low throughput, and especially slow GPU-labeled variants on virtual Windows hosts.
- Conversation navigation can now collapse to a compact rail on desktop and remembers that preference locally.
- Provider/model choice remains provider-neutral and does not alter conversation identity.
- No real RDC data, Azure sync, cloud provider, or installer/runtime embedding was added in this sprint.

Validation required on the current AVD and primary Windows machine:

- pull current `main`;
- confirm Local AI menu layout and model selection;
- confirm CPU device hint for `qwen2.5-0.5b-instruct-generic-cpu`;
- send a Foundry Local prompt and verify first-token/total-time/token diagnostics;
- collapse/reopen conversation navigation and confirm the preference survives refresh;
- check narrow/mobile layout for clipping.


## Temporal context / stable-origin hardening — 2026-09-25

Additional Sprint 2.2 hardening delivered from AVD validation:

- CrownKeep now supplies the current device-local date/time, IANA time zone, UTC timestamp, and conversation creation time to Anne on every inference request.
- Persisted historical messages are annotated with their original timestamps before they are sent to the selected provider.
- Relative-time questions such as “today,” “earlier,” and “what did we discuss in the last N minutes?” can now be grounded in active-conversation timestamps rather than model training knowledge.
- Individual messages can be kept in local history while being reversibly excluded from future inference context.
- Excluded messages are visibly marked in the conversation UI and can be restored later.
- Vite development is pinned to port 5173 with strict-port behavior. If 5173 is occupied, development fails instead of silently switching origins and presenting a different IndexedDB database.
- Existing conversation deletion remains available for permanent local deletion.
- Other conversations are not automatically included in the active conversation's inference context.
- Cross-conversation local recall is not implemented yet and remains separate from active-conversation temporal context.


## Sprint 2.2B implementation foundation — 2026-09-25

Implementation completed for the browser-development side of the runtime lifecycle contract; user validation is pending.

Delivered:

- Added `LocalRuntimeManager` as a separate lifecycle abstraction from `AIProvider`.
- Added `BrowserLocalRuntimeManager` for the current external Foundry development workflow.
- Runtime contract includes start, stop, model install, model load, and model unload capabilities for a future native Windows host.
- Added Local AI first-run/setup stages: Runtime → Model → Verify.
- Added **Recheck** to retry provider/runtime discovery after external changes.
- CrownKeep rechecks Foundry state when the window regains focus.
- Added a hidden local verification request that benchmarks the selected model without adding a test message to conversation history.
- Successful verification persists locally for the selected provider/model.
- Setup guidance uses observed timing and flags slow GPU-labeled variants rather than trusting catalog labels alone.
- A normal successful chat also marks the selected provider/model as locally verified.
- Mock providers are development-only in production builds; the real local provider is the production default.
- Browser mode clearly states that native runtime lifecycle is externally managed today and will be owned by the installed Windows build later.

Not yet delivered:

- browser JavaScript cannot start/stop Foundry or install/load/unload models;
- native Windows runtime ownership remains a later desktop-host implementation step;
- automatic idle unload/resource release must wait for the native runtime host.


## Sprint 2.2B validation fixes — 2026-09-25

AVD validation found three usability/performance issues:

- browser scrollbars did not match the CrownKeep theme;
- raw per-message timestamp prefixes leaked into small-model responses;
- first-token latency increased to about 10.5 seconds with a 1,004-token prompt after timestamp metadata was inserted into every historical message.

Fixes delivered:

- CrownKeep scrollbars now use jade/graphite styling in the conversation, navigation, and Local AI panel.
- Current device date/time and time zone remain available on every request.
- Detailed historical message timeline metadata is now injected only for prompts with temporal intent.
- Historical message content is sent to the model without timestamp prefixes.
- Anne is explicitly told to use temporal metadata silently and not echo raw timestamp/timeline markup unless asked.
- Known legacy '[Message timestamp: ...]' artifacts are stripped from display and future inference context.
- Diagnostics now identify large active context as a likely first-token latency cause when prompt tokens are high, and direct the user to exclude older messages from Context.
- This preserves temporal reasoning while reducing normal prompt-token overhead.

Validation pending: compare prompt-token count and first-token latency on the same AVD conversation after pulling current main.


## Phase 3 branch kickoff — 2026-09-25

Branch: `phase-3-iphone-local-ai`

Windows/Foundry browser hardening was accepted by user validation and Phase 2 is treated as complete for the current browser-development scope.

Phase 3.1A foundation delivered on the branch:

- Added `NativeAIHost` TypeScript bridge contract.
- Added `AppleFoundationModelsProvider` implementing the existing provider-neutral `AIProvider` interface.
- Added iPhone/iPad capability detection that distinguishes native-host and browser-only use.
- Added explicit iPhone Safari/PWA local-AI unavailable provider so iPhone browser mode does not attempt the Windows Foundry path.
- Added production provider selection that prefers Apple on-device AI when the native host is present.
- Added `native/ios/CrownKeepFoundationModelsService.swift` as the first Swift Foundation Models service scaffold.
- Added native-host implementation notes under `native/ios/README.md`.
- Phase 3 work is isolated from stable `main` on the phase branch.

Next: Sprint 3.1B — create the minimal native iPhone host and wire availability plus the first real on-device response through `window.crownKeepNativeAI`.


## Phase 3 Windows-side native-host simulation — 2026-09-25

To keep Phase 3 moving without immediate Mac access:

- Added `MockNativeAIHost` for development-only simulation of the native iPhone bridge.
- The mock host can expose Apple-provider states from Windows without changing production behavior.
- Development URL `?nativeAI=mock` installs a fake native Apple host before provider registration.
- `nativeAIState` can simulate:
  - `available`
  - `device-not-eligible`
  - `apple-intelligence-not-enabled`
  - `model-not-ready`
- The available mock returns a short iPhone-local response through `AppleFoundationModelsProvider`, exercising the same provider-neutral chat path the real Swift bridge will use.
- This lets provider registration, availability mapping, conversation continuity, cancellation plumbing, and mobile-local metadata be validated before Xcode/device work begins.


## Phase 3 mock native-host validation — 2026-09-25

User validation on Windows confirmed the mock native iPhone bridge works end-to-end.

Observed:

- CrownKeep exposed **Anne · Apple On-Device** as a selectable provider.
- CrownKeep exposed **Apple On-Device Model** as the model.
- Local AI diagnostics showed the simulated Apple provider as Ready / NPU / Inside the Keep.
- A test prompt returned through the provider-neutral CrownKeep conversation path with the expected development response: `Mock iPhone-local Anne received: ...`.
- Existing conversation UI and local-message metadata remained intact.

Conclusion:

The TypeScript/provider side of the iPhone native bridge is proven before the real Swift/Xcode host exists.

UX note:

Provider/model dropdowns are useful during development, but the native iPhone release should automatically prefer Apple On-Device when available and move manual provider/model selection into an advanced Local AI settings surface.

Latest Phase 3 branch CI is green after fixing the Apple provider's TypeScript syntax compatibility and the iPhone-unavailable provider lint warning.


## Physical iPhone proof — 2026-09-25

User successfully built, signed, installed, and launched the first CrownKeep native app on physical iPhone `Rolo15` over the paired Mac/Xcode environment.

Validated:

- Xcode 27.0 / iPhoneOS SDK 27.0;
- Personal Team development signing;
- wireless device visibility from Xcode;
- CrownKeep native app installation on the physical iPhone;
- `SystemLanguageModel.default` reported available;
- **Ask Anne on this iPhone** successfully returned a real Foundation Models response on-device.

Known packaging polish:

- the proof app currently uses the default blank app icon; CrownKeep branded iOS app icon assets are still required.

Conclusion:

The native Apple Foundation Models theory is proven on the user's actual iPhone. Phase 3 can move from native-model feasibility into integration of the shared CrownKeep UI.


## Shared CrownKeep iPhone host integration — IMPLEMENTED · DEVICE VALIDATION PENDING

The Phase 3 branch now contains the first complete integration slice:

- the native iPhone app hosts the existing CrownKeep React UI in `WKWebView`;
- the production React build is packaged inside the application bundle under `dist`;
- a stable `crownkeep://app` scheme serves the bundled UI and assets;
- the native host injects `window.crownKeepNativeAI` before the React application initializes;
- `AppleFoundationModelsProvider` calls the injected native bridge;
- Swift maps provider availability and model discovery to `SystemLanguageModel.default`;
- Swift translates CrownKeep system/history messages into a `LanguageModelSession` request;
- the first integration returns a complete native response as one provider chat chunk;
- cancellation plumbing is represented and native generation tasks can be cancelled;
- the native host skips browser service-worker registration;
- `scripts/ios-device-build.sh` now builds the React UI before Xcode packages, signs, installs, and launches the app.

Next device validation:

1. pull current `phase-3-iphone-local-ai` on the Mac;
2. rerun the SSH deployment script;
3. confirm the installed app now renders the normal CrownKeep conversation UI;
4. confirm provider is **Anne · Apple On-Device**;
5. create/send a chat and confirm the answer comes from the phone's Foundation Model;
6. confirm local conversations persist across app relaunch;
7. capture any narrow-layout/safe-area/storage issues before native streaming work.


## iOS signing and branded icon hardening — 2026-09-25

Physical-device signing revealed that the identifier shown in the development certificate name (`QS3773YNR5`) was not the Apple Development Team ID. Xcode saved the actual CrownKeep development team as `QJ9HLPX482`.

Changes delivered:

- persisted the Xcode-selected development team in the native project;
- updated the device-build script to default to `QJ9HLPX482` while still allowing an explicit override;
- added a native `Assets.xcassets/AppIcon.appiconset`;
- wired `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` into Debug and Release;
- device builds now generate a 1024×1024 iOS app icon from the canonical CrownKeep logo at `public/icons/crownkeep-512.png`;
- the generated 1024 icon is ignored by Git because it is reproducible from the committed CrownKeep source icon.

Device validation pending: pull the current Phase 3 branch, redeploy to Rolo15, confirm the full CrownKeep UI/native Anne bridge, and confirm the branded CrownKeep icon appears on the iPhone Home Screen.


## Wireless SSH deployment validated — 2026-09-25

The CrownKeep iPhone build now installs and launches successfully on physical device `Rolo15` from the Windows PC through SSH to the Mac.

Important signing behavior discovered:

- Xcode GUI signing works normally;
- non-interactive SSH sessions do not automatically unlock the macOS login keychain;
- when the keychain remains locked, `codesign` can fail with `errSecInternalComponent` even though the certificate and provisioning profile are valid;
- running `security unlock-keychain ~/Library/Keychains/login.keychain-db` in the same SSH session before the device-build script resolves the signing failure without storing the password in Git or the command line.

Validated deployment flow:

```text
Windows PC
  → SSH to Mac
  → unlock login keychain
  → build CrownKeep React UI
  → generate branded iOS app icon
  → Xcode build/sign
  → wireless install to Rolo15
  → launch CrownKeep
```

Next validation target: confirm the installed build renders the full CrownKeep UI, shows the branded app icon, uses **Anne · Apple On-Device**, persists local conversations, and returns a real Apple Foundation Models response through the native bridge.


## First full iPhone UI validation — 2026-09-25

User validated the first shared-UI CrownKeep build on physical iPhone `Rolo15`.

Passed:

- native app launches the real CrownKeep React UI;
- **Anne · Apple On-Device** is selected correctly;
- Apple on-device model/provider availability is healthy;
- Anne returns successful local responses through the Swift bridge.

Issues found:

- Home Screen icon rendered effectively black instead of showing the CrownKeep mark;
- **New Project** did not open its naming dialog;
- conversation rename did not open its editing dialog;
- mobile project/navigation controls plus Local AI chrome consumed too much vertical space;
- Apple responses arrived as one completed block instead of streaming.

Root cause / fixes delivered:

- project creation, rename, delete confirmation, and related browser dialogs use `window.prompt/confirm/alert`; the native `WKWebView` host now implements the required `WKUIDelegate` JavaScript dialog callbacks;
- mobile Chats/Projects navigation is now collapsed behind a dedicated phone-only tray;
- the active project selector and Local AI summary are compacted into a single short mobile header row, while detailed Local AI controls remain expandable;
- the native Apple bridge now uses `LanguageModelSession.streamResponse(...)` and converts Foundation Models' cumulative partial snapshots into deltas for the existing CrownKeep provider stream;
- the iOS icon build now rasterizes the canonical `public/crownkeep-mark.svg` instead of relying primarily on the older PNG asset.

Device revalidation required for all five fixes.


## iPhone device validation round 2 — 2026-09-25

Additional physical-device findings:

- deleting the development-signed CrownKeep app caused iOS to request developer/publisher approval again; routine test deployments should update the installed app in place rather than delete it unless icon-cache testing requires a clean install;
- real CrownKeep UI and Apple on-device provider continue to work;
- user observed some Apple responses that felt truncated or repetitive, including weak continuation after a short follow-up;
- Diagnostics could expand but lacked an explicit Close action.

Hardening delivered for the next build:

- added an explicit Diagnostics Close control;
- Anne instructions now explicitly permit fictional/creative work when requested and treat short follow-ups as continuation intent;
- native Apple prompting now separates previous conversation context from the current user request instead of passing the entire labeled transcript as one undifferentiated prompt;
- creative requests receive a higher-temperature randomized sampling configuration while ordinary requests retain Apple's default generation behavior;
- Apple session input/output/total token usage is sent back through the native bridge so CrownKeep diagnostics can distinguish model behavior from UI/bridge truncation;
- device deployment supports optional `CROWNKEEP_SLEEP_AFTER=1` to return the Mac to sleep only after a successful install/launch.

Exact prompt/response transcript is still useful if the Apple model continues to truncate or repeat after this build.


## iOS 27 token-usage availability fix — 2026-09-25

The first build with Apple token diagnostics failed because `LanguageModelSession.usage` and `totalTokenCount` are only available on iOS 27+, while CrownKeep intentionally retains an iOS 26 deployment target.

Fix:

- preserve the iOS 26 deployment target;
- wrap Apple token-usage collection in `if #available(iOS 27.0, *)`;
- iOS 27 devices report prompt/completion/total tokens into CrownKeep Diagnostics;
- iOS 26 devices continue local generation without token-usage diagnostics.


## Transient wireless CoreDevice install failure hardening — 2026-09-25

A physical iPhone deployment completed the full CrownKeep build successfully but failed during the wireless `devicectl device install app` step with a CoreDevice control-channel reset (`Connection reset by peer`).

This is distinct from compilation, signing, or provisioning failure. The built app remained available in DerivedData.

Hardening delivered:

- device install now retries up to three times after transient wireless failures;
- launch also retries up to three times;
- retry guidance asks the user to keep the iPhone awake/unlocked and on the same network;
- after repeated install failure, the script prints the current CoreDevice device list for diagnosis;
- the Mac sleep-after-success step still runs only after both install and launch succeed.


## Creative-loop root cause and Local AI close fix — 2026-09-25

Physical iPhone testing captured a repeatable Apple on-device failure mode: when asked to invent a story about a fictional princess named Anne, the model repeatedly refused because it interpreted the fictional Anne as the assistant's own biography. Earlier refusals were then fed back as context and reinforced the loop. Short follow-ups such as "let's do it" also lost creative-mode detection because the current message alone did not contain a creative keyword.

Fixes delivered:

- Anne's shared instructions explicitly distinguish a fictional character named Anne from the assistant's identity and permit invented fictional details;
- creative intent on iPhone now considers recent user requests, so short follow-ups preserve the prior creative task;
- creative recovery excludes prior assistant responses from the compact context so repeated refusal text does not train the next turn into the same refusal;
- the native prompt explicitly tells the Apple model to complete the fiction rather than discuss themes or explain that it lacks personal narratives;
- recent native context is capped to a small window for the on-device model rather than replaying the full conversation;
- the outer Local AI / Inside the Keep panel now has an explicit Close control in addition to the Diagnostics Close control.

Device validation pending.


## Windows + iPhone local baseline accepted — 2026-09-25

User accepted the current basic local experience on both supported development paths.

Validated baseline:

- Windows CrownKeep local chat works through Microsoft Foundry Local;
- iPhone CrownKeep runs the shared React UI in the native host;
- **Anne · Apple On-Device** is healthy on physical iPhone;
- Apple responses stream through the provider-neutral CrownKeep conversation path;
- mobile project/conversation controls, JavaScript dialogs, Local AI panel closing, diagnostics, and creative follow-up behavior are functioning at the current basic-validation level;
- wireless Mac → iPhone build/sign/install/launch workflow is operational, with retries for transient CoreDevice drops;
- conversations remain provider-neutral and local-first.

This establishes the first shared **Windows + iPhone local baseline** suitable for merging into `main`. Cloud identity, sync, explicit cloud escalation, RAG, agents, and live RDC data remain later phases.


## Phase 4A Windows host kickoff — 2026-09-26

Branch: `phase-4a-windows-product-host`

Goal: turn the validated Windows browser/Foundry development path into the beginning of a normal desktop product without disturbing the working Windows + iPhone local baseline on `main`.

Delivered in the kickoff slice:

- added Tauri 2 development dependencies and desktop scripts;
- added a minimal `src-tauri` Windows host around the existing Vite/React application;
- added `crownkeep_host_info` as the first native Rust command;
- added `TauriLocalRuntimeManager` and runtime-manager host selection;
- browser mode continues to use `BrowserLocalRuntimeManager`;
- the native host currently reports lifecycle controls as unavailable rather than pretending Foundry ownership is complete;
- Vite ignores Rust/Tauri source changes for frontend file watching;
- Tauri bundle generation remains disabled during the shell proof.

Research basis:

- current Tauri 2 documentation explicitly supports adding Tauri to an existing Vite frontend;
- current Microsoft Foundry Local documentation publishes an official Rust SDK and a Windows `winml` feature for hardware-accelerated Windows integration.

Next validation target:

1. install/verify Windows Tauri prerequisites on the primary development PC;
2. run `npm install`;
3. run `npm run desktop:dev`;
4. confirm the real CrownKeep UI opens in a native Windows window;
5. open Local AI and confirm the runtime text says the native Windows host is connected;
6. confirm ordinary `npm run dev` still uses browser-development runtime behavior;
7. only after that validation, begin Sprint 4A.2 Foundry Local Rust SDK lifecycle integration.


## Phase 4A.1 physical Windows validation — 2026-09-26

The CrownKeep Tauri desktop host successfully launched on the primary Windows development machine.

Validated:

- Rust toolchain and MSVC build prerequisites are installed;
- Smart App Control initially blocked Cargo-generated unsigned build helpers and was identified as the local policy blocker;
- after the local development policy issue was addressed, `npm run desktop:dev` compiled and launched `target\debug\crownkeep.exe`;
- CrownKeep rendered inside a real native Windows application window.

Current expected limitation:

- selecting **Anne · Foundry Local** while the external development daemon is stopped produces `ECONNREFUSED 127.0.0.1:39839`;
- Sprint 4A.1 still intentionally uses the existing external Foundry Local development endpoint;
- the native Windows host does not yet start, stop, acquire, load, or unload Foundry Local models.

Immediate validation continuation:

1. keep the Tauri development host running;
2. start Foundry Local on fixed port 39839;
3. load the previously validated local model;
4. use CrownKeep **Recheck**;
5. confirm a real Foundry Local response works inside the native Windows window.

Successful inference through the Tauri-hosted UI will close the core Sprint 4A.1 shell proof and allow work to move into Sprint 4A.2 native Foundry lifecycle ownership.


## Sprint 4A.1 complete — 2026-09-26

Physical Windows validation completed successfully.

Validated in the native CrownKeep desktop host:

- `npm run desktop:dev` launches the real CrownKeep Tauri application window;
- the existing React/CrownKeep UI renders correctly inside the native host;
- the native host identity bridge is active;
- CrownKeep reports **Native Windows host connected**;
- Foundry Local on `127.0.0.1:39839` is reachable through the existing provider path;
- `phi-4-mini-instruct-openvino-gpu` is discovered and selected;
- Local AI setup reports Runtime connected, Model selected, and Verify passed;
- a real Anne response is generated successfully inside the native Windows application;
- existing projects/conversations remain usable;
- browser-development and provider-neutral architecture remain intact.

Observed performance guidance correctly warned that the GPU-labeled variant took roughly 11 seconds on this machine and suggested comparing a CPU variant. This confirms the existing observed-performance logic continues to work inside the native host.

**Sprint 4A.1 is complete.**

Next active slice: **Sprint 4A.2 — Embedded Foundry Local lifecycle**, beginning with native runtime/model discovery and lifecycle ownership through the existing `LocalRuntimeManager` seam.


## Sprint 4A.2A native Foundry lifecycle implementation — 2026-09-26

Implementation delivered; physical Windows validation pending.

Native host changes:

- added the official `foundry-local-sdk` Rust dependency with the Windows `winml` feature;
- CrownKeep initializes its own Foundry Local manager with an embedded OpenAI-compatible service bound to `127.0.0.1:39839`;
- native Tauri commands now expose Foundry SDK status, service start/stop, model download, model load, and model unload;
- native status reports catalog size plus cached and loaded model state;
- execution-provider download/registration is performed through the SDK before first model acquisition;
- `TauriLocalRuntimeManager` now advertises real lifecycle capabilities rather than placeholder unsupported actions;
- browser mode remains on `BrowserLocalRuntimeManager` and is unchanged.

Product-facing first-run slice:

- the native Local AI setup adds **Prepare phi-4-mini** when the embedded provider is not ready;
- Prepare uses the native manager to register execution providers, download/cache `phi-4-mini` when needed, load it, start the embedded Foundry service, and recheck CrownKeep;
- a **Stop local AI** action stops the embedded service and attempts to unload the bootstrap model;
- the bootstrap alias is intentionally the already-validated `phi-4-mini` for this engineering slice; broader model recommendation/selection remains part of Sprint 4A.2.

Important validation boundary:

- stop the externally managed Foundry CLI server before testing this slice so port 39839 is free;
- the SDK uses CrownKeep's application-owned cache by default, so the first native preparation may download model/runtime assets even if a CLI-managed copy already exists;
- successful validation means CrownKeep reaches a ready Anne response without running `foundry server restart`, `foundry model download`, or `foundry model load` manually.


## 4A.2 first-run model preparation correction — 2026-09-26

First physical validation of the native **Prepare phi-4-mini** flow failed before the local OpenAI service became reachable. The UI surfaced an execution-provider setup failure while the Vite proxy continued to receive expected `ECONNREFUSED 127.0.0.1:39839` responses because the embedded service never reached the start stage.

Correction:

- removed the unconditional `download_and_register_eps(None)` call, which attempted to download/register every discovered execution provider before model preparation;
- retained the SDK's Windows `winml` feature and allow the model/SDK path to select the appropriate runtime normally;
- added native terminal stage logging for SDK initialization, model resolution, cache inspection, model download, model load, and embedded-service start;
- the next validation should begin with the external Foundry CLI server stopped and use **Prepare phi-4-mini** again.

This keeps execution-provider tuning available for a later hardware-optimization slice without making it a prerequisite for basic CrownKeep self-managed local AI.


## Sprint 4A.2A physical validation succeeded — 2026-09-26

The first CrownKeep-owned Foundry Local lifecycle was successfully validated on the primary Windows development machine with the external Foundry CLI server stopped.

Observed native sequence:

- CrownKeep resolved the bootstrap alias `phi-4-mini`;
- the SDK selected `Phi-4-mini-instruct-generic-cpu:5`;
- CrownKeep downloaded the model into its application-managed cache;
- CrownKeep loaded the model through the native Foundry Local SDK;
- CrownKeep started its embedded OpenAI-compatible service at `http://127.0.0.1:39839`;
- the existing Foundry provider discovered the running model through the local API;
- Local AI setup reported Runtime connected, Model selected, and Verify passed;
- Anne generated a verified response inside the native Windows application without manual `foundry server` or `foundry model load` commands.

The initial application-owned model download took several minutes. This is expected first-run behavior. The downloaded model remains cached on disk across app restarts.

Current shutdown behavior:

- **Stop local AI** is optional and is useful when the user wants to keep CrownKeep open while freeing the local inference runtime/model;
- closing the current single-window CrownKeep desktop application terminates the Tauri process, which also terminates CrownKeep's embedded Foundry service and releases the loaded model/runtime from memory;
- closing CrownKeep does not remove the downloaded model from its application-managed cache.

This completes the core 4A.2A proof: CrownKeep can prepare and run Windows local AI without requiring normal-user Foundry CLI lifecycle commands.


## Phase 4A.2B productization direction — 2026-09-26

Restart validation confirmed CrownKeep's application-managed model cache persists across app restarts:

- `phi-4-mini` resolved to `Phi-4-mini-instruct-generic-cpu:5`;
- native preparation reported `download-model skipped cached=true`;
- load/start completed without repeating the several-minute first-run model download.

New product requirements captured from physical Windows use:

- automatically restore the last verified cached local model on CrownKeep startup;
- make the desktop top/header layout behave better at medium window widths;
- render fenced code responses as dedicated code blocks with a Copy action;
- expose a local Foundry model analyst/catalog experience so the user can inspect and choose models/variants;
- benchmark observed performance before remembering a preferred local model;
- support timed idle unload of the local model to release resources while CrownKeep stays open;
- show a clear sleeping indicator that can reload the model and continue the same conversation.

These requirements stay inside the provider/runtime boundaries and do not change conversation identity.


## Sprint 4A.2B/C implementation package — 2026-09-26

Implemented on the Windows product-host branch; physical validation pending.

### Automatic restore and resource sleep

- CrownKeep remembers the last verified Foundry model/variant.
- When the native Windows app opens and the saved model is healthy/cached but the embedded service is stopped, CrownKeep automatically restores the model/runtime in the background.
- Conversation storage opens independently; local AI startup is not allowed to block access to chat history.
- Local AI can unload after an idle period while the app remains open.
- Idle unload is configurable: Never, 5, 15, 30, or 60 minutes.
- A sleeping Local AI state is visible in the top status pill; clicking it wakes the remembered model.
- Manual **Sleep local AI** remains available to release model/runtime resources while keeping CrownKeep open.

### Code output

- Anne is instructed to use fenced Markdown blocks for copyable commands/config/code.
- CrownKeep recognizes fenced code blocks in assistant messages.
- Each code block renders in a dedicated panel with language label and Copy action.

### Local Model Analyst

- Added a native Foundry catalog command that exposes model variants, alias/display name, cached/loaded status, device, execution provider, file size, and context length where available.
- The Local AI panel includes a **Local Model Analyst** section.
- The user can inspect candidates, select a model/variant, download it when required, load it, start the CrownKeep-owned runtime, and then verify observed performance.
- Preferred model/variant is persisted separately from generic provider selection so startup can restore the known-good choice.
- Model decisions remain performance-informed rather than assuming GPU/NPU labels are faster.

### Responsive desktop polish

- Added a compact medium-width Windows header layout through 1320px viewport width.
- Local AI status/project/title controls use less vertical space before the mobile layout activates.

### Repo hygiene

- generated `src-tauri/gen/` artifacts are ignored.
- `package-lock.json` and `src-tauri/Cargo.lock` remain candidates to intentionally commit from a generated Windows build for reproducible installer work in Sprint 4A.3.


## Auto-restore startup trigger correction — 2026-09-26

Physical restart testing showed that CrownKeep's Local Model Analyst could see the cached `phi-4-mini` CPU variant, but automatic startup still did not run. No native Foundry stage logs were emitted, proving that the restore trigger itself was blocked before model resolution.

Root cause:

- automatic restore was gated by the prior `LocalAiSetupRecord.healthy` browser/provider record;
- the native Foundry catalog already had enough information to prove that a cached model was available;
- therefore a stale/missing setup record could prevent startup even when the native cache was healthy.

Correction:

- startup restore now waits for the native Foundry catalog inspection;
- when the provider is down and a cached native model exists, CrownKeep matches the preferred model by normalized native/provider ID or alias;
- if the preferred value is stale, CrownKeep falls back to the cached `phi-4-mini` alias and then to the first cached candidate;
- the matched native variant ID is persisted and loaded automatically;
- prior verification/performance data remains advisory rather than controlling whether the runtime is allowed to start.

This makes the native catalog the source of truth for Windows local-model restore.


## Device-aware Local Model Analyst — 2026-09-26

Physical laptop testing confirmed automatic restore works, but the initial Local Model Analyst exposed only CPU variants. This was expected from the implementation because CrownKeep was reading the current Foundry catalog without first running Foundry's execution-provider discovery/registration flow.

Microsoft's Foundry Local WinML verification flow explicitly performs:

1. discover compatible execution providers;
2. register/download those execution providers;
3. refresh the model catalog;
4. inspect GPU/NPU accelerated variants;
5. download/load a candidate and validate observed performance.

CrownKeep now implements the same sequence through the native Rust SDK with one important resilience improvement: execution providers are registered individually so one failed provider does not abort the entire device analysis.

New behavior:

- **Local Model Analyst → Analyze this device** discovers Foundry execution providers for the current Windows machine;
- previously registered providers are reused;
- unregistered discovered providers are attempted individually;
- partial provider-registration failures are surfaced but do not discard successful providers;
- the Foundry model catalog is refreshed after provider analysis;
- Model Analyst then refreshes model/variant choices and exposes CPU/GPU/NPU device labels and execution-provider metadata;
- the analysis reports detected device classes, execution-provider status, CPU variant count, and accelerated GPU/NPU variant count;
- acceleration is treated as a candidate, not an automatic winner: CrownKeep continues to use observed verification/benchmark timing before persisting a preferred model.

This intentionally makes device analysis machine-specific. An AVD CPU result does not constrain a physical laptop with compatible GPU/NPU execution providers.

### Windows UI refinement

The Local AI panel is now a bounded fixed desktop overlay with internal scrolling and a sticky heading so long Model Analyst content does not run off-screen. The medium/desktop top bar now uses an explicit two-column title/status layout instead of allowing the Local AI status control to wrap underneath the conversation title.
