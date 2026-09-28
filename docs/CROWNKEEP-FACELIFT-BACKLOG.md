# CrownKeep Facelift — V1 Implementation Package

**Status:** V1 applied at the Windows convergence checkpoint on 2026-09-28. Remaining vector/motion polish is follow-on work and is not a platform acceptance blocker.

## Goal

Refresh CrownKeep's product presentation around a calmer premium local-first identity: precise, private by default, and capable without leaning on fear-driven security imagery.

## Included media

The matching assets are committed under `public/brand/crownkeep-facelift/`:

- `crownkeep-logo-directions-4up.png` — direction board; not a runtime UI asset.
- `crownkeep-app-icon.png` — app-icon and favicon direction.
- `crownkeep-wordmark.png` — header and landing-page lockup direction.
- `crownkeep-crown-motif.png` — hero, loading, and video motif.
- `crownkeep-knowledge-mark.png` — knowledge base, onboarding, and connection motif.
- `crownkeep-glass-crown-transparent.png` — isolated luminous crown source.
- `crownkeep-glass-crown-loader.gif` — exploratory loader preview only.

## Design decisions to carry forward

- Core palette: midnight navy, cobalt blue, electric cyan, cool silver/white; copper is an uncommon emphasis accent only.
- Primary functional mark: the geometric **C enclosing a three-point crown**. Rebuild the selected mark as clean SVG paths before it becomes the permanent production icon.
- Primary wordmark: `CROWNKEEP`, with `CROWN` in silver/white and `KEEP` in cobalt/cyan on dark surfaces.
- Glass/ribbon crown imagery is supporting motion and hero art, not the small functional icon.
- Product tone: calm, precise, premium, local-first. Avoid shields, padlocks, surveillance, hacker/cyberpunk imagery, generic cloud/server art, and medieval royal crests.

## V1 implementation status

Implemented:

1. Midnight navy, cobalt blue, electric cyan, cool silver/white tokens applied to the shared shell without changing runtime behavior.
2. Copper retained as a rare emphasis color for external/network/cloud boundaries.
3. `crownkeep-app-icon.png` is used by the shared UI, browser/favicon/PWA shell, Tauri desktop icon generation, CI iPhone icon preparation, and the physical iPhone build script.
4. `crownkeep-wordmark.png` is used in the expanded sidebar lockup.
5. Existing compact status/composer layout is preserved; the facelift is intentionally visual rather than a navigation redesign.

Deferred:

- final production SVG redraw of the selected geometric C/crown mark;
- CSS/3D crown loading motion;
- light-theme pass;
- onboarding/empty-state use of the crown motif and knowledge mark.

## Implementation guardrail

This is a visual facelift only. It must not alter CrownKeep's local-first privacy boundary, provider-neutral architecture, model/runtime acceptance evidence, or current merge/branch-cleanup gates.
