# CrownKeep — Testing Guide

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


---

## Sprint 1.1 — Local persistence test

After pulling the latest `main`:

```powershell
Set-Location .\rdc-ai
git pull
npm install
npm run dev -- --host
```

### Windows persistence checks

1. Open CrownKeep.
2. Confirm the CrownKeep jade/copper theme and Anne identity appear.
3. Send a message.
4. Refresh the browser.
5. Confirm both your message and Anne's response remain.
6. Create a second conversation.
7. Send a different message in that conversation.
8. Refresh again.
9. Confirm both conversations remain in the sidebar.
10. Open each conversation and confirm its own messages are intact.
11. Rename one conversation and refresh.
12. Confirm the new title remains.
13. Delete one conversation and refresh.
14. Confirm it stays deleted.

Expected sync status during this sprint: **Stored on this device**.

No Azure, Entra sign-in, or internet connection is required for these conversation operations after the application itself has loaded.

### Same-network phone retry

Run:

```powershell
npm run dev -- --host
```

Open the Network URL Vite prints on the phone.

The previous background-only failure is expected to be addressed by the new ID helper, which no longer directly requires `crypto.randomUUID()`.

Confirm:

- CrownKeep UI renders rather than only the background;
- Anne's welcome message appears;
- a new conversation can be created;
- a message can be sent through the mock provider;
- refreshing the page preserves the conversation on that phone.

This remains a basic LAN/mobile-browser test, not the final HTTPS PWA install test.


---

## Sprint 1.2 — Provider-neutral chat test

Pull the latest `main` and run:

```powershell
git pull
npm install
npm run dev
```

### Keyboard behavior

1. Type a message.
2. Press **Enter**.
3. Confirm the message sends.
4. Type a multi-line message using **Shift+Enter**.
5. Confirm Shift+Enter inserts a newline rather than sending.

### Provider switching

In development mode, CrownKeep exposes two mock local providers so the provider-neutral architecture can be tested before Foundry Local is connected.

1. Send a message using **Anne · Mock Local**.
2. Change Provider to **Anne · Alternate Local**.
3. Send another message in the same conversation.
4. Confirm the conversation ID/history does not change or fork.
5. Switch back to the first provider and continue again.
6. Refresh and confirm the entire conversation remains intact.

Each assistant message retains its own provider/model metadata even when the conversation changes providers.

### Cancellation regression

Start a streamed response and use **Stop**. Confirm the conversation remains usable and can continue afterward.


---

## Message-order regression test

This specifically validates the IndexedDB version-2 sequence migration.

1. Pull the latest `main`.
2. Open a conversation created before the ordering fix.
3. Refresh the page.
4. Confirm each user message appears before the Anne response it triggered.
5. Send three short messages quickly.
6. Refresh again.
7. Confirm the order remains exactly the same.

New messages use an explicit per-conversation sequence and no longer rely only on millisecond timestamps.

---

## Sprint 2.1 — Foundry Local first real-model test

### Prepare Foundry Local

Use a second PowerShell window:

```powershell
foundry server restart --port 39839 --idle-timeout 0
foundry model download phi-4-mini
foundry server status
```

The status endpoint should show `http://localhost:39839`.

CrownKeep's first development integration uses that fixed loopback endpoint. The endpoint can be overridden with `VITE_FOUNDRY_LOCAL_ENDPOINT`.

### Run CrownKeep

```powershell
git pull
npm install
npm run dev
```

Then:

1. Open CrownKeep.
2. Select **Anne · Foundry Local** as Provider.
3. Confirm the status changes from unavailable to **Inside the Keep**.
4. Confirm the downloaded model appears in the Model selector.
5. Select it.
6. Ask Anne a simple question.
7. Confirm the answer streams rather than appearing all at once.
8. Refresh and confirm the conversation remains in correct order.

CrownKeep calls Foundry Local directly on the PC. No Azure or cloud inference is involved in this test.


---

## Current Foundry Local API verification

The installed CLI may expose the newer OpenAI-compatible server without the older `/openai/*` management routes.

Use:

```powershell
foundry --version
foundry server status
foundry model load phi-4-mini
Invoke-RestMethod http://127.0.0.1:39839/v1/models
```

Expected:

- `foundry server status` reports Ready;
- the web URL is on loopback, for example `http://127.0.0.1:39839`;
- `/v1/models` returns an OpenAI-compatible model list after a model is loaded.

A 404 from the root `/` does not mean the daemon is down.

If `/v1/models` still returns 404, record the output of:

```powershell
foundry --version
foundry server logs -n 50
```

Do not diagnose the root-page 404 as a service failure.

### Conversation scrolling regression

