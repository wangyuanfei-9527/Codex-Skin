import fs from 'node:fs/promises';
import path from 'node:path';
import { validateBundle } from './bundle-validator.mjs';
import { validatePetSpritesheet } from './image-info.mjs';
import { copyFileAtomic, sha256, writeFileAtomic, writeJsonAtomic } from './io.mjs';

export async function replaceBundlePetSpritesheet(bundleDirectory, replacementPath) {
  const checked = await validateBundle(bundleDirectory, { requireReady: true });
  const replacement = path.resolve(replacementPath);
  const replacementInfo = await validatePetSpritesheet(replacement);
  if (replacementInfo.format !== 'png') throw new Error('Source-derived desktop pets must be PNG atlases');
  if (path.extname(checked.pet.spritesheetPath).toLowerCase() !== '.png') {
    throw new Error('The existing bundle pet must use a PNG atlas before replacement');
  }

  const manifestPath = path.join(checked.root, 'manifest.json');
  const previousManifest = await fs.readFile(manifestPath);
  const previousSpritesheet = await fs.readFile(checked.pet.spritesheetPath);
  try {
    await copyFileAtomic(replacement, checked.pet.spritesheetPath);
    checked.manifest.pet.sha256 = await sha256(checked.pet.spritesheetPath);
    checked.manifest.pet.width = replacementInfo.width;
    checked.manifest.pet.height = replacementInfo.height;
    checked.manifest.pet.format = replacementInfo.format;
    checked.manifest.pet.generated = false;
    checked.manifest.pet.archetype = 'reference-sticker';
    checked.manifest.pet.sourceDerived = true;
    await writeJsonAtomic(manifestPath, checked.manifest);
    return await validateBundle(checked.root, { requireReady: true });
  } catch (error) {
    await writeFileAtomic(checked.pet.spritesheetPath, previousSpritesheet).catch(() => {});
    await writeFileAtomic(manifestPath, previousManifest).catch(() => {});
    throw error;
  }
}
