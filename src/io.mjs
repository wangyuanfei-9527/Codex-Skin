import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function writeJsonAtomic(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, filePath);
}

export async function writeFileAtomic(filePath, contents) {
  await ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, contents, { mode: 0o600 });
  await fs.rename(temporary, filePath);
}

export async function copyFileAtomic(source, target) {
  await ensureDir(path.dirname(target));
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.copyFile(source, temporary);
  await fs.chmod(temporary, 0o600).catch(() => {});
  await fs.rename(temporary, target);
}

export async function sha256(filePath) {
  const digest = crypto.createHash('sha256');
  digest.update(await fs.readFile(filePath));
  return digest.digest('hex');
}

export function safeSlug(value, fallback = 'skin') {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export function resolveInside(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Bundle path must be relative: ${relativePath}`);
  }
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, relativePath);
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Bundle path escapes its root: ${relativePath}`);
  }
  return resolved;
}
