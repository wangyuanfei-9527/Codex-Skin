import fs from 'node:fs/promises';
import path from 'node:path';
import { validateBundle } from '../bundle-validator.mjs';
import { exists, writeJsonAtomic } from '../io.mjs';
import { BACKGROUND_PLACEHOLDER, ICONS_PLACEHOLDER, PET_PLACEHOLDER, codexNativeTokenCss } from '../theme-compiler.mjs';
import { buildInjectionExpression, evaluateTarget, listPageTargets } from './cdp.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function mimeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  throw new Error(`Unsupported runtime image type: ${extension}`);
}

async function dataUrl(filePath) {
  return `data:${mimeFor(filePath)};base64,${(await fs.readFile(filePath)).toString('base64')}`;
}

async function main() {
  const port = Number(option('--port'));
  const active = path.resolve(option('--active') || '');
  const runtimeState = path.resolve(option('--runtime-state') || '');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !active || !runtimeState) throw new Error('Invalid injector daemon arguments');
  const bundle = await validateBundle(active, { requireReady: true });
  const rawCss = await fs.readFile(bundle.cssPath, 'utf8');
  const petDataUrl = bundle.pet ? await dataUrl(bundle.pet.spritesheetPath) : '';
  const iconsDataUrl = bundle.iconsPath ? await dataUrl(bundle.iconsPath) : '';
  const css = `${rawCss}\n${codexNativeTokenCss(bundle.design.palette)}`
    .replaceAll(BACKGROUND_PLACEHOLDER, await dataUrl(bundle.backgroundPath))
    .replaceAll(ICONS_PLACEHOLDER, iconsDataUrl)
    .replaceAll(PET_PLACEHOLDER, petDataUrl);
  const expression = buildInjectionExpression({
    bundleId: bundle.manifest.id,
    css,
    name: bundle.manifest.name,
    summary: bundle.manifest.summary,
    signature: bundle.design.copy.signature,
    cardTitles: bundle.design.copy.cardTitles,
    cardSubtitles: bundle.design.copy.cardSubtitles,
    layout: bundle.design.effects.layout,
    petName: bundle.manifest.pet?.name || null,
  });
  await writeJsonAtomic(runtimeState, { status: 'running', pid: process.pid, port, bundleId: bundle.manifest.id, startedAt: new Date().toISOString() });

  let failures = 0;
  while (await exists(path.join(active, 'manifest.json'))) {
    try {
      const targets = await listPageTargets(port);
      for (const target of targets) await evaluateTarget(target.webSocketDebuggerUrl, expression);
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures >= 15) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  await writeJsonAtomic(runtimeState, { status: 'stopped', pid: process.pid, stoppedAt: new Date().toISOString() });
}

main().catch(async (error) => {
  const runtimeState = option('--runtime-state');
  if (runtimeState) await writeJsonAtomic(path.resolve(runtimeState), { status: 'failed', pid: process.pid, failedAt: new Date().toISOString(), error: error.message }).catch(() => {});
  process.exitCode = 1;
});
