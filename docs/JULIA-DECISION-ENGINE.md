# Local Julia decision package — October 3, 2026

Branch: `sprint-4a3-local-platform-convergence`. No main merge or branch deletion.

## Implemented versus qualified

The independent `DecisionEngine` contract exposes status, selected option ID, full unrounded softmax scores, confidence and latency. `DecisionAssist` provides typed routing, six tool choices, argument relevance and result relevance. Only explicit Decision Assist ON, a locally available engine, a qualified category, a valid returned option and confidence ≥0.80 permit advisory use. OFF releases the native session/tokenizer. Low confidence, disabled, missing assets, exceptions and unqualified categories fall back to existing deterministic behavior. No prompts are sent to a Julia/Jev API; the runtime crate contains no HTTP client.

**No Julia production categories are qualified in this package.** The measured smoke fixtures expose material failures. Presence of weights is not qualification. Auto therefore defaults to Quick in production today; explicit manual selection bypasses routing. Tests inject decisions to verify future routing of qualified Quick/Balanced/Deep roles, not to claim real Julia routing accuracy. No Deep winner is manufactured. Windows physical `gpt-oss-20b` failure remains authoritative.

## Windows native execution

`native/julia` is a CrownKeep-owned Rust ONNX Runtime CPU adapter, linked into the Tauri host independently from Foundry Local. No Python/PyTorch installation is required by the product. The host owns a serialized optional session and tokenizer; disabling assist drops both. ONNX Runtime's process environment/library may remain loaded; weights/activations are released with the session. The CPU library is resolved from the app-owned directory, not an arbitrary command/path or a hosted service. Strict publisher serialization is adapted in `encoding.rs`, with bounded 1,024-token context / 512-token head, 48-token option bounds and 2–20 unique option IDs. Oversized input fails rather than silently truncating.

The app never downloads/installs weights or runtime DLLs. The independent local evaluation CLI can exercise categories that remain disabled in the app. To stage research execution on Windows, put **verified publisher assets** `model.onnx`, `model.onnx.data`, `tokenizer.json` and a compatible CPU `onnxruntime.dll` into the directory shown in Diagnostics (`app_data_dir/decision/julia-1`). Graph/weight/tokenizer SHA-256 values are pinned in `native/julia/assets.sha256.json`; they are verified before loading. An asset's presence is reported separately from successful load and category qualification. Final redistributable installer/DLL manifest, signing and physical Windows RSS/latency qualification remain open; no model bundle ships in this commit.

## Measurements — engineering Linux CPU, not Windows acceptance

