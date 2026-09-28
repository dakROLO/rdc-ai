# CrownKeep Facelift — Deferred Implementation Package

**Status:** Captured for a later, intentional facelift. Do not let this work interrupt the current local-platform validation and Web Access acceptance gates.

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

## Recommended future implementation order

1. Select a single icon direction and commission or create its final SVG variants (dark, light, monochrome, favicon/PWA sizes).
2. Apply design tokens to app shell, top bar, cards, controls, and light mode without changing product behavior.
3. Replace current brand lockups in the desktop host, PWA shell, and launch surfaces.
4. Use the crown motif and knowledge mark selectively for onboarding, empty states, and launch video.
5. For loading, prefer a CSS `rotateY` animation of the transparent crown PNG over a GIF. It preserves translucency, is sharper at any size, honors reduced-motion preferences, and avoids a large raster loop.
6. Treat a true three-dimensional crown turn as a later WebM/3D-animation task; do not block the facelift on it.

## Implementation guardrail

This is a visual facelift only. It must not alter CrownKeep's local-first privacy boundary, provider-neutral architecture, model/runtime acceptance evidence, or current merge/branch-cleanup gates.
