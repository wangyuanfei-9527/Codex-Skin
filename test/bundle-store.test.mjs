import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateBundle } from '../src/bundle-validator.mjs';
import { codexNativeTokenCss, codexReviewDiffCss, codexRuntimePatchCss, compileBundle } from '../src/theme-compiler.mjs';
import { replaceBundlePetSpritesheet } from '../src/pet-replacer.mjs';
import { applyBundle, restoreOriginal, restoreSkin } from '../src/store.mjs';
import { sampleSpec, writePng } from './helpers.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-bundle-'));
  const background = path.join(root, 'background.png');
  const pet = path.join(root, 'pet.png');
  const petReplacement = path.join(root, 'pet-replacement.png');
  const generatedHero = path.join(root, 'generated-hero.png');
  const icons = path.join(root, 'icons.png');
  await writePng(background, 1200, 800);
  await writePng(pet, 1536, 1872);
  await writePng(petReplacement, 1536, 1872, 4);
  await writePng(generatedHero, 1536, 1024);
  await writePng(icons, 1024, 1024);
  return { root, background, pet, petReplacement, generatedHero, icons };
}

test('runtime patch upgrades historical themes without regeneration', () => {
  const nativeCss = codexNativeTokenCss(sampleSpec().palette);
  assert.match(nativeCss, /--color-background-control:/);
  assert.match(nativeCss, /--color-token-menu-background:/);
  assert.match(nativeCss, /--vscode-editor-background:/);
  assert.match(nativeCss, /--vscode-editorSuggestWidget-background:/);
  assert.match(nativeCss, /--vscode-multiDiffEditor-background:/);
  assert.match(nativeCss, /!important/);
  const css = codexRuntimePatchCss(sampleSpec());
  assert.match(css, /skin-thread-header-layout/);
  assert.match(css, /skin-thread-actions/);
  assert.match(css, /:root\.codex-skin-studio-active button\[class~="bg-token-bg-fog"\]/);
  assert.match(css, /\*:not\(\[style\*="color:"\]\)/);
  assert.match(css, /button\[class~="bg-token-foreground"\]/);
  assert.match(css, /\[class~="bg-token-foreground\/10"\]/);
  assert.match(css, /skin-thread-location-group/);
  assert.match(css, /main\.skin-settings-shell \[class~="rounded-2xl"\]\[class~="border-token-border"\]/);
  assert.match(css, /button\[role="switch"\]/);
  assert.match(css, /skin-window-topbar/);
  assert.match(css, /skin-rail-section-header/);
  assert.match(css, /position: fixed !important/);
  assert.match(css, /CODEX_SKIN_BACKGROUND_DATA_URL/);
  const reviewCss = codexReviewDiffCss(sampleSpec().palette);
  assert.match(reviewCss, /color-scheme: dark/);
  assert.match(reviewCss, /--diffs-bg-addition:/);
  assert.match(reviewCss, /--diffs-bg-deletion:/);
  assert.match(codexReviewDiffCss({ ...sampleSpec().palette, surface: '#FFFFFF' }), /color-scheme: light/);
});

test('compiles and validates a complete bundle, then detects tampering', async () => {
  const files = await fixture();
  const output = path.join(files.root, 'bundle');
  const result = await compileBundle({ spec: sampleSpec(), images: [files.background], petSpritesheet: files.pet, outputDirectory: output });
  assert.equal(result.manifest.ready, true);
  const checked = await validateBundle(output, { requireReady: true });
  assert.equal(checked.pet.metadata.id, 'ripple-otter');
  await fs.appendFile(checked.backgroundPath, 'tampered');
  await assert.rejects(validateBundle(output), /hash does not match/);
});

test('refuses to compile a combined bundle without a real pet atlas', async () => {
  const files = await fixture();
  const output = path.join(files.root, 'bundle');
  await assert.rejects(
    compileBundle({ spec: sampleSpec(), images: [files.background], outputDirectory: output }),
    /real validated pet spritesheet is required/,
  );
});

