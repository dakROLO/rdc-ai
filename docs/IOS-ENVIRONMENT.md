# CrownKeep iPhone Development Environment

Branch: `phase-3-iphone-local-ai`

This guide sets up the native iPhone development environment for CrownKeep Phase 3.

## What is required

### Mac

A Mac is required to build, sign, install, and debug the native CrownKeep iPhone host with Xcode.

Recommended for CrownKeep development:

- Apple-silicon Mac preferred;
- enough local storage for Xcode, iOS SDKs/simulators, the repository, and build artifacts;
- current supported macOS version for the Xcode version being used.

The simplest current path is a Mac running a current supported macOS release with the current stable Xcode from Apple.

### iPhone

For the Apple Foundation Models path, use an Apple Intelligence-capable iPhone with a supported iOS version and Apple Intelligence enabled.

CrownKeep must still detect the actual model availability at runtime; device family alone is not enough.

### Apple Account

An Apple Developer Program membership is **not required** for the first personal-device development test.

Sign into Xcode with an Apple Account and use the automatically created Personal Team.

Personal Team development provisioning is temporary and requires periodic reprovisioning/reinstallation.

For TestFlight, App Store distribution, or normal distribution to other people, CrownKeep will later need Apple Developer Program membership.

## Environment setup

### 1. Prepare the Mac

Install all macOS updates that are appropriate for the Xcode version you intend to use.

Install Xcode from the Mac App Store or Apple's developer downloads.

Launch Xcode once and allow it to install required platform components.

Confirm from Terminal:

```bash
xcodebuild -version
git --version
```

Node is also useful because the CrownKeep React UI remains part of the iPhone application:

```bash
node --version
npm --version
```

CrownKeep currently targets Node.js 22 for development.

### 2. Sign into Xcode

In Xcode:

1. Open **Xcode > Settings > Accounts**.
2. Add the Apple Account that will sign the development build.
3. Confirm a Personal Team or Developer Program team appears.

For the first CrownKeep device test, a Personal Team is enough.

### 3. Prepare the iPhone

On the iPhone:

1. update to a supported iOS release;
2. confirm Apple Intelligence is supported on the device;
3. turn Apple Intelligence on;
4. allow the on-device model to finish preparing/downloading;
5. enable Developer Mode if Xcode requests it during device setup.

Connect the iPhone to the Mac by cable for the first setup.

In Xcode, open **Window > Devices and Simulators** and confirm the phone appears and can be used for development.

### 4. Clone the Phase 3 branch on the Mac

```bash
git clone https://github.com/dakROLO/rdc-ai.git
cd rdc-ai
git switch phase-3-iphone-local-ai
npm install
npm run build
```

If the repository already exists:

```bash
cd rdc-ai
git fetch
git switch phase-3-iphone-local-ai
git pull
npm install
npm run build
```

### 5. Confirm the existing Phase 3 source

The branch should contain:

```text
src/native/NativeAIHost.ts
src/providers/AppleFoundationModelsProvider.ts
src/mobile/MobileCapability.ts
native/ios/CrownKeepFoundationModelsService.swift
native/ios/README.md
```

Do not create a second unrelated app architecture. The Xcode host should wrap and bridge the existing CrownKeep React/provider architecture.

## First Xcode milestone

The first native host does not need to be a complete product.

Create a minimal iOS application that can:

1. launch on the physical iPhone;
2. import the Foundation Models framework;
3. evaluate `SystemLanguageModel.default.availability`;
4. display or log the availability result;
5. execute one tiny local prompt through `LanguageModelSession`;
6. prove that the response occurred on the phone.

After that succeeds, wire the native service into the existing CrownKeep React UI through `window.crownKeepNativeAI`.

## Distribution stages

### Stage 1 — Personal development

Use the free Personal Team in Xcode.

Good for:

- developing the native host;
- installing CrownKeep on your own iPhone;
- proving Foundation Models inference.

Limitation: Personal Team provisioning is temporary and requires periodic reprovisioning.

### Stage 2 — CrownKeep beta

Enroll RDC in the Apple Developer Program when CrownKeep is ready to be installed easily by testers.

Use TestFlight for beta distribution.

### Stage 3 — General distribution

Use the appropriate Apple Developer Program distribution path, such as the App Store or another supported distribution method.

Do not optimize distribution before the native local-AI vertical slice works.

## Recommended next action

Get a Mac + Xcode to the point where:

```text
Xcode opens
Apple Account is signed in
iPhone appears in Devices and Simulators
phase-3-iphone-local-ai is cloned
npm run build passes
```

Once those five things are true, the next CrownKeep task is creating the minimal Xcode host project and adding `CrownKeepFoundationModelsService.swift`.
