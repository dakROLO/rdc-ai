# Sprint 4A.3 validation record

The sprint is not complete until the actual devices pass. Record commit, date, device capability fingerprint, chosen alias/variant/provider, timings, and observed pass/fail here. Do not include private conversation content.

## Windows laptop and second Windows host

Use the same commands and tests on both hosts. There is no AVD-specific selection policy.

```powershell
git fetch origin
git switch sprint-4a3-local-platform-convergence
git pull --ff-only
npm ci
npm run desktop:dev
```

Preserve local modifications before switching; do not reset or delete them.

1. Existing history opens while local AI starts. Cached chat restores without another download. Chat and projects persist across relaunch.
2. Local AI → Local Model Analyst → Analyze this device. Observe discovery, provider registration and catalog refresh progress. Family groups and Advanced variants show actual catalog metadata.
3. Compare `phi-4-mini` paths. The test can download one candidate per execution path. Record accepted/slow/error outcomes and CPU vs accelerated measurements. Verify the chosen model responds in the same conversation.
4. Compare `mistral-nemo-12b-instruct` if viable. Record acceptance/rejection; never assume download size equals VRAM use. GPT-OSS remains Deep / Experimental and is never silently selected as the initial default.
5. Cancel a comparison during download and during inference. Native preparation may finish before cleanup. Confirm the previous model returns and no concurrent chat runs during the comparison.
6. Restart: matching fingerprint restores the measured choice. Driver/provider/catalog changes invalidate measurements and display a re-analysis prompt.
7. Dictate a short sentence. First use may download the smallest discovered Whisper model. Stop, review/edit, then Send. Cancel recording and transcription; verify no cancelled text is appended. Deny microphone permission and verify text chat still works. Test remote microphone redirection as an observed capability on the second host.
8. Sleep/wake manually; change idle unload to 5 minutes and Never. Verify chat generation, benchmark, verification, or dictation cannot be interrupted by idle unloading. Verify speech releases after dictation and restores chat.
9. Test model failure and a slow virtual acceleration path. The UI must retain history, report the failure, and prefer faster observed CPU results when present.

## Physical iPhone (`Rolo15`)

On the paired Mac, update the same branch and use the existing `scripts/ios-device-build.sh` procedure. Local signing configuration remains device-local.

1. Install/launch with the correct branded icon. Anne · Apple On-Device is preferred.
2. Test streamed chat, cancellation, Projects, rename/delete dialogs, compact navigation, and persistence across relaunch.
3. Windows model/runtime controls are absent.
4. Grant microphone/speech permissions, dictate, stop, edit the draft, and Send. Test cancellation, background/interruption, permission denial, and missing language assets. The unavailable state is expected if Apple on-device speech assets are not installed; it is not a passing dictation test.
5. No cloud fallback. Test chat and dictation with the network disconnected once the device's required model/language assets are installed.

## Evidence matrix

| Gate | Status |
| --- | --- |
| Local lint / TypeScript / production web build | Passed during implementation |
| Deterministic selection-policy tests | Passed during implementation |
| Shared UI persistence, dictation review/cancel, mobile layout | Passed in CI run 36267159109 |
| Native Windows compilation | Passed in CI run 36266994648; final follow-up recheck pending |
| Native iOS compilation | Passed in CI run 36267159109 (iOS 26.5 simulator SDK) |
| Laptop Quick + heavier path benchmark | Pending physical device |
| AVD same-policy benchmark + text persistence | Pending physical device |
| Windows local dictation / cleanup | Pending physical device |
| Rolo15 current-branch parity + native dictation | Pending physical device |
| Merge / contained stale branches / baseline tag | Blocked on the above device gates |

## Physical laptop validation — attempt 1 (2026-09-26)

**Result: failed; stop further model-path benchmarking until the native crash is addressed.**

Observed on the primary Windows laptop:

- device analysis completed and detected 32,173 MB system RAM, Intel Core Ultra 9 275HX, Intel Graphics, and NVIDIA GeForce RTX 5070 Laptop GPU;
- execution-provider registration completed for CUDAExecutionProvider, WebGpuExecutionProvider, OpenVINOExecutionProvider, and NvTensorRTRTXExecutionProvider;
- refreshed catalog reported 118 accelerated variants and 48 CPU variants;
- the Quick section still exposes too many model families for normal product use and needs a curated recommended shortlist with the remainder behind More models / Advanced;
- the selected benchmark run was `phi-4-mini-reasoning` and began comparing four paths;
- OpenVINO and CUDA variants downloaded and loaded successfully;
- while beginning the `Phi-4-mini-reasoning-generic-gpu:3` download, the native CrownKeep process exited with Windows `0xc0000005 (STATUS_ACCESS_VIOLATION)`;
- the earlier Vite `ECONNREFUSED` messages occurred while the embedded Foundry web service was not yet listening and are not, by themselves, evidence of the access-violation cause.

