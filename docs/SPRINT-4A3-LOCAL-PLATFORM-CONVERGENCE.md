# Sprint 4A.3 — Local Platform Convergence / Pause Point

**Branch:** `sprint-4a3-local-platform-convergence`  
**Starting point:** `phase-4a-windows-product-host` @ `72b8056e455e181ed7c2a69f1c3956a15f57c0f3`  
**Date:** 2026-09-26

> **Continuation note — 2026-09-28:** This file preserves the original 4A.3 convergence contract. Work continued on the same branch through Sprint 4A.4. The Windows laptop and Rolo15 local baselines described by this sprint are now physically proven; AVD remains pending. The later 4A.4 Web Access package deliberately advances beyond 4A.3's original "no actual agent execution" scope by evolving the existing ToolRegistry rather than rewriting the architecture. See `docs/SPRINT-4A4-VALIDATION.md`, `docs/STATUS.md`, and `docs/DECISIONS.md` for the current authoritative state. No merge/tag/branch cleanup is authorized yet.

## Why this sprint exists

CrownKeep has now proven the major local-first pieces independently:

- Windows native Tauri host with CrownKeep-owned Foundry Local lifecycle.
- Windows device/model analysis with execution-provider discovery.
- Shared React/TypeScript conversation, project, persistence, and provider-neutral layers.
- Physical iPhone native host using Apple Foundation Models through the shared CrownKeep UI.
- Azure Virtual Desktop local inference using a small CPU model, including evidence that virtual WebGPU labels can be misleading.
- Runtime performance telemetry and first-token/total-time diagnostics.

The project does not need another broad feature phase yet. The next sprint should converge these paths, improve model selection, add local dictation, revalidate all three environments, clean the repository state, and stop at a stable local-first baseline before cloud sync, cloud escalation, RDC context, or agent/tool implementation.

## Sprint outcome

A user can open CrownKeep on the primary Windows laptop, the physical iPhone, or the AVD and get a consistent local-first experience appropriate to that device.

CrownKeep should use one adaptive model-selection system across Windows hosts. It must inspect the hardware/runtime capabilities actually present, benchmark viable candidates, and choose the best observed path. A physical laptop and an AVD must not be assigned different rules simply because of where they run; different outcomes are acceptable only when the same analysis produces them.

At sprint close, the repository should have one validated baseline on `main`, durable documentation of the supported local profiles, and a clear next-phase boundary.

---

## Work package A — Model Analyst v2: reduce variants to useful choices

### Problem

The current Windows device analysis correctly discovers execution providers and compatible variants, but the UI can expose an overwhelming catalog. On the primary laptop it found CPU + GPU, four execution providers, 118 accelerated variants, and 48 CPU variants.

The current loaded model was also a CPU-specific Phi-4 Mini variant even though the laptop has an NVIDIA GPU.

### Target behavior

1. Prefer Foundry model aliases for normal selection so Foundry can resolve the best hardware-specific variant.
2. Group catalog rows by model family/alias.
3. Keep raw variants under an Advanced disclosure instead of making them the primary selection list.
4. Filter to task-compatible candidates before presenting recommendations.
5. Show a short role-based recommendation set:
   - **Quick / Agent-ready**
   - **Balanced / Heavier**
   - **Experimental / Deep**
   - **Speech**
6. Display hardware fit, tool-call capability metadata, download/cache state, execution provider, and observed benchmark results.
7. Show real progress stages while device analysis is running instead of only disabling the Analyze button.
8. Do not treat a catalog `GPU` label as proof of useful acceleration. Observed performance wins.
9. Do not branch selection logic on host labels such as `AVD`, `laptop`, or `desktop`. The same discovery → candidate filtering → benchmark → recommendation policy must run on every Windows host.
10. Persist the observed result for the current machine/runtime fingerprint, but allow automatic re-analysis when meaningful hardware, driver, execution-provider, or Foundry runtime characteristics change.

### Primary Windows hardware profile

Observed development laptop:

- NVIDIA GeForce RTX 5070 Laptop GPU
- 8,151 MiB dedicated VRAM
- ~32 GB system RAM
- Intel integrated graphics drives the normal desktop path
- no NPU exposed in Task Manager
- Foundry providers observed:
  - CUDAExecutionProvider
  - WebGpuExecutionProvider
  - OpenVINOExecutionProvider
  - NvTensorRTRTXExecutionProvider

### Initial model candidates

The sprint should benchmark, not blindly hard-code, these roles:

**Quick / tool-ready**
- `phi-4-mini`
- Current Foundry catalog advertises tool calling.
- Goal: fast resident/default model.

**Balanced / tool-ready**
- `mistral-nemo-12b-instruct`
- Current Foundry catalog advertises tool calling.
- Goal: heavier local model if observed memory and latency are acceptable on 8 GB VRAM.

