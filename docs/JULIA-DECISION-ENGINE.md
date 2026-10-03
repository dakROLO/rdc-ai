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

## iOS Apple-native install/runtime — implemented, physical acceptance pending

CrownKeep now exposes an **explicit optional download** for Julia-1 on iOS 27 SDK/runtime builds. The base app does not bundle Julia and never downloads it automatically. The installed package is stored under CrownKeep Application Support and can be removed independently of conversations. Decision Assist OFF releases the in-memory Julia runtime/tokenizer while leaving the installed package available for later use.

The pinned download is the community Core AI fp32-s512 export from `mlboydaisuke/Julia-1-CoreAI` at revision `d1e943545c64e20e73a88ae1f890227c349e22ba`. The main `.aimodel` is 578,357,637 bytes and the pinned tokenizer is 34,363,188 bytes with SHA-256 `609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f`. CrownKeep also pins the metadata/config files by revision. The upstream/community export had Mac evidence but no iPhone measurement, so file presence is not treated as compatibility.

After download, CrownKeep performs an on-device **native parity gate before promotion**: the Swift host must reproduce a pinned publisher token-ID/marker row exactly and the Core AI graph must choose the expected answer for that parity fixture. A failed tokenizer/model/load/parity check leaves Julia unavailable and does not silently fall back to a hosted service. The Swift runtime host is based on the Julia Core AI reference serialization/inference path; `CROWNKEEP_IOS27_SDK` keeps SDK-26 builds compiling without pretending Core AI exists there.

Native installation/parity is deliberately separate from semantic qualification. The current CrownKeep smoke suite remains 9/16, so `qualifiedJobs` is empty. When the user turns installed Decision Assist ON, Julia runs **shadow evaluations** for eligible decision events and records result/confidence/latency locally, but those unqualified decisions cannot change Auto routing or tool execution. Existing deterministic policy/recovery remains authoritative. This lets the physical iPhone produce real decision evidence without risking the assistant behavior. A future qualification change must be explicit, category-specific, and backed by the held-out/error-rate/device evidence already required above.

Physical iPhone acceptance still needs to record: download/install integrity, exact parity gate result, cold/warm load and decision latency, memory/thermal behavior, unload/reload, airplane-mode use after installation, removal/reinstall, and shadow CrownKeep fixtures. Until that evidence exists, do not promote tool/model routing categories.

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
