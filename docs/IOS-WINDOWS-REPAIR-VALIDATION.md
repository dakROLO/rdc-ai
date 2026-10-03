# iOS / Windows context and image repair — 2026-10-03

## Current assistant-tools package

The [assistant tool validation matrix](ASSISTANT-TOOLS-VALIDATION.md) supersedes the earlier editable-query review, default Apple prefetch, standalone Images/Prompt controls and Image Playground direction. Those older implementation notes are preserved below as history.

Physical findings: Windows `/web` retrieves/displays sources, but Quick ignores evidence and answers from its April 2023 cutoff. Automatic Windows web orchestration is **not accepted**. Retest this repaired build on Windows, then physically validate iOS. No automated result claims device acceptance.

Build/install over the existing app using the procedures below, preserving history. No merge or branch deletion is authorized by this package. Native iOS 26 builds expose OCR only; iOS 27 SDK/runtime builds expose the direct image path. Optional Core ML generation is not installed/implemented yet.

## Previous repair implementation (historical)

- **Prompt & context:** device-local inspector shows CrownKeep's base instructions, assembled system message, included history/evidence and omitted-history count. On Apple, the host emits its exact flattened prompt/instructions to the inspector. Foundry updates the inspector for structured-loop request rounds. Provider-owned internal prompts are outside this view. Snapshots are session-only and are not written to routine logs or uploaded.
- **Context bounds:** protect system/current request, then keep newest history within a conservative character budget (14,000 Apple / 32,000 Windows). Excluded/error history remains excluded. Oversize current requests fail visibly rather than silently truncating the user's message.
- **iOS web grounding:** explicit current/public-web intent is prefetched through the existing native transport/shared bounded registry before Apple generation. Sources and bounded excerpts enter the current system context and persist as tool activity for follow-ups. This temporarily favors deterministic retrieval over model-directed Apple tool selection. Pronoun follow-up queries require an editable query review; no whole conversation or attached OCR text is implicitly sent to search.
- **Native evidence compatibility:** Apple automatic tools also retain bounded excerpts when used through their existing host API. The default app path is the bounded shared prefetch path.
- **Icon:** iOS device build and CI use the new opaque 1024px PNG rendered from the canonical full C/crown SVG. PWA PNGs and cache version are updated. Native build number advances to 2. Normal update installation retains app data; do not delete/reinstall to refresh branding.
- **Balanced:** the supplied screenshot shows correct Balanced role, 4,025 input characters, a responsive endpoint and no HTTP response before abort at ~45s; Quick recovery followed. Multiple API-visible model names are not proof of multiple loaded models. Root cause is not yet established. A finite 90s first-response / 240s total budget and 1,024 output-token cap are now applied. CLI load-state inspection fails closed; preflight reconciles multiple loaded chat models. Keep the existing recovery path and benchmark qualification protection.
- **Images:** Images panel selects one image, downscales it, extracts text locally, offers editable review, and stores the selected preview/text with the sent message. Apple uses Vision OCR; Windows/browser uses bundled Tesseract English assets (no CDN or image upload). This slice is OCR, not general visual reasoning.
- **Image generation:** explicit Apple Image Playground sheet on supported native iOS; sheet owns service/style choices and any boundary disclosure. Do not claim every Apple sheet style is device-local. Windows native app posts only the entered prompt to an HTTP loopback Stable Diffusion WebUI API with redirects/proxy disabled, response/time limits, and preview validation. There is no remote/cloud image endpoint in this adapter. Outputs can be saved or added to a message.
- **Mac:** loopback browser/local-Foundry launcher and [Mac quickstart](MAC-QUICKSTART.md). Native Mac packaging remains separate.

## Automated verification

Shared TypeScript/production build, lint and 45 unit tests pass. Five Playwright browser flows pass using an alternate local Chromium runtime because the standard browser download failed in this environment. Flows cover local chat persistence, mobile dictation/layout, iOS transport-mock evidence reaching context and surviving reload with Web OFF, in-app pronoun-query review, reviewed image persistence, and real bundled Tesseract OCR without CDN requests. The OCR fixture contains synthetic meeting text. A separate local English OCR smoke test also passed. SVG XML was parsed/rendered and visually checked; shell scripts pass syntax checks.

These checks do not compile the native Swift/Rust changes or qualify a physical model, Apple sheet, installed icon, native download/save, or Mac hardware. Xcode and Windows Rust/WinML tooling are unavailable here. Native builds and the device matrix remain required.

## Build/install handoff

These changes are local until the current commits are explicitly authorized for GitHub publication. Pull the branch only after publication. Use the existing signed iPhone build procedure (`scripts/ios-device-build.sh` with the established device/team environment); build/install over the existing app. On Windows, `npm ci` then the existing `npm run desktop:dev` or native build path regenerates icons.

For Windows image generation, start the existing Stable Diffusion WebUI with its `--api` option, keeping its listener on localhost. In the WebUI installation's `webui-user.bat`, add `--api` to the existing `COMMANDLINE_ARGS` value rather than replacing other arguments. Restart it, confirm the WebUI works, then enter its actual loopback port in CrownKeep Images. The default is `http://127.0.0.1:7860`. Model installation/download remains a separate task; CrownKeep does not install or silently choose an image model.

## Device matrix — must pass before acceptance

| Case | Expected |
| --- | --- |
| Prompt inspector before/after send | Base prompt visible; actual request/evidence visible after send; Close/Escape works; no model call from opening |
| Long conversation / excluded response | Budget and exclusions accurately reflected; current question retained |
| iOS Web ON named current search, supplied URL | Actual retrieval text in assembled system prompt; visible actual source links |
| iOS search → follow-up → restart → Web OFF follow-up | Saved evidence still present, no fresh request while OFF |
| “Look it up online” after a named subject | Editable query review; subject is correct; private context not uploaded |
| Search challenge / timeout / empty | Honest error or empty evidence, no fictional verification or cloud fallback |
| Updated app icon / build identity | Full mark on Home Screen/taskbar; Prompt inspector shows expected build; old chats remain |
| Windows Balanced cold/warm normal prompt | Record first response, total time, actual model and loaded CLI state; finite timeout/Quick recovery works |
| Selected PNG/JPEG screenshot | OCR runs locally; editable text; preview and reviewed text survive sent-message reload |
| Non-text / unsupported image | No invented visual analysis; honest OCR/unavailable error |
| Windows OCR with networking unavailable | Bundled worker/core/English data; no CDN requests; no image upload |
| Apple Image Playground | Capability gate, explicit sheet, create/cancel, output returned; review service choice in sheet |
| Windows image generator | Loopback only; remote/credential/path/redirect rejection; generation failure visible; local chat unaffected |
| Image draft → switch chat | No attachment copied into another conversation |
| Mac browser | Real Foundry local provider, chat/restart/OCR; unavailable native features reported honestly |

No screenshot/device/chat content is committed as a fixture. Record synthetic or redacted test results with commit/build/OS/provider and timings. Neither increasing the watchdog nor successful TypeScript tests proves Balanced is physically fixed.

## References

- [Apple Image Playground system interface](https://developer.apple.com/documentation/imageplayground/imageplaygroundviewcontroller)
- [Apple ImageCreator discontinuation and replacement sheet](https://developer.apple.com/news/?id=dz9wvq0r)
- [Tesseract local worker/core/language paths](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
- [Windows Stable Diffusion WebUI API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API)
