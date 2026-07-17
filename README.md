# Codex Skin Studio

[简体中文](./README.zh-CN.md) · English

> A local-first Windows theme-creation studio for Codex. Turn a reference image set and a written brief into generated artwork, matching icons, themed copy, and a reversible Codex desktop skin.

[Download the latest portable EXE](https://github.com/wangyuanfei-9527/Codex-Skin/releases/latest)

![Codex Skin Studio theme applied to the Codex home screen](./docs/images/theme-home.png)

## What it does

Codex Skin Studio uses the **Codex CLI already installed and signed in on your computer**. It does not bundle a model, require a separate API key, or send files to a Codex Skin Studio server.

The workflow is deliberately staged:

1. Analyze the subject, character identity, signature traits, palette, composition, lighting, motifs, must-preserve details, and source risks in the reference images.
2. Combine that evidence with your brief to create a complete skin specification and a prompt for every required visual asset.
3. Ask your local Codex runtime to generate a 16:10 hero image and a matching 2×2 icon atlas.
4. Validate image dimensions, schemas, hashes, paths, and CSS scope before a preview can be built.
5. Apply only a complete bundle, restart Codex, and keep restoration one click away.

This avoids the common “tinted wallpaper plus generic icons” result: the visual identity is extracted first, all asset prompts are planned together, and only then are images generated and injected.

## Highlights

- **Portable Windows app** — one EXE, no installer, bundled Node runtime.
- **Uses your local Codex** — no embedded model and no third-party model service.
- **Reference-aware generation** — preserves explicitly requested fictional-character identity and signature traits instead of reducing the source to a color palette.
- **Generated hero and icon set** — the original image is never used as a silent fallback.
- **Whole-surface theming** — sidebar, header, project/task rows, hero, suggestion cards, composer, dialogs, popovers, settings, review surfaces, code blocks, selection colors, and more.
- **Generated copy pack** — hero text, project label, card labels, composer placeholder, profile badge, and signature can share the theme language.
- **Theme library** — every successful generation is retained locally for previewing and switching.
- **Safe deletion** — the currently applied theme cannot be deleted.
- **Reversible injection** — restore the original Codex appearance without deleting the theme library.
- **Fail-closed validation** — missing, irrelevant, truncated, or invalid assets stop the workflow instead of applying a partial skin.

> **Current scope:** v0.7.7 ships the independent skin workflow. Pet creation remains intentionally separate until it can meet the same quality and validation bar; this release never substitutes a generic placeholder pet.

## Screenshots

### Generated visual assets

| Generated 16:10 hero | Generated 2×2 icon atlas |
| --- | --- |
| ![Generated Miku-inspired hero image](./docs/images/generated-hero.png) | ![Generated matching icon atlas](./docs/images/generated-icons.png) |

### Applied Codex surfaces

| Themed home | Native appearance settings |
| --- | --- |
| ![Themed Codex home](./docs/images/theme-home.png) | ![Themed appearance settings](./docs/images/appearance-settings.png) |

The screenshots show a generated Miku-inspired theme used for validation. Artwork, copy, palette, and icons change with the references and brief supplied by the user.

## Requirements

- Windows 10 or Windows 11, x64
- Codex desktop installed
- Codex CLI installed, available as `codex`, and signed in
- A Codex account/workspace with the capabilities required by the selected generation flow

The portable EXE contains the studio runtime and deterministic compiler. It does **not** contain Codex, a model, an API key, or your credentials.

## Quick start

1. Download `CodexSkinStudio-v0.7.7-Windows-x64.exe` from [Releases](https://github.com/wangyuanfei-9527/Codex-Skin/releases/tag/v0.7.7).
2. Double-click the EXE. No installation is required.
3. Add one or more local reference images.
4. Describe the desired subject, mood, composition, copy direction, and any details that must remain recognizable.
5. Choose **Generate skin and apply** for the complete flow, or **Generate preview only** to review the bundle first.
6. Inspect the hero, four generated icons, palette, copy, and Codex preview.
7. Apply the preview. The studio restarts Codex and injects the validated theme.

Use **Theme Library** to load any previous generation, switch themes without regenerating assets, or delete an unused theme. A theme marked as currently in use is protected; apply another theme or restore the original appearance before deleting it.

## What can be themed

The v0.7.7 injector covers verified Codex surfaces, including:

- app sidebar, navigation, project groups, task rows, profile area, and new-task action;
- home header, brand, signature, hero image/crop, title, subtitle, suggestion cards, and generated icons;
- project selector, composer, placeholder, send control, scroll treatment, selection colors, quotes, and code blocks;
- conversation, review, diff, settings, menu, popover, dialog, tooltip, and editor surfaces that expose verified Codex design tokens;
- a responsive decorative image that remains anchored to the live composer when the window is resized.

Native Windows title/menu chrome, unknown controls, the real signed-in username, core navigation labels, credentials, user tasks, plugins, and pet windows are intentionally left alone.

## Privacy and local data

Codex Skin Studio has no backend, analytics, telemetry, upload endpoint, bundled key, or third-party model integration. It stores jobs, generated assets, validated bundles, backups, and state under:

```text
%LOCALAPPDATA%\CodexSkinStudio
```

The app starts your installed `codex` command under your existing authentication. Reference images, prompts, and generation requests **may be transmitted to OpenAI according to your Codex account and workspace policy**. Codex Skin Studio itself does not operate an additional server. Credentials are never opened or copied. See [PRIVACY.md](./PRIVACY.md) for the complete boundary.

## Command-line usage

The desktop app is the recommended interface. The same validated pipeline is also available from the repository:

```powershell
node .\bin\codex-skin.mjs doctor
node .\bin\codex-skin.mjs generate-skin --image C:\path\one.png --requirements "Create a recognizable Miku theme" --output C:\path\bundle
node .\bin\codex-skin.mjs validate C:\path\bundle
node .\bin\codex-skin.mjs apply-skin C:\path\bundle --restart
node .\bin\codex-skin.mjs restore-skin --restart
```

For a current Codex task, the repository also contains the `$build-codex-skin` skill. It follows the same gated workflow and uses image generation before deterministic compilation.

## Build from source

Prerequisites: Node.js 22+ and the Windows build tools already used by the project.

```powershell
npm run verify
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-app.ps1
```

The single-file application is written to `dist\CodexSkinStudio.exe`.

## v0.7.7

This release expands theme ownership across native Codex surfaces and makes route changes stable:

- semantic colors now reach native controls, menus, overlays, editors, settings, review, and diff surfaces;
- theme bindings are restored when Codex replaces the main surface or sidebar during navigation;
- delayed diff shadow roots receive a bounded retry instead of remaining unthemed;
- explicitly light preview surfaces and switch knobs retain their intended contrast;
- 30 automated checks pass, followed by a live visual audit across home, conversation, review, profile menus, and all 19 settings sections.

Portable EXE SHA-256:

```text
1B5F0E0F4D7DD948953084827F20951F16F60C3625DD1DADD33BA369220BC29F
```

## Troubleshooting

- **Local Codex cannot be found:** open PowerShell and run `codex --version`, then sign in before reopening the studio.
- **Generation stops before preview:** inspect the stage message. Invalid or missing assets intentionally stop the pipeline; there is no low-quality fallback.
- **An older theme is still visible:** open Theme Library and apply the selected theme again so Codex restarts with the current bundle.
- **A theme cannot be deleted:** it is currently applied. Switch to another theme or restore the original Codex appearance first.
- **A Windows-owned area does not change:** native OS chrome and unverified controls are intentionally outside the injection scope.

## Project documents

- [Product principles](./PRODUCT.md)
- [Privacy boundary](./PRIVACY.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)
