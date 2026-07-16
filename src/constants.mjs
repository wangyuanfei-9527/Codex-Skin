import os from 'node:os';
import path from 'node:path';

export const APP_ID = 'codex-skin-studio';
export const BUNDLE_SCHEMA_VERSION = 1;
export const DESIGN_SCHEMA_VERSION = 1;
export const PET_WIDTH = 1536;
export const PET_HEIGHT = 1872;
export const PET_MAX_BYTES = 20 * 1024 * 1024;
export const REFERENCE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const REFERENCE_IMAGES_TOTAL_MAX_BYTES = 100 * 1024 * 1024;

export function studioHome() {
  if (process.env.CODEX_SKIN_HOME) {
    return path.resolve(process.env.CODEX_SKIN_HOME);
  }
  const base = process.platform === 'win32'
    ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'))
    : (process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'));
  return path.join(base, 'CodexSkinStudio');
}

export function codexHome() {
  return path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
}

export function paths() {
  const root = studioHome();
  return {
    root,
    jobs: path.join(root, 'jobs'),
    bundles: path.join(root, 'bundles'),
    active: path.join(root, 'active'),
    backups: path.join(root, 'backups'),
    runtime: path.join(root, 'runtime'),
    state: path.join(root, 'state.json'),
  };
}
