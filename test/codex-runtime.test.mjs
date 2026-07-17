import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeSkinWithLocalCodex, analyzeWithLocalCodex, planSkinWithLocalCodex, resolveCodexCommand } from '../src/codex-runtime.mjs';
import { createJob } from '../src/jobs.mjs';
import { sampleSpec, writePng } from './helpers.mjs';

async function fakeCodex(root, event) {
  const script = path.join(root, 'fake-codex.js');
  await fs.writeFile(script, `
    import fs from 'node:fs';
    const args = process.argv.slice(2);
    const outputIndex = args.indexOf('--output-last-message');
    const schemaIndex = args.indexOf('--output-schema');
    const schema = schemaIndex >= 0 ? args[schemaIndex + 1] : '';
    let payload = schema.includes('reference-analysis') ? process.env.FAKE_CODEX_REFERENCE : process.env.FAKE_CODEX_SPEC;
    if (!schema.includes('reference-analysis') && process.env.FAKE_CODEX_SPEC_SEQUENCE) {
      const sequence = JSON.parse(process.env.FAKE_CODEX_SPEC_SEQUENCE);
      const callsFile = process.env.FAKE_CODEX_CALLS;
      const call = callsFile && fs.existsSync(callsFile) ? Number(fs.readFileSync(callsFile, 'utf8')) : 0;
      payload = sequence[Math.min(call, sequence.length - 1)];
      if (callsFile) fs.writeFileSync(callsFile, String(call + 1));
    }
    const prompt = fs.readFileSync(0, 'utf8');
    if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], payload);
    if (process.env.FAKE_CODEX_ARGS) fs.writeFileSync(process.env.FAKE_CODEX_ARGS, JSON.stringify(args));
    if (process.env.FAKE_CODEX_PROMPTS) fs.appendFileSync(process.env.FAKE_CODEX_PROMPTS, JSON.stringify(prompt) + '\\n');
    process.stdout.write(process.env.FAKE_CODEX_EVENT + '\\n');
    process.exitCode = Number(process.env.FAKE_CODEX_EXIT || 0);
  `);
  process.env.CODEX_SKIN_CODEX = script;
  process.env.FAKE_CODEX_SPEC = JSON.stringify(sampleSpec());
  process.env.FAKE_CODEX_REFERENCE = JSON.stringify({
    schemaVersion: 1,
    subject: {
      kind: 'fictional-character', identity: 'Hatsune Miku',
      summary: 'A turquoise twin-tail virtual singer.',
      signatureTraits: ['turquoise twin tails', 'electronic hair modules', 'cyan and pink accents'],
    },
    visual: {
      palette: ['#39D7D9', '#111827', '#FF4F9A', '#F3F8FF'],
      composition: 'Subject on the right with open space on the left.',
      lighting: 'Cool stage light.', medium: 'Anime concert illustration.', mood: 'Futuristic and optimistic.',
      motifs: ['sound waves', 'digital particles', 'concert light rails'],
    },
    mustPreserve: ['turquoise twin-tail silhouette', 'electronic singer identity'],
    sourceRisks: ['do not copy embedded source text'],
  });
  process.env.FAKE_CODEX_EVENT = JSON.stringify(event);
  return script;
}

function clearEnvironment() {
  for (const name of ['CODEX_SKIN_CODEX', 'CODEX_SKIN_HOME', 'FAKE_CODEX_SPEC', 'FAKE_CODEX_SPEC_SEQUENCE', 'FAKE_CODEX_REFERENCE', 'FAKE_CODEX_EVENT', 'FAKE_CODEX_ARGS', 'FAKE_CODEX_PROMPTS', 'FAKE_CODEX_CALLS', 'FAKE_CODEX_EXIT']) delete process.env[name];
}

test('classifies an invalid configured Codex CLI path', { concurrency: false }, async () => {
  process.env.CODEX_SKIN_CODEX = path.join(os.tmpdir(), `missing-codex-${Date.now()}.cmd`);
  try {
    await assert.rejects(resolveCodexCommand(), (error) => {
      assert.equal(error.code, 'CODEX_CLI_CONFIG_INVALID');
      return true;
    });
  } finally {
    clearEnvironment();
  }
});

