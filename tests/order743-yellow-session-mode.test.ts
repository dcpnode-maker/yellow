import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';

const scriptPath = resolve(import.meta.dir, '../scripts/enter-yellow-mode.ps1');
const helperSource = readFileSync(scriptPath, 'utf8');

function runPowerShell(body: string): string {
  const encoded = Buffer.from(body, 'utf16le').toString('base64');
  const result = spawnSync(process.env.YELLOW_PWSH ?? 'pwsh', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded,
  ], { encoding: 'utf8', timeout: 25_000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`PowerShell test host failed (${result.status}): ${result.stderr}`);
  return result.stdout.trim();
}

function parseReport(output: string): Record<string, any> {
  try { return JSON.parse(output); } catch { throw new Error(`Invalid mocked report JSON: ${JSON.stringify(output)}`); }
}

const mockBootstrap = `
. '${scriptPath.replaceAll("'", "''")}'
$script:callLog = [System.Collections.Generic.List[string]]::new()
$script:currentSession = [System.Diagnostics.Process]::GetCurrentProcess().SessionId

$script:procStore = [System.Collections.Generic.List[psobject]]::new()
$script:procStore.Add([pscustomobject]@{
    Id = 101; ProcessName = 'Spotify'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]1234; WorkingSet64 = 300MB;
    StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\Program Files\\Spotify\\Spotify.exe'; OriginalProcess = $null
})
$script:procStore.Add([pscustomobject]@{
    Id = 102; ProcessName = 'Discord'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]5678; WorkingSet64 = 400MB;
    StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\Program Files\\Discord\\Discord.exe'; OriginalProcess = $null
})
$script:procStore.Add([pscustomobject]@{
    Id = 201; ProcessName = 'codex'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]9999; WorkingSet64 = 600MB;
    StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\codex\\codex.exe'; OriginalProcess = $null
})
$script:procStore.Add([pscustomobject]@{
    Id = 202; ProcessName = 'Zed'; SessionId = ($script:currentSession + 99); MainWindowHandle = [IntPtr]1111; WorkingSet64 = 250MB;
    StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\Zed\\Zed.exe'; OriginalProcess = $null
})
$script:procStore.Add([pscustomobject]@{
    Id = 203; ProcessName = 'Slack'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]2222; WorkingSet64 = 350MB;
    StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\Slack\\slack.exe'; OriginalProcess = $null
})
$script:procStore.Add([pscustomobject]@{
    Id = 204; ProcessName = 'Teams'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]0; WorkingSet64 = 150MB;
    StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\Teams\\teams.exe'; OriginalProcess = $null
})

$procProvider = {
    $script:callLog.Add('GetProcesses')
    return ,$script:procStore.ToArray()
}
$memProvider = {
    $script:callLog.Add('GetRam')
    return [int64]8589934592 # 8GB
}
$closeAdapter = {
    param($p)
    $script:callLog.Add("CloseMainWindow:$($p.Id)")
    return $true
}
$waitAdapter = {
    param($procObj, $timeout, $provider, $sleepAct, $nowProv)
    $script:callLog.Add("WaitExit:$($procObj.Id):$($timeout)")
    return $true
}
`;

