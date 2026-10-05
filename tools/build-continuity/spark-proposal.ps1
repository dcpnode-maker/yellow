# Fixed-model included-quota proposal only. No model or paid API fallback.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$PromptFile)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$git = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
$private = Join-Path ((& $git -C $root rev-parse --absolute-git-dir).Trim()) 'yellow-continuity'
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve private state.' }
$item = Get-Item -LiteralPath $PromptFile
if ($item.PSIsContainer -or $item.Length -gt 160000 -or $item.DirectoryName -ine [IO.Path]::GetFullPath($private) -or
    $item.Name -notmatch '^worker-spark-[a-z0-9-]+\.txt$' -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Expected one curated Spark packet directly inside private state.'
}
$codex = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin\bffc5354119c8421\codex.exe'
$empty = Join-Path $env:LOCALAPPDATA 'agy\yellow-proposal-work'
if (-not (Test-Path -LiteralPath $empty -PathType Container)) { throw 'Prepared empty proposal workspace is absent.' }
$output = Join-Path $private ($item.BaseName + '-result.txt')
if (Test-Path -LiteralPath $output) { throw 'Existing result is preserved; use a new packet.' }
Get-Content -LiteralPath $item.FullName -Raw | & $codex exec --ignore-user-config --ephemeral --skip-git-repo-check --sandbox read-only -C $empty --model gpt-5.3-codex-spark -c 'model_reasoning_effort="high"' -c 'approval_policy="never"' -c 'web_search="disabled"' -c 'features.shell_tool=false' --json --output-last-message $output -
if ($LASTEXITCODE -ne 0) { throw 'Spark stopped. No model switch, credit purchase or fallback attempted.' }
