# RDC AI — Decision Log

## 2026-10-03 — Julia advisory qualification and shared local image runtime

- Own the decision engine separately from Anne inference: native Rust ONNX Runtime CPU on Windows; Apple-native conversion required for iOS. No hosted Julia/Jev, product Python or hidden cloud fallback.
- Do not confuse publisher parity with CrownKeep accuracy: CPU FP32 matches 100/100 publisher cases but only 9/16 initial CrownKeep fixtures. All production Julia categories remain disabled; Auto uses Quick until held-out/native/device qualification. INT8 parity loss and FP16 graph failure are retained, not promoted.
- Model routing selects only already qualified/available cached role winners; explicit roles override Auto, Deep is never invented, downloads/cloud are never initiated by routing.
- Julia semantics stay advisory after deterministic privacy/security/tool limits. Confidence ≥0.80 is an initial abstention threshold, not calibrated certainty. Event-driven only.
- Unify manual/assistant image generation behind one persisted loopback runtime and permission switch. Probe readiness when the workbench opens; no silent generator launch or install.
- Preserve all physical failures and distinguish automated implementation from physical acceptance. Details: [engine/evals](JULIA-DECISION-ENGINE.md), [validation](DECISION-IMAGE-VALIDATION.md).


This file records project decisions that must survive beyond chat history.

## ADR-0001 — Public application repository

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

`dakROLO/rdc-ai` is a public repository.

The repository may contain application code, architecture, public-client configuration, deployment templates, and synthetic fixtures.

It must not contain real RDC customer data, private conversations, production credentials, tokens, secrets, or connection strings.

### Reason

The project is intended to be shareable while keeping sensitive RDC systems behind authenticated Azure APIs.

---

## ADR-0002 — RDC tenant is the cloud/security boundary

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

RDC Azure will host cloud-side resources for this project, including future encrypted synchronization and cloud AI capabilities.

### Constraint

Local inference and existing local conversation history must remain usable when RDC Azure is unavailable.

---

## ADR-0003 — Microsoft Entra ID for cloud authentication

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Use the existing RDC Microsoft Entra tenant for authentication to protected cloud capabilities.

Do not create a separate username/password system.

The PWA/client is treated as a public client and must not contain a client secret.

---

## ADR-0004 — No RDC production-data connection in current project scope

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

The architecture will define a future `ContextProvider`, but the application will not connect to RDC customer, Blueprint, dashboard, project, document, or operational data in the current roadmap.

Synthetic fixtures may be used to validate the interface.

---

## ADR-0005 — Local-first, provider-neutral conversations

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

A conversation is not bound to one model/provider.

Assistant messages record provider ID, model ID, and local/cloud classification individually.

---

## ADR-0006 — Shared TypeScript/React PWA first

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Prefer one TypeScript/React application delivered first as an installable PWA for iPhone and Windows-capable browsers.

Do not introduce a native wrapper unless a concrete capability requires it.

---

## ADR-0007 — Initial local providers

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Initial provider targets are:

- Windows: Microsoft Foundry Local.
- iPhone/web: WebLLM/WebGPU-style on-device provider where supported.
- Cloud: Azure-hosted provider behind the RDC API in a later phase.

Ollama is not part of the initial implementation.

---

## ADR-0008 — Client-side encrypted synchronization

**Status:** Accepted in principle; key design pending  
**Date:** 2026-09-24

### Decision

Cross-device synchronization will use client-side authenticated encryption so the Azure sync store does not require plaintext conversation contents.

### Open decision

The key hierarchy, enrollment, recovery, rotation, and device-revocation design must be completed before implementation.

---

## ADR-0009 — Repository documentation is the project system of record

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Important decisions, completed work, blockers, and architecture changes must be reflected in repository documentation.

Chat history is not authoritative project context.


---

## ADR-0010 — Foundation web toolchain

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Use the current official Vite React/TypeScript application pattern as the Phase 0 foundation.

