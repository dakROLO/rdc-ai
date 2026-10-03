# CrownKeep — Daily-use completion plan

**Assessment date:** 2026-09-30 (America/Los_Angeles)  
**Assessed branch:** `sprint-4a3-local-platform-convergence` at `59fb748`  
**Outcome:** Use CrownKeep daily on iPhone, then continue the same work on Windows through account-based encrypted sync.

## Evaluation

CrownKeep is a useful local-chat prototype with a sound shared architecture, but it is not yet a dependable two-device daily assistant. Finish the existing iPhone tool path before adding another runtime or broad agent framework. Then implement identity and encrypted continuity as small vertical slices.

Repository evidence and previously recorded physical acceptance are distinct from new device testing. This assessment did not operate the user's iPhone, Windows laptop, or Azure tenant. User-reported iPhone failures from the September 28 handoff remain unresolved acceptance items; code presence does not close them.

| Capability | Current evidence | Daily-use implication |
| --- | --- | --- |
| Shared chat, projects, persistence | React/TypeScript; IndexedDB; per-message provider metadata; recorded Windows/Rolo15 chat, dictation and restart acceptance | Preserve this foundation and protect existing history |
| Windows local inference | Installed System Foundry authority; Quick Phi and Balanced Nemo recorded as usable | Maintain a regression lane; Deep remains unqualified |
| iPhone local inference | Native WKWebView host and Apple Foundation Models; recorded basic chat acceptance | Appropriate primary phone runtime; browser-only iOS is not equivalent |
| Web tools | Shared ToolRegistry and native DuckDuckGo search/direct URL read implemented | Implementation exists; dependable iPhone retrieval/grounding is not accepted |
| Follow-up evidence | Shared retained-context implementation; Swift automatic-tool log stores sources only | Automatic iOS results lose their retrieved text across turns |
| Local knowledge | `defaultTools.ts` registers two synthetic CrownKeep snippets | This is a contract proof, not useful personal knowledge or conversation recall |
| Sign-in | `src/auth/AuthProvider.ts` is an interface; no MSAL dependency | Account login is not implemented |
| Sync | `src/sync/SyncProvider.ts` is an interface; domain has placeholder sync state/version | No encrypted upload/download, enrollment, outbox or conflict implementation |
| Images/files | No registered native photo/OCR input tool in the current tool set | Useful later; do not advertise image understanding as complete |
| Shipping experience | Native build scripts and branding exist; icon/map reports remain open | Prove build identity, update persistence and bundled map freshness |

No open GitHub issues were returned by the repository issue search during this assessment. That does not erase defects recorded in docs or reported by the user. Main and the working branch point at different commits; this plan does not merge or delete branches.

## Order of work

| Order | Existing roadmap slot | Deliverable | Exit gate |
| --- | --- | --- | --- |
| 1 | 4A.4N | Reliable iOS web tools and evidence | Physical iPhone matrix below passes |
| 2 | 4A.4O | Small daily-use tool/continuity pass | Real local recall, build freshness and backup demonstrated |
| 3 | 4B.1–4B.2 | One account on iPhone and Windows; protected API | Same account identity and isolated scoped API access proven |
| 4 | 5.1 | Sync schema and key/enrollment ADR | Reviewed contract, failure model and recovery design |
| 5 | 5.2 | Encrypted conversation/project round-trip | iPhone → Windows → iPhone works without plaintext server storage |
| 6 | 5.3 + focused 7.1 | Offline/conflict/recovery hardening; daily-use pilot | Seven consecutive days of actual use with no unexplained data loss |

Do not gate this personal two-device milestone on AVD acceptance, Deep model tuning, public installer distribution, cloud reasoning, image generation, MCP, broad RAG, or an RDC production-data connector. These retain later roadmap slots. Essential backup and update-persistence checks move forward from 4A.5/7.x.

## Package 1 — 4A.4N: iOS tools that can be trusted

**Start here.** Keep the selected Apple local reasoning provider and existing shared tool contracts.

Code findings to address:

- `App.tsx` exposes Apple web tools only when the shared `webIntent` gate is true. Explicit “look it up online” can enable tools, but the minimized fallback query can still be only the pronoun request. Resolve the subject from narrowly selected recent user context; preview/confirm a query if resolving it would include private content. Do not upload the conversation to search.
- `CrownKeepNativeToolLog.Entry` contains only tool ID, label and sources. `CrownKeepWebSearchTool`/`CrownKeepWebReadTool` return text to the current model but do not save a bounded excerpt for future context. Align native activity with shared `outcome` and `retainedContext` fields.
- Native tool activity is emitted after the model stream finishes. A thrown search/read or cancelled generation can lose the visible record. Emit tool start/success/error promptly and persist completed evidence even when response generation later fails.
- The Swift automatic path does not show the shared three-operation budget. Enforce a native per-turn budget, time/size limits and cancellation propagation; do not assume the TypeScript structured loop bounds Apple calls.
- Source URLs can be retained without source text, causing follow-ups to have links but no facts. Budget evidence for the phone model's actual context limits, deduplicate old results, and retain retrieval time so old results are not represented as fresh verification.

