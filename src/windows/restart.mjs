import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir } from '../io.mjs';
import { paths } from '../constants.mjs';

const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), 'restart-helper.mjs');

export async function scheduleRestart(mode, activeDirectory = paths().active) {
  if (process.platform !== 'win32') throw new Error('One-click Codex restart is currently supported on Windows only');
  const runtimeState = path.join(paths().runtime, 'injector.json');
  await ensureDir(path.dirname(runtimeState));
  const child = spawn(process.execPath, [helper, mode, '--active', activeDirectory, '--runtime-state', runtimeState], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return { helperPid: child.pid, runtimeState };
}
