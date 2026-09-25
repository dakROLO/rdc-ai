# RDC AI — Security Model

## Current security posture

This repository is public.

Assume every committed file is immediately visible to anyone.

## Trust boundaries

### Device/browser

Trusted for the signed-in user's local data and local inference.

Risks include:

- browser storage access;
- compromised extensions/device;
- XSS;
- accidental logging/export of conversation content.

### RDC Azure API

Trusted to:

- validate Entra access tokens;
- enforce authorization;
- mediate cloud AI access;
- store/transport encrypted sync envelopes.

The sync service should not require conversation plaintext.

### Cloud AI service

Receives only content explicitly escalated by the user through **Take to Cloud** or a later clearly authorized cloud mode.

### Future RDC context service

Not implemented.

Any future context service must use its own authorization checks and must not be inferred from simple possession of a client identifier.

## Public-client rules

The browser/PWA must never contain:

- client secrets;
- storage account keys;
- SQL credentials;
- service-principal secrets;
- Azure AI keys;
- reusable API keys that grant production access.

Use Entra authorization-code flow with PKCE through the appropriate client library when cloud authentication is implemented.

## Azure service-to-service access

Prefer managed identity.

Use Key Vault for secrets only where a downstream system cannot use identity-based authentication.

## Sync privacy target

Conversation payloads should be encrypted on the client before upload.

Server-visible metadata should be minimized to what synchronization requires, for example:

- opaque user/device identifiers;
- conversation/item IDs where required;
- versions/cursors;
- ciphertext sizes;
- timestamps needed for sync.

The exact visible metadata set is a Phase 5 design decision.

## Crypto rules

- Do not create custom cryptographic algorithms.
- Use established authenticated-encryption primitives from supported platform libraries.
- Document key derivation, storage, rotation, enrollment, recovery, and revocation.
- Include versioning in encrypted envelope formats so algorithms/formats can evolve.

## Web application controls to add during hardening

- Content Security Policy;
- dependency scanning;
- secret scanning/push protection;
- secure headers;
- XSS-safe rendering;
- restricted telemetry/logging;
- no conversation text in routine diagnostics;
- explicit handling of local database export/import.

## Data classification for this repository

Allowed:

- source code;
- public docs;
- interface definitions;
- synthetic customers/projects/conversations;
- public Entra identifiers intentionally required by a public client;
- sample environment files with placeholder values.

Not allowed:

- real customer records;
- real customer emails/PII;
- production Blueprint payloads;
- user conversation exports;
- secrets/tokens;
- private keys;
- production connection strings.
