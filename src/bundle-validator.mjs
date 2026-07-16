import fs from 'node:fs/promises';
import path from 'node:path';
import { BUNDLE_SCHEMA_VERSION } from './constants.mjs';
import { assertDesignSpec } from './design-spec.mjs';
import { assertSkinSpec } from './skin-spec.mjs';
import { readJson, resolveInside, sha256 } from './io.mjs';
import { inspectImage, validatePetSpritesheet } from './image-info.mjs';

function requiredString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty string`);
  return value;
}

async function checkHash(filePath, expected, label) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? '')) throw new Error(`${label} has an invalid SHA-256`);
  const actual = await sha256(filePath);
  if (actual !== expected) throw new Error(`${label} hash does not match the manifest`);
}

async function bundleFile(root, relativePath, label) {
  const filePath = resolveInside(root, requiredString(relativePath, label));
  const stat = await fs.lstat(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a regular file`);
  const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(filePath)]);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error(`${label} resolves outside the bundle root`);
  return filePath;
}

function normalizeLegacySpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec;
  const cjk = /[\u3400-\u9fff]/.test(`${spec.name || ''}${spec.summary || ''}`);
  const defaults = cjk ? {
    projectLabel: '选择项目',
    composerPlaceholder: '写下你的下一步想法…',
    cardTitles: ['探索代码', '构建功能', '审查改动', '修复问题'],
    cardSubtitles: ['理解项目结构', '把想法变成实现', '检查质量与边界', '定位根因并修复'],
    profileBadge: '主题',
    signature: '主题工作室',
  } : {
    projectLabel: 'Choose a project',
    composerPlaceholder: 'Describe your next step…',
    cardTitles: ['Explore code', 'Build feature', 'Review changes', 'Repair issue'],
    cardSubtitles: ['Understand the structure', 'Turn intent into code', 'Check quality and edges', 'Find and repair the cause'],
    profileBadge: 'THEME',
    signature: 'Theme Studio',
  };
  const summary = typeof spec.summary === 'string' && spec.summary.length <= 90 ? spec.summary : (cjk ? '让主题陪你专注完成下一段代码。' : 'A focused workspace shaped by your theme.');
  return {
    ...spec,
    effects: { focalX: 50, focalY: 50, ...(spec.effects || {}) },
    copy: {
      heroTitle: String(spec.name || (cjk ? '主题工作室' : 'Theme Studio')).slice(0, 70),
      heroSubtitle: summary,
      ...defaults,
      ...(spec.copy || {}),
    },
  };
}

export async function validateBundle(bundleDirectory, { requireReady = false } = {}) {
  const root = path.resolve(bundleDirectory);
  const manifestPath = await bundleFile(root, 'manifest.json', 'manifest');
  const manifest = await readJson(manifestPath);
  if (manifest.schemaVersion !== BUNDLE_SCHEMA_VERSION) throw new Error(`Unsupported bundle schema: ${manifest.schemaVersion}`);
  requiredString(manifest.id, 'manifest.id');
  requiredString(manifest.name, 'manifest.name');
  const kind = manifest.kind || 'skin-pet';
  if (!['skin', 'skin-pet'].includes(kind)) throw new Error(`Unsupported bundle kind: ${kind}`);
  const designPath = await bundleFile(root, manifest.design, 'manifest.design');
  const cssPath = await bundleFile(root, manifest.theme?.css, 'manifest.theme.css');
  const backgroundPath = await bundleFile(root, manifest.theme?.background, 'manifest.theme.background');
  const design = normalizeLegacySpec(await readJson(designPath));
  if (kind === 'skin') assertSkinSpec(design);
  else assertDesignSpec(design);
  await checkHash(backgroundPath, manifest.theme.backgroundSha256, 'Background');
  let iconsPath = null;
  if (manifest.theme?.icons) {
    iconsPath = await bundleFile(root, manifest.theme.icons.path, 'manifest.theme.icons.path');
    await checkHash(iconsPath, manifest.theme.icons.sha256, 'Icon atlas');
    const iconInfo = await inspectImage(iconsPath);
    if (iconInfo.width !== manifest.theme.icons.width || iconInfo.height !== manifest.theme.icons.height) throw new Error('Icon atlas dimensions do not match the manifest');
  }

  let pet = null;
  if (manifest.pet) {
    const metadataPath = await bundleFile(root, manifest.pet.metadata, 'manifest.pet.metadata');
    const spritesheetPath = await bundleFile(root, manifest.pet.spritesheet, 'manifest.pet.spritesheet');
    const metadata = await readJson(metadataPath);
    if (metadata.id !== manifest.pet.slug || metadata.displayName !== manifest.pet.name) throw new Error('Pet metadata does not match the manifest');
    if (metadata.spritesheetPath !== path.basename(spritesheetPath)) throw new Error('Pet metadata points to a different spritesheet');
    await checkHash(metadataPath, manifest.pet.metadataSha256, 'Pet metadata');
    await validatePetSpritesheet(spritesheetPath);
    await checkHash(spritesheetPath, manifest.pet.sha256, 'Pet spritesheet');
    pet = { metadataPath, spritesheetPath, metadata };
  }
  if (kind === 'skin' && manifest.pet) throw new Error('Skin-only bundles cannot contain a pet');
  if (kind === 'skin-pet' && manifest.ready !== Boolean(manifest.pet)) throw new Error('manifest.ready does not match pet availability');
  if (kind === 'skin' && manifest.ready !== true) throw new Error('Skin-only bundle must be ready');
  if (requireReady && !manifest.ready) throw new Error('Bundle is incomplete and cannot be applied');
  return { root, kind, manifest, design, designPath, cssPath, backgroundPath, iconsPath, pet };
}
