# CrownKeep — Testing Guide

This guide is the executable test plan for the current sprint. It should evolve into the public installation/use documentation as the product matures.

## Current acceptance target — Sprint 4A.4

Sprint 4A.4 is the active validation target. The authoritative implementation/status records are `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/SPRINT-4A4-VALIDATION.md`.

### Already physically accepted

- Primary Windows laptop: Quick / `phi-4-mini` startup + normal chat; Balanced / `mistral-nemo-12b-instruct` CUDA benchmark + normal chat; exclusive model switching; local dictation through installed System Foundry.
- Rolo15: current convergence build built, signed, installed, and launched; chat, follow-up context, Apple-native on-device dictation, and restart/persistence all passed.
- Deep remains a recorded failed qualification: `gpt-oss-20b-cuda-gpu:1` reached first token at about 19.15 s, exceeded the 45 s benchmark window, did not pass normal-context validation, and must not be auto-retried or promoted.
- AVD acceptance remains separate and pending under the same adaptive Windows runtime/model policy.

### Automated branch gate

Before recording new physical acceptance, the active branch must pass:

```powershell
npm run lint
npm test
npm run build
```

CI additionally runs shared Playwright UI smoke tests, the Windows Tauri/Rust host check, and the unsigned iOS Simulator build.

### Web Access architecture under test

Web Access defaults to **OFF** and is enforced by `ToolRegistry`.

There is no CrownKeep Web Gateway and no `VITE_CROWNKEEP_WEB_GATEWAY_URL`.

Current native behavior:

- **Windows:** direct native HTTPS; Tavily search credential stored in Windows Credential Manager.
- **iPhone:** direct native HTTPS with `URLSession`; Tavily search credential stored in iOS Keychain.
- **Web Search:** sends only the minimized public query to Tavily and requires the device-local search credential.
- **Web Read:** fetches only the selected public HTTP(S) URL directly from the native device and does not require the search credential.
- **Shared React/webview:** may save/remove the credential and read configured/not-configured status; it must never receive the stored credential back.
- **Browser-only development:** does not store a live provider credential and is not physical Web Access acceptance.

Never put the Tavily key in source code, `.env`, a `VITE_*` value, conversation/project data, the wife’s Mac deploy command, or future sync.

### Windows laptop — native direct Web Access acceptance

Update and launch the native app:

```powershell
Set-Location C:\path\to\rdc-ai
git fetch origin
git switch sprint-4a3-local-platform-convergence
git pull --ff-only
npm ci
npm run desktop:dev
```

Then:

1. Confirm the compact status bar shows role/model/execution, **Inside the Keep**, runtime state, and **Web OFF**.
2. Confirm normal Quick local chat still works.
3. With Web Access **OFF**, ask: `What is the latest stable Node.js release right now? Verify it using current web information.`
4. Confirm no Web Search/Web Read executes and Anne does not claim current verification.
5. Open Local AI / Web Access setup. Before adding a search key, confirm the UI reports direct webpage reading available and search credential not configured.
6. Paste the Tavily API key into CrownKeep and select **Save key**.
7. Confirm the UI reports the search credential is stored in **Windows Credential Manager**. The UI must not display the stored key after save.
8. Close and relaunch CrownKeep. Confirm search remains configured without re-entering the key.
9. Turn **Web ON**.
10. Ask a local-only question such as `Explain the difference between Quick and Balanced in CrownKeep.` Confirm no unnecessary search occurs.
11. Ask: `What is the latest stable Node.js release right now? Verify it using current sources.`
12. Confirm visible **Web Search** activity, source URLs/titles, and the assistant message remains attributed to the actual local reasoning provider.
13. Ask: `Search for the latest stable Node.js release, read the two most relevant sources, and summarize the version and release date.`
14. Confirm bounded Web Search + direct Web Read activity and source metadata.
15. Record whether Quick and Balanced show structured-tool capability as passed, unsupported, or unknown. Unsupported is not a failure; the bounded fallback must continue without switching models.
16. Remove the Tavily key through CrownKeep or temporarily disconnect networking and repeat a current-information request. Confirm the failed web attempt is visible and no cloud-model fallback occurs.
17. With the search key removed but networking restored, manually test a selected public URL with the diagnostic `/url https://example.com` path while Web Access is ON. Confirm direct Web Read does not require the Tavily key.
18. Turn Web Access **OFF** and confirm subsequent automatic/manual network tools are blocked again.

