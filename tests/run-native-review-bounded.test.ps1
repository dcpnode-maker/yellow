[CmdletBinding()]
param()

# Executable synthetic proof for Order443. No production app, Bun, database or physical
# disk-fill operation is used.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path $PSScriptRoot -Parent
$supervisor = Join-Path $repositoryRoot 'scripts\run-native-review-bounded.ps1'
$fixtureRoots = [Collections.Generic.List[string]]::new()
$passed = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
    $script:passed++
}

function Write-Utf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}

function Invoke-Supervisor([string]$CaseRoot, [string]$ChildScript, [string]$SpaceFile, [long]$Limit = 1024, [long]$Minimum = 100, [long]$Critical = 100, [int]$Poll = 25) {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in @(
        '-NoLogo', '-NoProfile', '-NonInteractive', '-File', $supervisor, '-TestMode',
        '-TestRoot', $CaseRoot, '-TestChildScript', $ChildScript,
        '-TestFreeSpaceSequenceFile', $SpaceFile,
        '-TestPerFileByteLimit', $Limit,
        '-TestRuntimeMinimumFreeBytes', $Minimum,
        '-TestSystemMinimumFreeBytes', $Minimum,
        '-TestRuntimeCriticalFreeBytes', $Critical,
        '-TestSystemCriticalFreeBytes', $Critical,
        '-TestPollMilliseconds', $Poll
    )) { [void]$startInfo.ArgumentList.Add([string]$argument) }
    $process = [Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $stdout; Stderr = $stderr }
}

function New-Case([string]$Name, [string]$ChildBody, [object[]]$SpaceSamples) {
    $caseRoot = Join-Path 'D:\Yellow\temp' ('yellow-native-review-bounded-' + [Guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($caseRoot) | Out-Null
    $fixtureRoots.Add($caseRoot)
    $child = Join-Path $caseRoot 'synthetic-child.ps1'
    $space = Join-Path $caseRoot 'space.json'
    Write-Utf8 $child $ChildBody
    Write-Utf8 $space ($SpaceSamples | ConvertTo-Json -Depth 3 -Compress)
    return [pscustomobject]@{ Root = $caseRoot; Child = $child; Space = $space }
}

try {
    $oversized = New-Case 'oversized' @'
$stdout = [Console]::OpenStandardOutput()
$stderr = [Console]::OpenStandardError()
$outBytes = [byte[]]::new(12288)
$errBytes = [byte[]]::new(12288)
[Array]::Fill[byte]($outBytes, 79)
[Array]::Fill[byte]($errBytes, 69)
$stdout.Write($outBytes, 0, $outBytes.Length)
$stderr.Write($errBytes, 0, $errBytes.Length)
$stdout.Flush()
$stderr.Flush()
exit 0
'@ @(@{ RuntimeFreeBytes = 1000; SystemFreeBytes = 1000 })
    $oversizedResult = Invoke-Supervisor $oversized.Root $oversized.Child $oversized.Space
    Assert-True ($oversizedResult.ExitCode -eq 0) 'oversized child should exit successfully'
    foreach ($stream in @('stdout', 'stderr')) {
        $files = @(Get-ChildItem -LiteralPath $oversized.Root -Filter "supervisor.$stream.*.log")
        Assert-True ($files.Count -eq 3) "$stream should retain exactly three files"
        Assert-True (($files | Measure-Object Length -Maximum).Maximum -le 1024) "$stream files must not exceed the per-file byte cap"
        Assert-True (($files | Measure-Object Length -Sum).Sum -le 3072) "$stream retained bytes must not exceed three file caps"
        Assert-True (($files | Where-Object Length -eq 1024).Count -eq 3) "$stream should retain exactly 3072 bytes for divisible oversized output"
    }
    $oversizedStatus = Get-Content -LiteralPath (Join-Path $oversized.Root 'supervisor.status.json') -Raw | ConvertFrom-Json
    Assert-True ($oversizedStatus.reason -eq 'child_exit') 'oversized output must not change the child-exit reason'
    Assert-True ($oversizedStatus.launchCount -eq 1) 'oversized child must launch once'

    $singleExit = New-Case 'single-exit' @'
$countPath = Join-Path $PSScriptRoot 'launch-count.txt'
$count = if (Test-Path -LiteralPath $countPath) { [int](Get-Content -LiteralPath $countPath -Raw) } else { 0 }
[IO.File]::WriteAllText($countPath, [string]($count + 1))
exit 7
'@ @(@{ RuntimeFreeBytes = 1000; SystemFreeBytes = 1000 })
    $singleExitResult = Invoke-Supervisor $singleExit.Root $singleExit.Child $singleExit.Space
    Assert-True ($singleExitResult.ExitCode -eq 7) 'supervisor should propagate an ordinary child exit code'
    Assert-True ((Get-Content -LiteralPath (Join-Path $singleExit.Root 'launch-count.txt') -Raw) -eq '1') 'child exit must not trigger a retry'
    $singleExitStatus = Get-Content -LiteralPath (Join-Path $singleExit.Root 'supervisor.status.json') -Raw | ConvertFrom-Json
    Assert-True ($singleExitStatus.launchCount -eq 1 -and $singleExitStatus.childExitCode -eq 7) 'status must record one launch and the child exit'

    $preflight = New-Case 'preflight-low' @'
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'should-not-run.txt'), 'ran')
exit 0
'@ @(@{ RuntimeFreeBytes = 99; SystemFreeBytes = 1000 })
    $preflightResult = Invoke-Supervisor $preflight.Root $preflight.Child $preflight.Space
    Assert-True ($preflightResult.ExitCode -eq 20) 'low runtime free space must refuse launch'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $preflight.Root 'should-not-run.txt'))) 'preflight refusal must not create a child'
    $preflightStatus = Get-Content -LiteralPath (Join-Path $preflight.Root 'supervisor.status.json') -Raw | ConvertFrom-Json
    Assert-True ($preflightStatus.reason -eq 'preflight_runtime_low_space' -and $null -eq $preflightStatus.childPid -and $preflightStatus.launchCount -eq 0) 'preflight status must record no child launch'

    $failStop = New-Case 'critical-low' @'