Initial dependency baseline:

- React 19.3;
- Vite 8.3;
- TypeScript 6.0.x;
- official Vite React plugin;
- Oxlint for the initial lint step.

### Reason

This keeps the foundation close to the current upstream Vite React TypeScript template and minimizes custom build tooling before local inference work begins.


---

## ADR-0011 — CrownKeep product identity and Anne assistant

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

The working product identity is **CrownKeep** with the tagline:

> **Private by default. Powerful by choice.**

The conversational assistant is named **Anne**.

The canonical palette is:

- Graphite `#0F1F1E`
- Deep Jade `#115E4F`
- Jade Glow `#2EE6B8`
- Burnished Copper `#C97F5B`
- Stone `#E8E4DA`

The canonical visual direction is the Inner Keep mark documented in `docs/BRAND.md`.

---

## ADR-0012 — Native IndexedDB for first local persistence implementation

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Use browser-native IndexedDB behind the existing `ConversationRepository` abstraction for the first persistent local store.

### Reason

It keeps Sprint 1.1 dependency-light, works offline, is available in the PWA/browser target, and preserves the ability to replace the storage implementation later without changing the conversation domain.

### Constraint

IndexedDB is an implementation detail. UI and provider code must depend on the repository abstraction rather than IndexedDB directly.

---

## ADR-0013 — IDs must work on LAN HTTP development origins

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Do not depend directly on `crypto.randomUUID()` for application IDs.

Use `crypto.getRandomValues()` when available, with a development fallback, so basic same-network phone testing does not fail solely because the app is being served over a non-HTTPS LAN origin.


---

## ADR-0014 — Message order uses a persisted sequence

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

Every persisted message receives a monotonic `sequence` within its conversation.

`createdAt` remains a timestamp, but it is not the authoritative ordering key.

### Reason

Two messages can be created within the same millisecond. Timestamp-only sorting allowed an assistant response and its triggering user message to swap positions after an IndexedDB reload.

IndexedDB schema version 2 migrates version-1 records to deterministic sequence positions.

---

## ADR-0015 — Foundry Local REST provider with configurable fixed development endpoint

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

CrownKeep's first Windows Foundry Local integration uses the documented OpenAI-compatible REST service behind `FoundryLocalProvider`.

Development defaults to:

```text
http://localhost:39839
```

The endpoint is configurable through `VITE_FOUNDRY_LOCAL_ENDPOINT`.

### Reason

A browser application cannot execute `foundry server status` directly. Microsoft Foundry Local normally uses a dynamic port, but its CLI supports starting/restarting the daemon on a fixed port for application integration.

The fixed port is a development/distribution convention, not a credential or permanent architectural coupling.


---

## ADR-0016 — Prefer the current OpenAI-compatible Foundry Local /v1 surface

**Status:** Accepted  
**Date:** 2026-09-24

### Decision

CrownKeep probes and consumes the current Foundry Local OpenAI-compatible HTTP surface first:

- `GET /v1/models`
- `POST /v1/chat/completions`

The older `/openai/*` management surface is compatibility fallback only.

For the first browser-based Windows vertical slice, model loading is performed through the Foundry CLI rather than relying on an HTTP management endpoint.

### Reason

The active development-machine CLI reported Ready but returned 404 for the older management routes. Current Microsoft examples for external clients use the `/v1` base URL.

A Vite development proxy forwards `/foundry-local/*` to the loopback Foundry service to avoid CORS coupling during development.


---

## ADR-0017 — Stable development origin for local storage

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Vite development uses port `5173` with `strictPort: true`.

If port 5173 is already occupied, CrownKeep development must fail visibly rather than silently moving to another port.

### Reason

Browser IndexedDB is scoped to the web origin. Because the port is part of the origin, `http://localhost:5173` and `http://localhost:5174` receive different local databases. Silent Vite port fallback made existing conversations appear to disappear even though they remained stored under the original origin.

