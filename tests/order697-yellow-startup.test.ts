import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';

const scriptPath = resolve(import.meta.dir, '../scripts/start-yellow-existing.ps1');
const helperSource = readFileSync(scriptPath, 'utf8');

function runPowerShell(body: string): string {
  const encoded = Buffer.from(body, 'utf16le').toString('base64');
  const result = spawnSync(process.env.YELLOW_PWSH ?? 'pwsh', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded,
  ], { encoding: 'utf8', timeout: 20_000, windowsHide: true });
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
$script:now = [DateTimeOffset]::UtcNow
$script:states = @{ p = 'exited'; v = 'exited'; a = 'exited'; t = 'exited' }
$script:health = @{ p = 'healthy'; v = 'healthy'; a = 'starting'; t = 'none' }
$script:services = @{ p = 'postgres'; v = 'valkey'; a = 'app'; t = 'tunnel' }
$script:names = @{ p = 'yellow-public-demo-postgres-1'; v = 'yellow-public-demo-valkey-1'; a = 'yellow-public-demo-app-1'; t = 'yellow-public-demo-tunnel' }
$script:portJson = '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3010"}]}'
$executor = {
  param($Operation, $Arguments, $TimeoutSeconds)
  $id = if ($Arguments.Count -gt 0) { [string]$Arguments[-1] } else { '' }
  $script:callLog.Add($Operation + ':' + ($Arguments -join ' '))
  switch ($Operation) {
    'DockerInfo' { return [pscustomobject]@{ ExitCode=0; StdOut='27.0'; StdErr=''; TimedOut=$false } }
    'List' { return [pscustomobject]@{ ExitCode=0; StdOut=(@('p','v','a','t') -join [char]10); StdErr=''; TimedOut=$false } }
    'Inspect' {
      $ports = if ($id -eq 'a') { $script:portJson } else { '{}' }
      $line = "$id|/$($script:names[$id])|$($script:states[$id])|yellow-public-demo|$($script:services[$id])|$ports|$($script:health[$id])"
      return [pscustomobject]@{ ExitCode=0; StdOut=$line; StdErr=''; TimedOut=$false }
    }
    'StartContainer' {
      $container = [string]$Arguments[-1]
      $script:states[$container] = 'running'
      return [pscustomobject]@{ ExitCode=0; StdOut=$container; StdErr=''; TimedOut=$false }
    }
    'HealthProbe' { return [pscustomobject]@{ ExitCode=0; StdOut='200'; StdErr=''; TimedOut=$false } }
    default { return [pscustomobject]@{ ExitCode=1; StdOut=''; StdErr='unexpected operation'; TimedOut=$false } }
  }
}
$sleep = { param($Seconds) $script:now = $script:now.AddSeconds($Seconds) }
$clock = { $script:now }
`;

describe('Order 697 safe startup helper', () => {
  test('PowerShell parser accepts the helper without syntax errors', () => {
    const output = runPowerShell(`
      $tokens = $null; $errors = $null
      [System.Management.Automation.Language.Parser]::ParseFile('${scriptPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors) | Out-Null
      if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }
      'parser-ok'
    `);
    expect(output).toBe('parser-ok');
  });

  test('default mode reports the allowlisted project without any write-like command or health probe', () => {
    const output = runPowerShell(`${mockBootstrap}
      $result = Invoke-YellowStartup -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Lines=$result.Lines; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Lines.join('\n')).toContain('Report only: no containers or listeners were changed.');
    expect(report.Lines.join('\n')).toContain('Public tunnel: not probed; reachability is unverified.');
    expect(report.Calls.some((call: string) => call.startsWith('StartContainer:') || call.startsWith('DesktopStart:') || call.startsWith('HealthProbe:'))).toBe(false);
    expect(report.Calls.join('\n')).toContain('if index .State "Health"');
  });

  test('explicit start reuses only existing containers in dependency order and never restarts running services', () => {
    const output = runPowerShell(`${mockBootstrap}
      $script:states.p = 'running'; $script:states.v = 'running'
      $result = Invoke-YellowStartup -Start -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Actions=$result.Actions; Calls=@($callLog); Lines=$result.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Actions).toEqual(['start:app', 'start:tunnel']);
    expect(report.Calls.some((call: string) => call.startsWith('DesktopStart:'))).toBe(false);
    expect(report.Calls.findIndex((call: string) => call === 'StartContainer:start a')).toBeLessThan(report.Calls.findIndex((call: string) => call === 'StartContainer:start t'));
    expect(report.Lines.join('\n')).toContain('external reachability was not probed and is unverified.');
  });

  test('a duplicated service label is rejected before any start action', () => {
    const output = runPowerShell(`${mockBootstrap}
      $executor = {
        param($Operation, $Arguments, $TimeoutSeconds)
        if ($Operation -eq 'List') { return [pscustomobject]@{ ExitCode=0; StdOut=(@('p','p2','v','a','t') -join [char]10); StdErr=''; TimedOut=$false } }
        if ($Operation -eq 'Inspect' -and $Arguments[-1] -eq 'p2') { return [pscustomobject]@{ ExitCode=0; StdOut='p2|/other-postgres|exited|yellow-public-demo|postgres|{}|none'; StdErr=''; TimedOut=$false } }
        & $script:mockExecutor $Operation $Arguments $TimeoutSeconds
      }
      $script:mockExecutor = ${mockBootstrap.substring(mockBootstrap.indexOf('$executor = {') + '$executor = '.length, mockBootstrap.indexOf('\n$sleep ='))}
      $result = Invoke-YellowStartup -Start -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Lines=$result.Lines; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Lines.join('\n')).toContain('found 2.');
    expect(report.Calls.some((call: string) => call.startsWith('StartContainer:'))).toBe(false);
  });

  test('wrong app host binding is refused before start', () => {
    const output = runPowerShell(`${mockBootstrap}
      $script:portJson = '{"3000/tcp":[{"HostIp":"0.0.0.0","HostPort":"3010"}]}'
      $result = Invoke-YellowStartup -Start -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Lines=$result.Lines; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Lines.join('\n')).toContain('not the expected loopback port');
    expect(report.Calls.some((call: string) => call.startsWith('StartContainer:'))).toBe(false);
  });

  test('all healthy services are idempotent and an already running app is not restarted', () => {
    const output = runPowerShell(`${mockBootstrap}
      $script:states.p = 'running'; $script:states.v = 'running'; $script:states.a = 'running'; $script:states.t = 'running'
      $script:health.a = 'healthy'
      $result = Invoke-YellowStartup -Start -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Actions=$result.Actions; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Actions).toEqual([]);
    expect(report.Calls.some((call: string) => call.startsWith('StartContainer:'))).toBe(false);
  });

  test('missing expected service fails closed without starting any other service', () => {
    const normalExecutor = mockBootstrap.substring(mockBootstrap.indexOf('$executor = {') + '$executor = '.length, mockBootstrap.indexOf('\n$sleep ='));
    const output = runPowerShell(`${mockBootstrap}
      $script:normalExecutor = ${normalExecutor}
      $executor = {
        param($Operation, $Arguments, $TimeoutSeconds)
        if ($Operation -eq 'List') { return [pscustomobject]@{ ExitCode=0; StdOut=(@('p','v','a') -join [char]10); StdErr=''; TimedOut=$false } }
        & $script:normalExecutor $Operation $Arguments $TimeoutSeconds
      }
      $result = Invoke-YellowStartup -Start -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Lines=$result.Lines; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Lines.join('\n')).toContain('Expected exactly one existing tunnel container');
    expect(report.Calls.some((call: string) => call.startsWith('StartContainer:'))).toBe(false);
  });

  test('Docker Desktop start is attempted only after explicit opt-in and failure leaves containers untouched', () => {
    const output = runPowerShell(`
      . '${scriptPath.replaceAll("'", "''")}'
      $script:callLog = [System.Collections.Generic.List[string]]::new()
      $executor = {
        param($Operation, $Arguments, $TimeoutSeconds)
        $script:callLog.Add($Operation + ':' + $TimeoutSeconds)
        return [pscustomobject]@{ ExitCode=1; StdOut=''; StdErr='private diagnostic'; TimedOut=$false }
      }
      $report = Invoke-YellowStartup -CommandExecutor $executor
      $reportCalls = @($callLog)
      $callLog.Clear()
      $desktopResult = Invoke-YellowStartup -Start -CommandExecutor $executor
      [pscustomobject]@{ ReportCalls=$reportCalls; StartCalls=@($callLog); Lines=$desktopResult.Lines; Success=$desktopResult.Success; HasResult=($null -ne $desktopResult) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.ReportCalls).toEqual(['DockerInfo:8']);
    expect(report.StartCalls).toEqual(['DockerInfo:8', 'DesktopStart:8']);
    expect(report.HasResult).toBe(true);
    expect(report.Success).toBe(false);
    expect(report.Lines.join('\n')).not.toContain('private diagnostic');
  });

  test('an additional published app port is rejected even with a valid loopback binding', () => {
    const output = runPowerShell(`${mockBootstrap}
      $script:portJson = '{"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3010"}],"9000/tcp":[{"HostIp":"0.0.0.0","HostPort":"9000"}]}'
      $result = Invoke-YellowStartup -Start -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Lines=$result.Lines; Calls=@($callLog) } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Lines.join('\n')).toContain('not the expected loopback port');
    expect(report.Calls.some((call: string) => call.startsWith('StartContainer:'))).toBe(false);
  });

  test('bounded app probe timeout leaves already-started services running and performs no cleanup', () => {
    const output = runPowerShell(`${mockBootstrap}
      $executor = {
        param($Operation, $Arguments, $TimeoutSeconds)
        $script:callLog.Add($Operation + ':' + ($Arguments -join ' '))
        if ($Operation -eq 'HealthProbe') { return [pscustomobject]@{ ExitCode=1; StdOut='503'; StdErr='secret-not-printed'; TimedOut=$false } }
        & $script:normalExecutor $Operation $Arguments $TimeoutSeconds
      }
      $script:normalExecutor = ${mockBootstrap.substring(mockBootstrap.indexOf('$executor = {') + '$executor = '.length, mockBootstrap.indexOf('\n$sleep ='))}
      $result = Invoke-YellowStartup -Start -ReadinessTimeoutSeconds 10 -PollIntervalSeconds 2 -CommandExecutor $executor -SleepAction $sleep -NowProvider $clock
      [pscustomobject]@{ Success=$result.Success; Actions=$result.Actions; Calls=@($callLog); Lines=$result.Lines } | ConvertTo-Json -Compress -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(false);
    expect(report.Actions).toEqual(['start:postgres', 'start:valkey', 'start:app']);
    expect(report.Calls.some((call: string) => call === 'StartContainer:start t')).toBe(false);
    expect(report.Lines.join('\n')).not.toContain('secret-not-printed');
    expect(report.Lines.join('\n')).toContain('No cleanup was performed.');
  });
});
