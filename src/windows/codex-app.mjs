import path from 'node:path';
import { exists } from '../io.mjs';
import { runProcess } from '../process.mjs';

const POWERSHELL = 'powershell.exe';

export async function inspectWindowsCodexApp() {
  if (process.platform !== 'win32') throw new Error('Desktop injection is currently supported on Windows only');
  const script = [
    "$p = Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1",
    'if (-not $p) { exit 3 }',
    "$exe = Join-Path $p.InstallLocation 'app\\ChatGPT.exe'",
    '[pscustomobject]@{ Name=$p.Name; Version=$p.Version.ToString(); InstallLocation=$p.InstallLocation; PackageFamilyName=$p.PackageFamilyName; Publisher=$p.Publisher; SignatureKind=$p.SignatureKind.ToString(); Executable=$exe } | ConvertTo-Json -Compress',
  ].join('; ');
  const result = await runProcess(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (result.code !== 0) throw new Error('The Microsoft Store Codex desktop package was not found');
  const app = JSON.parse(result.stdout.trim());
  if (app.Name !== 'OpenAI.Codex' || app.PackageFamilyName !== 'OpenAI.Codex_2p2nqsd0c76g0' || app.SignatureKind !== 'Store') {
    throw new Error('Unexpected Codex package identity or signature');
  }
  const installRoot = path.resolve(app.InstallLocation);
  const executable = path.resolve(app.Executable);
  if (!executable.startsWith(`${installRoot}${path.sep}`) || !await exists(executable)) throw new Error('Codex executable failed package-path validation');
  return { ...app, Executable: executable };
}

export async function stopWindowsCodex(executable) {
  const script = [
    '$expected = $env:CODEX_SKIN_EXPECTED_EXE',
    "$items = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ChatGPT.exe' -and $_.ExecutablePath -eq $expected }",
    '$items | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
  ].join('; ');
  const result = await runProcess(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, CODEX_SKIN_EXPECTED_EXE: executable },
  });
  if (result.code !== 0) throw new Error(`Could not stop Codex: ${result.stderr.trim()}`);
}

export async function verifyPortOwner(port, executable) {
  const script = [
    '$port = [int]$env:CODEX_SKIN_PORT',
    '$expected = $env:CODEX_SKIN_EXPECTED_EXE',
    "$pids = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)",
    '$ok = $false',
    'foreach ($pidValue in $pids) { $proc = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $pidValue); if ($proc.ExecutablePath -eq $expected) { $ok = $true } }',
    'if (-not $ok) { exit 4 }',
  ].join('; ');
  const result = await runProcess(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, CODEX_SKIN_PORT: String(port), CODEX_SKIN_EXPECTED_EXE: executable },
  });
  if (result.code !== 0) throw new Error('The debugging port is not owned by the verified Codex executable');
}
