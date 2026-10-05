param(
    [switch]$Start,
    [ValidateRange(1, 60)][int]$CommandTimeoutSeconds = 8,
    [ValidateRange(10, 600)][int]$ReadinessTimeoutSeconds = 90,
    [ValidateRange(1, 10)][int]$PollIntervalSeconds = 2
)

$script:YellowStartupDotSourced = $MyInvocation.InvocationName -eq '.'

$script:YellowExpected = [ordered]@{
    postgres = 'yellow-public-demo-postgres-1'
    valkey   = 'yellow-public-demo-valkey-1'
    app      = 'yellow-public-demo-app-1'
    tunnel   = 'yellow-public-demo-tunnel'
}

function Invoke-YellowExternalCommand {
    param(
        [Parameter(Mandatory)][string]$Operation,
        [string[]]$Arguments = @(),
        [int]$TimeoutSeconds = 8
    )

    if ($Operation -eq 'HealthProbe') {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3010/health' -TimeoutSec $TimeoutSeconds -UseBasicParsing
            return [pscustomobject]@{ ExitCode = 0; StdOut = [string]$response.StatusCode; StdErr = ''; TimedOut = $false }
        } catch {
            $status = 0
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $status = [int]$_.Exception.Response.StatusCode }
            return [pscustomobject]@{ ExitCode = 1; StdOut = [string]$status; StdErr = 'Local /health probe did not succeed.'; TimedOut = $false }
        }
    }

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'docker'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    if ($Operation -eq 'DesktopStart') {
        foreach ($argument in @('desktop', 'start', '--detach', '--timeout', [string]$TimeoutSeconds)) { [void]$startInfo.ArgumentList.Add($argument) }
    } else {
        foreach ($argument in $Arguments) { [void]$startInfo.ArgumentList.Add($argument) }
    }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) { return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = 'Docker CLI did not start.'; TimedOut = $false } }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            # Only the bounded CLI child is stopped. This never targets the daemon or containers.
            try { $process.Kill() } catch { }
            return [pscustomobject]@{ ExitCode = 124; StdOut = ''; StdErr = 'Docker CLI call timed out.'; TimedOut = $true }
        }
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StdOut = $stdoutTask.GetAwaiter().GetResult()
            StdErr = $stderrTask.GetAwaiter().GetResult()
            TimedOut = $false
        }
    } catch {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = 'Docker CLI is unavailable or failed.'; TimedOut = $false }
    } finally {
        $process.Dispose()
    }
}