This is a development-only concern. The future installed Windows application must use a stable application storage location/origin.

---

## ADR-0018 — Temporal context and reversible message exclusion

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Every inference request receives device-generated temporal metadata:

- current device-local date/time;
- device IANA time zone when available;
- current UTC timestamp;
- conversation creation timestamp;
- original persisted timestamps attached to included historical messages.

CrownKeep also allows an individual persisted message to be marked `excludedFromContext`.

Excluded messages remain visible in local conversation history but are omitted from future inference requests until restored.

### Reason

Anne needs explicit time metadata to answer relative-time questions such as “today,” “earlier,” or “what did we discuss in the last 20 minutes.”

Context management should not require deleting the user's local record. Reversible exclusion separates **conversation history** from **active model context**.

### Scope

This enables temporal reasoning within the active conversation. It does not yet provide automatic recall across separate conversations. Cross-conversation local recall remains a later feature.


---

## ADR-0019 — Separate inference from runtime lifecycle management

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Keep local AI inference behind `AIProvider`, and manage native runtime/model lifecycle behind a separate `LocalRuntimeManager` contract.

The browser development implementation may inspect an externally managed Foundry Local service but must not pretend it can install, start, stop, load, or unload native runtime resources.

A later Windows desktop host will implement those lifecycle actions natively while reusing the same React first-run setup UI.

### Reason

This avoids coupling conversation/provider logic to PowerShell or a particular desktop wrapper and provides a stable seam for moving from today's developer workflow to a downloadable Windows application.

Observed model performance remains part of setup validation so CrownKeep can avoid preferring a poorly performing device variant merely because it is labeled GPU.


---

## ADR-0020 — Native Apple Foundation Models is the primary iPhone local provider

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

Use Apple's Foundation Models framework through a native iPhone host as CrownKeep's primary iPhone local-inference path.

Keep the shared React conversation UI and provider-neutral `AIProvider` model.

The native host exposes local inference through `NativeAIHost`, and `AppleFoundationModelsProvider` adapts that bridge into the same conversation system used on Windows.

Safari/PWA mode must explicitly report when native Apple local AI is unavailable rather than pretending that the browser has access to the on-device Foundation Model.

WebLLM/WebGPU remains a fallback/experimental path, not the default iPhone architecture.

### Reason

The native framework exposes the device's Apple on-device language model, availability reasons, context information, and session APIs directly. This avoids requiring CrownKeep to download and manage a separate browser model on capable iPhones and gives the native app a clearer local-first lifecycle.

### Constraint

This decision does not permit silent cloud fallback. If the Apple on-device model is unavailable, CrownKeep must surface that state and preserve the user's explicit choice boundary.


---

## ADR-0021 — Projects are a local organizational layer

**Status:** Accepted  
**Date:** 2026-09-25

### Decision

A CrownKeep conversation may belong to zero or one local Project.

Projects organize conversations but do not change inference context, conversation identity, provider selection, or message ownership.

Deleting a Project does not delete its conversations; those conversations become Unassigned.

### Reason

Projects provide useful organization without coupling the core conversation model to future RDC context or synchronization decisions.

---

## ADR-0022 — Tauri 2 selected for the Windows product-host spike

**Status:** Accepted for Phase 4A validation  
**Date:** 2026-09-26

### Decision

Use Tauri 2 for the Phase 4A Windows native-host spike around the existing CrownKeep Vite/React application.

The host must preserve the existing provider-neutral conversation UI and use the established `LocalRuntimeManager` boundary for native runtime/model lifecycle actions.

If the shell proof validates, the intended Windows runtime integration is the official Foundry Local Rust SDK with the Windows `winml` feature. The framework choice remains reversible until the host/runtime/installer slices are validated.

### Reason

CrownKeep now has a concrete browser capability gap: normal Windows users should not have to operate Vite, PowerShell, or a separately managed Foundry CLI.

