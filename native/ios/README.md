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


## Shared CrownKeep UI integration

After the physical Foundation Models proof succeeded, the native host was advanced to load the real CrownKeep React UI.

The device deployment script now:

1. installs web dependencies when needed;
2. runs `npm run build`;
3. packages `dist/` into the native application;
4. builds/signs the iOS target;
5. installs and launches CrownKeep on the paired iPhone.

The native app serves bundled assets from `crownkeep://app` through a `WKURLSchemeHandler` and injects the `NativeAIHost` JavaScript contract at document start.

The first real integration is intentionally non-streaming on the Swift side: one completed Apple Foundation Models response is emitted as one CrownKeep provider chunk. This proves the full UI/provider/native path before native response streaming is added.


### If Xcode changed project files locally

The first Xcode signing/provisioning run may modify the local `project.pbxproj`, and `chmod +x` may modify the executable bit of `scripts/ios-device-build.sh`.

If a later `git pull` refuses to continue because those files would be overwritten, preserve the local state before updating:

```bash
git stash push -m local-Xcode-signing-setup -- \
  native/ios/CrownKeepNative/CrownKeepNative.xcodeproj/project.pbxproj \
  scripts/ios-device-build.sh

git pull
chmod +x scripts/ios-device-build.sh
```

Do not immediately pop the stash. The Apple account, certificate, provisioning profile, and device registration live outside the repository. The deployment script also passes `DEVELOPMENT_TEAM` explicitly. Reapply the stash only if the refreshed project unexpectedly loses required signing behavior.


## Signing identity used by this project

Xcode saved the current CrownKeep development team as `QJ9HLPX482`.

This is the value used by the native project and by `scripts/ios-device-build.sh` when no override is supplied. The parenthetical identifier shown by `security find-identity -v -p codesigning` is a certificate/account identifier and should not be assumed to be the Apple Development Team ID.

Normal device deployment therefore does not need `CROWNKEEP_TEAM_ID`:

```bash
CROWNKEEP_DEVICE_ID=<device-id> bash scripts/ios-device-build.sh
```

Set `CROWNKEEP_TEAM_ID` only when intentionally overriding the saved team.


### Return the Mac to sleep after deployment

Set `CROWNKEEP_SLEEP_AFTER=1` to ask the logged-in macOS user session to sleep five seconds after CrownKeep installs and launches successfully:

```bash
CROWNKEEP_DEVICE_ID=<device-id> CROWNKEEP_SLEEP_AFTER=1 bash scripts/ios-device-build.sh
```

This only runs after a successful deployment. It uses macOS System Events rather than storing an administrator password in the script.

Waking a sleeping Mac is a separate network capability. Enable **Wake for network access** in macOS System Settings. Whether a Windows SSH attempt can wake the Mac directly depends on the Mac/network path; a Wake-on-LAN magic packet may still be needed.
