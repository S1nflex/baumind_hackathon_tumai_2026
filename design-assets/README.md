# BauMind — Visual Asset Library (2026)

## Brand
- Alpine Green `#20382B`, Forest `#19382E`, Olive `#7E8755`, Warm Ivory `#F6F3E9`, Cloud Blue `#91B2BC`.
- Mountains logo: `public/brand/mountain-mark.png`.
- Display typography: **Caprasimo**; secondary and dense working data: **Gelasio 400/700**.
- Fonts are referenced via Google Fonts CSS, not distributed as font binaries.

## Assets
- `public/brand/elements/`: individual transparent optimized WebP cut-outs of the newly generated cloud, flora, and UI sprite boards.
- `design-assets/source-sheets/`: original high-resolution generated transparent sheets kept as source materials, not served to browsers.
- File names beginning with `cloud-`, `ivy-`, `grass-`, `daisy-`, `flower-`, `leaf-`, `sun-`, `valley-`, `mountain-`, and `icon-` describe the respective subjects.
- `public/brand/elements/index.html`: asset gallery with preview and paths.

## Functionality
- `src/components/nature-hero.tsx` uses separate layered cut-outs and CSS animations, with user-controlled cloud movement and light.
- `src/components/workspace.tsx` uses real import actions, real project states, and original LV/review/bid functionality.
- No large background photographs. No changes to parsing, calculation, or API behavior.

All decorative images are marked presentational; `prefers-reduced-motion` disables ambient motion.
