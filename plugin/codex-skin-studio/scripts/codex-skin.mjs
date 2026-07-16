#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..', '..', '..', 'bin', 'codex-skin.mjs');
if (!fs.existsSync(cli)) {
  console.error('Codex Skin Studio runtime was not found. Run this plugin from its repository checkout.');
  process.exitCode = 1;
} else {
  process.argv = [process.argv[0], cli, ...process.argv.slice(2)];
  await import(pathToFileURL(cli).href);
}
