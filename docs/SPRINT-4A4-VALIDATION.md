# Sprint 4A.4 — System Foundry Convergence Validation

**Branch:** `sprint-4a3-local-platform-convergence`  
**Status:** Implementation in progress; physical acceptance required.

## Implemented contract proofs

- `LocalRuntime` is provider-neutral: shared code asks for capabilities, roles, activation, health, and loaded model without assuming Foundry.
- `ToolRegistry` marks each tool's network, access, authentication, and photo/camera boundary. The initial local-search proof is read-only and keeps inference local.
- `KnowledgeSource` and `KnowledgeRegistry` are generic. `LocalKnowledgeSource` is synthetic/local only; no RDC data is connected.
- Normal model modes are named **Quick**, **Balanced**, and **Deep**. A non-Quick mode still requires a representative-context validated benchmark.

## Windows laptop / AVD handoff

Run these in both environments. Do not create environment-specific policy.

1. Run `foundry --version`, `foundry cache location`, `foundry cache list`, and `foundry server status`; attach only non-sensitive results to the sprint evidence.
2. Start CrownKeep and record the Local AI runtime version, cache location, hardware/provider information, loaded model, and selected alias/actual variant.
3. Verify Quick chat, restart, Quick restoration, dictation review-before-send, rerun, and a model download/cache operation through the system Foundry environment.
4. Benchmark Balanced. Run its representative-context and normal-chat checks before it becomes selectable. Attempt Deep only after Quick and Balanced are stable.
5. Verify that selected model, runtime loaded model, and `/v1/models` model agree before sending.
6. Inventory, but do not delete, `%USERPROFILE%\.CrownKeep\cache\models`. Record system versus legacy size and the models protected for Quick/Balanced/Deep/Voice.

## Rolo15 handoff

1. Confirm Apple Foundation Models supplies Quick and no unsupported Balanced/Deep mode is shown as ready.
2. Validate local streaming, conversation/project persistence, native dictation review-before-send, local-search proof, image-analysis proof, and restart behavior.
3. Confirm no cloud-model fallback occurs when the local runtime is unavailable.

## Cleanup gate

Legacy cache cleanup remains **blocked** until all three acceptance paths are recorded. Use Foundry's supported cache lifecycle only; never delete the `.CrownKeep` directory or conversation, Project, settings, tool, knowledge-source, or benchmark data.
