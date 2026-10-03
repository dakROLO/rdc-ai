# Local image capabilities — October 3, 2026

## Implemented boundary

| Capability | Current implementation | Boundary |
| --- | --- | --- |
| Exact text extraction | Vision OCR on iOS; bundled English Tesseract on Windows/browser | Local; separate from visual understanding |
| Visual understanding | Foundation Models `Attachment(CGImage)` via direct workbench action and native `image.read` tool | iOS 27 SDK **and** runtime with available on-device model; current iOS 26 builds accurately report unavailable |
| Windows generation | Existing native HTTP loopback Stable Diffusion WebUI API | User enters the image prompt; no chat or image upload to remote services |
| iOS generation | Explicit optional download + Apple `StableDiffusion` Swift/Core ML runtime | Pinned local model; no automatic download, Image Playground, or cloud fallback |

The Xcode project already defines `CROWNKEEP_IOS27_SDK` for SDK `iphoneos27*` and `iphonesimulator27*`. Deployment target stays 26.0. The new Attachment API is behind that compile condition and `#available(iOS 27.0, *)`. Running iOS 27 with an older SDK-built app alone does not enable visual input. The current macOS-26 CI compile checks the older path; the iOS 27 path needs an SDK 27 compile and physical image test before acceptance.

Selected images are normalized/bounded previews, identified by attachment ID, and passed only to the in-process host. Native `image.read` resolves IDs supplied for the current turn, never arbitrary file paths or prior unselected photos. The local analysis is retained as bounded evidence, not trusted instructions. User-approved OCR and previews persist with the message. No Private Cloud Compute model, remote model fallback or Image Playground route exists.

## Optional downloadable Core ML runtime — implemented, physical acceptance pending

The iPhone host now owns an explicit install/status/remove/generate lifecycle. CrownKeep does **not** bundle model weights and does not start a download because the app launches, Local Image Generation is toggled, or Anne wants an image. Inside the Keep shows `NOT INSTALLED` until the user chooses the model download. After verified install the same local runtime backs both the Image Workbench and Anne's `image.generate` tool; turning Local Image Generation OFF removes the tool permission but does not delete the installed package.

The selected package is Apple's compiled palettized Stable Diffusion 1.4 archive `coreml-stable-diffusion-1-4-palettized_split_einsum_v2_compiled.zip` at pinned revision `2f36b5d37f234ef41df5e25b55240083bd6a95ee`. Compressed size is 1,565,721,660 bytes; CrownKeep verifies SHA-256 `fabf8f28478473abcf1c6288d35cc6faf1a399b09cb4813a8cb8bc44de2b734e` before extraction. The installer requires additional free storage for staging/expanded resources, extracts to a temporary folder, locates the expected compiled Core ML text encoder/UNet/decoder/tokenizer resources, atomically promotes the package into CrownKeep Application Support, and load/unloads the pipeline once before reporting Ready.

Generation uses Apple's `StableDiffusion` Swift package pinned to revision `ea2805dc1945be20561c77e5f6d1d9a5a637cda2`, CPU + Neural Engine compute, reduced-memory mode, one image, 20 steps, and local PNG encoding. Pipeline resources unload after the generation. ZIP extraction uses pinned `ZIPFoundation` revision `22787ffb59de99e5dc1fbfe80b19c97a904ad48d`. No prompt, generated image, chat history, or attachment is sent to a remote image API. The download itself necessarily retrieves the chosen public model archive.

Anne receives `image.generate` only when the local image package reports Ready **and** Local Image Generation is ON. Native tool output returns the generated data URL through the existing tool-activity path so the image appears in the conversation and can be saved. The tool stays absent when the package is missing or permission is OFF. Image reading remains a separate Foundation Models/OCR capability.

The selected model/package carries its own upstream license terms; CrownKeep downloads the pinned upstream artifact rather than redistributing it inside the app. Distribution/release work must retain the applicable Apple/Stable Diffusion/model notices and review the model license before a public release. This implementation is an engineering/personal-device package, not physical acceptance.

## Physical exit gate

Before this image package is accepted, test the actual iPhone for: download integrity and insufficient-space behavior; install and restart persistence; first and second 512-class generations; elapsed time, peak memory, thermal behavior and UI responsiveness; Local Image Generation OFF; offline generation after install; removal/reinstall; safety-check behavior; cancellation/background interruption; and zero prompt/image egress during generation. The current download UI reports the install phase but does not claim background/resumable transfer support. Those remain follow-on product-hardening items if physical testing shows they are needed.

## Authoritative references

- [Apple Foundation Models image prompting](https://developer.apple.com/documentation/foundationmodels/analyzing-images-with-multimodal-prompting) and [Attachment API](https://developer.apple.com/documentation/foundationmodels/attachment): direct on-device image input, introduced in iOS 27.
- [Apple Core ML Stable Diffusion](https://github.com/apple-aiml-research/ml-stable-diffusion): model conversion and Swift pipeline; iOS memory reduction is required, and memory pressure still needs device validation.
- [Existing Windows WebUI API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API).
