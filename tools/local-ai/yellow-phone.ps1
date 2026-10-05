[CmdletBinding()]
param(
    [ValidateSet('status', 'pair', 'connect', 'install', 'launch-termux', 'tunnel')]
    [string]$Action = 'status',
    [string]$Endpoint,
    [string]$PairingCode,
    [string]$Device,
    [ValidateSet('oneplus-10r', 'oneplus-11r', 'oneplus-nord5')]
    [string]$Node = 'oneplus-10r',
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$privateAndroid = Join-Path $repoRoot '.git\yellow-local-ai\android'
$adb = Join-Path $privateAndroid 'platform-tools\adb.exe'
$apkRoot = Join-Path $privateAndroid 'apks'
$workersFile = Join-Path $PSScriptRoot 'workers.json'
$apkProof = [ordered]@{
    'termux_0.118.3.apk' = @{ Bytes = 113880067; Sha256 = 'E6265A57EB5CA363808488E3B01955958BED93BC0C8A0D281849B363B11027EC' }
    'termux-boot_0.8.1.apk' = @{ Bytes = 26000; Sha256 = '6F7CF9B94F539D3EFD4AF3544FF819947B49395275D8CFA7E5F80DE14F3D9CF8' }
    'termux-api_0.53.0.apk' = @{ Bytes = 3956196; Sha256 = '4497DBBF81906DF52E59ED387A5223D225AA0DE3ACA817CC557A621E4DADDA44' }
}

function Assert-Adb {
    if (-not (Test-Path -LiteralPath $adb)) {
        throw "Google platform-tools are missing at $adb"
    }
}

function Invoke-SafeAdbPair {
    if ($Endpoint -notmatch '^[A-Za-z0-9.:-]+:[0-9]{2,5}$') { throw 'Pairing endpoint must be host:port.' }
    if ($PairingCode -notmatch '^[0-9]{6}$') { throw 'Pairing code must contain exactly six digits.' }
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $adb
    $psi.ArgumentList.Add('pair')
    $psi.ArgumentList.Add($Endpoint)
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::Start($psi)
    $process.StandardInput.WriteLine($PairingCode)
    $process.StandardInput.Close()
    $process.WaitForExit()
    $output = $process.StandardOutput.ReadToEnd()
    $errorOutput = $process.StandardError.ReadToEnd()
    if ($process.ExitCode -ne 0) { throw "ADB pairing failed: $errorOutput" }
    # ADB's success text contains no secret. Never echo the pairing code.
    $output.Trim()
}

function Assert-VerifiedApk {
    param([Parameter(Mandatory)][string]$Name)
    $proof = $apkProof[$Name]
    if ($null -eq $proof) { throw "No pinned proof for APK: $Name" }
    $path = Join-Path $apkRoot $Name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing verified APK: $path" }
    $item = Get-Item -LiteralPath $path
    if ($item.Length -ne $proof.Bytes) { throw "APK byte count differs from pinned proof: $Name" }
    $digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
    if ($digest -ne $proof.Sha256) { throw "APK digest differs from pinned proof: $Name" }
    return $path
}

Assert-Adb

switch ($Action) {
    'status' {
        Write-Output 'Wireless ADB services:'
        & $adb mdns services
        Write-Output 'Authorized devices:'
        & $adb devices -l
    }
    'pair' {
        if ($DryRun) { '{"action":"pair","secret_printed":false}'; break }
        Invoke-SafeAdbPair
    }
    'connect' {
        if ($Endpoint -notmatch '^[A-Za-z0-9.:-]+:[0-9]{2,5}$') { throw 'Connection endpoint must be host:port.' }
        if ($DryRun) { [pscustomobject]@{ action='connect'; endpoint=$Endpoint } | ConvertTo-Json; break }
        & $adb connect $Endpoint
        if ($LASTEXITCODE -ne 0) { throw 'ADB connection failed.' }
    }
    'install' {
        if ([string]::IsNullOrWhiteSpace($Device)) { throw '-Device is required for installation.' }
        $apks = @($apkProof.Keys)
        foreach ($apkName in $apks) {
            $apk = Assert-VerifiedApk -Name $apkName
            if (-not $DryRun) {
                & $adb -s $Device install -r --no-streaming $apk
                if ($LASTEXITCODE -ne 0) { throw "Installation failed for $apkName" }
            }
        }
        if ($DryRun) { [pscustomobject]@{ action='install'; device=$Device; packages=$apks } | ConvertTo-Json }
        else { & $adb -s $Device shell pm list packages com.termux }
    }
    'launch-termux' {
        if ([string]::IsNullOrWhiteSpace($Device)) { throw '-Device is required.' }
        if ($DryRun) { [pscustomobject]@{ action='launch-termux'; device=$Device } | ConvertTo-Json; break }
        & $adb -s $Device shell am start -n com.termux/.app.TermuxActivity
        if ($LASTEXITCODE -ne 0) { throw 'Termux launch failed.' }
    }
    'tunnel' {
        $workers = Get-Content -Raw -LiteralPath $workersFile | ConvertFrom-Json
        $worker = $workers.workers | Where-Object { $_.id -eq $Node } | Select-Object -First 1
        if ($null -eq $worker) { throw "Unknown worker $Node" }
        if ([string]::IsNullOrWhiteSpace($worker.ssh_host) -or [string]::IsNullOrWhiteSpace($worker.ssh_user)) {
            throw "Worker $Node has not completed authenticated SSH pairing."
        }
        $forward = "$($worker.laptop_port):127.0.0.1:$($worker.inference_port)"
        if ($DryRun) {
            [pscustomobject]@{ action='tunnel'; node=$Node; forward=$forward; public_bind=$false } | ConvertTo-Json
            break
        }
        & ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes -p $worker.ssh_port -L $forward "$($worker.ssh_user)@$($worker.ssh_host)"
        if ($LASTEXITCODE -ne 0) { throw "SSH tunnel for $Node failed." }
    }
}
