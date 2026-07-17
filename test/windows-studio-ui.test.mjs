import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const sourcePath = new URL('../app/CodexSkinStudio.cs', import.meta.url);

test('uses themed studio dialogs instead of native message boxes', async () => {
  const source = await fs.readFile(sourcePath, 'utf8');
  assert.doesNotMatch(source, /MessageBox\.Show\s*\(/);
  assert.match(source, /internal static class StudioDialog/);
  assert.match(source, /"永久删除"/);
  assert.match(source, /"恢复原版"/);
});

test('offers actionable Codex CLI and application update links', async () => {
  const source = await fs.readFile(sourcePath, 'utf8');
  assert.match(source, /CODEX_CLI_NOT_FOUND/);
  assert.match(source, /下载 Codex CLI/);
  assert.match(source, /https:\/\/developers\.openai\.com\/codex\/cli\//);
  assert.match(source, /x:Name='UpdateButton'/);
  assert.match(source, /https:\/\/github\.com\/wangyuanfei-9527\/Codex-Skin\/releases\/latest/);
});

test('keeps Windows release metadata and title format aligned', async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const source = await fs.readFile(sourcePath, 'utf8');
  const manifest = await fs.readFile(new URL('../app/CodexSkinStudio.manifest', import.meta.url), 'utf8');
  const workflow = await fs.readFile(new URL('../.github/workflows/release-windows.yml', import.meta.url), 'utf8');
  const versionPattern = packageJson.version.replaceAll('.', '\\.');

  assert.match(source, new RegExp(`AssemblyVersion\\("${versionPattern}\\.0"\\)`));
  assert.match(source, new RegExp(`private const string Version = "${versionPattern}"`));
  assert.match(manifest, new RegExp(`version="${versionPattern}\\.0"`));
  assert.match(workflow, /--title "\$tag"/);
  await fs.access(new URL(`../.github/release-notes/v${packageJson.version}.md`, import.meta.url));
});