### Crash recovery observation

After restarting CrownKeep following the native access violation:

- the application launched normally and existing local state remained available;
- CrownKeep restored the previously verified cached `Phi-4-mini-instruct-generic-cpu:5` model;
- Local AI health returned to **Ready** and the setup remained **Verified**;
- the two successfully downloaded reasoning variants (`phi-4-mini-reasoning-openvino-gpu` and `phi-4-mini-reasoning-cuda-gpu`) remained visible in the model list;
- CrownKeep displayed **"Hardware or runtime changed. Previous measurements are stale"** immediately after restart.

The stale-profile warning exposes a fingerprint design issue. `crownkeep_device_profile` currently hashes a live list of Foundry/ONNX/WinML DLLs loaded into the CrownKeep process. That list can change with runtime lifecycle state even when the physical hardware, driver, Foundry installation, and compatible execution providers have not changed. The fingerprint should use stable runtime/version inputs rather than the process's currently loaded module set.

### Required follow-up before retry

1. Add real model-download progress to the CrownKeep UI, including percentage and current model/variant so a long benchmark can be left running and checked later.
2. Preserve current progress/state when the Local AI panel is closed and reopened; do not make the progress display event-only.
3. Investigate the native access violation during repeated multi-variant download/load/unload benchmarking. Treat this as a native lifecycle/SDK crash until a narrower cause is proven.
4. Revisit role classification: reasoning-family models such as `phi-4-mini-reasoning` should not crowd the default Quick shortlist merely because their size is small.
5. After the crash is fixed, repeat the laptop acceptance flow beginning with the intended `phi-4-mini` family before testing heavier models.

### Model selection / normal chat observation

Normal chat recovered on the restored cached CPU model, but this test exposed two additional acceptance failures:

- the primary **Model** dropdown is not a native model switch. `handleModelChange` only updates the frontend `selectedModelId` and provider-specific localStorage value; it does not install/load/unload the selected Foundry variant;
- provider refresh prefers the actually loaded native model before the stored frontend selection, so a dropdown choice can appear to do nothing or snap back to the loaded CPU model;
- therefore the UI can imply that a CUDA/OpenVINO model was selected while the native runtime remains on `Phi-4-mini-instruct-generic-cpu:5`;
- the normal model selector should either become a real lifecycle-aware switch or become read-only/current-model status, with model changes owned by the Model Analyst/native runtime workflow;
- the existing Advanced **Use this model** action does perform native lifecycle operations, but intentionally does not persist a preferred measured profile. The distinction is currently too confusing for normal use.

The first recovered normal-chat response also repeated the injected **CrownKeep time context** metadata verbatim even though the system metadata says not to repeat it. This is a separate prompt/output-sanitization regression. The current `cleanTemporalArtifact` only strips the older bracketed `[Message timestamp: ...]` artifact and does not remove a generated `CrownKeep time context...` block.

Do not treat the laptop model-selection acceptance gate as passed until the UI-selected model and the actual native loaded model are guaranteed to agree.

### Windows dictation observation

Physical laptop dictation reached the microphone permission and recording flow but then remained indefinitely at **Transcribing…** with no transcript returned.

Code review shows this path currently has several acceptance gaps:

- first-use Whisper download occurs inside the native `crownkeep_transcribe` command with `model.download(None::<fn(f64)>)`, so the UI receives no download percentage and reports only **Transcribing…** even when it may actually be downloading a speech model;
- the native speech command emits no stage/progress events for resolve, download, chat-model release, speech-model load, transcription, speech-model unload, or chat-model restore;
- the frontend `invoke('crownkeep_transcribe')` has no transcription timeout, so a stalled native download/load/transcribe can leave the composer locked indefinitely;
- pressing Cancel during native transcription only invalidates the frontend epoch and releases microphone resources; it does not cancel or time out the in-flight native Tauri command. The UI can therefore remain logically blocked until native work eventually returns;
- the speech path temporarily unloads the active chat model and later reloads it, so failure recovery needs explicit physical validation after any timeout/cancel condition.

Required fix before Windows dictation can pass:

1. expose native speech stage/progress events, including model alias/variant and real download percentage when downloading;
2. distinguish **Downloading speech model**, **Loading**, **Transcribing**, and **Restoring chat model** in the composer UI;
3. add a bounded native/frontend timeout and a safe recovery path;
4. make Cancel visibly mean either immediate cancellation when supported or **Cancel requested / finishing cleanup** when the native operation cannot be preempted;
5. verify the prior chat model is restored after success, failure, timeout, and cancellation.

### Physical laptop retest — Quick benchmark

The repaired Quick benchmark completed successfully on the primary Windows laptop using the intended `phi-4-mini` family.