Deliver a simple visible Search/Read action alongside automatic selection. The user should not need slash commands to force a public search or read a supplied URL. Show Searching/Reading/Answering, then a source list with actual retrieved titles/URLs, success/failure and retrieval time. Citations must reference retrieved sources; “Used web search” alone is not completion.

A DuckDuckGo challenge, empty result, blocked URL, parser change or timeout must produce an honest tool result. Never bypass challenges, invent sources, switch search providers silently, or change the reasoning provider. Web Access OFF blocks fresh network retrieval; previously retained local evidence remains usable.

| Physical iPhone case | Required result |
| --- | --- |
| Web OFF; current-information question and supplied URL | Zero search/read calls; visible limitation |
| Web ON; ordinary drafting question | No unnecessary web call |
| Explicit search with a named subject | Actual results, answer grounded in results, tappable sources |
| Ask about a subject; then “look it up online” | Query resolves the intended subject without unrelated private context |
| Read a supplied public documentation URL | Bounded page evidence and actual source URL |
| Follow-up after search/read; then restart app and follow up again | Useful retained evidence survives; no fictional retrieval |
| Switch Web OFF after retrieval | Prior local evidence remains usable; no new network call |
| Challenge, empty results, offline and timeout | Visible accurate error/empty state; local chat remains available |
| Cancel during search/read/generation | Bounded stop; completed evidence preserved; next request works |
| Retrieved page includes instructions to ignore policy | Content stays untrusted; no policy/provider change |

Capture commit, app build/version, device/OS, prompt, tool outcome, source count and latency. Use synthetic prompts and redacted diagnostics; do not commit private chats. Re-run the essential OFF/ON, URL-read, follow-up and cancellation cases on Windows.

## Package 2 — 4A.4O: useful local tools and daily workflow

Keep this package small so login and sync are next.

1. Replace the synthetic local-search proof with opt-in read-only retrieval of actual local conversations within a selected project. Return bounded excerpts, timestamps and conversation IDs; respect context exclusions and deleted items. Default to the current project and require explicit scope for other projects. No vector service is required for the first slice.
2. Verify dictation → review → send, quick New Chat, project selection, Copy and reopen-last-chat on iPhone. Preserve the draft through transient tool/provider errors.
3. Add a supported backup/export-and-restore path before storage migrations. Backups need explicit destination/privacy handling and validation; never place real exports in this public repo.
4. Expose app version/build commit in diagnostics. Confirm the installed icon, bundled `crownkeep-sprints.svg`, offline shell and update persistence match that build. Replace in-place during normal updates; do not require deleting the app to refresh assets.

**Gate:** Dakota can draft, research with sources, retrieve a selected prior project conversation, dictate, restart and recover a synthetic backup on the phone. Windows existing-history and Quick/Balanced recovery checks still pass.

**Next optional tool after sync:** explicit photo/file selection with native local OCR and reviewable extracted text. Treat OCR as text extraction, not general visual understanding. Image generation and uploads remain separately authorized capabilities; do not let this expand Package 2 or delay account continuity.

## Package 3 — 4B.1–4B.2: account login without cloud dependence

Retain the existing Entra direction: first pilot uses an RDC work/school account. Broader tenant/personal-account support is a later product decision, not assumed from “an account.”

- Implement `AuthProvider` with platform-appropriate public-client authentication. Use native MSAL on iOS; prove the supported Windows public-client/system-browser flow behind the Tauri adapter. Do not assume browser popup/redirect code will work inside either native webview.
- Use authorization code with PKCE, registered native redirects and least-privilege API scopes. No client secret. Keep long-lived credential caching in supported platform storage rather than the conversation database.
- Display account, sign-in/out and a separate sync opt-in. Signing in alone does not upload existing history or enable Web Access/cloud inference.
- Build a minimal protected health/version and user/device boundary before syncing content. Validate issuer, audience, expiry and scopes; derive ownership from verified identity, never a caller-supplied user ID.
- Separate anonymous local data from account-scoped local/sync namespaces. Offer explicit enrollment of selected existing local conversations; never silently upload them to whichever account is currently signed in.
- Sign-out stops sync and clears credentials. Account switching must not expose another account's synced cache; document retained local data and key-unlock behavior explicitly. Network/auth expiry must not destroy or block the user's local-only history.

