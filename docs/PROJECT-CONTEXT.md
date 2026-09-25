# CrownKeep — Project Context

## Product goal

Build CrownKeep, a local-first AI application with a consistent conversational experience across Windows and iPhone. The conversational assistant is Anne.

The application should use device-local inference whenever practical while allowing the user to explicitly escalate part of the same conversation to an RDC-hosted cloud AI provider.

Conversation history should later synchronize securely between registered devices through the RDC Azure tenant while remaining usable locally and offline.

## Experience target

### Windows

- Shared CrownKeep interface.
- Local conversation database.
- Microsoft Foundry Local as the initial Windows inference provider.
- Architecture remains open to additional providers later.

### iPhone

- Shared CrownKeep interface as an installable PWA.
- Local conversation database.
- Small on-device model.
- Initial provider may use WebGPU/WebLLM where device/browser capabilities allow it.
- Keep the architecture open to a future native Apple implementation if that becomes valuable.

### RDC Azure tenant

The existing RDC tenant is the cloud/security boundary for this project.

It may eventually provide:

- Microsoft Entra authentication;
- encrypted conversation synchronization;
- device registration;
- cloud AI inference;
- future protected RDC context APIs.

Azure does not perform local inference and must not be a prerequisite for ordinary local chat.

## Architectural separation

Keep these concerns independent:

1. Conversation domain
2. Inference provider
3. Local persistence
4. Synchronization
5. Authentication
6. Optional context

A conversation is provider-neutral.

Assistant messages carry their own provider/model metadata.

## Provider model

The application will expose a common provider contract approximately responsible for:

- provider ID;
- display name;
- local/cloud classification;
- available models;
- capability metadata;
- availability/health;
- streaming chat;
- cancellation.

Initial provider targets:

- `FoundryLocalProvider`
- `WebLLMProvider`
- `AzureFoundryProvider` (contract/scaffolding before production configuration)

## Conversation model

### Conversation

- immutable ID;
- title;
- created timestamp;
- updated timestamp;
- sync state/version.

### Message

- immutable ID;
- conversation ID;
- role;
- content;
- timestamp;
- provider ID for assistant messages;
- model ID for assistant messages;
- local/cloud classification.

Conversation state must not exist only in React component state.

## Local-first behavior

Each device keeps a usable local database.

Network loss must not make existing conversations unreadable.

Sync is additive to local persistence:

```text
Local database
    ↓
local changes
    ↓
network/auth available
    ↓
client-side encrypt
    ↓
RDC Azure synchronization
    ↓
other registered device
    ↓
local database
```

## Encryption direction

Cross-device sync should be designed so Azure does not need plaintext conversation contents merely to synchronize them.

Use established authenticated-encryption primitives; do not invent cryptography.

Key management must be documented before encrypted sync is implemented.

The design must leave room for future enterprise retention/auditing requirements without claiming those capabilities exist today.

## Authentication direction

Use Microsoft Entra ID for cloud capabilities.

Do not create a separate username/password system.

Local inference and local conversation access remain architecturally separable from cloud authentication.

The public client must not contain a client secret.

## Cloud escalation

The user explicitly chooses **Open to Cloud**.

Before escalation, the UI should explain that the conversation context required for that request will be sent to the RDC cloud AI provider.

A cloud response becomes another message in the same conversation.

The user can then continue in the cloud or return to local inference.

## Future RDC context

The architecture must preserve a `ContextProvider` extension point for a future protected RDC API.

Conceptually:

```text
User message
+ Conversation context
+ Optional explicit RDC context
        ↓
Selected AI provider
```

Current scope does **not** connect to RDC customer, Blueprint, dashboard, project, document, or operational data.

Only interfaces, contracts, and synthetic fixtures may be created.

## Shared application direction

Prefer one TypeScript/React codebase.

Initial packaging:

- installable PWA on iPhone;
- Windows web/PWA experience;
- optional native wrapper later only if a concrete Windows capability requires it.

## Initial navigation

- New Chat
- Conversations
- Provider/Model selector
- Settings

Conversation view should eventually support:

- title;
- local/cloud status;
- selected model;
- streaming output;
- stop generation;
- Open to Cloud;
- Return to the Keep.

## Explicit non-goals

Until scheduled in the roadmap, do not add:

- RAG;
- vector databases;
- Ollama;
- MCP;
- autonomous agents;
- repo agents;
- voice;
- transcription;
- document ingestion;
- real RDC data access;
- automatic local/cloud routing.