Observed winner:

- execution provider: `CPUExecutionProvider`
- first token: **2380 ms**
- observed generation rate: **13.8 tok/s**
- result: accepted as the fastest measured Quick path for this device

This is an expected outcome under the adaptive policy: CrownKeep should select the fastest measured path rather than prefer a GPU-labelled variant by assumption. The RTX 5070 remains a candidate signal, not a forced execution choice.

### Physical laptop retest — Balanced benchmark

The repaired Balanced benchmark completed successfully on the primary Windows laptop using `mistral-nemo-12b-instruct`.

Observed winner:

- execution provider: `CUDAExecutionProvider`
- first token: **811 ms**
- observed generation rate: **39.0 tok/s**
- result: accepted as the fastest measured Balanced path for this device

This is strong evidence that the adaptive policy is working as intended: the same laptop selected CPU for Quick Phi-4 Mini and CUDA for the heavier Balanced model based on measured results rather than a host-level GPU preference.

### Model storage / benchmark cleanup controls

A model-storage management surface is now part of the Windows Model Analyst so benchmark testing does not leave opaque disk usage behind.

Behavior:

- lists cached Foundry variants with alias, variant ID, execution provider/device, approximate package size, loaded state, and current-fingerprint benchmark result when available;
- shows approximate total cached model size;
- allows a loaded model to be explicitly unloaded;
- allows a non-loaded, non-protected cached variant to be deleted from the device;
- protects the measured winner for every benchmarked family on the current device fingerprint;
- protects the selected Voice family;
- provides **Clean measured benchmark losers**, which removes cached measured losing variants only after explicit confirmation while keeping family winners and Voice protected;
- newer benchmark records also mark whether a variant was first downloaded during the benchmark for future audit/cleanup behavior;
- native cache removal refuses loaded models and uses Foundry Local's supported cache-removal CLI surface, with compatibility for both `cache remove` and `cache rm` preview command forms.

The existing Quick and Balanced measurements remain stored in CrownKeep local app storage and are independent of Git pulls.

### Startup regression after model-storage work

The first restart after adding Model Storage exposed a startup regression: CrownKeep launched, but the embedded Foundry web service remained down and Vite repeatedly reported `ECONNREFUSED 127.0.0.1:39839`.

Root cause was cache-state refresh in `crownkeep_foundry_models`: the first implementation called `variant.is_cached().await` serially for every catalog variant. On the primary laptop (~166 compatible variants), this delayed population of `modelCandidates`, and the existing auto-restore effect could not select and activate the cached preferred model.

Fix:

- cache state is now read once with `catalog.get_cached_models()`;
- cached and loaded IDs are normalized into sets and matched in-memory while building candidate rows;
- Model Storage still gets live post-cleanup cache state without O(n) native cache calls;
- benchmark/profile data remains untouched in local app storage.

### Startup restore regression — execution-provider registration

A second startup retest exposed a different restore failure after the measured Balanced model became the preferred Windows model.

Observed behavior:

- CrownKeep correctly retained the `mistral-nemo-12b-instruct` CUDA benchmark winner;
- after a full app restart, the active Foundry runtime reported only `CPUExecutionProvider` as available;
- auto-restore attempted to load `mistral-nemo-12b-instruct-cuda-gpu:1` immediately and failed because `CUDAExecutionProvider` had not yet been re-registered in the new runtime process;
- the embedded OpenAI service therefore remained down and the UI showed **Local provider unavailable**.

Fix:

- native model activation now inspects the selected variant's required execution provider;
- non-CPU providers are discovered and re-registered before the model is loaded;
- provider registration emits visible progress and uses the same Foundry provider-registration API as device analysis;
- startup also identifies a cached CPU chat fallback (preferring Phi-4 Mini) so a failed preferred-provider restore cannot leave CrownKeep unusable;
- the measured preferred model is not discarded when fallback is used; it remains saved for a later retry after provider recovery.

### Model Storage false cache state + stalled chat recovery

Physical laptop retest exposed two additional issues after startup/provider recovery:

- Model Storage could mark the wrong version of a provider variant as cached because cache IDs were normalized by stripping the catalog version suffix. A cached `...generic-gpu:<other-version>` could therefore make `...generic-gpu:1` appear cached even though Foundry CLI correctly reported that exact variant was not cached.
- Normal chat had no first-token or total-response watchdog. A request could remain on the placeholder indefinitely even when the restored CUDA model showed no useful GPU activity.

Fix:

