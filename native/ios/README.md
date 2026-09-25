# CrownKeep iPhone native host

This directory contains the native iPhone-side foundation for Phase 3.

## Direction

The shared CrownKeep React UI remains the conversation surface.

A native iPhone host will expose Apple's on-device Foundation Models framework to
that UI through the contract in:

- `src/native/NativeAIHost.ts`
- `src/providers/AppleFoundationModelsProvider.ts`

The first native service is:

- `CrownKeepFoundationModelsService.swift`

It checks `SystemLanguageModel.default.availability` and can execute a simple
on-device response using `LanguageModelSession`.

## Phase 3.1 boundary

The current branch does **not** yet contain a complete Xcode application or a
WKWebView JavaScript transport.

The next native step is to create the minimal CrownKeep iOS host that:

1. loads the shared CrownKeep web UI;
2. exposes `window.crownKeepNativeAI`;
3. maps availability/model information from
   `CrownKeepFoundationModelsService`;
4. maps one local response back into the existing `AIProvider` stream shape;
5. supports cancellation;
6. keeps all conversation persistence provider-neutral.

For the first device vertical slice, a non-streaming native Foundation Models
response can be returned as one CrownKeep chat chunk. Native streaming is a
Sprint 3.2 enhancement after the host bridge is proven.

## Requirements

The Apple Foundation Models path requires a supported OS/device and the
on-device model to be available. CrownKeep must surface the actual availability
reason rather than silently falling back to cloud.
