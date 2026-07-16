import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeSkinWithLocalCodex, analyzeWithLocalCodex } from '../src/codex-runtime.mjs';
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
    const payload = schema.includes('reference-analysis') ? process.env.FAKE_CODEX_REFERENCE : process.env.FAKE_CODEX_SPEC;
    if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], payload);
    if (process.env.FAKE_CODEX_ARGS) fs.writeFileSync(process.env.FAKE_CODEX_ARGS, JSON.stringify(args));
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
  for (const name of ['CODEX_SKIN_CODEX', 'CODEX_SKIN_HOME', 'FAKE_CODEX_SPEC', 'FAKE_CODEX_REFERENCE', 'FAKE_CODEX_EVENT', 'FAKE_CODEX_ARGS', 'FAKE_CODEX_EXIT']) delete process.env[name];
}

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
