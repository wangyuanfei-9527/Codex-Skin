import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sampleSpec, writePng } from './helpers.mjs';

const run = promisify(execFile);
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(projectRoot, 'bin', 'codex-skin.mjs');

test('CLI compiles and validates a complete local bundle', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-cli-'));
  const spec = path.join(root, 'spec.json');
  const background = path.join(root, 'background.png');
  const pet = path.join(root, 'pet.png');
  const bundle = path.join(root, 'bundle');
  await fs.writeFile(spec, JSON.stringify(sampleSpec()));
  await writePng(background, 1200, 800);
  await writePng(pet, 1536, 1872);

  const compiled = await run(process.execPath, [cli, 'compile', '--spec', spec, '--image', background, '--pet-spritesheet', pet, '--output', bundle]);
  const compileResult = JSON.parse(compiled.stdout);
  assert.equal(compileResult.ready, true);
  const validated = await run(process.execPath, [cli, 'validate', bundle]);
  const validateResult = JSON.parse(validated.stdout);
  const manifest = JSON.parse(await fs.readFile(path.join(bundle, 'manifest.json'), 'utf8'));
  assert.deepEqual(validateResult, { valid: true, ready: true, id: manifest.id });
});

test('CLI compiles a skin-only bundle without pet assets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-cli-only-'));
  const spec = path.join(root, 'skin.json');
  const background = path.join(root, 'background.png');
  const bundle = path.join(root, 'bundle');
  const { pet, ...skin } = sampleSpec();
  await fs.writeFile(spec, JSON.stringify(skin));
  await writePng(background, 1200, 800);
  const compiled = await run(process.execPath, [cli, 'compile-skin', '--spec', spec, '--image', background, '--output', bundle]);
  const result = JSON.parse(compiled.stdout);
  assert.equal(result.kind, 'skin');
  const manifest = JSON.parse(await fs.readFile(path.join(bundle, 'manifest.json'), 'utf8'));
  assert.equal(manifest.pet, null);
});
