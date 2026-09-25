# CrownKeep — Observed Foundry Local Device Capability

**Observed:** 2026-09-24  
**Source:** local `foundry` model listing from the development Windows PC.

This is an observed development-machine capability snapshot, not a universal CrownKeep requirement.

## Relevant chat and multimodal models reported

| Model | Type | Size | Device | Tools | Cached |
| --- | --- | ---: | --- | --- | --- |
| deepseek-r1-1.5b | Chat | 1.4 GB | GPU | ○ | ○ |
| deepseek-r1-14b | Chat | 9.8 GB | GPU | ○ | ○ |
| deepseek-r1-7b | Chat | 5.3 GB | GPU | ○ | ○ |
| gemma-4-e2b-it | Multimodal | 5.8 GB | GPU | ● | ○ |
| gpt-oss-20b | Chat | 9.7 GB | GPU | ○ | ○ |
| ministral-3-3b-instruct-2512 | Multimodal | 3.6 GB | GPU | ● | ○ |
| mistral-7b-v0.2 | Chat | 4.0 GB | GPU | ○ | ○ |
| mistral-nemo-12b-instruct | Chat | 6.6 GB | GPU | ● | ○ |
| olmo-3-7b-instruct | Chat | 5.1 GB | GPU | ● | ○ |
| phi-3-mini-128k | Chat | 2.1 GB | GPU | ○ | ○ |
| phi-3-mini-4k | Chat | 2.1 GB | GPU | ○ | ○ |
| phi-3.5-mini | Chat | 2.1 GB | GPU | ○ | ○ |
| phi-4 | Chat | 8.8 GB | GPU | ○ | ○ |
| phi-4-mini | Chat | 2.2 GB | GPU | ● | ○ |
| phi-4-mini-reasoning | Chat | 2.5 GB | GPU | ● | ○ |
| phi-4-reasoning | Chat | 8.4 GB | GPU | ○ | ○ |
| qwen2.5-0.5b | Chat | 528 MB | GPU | ● | ○ |
| qwen2.5-1.5b | Chat | 1.3 GB | GPU | ● | ○ |
| qwen2.5-14b | Chat | 8.8 GB | GPU | ● | ○ |
| qwen2.5-7b | Chat | 5.5 GB | GPU | ● | ○ |
| qwen2.5-coder-0.5b | Chat | 528 MB | GPU | ● | ○ |
| qwen2.5-coder-1.5b | Chat | 1.3 GB | GPU | ● | ○ |
| qwen2.5-coder-14b | Chat | 8.8 GB | GPU | ● | ○ |
| qwen2.5-coder-7b | Chat | 4.7 GB | GPU | ● | ○ |
| qwen3-0.6b | Chat | 492 MB | GPU | ● | ○ |
| qwen3-1.7b | Chat | 1.3 GB | GPU | ● | ○ |
| qwen3-14b | Chat | 9.1 GB | GPU | ● | ○ |
| qwen3-4b | Chat | 2.6 GB | GPU | ● | ○ |
| qwen3-8b | Chat | 5.5 GB | GPU | ● | ○ |
| qwen3-vl-2b-instruct | Multimodal | 2.1 GB | GPU | ● | ○ |
| qwen3-vl-4b-instruct | Multimodal | 3.5 GB | GPU | ● | ○ |
| qwen3-vl-8b-instruct | Multimodal | 6.0 GB | GPU | ● | ○ |
| qwen3.5-0.8b | Multimodal | 1.4 GB | GPU | ● | ○ |
| qwen3.5-2b | Multimodal | 2.9 GB | GPU | ● | ○ |
| qwen3.5-2b-text | Chat | 1.3 GB | GPU | ● | ○ |
| qwen3.5-4b | Multimodal | 4.1 GB | GPU | ● | ○ |
| qwen3.5-9b | Multimodal | 7.0 GB | GPU | ● | ○ |
| smollm3-3b | Chat | 2.0 GB | GPU | ● | ○ |

Speech and embedding models were also reported by Foundry Local, but they are outside the first chat-provider integration slice.

## Phase 2 note

No default production model is selected yet.

Good small-footprint candidates to benchmark first, based only on this observed catalog, include:

- `phi-4-mini` — 2.2 GB, tool-capable in the listing;
- `qwen3-4b` — 2.6 GB, tool-capable in the listing;
- `qwen3.5-2b-text` — 1.3 GB, tool-capable in the listing.

Model quality, latency, memory use, startup behavior, and actual Foundry Local API compatibility must be tested before a default is chosen.
