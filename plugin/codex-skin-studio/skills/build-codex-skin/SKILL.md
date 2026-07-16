---
name: build-codex-skin
description: Extract visual elements from local reference images, plan a complete Codex desktop skin, generate the required hero and icon assets, validate the result, and safely apply or restore it. Use for Codex themes, reskins, custom visual workspaces, or converting character/art references into a coherent Codex interface. This skill handles skin only; pet creation is a separate workflow.
---

# Build Codex Skin

Create the skin through five gated stages. Never collapse the stages or use an original reference image as a fallback hero.

## Privacy

State once that the project has no backend or telemetry; attached images and image generation are processed under the user's existing Codex/OpenAI session. Do not inspect credentials or use web search, connectors, external hosts, third-party models, or remote MCP servers.

## Stage 1 — Extract references

Read [workflow-contract.md](references/workflow-contract.md). Inspect images before considering the written brief. Save `reference-analysis.json` containing the actual subject, fictional-character identity when recognizable, signature traits, palette, composition, lighting, medium, mood, motifs, must-preserve items, and source risks.

Never identify a real person. When the user names a fictional character such as Hatsune Miku, preserve the identity and signature traits rather than reducing the result to generic colors.

Stop if the extraction is vague, omits the requested subject, or copies source text/watermarks.

## Stage 2 — Plan the skin and every asset prompt

Combine the verified extraction with the user's brief. Save `skin-spec.json` using the repository schema. Plan the full interface system: accessible palette, banner/fullscreen layout, focalX/focalY crop coordinates, user-language hero title/subtitle, project label, four card titles/subtitles, composer placeholder, a short profile badge, signature, recurring motifs, hero prompt, and 2×2 icon-atlas prompt. The badge is decorative only; never replace the real signed-in username.

Complete every prompt before generating any image. Keep strings below their safe budgets in the contract; never truncate a word or sentence at a schema maximum.

## Stage 3 — Generate assets

Use `$imagegen` for both assets:

1. Generate a clean 16:10 hero/background. For banner layouts, keep the complete face/head and signature silhouette inside the planned upper-right focal safe region; for fullscreen, respect the natural scene focal point. Keep deliberate copy-safe space and preserve the approved subject. Require no text, logo, watermark, border, fake controls, or screenshot fragments.
2. Generate a square 2×2 icon atlas with four edge-to-edge quadrants: code exploration, feature building, review, and repair. Require one bold pictogram per quadrant, no text, and readability at 32 px.

Save final assets inside the local working directory. Inspect both outputs. Reject a hero with unusable copy space, lost character identity, ghost text, fake UI, or a mismatched icon style. Do not silently fall back to an original image.

## Stage 4 — Compile and validate

Run from the repository checkout:

```powershell
node .\plugin\codex-skin-studio\scripts\codex-skin.mjs compile-skin --spec <skin-spec.json> --image <reference-0> [--image <reference-1> ...] --background-image <generated-hero> --icons <generated-icon-atlas> --output <bundle-dir>
node .\plugin\codex-skin-studio\scripts\codex-skin.mjs validate <bundle-dir>
```

Only the deterministic compiler may emit CSS. Never execute model-produced CSS, HTML, JavaScript, or shell. Stop on any schema, hash, path, dimension, or asset validation failure.

## Stage 5 — Apply or restore

Apply only after inspecting the generated assets and validated local preview:

```powershell
node .\plugin\codex-skin-studio\scripts\codex-skin.mjs apply-skin <bundle-dir> --restart
```

Restore with:

```powershell
node .\plugin\codex-skin-studio\scripts\codex-skin.mjs restore-skin --restart
```

The skin may restyle only verified Codex shell, sidebar, home, cards, project selector, composer, and task-surface selectors. Never apply global button/input/dialog rules. Never modify Codex package files, credentials, databases, pets, or unmanaged files.