test('atomically replaces a validated pet atlas', async () => {
  const files = await fixture();
  const output = path.join(files.root, 'bundle');
  await compileBundle({ spec: sampleSpec(), images: [files.background], petSpritesheet: files.pet, outputDirectory: output });
  const before = await validateBundle(output, { requireReady: true });
  const oldHash = before.manifest.pet.sha256;
  const result = await replaceBundlePetSpritesheet(output, files.petReplacement);
  assert.notEqual(result.manifest.pet.sha256, oldHash);
  assert.equal(result.manifest.pet.sourceDerived, true);
  assert.equal(result.manifest.pet.archetype, 'reference-sticker');
  assert.equal(result.manifest.pet.generated, false);
});

test('compiles a skin-only bundle with native Codex layout selectors and no pet', async () => {
  const files = await fixture();
  const output = path.join(files.root, 'skin');
  const { pet, ...skin } = sampleSpec();
  await compileBundle({
    spec: skin,
    images: [files.background],
    backgroundImage: files.generatedHero,
    iconSheet: files.icons,
    outputDirectory: output,
    skinOnly: true,
  });
  const checked = await validateBundle(output, { requireReady: true });
  assert.equal(checked.kind, 'skin');
  assert.equal(checked.pet, null);
  assert.equal(checked.manifest.pet, null);
  assert.equal(checked.manifest.theme.icons.width, 1024);
  assert.ok(checked.iconsPath.endsWith('icons.png'));
  const css = await fs.readFile(checked.cssPath, 'utf8');
  assert.match(css, /aside\.app-shell-left-panel/);
  assert.match(css, /main\.main-surface/);
  assert.match(css, /codex-skin-home/);
  assert.match(css, /data-skin-suggestion-index/);
  assert.match(css, /skin-card-copy/);
  assert.match(css, /skin-project-toolbar/);
  assert.match(css, /skin-thread-header-layout/);
  assert.match(css, /codex-skin-composer-top/);
  assert.match(css, /padding-right: 72px/);
  assert.match(css, /background-size: 100% 100%, auto 118%/);
  assert.match(css, /CODEX_SKIN_ICONS_DATA_URL/);
  assert.match(css, /--color-token-dropdown-background:/);
  assert.match(css, /--color-token-foreground:/);
  assert.match(css, /--color-token-main-surface-primary:/);
  assert.match(css, /--color-token-input-background:/);
  assert.doesNotMatch(css, /codex-skin-studio-active button,/);
  assert.doesNotMatch(css, /codex-skin-studio-background/);
  assert.doesNotMatch(css, /\.group\/(?:home|project)/);
});

test('normalizes legacy skin copy and focal fields when validating an existing bundle', async () => {
  const files = await fixture();
  const output = path.join(files.root, 'legacy-skin');
  const { pet, ...skin } = sampleSpec();
  await compileBundle({ spec: skin, images: [files.background], outputDirectory: output, skinOnly: true });
  const designPath = path.join(output, 'design.json');
  const legacy = JSON.parse(await fs.readFile(designPath, 'utf8'));
  delete legacy.effects.focalX;
  delete legacy.effects.focalY;
  delete legacy.copy.heroTitle;
  delete legacy.copy.projectLabel;
  delete legacy.copy.cardTitles;
  delete legacy.copy.profileBadge;
  await fs.writeFile(designPath, JSON.stringify(legacy));
  const checked = await validateBundle(output, { requireReady: true });
  assert.equal(checked.design.effects.focalX, 50);
  assert.equal(checked.design.copy.cardTitles.length, 4);
  assert.equal(checked.design.copy.profileBadge, 'THEME');
});

test('skin apply and restore do not modify installed pets', { concurrency: false }, async () => {
  const files = await fixture();
  process.env.CODEX_SKIN_HOME = path.join(files.root, 'studio-home');
  process.env.CODEX_HOME = path.join(files.root, 'codex-home');
  try {
    const existingPet = path.join(process.env.CODEX_HOME, 'pets', 'mine');
    await fs.mkdir(existingPet, { recursive: true });
    await fs.writeFile(path.join(existingPet, 'keep.txt'), 'untouched');
    const output = path.join(files.root, 'skin');
    const { pet, ...skin } = sampleSpec();
    await compileBundle({ spec: skin, images: [files.background], outputDirectory: output, skinOnly: true });
    await applyBundle(output);
    assert.equal(await fs.readFile(path.join(existingPet, 'keep.txt'), 'utf8'), 'untouched');
    await restoreSkin();
    assert.equal(await fs.readFile(path.join(existingPet, 'keep.txt'), 'utf8'), 'untouched');
    await assert.rejects(fs.access(path.join(process.env.CODEX_SKIN_HOME, 'active')));
  } finally {
    delete process.env.CODEX_SKIN_HOME;
    delete process.env.CODEX_HOME;
  }
});

