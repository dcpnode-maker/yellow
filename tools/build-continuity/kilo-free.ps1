# Native Windows entry point for the verified, proposal-only Kilo profile.
[CmdletBinding()]
param(
    [ValidateSet('Interactive', 'Login', 'Models', 'Run')]
    [string]$Action = 'Interactive',
    [ValidateSet('nvidia/nemotron-3-ultra-550b-a55b:free', 'cohere/north-mini-code:free')]
    [string]$ModelId = 'nvidia/nemotron-3-ultra-550b-a55b:free',
    [string]$PromptFile
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$gitExe = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
if (-not (Test-Path -LiteralPath $gitExe -PathType Leaf)) { throw 'Native Git is required.' }
$gitDirectory = (& $gitExe -C $projectRoot rev-parse --absolute-git-dir).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve this checkout metadata.' }
$private = Join-Path $gitDirectory 'yellow-continuity'
$privateItem = Get-Item -LiteralPath $private
if ($privateItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Private state must not be a junction.' }
$acl = Get-Acl -LiteralPath $private
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$rules = @($acl.Access)
if (-not $acl.AreAccessRulesProtected -or $rules.Count -ne 1 -or
    $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid -or
    $rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -cne $sid -or
    $rules[0].AccessControlType -ne 'Allow' -or
    $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) {
    throw 'Current-user-only private ACL is required.'
}
$binary = Join-Path $private 'cli\node_modules\@kilocode\cli-windows-x64-baseline\bin\kilo.exe'
if ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -cne
    '5D54B522D8A59228951D141CD70438C29115963ECB38D7CDFCF313F59C0F865B') {
    throw 'Installed Kilo 7.6.2 Windows binary differs from the accepted build.'
}
$settingsPath = Join-Path $PSScriptRoot 'kilo-free.json'
if ((Get-FileHash -LiteralPath $settingsPath -Algorithm SHA256).Hash -cne
    'F3492468FE20FF3E05C23B00C59757513BD32ABB5DCB0B536086B58FCAA7F602') {
    throw 'The complete accepted free-only profile has changed; reverify before running.'
}
if (Test-Path -LiteralPath (Join-Path $env:ProgramData 'kilo')) {
    throw 'Managed Kilo configuration exists; inspect its precedence before running.'
}
$settings = Get-Content -LiteralPath $settingsPath -Raw
$config = $settings | ConvertFrom-Json
$model = 'kilo/nvidia/nemotron-3-ultra-550b-a55b:free'
if ($config.model -cne $model -or $config.small_model -cne $model -or
    $config.agent.continuity.model -cne $model -or $config.permission -cne 'deny' -or
    @($config.enabled_providers).Count -ne 1 -or $config.enabled_providers[0] -cne 'kilo' -or
    @($config.provider.kilo.whitelist).Count -ne 1 -or
    $config.provider.kilo.whitelist[0] -cne $model.Substring(5)) {
    throw 'The explicit free-only, proposal-only model profile differs.'
}
$model = 'kilo/' + $ModelId
$config.model = $model
$config.small_model = $model
$config.agent.continuity.model = $model
$config.provider.kilo.whitelist = @($ModelId)
$settings = $config | ConvertTo-Json -Depth 10 -Compress
if ($Action -ne 'Login') {
    # Public catalogue only: no key or private account information is sent.
    $catalogue = Invoke-RestMethod -Uri 'https://app.kilo.ai/api/openrouter/models' -TimeoutSec 20
    $records = @($catalogue.data | Where-Object { $_.id -ceq $model.Substring(5) })
    if ($records.Count -ne 1) { throw 'Free model is missing or duplicated in the current catalogue.' }
    $prices = $records[0].pricing
    if ($null -eq $prices -or $null -eq $prices.prompt -or $null -eq $prices.completion) {
        throw 'Current input/output price is unknown.'
    }
    foreach ($price in $prices.PSObject.Properties.Value) {
        # The official catalogue uses decimal strings. Reject other types and
        # nonzero mantissas lexically: numeric conversion could underflow to zero.
        $integerZero = ($price -is [int] -or $price -is [long]) -and $price -eq 0
        $stringZero = $price -is [string] -and
            $price.Trim() -match '^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[eE][+-]?\d+)?$'
        if (-not ($integerZero -or $stringZero)) {
            throw 'A nonzero or unknown price was returned; no model request started.'
        }
    }
}
$changes = @{
    PATH = (Split-Path $gitExe -Parent) + ';' + $env:PATH
    XDG_DATA_HOME = (Join-Path $private 'kilo-data')
    XDG_CONFIG_HOME = (Join-Path $private 'kilo-config')
    XDG_CACHE_HOME = (Join-Path $private 'kilo-cache')
    XDG_STATE_HOME = (Join-Path $private 'kilo-state')
    KILO_CONFIG_CONTENT = $settings
    KILO_DISABLE_PROJECT_CONFIG = 'true'
    KILO_DISABLE_SESSION_INGEST = '1'
    KILO_DISABLE_SHARE = '1'
    KILO_TELEMETRY_LEVEL = 'off'
    KILO_REMOTE = $null
    KILO_DISABLE_DEFAULT_PLUGINS = $null
    OTEL_EXPORTER_OTLP_ENDPOINT = $null
    OTEL_EXPORTER_OTLP_HEADERS = $null
    DO_NOT_TRACK = '1'
}
$previous = @{}
foreach ($name in $changes.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    foreach ($name in $changes.Keys) {
        if ($null -eq $changes[$name]) { Remove-Item -LiteralPath ('Env:' + $name) -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($name, $changes[$name], 'Process') }
    }
    Push-Location -LiteralPath $projectRoot
    try {
        switch ($Action) {
            'Login' { & $binary auth login --provider kilo --pure }
            'Models' { & $binary models kilo --pure }
            'Interactive' { & $binary $projectRoot --pure --model $model --agent continuity }
            'Run' {
                if (-not $PromptFile) { throw 'Run requires an explicit coordinator-written -PromptFile.' }
                $inputFile = Get-Item -LiteralPath $PromptFile
                if ($inputFile.PSIsContainer -or $inputFile.Length -gt 160000 -or
                    $inputFile.DirectoryName -ine $privateItem.FullName -or
                    $inputFile.Name -notmatch '^(worker-[a-z0-9-]+|[a-z0-9-]+-prompt)\.txt$' -or
                    ($inputFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                    throw 'Prompt must be a curated worker-*.txt or *-prompt.txt directly in protected private state.'
                }
                $prompt = Get-Content -LiteralPath $inputFile.FullName -Raw
                & $binary run --pure --model $model --agent continuity --format json --title 'Yellow bounded free worker' $prompt
            }
        }
        if ($LASTEXITCODE -ne 0) { throw 'Kilo stopped without successful completion. No paid fallback will be attempted.' }
    } finally { Pop-Location }
} finally {
    foreach ($name in $previous.Keys) {
        if ($null -eq $previous[$name]) { Remove-Item -LiteralPath ('Env:' + $name) -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    }
}
