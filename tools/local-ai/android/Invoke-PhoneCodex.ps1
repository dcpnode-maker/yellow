[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('oneplus10r', 'oneplus11r', 'nord5')]
    [string]$Worker,
    [Parameter(Mandatory)]
    [ValidateSet('read-only', 'workspace-write')]
    [string]$Sandbox,
    [Parameter(Mandatory)] [string]$Workspace,
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
$renderedPrompt = "/no_think`n$contextText`n`n# Assigned task`n$Prompt"
if ([System.Text.Encoding]::UTF8.GetByteCount($renderedPrompt) -gt 6144) {
    throw 'Rendered phone prompt exceeds the conservative 6 KiB admission limit.'
}
$privateRoot = Join-Path $repoRoot '.git\yellow-local-ai\android'
$workerConfig = @{
    oneplus10r = @{ Port = 11435; Key = '«REDACTED-SECRET»' }
    oneplus11r = @{ Port = 11436; Key = '«REDACTED-SECRET»' }
    nord5 = @{ Port = 11437; Key = '«REDACTED-SECRET»' }
}[$Worker]

$resolvedWorkspace = (Resolve-Path -LiteralPath $Workspace).Path
$workspaceGitRoot = (& git -C $resolvedWorkspace rev-parse --show-toplevel 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($workspaceGitRoot)) { throw 'Workspace must be a Git worktree.' }
if ($Sandbox -eq 'workspace-write') {
    $normalizedWorkspaceRoot = [System.IO.Path]::GetFullPath($workspaceGitRoot).TrimEnd('\')
    $normalizedRepoRoot = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\')
    if ($normalizedWorkspaceRoot -eq $normalizedRepoRoot) {
        throw 'Phone workspace-write requires a separate registered Yellow Git worktree.'
    }
    $registeredWorktrees = @(& git -C $repoRoot worktree list --porcelain | Where-Object { $_ -like 'worktree *' } | ForEach-Object {
        [System.IO.Path]::GetFullPath($_.Substring(9)).TrimEnd('\')
    })
    if (-not ($registeredWorktrees | Where-Object { $_ -eq $normalizedWorkspaceRoot })) {
        throw 'Workspace is not a registered Yellow Git worktree.'
    }
}
$keyPath = Join-Path $privateRoot (Join-Path 'keys' $workerConfig.Key)
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    throw "Missing private API key for $Worker. Complete authenticated setup first."
}
$apiKey = (Get-Content -LiteralPath $keyPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "Empty private API key for $Worker." }

$endpoint = "http://127.0.0.1:$($workerConfig.Port)"
$models = Invoke-RestMethod -Uri "$endpoint/v1/models" -Headers @{ Authorization = "Bearer $apiKey" } -TimeoutSec 10
$model = @($models.data)[0].id
if ([string]::IsNullOrWhiteSpace($model)) { throw "$Worker returned no usable model." }

$codexHome = Join-Path $repoRoot ".git\yellow-local-codex-$Worker"
$catalogPath = Join-Path $codexHome 'model-catalog.json'
$configPath = Join-Path $codexHome 'config.toml'

if ($DryRun) {
    [pscustomobject]@{
        action = 'phone-codex'; worker = $Worker; sandbox = $Sandbox
        workspace = $resolvedWorkspace; endpoint = $endpoint
        authenticated = $true; secret_printed = $false
    } | ConvertTo-Json
    exit 0
}

New-Item -ItemType Directory -Force -Path $codexHome | Out-Null
$catalog = @{
    models = @(@{
        slug = $model; display_name = "$Worker Yellow worker"
        description = 'Authenticated phone-hosted bounded Yellow worker.'
        default_reasoning_level = $null; supported_reasoning_levels = @()
        shell_type = 'shell_command'; visibility = 'list'; supported_in_api = $true
        priority = 1; context_window = 8192; max_context_window = 8192
        effective_context_window_percent = 75; input_modalities = @('text')
        supports_search_tool = $false; support_verbosity = $false
        supports_parallel_tool_calls = $false; experimental_supported_tools = @()
        truncation_policy = @{ mode = 'tokens'; limit = 6500 }
        base_instructions = "/no_think`nYou are a bounded Yellow coding worker. Read PROJECT.md and AGENTS.md first. Work only from the supplied order and never self-approve high-risk work."
    })
}
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$catalogJson = $catalog | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($catalogPath, $catalogJson, $utf8NoBom)
$escapedCatalog = $catalogPath.Replace('\', '\\')
$configToml = @"
model = "$model"
model_provider = "yellow_phone"
model_context_window = 8192
model_auto_compact_token_limit = 6500
model_reasoning_effort = "none"
approval_policy = "never"
model_catalog_json = "$escapedCatalog"

[model_providers.yellow_phone]
name = "Yellow Phone Worker"
base_url = "$endpoint/v1"
env_key = "YELLOW_PHONE_API_KEY"
wire_api = "responses"
requires_openai_auth = true

[features]
apps = false
plugins = false
remote_plugin = false
plugin_sharing = false
browser_use = false
browser_use_external = false
computer_use = false
in_app_browser = false
image_generation = false
hooks = false
skill_search = false
"@
[System.IO.File]::WriteAllText($configPath, $configToml, $utf8NoBom)

$previousCodexHome = $env:CODEX_HOME
$previousPhoneKey = $env:YELLOW_PHONE_API_KEY
try {
    $env:CODEX_HOME = $codexHome
    $env:YELLOW_PHONE_API_KEY = $apiKey
    Push-Location $resolvedWorkspace
    & codex exec --strict-config --ephemeral --sandbox $Sandbox $renderedPrompt
    if ($LASTEXITCODE -ne 0) { throw "$Worker Codex process exited with code $LASTEXITCODE." }
}
finally {
    Pop-Location
    $env:CODEX_HOME = $previousCodexHome
    $env:YELLOW_PHONE_API_KEY = $previousPhoneKey
    $apiKey = $null
}
