[CmdletBinding()]
param([ValidateSet('Provision', 'Serve', 'Smoke')][string]$Action = 'Provision')

$ErrorActionPreference = 'Stop'
$source = 'D:\Yellow\runtime\free-claude-code\source'
$configRoot = 'D:\Yellow\runtime\free-claude-code\config'
$python = 'D:\Yellow\runtime\free-claude-code\venv\Scripts\python.exe'
$expectedCommit = 'bf59598ccc04b02befa1d649dfbcc569534c365c'
$homeConfig = Join-Path $env:USERPROFILE '.fcc'
$local = Join-Path $PSScriptRoot 'fcc_local.py'

function Assert-PrivateDirectory([string]$Path) {
    $acl = Get-Acl -LiteralPath $Path
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $owner = ([Security.Principal.NTAccount]::new([string]$acl.Owner)).Translate([Security.Principal.SecurityIdentifier]).Value
    $rules = @($acl.Access | Where-Object { $_.AccessControlType -eq 'Allow' })
    if ($owner -ne $sid -or $rules.Count -ne 1 -or
        $rules[0].IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $sid -or
        -not $rules[0].FileSystemRights.HasFlag([Security.AccessControl.FileSystemRights]::FullControl)) {
        throw 'FCC private directory ACL is not current-user-only.'
    }
}

function Initialize-FccLocal {
    if (-not (Test-Path -LiteralPath $source -PathType Container) -or -not (Test-Path -LiteralPath $python -PathType Leaf)) {
        throw 'Pinned FCC source or virtual environment is unavailable.'
    }
    $git = 'C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'
    if (-not (Test-Path -LiteralPath $git -PathType Leaf)) { throw 'Pinned native Git is unavailable.' }
    if ((& $git -C $source rev-parse HEAD).Trim() -ne $expectedCommit) { throw 'FCC source pin mismatch.' }
    if (-not (Test-Path -LiteralPath $configRoot -PathType Container)) { New-Item -ItemType Directory -Path $configRoot | Out-Null }
    Assert-PrivateDirectory $configRoot
    if (-not (Test-Path -LiteralPath $homeConfig)) {
        New-Item -ItemType Junction -Path $homeConfig -Target $configRoot | Out-Null
    }
    $junction = Get-Item -LiteralPath $homeConfig -Force
    if ($junction.LinkType -ne 'Junction' -or @($junction.Target)[0].TrimEnd('\') -ne $configRoot.TrimEnd('\')) {
        throw 'Existing C:\Users\astha\.fcc is not the expected D: junction.'
    }
    & $python $local provision
    if ($LASTEXITCODE -ne 0) { throw 'FCC configuration provisioning failed.' }
}

function Get-Secret([string]$Name) {
    $value = [IO.File]::ReadAllText((Join-Path $configRoot $Name))
    if ([string]::IsNullOrWhiteSpace($value)) { throw 'FCC local secret is unavailable.' }
    return $value
}

function Invoke-FccSmoke {
    if (@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq 18082).Count -ne 0) {
        throw 'FCC smoke refuses an occupied port18082.'
    }
    $dashboard = Get-Secret 'dashboard-secret.txt'
    $api = (Get-Content -LiteralPath (Join-Path $configRoot '.env') | Where-Object { $_ -like 'ANTHROPIC_AUTH_TOKEN=*' }).Substring(21)
    $stdout = Join-Path $configRoot 'smoke-server.out'
    $stderr = Join-Path $configRoot 'smoke-server.err'
    $process = Start-Process -FilePath $python -ArgumentList @($local, 'serve') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $client = [Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromSeconds(2)
    try {
        $basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("yellow:$dashboard"))
        for ($i = 0; $i -lt 20; $i++) {
            if ($process.HasExited) { throw 'Owned FCC smoke process exited before readiness.' }
            $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq 18082)
            if ($listeners.Count -eq 0) { Start-Sleep -Milliseconds 250; continue }
            if (@($listeners | Where-Object { $_.OwningProcess -ne $process.Id -or $_.LocalAddress -ne '127.0.0.1' }).Count -ne 0) {
                throw 'FCC listener is not the owned loopback child; credentials not sent.'
            }
            try {
                $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, 'http://127.0.0.1:18082/health')
                $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $api)
                $health = $client.Send($request)
                if ($health.StatusCode -eq [Net.HttpStatusCode]::OK) { break }
            } catch {}
            Start-Sleep -Milliseconds 250
        }
        if ($null -eq $health -or $health.StatusCode -ne [Net.HttpStatusCode]::OK) { throw 'FCC health smoke did not become ready.' }
        if (($client.GetAsync('http://127.0.0.1:18082/admin').GetAwaiter().GetResult()).StatusCode -ne [Net.HttpStatusCode]::Unauthorized) { throw 'FCC unauthenticated dashboard was not rejected.' }
        $admin = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, 'http://127.0.0.1:18082/admin')
        $admin.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', $basic)
        if (($client.Send($admin)).StatusCode -ne [Net.HttpStatusCode]::OK) { throw 'FCC authenticated dashboard smoke failed.' }
        $blocked = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post, 'http://127.0.0.1:18082/v1/messages')
        $blocked.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', $basic)
        if (($client.Send($blocked)).StatusCode -ne [Net.HttpStatusCode]::MethodNotAllowed) { throw 'FCC inference mutation was not blocked.' }
    } finally {
        $client.Dispose()
        if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit(5000) | Out-Null }
    }
}

Initialize-FccLocal
if ($Action -eq 'Serve') { & $python $local serve; exit $LASTEXITCODE }
if ($Action -eq 'Smoke') { Invoke-FccSmoke }