Do **not** retry the failed Deep candidate during this acceptance run.

### Rolo15 — wife’s Mac build/deploy lessons learned

Use the established physical-device path:

- Mac repo: `~/Projects/rdc-ai`
- Apple team: `QJ9HLPX482`
- Rolo15 device ID: `00008150-001829503E38401C`
- unlock the Mac login keychain before the build;
- run the script with `bash`; **do not chmod it**;
- keep Rolo15 awake/unlocked and on the same network during wireless install/launch;
- the script already retries wireless installation and launch.

Preflight from Windows PowerShell:

```powershell
ssh mac-dev 'cd ~/Projects/rdc-ai && echo "=== GIT ===" && git branch --show-current && git status --short && git log -1 --oneline && echo "=== XCODE ===" && xcodebuild -version && echo "SDK: $(xcrun --sdk iphoneos --show-sdk-version)" && echo "=== DEVICES ===" && xcrun devicectl list devices'
```

If `git status --short` prints unexpected files, do not reset them blindly.

Build/sign/install/launch from Windows PowerShell:

```powershell
ssh -t mac-dev 'cd ~/Projects/rdc-ai && security unlock-keychain ~/Library/Keychains/login.keychain-db && git fetch origin && git switch sprint-4a3-local-platform-convergence && git pull --ff-only && CROWNKEEP_TEAM_ID=QJ9HLPX482 CROWNKEEP_DEVICE_ID=00008150-001829503E38401C bash scripts/ios-device-build.sh'
```

The Tavily key is **not** part of this command. Enter it on Rolo15 inside CrownKeep after installation so it is stored in that phone’s Keychain.

Then:

1. Confirm the current build launches and existing local conversation persistence remains intact.
2. Confirm Apple Foundation Models remains the local reasoning provider and native Apple speech remains on-device.
3. Confirm the compact status bar remains readable and only Quick is represented on iPhone.
4. With Web OFF, ask a current-information question and confirm no network tool executes.
5. Open Web Access setup and confirm direct Web Read is available before a search key is saved.
6. Save the Tavily key on Rolo15 and confirm the UI reports **iOS Keychain**.
7. Relaunch CrownKeep and confirm search remains configured.
8. Turn Web ON and ask a local-only question; confirm no unnecessary search.
9. Ask a current-information question; confirm Web Search activity + sources while Apple Foundation Models remains the reasoning provider.
10. Ask for source detail; confirm direct page read(s) occur and sources remain visible.
11. Temporarily disable networking or remove the search key and confirm failure is visible with no cloud-model fallback.
12. Turn networking back on; with the search key absent, verify direct Web Read can still read a selected public URL while Web Access is ON.
13. Turn Web OFF again and confirm network tools are blocked.
14. Recheck chat, follow-up context, dictation, and restart/persistence as a short regression.

### AVD acceptance

Run the same Windows native-direct Web Access matrix on AVD. Configure its search credential locally in that Windows environment; do not copy a credential from the laptop’s store.

Use the same adaptive Windows model policy. Do not create AVD-specific CrownKeep architecture. Voice remains capability-dependent and must not block text-chat/Web Access acceptance if the AVD lacks the required microphone path.

### Acceptance guardrails

- No silent cloud-model fallback.
- No CrownKeep Web Gateway.
- No RDC customer-data connection.
- Web Access OFF means network tools are blocked at `ToolRegistry`.
- Web Access ON does not authorize sending conversation history or local content.
- Search credentials remain device-local and are never returned to the shared webview after storage.
- Do not merge, tag, delete the convergence branch, or remove legacy cache data until remaining physical evidence is recorded and explicit approval is given.

---

## Historical and regression procedures

The sections below preserve earlier sprint setup and regression tests. They remain useful for targeted checks, but they are not the current Sprint 4A.4 acceptance authority.

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
foundry model list --loaded --variants -v