describe('Order 743 Yellow Session Mode Helper', () => {
  test('PowerShell parser accepts the helper without syntax errors', () => {
    const output = runPowerShell(`
      $tokens = $null; $errors = $null
      [System.Management.Automation.Language.Parser]::ParseFile('${scriptPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors) | Out-Null
      if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }
      'parser-ok'
    `);
    expect(output).toBe('parser-ok');
  });

  test('default mode is read-only report, retains top process footprints, and candidate section excludes protected/ineligible apps', () => {
    const output = runPowerShell(`${mockBootstrap}
      $result = Invoke-YellowSessionMode -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$result.Success; Actions=$result.Actions; Calls=@($callLog); Lines=$result.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Actions).toEqual([]);
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow'))).toBe(false);
    expect(report.Lines.join('\n')).toContain('Mode: Read-only report. No processes were modified.');
    expect(report.Lines.join('\n')).toContain('Process: codex (Instances: 1)');

    const candidateLines = report.Lines.slice(report.Lines.findIndex((l: string) => l.includes('Eligible optional app candidates')));
    const candidateText = candidateLines.join('\n');
    expect(candidateText).toContain('PID: 101 | Name: Spotify');
    expect(candidateText).toContain('PID: 102 | Name: Discord');
    expect(candidateText).not.toContain('Name: codex');
    expect(candidateText).not.toContain('Name: Slack');
    expect(candidateText).not.toContain('PID: 202');
    expect(candidateText).not.toContain('PID: 204');
  });

  test('zero candidates and singleton candidate are handled cleanly', () => {
    const output = runPowerShell(`${mockBootstrap}
      $zeroProc = { return ,@() }
      $rZero = Invoke-YellowSessionMode -ProcessProvider $zeroProc -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter

      $singleProc = { return ,@($script:procStore[0]) }
      $rSingle = Invoke-YellowSessionMode -ProcessProvider $singleProc -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ ZeroSuccess=$rZero.Success; ZeroLines=$rZero.Lines; SingleSuccess=$rSingle.Success; SingleLines=$rSingle.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.ZeroSuccess).toBe(true);
    expect(report.ZeroLines.join('\n')).toContain('(None found)');
    expect(report.SingleSuccess).toBe(true);
    expect(report.SingleLines.join('\n')).toContain('PID: 101 | Name: Spotify');
  });

  test('snapshot flattening correctly unpacks nested unary comma arrays from injected providers', () => {
    const output = runPowerShell(`${mockBootstrap}
      $nestedProvider = {
          $item = $script:procStore[0]
          return ,@($item)
      }
      $r = Invoke-YellowSessionMode -ProcessProvider $nestedProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$r.Success; Lines=$r.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Lines.join('\n')).toContain('PID: 101 | Name: Spotify');
  });

  test('fails if -Apply specified without -ConfirmSavedWork or without -ProcessIds', () => {
    const output = runPowerShell(`${mockBootstrap}
      $r1 = Invoke-YellowSessionMode -Apply -Confirm:$false -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $r2 = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ R1Success=$r1.Success; R1Lines=$r1.Lines; R2Success=$r2.Success; R2Lines=$r2.Lines; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.R1Success).toBe(false);
    expect(report.R1Lines.join('\n')).toContain('-ConfirmSavedWork must be specified');
    expect(report.R2Success).toBe(false);
    expect(report.R2Lines.join('\n')).toContain('-ProcessIds must be provided');
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow'))).toBe(false);
  });

  test('rejects >8 PIDs, duplicates, or non-positive PIDs before any action', () => {
    const output = runPowerShell(`${mockBootstrap}
      $rDup = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101, 101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $rNeg = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(-5) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $rMax = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(1,2,3,4,5,6,7,8,9) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Dup=$rDup.Success; Neg=$rNeg.Success; Max=$rMax.Success; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Dup).toBe(false);
    expect(report.Neg).toBe(false);
    expect(report.Max).toBe(false);
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow'))).toBe(false);
  });

  test('preflight rejects protected, unknown, hidden, or wrong-session PIDs with zero closes', () => {
    const output = runPowerShell(`${mockBootstrap}
      $rProt = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(201) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $rSess = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(202) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $rUnk  = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(203) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $rHid  = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(204) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      $rMixed = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101, 201) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Prot=$rProt.Success; Sess=$rSess.Success; Unk=$rUnk.Success; Hid=$rHid.Success; Mixed=$rMixed.Success; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Prot).toBe(false);
    expect(report.Sess).toBe(false);
    expect(report.Unk).toBe(false);
    expect(report.Hid).toBe(false);
    expect(report.Mixed).toBe(false);
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow'))).toBe(false);
  });

  test('rejects relative, drive-relative, root-relative, or missing paths, and missing StartTime', () => {
    const output = runPowerShell(`${mockBootstrap}
      $badStore = [System.Collections.Generic.List[psobject]]::new()
      $badStore.Add([pscustomobject]@{ Id = 301; ProcessName = 'Spotify'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]1234; WorkingSet64 = 100MB; StartTimeUtc = [DateTime]::UtcNow; Path = 'C:Spotify.exe'; OriginalProcess = $null })
      $badStore.Add([pscustomobject]@{ Id = 302; ProcessName = 'Spotify'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]1234; WorkingSet64 = 100MB; StartTimeUtc = [DateTime]::UtcNow; Path = '\\Program Files\\Spotify.exe'; OriginalProcess = $null })
      $badStore.Add([pscustomobject]@{ Id = 303; ProcessName = 'Spotify'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]1234; WorkingSet64 = 100MB; StartTimeUtc = [DateTime]::UtcNow; Path = ''; OriginalProcess = $null })
      $badStore.Add([pscustomobject]@{ Id = 304; ProcessName = 'Spotify'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]1234; WorkingSet64 = 100MB; StartTimeUtc = $null; Path = 'C:\\Spotify\\Spotify.exe'; OriginalProcess = $null })

      $badProv = { return ,$badStore.ToArray() }
      $r = Invoke-YellowSessionMode -ProcessProvider $badProv -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$r.Success; Lines=$r.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    const candidateSection = report.Lines.slice(report.Lines.findIndex((l: string) => l.includes('Eligible optional app candidates'))).join('\n');
    expect(candidateSection).toContain('(None found)');
  });

  test('valid confirmed candidate gracefully closes and reports exit', () => {
    const output = runPowerShell(`${mockBootstrap}
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$res.Success; Actions=$res.Actions; Exited=$res.Exited; Refused=$res.Refused; StillRunning=$res.StillRunning; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Actions).toEqual(['close-request:101']);
    expect(report.Exited).toEqual([101]);
    expect(report.Refused).toEqual([]);
    expect(report.StillRunning).toEqual([]);
    expect(report.Calls).toContain('CloseMainWindow:101');
    expect(report.Calls).toContain('WaitExit:101:5');
  });

  test('refusal by CloseMainWindow() returning false is accurately reported as refused without force kill', () => {
    const output = runPowerShell(`${mockBootstrap}
      $refuseClose = { param($p) $script:callLog.Add("CloseMainWindowRefused:$($p.Id)"); return $false }
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $refuseClose -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$res.Success; Exited=$res.Exited; Refused=$res.Refused; StillRunning=$res.StillRunning; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Exited).toEqual([]);
    expect(report.Refused).toEqual([101]);
    expect(report.Calls).toContain('CloseMainWindowRefused:101');
    expect(report.Calls.some((c: string) => c.startsWith('WaitExit'))).toBe(false);
  });

  test('timeout during wait reports still-running truthfully when close request was sent but app did not exit', () => {
    const output = runPowerShell(`${mockBootstrap}
      $timeoutWait = { param($procObj, $timeout, $provider, $s, $n) $script:callLog.Add("WaitTimeout:$($procObj.Id)"); return $false }
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $timeoutWait
      [pscustomobject]@{ Success=$res.Success; Exited=$res.Exited; Refused=$res.Refused; StillRunning=$res.StillRunning; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Exited).toEqual([]);
    expect(report.StillRunning).toEqual([101]);
    expect(report.Refused).toEqual([]);
  });

  test('recheck catches drift for each individual identity field: name, path, session, starttime, and hidden window', () => {
    const output = runPowerShell(`${mockBootstrap}
      function Run-RecheckTest([string]$Field) {
        $pLive = [pscustomobject]@{
            Id = 101; ProcessName = 'Spotify'; SessionId = $script:currentSession; MainWindowHandle = [IntPtr]1234; WorkingSet64 = 300MB;
            StartTimeUtc = [DateTime]::Parse('2026-09-26T00:00:00Z'); Path = 'C:\\Program Files\\Spotify\\Spotify.exe'; OriginalProcess = $null
        }
        switch ($Field) {
            'name' { $pLive.ProcessName = 'Other' }
            'path' { $pLive.Path = 'C:\\Program Files\\Other\\Spotify.exe' }
            'session' { $pLive.SessionId = $script:currentSession + 1 }
            'starttime' { $pLive.StartTimeUtc = [DateTime]::Parse('2026-09-26T01:00:00Z') }
            'hidden' { $pLive.MainWindowHandle = [IntPtr]0 }
        }
        $prov = {
            if ($script:callLog.Contains("Reval:$Field")) { return ,@($pLive) }
            $script:callLog.Add("Reval:$Field")
            return ,$script:procStore.ToArray()
        }
        return Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $prov -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      }

      $rName = Run-RecheckTest 'name'
      $rPath = Run-RecheckTest 'path'
      $rSess = Run-RecheckTest 'session'
      $rTime = Run-RecheckTest 'starttime'
      $rHid  = Run-RecheckTest 'hidden'

      [pscustomobject]@{
        NameRefused = ($rName.Refused -contains 101)
        PathRefused = ($rPath.Refused -contains 101)
        SessRefused = ($rSess.Refused -contains 101)
        TimeRefused = ($rTime.Refused -contains 101)
        HidRefused  = ($rHid.Refused -contains 101)
        Calls = @($callLog)
      } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.NameRefused).toBe(true);
    expect(report.PathRefused).toBe(true);
    expect(report.SessRefused).toBe(true);
    expect(report.TimeRefused).toBe(true);
    expect(report.HidRefused).toBe(true);
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow:101'))).toBe(false);
  });

  test('omission in live snapshot marks process unverified/still-running with zero closes', () => {
    const output = runPowerShell(`${mockBootstrap}
      # Revalidation returns empty list
      $omittedProv = {
        if ($script:callLog.Contains('RevalOmitted')) { return ,@() }
        $script:callLog.Add('RevalOmitted')
        return ,$script:procStore.ToArray()
      }
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $omittedProv -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$res.Success; StillRunning=$res.StillRunning; Exited=$res.Exited; Refused=$res.Refused; Calls=@($callLog); Lines=$res.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.StillRunning).toEqual([101]);
    expect(report.Exited).toEqual([]);
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow'))).toBe(false);
    expect(report.Lines.join('\n')).toContain('omitted in live snapshot; exit unverified');
  });

  test('default bounded wait seam advances script:simNow and terminates without timeout', () => {
    const output = runPowerShell(`${mockBootstrap}
      $script:simNow = [DateTimeOffset]::Parse('2026-09-26T12:00:00Z')
      $script:mockNow = { return $script:simNow }
      $script:mockSleep = {
          param($sec)
          $script:callLog.Add("Sleep:$sec")
          $script:simNow = $script:simNow.AddSeconds($sec)
      }
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -SleepAction $script:mockSleep -NowProvider $script:mockNow
      [pscustomobject]@{ Success=$res.Success; StillRunning=$res.StillRunning; Calls=@($callLog); Lines=$res.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.StillRunning).toEqual([101]);
    expect(report.Calls.filter((c: string) => c === 'Sleep:0.25').length).toBeGreaterThanOrEqual(20);
  });

  test('stalled mock clock is bounded by maxPolls limit and does not hang', () => {
    const output = runPowerShell(`${mockBootstrap}
      $frozenTime = [DateTimeOffset]::Parse('2026-09-26T12:00:00Z')
      $frozenNow = { return $frozenTime }
      $stalledSleep = { param($sec) $script:callLog.Add("StalledSleep:$sec") }
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -SleepAction $stalledSleep -NowProvider $frozenNow
      [pscustomobject]@{ Success=$res.Success; StillRunning=$res.StillRunning; SleepCount=($callLog | Where-Object { $_ -eq 'StalledSleep:0.25' }).Count } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.StillRunning).toEqual([101]);
    expect(report.SleepCount).toBe(20);
  });

  test('uncertain live-read or wait adapter exception safely marks process still-running without crash', () => {
    const output = runPowerShell(`${mockBootstrap}
      $failingWait = { param($p, $t, $prov, $s, $n) throw [System.IO.IOException]::new("Access denied on handle") }
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $failingWait
      [pscustomobject]@{ Success=$res.Success; StillRunning=$res.StillRunning; Lines=$res.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.StillRunning).toEqual([101]);
    expect(report.Lines.join('\n')).toContain('still running or exit unverified');
  });

  test('RAM provider returning null reports Unavailable safely instead of 0 MB', () => {
    const output = runPowerShell(`${mockBootstrap}
      $nullMemProvider = { return $null }
      $res = Invoke-YellowSessionMode -ProcessProvider $procProvider -MemoryProvider $nullMemProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$res.Success; Lines=$res.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Lines.join('\n')).toContain('Available physical RAM (initial): Unavailable');
  });

  test('-WhatIf flag produces structured report only and executes zero close or wait actions', () => {
    const output = runPowerShell(`${mockBootstrap}
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -WhatIf -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$res.Success; Actions=$res.Actions; Calls=@($callLog); Lines=$res.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Actions).toEqual([]);
    expect(report.Calls.some((c: string) => c.startsWith('CloseMainWindow'))).toBe(false);
    expect(report.Calls.some((c: string) => c.startsWith('WaitExit'))).toBe(false);
    expect(report.Lines.join('\n')).toContain('WhatIf active: No process close requested or performed.');
  });

  test('-WhatIf:$false does not activate WhatIf mode and proceeds to live action', () => {
    const output = runPowerShell(`${mockBootstrap}
      $res = Invoke-YellowSessionMode -Apply -Confirm:$false -ConfirmSavedWork -ProcessIds @(101) -WhatIf:$false -ProcessProvider $procProvider -MemoryProvider $memProvider -CloseAdapter $closeAdapter -WaitAdapter $waitAdapter
      [pscustomobject]@{ Success=$res.Success; Actions=$res.Actions; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Actions).toEqual(['close-request:101']);
    expect(report.Calls).toContain('CloseMainWindow:101');
    expect(report.Calls).toContain('WaitExit:101:5');
  });
});
