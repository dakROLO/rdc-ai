# Assistant tools implementation and device handoff — October 3, 2026

Branch: `sprint-4a3-local-platform-convergence`. No merge, tag or branch deletion is part of this package.

## Physical findings preserved

Windows `/web` successfully retrieves and displays sources, but tested Quick ignores the evidence and answers from its April 2023 training cutoff. **Current automatic Windows web orchestration is not accepted.** Windows must retest the repaired build; physical iOS validation follows. Previous Quick/Balanced chat qualification and iPhone basic chat/dictation/persistence evidence do not establish this package's acceptance. The previous Balanced timeout remains a physical retest item; no new qualification or automatic Deep promotion occurs here.

## Implemented and automated scope

- Model-directed available tools on ordinary proven Windows/native Apple turns; no web keyword gate and no query-review component. Unsupported Windows callers retain bounded deterministic prefetch. Native tools reserve a three-operation quota; structured requests have three planning rounds/tools then final reasoning. A skipped needed call runs one deterministic fallback and a tool-free answer round.
- Canonical provider-neutral `web.search / web.read / keep.search / image.read / image.generate` definitions. Legacy diagnostic aliases remain usable. Web OFF blocks network-tool availability and execution. Available image tools depend on actual SDK/runtime/installed capability and current-turn attachments.
- Tool outputs are bounded untrusted data, fed back to the same local model with source URLs and persisted as local evidence. False cannot-browse/cutoff drafts after sourced retrieval get one corrective pass, then an honest evidence view if needed. This detects boilerplate failures; it does not prove arbitrary answers semantically grounded.
- Composer image control beside Dictate/Send. Inside the Keep exposes modes, Web Access, System Prompt / Prompt & Context, Knowledge and Diagnostics. Technical runtime/setup/analyst details are nested in Diagnostics; provider/raw model selectors and search-provider card are removed.
- Direct iOS 27 image input uses on-device Attachment; OCR remains separate. SDK/runtime 26 builds report visual input unavailable. Image Playground is removed. iOS Core ML generation remains a not-installed capability, with the exact installer/runtime slice in [LOCAL-IMAGE-CAPABILITY.md](LOCAL-IMAGE-CAPABILITY.md). Windows manual loopback generation is retained.

Automated final checks in the implementation workspace: **56 unit tests passed**, **7 Playwright flows passed** using an alternate local Chromium binary (the standard download failed), TypeScript/production build passed, lint passed, SVG XML parsed and `git diff --check` passed. The additional UI flow checks separate local image analysis/OCR and disabled optional generation with synthetic native capabilities. This is an adapter mock, not proof of Swift or image-model execution. Native Swift/Rust compilation and physical device validation are separate gates. GitHub [CI run 883](https://github.com/dakROLO/rdc-ai/actions/runs/37147864927) passed shared verification, unsigned iOS baseline compilation, Windows Tauri/Rust compilation and Cargo.lock consistency for implementation commit `b215aa2`. A follow-up bounds native tool-return text to 3,500 characters and places source URLs before excerpts so character clipping preserves identity. Follow-up `d2e18d6` passed [CI run 884](https://github.com/dakROLO/rdc-ai/actions/runs/37148199958) across all three jobs. Fresh native startup now overrides stale development/mock provider preferences, with a dedicated regression test. SDK 27 image code still needs an SDK 27 build; macOS-26 CI compiles the older path only.

## Pull and build

```powershell
git switch sprint-4a3-local-platform-convergence
git pull --ff-only origin sprint-4a3-local-platform-convergence
npm ci
npm run desktop:dev
```

Use the established signed `scripts/ios-device-build.sh` workflow on Mac, installing over the existing app to preserve chats. Use a 27 SDK and iOS 27 device to exercise direct visual input; on a 26 build, test honest unavailable behavior and local OCR. Do not delete/reinstall the app for these tests.

For Windows generation, keep WebUI listening on localhost with `--api` and use its actual loopback port (default `http://127.0.0.1:7860`) in the composer's image workbench. This package does not install a Windows diffusion model.

## Device acceptance matrix — open

| Test | Expected evidence |
| --- | --- |
| Web ON, normal current question without `/web` | Anne selects search when needed; actual source data enters final reasoning; answer agrees with source and cites it |
| Web ON, ordinary local question | No unnecessary web call; keep.search remains usable for local reference notes |
| Quick ignores evidence or emits cutoff/cannot-browse boilerplate | Corrective pass uses actual evidence; repeated failure shows explicit grounding failure plus sources, never fictional current verification |
| Successful search and read | Same provider/model throughout; bounded activity/excerpts/URLs persisted; no unbounded tool loop |
| Follow-up, reload, Web OFF | Retained source data answers relevant follow-up; transport makes no new web request |
| Web OFF, explicit search or hallucinated call | No network probe/request; clear boundary; no cloud switch |
| “Look it up online” after explicit subject | No review dialog; only minimal preceding user subject used by fallback; attachments/OCR never become fallback query |
| Search failure/challenge/empty | Honest failure/empty result; no bypass, hidden alternate provider or fabricated source |
| Composer images, mobile and desktop | Image control beside Dictate/Send; no standalone Images or prompt button |
| Inside the Keep | Modes, Web Access privacy, System Prompt / Prompt & Context, Knowledge, Diagnostics reachable; technical details tucked away |
| Fresh native startup / stale mock preference | Windows automatically selects Foundry; iPhone selects native Apple; explicit Mac local configuration overrides a stale mock preference |
| Quick/Balanced/Deep | Existing measured switching/recovery still works; unsupported/unqualified modes disabled; benchmark records preserved |
| iOS 26 SDK/runtime | Local OCR works; visual input unavailable; no image egress |
| iOS 27 SDK/runtime, supported model | Workbench/native image.read uses real local pixels, recognizes a non-text synthetic scene; OCR separately extracts exact text |
| iOS image generation | Honest not-installed state; no system sheet, automatic download, bundled weights or network fallback |
| Windows image generation | Local WebUI create/failure remains functional, prompt-only loopback request; save/attach output |
| Cancellation / long request / tool quota | Watchdog/cancel stops final answer; no later turn corruption, new calls after abort or discarded false draft persisted |

Record build/commit, OS/SDK, actual provider/model from Diagnostics, timings and observed tool counts. Use synthetic/redacted facts; no personal chats or customer data are committed as fixtures.
