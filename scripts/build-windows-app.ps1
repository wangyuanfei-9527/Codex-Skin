param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$build = Join-Path $root "build\windows-portable"
$stage = Join-Path $build "stage"
$runtimeStage = Join-Path $stage "runtime"
$archive = Join-Path $build "runtime.zip"
$output = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $root "dist" }

foreach ($candidate in @($build, $output)) {
  $resolvedParent = [IO.Path]::GetFullPath((Split-Path $candidate -Parent))
  if (-not $resolvedParent.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Build output must stay inside the repository: $candidate"
  }
}

$csc = Get-ChildItem "$env:WINDIR\Microsoft.NET\Framework64" -Recurse -Filter csc.exe |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $csc) { throw "The .NET Framework C# compiler was not found." }

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw "Node.js is required once to build the portable executable." }
$node = $nodeCommand.Source

$frameworkRoot = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319"
if (-not (Test-Path -LiteralPath $frameworkRoot)) { throw "The .NET Framework runtime assemblies were not found." }
$icon = Join-Path $root "app\CodexSkinStudio.ico"
if (-not (Test-Path -LiteralPath $icon)) { throw "The application icon was not found: $icon" }

if (Test-Path -LiteralPath $build) { Remove-Item -LiteralPath $build -Recurse -Force }
New-Item -ItemType Directory -Path $runtimeStage -Force | Out-Null
New-Item -ItemType Directory -Path $output -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $root "bin") -Destination $runtimeStage -Recurse
Copy-Item -LiteralPath (Join-Path $root "src") -Destination $runtimeStage -Recurse
Copy-Item -LiteralPath (Join-Path $root "schemas") -Destination $runtimeStage -Recurse
Compress-Archive -Path (Join-Path $runtimeStage "*") -DestinationPath $archive -CompressionLevel Optimal

$references = @(
  (Join-Path $frameworkRoot "WPF\PresentationCore.dll"),
  (Join-Path $frameworkRoot "WPF\PresentationFramework.dll"),
  (Join-Path $frameworkRoot "WPF\WindowsBase.dll"),
  (Join-Path $frameworkRoot "System.Xaml.dll"),
  (Join-Path $frameworkRoot "System.Web.Extensions.dll"),
  (Join-Path $frameworkRoot "System.IO.Compression.dll"),
  (Join-Path $frameworkRoot "System.IO.Compression.FileSystem.dll")
)

foreach ($reference in $references) {
  if (-not (Test-Path -LiteralPath $reference)) { throw "Missing framework reference: $reference" }
}

$exe = Join-Path $output "CodexSkinStudio.exe"
$arguments = @(
  "/nologo",
  "/target:winexe",
  "/optimize+",
  "/platform:x64",
  "/out:$exe",
  "/win32icon:$icon",
  "/win32manifest:$(Join-Path $root 'app\CodexSkinStudio.manifest')",
  "/resource:$archive,CodexSkinStudio.Runtime.zip",
  "/resource:$node,CodexSkinStudio.Node.exe"
)
$arguments += $references | ForEach-Object { "/reference:$_" }
$arguments += Join-Path $root "app\CodexSkinStudio.cs"

& $csc.FullName @arguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exe)) {
  throw "C# compilation failed with exit code $LASTEXITCODE"
}

$size = [Math]::Round((Get-Item -LiteralPath $exe).Length / 1MB, 1)
Write-Output "Built $exe ($size MiB)"