**Experimental / OpenAI reasoning**
- `gpt-oss-20b`
- Keep as experimental on this laptop.
- OpenAI documents roughly 16 GB memory as the intended footprint, which exceeds the laptop's dedicated 8 GB VRAM.
- Current Foundry catalog on this machine does not advertise tool calling for the packaged variant even though the underlying model supports agentic/tool capabilities in other runtimes.
- Do not make it the default unless real observed performance proves worthwhile.

### Model selection rules

CrownKeep should persist a **preferred model alias plus observed profile**, not permanently bind the product to a full hardware-specific model ID.

Persist at least:

- alias/model family;
- resolved variant ID;
- execution provider;
- device class;
- cached/downloaded state;
- tool capability metadata;
- benchmark timestamp;
- first-token latency;
- completion throughput when measurable;
- benchmark outcome.

---

## Work package B — Voice input / local dictation

### Scope boundary

This sprint adds **voice input to the composer**, not a full duplex voice assistant.

Required UX:

1. microphone button beside Send;
2. visible Listening / Transcribing / Ready states;
3. transcript appears in the composer before sending;
4. user can edit the transcript;
5. default behavior is review-before-send;
6. cancellation and microphone-permission failures are handled cleanly;
7. transcription remains local when a local speech provider is selected.

### Shared architecture

Add a provider-neutral speech boundary, for example:

```text
SpeechInputProvider
  capability()
  startCapture()
  stopCapture()
  transcribe()
  cancel()
```

The shared React UI should not know whether Windows uses Whisper or iOS uses Apple Speech.

### Windows native path

Use Foundry Local speech models through the existing native/runtime boundary.

First discover the actual speech catalog on the device, including:

```powershell
foundry model list --type speech --limit 20
foundry model list --device gpu --type speech --limit 20
```

Start with the smallest useful Whisper model and benchmark upward:

- `whisper-tiny`
- `whisper-base`
- `whisper-small`

The goal is interactive dictation without keeping unnecessary speech models resident in GPU memory.

Lifecycle expectation:

```text
tap mic
  -> load/wake speech model if needed
  -> capture
  -> transcribe locally
  -> place text in composer
  -> unload/sleep speech model after idle window
```

Foundry Local currently exposes both recorded-audio transcription and live microphone transcription APIs, so the sprint may start with record-then-transcribe and only use live partial transcription if it remains simple and stable.

### iOS native path

Use Apple's native Speech framework rather than downloading Whisper to the iPhone.

Target:

- `SpeechAnalyzer` + `SpeechTranscriber` where supported;
- capability-aware fallback/disabled state when unavailable;
- keep transcription local/on-device when the framework/device supports the required assets;
- bridge the result into the same shared `SpeechInputProvider` contract.

### Windows capability behavior

Voice uses the same capability-aware logic on every Windows host.

CrownKeep should inspect whether microphone capture, a compatible local speech model, and acceptable observed transcription performance are available. If they are, enable the same dictation UX. If they are not, show voice input as unavailable without affecting text chat.

Do not special-case AVD by name. Remote microphone redirection, virtual hardware, or missing acceleration should simply appear as capabilities or performance results discovered by the same analyzer.

---

## Work package C — Adaptive Windows runtime selection

### Known validation case

The church AVD is a useful second Windows test host because it previously exposed a misleading acceleration path:

- virtual WebGPU `qwen2.5-0.5b-instruct-generic-gpu:4`: about 49.9 seconds for a request and unsuitable for interactive use;
- forced CPU `qwen2.5-0.5b-instruct-generic-cpu`: about 0.97 seconds on the direct short API test;
- CrownKeep streamed response with the CPU path successfully.

This is evidence for the selection algorithm, not a reason to create an AVD-specific policy.

### Sprint target

1. Run the same Model Analyst flow on the primary Windows laptop and the AVD.
2. Discover the execution providers, devices, model families, memory constraints, and speech capabilities that each host actually exposes.
3. Generate viable candidates from those observed capabilities.
4. Benchmark the candidates using the same metrics and thresholds.
5. Choose and persist the best observed path for that machine/runtime fingerprint.
6. Reject any nominally accelerated path when observed latency/throughput is materially worse than another viable path.
7. Re-run analysis automatically or prompt for it when meaningful hardware/runtime characteristics change.
8. Keep manual variant forcing only as an Advanced/diagnostic override.

The result should be **one CrownKeep Windows intelligence policy that adapts itself to the machine it is running on**. The laptop may select CUDA/TensorRT and the AVD may select CPU, but neither outcome is hard-coded by host type.

---

## Work package D — iPhone catch-up and parity validation

The current Windows branch is a descendant of the validated iPhone work, so do not fork a separate product line.