function Invoke-YellowStartup {
    [CmdletBinding()]
    param(
        [switch]$Start,
        [ValidateRange(1, 60)][int]$CommandTimeoutSeconds = 8,
        [ValidateRange(10, 600)][int]$ReadinessTimeoutSeconds = 90,
        [ValidateRange(1, 10)][int]$PollIntervalSeconds = 2,
        [scriptblock]$CommandExecutor = ${function:Invoke-YellowExternalCommand},
        [scriptblock]$SleepAction = { param([int]$Seconds) Start-Sleep -Seconds $Seconds },
        [scriptblock]$NowProvider = { [DateTimeOffset]::UtcNow }
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $deadline = (& $NowProvider).AddSeconds($ReadinessTimeoutSeconds)
    $invoke = {
        param([string]$Operation, [string[]]$Arguments = @())
        $effectiveTimeout = $CommandTimeoutSeconds
        if ($Start) {
            $remaining = [math]::Floor(($deadline - (& $NowProvider)).TotalSeconds)
            if ($remaining -lt 1) { return [pscustomobject]@{ ExitCode = 124; StdOut = ''; StdErr = ''; TimedOut = $true } }
            $effectiveTimeout = [math]::Max(1, [math]::Min($CommandTimeoutSeconds, $remaining))
        }
        & $CommandExecutor $Operation $Arguments $effectiveTimeout
    }
    $dockerInfo = & $invoke 'DockerInfo' @('info', '--format', '{{.ServerVersion}}')
    if ($dockerInfo.ExitCode -ne 0 -or $dockerInfo.TimedOut) {
        if (-not $Start) {
            $lines.Add('Docker Engine: unavailable; report only, no changes made.')
            $lines.Add('Action: start Docker Desktop manually, then rerun this report.')
            return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
        }
        $desktop = & $invoke 'DesktopStart' @()
        if ($desktop.ExitCode -ne 0) {
            $lines.Add('Docker Desktop: could not be started. Open it manually and rerun with -Start.')
            return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
        }
        $lines.Add('Docker Desktop: launch requested; waiting for Docker Engine.')
        do {
            & $SleepAction $PollIntervalSeconds
            $dockerInfo = & $invoke 'DockerInfo' @('info', '--format', '{{.ServerVersion}}')
            if ($dockerInfo.ExitCode -eq 0 -and -not $dockerInfo.TimedOut) { break }
        } while ((& $NowProvider) -lt $deadline)
        if ($dockerInfo.ExitCode -ne 0 -or $dockerInfo.TimedOut) {
            $lines.Add('Docker Engine: did not become available before the bounded timeout. No containers were stopped or cleaned up.')
            return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
        }
    }
    $lines.Add('Docker Engine: available.')

    $list = & $invoke 'List' @('container', 'ls', '--all', '--quiet', '--filter', 'label=com.docker.compose.project=yellow-public-demo')
    if ($list.ExitCode -ne 0 -or $list.TimedOut) {
        $lines.Add('Container discovery failed. Check Docker access and the yellow-public-demo project, then retry.')
        return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
    }
    $ids = @($list.StdOut -split "`r?`n" | Where-Object { $_.Trim() })
    if ($ids.Count -eq 0) {
        $lines.Add('No existing yellow-public-demo containers were found; this helper never creates containers.')
        $lines.Add('Action: restore the existing runtime through its owner-managed recovery process.')
        return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
    }
    if ($ids.Count -gt 32) {
        $lines.Add("Found $($ids.Count) containers labeled for the project; refusing discovery above the safe 32-container bound.")
        return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
    }

    $records = @()
    foreach ($id in $ids) {
        $inspect = & $invoke 'Inspect' @('inspect', '--format', '{{.Id}}|{{.Name}}|{{.State.Status}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .HostConfig.PortBindings}}|{{if index .State "Health"}}{{index (index .State "Health") "Status"}}{{else}}none{{end}}', $id)
        if ($inspect.ExitCode -ne 0 -or $inspect.TimedOut) {
            $lines.Add('A project container could not be inspected. No containers were started.')
            return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
        }
        $parts = $inspect.StdOut.Trim() -split '\|', 7
        if ($parts.Count -ne 7) { $lines.Add('Container metadata was incomplete; refusing to start anything.'); return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() } }
        $records += [pscustomobject]@{ Id = $parts[0]; Name = $parts[1].TrimStart('/'); State = $parts[2]; Project = $parts[3]; Service = $parts[4]; Ports = $parts[5]; Health = $parts[6] }
    }

    foreach ($service in $script:YellowExpected.Keys) {
        $matches = @($records | Where-Object { $_.Project -eq 'yellow-public-demo' -and $_.Service -eq $service })
        if ($matches.Count -ne 1) {
            $lines.Add("Expected exactly one existing $service container ($($script:YellowExpected[$service])); found $($matches.Count).")
            $lines.Add('Action: have the runtime owner restore the named container; this helper will not create or replace it.')
            return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
        }
        if ($matches[0].Name -ne $script:YellowExpected[$service]) {
            $lines.Add("The sole $service service container is named '$($matches[0].Name)', not the allowlisted '$($script:YellowExpected[$service])'; refusing to start.")
            return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
        }
    }
    $selected = @{}
    foreach ($service in $script:YellowExpected.Keys) { $selected[$service] = @($records | Where-Object { $_.Service -eq $service -and $_.Name -eq $script:YellowExpected[$service] })[0] }
    $appBindings = $null
    try { $appBindings = $selected.app.Ports | ConvertFrom-Json -ErrorAction Stop } catch { }
    $correctAppBinding = $false
    if ($appBindings -and $appBindings.'3000/tcp') {
        $published = @($appBindings.'3000/tcp')
        $correctAppBinding = $published.Count -eq 1 -and $published[0].HostIp -eq '127.0.0.1' -and $published[0].HostPort -eq '3010' -and @($appBindings.PSObject.Properties | Where-Object { $_.Name -ne '3000/tcp' }).Count -eq 0
    }
    if (-not $correctAppBinding) {
        $lines.Add('App host binding is not the expected loopback port 3010 -> container port 3000; refusing to start.')
        return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @() }
    }

    $lines.Add('Validated existing services: postgres, valkey, app, tunnel; project label and names match.')
    $lines.Add('App binding: 127.0.0.1:3010 -> container 3000/tcp.')
    foreach ($service in @('postgres', 'valkey', 'app', 'tunnel')) {
        $lines.Add("$service`: $($selected[$service].State); Docker health=$($selected[$service].Health).")
    }
    if (-not $Start) {
        $lines.Add('Report only: no containers or listeners were changed.')
        $lines.Add('Application readiness: not probed in report mode; Docker health is not application readiness.')
        $lines.Add('Public tunnel: not probed; reachability is unverified.')
        return [pscustomobject]@{ Success = $true; Lines = @($lines); Actions = @() }
    }

    $actions = [System.Collections.Generic.List[string]]::new()
    foreach ($service in @('postgres', 'valkey')) {
        if ($selected[$service].State -ne 'running') {
            $started = & $invoke 'StartContainer' @('start', $selected[$service].Id)
            if ($started.ExitCode -ne 0 -or $started.TimedOut) { $lines.Add("Could not start existing $service container; leaving runtime intact with no cleanup."); return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @($actions) } }
            $actions.Add("start:$service")
            $selected[$service].State = 'running'
        }
    }
    foreach ($service in @('postgres', 'valkey')) {
        $firstHealthCheck = $true
        while (($firstHealthCheck -or $selected[$service].State -ne 'running' -or $selected[$service].Health -ne 'healthy') -and (& $NowProvider) -lt $deadline) {
            $firstHealthCheck = $false
            $fresh = & $invoke 'Inspect' @('inspect', '--format', '{{.Id}}|{{.Name}}|{{.State.Status}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{json .HostConfig.PortBindings}}|{{if index .State "Health"}}{{index (index .State "Health") "Status"}}{{else}}none{{end}}', $selected[$service].Id)
            if ($fresh.ExitCode -ne 0 -or $fresh.TimedOut) { break }
            $parts = $fresh.StdOut.Trim() -split '\|', 7
            if ($parts.Count -eq 7) { $selected[$service].Health = $parts[6]; $selected[$service].State = $parts[2] }
            if ($selected[$service].Health -ne 'healthy') { & $SleepAction $PollIntervalSeconds }
        }
        if ($selected[$service].State -ne 'running' -or $selected[$service].Health -ne 'healthy') { $lines.Add("$service Docker health did not reach healthy before timeout; no cleanup was performed."); return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @($actions) } }
    }
    if ($selected.app.State -ne 'running') {
        $started = & $invoke 'StartContainer' @('start', $selected.app.Id)
        if ($started.ExitCode -ne 0 -or $started.TimedOut) { $lines.Add('Could not start existing app container; leaving runtime intact with no cleanup.'); return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @($actions) } }
        $actions.Add('start:app')
        $selected.app.State = 'running'
    }
    $ready = $false
    do {
        $probe = & $invoke 'HealthProbe' @()
        $ready = $probe.ExitCode -eq 0 -and $probe.StdOut -eq '200' -and -not $probe.TimedOut
        if (-not $ready -and (& $NowProvider) -lt $deadline) { & $SleepAction $PollIntervalSeconds }
    } while (-not $ready -and (& $NowProvider) -lt $deadline)
    if ($ready -and $selected.tunnel.State -ne 'running') {
        $started = & $invoke 'StartContainer' @('start', $selected.tunnel.Id)
        if ($started.ExitCode -ne 0 -or $started.TimedOut) { $lines.Add('Could not start existing tunnel container; app services remain running with no cleanup.'); return [pscustomobject]@{ Success = $false; Lines = @($lines); Actions = @($actions) } }
        $actions.Add('start:tunnel')
        $selected.tunnel.State = 'running'
    }
    if ($ready) {
        $lines.Add('Application probe: GET http://127.0.0.1:3010/health returned 200 (liveness/health only; not full business readiness).')
        $lines.Add('Public tunnel: existing container is running; external reachability was not probed and is unverified.')
    } else {
        $lines.Add('Application probe: /health did not return 200 within its bound; Docker health and app readiness remain distinct. No cleanup was performed.')
        if ($selected.tunnel.State -eq 'running') { $lines.Add('Public tunnel: existing container left as-is; reachability was not probed and is unverified.') }
        else { $lines.Add('Public tunnel: not started because the app probe failed; reachability is unverified.') }
    }
    return [pscustomobject]@{ Success = $ready; Lines = @($lines); Actions = @($actions) }
}

if (-not $script:YellowStartupDotSourced) {
    $result = Invoke-YellowStartup -Start:$Start -CommandTimeoutSeconds $CommandTimeoutSeconds -ReadinessTimeoutSeconds $ReadinessTimeoutSeconds -PollIntervalSeconds $PollIntervalSeconds
    $result.Lines | ForEach-Object { Write-Output $_ }
    if (-not $result.Success) { exit 1 }
}
