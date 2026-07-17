#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateBundle } from '../src/bundle-validator.mjs';
import { analyzeSkinWithLocalCodex, analyzeWithLocalCodex, extractReferenceAnalysisWithLocalCodex, inspectCodexRuntime, planSkinWithLocalCodex } from '../src/codex-runtime.mjs';
import { assertDesignSpec } from '../src/design-spec.mjs';
import { assertSkinSpec } from '../src/skin-spec.mjs';
import { exists, readJson, writeJsonAtomic } from '../src/io.mjs';
import { createJob } from '../src/jobs.mjs';
import { paths } from '../src/constants.mjs';
import { applyBundle, restoreOriginal, restoreSkin as restoreSkinOnly } from '../src/store.mjs';
import { compileBundle } from '../src/theme-compiler.mjs';
import { generateSkinAssetsWithLocalCodex } from '../src/theme-assets.mjs';
import { replaceBundlePetSpritesheet } from '../src/pet-replacer.mjs';
import { inspectWindowsCodexApp } from '../src/windows/codex-app.mjs';
import { scheduleRestart } from '../src/windows/restart.mjs';
import { customizeBundleCopy } from '../src/copy-customizer.mjs';

const HELP = `Codex Skin Studio

Usage:
  codex-skin doctor
  codex-skin generate --image <file> [--image <file>...] --requirements <text> [--color-mode auto|light|dark] [--pet-spritesheet <file>] [--output <dir>]
  codex-skin generate-skin --image <file> [--image <file>...] --requirements <text> [--color-mode auto|light|dark] [--output <dir>] [--progress-file <file>]
  codex-skin compile --spec <file> --image <file> [--image <file>...] [--pet-spritesheet <file>] [--output <dir>]
  codex-skin compile-skin --spec <file> --image <file> [--image <file>...] [--background-image <file>] [--icons <file>] [--output <dir>]
  codex-skin customize-copy <bundle-dir> --copy-file <json> --output <dir>
  codex-skin validate <bundle-dir>
  codex-skin replace-pet <bundle-dir> --spritesheet <file>
  codex-skin apply <bundle-dir> [--restart]
  codex-skin apply-skin <bundle-dir> [--restart]
  codex-skin restore [--restart]
  codex-skin restore-skin [--restart]
  codex-skin status

Privacy: the project has no server or telemetry. The local Codex CLI can send attached
images and the brief to OpenAI under the user's existing authentication.`;

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    if (token === '--restart' || token === '--json') {
      flags.add(token);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${token} requires a value`);
    index += 1;
    const current = values.get(token) || [];
    current.push(value);
    values.set(token, current);
  }
  return { positional, flags, one: (name) => values.get(name)?.at(-1), all: (name) => values.get(name) || [] };
}

function requireValue(args, name) {
  const value = args.one(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function requirements(args) {
  const inline = args.one('--requirements');
  const file = args.one('--requirements-file');
  if (inline && file) throw new Error('Use either --requirements or --requirements-file, not both');
  if (file) return fs.readFile(path.resolve(file), 'utf8');
  if (inline) return inline;
  throw new Error('--requirements or --requirements-file is required');
}

async function doctor() {
  const runtime = await inspectCodexRuntime();
  let desktop;
  try {
    desktop = await inspectWindowsCodexApp();
  } catch (error) {
    desktop = { error: error.message };
  }
  console.log(JSON.stringify({ localCodex: runtime, desktop, studioHome: paths().root }, null, 2));
  if (!runtime.authenticated) process.exitCode = 2;
}

async function generate(args) {
  const job = await createJob(args.all('--image'), await requirements(args), args.one('--color-mode') || 'auto');
  const analyzed = await analyzeWithLocalCodex(job);
  const bundle = await compileBundle({
    spec: analyzed.spec,
    images: job.images,
    petSpritesheet: args.one('--pet-spritesheet'),
    outputDirectory: args.one('--output'),
  });
  console.log(JSON.stringify({ job: job.directory, specification: analyzed.specPath, bundle: bundle.directory, ready: bundle.manifest.ready }, null, 2));
}

async function generateSkin(args) {
  const job = await createJob(args.all('--image'), await requirements(args), args.one('--color-mode') || 'auto');
  const progressFile = args.one('--progress-file');
  const report = async (stage, detail, artifacts = {}) => {
    if (!progressFile) return;
    await writeJsonAtomic(path.resolve(progressFile), { stage, detail, updatedAt: new Date().toISOString(), ...artifacts });
  };
  await report('extracting', '正在提取参考图中的主体、角色特征、构图、配色与纹样');
  const extracted = await extractReferenceAnalysisWithLocalCodex(job);
  await report('planning', '正在结合用户需求生成主题规范和完整资产提示词包', { referenceAnalysis: extracted.specPath });
  const analyzed = await planSkinWithLocalCodex(job, extracted.spec);
  const assets = await generateSkinAssetsWithLocalCodex(job, analyzed.spec, extracted.spec, {
    onStage: async (stage, artifacts = {}) => {
      const detail = stage === 'generating-hero'
        ? '正在使用本地 Codex 图像生成横版主题主视觉'
        : '主视觉已完成，正在生成统一风格的四枚功能图标';
      await report(stage, detail, { referenceAnalysis: extracted.specPath, specification: analyzed.specPath, ...artifacts });
    },
  });
  await report('compiling', '视觉资产已生成，正在编译和校验完整皮肤', { hero: assets.hero.path, icons: assets.icons.path });
  const bundle = await compileBundle({
    spec: analyzed.spec,
    images: job.images,
    backgroundImage: assets.hero.path,
    iconSheet: assets.icons.path,
    outputDirectory: args.one('--output'),
    skinOnly: true,
  });
  await report('ready', '皮肤、主视觉和图标图集已全部通过校验', { bundle: bundle.directory, hero: assets.hero.path, icons: assets.icons.path });
  console.log(JSON.stringify({
    job: job.directory,
    referenceAnalysis: extracted.specPath,
    specification: analyzed.specPath,
    assets,
    bundle: bundle.directory,
    kind: bundle.manifest.kind,
    ready: bundle.manifest.ready,
  }, null, 2));
}

async function compile(args) {
  const spec = assertDesignSpec(await readJson(path.resolve(requireValue(args, '--spec'))));
  const bundle = await compileBundle({
    spec,
    images: args.all('--image').map((item) => path.resolve(item)),
    petSpritesheet: args.one('--pet-spritesheet'),
    outputDirectory: args.one('--output'),
  });
  console.log(JSON.stringify({ bundle: bundle.directory, ready: bundle.manifest.ready }, null, 2));
}

async function compileSkin(args) {
  const spec = assertSkinSpec(await readJson(path.resolve(requireValue(args, '--spec'))));
  const bundle = await compileBundle({
    spec,
    images: args.all('--image').map((item) => path.resolve(item)),
    backgroundImage: args.one('--background-image'),
    iconSheet: args.one('--icons'),
    outputDirectory: args.one('--output'),
    skinOnly: true,
  });
  console.log(JSON.stringify({ bundle: bundle.directory, kind: bundle.manifest.kind, ready: bundle.manifest.ready }, null, 2));
}

async function validate(args) {
  const directory = args.positional[0];
  if (!directory) throw new Error('validate requires a bundle directory');
  const result = await validateBundle(directory);
  console.log(JSON.stringify({ valid: true, ready: result.manifest.ready, id: result.manifest.id }, null, 2));
}

async function customizeCopy(args) {
  const directory = args.positional[0];
  if (!directory) throw new Error('customize-copy requires a bundle directory');
  const bundle = await customizeBundleCopy({
    bundleDirectory: directory,
    copyFile: requireValue(args, '--copy-file'),
    outputDirectory: requireValue(args, '--output'),
  });
  console.log(JSON.stringify({ bundle: bundle.directory, kind: bundle.manifest.kind, id: bundle.manifest.id, ready: bundle.manifest.ready }, null, 2));
}

async function replacePet(args) {
  const directory = args.positional[0];
  if (!directory) throw new Error('replace-pet requires a bundle directory');
  const result = await replaceBundlePetSpritesheet(directory, requireValue(args, '--spritesheet'));
  console.log(JSON.stringify({
    replaced: true,
    bundle: result.root,
    pet: result.manifest.pet.slug,
    sourceDerived: result.manifest.pet.sourceDerived,
  }, null, 2));
}

async function apply(args) {
  const directory = args.positional[0];
  if (!directory) throw new Error('apply requires a bundle directory');
  const result = await applyBundle(directory);
  const restart = args.flags.has('--restart') ? await scheduleRestart('apply', result.activeDirectory) : null;
  console.log(JSON.stringify({ applied: true, bundleId: result.state.bundleId, restart }, null, 2));
}

async function applySkin(args) {
  const directory = args.positional[0];
  if (!directory) throw new Error('apply-skin requires a bundle directory');
  const checked = await validateBundle(directory, { requireReady: true });
  if (checked.kind !== 'skin') throw new Error('apply-skin accepts only skin-only bundles');
  const result = await applyBundle(directory);
  const restart = args.flags.has('--restart') ? await scheduleRestart('apply', result.activeDirectory) : null;
  console.log(JSON.stringify({ applied: true, kind: 'skin', bundleId: result.state.bundleId, restart }, null, 2));
}

async function restore(args) {
  const result = await restoreOriginal();
  const restart = args.flags.has('--restart') ? await scheduleRestart('restore') : null;
  console.log(JSON.stringify({ restored: true, warnings: result.warnings, restart }, null, 2));
}

async function restoreSkin(args) {
  const result = await restoreSkinOnly();
  const restart = args.flags.has('--restart') ? await scheduleRestart('restore') : null;
  console.log(JSON.stringify({ restored: true, kind: 'skin', warnings: result.warnings, restart }, null, 2));
}

async function status() {
  const locations = paths();
  const state = await exists(locations.state) ? await readJson(locations.state) : null;
  const runtimePath = path.join(locations.runtime, 'injector.json');
  const runtime = await exists(runtimePath) ? await readJson(runtimePath) : null;
  console.log(JSON.stringify({ active: Boolean(state), state, runtime }, null, 2));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }
  const args = parseArgs(rest);
  if (command === 'doctor') return doctor();
  if (command === 'generate') return generate(args);
  if (command === 'generate-skin') return generateSkin(args);
  if (command === 'compile') return compile(args);
  if (command === 'compile-skin') return compileSkin(args);
  if (command === 'customize-copy') return customizeCopy(args);
  if (command === 'validate') return validate(args);
  if (command === 'replace-pet') return replacePet(args);
  if (command === 'apply') return apply(args);
  if (command === 'apply-skin') return applySkin(args);
  if (command === 'restore') return restore(args);
  if (command === 'restore-skin') return restoreSkin(args);
  if (command === 'status') return status();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`codex-skin: ${error.message}`);
  process.exitCode = 1;
});
