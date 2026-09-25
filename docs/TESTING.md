# RDC AI — Testing Guide

This guide is the executable test plan for the current sprint. It should evolve into the public installation/use documentation as the product matures.

## What can be tested now

Sprint 0.2 currently provides:

- the shared React/TypeScript application shell;
- responsive desktop/mobile layout;
- the provider-neutral chat path;
- a deterministic mock local provider;
- streaming responses;
- Stop Generation;
- local/cloud response labeling;
- the PWA manifest and service worker;
- the architectural boundary showing RDC data as disconnected.

Not implemented yet:

- Microsoft Foundry Local connectivity;
- iPhone local-model inference;
- persistent conversations;
- Entra sign-in;
- Azure synchronization;
- cloud AI;
- real RDC context/data.

A page refresh currently resets the demonstration conversation. That is expected until Sprint 1.1.

---

## 1. Developer smoke test — Windows

### Prerequisites

- Git
- Node.js 22
- Microsoft Edge or Chrome

### Get the application

Run these commands from the folder where you want the project to live:

```powershell
git clone https://github.com/dakROLO/rdc-ai.git
Set-Location .\rdc-ai
npm install
```

After `git clone`, PowerShell remains in the parent folder. You **must** enter the new `rdc-ai` folder before running npm.

Your prompt should look similar to:

```text
PS C:\some\folder\rdc-ai>
```

If npm reports `ENOENT` and says it cannot open `package.json`, run:

```powershell
Set-Location .\rdc-ai
npm install
```

That error normally means npm was run from the parent directory rather than from the repository.

### Start the development server

```powershell
npm run dev
```

Open the local URL printed by Vite, normally:

```text
http://localhost:5173
```

### Expected result

You should see:

- **RDC AI**;
- **Local Chat**;
- **⚡ Mock Local**;
- **RDC data — Disconnected by design**;
- a disabled **Take to Cloud** control;
- a message composer.

### Functional checks

1. Enter a message and select **Send**.
2. Confirm a response streams into the same conversation.
3. Send another message and confirm the conversation continues.
4. Start another response and select **Stop** while it is streaming.
5. Confirm the page remains usable after cancellation.
6. Narrow the browser window and verify the mobile layout adapts.
7. Refresh the page and confirm the demo resets. This is expected in Sprint 0.2.

### What this proves

This verifies the provider abstraction, streaming path, cancellation path, message metadata, and basic shared UI without requiring a real model.

It does **not** test Foundry Local yet.

---

## 2. Code/build validation

Run:

```powershell
npm run lint
npm run build
```

Both commands should complete successfully.

GitHub Actions also runs these checks when changes reach `main`.

---

## 3. Windows PWA/install test

The service worker is intentionally disabled in Vite development mode. Use a production build for the PWA test.

```powershell
npm run build
npm run preview
```

Open the local preview URL, normally:

```text
http://localhost:4173
```

`localhost` is treated as a secure development origin by modern browsers, so service workers and PWA installation can be tested locally.

### Install check

In Microsoft Edge or Chrome:

1. Open the production-preview URL.
2. Verify the browser offers the application installation option.
3. Install **RDC AI**.
4. Launch RDC AI from Windows as an installed app.
5. Confirm it opens in a standalone application window.

### Offline-shell check

1. Launch the preview while online.
2. Allow the service worker to install and become active.
3. Reload the app once while still online so the service worker controls the page.
4. In browser developer tools, set the network to **Offline**, or stop the preview server after the shell is cached.
5. Reload/reopen RDC AI.
6. Confirm the application shell can still render.

If the shell does not render offline, record the browser/version and failure in `docs/STATUS.md`; do not mark Sprint 0.2 complete.

---

## 4. iPhone PWA test

A normal LAN HTTP address such as `http://192.168.x.x:4173` is not sufficient for the real service-worker/PWA test. The iPhone test should use the deployed HTTPS build.

The intended user flow on iPhone is:

1. Open the hosted RDC AI URL in Safari.
2. Open the Share/Page menu.
3. Choose **Add to Home Screen**.
4. Enable **Open as Web App** when shown.
5. Add RDC AI.
6. Launch it from the Home Screen.
7. Verify standalone layout.
8. Verify the cached application shell can open without network access.

The hosted HTTPS endpoint is not established yet, so this portion of Sprint 0.2 is pending.

---

## 5. Sprint 0.2 acceptance checklist

- [x] React/TypeScript application shell exists.
- [x] Responsive conversation UI exists.
- [x] Mock provider streams responses.
- [x] Generation can be cancelled.
- [x] Production build passes CI.
- [x] PWA manifest exists.
- [x] 192×192 and 512×512 install icons exist.
- [x] Service worker exists.
- [ ] Windows PWA installation manually verified.
- [ ] Windows offline shell manually verified.
- [ ] HTTPS test deployment established.
- [ ] iPhone Add to Home Screen manually verified.
- [ ] iPhone offline shell manually verified.

Sprint 0.2 should not be marked complete until the unchecked items are either verified or explicitly moved to a later sprint with a recorded decision.

---

## Future public documentation direction

As the application matures, README installation guidance should have two separate paths:

### Use RDC AI

For ordinary users:

1. visit the hosted HTTPS application;
2. install it on Windows or iPhone;
3. download/select a local model when prompted;
4. chat locally;
5. optionally sign into RDC cloud capabilities.

### Develop RDC AI

For contributors:

1. clone the repository;
2. install Node dependencies;
3. run the local development server;
4. run lint/build/tests before submitting changes.

Do not require ordinary users to clone GitHub or install Node once a hosted release is available.