**Gate:** Both native apps identify the same account; consent/redirect, cancel, token renewal, sign-out and account switching work. Protected calls reject unauthenticated, wrong-audience and unauthorized requests. A second synthetic account cannot access the first account's records. Local drafting works while signed out/offline.

## Packages 4–5 — encrypted two-device continuity

### 5.1: decide and test the contract first

Complete an ADR before wiring real sync encryption. Login proves identity; it does not give the second device the decryption key.

- Define versioned envelopes, immutable IDs, server revisions/cursors, expected-revision writes, idempotency keys, migrations, tombstones and a durable outbox.
- Sync completed messages, conversation titles, projects/membership, context-exclusion state and bounded tool evidence with original provider/model metadata. Encrypt sensitive metadata as well as message text. Local `sequence` alone cannot globally order concurrent offline messages; specify deterministic ordering and preserve concurrent branches rather than overwriting them.
- Keep runtime/model selections, benchmarks, device paths, credentials, Web Access permissions and unfinished streaming output device-local. No model binaries or private file uploads in the initial sync scope.
- Choose supported authenticated encryption and platform key storage. Specify key hierarchy, authenticated second-device enrollment, recovery, rotation, revocation and visible server metadata. Prefer platform-supported audited mechanisms; no homegrown cryptographic protocol.
- Make recovery tradeoffs explicit: a new login alone must not silently recreate or recover an unavailable encryption key. Revocation prevents future sync/key distribution; it cannot erase plaintext or keys a device already obtained.
- Select inexpensive persistence after expected workload, authorization, conditional writes and deletion requirements are known. Record the cost/retention decision before provisioning; no default large infrastructure footprint.

### 5.2: first vertical slice

First sync one synthetic completed conversation between the signed-in iPhone and Windows, then add project membership and retained tool evidence. Keep local writes authoritative for usability: commit locally, queue transactionally, encrypt, push, acknowledge and pull/decrypt into local storage.

**Gate:** Start a chat on iPhone; open it on Windows; continue with Foundry Local; return to iPhone and continue with Apple Foundation Models. IDs, order, sources, exclusions and original provider labels survive without duplicates. Restart both apps. Verify the Azure payload and routine logs contain ciphertext rather than titles, messages or evidence text. Sync never changes inference provider or starts cloud reasoning.

## Package 6 — 5.3: make it safe to depend on

Test offline edits on both devices, simultaneous replies/rename/project moves, deletion versus edit, retry after lost acknowledgement, duplicate delivery, expired cursor, app termination mid-sync, auth expiry, account switching, corrupted ciphertext, lost key, recovery and revoked device. Define tombstone retention and full-resync behavior so long-offline devices cannot silently resurrect deleted work.

Show local-only, queued, syncing, synced, needs sign-in, conflict and error states without blocking chat. Use bounded retries/backoff and manual retry; iOS foreground/resume sync is the initial guarantee. Background execution is best-effort, not a promise of continuous synchronization.

Add export/restore and update/migration checks, content-free diagnostics and critical-path regression tests. Run a seven-day personal pilot covering daily drafting, sourced research, project recall, dictation and phone/Windows handoff. Record actual failures and fix blockers before expanding scope.

**Daily-use exit:** no unexplained loss/duplication; reliable phone tools; same-account handoff; predictable offline recovery; visible sources and sync state; local chat usable without cloud availability. Broader public release/AVD/cloud AI remains later work.

## Next work-session instruction

Implement **4A.4N only** from this plan. Read the repo rules and current validation notes; align native activity/evidence with shared contracts; prove intent/query handling and bounded cancellation; update focused tests and device handoff. Do not build auth/sync or additional tools in that same change. Record implementation and automated evidence separately from physical acceptance.

## Reference and validation limits

Official references checked for this plan:

- [Apple Foundation Models](https://developer.apple.com/documentation/FoundationModels): native Tool/LanguageModelSession foundation. Check target-SDK capability and context limits during implementation.
- [MSAL iOS/macOS token acquisition](https://learn.microsoft.com/en-us/entra/msal/objc/acquire-tokens): public-client interactive/silent token acquisition.
- [Microsoft authorization-code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow): PKCE and native redirect design.

These support the technical direction; the package ordering, pilot gates and proposed sync scope are project recommendations. No new authentication, sync, tool implementation or physical acceptance is claimed by this documentation change.

Validation for this planning change: existing unit suite **42/42 passed**, lint and TypeScript/production build passed. The SVG parsed as XML and was rendered and visually inspected; whitespace checks passed. Native builds and physical acceptance remain pending.