Tauri supports an existing Vite frontend while providing a Rust native host. Microsoft currently publishes an official Foundry Local Rust SDK, including a Windows WinML integration path, which aligns with the existing runtime abstraction.

### Constraints

- Do not move conversation/provider logic into Rust merely because a native host exists.
- Do not make Azure required for local Windows use.
- Browser development must remain functional.
- Do not add Foundry SDK lifecycle ownership until the Tauri shell/bridge proof is validated.
- No real RDC customer data is introduced by this phase.


---

## ADR-0023 — Adaptive Windows model selection is capability- and benchmark-driven

**Status:** Accepted  
**Date:** 2026-09-26

### Decision

CrownKeep uses one Windows model-selection policy across physical PCs, laptops, virtual desktops, and other Windows hosts.

The selection flow is:

1. discover actual hardware and execution-provider capabilities;
2. inspect compatible model families and variants;
3. filter candidates by task, memory/resource fit, and required capabilities such as tool calling or speech;
4. benchmark viable candidates using observed performance;
5. recommend and persist the best observed result for the current machine/runtime fingerprint.

The product must not choose a model or execution provider merely because the host is labeled `AVD`, `laptop`, `desktop`, or similar.

Different hosts may produce different selected models or execution providers, but those outcomes must emerge from the same analysis rather than separate hard-coded host policies.

### Reason

Testing already showed that a virtual WebGPU path can be much slower than CPU on one Windows host, while the primary laptop exposes CUDA/TensorRT-capable NVIDIA acceleration. Host labels are therefore a poor proxy for usable local-AI capability.

Observed performance and real runtime capability are the durable decision inputs.

### Constraints

- A catalog `GPU` label is only a candidate signal, not a recommendation.
- Manual variant forcing remains an advanced diagnostic override, not the normal user path.
- Re-analysis should occur when meaningful hardware, driver, execution-provider, or runtime characteristics change.
- This decision applies to Windows model/runtime selection; iPhone continues to use its native Apple capability path behind the same shared product experience.

## ADR-0024 — Measured family preferences and local dictation

**Status:** Implemented; native validation pending
**Date:** 2026-09-26

Normal Windows choices are model families. Compare compatible execution paths using the same short prompt and persist only accepted observations, including the resolved variant and hardware/runtime fingerprint. A stale fingerprint cannot reuse a measured variant as an authoritative preference. Tool capability remains catalog metadata, not actual tool execution. Experimental families require an explicit user action.

Dictation is review-before-send and behind a separate speech provider boundary. Windows uses the existing pinned Foundry SDK; iPhone uses Apple SpeechAnalyzer with installed on-device language assets. Unsupported speech is explicitly unavailable. Speech resources release after each recording. Cancellation never appends a late transcript; Windows native work finishes cleanup before another runtime operation is enabled.

The local-baseline merge/tag remains gated on actual laptop, second Windows host, and iPhone validation. CI compilation is necessary but does not replace those tests.

---

## ADR-0025 — System Foundry is the Windows runtime authority

**Status:** Accepted; migration validation pending
**Date:** 2026-09-27

Windows CrownKeep requests model aliases and records the actual variant/provider/device chosen by System Foundry. CrownKeep owns roles, policy, benchmarks, UX, diagnostics, and recovery; it does not own a second Foundry cache or duplicate Foundry hardware routing.

The installed Foundry CLI's cache location and local service are discovered at physical acceptance. The existing SDK-backed host remains a compatibility path until that migration proves the system cache, lifecycle, and REST model state agree. No legacy cache is deleted by this decision.

---

## ADR-0026 — LocalRuntime, tools, and knowledge sources remain provider-neutral

**Status:** Accepted
**Date:** 2026-09-27

