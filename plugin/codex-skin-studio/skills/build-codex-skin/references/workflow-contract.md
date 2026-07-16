# Workflow contract

## Stage artifacts

1. `reference-analysis.json` — image evidence only; no theme or asset prompts.
2. `skin-spec.json` — user brief plus verified extraction; contains the complete asset prompt pack.
3. `generated-assets/hero.*` — generated 16:10 theme art.
4. `generated-assets/icons.*` — generated square 2×2 icon atlas.
5. Validated skin bundle — generated assets, constrained CSS, hashes, and manifest.

Do not create a later artifact until the preceding artifact passes validation.

## Reference extraction minimum

- Identify subject kind and identity. Name recognizable fictional characters; never identify real people.
- Record 3–8 signature traits and 3–8 recurring motifs.
- Record 4–8 palette colors, composition, lighting, medium, and mood.
- Record 2–10 must-preserve items and 1–8 source risks.
- Treat source text, logos, watermarks, UI fragments, and exact poses/crops as risks, not reusable theme assets.

## Safe string budgets

- Asset subject: at most 80 characters.
- Each motif: at most 32 characters.
- Hero prompt: at most 950 characters and a complete final sentence.
- Icon prompt: at most 520 characters and a complete final sentence.
- Card subtitle: at most 30 characters.
- Hero title: at most 70 characters.
- Hero subtitle: at most 90 characters.
- Project label: at most 24 characters.
- Composer placeholder: at most 60 characters.
- Signature: at most 20 characters.

User-facing copy must follow the language of the user's brief. Image prompts may use English.

## Asset acceptance

Hero:

- At least 1200×700, landscape ratio between 1.35 and 1.9.
- Requested fictional subject remains recognizable when applicable.
- Copy-safe space matches the selected layout.
- Banner subjects keep the full face/head and identifying silhouette within the top-safe focal region; focalX/focalY are recorded in the skin spec.
- No readable source text, fake controls, border, logo, or watermark.

Icon atlas:

- At least 768×768 and approximately square.
- Exactly four coordinated quadrants in the required order.
- Strong silhouettes remain readable when displayed at 32 px.
- No letters, numbers, text, global border, or watermark.

## UI acceptance

- Native menu and unrelated buttons retain official geometry; no global outlines.
- Sidebar, new-task control, project/task rows, section labels, profile area, header brand/signature, hero title/subtitle/crop, cards/icons/subtitles, project label/selector, composer placeholder/send control, code blocks, quotes, selection color, scroll treatment, and normal task background share one theme system.
- Core navigation labels, title/menu chrome, dialogs, popovers, and unknown controls remain native.
- All decorative layers use `pointer-events: none` and never cover real controls.
- Auxiliary pet windows remain transparent and unskinned.
- Reject weak character relevance, raw-image fallback, ghost text, fake UI, low contrast, excessive borders, or an incomplete asset prompt.

