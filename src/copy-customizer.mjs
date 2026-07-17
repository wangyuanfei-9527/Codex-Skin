import path from 'node:path';
import { validateBundle } from './bundle-validator.mjs';
import { readJson } from './io.mjs';
import { assertSkinSpec } from './skin-spec.mjs';
import { compileBundle } from './theme-compiler.mjs';

const ROOT_KEYS = new Set(['name', 'summary', 'copy']);
const COPY_KEYS = new Set(['heroTitle', 'heroSubtitle', 'signature', 'cardTitles', 'cardSubtitles']);

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeCopyOverrides(spec, overrides) {
  if (!object(overrides)) throw new Error('Copy overrides must be a JSON object');
  const unknownRootKeys = Object.keys(overrides).filter((key) => !ROOT_KEYS.has(key));
  if (unknownRootKeys.length) throw new Error(`Copy override field is not allowed: ${unknownRootKeys.join(', ')}`);

  let copyOverrides = {};
  if ('copy' in overrides) {
    if (!object(overrides.copy)) throw new Error('Copy overrides.copy must be a JSON object');
    const unknownCopyKeys = Object.keys(overrides.copy).filter((key) => !COPY_KEYS.has(key));
    if (unknownCopyKeys.length) throw new Error(`Copy override field is not allowed: copy.${unknownCopyKeys.join(', copy.')}`);
    copyOverrides = overrides.copy;
  }
  if (!('name' in overrides) && !('summary' in overrides) && Object.keys(copyOverrides).length === 0) {
    throw new Error('Copy overrides must contain at least one supported field');
  }

  return assertSkinSpec({
    ...spec,
    ...('name' in overrides ? { name: overrides.name } : {}),
    ...('summary' in overrides ? { summary: overrides.summary } : {}),
    copy: { ...spec.copy, ...copyOverrides },
  });
}

export async function customizeBundleCopy({ bundleDirectory, copyFile, outputDirectory }) {
  const checked = await validateBundle(bundleDirectory, { requireReady: true });
  if (checked.kind !== 'skin') throw new Error('Copy customization accepts only skin-only bundles');
  const overrides = await readJson(path.resolve(copyFile));
  const spec = mergeCopyOverrides(checked.design, overrides);
  const images = Array.from({ length: spec.sourceImageIndex + 1 }, () => checked.backgroundPath);
  return compileBundle({
    spec,
    images,
    backgroundImage: checked.backgroundPath,
    iconSheet: checked.iconsPath,
    outputDirectory,
    skinOnly: true,
  });
}