Shared CrownKeep code depends on a minimal `LocalRuntime` contract, not Foundry-specific types. Tool and knowledge-source contracts declare network/access requirements explicitly. An RDC integration, when authorized later, will be a configured `KnowledgeSource`, not a CrownKeep product mode or direct data dependency.

---

## ADR-0027 — Installed System Foundry is the Windows chat/model authority

**Status:** Implemented; physical validation pending
**Date:** 2026-09-27

The packaged Windows chat/model path invokes the installed `foundry` CLI for lifecycle and discovery, then uses that reported service endpoint for OpenAI-compatible inference. CrownKeep activates aliases and records the actual API-visible model rather than restoring a stale exact variant.

The prior embedded SDK manager remains temporarily for native dictation and dormant legacy commands. It is not registered as the normal chat/model runtime. The legacy `.CrownKeep` model cache is marked diagnostic-only and must not be deleted until physical evidence proves all normal model operations use the System Foundry cache.


---

## ADR-0028 — Web Access is an explicit tool boundary, not a model/provider switch

**Status:** Accepted for policy/tool semantics; network-transport details superseded by ADR-0029  
**Date:** 2026-09-28

### Decision

CrownKeep exposes public-web access through registered read-only tools while keeping reasoning-provider selection independent.

The user-facing preference is **Web Access: OFF / ON** and defaults to **OFF**, consistent with **Private by default. Powerful by choice.**

When OFF:

- network tools are rejected by `ToolRegistry` before availability checks or execution;
- local chat remains available;
- automatic tool selection cannot silently make a network request;
- CrownKeep does not fall back to a cloud model.

When ON:

- Anne may use `Web Search` and `Web Read` when the request needs current/external information;
- successful or failed network-tool activity is visible separately from model/provider metadata;
- tool results return to the same selected reasoning provider.

### Network/data boundary

The client must not embed a web-search-provider API secret.

CrownKeep uses a narrow provider-neutral Web Gateway. The first adapter is an Azure Functions implementation backed by Tavily Search/Extract, but the client contract is vendor-independent so that provider can be replaced without changing `ToolRegistry`, Windows model policy, Apple Foundation Models, or conversation storage.

For current public-web tools the device may send only:

- the minimum search query required for `Web Search`; or
- the single selected public URL required for `Web Read`.

These tools do **not** receive entire conversation history, projects, local knowledge, attachments, files, images, or unrelated context.

Web content is returned to the model as untrusted reference data, never as instructions.

### Automatic tool strategy

Windows may use normal OpenAI-compatible structured function calling only when the active local model has **observed** function-call support for the current device/runtime fingerprint. CrownKeep does not infer this capability from a model name when System Foundry metadata is missing.

If structured tool calling is unknown/unsupported, CrownKeep uses a bounded provider-neutral read-only fallback rather than silently switching AI providers.

Native iPhone exposes the same logical CrownKeep tools through Apple Foundation Models `Tool` objects. The Foundation Model remains the local reasoning provider.

All automatic tool loops are bounded. The current structured and fallback paths permit at most three read-only network-tool operations for one user turn before requiring a final answer.

### Consequences

- Web Access can be enabled without authorizing cloud AI.
- A response may be labeled **Local** while also showing visible web-search/page-read activity.
- A future enterprise/public-web provider can replace Tavily behind the gateway contract.
- AVD uses the same Windows policy; there is no AVD-specific agent architecture.
- Image/OCR/image-generation tools should reuse this boundary rather than creating a parallel agent system.

## ADR-0029 — Web Access uses native direct transport with device-local credentials

**Status:** Superseded by ADR-0030 before physical acceptance  
**Date:** 2026-09-28

### Context

ADR-0028 established the durable rule that Web Access is an explicit read-only tool boundary and does not change the selected reasoning provider. Its first transport used a CrownKeep-hosted Azure Function/Web Gateway primarily to keep a shared search-provider key out of the client.

Before physical acceptance, that gateway dependency was rejected as unnecessary for CrownKeep's current local-first product. Windows and iPhone already have native hosts capable of making bounded HTTPS requests and protecting a user-supplied credential locally.