$pidPath = Join-Path $PSScriptRoot 'child.pid'
[IO.File]::WriteAllText($pidPath, [string]$PID)
while ($true) { [Threading.Thread]::Sleep(50) }
'@ @(
        @{ RuntimeFreeBytes = 1000; SystemFreeBytes = 1000 },
        @{ RuntimeFreeBytes = 99; SystemFreeBytes = 1000 }
    )
    $failStopResult = Invoke-Supervisor $failStop.Root $failStop.Child $failStop.Space
    Assert-True ($failStopResult.ExitCode -eq 21) 'critical runtime free-space breach must fail-stop'
    $failStopStatus = Get-Content -LiteralPath (Join-Path $failStop.Root 'supervisor.status.json') -Raw | ConvertFrom-Json
    $ownedPid = [int]$failStopStatus.childPid
    Assert-True ($ownedPid -gt 0 -and $null -eq (Get-Process -Id $ownedPid -ErrorAction SilentlyContinue)) 'critical-space stop must clean up the exact owned child'
    Assert-True ($failStopStatus.reason -eq 'critical_runtime_low_space' -and $failStopStatus.launchCount -eq 1 -and $null -ne $failStopStatus.childExitCode) 'fail-stop status must preserve owned-child identity and exit'

    $statusFiles = @($fixtureRoots | ForEach-Object { Get-Item -LiteralPath (Join-Path $_ 'supervisor.status.json') })
    Assert-True (($statusFiles | Measure-Object Length -Maximum).Maximum -le 32768) 'every status receipt must stay within its byte bound'
    Write-Output "PASS: $passed assertions; synthetic fixtures retained: $($fixtureRoots -join ', ')"
} catch {
    Write-Error $_
    Write-Output "FAIL: synthetic fixtures retained: $($fixtureRoots -join ', ')"
    exit 1
}