- cached and loaded model rows now prefer exact full variant IDs; normalized matching is used only when Foundry itself returns an unversioned ID;
- cache deletion is exact-ID and idempotent: a Foundry `not cached` result is treated as already-clean rather than as a user-facing failure;
- the SDK's alias/family-level `is_cached` precheck is no longer used as the source of truth for deletion;
- normal chat now aborts if no first token arrives within 20 seconds or if total generation exceeds 120 seconds;
- on a timed-out Windows local request, CrownKeep attempts to reactivate the selected local model before releasing the composer and tells the user to retry;
- explicit user Stop remains a normal cancellation and does not trigger automatic recovery.

### Cache cleanup isolation + GPU path clarity

Physical retest showed that the selected Mistral CUDA model occupied about 7.1 GB of the RTX 5070 Laptop GPU's dedicated 8 GB VRAM while Task Manager reported the NVIDIA adapter as GPU 1. This confirms the `CUDAExecutionProvider` path is using the discrete NVIDIA GPU, not the Intel integrated GPU/APU. The observed 0% utilization while chat was stalled indicates an idle/stuck inference request rather than wrong-GPU placement.

The same retest showed cache cleanup could be invoked while the embedded inference service and CUDA winner were live. Because the Foundry CLI and embedded SDK share the same local model/cache runtime, cleanup is now isolated from active inference:

- CrownKeep pauses the embedded Foundry service before invoking cache removal;
- cache removal has a 45-second hard process timeout;
- the previously loaded model remains loaded in memory while a different cached loser is removed;
- CrownKeep restarts the embedded service before reporting cleanup complete;
- cleanup errors are reported only after service restoration is attempted;
- Model Storage labels CUDA and TensorRT RTX paths explicitly as **NVIDIA dGPU** so integrated-vs-discrete routing is visible in the UI.

### Heavy-model benchmark promotion + timeout recovery loop

Physical laptop retest showed that normal chat could remain stuck even after the 20-second first-token watchdog fired. The timeout handler was awaiting reactivation of the same stalled Mistral CUDA model, so the recovery action itself could become the new indefinite wait.

The same testing exposed a policy problem: benchmarking Balanced had promoted its winner to the global Windows startup preference and left it active after benchmarking. That is not the intended role model.

Fix:

- only a Quick-family benchmark winner can update CrownKeep's Windows startup preference;
- Balanced and Deep/Experimental winners remain measured and available for deliberate use, but they no longer replace Quick as the everyday startup model;
- after a successful non-Quick benchmark, CrownKeep restores the previously active chat model when one exists;
- a timed-out normal chat now prefers a cached Quick Phi-4 Mini CPU variant for recovery instead of retrying the same stalled heavy model;
- automatic Quick recovery is itself bounded to 20 seconds so the timeout path cannot hold the composer indefinitely;
- if bounded recovery fails, CrownKeep releases the chat flow and instructs the user to restart the local runtime rather than waiting forever.

### Physical laptop retest — Quick chat and dictation pass

After the Quick-startup and bounded-recovery fixes, the physical laptop retest passed both of the next user-facing gates:

- normal chat succeeded on the restored Quick path;
- Windows local dictation completed successfully and returned text for review before send.

This confirms the repaired startup/recovery flow can return CrownKeep to a usable everyday local model and that the speech path works on the physical laptop.

### Role switching and SDK-native cache deletion

Follow-up physical testing showed the CLI-based cache-removal path could report success without permanently removing an exact model variant. CrownKeep now uses the Foundry Local Rust SDK's native `remove_from_cache()` lifecycle method for the resolved variant instead of shelling out to the CLI. After removal, CrownKeep refreshes the catalog and verifies the exact variant ID is absent before reporting success.

The Local AI panel now also includes a measured-role selector:

- **Quick** — intended everyday/startup model;
- **Balanced** — switches to the measured Balanced winner when one exists;
- **Deep** — switches to the measured Deep/Experimental winner when one exists.

Unmeasured roles remain disabled until they have a valid accepted benchmark. Quick remains the only role that controls Windows startup preference.

Fingerprint policy was also hardened again so execution-provider registration state is not part of the device fingerprint. Provider names remain part of the fingerprint, but whether CUDA/OpenVINO/etc. happen to be registered in the current process no longer invalidates measurements. A one-time local migration preserves accepted measurements for exact cached variants across this policy change.

## Known implementation limits

- RAM filtering uses disk-size × 1.5 + 2 GB as a conservative estimate, not a guarantee of peak memory or VRAM fit. Native load failures remain benchmark failures.
- One representative per device/execution-provider path is compared; Advanced exposes other precision/package variants.
- A benchmark is a short interactive-latency check, not a model-quality evaluation. Throughput stays unknown if the service supplies no token counts.
- Windows audio uses a short user-scoped temporary WAV deleted after transcription. A process/OS crash may leave a temporary recording; do not claim zero disk writes.
- Apple dictation requires installed supported speech language assets. This slice does not download Apple assets or use network speech as a fallback.
- Actual inference cancellation/resource cleanup still needs native device validation.
