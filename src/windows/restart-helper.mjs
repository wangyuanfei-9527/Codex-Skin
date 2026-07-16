import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from '../io.mjs';
import { findLoopbackPort, waitForDebugger } from './cdp.mjs';
import { inspectWindowsCodexApp, stopWindowsCodex, verifyPortOwner } from './codex-app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function launch(executable, args) {
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  return child;
}

async function main() {
  const mode = process.argv[2];
  const active = option('--active');
  const runtimeState = path.resolve(option('--runtime-state') || '');
  if (!['apply', 'restore'].includes(mode) || !runtimeState || (mode === 'apply' && !active)) throw new Error('Invalid restart helper arguments');
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const app = await inspectWindowsCodexApp();
  await stopWindowsCodex(app.Executable);
  await new Promise((resolve) => setTimeout(resolve, 700));

  if (mode === 'restore') {
    launch(app.Executable, []);
    await writeJsonAtomic(runtimeState, { status: 'restored', restoredAt: new Date().toISOString() });
    return;
  }

  const port = await findLoopbackPort();
  launch(app.Executable, [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`]);
  await waitForDebugger(port);
  await verifyPortOwner(port, app.Executable);
  await writeJsonAtomic(runtimeState, { status: 'starting-injector', helperPid: process.pid, port, startedAt: new Date().toISOString() });
  launch(process.execPath, [
    path.join(here, 'injector-daemon.mjs'), '--port', String(port),
    '--active', path.resolve(active), '--runtime-state', runtimeState,
  ]);
}

main().catch(async (error) => {
  const runtimeState = option('--runtime-state');
  if (runtimeState) await writeJsonAtomic(path.resolve(runtimeState), { status: 'failed', failedAt: new Date().toISOString(), error: error.message }).catch(() => {});
  process.exitCode = 1;
});