### Decision

Keep ADR-0028's ToolRegistry, Web Access OFF/ON, bounded automatic-tool, source-metadata, and same-local-provider rules, but replace the gateway transport with native direct execution.

**Windows**

- the Tauri/Rust host performs Web Search and Web Read network requests;
- Tavily is the first Web Search adapter;
- the user supplies the search credential once through CrownKeep;
- the native host stores it in Windows Credential Manager;
- the React/webview layer receives configured/not-configured status but never reads the stored credential back.

**iPhone**

- the Swift host performs Web Search and Web Read network requests with `URLSession`;
- Tavily is the first Web Search adapter;
- the user supplies the search credential once through CrownKeep;
- the native host stores it in iOS Keychain using a device-local, non-synchronizing accessibility class;
- the JavaScript bridge receives configured/not-configured status but never reads the stored credential back.

**Web Search**

- requires Web Access ON;
- requires a configured native search credential;
- sends only the minimized public search query plus provider authentication directly to the configured provider.

**Web Read**

- requires Web Access ON;
- does not require a search-provider credential;
- fetches only the selected public HTTP(S) URL directly from the native device;
- returns bounded readable content as untrusted reference material.

Browser-only development does not store a live provider credential and does not pretend native direct Web Access is available.

### Removed architecture

The Azure Function/Web Gateway prototype, its `VITE_CROWNKEEP_WEB_GATEWAY_URL` configuration, Python service files, and gateway CI check are removed. There is no hidden fallback to that path.

### Consequences

- CrownKeep does not operate a web-retrieval middleman for the current local-first product.
- Search credentials remain local to each device and are not bundled, synced, or placed in Vite/environment configuration.
- Users configure the search credential separately on Windows, iPhone, and AVD as applicable.
- Direct Web Read remains useful even before a search credential is configured.
- Search-provider replacement remains an adapter concern behind `WebSearchTool` / the native web transport rather than a conversation/model concern.
- A future centrally managed enterprise or public distribution may add an **optional** managed search boundary if credential distribution, quota, abuse protection, or organization policy requires it; that would require a new explicit decision rather than silently restoring the removed gateway.
- Physical acceptance must prove OFF blocks all network tools, ON does not search unnecessarily, search/read activity is visible, provider identity remains local, and network/provider failures do not trigger cloud-model fallback.

## ADR-0030 — Web Search is keyless DuckDuckGo retrieval

**Status:** Accepted and implemented; physical Web Access acceptance pending  
**Date:** 2026-09-28

### Context

CrownKeep should remain useful without requiring the user to create, fund, or manage a third-party search API account. The prior direct-native Tavily design removed the CrownKeep-hosted gateway but still required a Tavily API key stored separately on each device.

DuckDuckGo provides public non-JavaScript HTML/Lite search results and states that DuckDuckGo Search does not track individual searches. This allows CrownKeep to use a normal public search surface for discovery while keeping model reasoning local.

The non-JavaScript search page is a browser-facing public surface, not a formal developer API. Its HTML can change and DuckDuckGo can rate-limit or require interactive verification.

### Decision

Replace Tavily and all search-credential handling with a **keyless DuckDuckGo search adapter**.

- Web Access remains OFF by default and enforced by `ToolRegistry`.
- Web Search sends only the minimized public query to DuckDuckGo's non-JavaScript HTML search surface.
- CrownKeep parses returned result titles, URLs, and snippets locally.
- DuckDuckGo redirect URLs are unwrapped locally to the selected public destination.
- Web Read continues to fetch selected public HTTP(S) pages directly from the native device.
- The selected local model remains the reasoning provider.
- No API account, API key, Windows Credential Manager entry, iOS Keychain search item, Azure Function, or CrownKeep web gateway is required.
- The shared webview does not perform live search directly; native Windows/iPhone hosts own network execution.

