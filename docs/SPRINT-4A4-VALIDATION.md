# Sprint 4A.4 — System Foundry Convergence Validation

**Branch:** `sprint-4a3-local-platform-convergence`  
**Status:** Windows System Foundry bridge implemented; physical acceptance required.

## 4A.4C bridge hardening findings — 2026-09-27

- The first bridge split human-readable CLI rows on whitespace. That is not a valid application contract because Foundry table output can change or wrap.
- System Foundry candidates also lacked type/task metadata, which could make existing chat classification reject them.
- Endpoint discovery performed too much work and cached a packaged-app endpoint despite System Foundry being able to restart on another port.

The bridge now requests `--output json` for System Foundry status and model lists, keeps the one-value `cache location` command as a documented narrow fallback, and runs CLI work off the Tauri async executor. Packaged Windows requests ask the native host for the current endpoint each time before probing `/v1/models`; browser development behavior is unchanged.

## Implemented contract proofs

- `LocalRuntime` is provider-neutral: shared code asks for capabilities, roles, activation, health, and loaded model without assuming Foundry.
- `ToolRegistry` marks each tool's network, access, authentication, and photo/camera boundary. The initial local-search proof is read-only and keeps inference local.
- `KnowledgeSource` and `KnowledgeRegistry` are generic. `LocalKnowledgeSource` is synthetic/local only; no RDC data is connected.
- Normal model modes are named **Quick**, **Balanced**, and **Deep**. A non-Quick mode still requires a representative-context validated benchmark.
- Windows packaged builds now use the installed `foundry` CLI for cache location, catalog/cache discovery, service control, alias download/load/unload, and cache removal. The provider obtains the active service URL from that same System Foundry instance rather than assuming port 39839.
- CrownKeep saves/restores Quick by alias. After activation it waits for `/v1/models` and adopts the actual System Foundry variant as the chat model ID; a mismatch blocks Send.
- Diagnostics label the System Foundry cache and the untouched legacy CrownKeep cache separately.

## Windows laptop / AVD handoff

Run these in both environments. Do not create environment-specific policy.

1. Run `foundry --version`, `foundry cache location`, `foundry cache list`, `foundry model list --cached --variants`, and `foundry server status`; attach only non-sensitive results to the sprint evidence.
2. Start CrownKeep and confirm Diagnostics shows the exact same System Foundry cache location and a separate legacy-cache note. Record runtime version, service URL, loaded model, and selected alias/actual variant.
3. Verify Quick chat, restart, Quick restoration, rerun, and a model download/cache operation through the system Foundry environment. Dictation is intentionally not revalidated for this bridge; it remains on the prior SDK path and must not be used as evidence that System Foundry convergence is complete.
4. Benchmark Balanced. Run its representative-context and normal-chat checks before it becomes selectable. Attempt Deep only after Quick and Balanced are stable.
5. Verify that selected model, System Foundry loaded model, and `/v1/models` model agree before sending; deliberately try a missing alias and verify chat stays blocked with a diagnostic.
6. Inventory, but do not delete, `%USERPROFILE%\.CrownKeep\cache\models`. Record system versus legacy size and the models protected for Quick/Balanced/Deep/Voice. Confirm no new files appear there after a CrownKeep non-Quick download.

## Rolo15 handoff

1. Confirm Apple Foundation Models supplies Quick and no unsupported Balanced/Deep mode is shown as ready.
2. Validate local streaming, conversation/project persistence, native dictation review-before-send, local-search proof, image-analysis proof, and restart behavior.
3. Confirm no cloud-model fallback occurs when the local runtime is unavailable.

## Cleanup gate

Legacy cache cleanup remains **blocked** until all three acceptance paths are recorded. Use Foundry's supported cache lifecycle only; never delete the `.CrownKeep` directory or conversation, Project, settings, tool, knowledge-source, or benchmark data.
