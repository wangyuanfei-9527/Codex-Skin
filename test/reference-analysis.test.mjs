import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReferenceAnalysis } from '../src/reference-analysis.mjs';

function sample() {
  return {
    schemaVersion: 1,
    subject: {
      kind: 'fictional-character',
      identity: 'Hatsune Miku',
      summary: 'A turquoise twin-tail virtual singer presented through several concert illustrations.',
      signatureTraits: ['turquoise twin tails', 'black electronic hair modules', 'cyan and pink stage accents'],
    },
    visual: {
      palette: ['#39D7D9', '#111827', '#FF4F9A', '#F3F8FF'],
      composition: 'Wide character composition with the subject on the right and open space on the left.',
      lighting: 'Cool cyan stage light with restrained pink highlights.',
      medium: 'Polished anime concert illustration.',
      mood: 'Energetic, futuristic, optimistic.',
      motifs: ['sound waves', 'digital particles', 'concert light rails'],
    },
    mustPreserve: ['recognizable turquoise twin-tail silhouette', 'electronic singer stage identity'],
    sourceRisks: ['source text must not be copied into generated art'],
  };
}

test('accepts a structured reference extraction', () => {
  assert.deepEqual(validateReferenceAnalysis(sample()), []);
});

test('rejects missing signature traits and unknown fields', () => {
  const value = sample();
  value.subject.signatureTraits = [];
  value.extra = true;
  assert.ok(validateReferenceAnalysis(value).length >= 2);
});