1. Open a conversation long enough to exceed the visible message area.
2. Confirm the CrownKeep header/sidebar/composer remain fixed while only message history scrolls.
3. Scroll upward.
4. Confirm a floating **Latest** button appears.
5. While still away from the bottom, send or allow Anne to finish a response.
6. Confirm the button indicates **Anne finished**.
7. Select it and confirm the message pane returns to the newest response.


---

## End-of-session Foundry cleanup

To finish a development session and release the local inference runtime:

```powershell
foundry server stop
```

If the server should remain running but the loaded model should be removed from memory:

```powershell
foundry model unload phi-4-mini
```

Model cache files stay on disk for later use.


---

## Fresh Windows machine — get CrownKeep running

Use this path on a Windows computer that has not run CrownKeep before.

### 1. Check prerequisites

Open PowerShell and run:

```powershell
git --version
node --version
npm --version
```

CrownKeep currently targets Node.js 22.

If Git or Node are missing, install them before continuing.

### 2. Clone CrownKeep

Choose a working folder:

```powershell
mkdir C:\CrownKeepTest -ErrorAction SilentlyContinue
Set-Location C:\CrownKeepTest
git clone https://github.com/dakROLO/rdc-ai.git
Set-Location .\rdc-ai
```

If the repository already exists on the machine:

```powershell
Set-Location C:\CrownKeepTest\rdc-ai
git pull
```

### 3. Install JavaScript dependencies

```powershell
npm install
```

### 4. Run CrownKeep without a real model

```powershell
npm run dev
```

Open the Local URL printed by Vite, usually `http://localhost:5173`.

Use **Anne · Mock Local** first. This verifies the application, local IndexedDB storage, chat history, provider switching, and UI without requiring Foundry Local.

### 5. Optional: install Foundry Local for real local inference

Install Foundry Local if it is not already available:

```powershell
winget install Microsoft.FoundryLocal
foundry --version
```

Then start the local service on CrownKeep's development port:

```powershell
foundry server start --port 39839 --idle-timeout 0
```

If the daemon is already running:

```powershell
foundry server restart --port 39839 --idle-timeout 0
```

### 6. Select and load a model

Inspect available models:

```powershell
foundry model list --type chat
```

For the current CrownKeep development path, a known working test model is:

```powershell
foundry model download phi-4-mini
foundry model load phi-4-mini
```

Verify the OpenAI-compatible service:

```powershell
Invoke-RestMethod http://127.0.0.1:39839/v1/models
```

A loaded model should appear in the returned JSON.

### 7. Test Anne through Foundry Local

Keep Foundry Local running.

In CrownKeep:

1. choose **Anne · Foundry Local**;
2. confirm the model selector populates;
3. choose the loaded model;
4. ask Anne a simple question;
5. confirm the response streams;
6. refresh and confirm the conversation remains in order.

### 8. Same-network phone test

To make the Vite development server reachable from another device:

```powershell
npm run dev -- --host
```

Use the Network URL printed by Vite from the phone.

This tests the CrownKeep web UI from the phone. It does **not** mean the model is running on the phone. When CrownKeep is served from the Windows computer during this development flow, Foundry Local inference remains hosted by that Windows computer.

### 9. End the session

When finished:

```powershell
foundry server stop
```

Or keep the daemon running but free the loaded model from memory:

```powershell
foundry model unload phi-4-mini
```


---

## Direct Foundry inference diagnostic

Use this when CrownKeep shows **Anne is thinking locally** but it is unclear whether Foundry Local is actually generating.

First verify the loaded variant:

```powershell
foundry model list --loaded --variants -v
```

Then call the OpenAI-compatible API directly:

```powershell
$models = Invoke-RestMethod http://127.0.0.1:39839/v1/models
$model = $models.data[0].id

$body = @{
  model = $model
  messages = @(
    @{
      role = "user"
      content = "Reply with exactly: local model works"
    }
  )
  stream = $false
  max_tokens = 20
} | ConvertTo-Json -Depth 5

$sw = [System.Diagnostics.Stopwatch]::StartNew()

$response = Invoke-RestMethod `
  -Uri http://127.0.0.1:39839/v1/chat/completions `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

$sw.Stop()

$response.choices[0].message.content
"Elapsed: $($sw.Elapsed.TotalSeconds) seconds"
```

If this returns a response, Foundry Local and the loaded model are working independently of CrownKeep.

For a second CLI-only check:

```powershell
foundry complete qwen2.5-0.5b "Reply with exactly: local model works"
```

To watch the daemon while testing:

```powershell
foundry server logs -f
```

If direct Foundry inference works but CrownKeep remains stuck, troubleshoot CrownKeep's request/stream handling rather than the model runtime.
