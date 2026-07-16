import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSkinSpec } from '../src/skin-spec.mjs';
import { sampleSpec } from './helpers.mjs';

function skinSpec() {
  const { pet, ...skin } = sampleSpec();
  return skin;
}

test('accepts a strict skin-only specification', () => {
  assert.deepEqual(validateSkinSpec(skinSpec()), []);
});

test('skin-only specifications reject pet fields', () => {
  assert.match(validateSkinSpec(sampleSpec()).join('\n'), /spec.pet is not allowed/);
});

test('requires four card titles and a bounded profile badge', () => {
  const spec = skinSpec();
  spec.copy.cardTitles = ['Only one'];
  spec.copy.profileBadge = 'TOO-LONG-BADGE';
  const errors = validateSkinSpec(spec).join('\n');
  assert.match(errors, /cardTitles/);
  assert.match(errors, /profileBadge/);
});
