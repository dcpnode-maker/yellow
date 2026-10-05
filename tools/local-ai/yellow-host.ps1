[CmdletBinding()]
param(
    [ValidateSet('status', 'review-start', 'review-stop')]
    [string]$Action = 'status',
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Exact retained Order-592 public-review runtime. Nothing here deletes containers
# or volumes. A later release order must replace this manifest deliberately.
$containers = [ordered]@{
    postgres = '9f507e09cc38'
    valkey = '781c68656c43'
    app = 'dbe35dabd624'
    tunnel = 'e17219ecd7aa'
}

function Test-DockerReady {
    $null = & docker info --format '{{.ServerVersion}}' 2>$null
    return [bool]($LASTEXITCODE -eq 0)
}

function Get-RuntimeState {
    $ready = Test-DockerReady
    $states = @()
    foreach ($role in $containers.Keys) {
        $state = 'desktop-offline'
        if ($ready) {
            $state = (& docker inspect --format '{{.State.Status}}' $containers[$role] 2>$null)
            if ($LASTEXITCODE -ne 0) { $state = 'missing' }
        }
        $states += [pscustomobject]@{ role = $role; id = $containers[$role]; state = $state }
    }
    [pscustomobject]@{ docker_ready = $ready; containers = $states }
}

if ($Action -eq 'status') {
    Get-RuntimeState | ConvertTo-Json -Depth 4
    exit 0
}

if ($DryRun) {
    [pscustomobject]@{ action = $Action; container_ids = @($containers.Values); deletes = $false } |
        ConvertTo-Json -Depth 3
    exit 0
}

if ($Action -eq 'review-start') {
    & docker desktop start
    if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop did not accept the start request.' }
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline -and -not (Test-DockerReady)) {
        Start-Sleep -Seconds 2
    }
    if (-not (Test-DockerReady)) { throw 'Docker Desktop did not become ready within 60 seconds.' }
    foreach ($role in @('postgres', 'valkey', 'app', 'tunnel')) {
        & docker start $containers[$role] | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to start retained $role container." }
    }
}
else {
    if (Test-DockerReady) {
        foreach ($role in @('tunnel', 'app', 'valkey', 'postgres')) {
            & docker stop --time 20 $containers[$role] | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Failed to stop retained $role container." }
        }
        & docker desktop stop
        if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop did not accept the stop request.' }
    }
}

Get-RuntimeState | ConvertTo-Json -Depth 4
