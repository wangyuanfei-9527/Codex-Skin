import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDesignSpec, validateDesignSpec } from '../src/design-spec.mjs';
import { sampleSpec } from './helpers.mjs';

test('accepts a strict design specification', () => {
  assert.equal(assertDesignSpec(sampleSpec()).name, 'Aurora Harbor');
});

test('rejects unknown fields and malformed design values', () => {
  const spec = sampleSpec({ extra: true });
  spec.palette.accent = 'blue';
  spec.pet.slug = '../otter';
  const errors = validateDesignSpec(spec);
  assert.ok(errors.some((error) => error.includes('extra')));
  assert.ok(errors.some((error) => error.includes('accent')));
  assert.ok(errors.some((error) => error.includes('slug')));
});
