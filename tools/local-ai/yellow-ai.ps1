[CmdletBinding()]
param(
    [ValidateSet('status', 'start', 'prepare', 'local-implement', 'local-review', 'omni')]
    [string]$Action = 'status',
    [string]$Prompt,
    [string]$ContextBundle,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$privateCodexHome = Join-Path $repoRoot '.git\yellow-local-codex'
$ollamaExe = 'E:\yellow\ollama\app\ollama.exe'
$ollamaUri = 'http://127.0.0.1:11434'
$localModel = 'qwen3.5:9b'

function Get-BoundedContext {
    param([string]$Path, [long]$MaximumBytes)
    if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
    & python (Join-Path $PSScriptRoot 'verify_context.py') --repo $repoRoot --path $Path --lane laptop | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Context bundle integrity verification failed.' }
    $privateRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '.git\yellow-local-ai\context')).TrimEnd('\')
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    $normalized = [System.IO.Path]::GetFullPath($resolved)
    if (-not $normalized.StartsWith($privateRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Context bundle must be generated under the private Yellow context directory.'
    }
    $item = Get-Item -LiteralPath $normalized
    if ($item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        throw 'Context bundle must be a regular file.'
    }
    if ($item.Length -gt $MaximumBytes) { throw "Context bundle exceeds $MaximumBytes bytes." }
    return (Get-Content -LiteralPath $normalized -Raw)
}

function Test-LocalOllama {
    try {
        $version = Invoke-RestMethod -Uri "$ollamaUri/api/version" -TimeoutSec 3
        return [pscustomobject]@{ Ready = $true; Version = $version.version }
    }
    catch {
        return [pscustomobject]@{ Ready = $false; Version = $null }
    }
}

function Get-YellowAiStatus {
    $os = Get-CimInstance Win32_OperatingSystem
    $ollama = Test-LocalOllama
    $modelInstalled = $false
    if ($ollama.Ready -and (Test-Path -LiteralPath $ollamaExe)) {
        $modelInstalled = [bool]((& $ollamaExe list) -match [regex]::Escape($localModel))
    }
    $processor = 'not-loaded'
    if ($ollama.Ready -and (Test-Path -LiteralPath $ollamaExe)) {
        $processTable = (& $ollamaExe ps | Out-String)
        if ($processTable -match '100% GPU') { $processor = '100% GPU' }
        elseif ($processTable -match '100% CPU') { $processor = '100% CPU' }
        elseif ($processTable -match [regex]::Escape($localModel)) { $processor = 'mixed-or-unknown' }
    }

    [pscustomobject]@{
        ollama_ready = $ollama.Ready
        ollama_version = $ollama.Version
        model = $localModel
        model_installed = $modelInstalled
        total_ram_gib = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        free_ram_gib = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
        local_codex_config = Test-Path -LiteralPath (Join-Path $privateCodexHome 'config.toml')
        bind = '127.0.0.1:11434'
        processor = $processor
        recommended_igpu = 'disabled after repeatable shared-memory runner crashes; CPU is the stable lane'
    }
}

function Invoke-LocalCodex {
    param(
        [Parameter(Mandatory)] [ValidateSet('workspace-write', 'read-only')] [string]$Sandbox
    )

    if ([string]::IsNullOrWhiteSpace($Prompt)) {
        throw "-$Action requires -Prompt."
    }
    $health = Test-LocalOllama
    if (-not $health.Ready) {
        throw 'Ollama is not ready on loopback. Run status and start the local runtime first.'
    }
    $config = Join-Path $privateCodexHome 'config.toml'
    if (-not (Test-Path -LiteralPath $config)) {
        throw "Missing private Codex config: $config"
    }

    $context = Get-BoundedContext -Path $ContextBundle -MaximumBytes 6144
    $taskPrompt = if ($context) { "$context`n`n# Assigned task`n$Prompt" } else { $Prompt }
    if ([System.Text.Encoding]::UTF8.GetByteCount($taskPrompt) -gt 6144) {
        throw 'Rendered laptop prompt exceeds the conservative 6 KiB admission limit.'
    }
    $arguments = @('exec', '--strict-config', '--ephemeral', '--sandbox', $Sandbox, $taskPrompt)
    if ($DryRun) {
        [pscustomobject]@{
            executable = 'codex'
            sandbox = $Sandbox
            provider = 'yellow_ollama'
            model = $localModel
            context_bundle = [bool]$context
            bypass = $false
        } | ConvertTo-Json
        return
    }

    $previousCodexHome = $env:CODEX_HOME
    try {
        $env:CODEX_HOME = $privateCodexHome
        Push-Location $repoRoot
        & codex @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Local Codex exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
        $env:CODEX_HOME = $previousCodexHome
    }
}

switch ($Action) {
    'status' {
        Get-YellowAiStatus | ConvertTo-Json
    }
    'start' {
        if ($DryRun) {
            '{"action":"start","bind":"127.0.0.1:11434","model_limit":1,"parallel":1,"context":4096,"vulkan":false,"igpu":false}'
            break
        }
        $health = Test-LocalOllama
        if (-not $health.Ready) {
            $previous = @{
                OLLAMA_HOST = $env:OLLAMA_HOST; OLLAMA_MODELS = $env:OLLAMA_MODELS
                OLLAMA_MAX_LOADED_MODELS = $env:OLLAMA_MAX_LOADED_MODELS
                OLLAMA_NUM_PARALLEL = $env:OLLAMA_NUM_PARALLEL
                OLLAMA_CONTEXT_LENGTH = $env:OLLAMA_CONTEXT_LENGTH
                OLLAMA_NO_CLOUD = $env:OLLAMA_NO_CLOUD; OLLAMA_VULKAN = $env:OLLAMA_VULKAN
                OLLAMA_IGPU_ENABLE = $env:OLLAMA_IGPU_ENABLE
            }
            try {
                $env:OLLAMA_HOST = '127.0.0.1:11434'; $env:OLLAMA_MODELS = 'E:\yellow\ollama\models'
                $env:OLLAMA_MAX_LOADED_MODELS = '1'; $env:OLLAMA_NUM_PARALLEL = '1'
                # The 9B model plus an 8K KV cache is unstable on this 15 GiB host.
                # Keep a useful coding window while leaving enough memory for Goose
                # and the Codex desktop shell.
                $env:OLLAMA_CONTEXT_LENGTH = '4096'; $env:OLLAMA_NO_CLOUD = 'true'
                # The integrated/shared-memory Vulkan runner repeatedly exited while
                # loading qwen3.5:9b. Prefer the slower stable CPU lane over crashes.
                $env:OLLAMA_VULKAN = '0'; $env:OLLAMA_IGPU_ENABLE = '0'
                Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
            }
            finally {
                foreach ($name in $previous.Keys) { Set-Item -Path "Env:$name" -Value $previous[$name] -ErrorAction SilentlyContinue }
            }
            $deadline = (Get-Date).AddSeconds(45)
            do { Start-Sleep -Milliseconds 500; $health = Test-LocalOllama } until ($health.Ready -or (Get-Date) -ge $deadline)
            if (-not $health.Ready) { throw 'Ollama did not become ready within 45 seconds.' }
        }
        Get-YellowAiStatus | ConvertTo-Json
    }
    'prepare' {
        if ($DryRun) {
            '{"action":"prepare","model":"qwen3.5:9b","destructive":false}'
            break
        }
        if (-not (Test-Path -LiteralPath $ollamaExe)) {
            throw "Ollama executable not found at $ollamaExe"
        }
        & $ollamaExe stop $localModel 2>$null
        Get-YellowAiStatus | ConvertTo-Json
    }
    'local-implement' {
        Invoke-LocalCodex -Sandbox 'workspace-write'
    }
    'local-review' {
        Invoke-LocalCodex -Sandbox 'read-only'
    }
    'omni' {
        $gateway = Join-Path $repoRoot 'tools\build-continuity\omniroute.py'
        if (-not (Test-Path -LiteralPath $gateway)) {
            throw "Missing reviewed OmniRoute launcher: $gateway"
        }
        if ($DryRun) {
            '{"executable":"python","action":"--serve","bind":"127.0.0.1","bypass":false}'
            break
        }
        & python $gateway --serve
        if ($LASTEXITCODE -ne 0) {
            throw "OmniRoute exited with code $LASTEXITCODE."
        }
    }
}
