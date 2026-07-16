import fs from 'node:fs/promises';
import path from 'node:path';
import { codexHome, paths } from './constants.mjs';
import { validateBundle } from './bundle-validator.mjs';
import { copyFileAtomic, ensureDir, exists, readJson, sha256, writeJsonAtomic } from './io.mjs';

async function copyBundle(source, target) {
  await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false });
}

async function ownedPetDirectory(state, petDirectory) {
  if (!state?.pet || path.resolve(state.pet.directory) !== path.resolve(petDirectory)) return false;
  const petsRoot = path.resolve(codexHome(), 'pets');
  const resolvedDirectory = path.resolve(petDirectory);
  if (path.dirname(resolvedDirectory) !== petsRoot || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path.basename(resolvedDirectory))) return false;
  if (!['spritesheet.png', 'spritesheet.webp'].includes(state.pet.spritesheetName) || path.basename(state.pet.spritesheetName) !== state.pet.spritesheetName) return false;
  const spritePath = path.join(petDirectory, state.pet.spritesheetName);
  const metadataPath = path.join(petDirectory, 'pet.json');
  if (!await exists(spritePath) || !await exists(metadataPath)) return false;
  const entries = (await fs.readdir(petDirectory)).sort();
  if (entries.length !== 2 || entries[0] !== 'pet.json' || entries[1] !== state.pet.spritesheetName) return false;
  return await sha256(spritePath) === state.pet.sha256 && await sha256(metadataPath) === state.pet.metadataSha256;
}

async function applySkinOnlyBundle(checked) {
  const locations = paths();
  await ensureDir(locations.root);
  const oldState = await exists(locations.state) ? await readJson(locations.state) : null;
  const stagedActive = `${locations.active}.stage.${process.pid}`;
  const activeBackup = `${locations.active}.previous.${process.pid}`;
  await fs.rm(stagedActive, { recursive: true, force: true });
  await fs.rm(activeBackup, { recursive: true, force: true });
  await copyBundle(checked.root, stagedActive);
  let movedOldActive = false;
  try {
    if (await exists(locations.active)) {
      await fs.rename(locations.active, activeBackup);
      movedOldActive = true;
    }
    await fs.rename(stagedActive, locations.active);
    const state = {
      schemaVersion: 2,
      kind: 'skin',
      bundleId: checked.manifest.id,
      appliedAt: new Date().toISOString(),
      ...(oldState?.pet ? { pet: oldState.pet } : {}),
    };
    await writeJsonAtomic(locations.state, state);
    if (movedOldActive) await fs.rm(activeBackup, { recursive: true, force: true });
    return { state, activeDirectory: locations.active };
  } catch (error) {
    await fs.rm(stagedActive, { recursive: true, force: true });
    await fs.rm(locations.active, { recursive: true, force: true });
    if (movedOldActive && await exists(activeBackup)) await fs.rename(activeBackup, locations.active);
    if (oldState) await writeJsonAtomic(locations.state, oldState).catch(() => {});
    else await fs.rm(locations.state, { force: true }).catch(() => {});
    throw error;
  }
}

export async function applyBundle(bundleDirectory) {
  const checked = await validateBundle(bundleDirectory, { requireReady: true });
  if (checked.kind === 'skin') return applySkinOnlyBundle(checked);
  const locations = paths();
  await ensureDir(locations.root);
  const oldState = await exists(locations.state) ? await readJson(locations.state) : null;
  const petDirectory = path.join(codexHome(), 'pets', checked.manifest.pet.slug);
  if (await exists(petDirectory) && !await ownedPetDirectory(oldState, petDirectory)) {
    throw new Error(`Refusing to overwrite an unmanaged pet: ${petDirectory}`);
  }

  const stagedActive = `${locations.active}.stage.${process.pid}`;
  await fs.rm(stagedActive, { recursive: true, force: true });
  await copyBundle(checked.root, stagedActive);

  const stagedPet = `${petDirectory}.stage.${process.pid}`;
  await fs.rm(stagedPet, { recursive: true, force: true });
  await ensureDir(stagedPet);
  const spriteName = path.basename(checked.pet.spritesheetPath);
  await copyFileAtomic(checked.pet.metadataPath, path.join(stagedPet, 'pet.json'));
  await copyFileAtomic(checked.pet.spritesheetPath, path.join(stagedPet, spriteName));

  const oldPetBackup = `${petDirectory}.previous.${process.pid}`;
  const activeBackup = `${locations.active}.previous.${process.pid}`;
  await fs.rm(oldPetBackup, { recursive: true, force: true });
  await fs.rm(activeBackup, { recursive: true, force: true });
  let movedOldPet = false;
  let movedOldActive = false;
  try {
    await ensureDir(path.dirname(petDirectory));
    if (await exists(petDirectory)) {
      await fs.rename(petDirectory, oldPetBackup);
      movedOldPet = true;
    }
    await fs.rename(stagedPet, petDirectory);
    if (await exists(locations.active)) {
      await fs.rename(locations.active, activeBackup);
      movedOldActive = true;
    }
    await fs.rename(stagedActive, locations.active);
    const state = {
      schemaVersion: 1,
      bundleId: checked.manifest.id,
      appliedAt: new Date().toISOString(),
      pet: {
        directory: petDirectory,
        spritesheetName: spriteName,
        sha256: checked.manifest.pet.sha256,
        metadataSha256: checked.manifest.pet.metadataSha256,
      },
    };
    await writeJsonAtomic(locations.state, state);
    if (movedOldPet) await fs.rm(oldPetBackup, { recursive: true, force: true });
    if (movedOldActive) await fs.rm(activeBackup, { recursive: true, force: true });
    if (oldState?.pet?.directory && path.resolve(oldState.pet.directory) !== path.resolve(petDirectory) && await ownedPetDirectory(oldState, oldState.pet.directory)) {
      await fs.rm(oldState.pet.directory, { recursive: true, force: true });
    }
    return { state, activeDirectory: locations.active };
  } catch (error) {
    await fs.rm(stagedPet, { recursive: true, force: true });
    await fs.rm(stagedActive, { recursive: true, force: true });
    await fs.rm(petDirectory, { recursive: true, force: true });
    if (movedOldPet && await exists(oldPetBackup)) await fs.rename(oldPetBackup, petDirectory);
    await fs.rm(locations.active, { recursive: true, force: true });
    if (movedOldActive && await exists(activeBackup)) await fs.rename(activeBackup, locations.active);
    throw error;
  }
}

export async function restoreSkin() {
  const locations = paths();
  const warnings = [];
  const state = await exists(locations.state) ? await readJson(locations.state) : null;
  await fs.rm(locations.active, { recursive: true, force: true });
  if (state?.pet) {
    await writeJsonAtomic(locations.state, { schemaVersion: 2, pet: state.pet });
  } else {
    await fs.rm(locations.state, { force: true });
  }
  return { warnings };
}

export async function restoreOriginal() {
  const locations = paths();
  const warnings = [];
  if (await exists(locations.state)) {
    const state = await readJson(locations.state);
    if (state.pet?.directory && await exists(state.pet.directory)) {
      if (await ownedPetDirectory(state, state.pet.directory)) await fs.rm(state.pet.directory, { recursive: true, force: true });
      else warnings.push(`Managed pet changed after install and was left untouched: ${state.pet.directory}`);
    }
    await fs.rm(locations.state, { force: true });
  }
  await fs.rm(locations.active, { recursive: true, force: true });
  return { warnings };
}
