import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { paths, REFERENCE_IMAGE_MAX_BYTES, REFERENCE_IMAGES_TOTAL_MAX_BYTES } from './constants.mjs';
import { copyFileAtomic, ensureDir, writeJsonAtomic } from './io.mjs';

const INPUT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export async function createJob(imagePaths, requirements) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) throw new Error('At least one --image is required');
  if (imagePaths.length > 32) throw new Error('At most 32 images are supported');
  if (typeof requirements !== 'string' || !requirements.trim()) throw new Error('--requirements must not be empty');

  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
  const directory = path.join(paths().jobs, id);
  const inputDirectory = path.join(directory, 'inputs');
  await ensureDir(inputDirectory);
  await fs.chmod(directory, 0o700).catch(() => {});
  await fs.chmod(inputDirectory, 0o700).catch(() => {});

  const images = [];
  let totalBytes = 0;
  for (const [index, input] of imagePaths.entries()) {
    const source = path.resolve(input);
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw new Error(`Image is not a file: ${input}`);
    if (stat.size > REFERENCE_IMAGE_MAX_BYTES) throw new Error(`Reference image exceeds 20 MiB: ${path.basename(source)}`);
    totalBytes += stat.size;
    if (totalBytes > REFERENCE_IMAGES_TOTAL_MAX_BYTES) throw new Error('Reference image group exceeds 100 MiB');
    const extension = path.extname(source).toLowerCase();
    if (!INPUT_EXTENSIONS.has(extension)) throw new Error(`Unsupported reference image: ${path.basename(source)}`);
    const relative = path.join('inputs', `${String(index).padStart(2, '0')}${extension}`);
    await copyFileAtomic(source, path.join(directory, relative));
    await fs.chmod(path.join(directory, relative), 0o600).catch(() => {});
    images.push(relative.replaceAll(path.sep, '/'));
  }

  await writeJsonAtomic(path.join(directory, 'job.json'), {
    schemaVersion: 1,
    id,
    images,
    requirements: requirements.trim(),
  });
  return { id, directory, images: images.map((item) => path.join(directory, item)), requirements: requirements.trim() };
}
