<h1 align="center">Codex Skin Studio</h1>

<p align="center"><strong>Turn the characters, colors, and atmosphere you love into a Codex workspace you will actually want to open.</strong></p>

<p align="center">Bring a small set of reference images and a written direction. Get a coherent hero, icon set, palette, and copy pack that carries the same identity from the home screen and sidebar into conversations, settings, menus, and editors. A complete workspace skin—not a wallpaper swap.</p>

<p align="center"><strong><a href="https://github.com/wangyuanfei-9527/Codex-Skin/releases/latest">Download the latest portable Windows app</a></strong> · <a href="./README.zh-CN.md">简体中文</a></p>

<p align="center"><code>One portable EXE</code> · <code>No installer</code> · <code>Uses your local Codex</code> · <code>Preview first</code> · <code>Restore anytime</code></p>

![Codex home screen with a generated Miku angel theme](./docs/images/codex-home.jpg)

> This is the theme running in Codex, not a concept mockup. The hero, four icons, palette, and copy were generated from one reference direction. Change the references and brief, and the whole themed experience changes with them.

## More than a background image

Most themes stop at the easiest surface to screenshot. Codex Skin Studio first identifies what makes your references distinctive—the subject, character identity, signature traits, color, light, composition, and motifs—then designs every asset as one system.

- **The theme follows you into real work.** Conversations, code, review, diff, settings, in-app menus, overlays, and editors share the same semantic palette.
- **The assets are made as a set.** A wide hero and four small-format icons use one visual language; a raw reference crop is never passed off as the finished result.
- **The words belong to the theme too.** Titles, subtitles, feature cards, composer text, project labels, badges, and signatures can all be rewritten together.
- **You keep the final say.** Review the complete preview before applying, switch to any saved theme, or return to the original Codex appearance whenever you want.

### The mood survives past the home screen

Opening a task does not drop you back into an unrelated interface. The content canvas, composer, environment panel, surfaces, and contrast all adapt while Codex keeps its familiar layout and workflow.

![Codex conversation and coding workspace with the generated theme](./docs/images/codex-workspace.jpg)

### Even native settings belong to the same system

The skin is not optimized for one glamorous screenshot. Verified settings, menus, dialogs, review, diff, and editor surfaces inherit the theme while preserving readable contrast for long sessions.

![Codex settings with the generated theme](./docs/images/codex-settings.jpg)

## Your first theme takes three steps

1. **Bring the inspiration.** Choose one or more character images, illustrations, palette references, or mood images.
2. **Describe what must survive.** Call out the subject, mood, composition, copy direction, and the details that must remain recognizable.
3. **Preview, then apply.** The studio creates the hero, icons, palette, and copy. Generate a preview for review, or apply the complete theme and restart Codex.

![Codex Skin Studio creation workflow and live theme preview](./docs/images/studio-create.jpg)

Generation is not a mystery button. The studio keeps your references, direction, progress, palette, and a Codex-shaped preview visible. A theme can only be applied after its assets, dimensions, schema, hashes, paths, and injection scope pass validation. Missing or invalid output stops the run instead of quietly falling back to something generic.

## Keep every good direction

Every successful generation is added to a local theme library. Revisit and switch themes without generating them again. The theme currently applied to Codex is protected from deletion, and restoring the original appearance never erases your library.

![Local theme library in Codex Skin Studio](./docs/images/studio-library.jpg)

## Get started

### Requirements

- Windows 10 or Windows 11, x64
- The Microsoft Store build of Codex desktop installed (the current injection target)
- Codex CLI installed and signed in; `codex --version` should work in PowerShell
- A Codex account or workspace with the capabilities required by the selected generation flow

### Quick start

1. Download `CodexSkinStudio-v0.7.7-Windows-x64.exe` from [Releases](https://github.com/wangyuanfei-9527/Codex-Skin/releases/tag/v0.7.7).
2. Double-click the EXE. There is nothing to install and no separate API key to paste in.
3. Add your reference images and write the creative direction.
4. Choose **Generate preview only** to review the result, or **Generate skin and apply** for the complete flow.
5. Use **Restore original Codex** whenever you want to switch back. Your theme library stays intact.

**[Download Codex Skin Studio v0.7.7](https://github.com/wangyuanfei-9527/Codex-Skin/releases/tag/v0.7.7)**

## Local-first, with a clear data boundary

Codex Skin Studio has no backend, account system, analytics, telemetry, upload endpoint, bundled key, or third-party model service. Jobs, generated assets, bundles, backups, and state are stored under:

```text
%LOCALAPPDATA%\CodexSkinStudio
```

The app launches the `codex` command already installed and authenticated on your computer. Reference images, prompts, and generation requests may be transmitted to OpenAI according to your Codex account and workspace policy. They do not pass through a Codex Skin Studio server—there is no such server—and the app never opens or copies your Codex credentials. See [PRIVACY.md](./PRIVACY.md) for the complete boundary.

## What changes—and what deliberately does not

The validated theme surface includes the sidebar, navigation, project and task rows, home hero, feature cards, composer, scroll treatment, selections, code blocks, conversations, review, diff, settings, in-app menus, overlays, dialogs, and editor design tokens.

Native Windows title and menu chrome, unknown controls, your real signed-in name, core navigation labels, user tasks, plugins, credentials, and pet windows stay untouched. v0.7.7 focuses on doing the independent skin workflow well; pet creation remains separate rather than shipping a generic placeholder.

<details>
<summary><strong>Command-line workflow</strong></summary>

The desktop app is the recommended interface. The repository also exposes the same validated pipeline through the CLI:

```powershell
node .\bin\codex-skin.mjs doctor
node .\bin\codex-skin.mjs generate-skin --image C:\path\one.png --requirements "Create a theme that preserves the character's signature traits" --output C:\path\bundle
node .\bin\codex-skin.mjs validate C:\path\bundle
node .\bin\codex-skin.mjs apply-skin C:\path\bundle --restart
node .\bin\codex-skin.mjs restore-skin --restart
```

The repository also includes the `$build-codex-skin` skill for running the same staged workflow inside a Codex task.

</details>

<details>
<summary><strong>Build from source</strong></summary>

You need Node.js 22+, a 64-bit .NET Framework C# compiler, and the corresponding framework assemblies:

```powershell
npm run verify
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-app.ps1
```

The single-file app is written to `dist\CodexSkinStudio.exe`.

</details>

<details>
<summary><strong>v0.7.7 verification</strong></summary>

This release passes 30 automated checks and was visually audited on the real home, conversation, review, profile-menu, and all 19 settings surfaces.

Portable EXE SHA-256:

```text
1B5F0E0F4D7DD948953084827F20951F16F60C3625DD1DADD33BA369220BC29F
```

</details>

## Troubleshooting

- **Local Codex is not found:** run `codex --version` in PowerShell, confirm that you are signed in, then reopen the studio.
- **Generation stops before preview:** read the stage message. Missing, damaged, or invalid assets intentionally stop the workflow; an incomplete theme is never applied.
- **An older theme is still visible:** open the Theme Library and apply the selected theme again so Codex restarts with the current bundle.
- **A theme cannot be deleted:** it is currently in use. Apply another theme or restore the original appearance first.
- **A Windows-owned area does not change:** native OS surfaces and unverified controls intentionally remain outside the injection boundary.

## Project documents

- [Product principles](./PRODUCT.md)
- [Privacy boundary](./PRIVACY.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)