test('runs the configured local Codex in the isolated job with privacy flags', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-codex-'));
  const image = path.join(root, 'reference.png');
  const argsFile = path.join(root, 'args.json');
  await writePng(image, 1200, 800);
  process.env.CODEX_SKIN_HOME = path.join(root, 'home');
  process.env.FAKE_CODEX_ARGS = argsFile;
  await fakeCodex(root, { type: 'item.completed', item: { type: 'agent_message' } });
  try {
    const job = await createJob([image], 'Calm blue-violet skin');
    const result = await analyzeWithLocalCodex(job);
    assert.equal(result.spec.pet.slug, 'ripple-otter');
    const args = JSON.parse(await fs.readFile(argsFile, 'utf8'));
    for (const required of ['--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--json']) assert.ok(args.includes(required));
    assert.equal(args.includes(image), false);
    assert.ok(args.includes(job.images[0]));
  } finally {
    clearEnvironment();
  }
});

test('stops local Codex when a command tool event is observed', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-codex-'));
  const image = path.join(root, 'reference.png');
  await writePng(image, 1200, 800);
  process.env.CODEX_SKIN_HOME = path.join(root, 'home');
  await fakeCodex(root, { type: 'item.completed', item: { type: 'command_execution' } });
  try {
    const job = await createJob([image], 'Calm blue-violet skin');
    await assert.rejects(analyzeWithLocalCodex(job), /forbidden external tool call/);
  } finally {
    clearEnvironment();
  }
});

test('reports the structured Codex error instead of a generic stdin status', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-codex-'));
  const image = path.join(root, 'reference.png');
  await writePng(image, 1200, 800);
  process.env.CODEX_SKIN_HOME = path.join(root, 'home');
  process.env.FAKE_CODEX_EXIT = '1';
  await fakeCodex(root, {
    type: 'turn.failed',
    error: { message: JSON.stringify({ error: { message: 'Schema needs an explicit type.' } }) },
  });
  try {
    const job = await createJob([image], 'Calm blue-violet skin');
    await assert.rejects(analyzeWithLocalCodex(job), /Schema needs an explicit type/);
  } finally {
    clearEnvironment();
  }
});

test('skin analysis uses the skin-only schema and returns no pet design', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-codex-'));
  const image = path.join(root, 'reference.png');
  await writePng(image, 1200, 800);
  process.env.CODEX_SKIN_HOME = path.join(root, 'home');
  await fakeCodex(root, { type: 'item.completed', item: { type: 'agent_message' } });
  const { pet, ...skin } = sampleSpec();
  process.env.FAKE_CODEX_SPEC = JSON.stringify(skin);
  try {
    const job = await createJob([image], 'Crisp cyan music workspace');
    const result = await analyzeSkinWithLocalCodex(job);
    assert.equal('pet' in result.spec, false);
    assert.match(result.specPath, /skin-spec\.json$/);
    assert.equal(result.referenceAnalysis.subject.identity, 'Hatsune Miku');
    assert.match(result.referenceAnalysisPath, /reference-analysis\.json$/);
  } finally {
    clearEnvironment();
  }
});