# Use the exact loaded model ID reported above.
# Example from the church AV PC:
$model = "qwen2.5-0.5b-instruct-generic-gpu"

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

Do not blindly use the first item from `/v1/models`: that endpoint may include a model that is cached/known but not currently loaded. The inference request must name the model that is actually loaded.

For a second CLI-only check:

```powershell
foundry complete qwen2.5-0.5b "Reply with exactly: local model works"
```

To watch the daemon while testing:

```powershell
foundry server logs -f
```

If direct Foundry inference works but CrownKeep remains stuck, troubleshoot CrownKeep's request/stream handling rather than the model runtime.


---

## Sprint 2.2A validation checklist

After updating the repository:

```powershell
git pull
npm install
npm run dev
```

With Foundry Local running and a model loaded:

1. Open CrownKeep and confirm the top-right Local AI control is compact when closed.
2. Expand it and verify Provider and Model selectors are available.
3. With `qwen2.5-0.5b-instruct-generic-cpu`, confirm the Device field reads **CPU**.
4. Send a short prompt through Foundry Local.
5. Open **Local AI → Diagnostics** and verify:
   - Last result becomes `complete`;
   - First token has a duration;
   - Total time has a duration;
   - Prompt/completion tokens populate when Foundry includes usage in SSE;
   - Output rate displays in tok/s when completion-token usage is available.
6. Collapse the conversation navigation rail using the sidebar control.
7. Refresh the page and confirm the collapsed/expanded preference is retained.
8. Reopen the navigation and confirm existing conversations remain accessible.
9. Resize to a narrow window and check that Local AI controls, messages, and composer do not clip horizontally.

Notes:

- Mock providers may show dashes for token counts because they do not emit provider usage metadata.
- Device display is a runtime hint inferred from model variant identifiers when Foundry exposes CPU/GPU/NPU in the ID; CrownKeep does not treat that label as proof of useful acceleration.
- Performance guidance uses observed response behavior. A slow GPU-labeled variant on a virtual host should be treated as a candidate for CPU comparison rather than automatically preferred.


---

## Temporal context and fixed-origin validation

CrownKeep development is pinned to `http://localhost:5173`.

If another Vite process already owns port 5173, `npm run dev` should now fail instead of silently switching to 5174. This protects the IndexedDB origin used by local conversations.

If 5173 is occupied, identify the process:

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

Then inspect or stop the owning process if it is an old CrownKeep/Vite session:

```powershell
Get-Process -Id <PID>
Stop-Process -Id <PID>
```

Do not kill an unknown process without first checking what it is.

### Temporal context test

1. Start CrownKeep on port 5173.
2. Create a new conversation.
3. Ask Anne: `What is today's date and what time zone are you using?`
4. Confirm the answer is based on the device-supplied current date/time rather than model training knowledge.
5. Send two or three messages a few minutes apart.
6. Ask: `What have we discussed in the last few minutes?`
7. Confirm Anne can use the persisted message timestamps in the active conversation.

### Context exclusion test

1. In an existing conversation, use **⊘ Context** on one message.
2. Confirm the message remains visible and is marked **Excluded from future inference context**.
3. Send a follow-up question that would otherwise depend on that message.
4. Confirm the excluded message is not sent in the next inference request.
5. Use **↺ Include** to restore the message.
6. Refresh CrownKeep and verify the exclusion/restoration state persists.

Important distinctions:

- Deleting a conversation permanently removes that conversation from this device.
- **⊘ Context** preserves the local history but omits that message from future inference requests.
- Other conversations are not automatically part of the active conversation's model context.
- Cross-conversation local recall is a separate future capability.


---

## Sprint 2.2B runtime onboarding validation

With Foundry Local already running and a model loaded:

1. Pull current `main` and run CrownKeep on port 5173.
2. Select **Anne · Foundry Local**.
3. Open **Local AI**.
4. Confirm the **Local AI setup** card shows:
   - Runtime: Connected
   - Model: Selected
   - Verify: Not tested (until verification is run)
