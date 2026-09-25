# RDC AI — Current Status

**Updated:** 2026-09-24

## Active phase

Phase 0 — Foundation

## Active sprint

Sprint 0.2 — Application shell

## Completed

- Public repository created: `dakROLO/rdc-ai`.
- Confirmed the repository is intentionally public.
- Established RDC Azure tenant as the future cloud/security boundary.
- Established Microsoft Entra ID as the future cloud authentication mechanism.
- Established that encrypted cross-device sync will live in RDC Azure.
- Established that real RDC customer/Blueprint/dashboard data is out of current scope.
- Established durable repo documentation as the project system of record.
- Created project context, architecture, roadmap, decision log, security model, and agent instructions.
- Completed Sprint 0.1 repository/project contract.
- Added current Vite + React + TypeScript application foundation.
- Added `AIProvider`, conversation domain, storage, sync, auth, and future context interfaces.
- Added a mock streaming local provider and stop-generation path.
- Added responsive foundation conversation UI.
- Added PWA manifest, install metadata, icons, and service worker.
- Added CI workflow for install, lint, and production build.
- CI run #1 passed install, lint, and production build on 2026-09-24.
- PWA packaging corrected to include 192×192 and 512×512 PNG install icons.
- Service worker updated to discover/cache Vite production assets during installation.
- First Windows tester successfully cloned the repository.
- First Windows tester encountered npm `ENOENT package.json` when npm was run from the parent folder; README/testing docs were clarified to make the required repository-directory step explicit.

## In progress

- Run the documented Windows smoke/PWA test from inside the repository directory.
- Validate Windows PWA install/offline shell behavior in a real browser.
- Establish an HTTPS test deployment for iPhone validation.
- Add a committed dependency lockfile after a normal local install.
- Close remaining Sprint 0.2 exit criteria.

## Next exit target

Complete Sprint 0.2, then begin Sprint 1.1 — Domain + local persistence.

## Current blockers

None identified.

## Validation evidence

- GitHub Actions CI run #1: **success**.
- Production TypeScript/Vite build: **passed**.
- Oxlint: **passed**.
- Repository clone on Windows: **passed**.
- Browser PWA installation/offline validation: **pending manual verification**.

## Open architectural decisions

- Product name.
- Exact IndexedDB library/abstraction.
- Exact iPhone local model/provider selection after capability testing.
- Azure sync persistence service.
- Sync key hierarchy and recovery/enrollment model.
- Cloud AI model/deployment selection.
- Public-source license.


## Manual test note — 2026-09-24

- Windows local Vite UI test: **passed**; mock local chat rendered and responded correctly.
- Same-network phone test: Vite endpoint loaded, but the phone displayed only a blue screen.
- Phone rendering issue remains open for Sprint 0.2 diagnosis; do not treat mobile layout as validated yet.
- Working product name selected: **CrownKeep**.
