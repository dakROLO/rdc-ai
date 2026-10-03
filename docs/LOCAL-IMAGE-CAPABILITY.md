# Local image capabilities — October 3, 2026

## Implemented boundary

| Capability | Current implementation | Boundary |
| --- | --- | --- |
| Exact text extraction | Vision OCR on iOS; bundled English Tesseract on Windows/browser | Local; separate from visual understanding |
| Visual understanding | Foundation Models `Attachment(CGImage)` via direct workbench action and native `image.read` tool | iOS 27 SDK **and** runtime with available on-device model; current iOS 26 builds accurately report unavailable |
| Windows generation | Existing native HTTP loopback Stable Diffusion WebUI API | User enters the image prompt; no chat or image upload to remote services |
| iOS generation | Capability/manifest interfaces and explicit `not-installed` bridge response | No pipeline, weights or installer shipped; Generate remains disabled |

The Xcode project already defines `CROWNKEEP_IOS27_SDK` for SDK `iphoneos27*` and `iphonesimulator27*`. Deployment target stays 26.0. The new Attachment API is behind that compile condition and `#available(iOS 27.0, *)`. Running iOS 27 with an older SDK-built app alone does not enable visual input. The current macOS-26 CI compile checks the older path; the iOS 27 path needs an SDK 27 compile and physical image test before acceptance.

Selected images are normalized/bounded previews, identified by attachment ID, and passed only to the in-process host. Native `image.read` resolves IDs supplied for the current turn, never arbitrary file paths or prior unselected photos. The local analysis is retained as bounded evidence, not trusted instructions. User-approved OCR and previews persist with the message. No Private Cloud Compute model, remote model fallback or Image Playground route exists.

## Optional downloadable Core ML architecture

Use Apple's `StableDiffusion` Swift package behind a dedicated local image runtime, independent of the chat `SystemLanguageModel`. The base app contains the UI and runtime interface; a model package is downloaded only after an explicit install action. Web Access controls web tools, not model installation consent.

The shared `LocalImageModelManifest` describes package ID/version, license, HTTPS download URL, SHA-256, expected compressed size, minimum OS/memory and `coreml-stable-diffusion` format. The production installer must verify a trusted/signed manifest, disk/memory compatibility, archive paths, size and digest before activation. Download resumably into staging, atomically promote a verified package, and keep weights under Application Support with backup exclusion. Uninstall should remove only the optional image package, never conversations. An unavailable/corrupt package must never trigger remote generation.

Runtime states should extend the current `not-installed / ready / unavailable` boundary with downloading/verifying/loading/generating/error. Report progress from actual download and pipeline steps, serialize jobs, support cancellation/background interruption, release model resources on completion/cancellation, and load lazily. Image generation permission is distinct from generic write tools; the registry has a separate `allowImageGeneration` boundary. The current app does not activate autonomous image generation.

## Exact next implementation slice

1. On an SDK-capable Mac, pin Apple's Swift package revision and select a redistribution-permitted candidate model after license review. Start benchmarking a 512px SD 2.1-base-class package; this is a candidate, not a selected production model. Evaluate palettized weights/chunked UNet conversion, CPU + Neural Engine and `reduceMemory: true` on the actual iPhone. Do not default to a large SDXL package.
2. Produce the Core ML package, measure compressed/on-disk size and peak resident memory, and publish its signed manifest/digest through an approved download host. Do not add model weights to this public repo or the base app.
3. Implement a Swift installer/runtime service with install/status/cancel/remove/generate bridge methods. Map it to the manifest/capability contract and existing `imageGenerate`, initially one 512px image with bounded steps and no concurrent chat/image jobs until memory evidence justifies it.
4. Add an explicit Install local image model action with actual download size/license/device requirements. Enable Generate only after verified installation and successful runtime load. Return preview/output to the composer; no provider console or system sheet.
5. Test integrity failure, insufficient disk/RAM, cancellation, backgrounding, uninstall, restart, two consecutive generations, offline generation and zero image/chat egress. Record actual timing/memory on the target iPhone before selecting defaults.

## Authoritative references

- [Apple Foundation Models image prompting](https://developer.apple.com/documentation/foundationmodels/analyzing-images-with-multimodal-prompting) and [Attachment API](https://developer.apple.com/documentation/foundationmodels/attachment): direct on-device image input, introduced in iOS 27.
- [Apple Core ML Stable Diffusion](https://github.com/apple-aiml-research/ml-stable-diffusion): model conversion and Swift pipeline; iOS memory reduction is required, and memory pressure still needs device validation.
- [Existing Windows WebUI API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API).