### Failure behavior

If DuckDuckGo returns a rate limit, interactive verification, challenge, unexpected markup, or other retrieval failure:

- surface the Web Search failure visibly;
- do not attempt to bypass an interactive verification;
- do not silently switch to Google, Bing, Brave, Tavily, or another search provider;
- do not switch to cloud-model reasoning;
- keep local chat available.

A future additional search provider must be an explicit user/product capability and requires a new decision rather than an invisible fallback.

### Privacy/data boundary

For search, only the minimized query leaves the device for DuckDuckGo. For page reading, only the selected public URL is requested from that website.

CrownKeep does not send whole conversations, local knowledge bases, files, attachments, projects, images, or unrelated context through Web Search/Web Read.

### Consequences

- Zero search credentials to provision, store, rotate, bundle, or sync.
- Windows, iPhone, and AVD can share the same logical Web Access behavior without per-device provider setup.
- Public-search reliability is intentionally best-effort because the DuckDuckGo HTML surface is not a formal API contract.
- Direct URL reading remains independent of search discovery.
- The provider-neutral `WebSearchTool` contract remains replaceable later without changing conversation/model architecture.



## ADR-0031 — Prioritize iOS tools and encrypted daily continuity

**Status:** Accepted sequencing; implementation/physical acceptance pending
**Date:** 2026-09-30

The user prioritizes dependable iOS tools, then account login and iPhone/Windows synchronization. Execute 4A.4N and a narrow 4A.4O daily-use pass, then 4B.1–4B.2 and 5.1–5.3 as specified in [the daily-use plan](DAILY-USE-COMPLETION-PLAN.md).

Bring essential backup/update-storage checks forward. AVD, Deep qualification, broad multimodal work, public installer release and cloud reasoning do not block the personal two-device milestone. Preserve local operation without Azure, explicit sync opt-in, client-side encryption and a provider-neutral conversation. Sign-in does not enable web tools, upload old history or select cloud inference. Native auth adapters must fit the actual WKWebView/Tauri hosts.

Sync key hierarchy, enrollment/recovery and persistence remain design decisions for 5.1; this ADR does not select a cryptographic protocol or claim sync exists. Real RDC data stays disconnected and any later RDC integration is one configured knowledge source.

## 2026-10-03 — Prompt transparency, deterministic Apple grounding and scoped images

- Expose the last CrownKeep request locally, including exact Apple flattened instructions/prompt. Session-only snapshots; no routine content logging or uploads; provider-owned hidden instructions are outside this view.
- Default Apple web grounding uses the existing bounded shared prefetch path, supplying retrieval text before generation and retaining it for later turns. Web OFF prohibits new retrieval, not use of saved evidence. Pronoun queries require editable review; OCR text does not drive automatic searches.
- Preserve instructions/current request under conservative character budgets, keeping newest eligible history. Bound output and reconcile actual loaded chat state rather than inferring it from API model listings.
- Image reading is reviewed local OCR, not pixel-aware reasoning. Bundle English browser OCR assets. Apple generation is an explicit capability-gated Image Playground sheet; Windows generation is an explicit loopback-only WebUI adapter. No implicit cloud fallback or whole-chat upload.
- Canonical full vector mark generates opaque 1024px iOS and PWA PNGs. Normal update installation preserves history. Browser local Foundry is the first Apple Silicon Mac path; native Mac packaging is separate.
- These repairs do not implement login/sync or prove physical acceptance. See repair matrix and Mac quickstart.


## ADR-0032 — Assistant chooses tools within user boundaries

**Status:** Implemented; native build and physical acceptance remain gates
**Date:** 2026-10-03