Bring the physical iPhone forward from the current convergence branch and validate the shared UI after the Windows work.

Required validation on `Rolo15`:

- normal CrownKeep UI renders;
- branded app icon remains correct;
- Projects and rename/delete dialogs work;
- compact mobile navigation remains usable;
- **Anne · Apple On-Device** is automatically preferred;
- local Foundation Models responses still stream;
- cancellation works;
- conversations/projects persist across relaunch;
- Local AI/diagnostics do not expose Windows-only controls;
- model/device status language remains meaningful on Apple;
- new microphone/dictation control uses the native iOS speech path;
- no silent cloud fallback.

Do not attempt to make Apple Foundation Models behave like the Windows multi-model catalog. The iPhone local AI profile is the system-provided Apple model plus native speech capability.

---

## Work package E — Cross-platform UX and resource policy

### Shared model roles

Use role labels in product UX rather than hardware-specific IDs where possible:

- **Quick**
- **Balanced**
- **Deep / Experimental**
- **Voice**

Not every host must expose every role.

### Resource policy

Windows with 8 GB VRAM must not assume all chat and speech models remain resident simultaneously.

Implement or validate:

- idle unload;
- wake/reload;
- clear sleeping/loading/ready state;
- one-click wake/retry;
- model switch without corrupting the conversation;
- speech model release after dictation idle;
- non-blocking startup so history opens before AI is ready.

### Tools boundary

Model catalog tool-call metadata should be surfaced because it matters for future model choice.

Actual CrownKeep tools/MCP/agent execution are **not** part of this sprint.

---

## Work package F — Convergence, documentation, and pause-point cleanup

Before closing the sprint:

1. Run lint/build/type checks.
2. Revalidate:
   - primary Windows native host;
   - second Windows host / AVD through the same adaptive selection path;
   - physical iPhone native path.
3. Update:
   - `docs/STATUS.md`
   - `docs/ROADMAP.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `docs/FOUNDRY-LOCAL-DEVICE.md` or successor device-profile documentation
   - roadmap visual if sprint numbering changes.
4. Merge the validated convergence branch to `main`.
5. Only after merge validation, remove stale phase branches that are fully contained in `main`.
6. Create a milestone tag/release marker for the local-first baseline.
7. Record the exact remaining deferred areas.

Suggested milestone name:

`v0.4-local-baseline`

---

## Exit criteria

Sprint 4A.3 is complete only when all required criteria pass.

### Windows primary laptop

- device analysis shows visible progress;
- model catalog is grouped into useful families/roles rather than a raw massive variant list;
- alias-based model selection resolves to appropriate hardware variants;
- Quick profile is validated;
- at least one heavier candidate is benchmarked and CrownKeep records whether it is accepted or rejected;
- GPT-OSS 20B is treated as experimental unless observed behavior justifies otherwise;
- local dictation works through a Foundry speech model;
- text chat, projects, persistence, diagnostics, runtime sleep/wake, and model switching remain healthy.

### Second Windows host / AVD

- current shared build is validated;
- the exact same device-analysis and recommendation policy used on the primary laptop runs here;
- CrownKeep chooses the best observed execution path without an `AVD` special case;
- virtual WebGPU is rejected when benchmarks show it is slower than CPU;
- normal text chat remains interactive and persistent;
- unsupported voice capability does not break the product.

### iPhone

- current shared build installs and launches;
- Apple on-device chat remains functional and streaming;
- Projects/conversations persist;
- mobile UX remains compact;
- dictation reaches the composer through native Apple speech;
- no Windows-only model controls leak into normal mobile UX.

### Repository / pause point

- all three environments are documented;
- validated work is merged to `main`;
- stale contained phase branches are cleaned up after merge;
- milestone/tag created;
- repository docs describe the current baseline without requiring chat history.

---

## Explicitly deferred after the pause point

Do **not** start these during this sprint unless needed to fix a regression:

- encrypted cross-device sync;
- Entra/cloud API implementation;
- Take to Cloud / cloud escalation;
- RDC customer/context integration;
- real MCP/tools/agent execution;
- RAG/document ingestion;
- full duplex spoken Anne/TTS;
- broad installer/public-release hardening beyond what is required to test the current native Windows build;
- model fine-tuning.

These are intentionally left for a later restart after the local baseline is stable.

## Pause-point definition

When this sprint closes, CrownKeep should be a coherent local-first prototype on three tested environments with:

- device-aware local model selection;
- a sensible Windows model portfolio;
- native Apple local AI on iPhone;
- one adaptive Windows selection policy proven on both the physical laptop and the AVD;
- local voice dictation where the device supports it;
- clean resource handling;
- a clean `main` branch and durable documentation.

That is the stopping point before CrownKeep crosses into cloud identity, synchronization, cloud AI, RDC context, and agent/tool work.
