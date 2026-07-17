import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createJob } from '../src/jobs.mjs';
import { buildHeroPrompt, generateSkinAssetsWithLocalCodex } from '../src/theme-assets.mjs';
import { pngHeader, sampleSpec, writePng } from './helpers.mjs';

function analysis() {
  return {
    schemaVersion: 1,
    subject: {
      kind: 'fictional-character', identity: 'Hatsune Miku', summary: 'A turquoise twin-tail virtual singer.',
      signatureTraits: ['turquoise twin tails', 'electronic hair modules', 'cyan and pink stage accents'],
    },
    visual: {
      palette: ['#39D7D9', '#111827', '#FF4F9A', '#F3F8FF'], composition: 'Subject on the right.',
      lighting: 'Cool stage light.', medium: 'Anime concert illustration.', mood: 'Futuristic and optimistic.',
      motifs: ['sound waves', 'digital particles', 'concert light rails'],
    },
    mustPreserve: ['turquoise twin-tail silhouette', 'electronic singer identity'],
    sourceRisks: ['do not copy source text'],
  };
}

test('preserves an explicitly user-supplied adult public figure identity without inferring it from pixels', () => {
  const reference = analysis();
  reference.subject = {
    kind: 'real-person',
    identity: 'unidentified real person',
    summary: 'An adult woman in a cinematic portrait.',
    signatureTraits: ['oval face', 'long dark hair', 'calm gaze'],
  };
  reference.mustPreserve = ['facial proportions from the attached reference', 'long dark hair and calm gaze'];
  const { pet, ...spec } = sampleSpec();
  spec.assets = {
    ...spec.assets,
    subject: 'Liu Yifei, explicitly named by the user as the adult public figure in the reference',
    heroPrompt: 'Create a clearly stylized fantasy workspace portrait of Liu Yifei while preserving her recognizable likeness from the attached reference.',
  };
  const prompt = buildHeroPrompt(spec, reference, 'auto', '[用户需求]\n图中的是刘亦菲，人物不要改变');
  assert.match(prompt, /Do not infer identity from pixels/);
  assert.match(prompt, /Use case: reference-guided creative portrait/);
  assert.match(prompt, /Liu Yifei/);
  assert.match(prompt, /图中的是刘亦菲，人物不要改变/);
  assert.match(prompt, /preserve that person's recognizable likeness/);
  assert.match(prompt, /face shape and proportions/);
  assert.match(prompt, /without swapping the face, anonymizing the person, blending identities/);
  assert.match(prompt, /produce exactly one final image/);
  assert.doesNotMatch(prompt, /avoiding any exact real-person likeness/);
});

test('collects local Codex hero and icon outputs into the isolated job', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-assets-'));
  const reference = path.join(root, 'reference.png');
  await writePng(reference, 1200, 800);
  const fake = path.join(root, 'fake-image-codex.js');
  await fs.writeFile(fake, `
    import fs from 'node:fs';
    import path from 'node:path';
    const countFile = process.env.FAKE_IMAGE_COUNT;
    let count = 0;
    try { count = Number(fs.readFileSync(countFile, 'utf8')); } catch {}
    const prompt = fs.readFileSync(0, 'utf8');
    if (process.env.FAKE_IMAGE_PROMPTS) fs.appendFileSync(process.env.FAKE_IMAGE_PROMPTS, JSON.stringify(prompt) + '\\n');
    const payload = count === 0 ? process.env.FAKE_HERO_PNG : process.env.FAKE_ICONS_PNG;
    const directory = path.join(process.env.CODEX_HOME, 'generated_images', 'fake-' + count);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'out.png'), Buffer.from(payload, 'base64'));
    fs.writeFileSync(countFile, String(count + 1));
    process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'image_generation' } }) + '\\n');
  `);
  process.env.CODEX_SKIN_CODEX = fake;
  process.env.CODEX_HOME = path.join(root, 'codex-home');
  process.env.CODEX_SKIN_HOME = path.join(root, 'studio-home');
  process.env.FAKE_IMAGE_COUNT = path.join(root, 'count.txt');
  process.env.FAKE_IMAGE_PROMPTS = path.join(root, 'prompts.jsonl');
  process.env.FAKE_HERO_PNG = pngHeader(1536, 1024).toString('base64');
  process.env.FAKE_ICONS_PNG = pngHeader(1024, 1024).toString('base64');
  try {
    const job = await createJob([reference], 'Miku concert workspace', 'light');
    const { pet, ...spec } = sampleSpec();
    spec.effects = { ...spec.effects, layout: 'banner' };
    const result = await generateSkinAssetsWithLocalCodex(job, spec, analysis());
    assert.equal(result.hero.width, 1536);
    assert.equal(result.icons.height, 1024);
    assert.equal((await fs.stat(result.hero.path)).isFile(), true);
    assert.equal((await fs.stat(result.icons.path)).isFile(), true);
    const prompts = (await fs.readFile(process.env.FAKE_IMAGE_PROMPTS, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.match(prompts[0], /Mandatory light mode/);
    assert.doesNotMatch(prompts[0], /dark enough for live interface copy/);
    assert.match(prompts[1], /Mandatory light mode/);
    assert.match(prompts[0], /generic lookalike or a palette-only homage/);
    assert.match(prompts[1], /produce exactly one final image/);
    assert.match(prompts[1], /attached hero only as the visual-system reference/);
  } finally {
    for (const name of ['CODEX_SKIN_CODEX', 'CODEX_HOME', 'CODEX_SKIN_HOME', 'FAKE_IMAGE_COUNT', 'FAKE_IMAGE_PROMPTS', 'FAKE_HERO_PNG', 'FAKE_ICONS_PNG']) delete process.env[name];
  }
});
