const COLOR = /^#[0-9a-fA-F]{6}$/;
const KINDS = new Set(['fictional-character', 'real-person', 'object', 'scene', 'mixed']);

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label, errors) {
  if (!object(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const expected = new Set(keys);
  for (const key of keys) if (!(key in value)) errors.push(`${label}.${key} is required`);
  for (const key of Object.keys(value)) if (!expected.has(key)) errors.push(`${label}.${key} is not allowed`);
  return true;
}

function text(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function textArray(value, minimum, maximum, itemMaximum, label, errors) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    errors.push(`${label} must contain ${minimum}-${maximum} strings`);
    return;
  }
  for (const [index, item] of value.entries()) if (!text(item, itemMaximum)) errors.push(`${label}[${index}] must contain 1-${itemMaximum} characters`);
}

export function validateReferenceAnalysis(value) {
  const errors = [];
  if (!exactKeys(value, ['schemaVersion', 'subject', 'visual', 'mustPreserve', 'sourceRisks'], 'analysis', errors)) return errors;
  if (value.schemaVersion !== 1) errors.push('analysis.schemaVersion must be 1');
  if (exactKeys(value.subject, ['kind', 'identity', 'summary', 'signatureTraits'], 'analysis.subject', errors)) {
    if (!KINDS.has(value.subject.kind)) errors.push('analysis.subject.kind is invalid');
    if (!text(value.subject.identity, 120)) errors.push('analysis.subject.identity must contain 1-120 characters');
    if (!text(value.subject.summary, 400)) errors.push('analysis.subject.summary must contain 1-400 characters');
    textArray(value.subject.signatureTraits, 3, 8, 100, 'analysis.subject.signatureTraits', errors);
  }
  if (exactKeys(value.visual, ['palette', 'composition', 'lighting', 'medium', 'mood', 'motifs'], 'analysis.visual', errors)) {
    if (!Array.isArray(value.visual.palette) || value.visual.palette.length < 4 || value.visual.palette.length > 8) {
      errors.push('analysis.visual.palette must contain 4-8 colors');
    } else {
      for (const [index, color] of value.visual.palette.entries()) if (!COLOR.test(color ?? '')) errors.push(`analysis.visual.palette[${index}] must be #RRGGBB`);
    }
    if (!text(value.visual.composition, 300)) errors.push('analysis.visual.composition must contain 1-300 characters');
    if (!text(value.visual.lighting, 220)) errors.push('analysis.visual.lighting must contain 1-220 characters');
    if (!text(value.visual.medium, 160)) errors.push('analysis.visual.medium must contain 1-160 characters');
    if (!text(value.visual.mood, 220)) errors.push('analysis.visual.mood must contain 1-220 characters');
    textArray(value.visual.motifs, 3, 8, 80, 'analysis.visual.motifs', errors);
  }
  textArray(value.mustPreserve, 2, 10, 120, 'analysis.mustPreserve', errors);
  textArray(value.sourceRisks, 1, 8, 120, 'analysis.sourceRisks', errors);
  return errors;
}

export function assertReferenceAnalysis(value) {
  const errors = validateReferenceAnalysis(value);
  if (errors.length) throw new Error(`Invalid reference analysis:\n- ${errors.join('\n- ')}`);
  return value;
}
