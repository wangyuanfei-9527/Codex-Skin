import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { customizeBundleCopy, mergeCopyOverrides } from '../src/copy-customizer.mjs';
import { validateBundle } from '../src/bundle-validator.mjs';
import { compileBundle } from '../src/theme-compiler.mjs';
import { sampleSpec, writePng } from './helpers.mjs';

function skinSpec() {
  const { pet, ...skin } = sampleSpec();
  return skin;
}

test('clones a validated skin with exact copy overrides and leaves the source unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-copy-'));
  const background = path.join(root, 'background.png');
  const icons = path.join(root, 'icons.png');
  const source = path.join(root, 'source');
  const output = path.join(root, 'customized');
  const copyFile = path.join(root, 'copy.json');
  await writePng(background, 1200, 800);
  await writePng(icons, 1024, 1024);
  await compileBundle({ spec: skinSpec(), images: [background], iconSheet: icons, outputDirectory: source, skinOnly: true });

  const originalDesign = await fs.readFile(path.join(source, 'design.json'));
  const originalManifest = await fs.readFile(path.join(source, 'manifest.json'));
  const originalCss = await fs.readFile(path.join(source, 'theme.css'));
  const overrides = {
    name: 'Quiet Workshop',
    summary: 'A customized workspace that keeps the original visual assets.',
    copy: {
      heroTitle: 'Make the next precise move',
      heroSubtitle: 'Explore, build, review, and repair with deliberate focus.',
      signature: 'Quiet Craft',
      cardTitles: ['Trace context', 'Shape intent', 'Check edges', 'Repair cause'],
      cardSubtitles: ['Read the whole path', 'Turn thought into code', 'Verify important details', 'Fix the underlying fault'],
    },
  };
  await fs.writeFile(copyFile, JSON.stringify(overrides));

  await customizeBundleCopy({ bundleDirectory: source, copyFile, outputDirectory: output });
  const sourceChecked = await validateBundle(source, { requireReady: true });
  const customized = await validateBundle(output, { requireReady: true });
  const css = await fs.readFile(customized.cssPath, 'utf8');

  assert.deepEqual(await fs.readFile(path.join(source, 'design.json')), originalDesign);
  assert.deepEqual(await fs.readFile(path.join(source, 'manifest.json')), originalManifest);
  assert.deepEqual(await fs.readFile(path.join(source, 'theme.css')), originalCss);
  assert.equal(sourceChecked.design.name, 'Aurora Harbor');
  assert.notEqual(customized.manifest.id, sourceChecked.manifest.id);
  assert.equal(customized.manifest.name, overrides.name);
  assert.equal(customized.manifest.summary, overrides.summary);
  assert.equal(customized.design.name, overrides.name);
  assert.equal(customized.design.summary, overrides.summary);
  assert.equal(customized.design.copy.projectLabel, sourceChecked.design.copy.projectLabel);
  assert.equal(customized.design.copy.composerPlaceholder, sourceChecked.design.copy.composerPlaceholder);
  assert.equal(customized.design.copy.profileBadge, sourceChecked.design.copy.profileBadge);
  assert.deepEqual(customized.design.copy.cardTitles, overrides.copy.cardTitles);
  assert.deepEqual(customized.design.copy.cardSubtitles, overrides.copy.cardSubtitles);
  assert.equal(customized.manifest.theme.backgroundSha256, sourceChecked.manifest.theme.backgroundSha256);
  assert.equal(customized.manifest.theme.icons.sha256, sourceChecked.manifest.theme.icons.sha256);
  assert.ok(css.includes(`content: ${JSON.stringify(overrides.copy.heroTitle)}`));
  assert.ok(css.includes(`content: ${JSON.stringify(overrides.copy.heroSubtitle)}`));
  assert.ok(css.includes('#codex-skin-studio-chrome .skin-action-card'));
  assert.equal(css.includes(sourceChecked.design.copy.heroTitle), false);
});

test('rejects unknown copy fields and values outside the skin schema limits', () => {
  const spec = skinSpec();
  assert.throws(() => mergeCopyOverrides(spec, { unexpected: 'value' }), /field is not allowed: unexpected/);
  assert.throws(() => mergeCopyOverrides(spec, { copy: { projectLabel: 'Not allowed here' } }), /field is not allowed: copy\.projectLabel/);
  assert.throws(() => mergeCopyOverrides(spec, { name: 'x'.repeat(81) }), /spec\.name/);
  assert.throws(() => mergeCopyOverrides(spec, { copy: { cardTitles: ['Only one'] } }), /cardTitles/);
});