5. Select **Verify local AI**.
6. Confirm the verification completes without adding a test message to the active conversation.
7. Confirm the setup card changes to **Verified**.
8. Confirm the verification survives a browser refresh for the same selected provider/model.
9. Stop or restart Foundry outside CrownKeep, return focus to the CrownKeep window, and confirm CrownKeep rechecks runtime state.
10. Use **Recheck** after any external Foundry/model change and confirm provider/model state refreshes.
11. Change to a different model and confirm verification is no longer treated as valid for the previous model.
12. Confirm the browser UI explicitly states that runtime/model lifecycle is externally managed in development.

Expected limitation:

The browser development build cannot directly start/stop Foundry or install/load/unload models. Those methods are represented in the runtime lifecycle contract for the later Windows desktop host.

A successful normal CrownKeep chat may also satisfy the local verification step because it proves the selected provider/model can complete a real inference request.


### Temporal latency regression

Use the same AVD/model where a 1,004 prompt-token request produced about 10.5 seconds to first token.

1. Pull current main and restart Vite.
2. Open the same conversation.
3. Ask a normal non-temporal question such as: `Give me one sentence about CrownKeep.`
4. Confirm Anne does not print a raw `[Message timestamp: ...]` prefix.
5. Open Local AI → Diagnostics and record Prompt tokens and First token.
6. Ask a temporal question such as: `What did we talk about in the last 10 minutes?`
7. Confirm Anne can still reason over message timing without printing internal timeline markup.
8. Confirm the conversation and Local AI panel scrollbars use CrownKeep jade/graphite styling.
9. If Prompt tokens are >= 750 and first-token time remains high, use **⊘ Context** on older messages and repeat the normal question to measure the reduction.


---

## Phase 3.1A iPhone capability validation

Branch:

```text
phase-3-iphone-local-ai
```

### Desktop regression

On Windows:

1. check out the Phase 3 branch;
2. run `npm install`;
3. run `npm run dev`;
4. confirm Foundry Local and existing conversations still behave normally;
5. confirm no iPhone-only provider replaces Foundry on desktop.

### iPhone Safari/PWA capability state

Before the native host exists:

1. serve CrownKeep over an iPhone-accessible HTTPS/LAN development path as appropriate for the test;
2. open CrownKeep in Safari or its PWA shell;
3. confirm CrownKeep recognizes iOS;
4. confirm local iPhone AI is reported as unavailable in browser-only mode;
5. confirm the UI explains that the native CrownKeep host is required for Apple on-device AI;
6. confirm saved local conversations remain accessible even though the native model is unavailable.

### Native-host contract

When the first Xcode host is added, validate:

1. the host injects/exposes `window.crownKeepNativeAI`;
2. `AppleFoundationModelsProvider` becomes available automatically;
3. model availability maps correctly for:
   - available;
   - device not eligible;
   - Apple Intelligence not enabled;
   - model not ready;
4. no unavailable state silently routes the conversation to cloud;
5. the first native response returns through the same `AIProvider` conversation flow used on Windows.


---

## Mock native iPhone host from Windows

Use this while the physical Mac/Xcode environment is unavailable.

Check out the Phase 3 branch:

```powershell
git fetch
git switch phase-3-iphone-local-ai
git pull
npm install
npm run dev
```

### Simulate a supported native iPhone host

Open:

```text
http://localhost:5173/?nativeAI=mock
```

Expected:

- Provider list includes **Anne · Apple On-Device**.
- Model list includes **Apple On-Device Model**.
- Sending a message returns a development response beginning with **Mock iPhone-local Anne received:**.
- The assistant message remains marked local.
- Conversation persistence/provider neutrality continues to work.

### Simulate Apple availability failures

Use one of:

```text
http://localhost:5173/?nativeAI=mock&nativeAIState=device-not-eligible
http://localhost:5173/?nativeAI=mock&nativeAIState=apple-intelligence-not-enabled
http://localhost:5173/?nativeAI=mock&nativeAIState=model-not-ready
```

Confirm CrownKeep reports the selected state explicitly and does not silently route the prompt to cloud.

This harness does not prove Apple's Foundation Models framework works. It proves the CrownKeep TypeScript/provider side of the native bridge before the real Swift/Xcode host is connected.
