const COLOR = /^#[0-9a-fA-F]{6}$/;
const PALETTE_KEYS = ['background', 'surface', 'surfaceAlt', 'text', 'mutedText', 'accent', 'accentAlt', 'border'];
const POSITION = new Set(['center', 'top', 'bottom', 'left', 'right']);
const LAYOUT = new Set(['banner', 'fullscreen']);

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

function completeSentence(value) {
  return typeof value === 'string' && /[.!?。！？]$/.test(value.trim());
}

export function validateSkinSpec(spec) {
  const errors = [];
  const rootKeys = ['schemaVersion', 'name', 'summary', 'sourceImageIndex', 'palette', 'effects', 'copy', 'assets'];
  if (!exactKeys(spec, rootKeys, 'spec', errors)) return errors;
  if (spec.schemaVersion !== 1) errors.push('spec.schemaVersion must be 1');
  if (!text(spec.name, 80)) errors.push('spec.name must contain 1-80 characters');
  if (!text(spec.summary, 300)) errors.push('spec.summary must contain 1-300 characters');
  if (!Number.isInteger(spec.sourceImageIndex) || spec.sourceImageIndex < 0 || spec.sourceImageIndex > 31) {
    errors.push('spec.sourceImageIndex must be an integer from 0 to 31');
  }
  if (exactKeys(spec.palette, PALETTE_KEYS, 'spec.palette', errors)) {
    for (const key of PALETTE_KEYS) if (!COLOR.test(spec.palette[key] ?? '')) errors.push(`spec.palette.${key} must be #RRGGBB`);
  }
  const effectKeys = ['blur', 'surfaceOpacity', 'radius', 'overlayOpacity', 'backgroundPosition', 'focalX', 'focalY', 'layout'];
  if (exactKeys(spec.effects, effectKeys, 'spec.effects', errors)) {
    if (!Number.isInteger(spec.effects.blur) || spec.effects.blur < 0 || spec.effects.blur > 40) errors.push('spec.effects.blur must be 0-40');
    if (typeof spec.effects.surfaceOpacity !== 'number' || spec.effects.surfaceOpacity < 0.35 || spec.effects.surfaceOpacity > 1) errors.push('spec.effects.surfaceOpacity must be 0.35-1');
    if (!Number.isInteger(spec.effects.radius) || spec.effects.radius < 0 || spec.effects.radius > 32) errors.push('spec.effects.radius must be 0-32');
    if (typeof spec.effects.overlayOpacity !== 'number' || spec.effects.overlayOpacity < 0 || spec.effects.overlayOpacity > 0.8) errors.push('spec.effects.overlayOpacity must be 0-0.8');
    if (!POSITION.has(spec.effects.backgroundPosition)) errors.push('spec.effects.backgroundPosition is invalid');
    if (!Number.isInteger(spec.effects.focalX) || spec.effects.focalX < 0 || spec.effects.focalX > 100) errors.push('spec.effects.focalX must be 0-100');
    if (!Number.isInteger(spec.effects.focalY) || spec.effects.focalY < 0 || spec.effects.focalY > 100) errors.push('spec.effects.focalY must be 0-100');
    if (!LAYOUT.has(spec.effects.layout)) errors.push('spec.effects.layout is invalid');
  }
  const copyKeys = ['heroTitle', 'heroSubtitle', 'projectLabel', 'composerPlaceholder', 'cardSubtitles', 'signature'];
  if (exactKeys(spec.copy, copyKeys, 'spec.copy', errors)) {
    if (!text(spec.copy.heroTitle, 70)) errors.push('spec.copy.heroTitle must contain 1-70 characters');
    if (!text(spec.copy.heroSubtitle, 90)) errors.push('spec.copy.heroSubtitle must contain 1-90 characters');
    if (!text(spec.copy.projectLabel, 24)) errors.push('spec.copy.projectLabel must contain 1-24 characters');
    if (!text(spec.copy.composerPlaceholder, 60)) errors.push('spec.copy.composerPlaceholder must contain 1-60 characters');
    if (!Array.isArray(spec.copy.cardSubtitles) || spec.copy.cardSubtitles.length !== 4) {
      errors.push('spec.copy.cardSubtitles must contain exactly 4 strings');
    } else {
      for (const [index, value] of spec.copy.cardSubtitles.entries()) if (!text(value, 36)) errors.push(`spec.copy.cardSubtitles[${index}] must contain 1-36 characters`);
    }
    if (!text(spec.copy.signature, 26)) errors.push('spec.copy.signature must contain 1-26 characters');
  }
  const assetKeys = ['subject', 'motifs', 'heroPrompt', 'iconPrompt'];
  if (exactKeys(spec.assets, assetKeys, 'spec.assets', errors)) {
    if (!text(spec.assets.subject, 100)) errors.push('spec.assets.subject must contain 1-100 characters');
    if (!Array.isArray(spec.assets.motifs) || spec.assets.motifs.length < 3 || spec.assets.motifs.length > 4) {
      errors.push('spec.assets.motifs must contain 3-4 strings');
    } else {
      for (const [index, value] of spec.assets.motifs.entries()) if (!text(value, 40)) errors.push(`spec.assets.motifs[${index}] must contain 1-40 characters`);
    }
    if (!text(spec.assets.heroPrompt, 1050) || !completeSentence(spec.assets.heroPrompt)) errors.push('spec.assets.heroPrompt must be a complete sentence within 1050 characters');
    if (!text(spec.assets.iconPrompt, 650) || !completeSentence(spec.assets.iconPrompt)) errors.push('spec.assets.iconPrompt must be a complete sentence within 650 characters');
  }
  return errors;
}

export function assertSkinSpec(spec) {
  const errors = validateSkinSpec(spec);
  if (errors.length) throw new Error(`Invalid skin specification:\n- ${errors.join('\n- ')}`);
  return spec;
}
