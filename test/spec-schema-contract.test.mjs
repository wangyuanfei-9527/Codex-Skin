import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const schemaFiles = [
  new URL('../schemas/skin-spec.schema.json', import.meta.url),
  new URL('../schemas/design-spec.schema.json', import.meta.url),
];

test('structured-output schemas use the runtime specification limits', async () => {
  for (const file of schemaFiles) {
    const schema = JSON.parse(await fs.readFile(file, 'utf8'));
    const copy = schema.properties.copy.properties;
    const assets = schema.properties.assets.properties;

    assert.equal(copy.cardSubtitles.items.maxLength, 36);
    assert.equal(copy.signature.maxLength, 26);
    assert.equal(assets.subject.maxLength, 100);
    assert.equal(assets.motifs.items.maxLength, 40);
    assert.equal(assets.heroPrompt.maxLength, 1050);
    assert.equal(assets.iconPrompt.maxLength, 650);
    assert.equal(assets.heroPrompt.pattern, assets.iconPrompt.pattern);
    assert.match('Create a complete prompt.\u201d', new RegExp(assets.heroPrompt.pattern, 'u'));
    assert.doesNotMatch('Create an unfinished prompt', new RegExp(assets.heroPrompt.pattern, 'u'));
  }

  const design = JSON.parse(await fs.readFile(schemaFiles[1], 'utf8'));
  assert.equal(design.properties.pet.properties.slug.maxLength, 48);
  assert.equal(design.properties.pet.properties.concept.maxLength, 300);
});