test('rejects bundle paths that escape the bundle root', async () => {
  const files = await fixture();
  const output = path.join(files.root, 'bundle');
  await compileBundle({ spec: sampleSpec(), images: [files.background], petSpritesheet: files.pet, outputDirectory: output });
  const manifestPath = path.join(output, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.theme.css = '../outside.css';
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validateBundle(output), /escapes its root/);
});

test('applies and restores only managed local state', { concurrency: false }, async () => {
  const files = await fixture();
  const home = path.join(files.root, 'studio-home');
  const codex = path.join(files.root, 'codex-home');
  process.env.CODEX_SKIN_HOME = home;
  process.env.CODEX_HOME = codex;
  try {
    const output = path.join(files.root, 'bundle');
    await compileBundle({ spec: sampleSpec(), images: [files.background], petSpritesheet: files.pet, outputDirectory: output });
    const applied = await applyBundle(output);
    assert.equal(applied.state.bundleId.length > 0, true);
    const petDirectory = path.join(codex, 'pets', 'ripple-otter');
    assert.equal((await fs.stat(path.join(petDirectory, 'pet.json'))).isFile(), true);
    assert.equal((await fs.stat(path.join(home, 'active', 'manifest.json'))).isFile(), true);
    const restored = await restoreOriginal();
    assert.deepEqual(restored.warnings, []);
    await assert.rejects(fs.access(petDirectory));
    await assert.rejects(fs.access(path.join(home, 'active')));
  } finally {
    delete process.env.CODEX_SKIN_HOME;
    delete process.env.CODEX_HOME;
  }
});

test('refuses to overwrite an unmanaged pet', { concurrency: false }, async () => {
  const files = await fixture();
  process.env.CODEX_SKIN_HOME = path.join(files.root, 'studio-home');
  process.env.CODEX_HOME = path.join(files.root, 'codex-home');
  try {
    const output = path.join(files.root, 'bundle');
    await compileBundle({ spec: sampleSpec(), images: [files.background], petSpritesheet: files.pet, outputDirectory: output });
    const unmanaged = path.join(process.env.CODEX_HOME, 'pets', 'ripple-otter');
    await fs.mkdir(unmanaged, { recursive: true });
    await fs.writeFile(path.join(unmanaged, 'mine.txt'), 'keep');
    await assert.rejects(applyBundle(output), /unmanaged pet/);
    assert.equal(await fs.readFile(path.join(unmanaged, 'mine.txt'), 'utf8'), 'keep');
  } finally {
    delete process.env.CODEX_SKIN_HOME;
    delete process.env.CODEX_HOME;
  }
});

test('restore leaves a managed pet directory untouched after user changes', { concurrency: false }, async () => {
  const files = await fixture();
  process.env.CODEX_SKIN_HOME = path.join(files.root, 'studio-home');
  process.env.CODEX_HOME = path.join(files.root, 'codex-home');
  try {
    const output = path.join(files.root, 'bundle');
    await compileBundle({ spec: sampleSpec(), images: [files.background], petSpritesheet: files.pet, outputDirectory: output });
    await applyBundle(output);
    const petDirectory = path.join(process.env.CODEX_HOME, 'pets', 'ripple-otter');
    await fs.writeFile(path.join(petDirectory, 'my-note.txt'), 'do not delete');
    const restored = await restoreOriginal();
    assert.equal(restored.warnings.length, 1);
    assert.equal(await fs.readFile(path.join(petDirectory, 'my-note.txt'), 'utf8'), 'do not delete');
  } finally {
    delete process.env.CODEX_SKIN_HOME;
    delete process.env.CODEX_HOME;
  }
});
