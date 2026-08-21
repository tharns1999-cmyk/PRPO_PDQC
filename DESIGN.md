# Design System: The Inspector's Clipboard

## Identity
A crisp, technical interface that acts like an inspector's clipboard, refusing the verbosity and bulk of typical enterprise SaaS. Designed for an industrial environment where speed, legibility, and exactitude matter over decorative charm.

## Core Tokens
- **Backgrounds**: Off-white matte ground (`bg-slate-50`), evoking technical paper.
- **Text**: Charcoal / Slate-900 for primary prose, maintaining high contrast.
- **Structural Lines**: Subtle monochrome borders (`border-slate-300` and `border-slate-400`).
- **Typography**: 
  - Primary UI text: `Inter` (sans-serif)
  - Data, codes, numbers: `JetBrains Mono` (monospace)
- **Signal Colors**: Reserved strictly for state and actions (emerald for receive/approve, rose/red for reject/defect).

## Layout & Components
- **Borders**: Sharp edges or minimalistic curves (`rounded-sm`). Avoid large bubbly borders.
- **Shadows**: Kept flat and close to the surface (`shadow-sm` or `shadow-md` for modals), refusing deep floating effects.
- **Density**: Tight padding (`px-3 py-1.5`) and concise labels. Drop verbose explanations in favor of short headers and tooltips.
- **Data Tables**: Modeled after ledger sheets, utilizing full width, clear dividing lines, and tabular numeral alignment.
