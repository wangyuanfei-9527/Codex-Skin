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

test('reports prompt length and sentence-ending failures separately', () => {
  const spec = skinSpec();
  spec.assets.heroPrompt = 'x'.repeat(1051);
  spec.assets.iconPrompt = 'Create a coordinated icon atlas without a final stop';

  const errors = validateSkinSpec(spec).join('\n');
  assert.match(errors, /spec\.assets\.heroPrompt contains 1051 characters; maximum is 1050/);
  assert.match(errors, /spec\.assets\.iconPrompt must end with sentence punctuation/);
});

test('accepts sentence punctuation followed by closing quotes', () => {
  const spec = skinSpec();
  spec.assets.heroPrompt = 'Create one clean application background.\u201d';
  spec.assets.iconPrompt = 'Create one coordinated icon atlas.\u300d';

  assert.deepEqual(validateSkinSpec(spec), []);
});