Web Access ON authorizes automatic search/read without a query confirmation. Permitted tools are offered on ordinary tool-capable turns; keyword detection only supports the invisible deterministic fallback. Tool results require a bounded same-provider reasoning continuation and local source/evidence retention. A corrective pass/evidence view prevents saving false browsing/cutoff boilerplate after successful sourced retrieval. Web OFF still rejects network tools before availability/execution and never selects cloud reasoning. Canonical provider-neutral IDs use dotted names; old diagnostic IDs remain aliases.

Normal users select Quick/Balanced/Deep and permissions. Provider/raw model selection is removed from normal settings; runtime details and advanced setup remain in Diagnostics. Composer images replace the standalone Images button. Prompt/context inspection lives inside the Keep.

This supersedes the October 3 pronoun-query review and default Apple prefetch decision above. It preserves the physical failure: Quick ignored successful Windows `/web` evidence and answered from its April 2023 cutoff. Automatic Windows orchestration and repaired iOS tools are not physically accepted.

## ADR-0033 — Native image input and optional local diffusion

**Status:** SDK/runtime-gated image input implemented; optional generation runtime deferred
**Date:** 2026-10-03

Apple documentation identifies Foundation Models `Attachment` as introduced in iOS 27. Keep deployment target 26.0; compile that API only with the existing `CROWNKEEP_IOS27_SDK` condition and check iOS 27/model availability at runtime. Older SDK builds expose local OCR and accurately report direct understanding unavailable. Use `SystemLanguageModel.default` only; never use Private Cloud Compute for image analysis implicitly.

Remove Image Playground from CrownKeep. Define an optional downloadable Core ML generation capability, with no bundled weights, automatic downloads, or pretend-ready status. Windows retains its localhost WebUI adapter. The next implementation step is the model package/install/runtime slice in [LOCAL-IMAGE-CAPABILITY.md](LOCAL-IMAGE-CAPABILITY.md), with licensing, memory, cancellation and offline validation before enabling generation. Image generation permission is separate from Web Access and other writes.

## ADR-0034 — iPhone optional local models are explicit downloads with local runtime gates

**Status:** Implemented; physical acceptance pending  
**Date:** 2026-10-03

### Decision

CrownKeep may install large optional local models on iPhone only after an explicit user download action. Installing a model does not grant network/tool permissions, upload conversation data, or authorize cloud inference. Optional model files live under CrownKeep Application Support, can be removed independently of conversations, and are never downloaded merely because CrownKeep starts or an Auto/tool permission is selected.

For Julia Decision Assist, CrownKeep pins a Core AI Julia-1 artifact/tokenizer by revision and validates a publisher parity row plus native inference smoke case on the device before reporting the runtime installed. Native compatibility does not equal semantic qualification. Until a CrownKeep decision category passes the explicit held-out/error-rate/resource gate, Julia decisions run only in optional local shadow mode and cannot change model routing or tool execution. Hard privacy/tool policy remains deterministic code.

For iPhone image generation, CrownKeep pins a compiled palettized Core ML Stable Diffusion artifact by revision, expected compressed size and SHA-256, stages/extracts it locally, validates that Apple's Stable Diffusion pipeline can load the resources, and exposes `image.generate` only when the runtime is Ready and Local Image Generation is ON. Generation uses the local Core ML pipeline; there is no Image Playground or hidden cloud image fallback.

Web-search/page-read failures remain separate from model-provider health. In particular, an HTTP 403 from one selected webpage is a tool/source failure and must not be reported as Apple local-model failure when the model itself remains healthy.

### Consequences

- iPhone base-install size stays smaller; Julia (~624 MB model/tokenizer package) and image generation (~1.57 GB compressed archive plus staging/on-disk overhead) are opt-in.
- The device needs network access only for the explicit model download; installed inference/generation is designed to work locally/offline.
- Downloads and physical runtime behavior still require actual iPhone acceptance. Do not claim background/resumable downloads, production Julia semantic quality, or acceptable image memory/thermal behavior until measured.
- After this physical acceptance package, the next repository milestone is the branch-flattening/squash review before account/login/sync work.
