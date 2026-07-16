# Codex Skin Studio

Codex Skin Studio turns local reference images and a written brief into a complete Codex desktop skin. Skin and pet creation are intentionally separate: this repository currently ships the independent skin workflow and never generates a placeholder pet.

## The generation pipeline

Every skin passes five gates:

1. Extract the actual subject, fictional-character identity, signature traits, palette, composition, lighting, motifs, must-preserve items, and source risks into `reference-analysis.json`.
2. Combine that evidence with the user brief to produce `skin-spec.json` and complete prompts for every raster asset.
3. Use the user's local Codex image-generation capability to create a clean 16:10 hero and a matching 2×2 icon atlas. Banner themes carry explicit focal coordinates and a top-safe subject composition so the hero can be shown without cutting off a face or signature feature. The original image is never used as a silent fallback.
4. Validate asset dimensions, schema, hashes, paths, and CSS scope, then build a local preview bundle.
5. Apply only a complete validated bundle; restart and restore remain reversible.

Recognizable fictional characters explicitly requested by the user remain recognizable. Real people are not identified. Source text, watermarks, logos, fake controls, and exact source compositions are treated as generation risks.

## Portable desktop app

Build the single-file Windows application:

```powershell
.\scripts\build-windows-app.ps1
```

Double-click `dist\CodexSkinStudio.exe`, add local images, adjust the brief, and generate a preview. The right panel exposes reference extraction, prompt planning, hero/icon generation, compilation, and application as separate progress stages.

The EXE bundles its Node runtime and deterministic compiler, but not Codex or a model. It uses the user's installed and signed-in Codex CLI.

## CLI

```powershell
node .\bin\codex-skin.mjs doctor
node .\bin\codex-skin.mjs generate-skin --image C:\path\one.png --requirements "制作一个明确可识别的 Miku 主题" --output C:\path\bundle
node .\bin\codex-skin.mjs validate C:\path\bundle
node .\bin\codex-skin.mjs apply-skin C:\path\bundle --restart
node .\bin\codex-skin.mjs restore-skin --restart
```

For a current Codex task, use the included `$build-codex-skin` skill. It follows the same gated workflow and uses `$imagegen` before deterministic compilation.

## What is themed

The injector targets verified Codex shell markers and can theme the sidebar, new-task control, project/task rows, section labels, profile area, header brand and signature, home hero title/subtitle/art crop, suggestion cards and generated icons, project label/selector, composer placeholder/send control, scroll treatment, code blocks, quotes, selection color, and a faint task-page art layer. The generated copy pack owns the hero title, hero subtitle, project label, four card titles/subtitles, composer placeholder, profile badge, and signature. Core navigation names and the real signed-in username remain native so their meaning and accessibility do not drift.

The decorative polaroid follows the live composer position through a resize observer instead of fixed screen offsets, so resizing does not make it jump between unrelated anchors.

Windows title/menu chrome, dialogs, popovers, and unknown buttons intentionally remain native. The compiler never applies global `button`, `input`, `dialog`, or menu rules.

The Microsoft Store package, credentials, databases, user tasks, plugins, and pets are not modified. Auxiliary pet windows remain transparent and unskinned.

## Privacy boundary

The project has no backend, analytics, upload endpoint, or third-party model integration. The local Codex CLI may transmit reference images, prompts, and image-generation requests to OpenAI under the user's existing authentication. Generated images initially appear in Codex's local generated-image directory and are copied into the isolated local job before compilation. See [PRIVACY.md](./PRIVACY.md).

## Verification

```powershell
npm run verify
node .\bin\codex-skin.mjs doctor
```

The automated suite covers strict stage artifacts, asset collection, image constraints, CSS scoping, hash tampering, path containment, skin-only apply/restore behavior, and loopback CDP validation. Live visual signoff still requires a real Codex screenshot after injection.