test('persists auto, light, and dark preferences and constrains skin planning', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-color-mode-'));
  const image = path.join(root, 'reference.png');
  const promptsFile = path.join(root, 'prompts.jsonl');
  await writePng(image, 1200, 800);
  process.env.CODEX_SKIN_HOME = path.join(root, 'home');
  process.env.FAKE_CODEX_PROMPTS = promptsFile;
  await fakeCodex(root, { type: 'item.completed', item: { type: 'agent_message' } });
  const { pet, ...skin } = sampleSpec();
  const reference = JSON.parse(process.env.FAKE_CODEX_REFERENCE);
  try {
    for (const mode of ['auto', 'light', 'dark']) {
      const planned = mode === 'light' ? {
        ...skin,
        palette: {
          background: '#F4F8FC', surface: '#FFFFFF', surfaceAlt: '#E8F0F7', text: '#172033',
          mutedText: '#4D5D73', accent: '#247C88', accentAlt: '#B33A76', border: '#AFC0D0',
        },
      } : skin;
      process.env.FAKE_CODEX_SPEC = JSON.stringify(planned);
      const job = await createJob([image], `${mode} workspace`, mode);
      assert.equal(job.colorMode, mode);
      assert.equal(JSON.parse(await fs.readFile(path.join(job.directory, 'job.json'), 'utf8')).colorMode, mode);
      await planSkinWithLocalCodex(job, reference);
    }

    const prompts = (await fs.readFile(promptsFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.match(prompts[0], /Color mode: AUTO/);
    assert.match(prompts[0], /do not assume a coding workspace must be dark/);
    assert.match(prompts[1], /Mandatory color mode: LIGHT/);
    assert.match(prompts[1], /high-luminance background, surface, and surfaceAlt colors/);
    assert.match(prompts[2], /Mandatory color mode: DARK/);
    assert.match(prompts[2], /deep background, surface, and surfaceAlt colors/);
    assert.match(prompts[0], /explicitly names an adult public figure/);
    assert.match(prompts[0], /Do not swap the face, anonymize the person/);
    assert.match(prompts[0], /do not propagate extraction-only cautions/);
    assert.match(prompts[0], /\[内置生成契约\]/);
    assert.match(prompts[0], /cannot change asset count, dimensions, atlas layout/);
    assert.match(prompts[0], /exactly one clean 16:10 application background/);
    assert.match(prompts[0], /exactly one square 2x2 atlas/);
    assert.match(prompts[0], /Use fullscreen by default/);
    assert.match(prompts[0], /Do not choose banner merely because the reference is a portrait/);

    process.env.FAKE_CODEX_SPEC = JSON.stringify(skin);
    const mismatched = await createJob([image], 'Requested light workspace', 'light');
    await assert.rejects(planSkinWithLocalCodex(mismatched, reference), /does not satisfy light color mode/i);
    await assert.rejects(createJob([image], 'Sepia workspace', 'sepia'), /color mode/i);
  } finally {
    clearEnvironment();
  }
});

test('replans once when application validation rejects structured output', { concurrency: false }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-repair-'));
  const image = path.join(root, 'reference.png');
  const callsFile = path.join(root, 'calls.txt');
  const promptsFile = path.join(root, 'prompts.jsonl');
  await writePng(image, 1200, 800);
  process.env.CODEX_SKIN_HOME = path.join(root, 'home');
  process.env.FAKE_CODEX_CALLS = callsFile;
  process.env.FAKE_CODEX_PROMPTS = promptsFile;
  await fakeCodex(root, { type: 'item.completed', item: { type: 'agent_message' } });
  const { pet, ...valid } = sampleSpec();
  const invalid = structuredClone(valid);
  invalid.assets.heroPrompt = 'x'.repeat(1051);
  process.env.FAKE_CODEX_SPEC_SEQUENCE = JSON.stringify([JSON.stringify(invalid), JSON.stringify(valid)]);
  const reference = JSON.parse(process.env.FAKE_CODEX_REFERENCE);

  try {
    const job = await createJob([image], 'Repair an overlong asset prompt');
    const result = await planSkinWithLocalCodex(job, reference);

    assert.equal(result.spec.assets.heroPrompt, valid.assets.heroPrompt);
    assert.equal(await fs.readFile(callsFile, 'utf8'), '2');
    assert.equal(JSON.parse(await fs.readFile(path.join(job.directory, 'skin-spec.invalid.json'), 'utf8')).assets.heroPrompt.length, 1051);
    const prompts = (await fs.readFile(promptsFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /correction attempt/i);
    assert.match(prompts[1], /contains 1051 characters; maximum is 1050/);
  } finally {
    clearEnvironment();
  }
});
