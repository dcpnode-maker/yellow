[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('oneplus10r', 'oneplus11r', 'nord5')]
    [string]$Worker,
    [Parameter(Mandatory)] [string]$Workspace,
    [Parameter(Mandatory)] [string[]]$Files,
    [Parameter(Mandatory)] [string]$Prompt,
    [string]$ContextBundle,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$contextText = ''
if (-not [string]::IsNullOrWhiteSpace($ContextBundle)) {
    & python (Join-Path $PSScriptRoot '..\verify_context.py') --repo $repoRoot --path $ContextBundle --lane phone | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Context bundle integrity verification failed.' }
    $privateContext = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '.git\yellow-local-ai\context')).TrimEnd('\')
    $resolvedContext = (Resolve-Path -LiteralPath $ContextBundle).Path
    $normalizedContext = [System.IO.Path]::GetFullPath($resolvedContext)
    if (-not $normalizedContext.StartsWith($privateContext + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Context bundle must be generated under the private Yellow context directory.' }
    $contextItem = Get-Item -LiteralPath $normalizedContext
    if ($contextItem.PSIsContainer -or ($contextItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'Context bundle must be a regular file.' }
    if ($contextItem.Length -gt 6144) { throw 'Phone context bundle exceeds 6 KiB.' }
    $contextText = Get-Content -LiteralPath $normalizedContext -Raw
}
$workspaceRoot = (Resolve-Path -LiteralPath $Workspace).Path
$gitRoot = (& git -C $workspaceRoot rev-parse --show-toplevel 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitRoot)) { throw 'Workspace must be a Git worktree.' }
$normalizedGitRoot = [System.IO.Path]::GetFullPath($gitRoot).TrimEnd('\')
$normalizedRepoRoot = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\')
if ($normalizedGitRoot -eq $normalizedRepoRoot) {
    throw 'Phone implementation requires a separate Git worktree, not the main repository.'
}
$registeredWorktrees = @(& git -C $repoRoot worktree list --porcelain | Where-Object { $_ -like 'worktree *' } | ForEach-Object {
    [System.IO.Path]::GetFullPath($_.Substring(9)).TrimEnd('\')
})
if (-not ($registeredWorktrees | Where-Object { $_ -eq $normalizedGitRoot })) {
    throw 'Workspace is not a registered Yellow Git worktree.'
}

$resolvedFiles = @()
$totalBytes = 0L
foreach ($file in $Files) {
    $candidate = (Resolve-Path -LiteralPath (Join-Path $workspaceRoot $file)).Path
    $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
    if (-not $candidate.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "File escapes workspace: $file" }
    $relative = $candidate.Substring($workspacePrefix.Length)
    $item = Get-Item -LiteralPath $candidate
    if ($item.PSIsContainer) { throw "Only explicit files are accepted: $file" }
    $totalBytes += $item.Length
    $resolvedFiles += $relative
}
if ($resolvedFiles.Count -eq 0) { throw 'At least one explicit file is required.' }
$message = "/no_think`n$contextText`n`n# Assigned task`nWork only in the listed files. $Prompt"
$totalBytes += [System.Text.Encoding]::UTF8.GetByteCount($message)
if ($totalBytes -gt 6144) { throw 'Phone task input, files and prompt exceed the conservative 6 KiB admission limit.' }

$privateAndroid = Join-Path $repoRoot '.git\yellow-local-ai\android'
$workerConfig = @{
    oneplus10r = @{ Port = 11435; Key = '«REDACTED-SECRET»' }
    oneplus11r = @{ Port = 11436; Key = '«REDACTED-SECRET»' }
    nord5 = @{ Port = 11437; Key = '«REDACTED-SECRET»' }
}[$Worker]
$keyPath = Join-Path $privateAndroid (Join-Path 'keys' $workerConfig.Key)
$aider = Join-Path $repoRoot '.git\yellow-local-ai\bin\aider.exe'
$historyRoot = Join-Path $repoRoot ".git\yellow-local-ai\aider-history\$Worker"
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) { throw "Missing private API key for $Worker." }
if (-not (Test-Path -LiteralPath $aider -PathType Leaf)) { throw 'Pinned private Aider runtime is not installed.' }
if (-not (Test-Path -LiteralPath $historyRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $historyRoot -Force | Out-Null
}

$apiKey = (Get-Content -LiteralPath $keyPath -Raw).Trim()
$endpoint = "http://127.0.0.1:$($workerConfig.Port)/v1"
$models = Invoke-RestMethod -Uri "$endpoint/models" -Headers @{ Authorization = "Bearer $apiKey" } -TimeoutSec 10
$model = @($models.data)[0].id
if ([string]::IsNullOrWhiteSpace($model)) { throw "$Worker returned no usable model." }

if ($DryRun) {
    [pscustomobject]@{
        action = 'phone-aider'; worker = $Worker; workspace = $workspaceRoot
        files = $resolvedFiles; input_bytes = $totalBytes; endpoint = $endpoint
        auto_commit = $false; repo_map = $false; secret_printed = $false
    } | ConvertTo-Json -Depth 4
    exit 0
}

$previous = @{
    OPENAI_API_BASE = $env:OPENAI_API_BASE; OPENAI_API_KEY = $env:OPENAI_API_KEY
    PYTHONUTF8 = $env:PYTHONUTF8; PYTHONIOENCODING = $env:PYTHONIOENCODING
}
try {
    $env:OPENAI_API_BASE = $endpoint
    $env:OPENAI_API_KEY = $apiKey
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $arguments = @(
        '--model', "openai/$model", '--no-auto-commits', '--no-dirty-commits',
        '--map-tokens', '0', '--no-gitignore', '--no-add-gitignore-files',
        '--no-restore-chat-history', '--thinking-tokens', '0', '--timeout', '180',
        '--chat-history-file', (Join-Path $historyRoot 'chat.md'),
        '--input-history-file', (Join-Path $historyRoot 'input'),
        '--llm-history-file', (Join-Path $historyRoot 'llm.md'),
        '--no-pretty', '--no-stream', '--no-show-model-warnings', '--no-check-model-accepts-settings',
        '--no-check-update', '--no-show-release-notes', '--yes-always',
        '--message', $message
    ) + $resolvedFiles
    Push-Location $workspaceRoot
    & $aider @arguments
    if ($LASTEXITCODE -ne 0) { throw "$Worker Aider process exited with code $LASTEXITCODE." }
    & git diff --check -- @resolvedFiles
    if ($LASTEXITCODE -ne 0) { throw "$Worker produced a malformed diff." }
}
finally {
    Pop-Location
    $env:OPENAI_API_BASE = $previous.OPENAI_API_BASE
    $env:OPENAI_API_KEY = $previous.OPENAI_API_KEY
    $env:PYTHONUTF8 = $previous.PYTHONUTF8
    $env:PYTHONIOENCODING = $previous.PYTHONIOENCODING
    $apiKey = $null
}
