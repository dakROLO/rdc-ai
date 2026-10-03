# Decision Assist, Auto and local image validation — October 3, 2026

## Preserved physical findings

Windows Quick retrieves `/web` evidence but previously answered from an April 2023 cutoff. Automatic orchestration is not physically accepted. Newest Apple iPhone → `can you check online?` produced a literal query and personal-checks/checkers results; deterministic contextual query resolution remains required. Windows Image Workbench at `http://127.0.0.1:7860` reported “Could not reach the local image app. Start Stable Diffusion WebUI with --api.” Balanced timeout remains a retest item. Failed Deep `gpt-oss-20b` is not qualified. Prior Windows Quick/Balanced and iPhone basic chat/dictation/persistence evidence is retained; it does not accept this new slice.

## Implemented / automated scope

Shared DecisionEngine and event-driven advisory controller, native Rust CPU execution behind Tauri lifecycle commands, release on OFF, category/confidence/availability gating, persisted Auto/manual mode and Decision Assist switch. CPU parity/precision/CrownKeep smoke evals are committed. No Julia production category is qualified: Auto falls back to cached Quick. iOS native Julia remains honestly unavailable. No app-time asset downloads or network/cloud inference fallback.

Windows manual/Anne generation shares `LocalImageRuntime`, persisted loopback address, current readiness and Local Image Generation ON/OFF. Workbench probes on opening and explicit address checks. Rust HTTP client pins localhost, rejects non-loopback/subpaths/credentials, disables proxy/redirects, bounds probe/generation time and bodies. API probe distinguishes unreachable, WebUI API-disabled/invalid and wrong endpoint. Generation failure is visible and retry can re-probe. No generator starts/downloads/installs. Successful automatic generated images are displayed/saved and retained locally in tool activity, never sent as base64 to Anne's text model.

Local automated checks: 67 unit/integration tests, 8 Playwright browser flows (alternate local Chromium), lint, TypeScript/production build, SVG XML and diff checks pass. Independent Rust CPU adapter compiles and reproduces 100/100 publisher parity and 9/16 CrownKeep smoke accuracy; raw native and FP32/INT8/FP16 reports are committed. Standard Playwright browser download failed as a truncated archive; the alternate local binary passed the suite. Native Windows/iOS CI outcomes are recorded separately. Native host compilation must pass Windows/iOS CI; shared mocks and Linux native eval do not claim target-device acceptance.

## Windows physical plan

1. Pull this branch with `--ff-only`, `npm ci`, `npm run desktop:dev` (or established packaged build). Preserve chats; do not delete app data.
2. Confirm top bar Auto/Quick/Balanced/Deep; three switches under Inside the Keep. Decision details appear in Diagnostics only. Toggle/restart to confirm persistence.
3. Decision Assist OFF: Auto returns from manually selected Balanced to cached Quick at next send. Explicit Balanced stays Balanced; unsupported/unqualified Deep remains disabled. ON with missing/unqualified Julia reports unavailable/unqualified and uses Quick. No asset download/cloud switch. Stage Julia research assets only if deliberately testing native packaging; no live judgment category is enabled by staging.
4. Web OFF: `look it up`, `can you check online?`, `/web` and hallucinated calls make no web requests. Web ON: ask newest Apple iPhone, then `can you check online?` and `search that`. Inspect resolved topic/query, real sources and grounded response; no literal generic query or checks/checkers evidence. Repeat retained-evidence follow-up after reload and Web OFF. Repeat existing stale/cannot-browse correction matrix.
5. Image generation OFF: workbench Generate disabled and Anne has no image.generate tool. Select/understand/OCR remain separate capabilities.
6. With existing WebUI stopped, open Image: concise start/`--api` guidance. Start existing WebUI without API: disabled/invalid API state. Check another local server/port: wrong-endpoint/unreachable. Remote address must be rejected without request.
7. Start configured WebUI with `--api`, using localhost only. Enable Local Image Generation, check correct address → Ready, generate manually and save/attach. Change port, save/check, then ask Anne to create a blue glass crown using a model with proven tool calling. Same port/runtime, no confirmation, image displayed/save link. Induce WebUI failure and verify visible generation error and recovery after Check. A text-only model lacking tool support may not generate automatically; no fabricated image.
8. Record build SHA, actual models/roles, switches, endpoint/state, timings and any failures. Retest Balanced watchdog and icon/map without reinstalling/deleting chats.

## iPhone physical plan

1. Build/install over existing app using `scripts/ios-device-build.sh`. Do not delete/reinstall. CI baseline compilation is not a physical test.
2. Confirm Auto/Quick and disabled unavailable Balanced/Deep. Toggle Decision Assist OFF/ON: Diagnostics says native Julia conversion unavailable; Auto uses Apple Quick. Airplane mode: existing local chat works with no Julia/cloud fallback.
3. Local Image Generation OFF removes tool; ON with no optional Core ML model stays honestly unavailable. Local OCR and iOS 27 image understanding remain independent; exercise only the SDK/runtime's supported path.
4. With Web ON retest current iPhone question → generic follow-up, correct sources/context and bounded reasoning; Web OFF blocks new requests, retained evidence still works. Verify cleaned Image/Dictate/Send composer and settings remain usable at phone width.
5. Record device OS/SDK, SHA, timings and observed sources/tool counts. No native Julia or image-generation acceptance is claimed by an unavailable-state test.
