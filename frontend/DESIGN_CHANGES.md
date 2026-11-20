# PolicySim redesign

Visual direction: light stone canvas, near-black ink, one signal red (#de4540) used only for
actions and high-impact data. Typeface: Schibsted Grotesk (loaded with next/font).

## New files
- `components/IndiaSilhouette.tsx` – sculpted grey India map for the landing hero; highlights states in red.
- `lib/indiaPaths.ts` – simplified SVG paths generated from `public/india.geojson`.

## Rewritten
- `app/globals.css` – design tokens, `.card`, `.btn-*`, `.display`, colour scales, reduced-motion support.
- `app/layout.tsx` – Schibsted Grotesk font.
- `components/Navbar.tsx` – pill nav left, logo centred, account action right; stacks on mobile.
- `app/page.tsx` – new hero (headline, map, forecast card, sample-policy card, sector stack).
- `app/upload/page.tsx`, `components/FileUpload.tsx` – calmer upload flow with clearer errors.
- `app/dashboard/page.tsx` – key-number cards, pill tabs, cleaner state list. Same data logic.
- `app/sign-in`, `app/sign-up` – removed old glow backgrounds.

## Restyled (colours and surfaces only, logic untouched)
All other components: indigo/purple/pink/blue → signal red or neutral, gradient icon tiles → plain
circles, glass panels → `.card`. `IndiaMap` now uses a red scale.

## Fixes
- `lib/types.ts` – added `TwoStageScenario` and the optional `two_stage_scenario`, `shap_importance`,
  `xgboost_prediction` fields. `npm run build` failed on these before.
- Upload page now reads `NEXT_PUBLIC_API_URL` (falls back to http://localhost:8000), like `lib/api.ts`.

## Not used any more (left in place, safe to delete)
QuantumParticleCanvas, HolographicGlobe, LiveAgentGraph, SplitPolicySlider, SciFiSoundEffects.
