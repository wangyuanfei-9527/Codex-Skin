import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validatePetSpritesheet } from '../src/image-info.mjs';
import { writePng } from './helpers.mjs';

test('accepts the Codex transparent pet dimensions', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-image-'));
  const image = path.join(directory, 'pet.png');
  await writePng(image, 1536, 1872);
  const info = await validatePetSpritesheet(image);
  assert.deepEqual({ width: info.width, height: info.height, transparent: info.transparent }, { width: 1536, height: 1872, transparent: true });
});

test('rejects wrong dimensions and images without transparency metadata', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'skin-image-'));
  const image = path.join(directory, 'pet.png');
  await writePng(image, 100, 100, 2);
  await assert.rejects(validatePetSpritesheet(image), /1536x1872[\s\S]*alpha channel/);
});
