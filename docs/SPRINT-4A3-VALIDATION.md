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
| Native Windows compilation | Awaiting CI evidence |
| Native iOS compilation | Awaiting CI evidence |
| Laptop Quick + heavier path benchmark | Pending physical device |
| AVD same-policy benchmark + text persistence | Pending physical device |
| Windows local dictation / cleanup | Pending physical device |
| Rolo15 current-branch parity + native dictation | Pending physical device |
| Merge / contained stale branches / baseline tag | Blocked on the above device gates |

## Known implementation limits

- RAM filtering uses disk-size × 1.5 + 2 GB as a conservative estimate, not a guarantee of peak memory or VRAM fit. Native load failures remain benchmark failures.
- One representative per device/execution-provider path is compared; Advanced exposes other precision/package variants.
- A benchmark is a short interactive-latency check, not a model-quality evaluation. Throughput stays unknown if the service supplies no token counts.
- Windows audio uses a short user-scoped temporary WAV deleted after transcription. A process/OS crash may leave a temporary recording; do not claim zero disk writes.
- Apple dictation requires installed supported speech language assets. This slice does not download Apple assets or use network speech as a fallback.
- Actual inference cancellation/resource cleanup still needs native device validation.
