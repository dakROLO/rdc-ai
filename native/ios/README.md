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
\n\n---\n\n# CrownKeep Native iPhone Proof

This Xcode project is the first physical-device milestone for CrownKeep Phase 3.

It intentionally does only three things:

1. launches as a native iPhone app;
2. reports Apple Foundation Models availability;
3. sends one real local prompt through `LanguageModelSession`.

It does **not** yet host the full CrownKeep React UI or bridge
`window.crownKeepNativeAI`. That comes after this physical-device proof is
green.

## Build from Xcode

Open:

```text
native/ios/CrownKeepNative/CrownKeepNative.xcodeproj
```

Select your Apple development team, choose the paired iPhone, and Run.

## Build/install from SSH

From the repository root on the Mac:

```bash
chmod +x scripts/ios-device-build.sh
xcrun devicectl list devices
security find-identity -v -p codesigning
```

Then:

```bash
CROWNKEEP_TEAM_ID=<TEAM_ID> \
CROWNKEEP_DEVICE_ID=<DEVICE_ID> \
./scripts/ios-device-build.sh
```

The script builds a Debug iphoneos app with automatic signing, installs it with
`devicectl`, and launches the bundle on the paired device.

If signing has never been configured on the Mac, open the project in Xcode once,
sign into Xcode, choose the target's Signing & Capabilities tab, select your
Personal Team, and run once from Xcode before relying on the SSH script.