Publisher ONNX revision: `82a2fadf8fccfccdc5fd4e1009ba8f1a265eb7a8`. See [publisher export](https://huggingface.co/SupersonicLabs/Julia-1-ONNX), [original release](https://huggingface.co/SupersonicLabs/Julia-1), and committed raw reports in `evals/julia`.

| Variant | Publisher parity | CrownKeep smoke accuracy | Outcome |
| --- | --- | --- | --- |
| FP32 ORT CPU | 100/100; max logit delta 0.000073 | 9/16 | Graph CPU-compatible; semantic promotion blocked |
| Initial dynamic INT8 MatMul | 68/100; max logit delta 9.736 | 8/16 | Reject initial quantization; 442 MB graph/weights, embedding remains large |
| Initial FP16 conversion | Graph type validation failed | Not run | `_to_copy_22` output type mismatch; do not ship |

FP32 Python development harness: 4 intra-op threads, ORT 1.30.0, ~171 ms load, ~39 ms median / 123 ms p95 across 100 publisher parity requests. Graph+weights ~580 MB, tokenizer another ~34 MB; this is not a tiny memory footprint. These Python decision timings include strict tokenization and execution. The compiled Rust adapter independently matches 100/100 parity (maximum softmax probability delta ~0.000013) and the same 9/16 CrownKeep fixtures; its ~38 ms median includes strict tokenization and execution. Debug-mode process/checksum/load plus the full 116-request eval took ~26 seconds. Process startup/checksum/load costs and device memory must be measured separately. Reports include all option probabilities and confusion cases. No precision is promoted from speed alone.

Current smoke misses: current-info tool selection, image-generation intent, unrelated personal-checks evidence, stale/cannot-browse answer and all three model-route examples. This suite is only 16 authored fixtures, not held-out accuracy evidence. Confidence is an uncalibrated model score. No category gets enabled from the suite size or a single correct prediction. Before promotion: freeze prompt/options; add held-out paraphrases/negative/adversarial fixtures; measure per-category false accept/reject rates and high-confidence errors; establish native parity and target-device resource budgets; review/pin the qualification change in source. Keep raw failures; do not rewrite labels to inflate accuracy.

## Tool and privacy authority

`ToolRegistry` checks Web OFF and image/write permissions before availability, Julia or execution. Julia cannot authorize network/cloud, new attachments, unavailable generation, installation or additional tool-call budget. Event-driven evaluations occur at Auto routing, tool-needed/type, proposal and result events; never per generated token. Structured registry calls carry the resolved user topic. A high-confidence irrelevant proposal is rejected for re-planning; irrelevant evidence is excluded from sources/retained data and marked failed. Low-confidence advice preserves deterministic behavior.

Generic follow-up resolution remains deterministic. The physical fixture is newest Apple iPhone → `can you check online?` → incorrect literal query → checks/checkers. Structured calls normalize generic queries to the resolved user topic before sending. A narrow deterministic check rejects unmistakable personal/bank-check results with no resolved-topic term overlap, even with Julia OFF. This is deliberately not a claim of broad semantic validation. Existing bounded correction of stale/cannot-browse drafts remains in place.

Apple native tools retain their existing deterministic host boundaries; Julia semantic stewardship is unavailable on iOS until a native adapter is qualified. Shared interfaces never pretend the Swift host is running Julia.

## iOS Apple-native next slice — unavailable today

No converted model or native Julia implementation is bundled. Decision Assist ON reports native conversion pending and Auto remains Quick; no Foundry, Python, browser WebGPU or web/cloud fallback on iPhone.

Apple's [Core ML PyTorch conversion workflow](https://apple.github.io/coremltools/docs-guides/source/convert-pytorch-workflow.html) supports converting PyTorch to an ML Program. A community [Julia Core AI conversion](https://github.com/john-rocky/coreai-model-zoo/tree/main/models/julia-1) is an investigation lead, not accepted CrownKeep/iPhone compatibility or redistribution evidence.

Exact next step on a Mac: pin original Julia weights/config/tokenizer and publisher parity rows; export the publisher DecisionModel forward (input IDs, attention mask, marker positions/mask and qtype → logits) with eager attention and fixed batch=1, token windows 256/512/1024 and 2–20 options, preserving the decision head. Convert FP32 first with `coremltools.convert(..., convert_to='mlprogram')`, then separately evaluate FP16/weight compression. Resolve unsupported operations explicitly; never replace the model with heuristic output. Port the strict tokenizer/serialization to Swift or a native Rust/C ABI and compare exact ID/marker arrays. Run all 100 publisher parity cases, CrownKeep fixtures and a held-out set on macOS **and the actual supported iPhone OS/SDK**, recording logit deltas, option decisions, confidence, cold/warm latency, peak RSS, energy/thermal behavior and unload. Only then add a Swift DecisionEngine bridge and signed asset manifest, pin allowed categories, and run the offline airplane-mode acceptance matrix. Python is a conversion workstation tool only, never an iPhone requirement.

## Licenses and reproducibility

Publisher model/export metadata specifies Apache-2.0. `native/julia/LICENSE` contains the full Apache text; `NOTICE` names source/revision and adapted serializer. No weight/DLL binaries are committed. Any distribution must include the license, preserve applicable upstream notices, identify modifications, preserve mmBERT foundation notices and include ORT/tokenizer/dependency licenses. Review actual downloaded release contents for additional notices before shipping; the publisher repositories did not expose a standalone LICENSE at the probed root URLs, so the included text is the canonical Apache license.

Development only:

```sh
cargo build --manifest-path native/julia/Cargo.toml --locked
python scripts/julia/evaluate.py /path/to/local/assets --output report.json
python scripts/julia/evaluate.py /path/to/local/assets --precision int8 --output int8.json
python scripts/julia/evaluate.py /path/to/local/assets --precision fp16 --output fp16.json
python scripts/julia/evaluate_native.py /path/to/local/assets native/julia/target/debug/crownkeep-decision native-report.json
```

The temporary Python harness requires `onnxruntime tokenizers numpy onnx onnxconverter-common`; it reads local assets only. Publisher `parity-cases.json` must be present for evals. Native eval CLI needs the CPU shared library in the same asset directory (`onnxruntime.dll` on Windows, `libonnxruntime.so` on Linux). Use reports as engineering evidence, not physical acceptance.
