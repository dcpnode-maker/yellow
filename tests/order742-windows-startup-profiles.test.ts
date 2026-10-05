import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test, afterAll } from 'bun:test';

const scriptPath = resolve(import.meta.dir, '../scripts/yellow-startup-profile.ps1');

// Unique temporary directory created per test suite run, cleaned up after suite
const suiteTempDir = mkdtempSync(join(tmpdir(), 'yellow-order742-'));

afterAll(() => {
  if (existsSync(suiteTempDir)) {
    rmSync(suiteTempDir, { recursive: true, force: true });
  }
});

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

const mockBase = `
. '${scriptPath.replaceAll("'", "''")}'
$script:regEntries = @(
  [pscustomobject]@{ Name = 'Claude'; Status = 'Enabled' },
  [pscustomobject]@{ Name = 'utweb'; Status = 'Enabled' },
  [pscustomobject]@{ Name = 'Docker Desktop'; Status = 'Enabled' },
  [pscustomobject]@{ Name = 'Ollama'; Status = 'Enabled' },
  [pscustomobject]@{ Name = 'Adobe Acrobat Synchronizer'; Status = 'Disabled' },
  [pscustomobject]@{ Name = 'MicrosoftEdgeAutoLaunch_123'; Status = 'Enabled' },
  [pscustomobject]@{ Name = 'UnknownStatusApp'; Status = 'Unknown' }
)

$mockReader = { return ,$script:regEntries }
$mockMemory = { return [pscustomobject]@{ FreeMB = 4096; TotalMB = 16384 } }
$mockTop = { return ,@([pscustomobject]@{ ProcessName = 'bun'; WorkingSetMB = 150 }) }
`;

describe('Order 742 reversible Windows startup profiles (Read-Only & Preview)', () => {
  test('PowerShell parser accepts the script without syntax errors', () => {
    const output = runPowerShell(`
      $tokens = $null; $errors = $null
      [System.Management.Automation.Language.Parser]::ParseFile('${scriptPath.replaceAll("'", "''")}', [ref]$tokens, [ref]$errors) | Out-Null
      if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }
      'parser-ok'
    `);
    expect(output).toBe('parser-ok');
  });

  test('default audit mode reports memory, top processes, and HKCU Run startup names without secrets or writes', () => {
    const output = runPowerShell(`${mockBase}
      $res = Invoke-YellowProfileMain -Audit -RegistryGetEntries $mockReader -GetMemoryInfo $mockMemory -GetTopProcesses $mockTop
      [pscustomobject]@{
        Success = $res.Success
        Lines = $res.Lines
      } | ConvertTo-Json -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    const lines = report.Lines.join('\n');
    expect(lines).toContain('Free Physical RAM: 4096 MB');
    expect(lines).toContain('bun: 150 MB');
    expect(lines).toContain('Claude (Status: Enabled) [Allowlist Candidate]');
    expect(lines).toContain('Docker Desktop (Status: Enabled) [Unmanaged/Protected]');
    expect(lines).not.toContain('AppData');
  });

  test('plan mode classifies eligible allowlisted items and rejects disabled or unknown statuses', () => {
    const output = runPowerShell(`${mockBase}
      $res = Invoke-YellowProfileMain -Plan -RegistryGetEntries $mockReader
      [pscustomobject]@{
        Success = $res.Success
        Lines = $res.Lines
        Eligible = $res.EligibleNames
      } | ConvertTo-Json -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Eligible).toContain('Claude');
    expect(report.Eligible).toContain('utweb');
    expect(report.Eligible).toContain('MicrosoftEdgeAutoLaunch_123');
    expect(report.Eligible).not.toContain('Docker Desktop');
    expect(report.Eligible).not.toContain('Ollama');
    expect(report.Lines.join('\n')).toContain("matches allowlist but is disabled in StartupApproved; will be skipped");
  });

  test('mutating modes (Install, Uninstall, Choose) are strictly refused as NOT READY', () => {
    const output = runPowerShell(`${mockBase}
      $resInstall = Invoke-YellowProfileMain -Install
      $resUninstall = Invoke-YellowProfileMain -Uninstall
      $resChoose = Invoke-YellowProfileMain -Choose
      [pscustomobject]@{
        InstallSuccess = $resInstall.Success
        InstallLines = $resInstall.Lines
        UninstallSuccess = $resUninstall.Success
        UninstallLines = $resUninstall.Lines
        ChooseSuccess = $resChoose.Success
        ChooseLines = $resChoose.Lines
      } | ConvertTo-Json -Depth 5
    `);
    const report = parseReport(output);
    expect(report.InstallSuccess).toBe(false);
    expect(report.InstallLines.join('\n')).toContain('NOT READY: -Install is disabled in this delivery gate');
    expect(report.UninstallSuccess).toBe(false);
    expect(report.UninstallLines.join('\n')).toContain('NOT READY: -Uninstall is disabled in this delivery gate');
    expect(report.ChooseSuccess).toBe(false);
    expect(report.ChooseLines.join('\n')).toContain('NOT READY: -Choose is disabled in this delivery gate');
  });

  test('PreviewChooser returns operator selection via mock callback and executes zero mutations', () => {
    const output = runPowerShell(`${mockBase}
      $mockChooser = { return 'YellowOptimized' }
      $res = Invoke-YellowProfileMain -PreviewChooser -ChooserPrompt $mockChooser
      [pscustomobject]@{
        Success = $res.Success
        Lines = $res.Lines
        Selected = $res.Selected
      } | ConvertTo-Json -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.Selected).toBe('YellowOptimized');
    expect(report.Lines.join('\n')).toContain("Operator selected 'YellowOptimized'");
  });

  test('PreviewChooser under WhatIf suppresses UI prompt and makes zero changes', () => {
    const output = runPowerShell(`${mockBase}
      $script:uiCalled = $false
      $mockChooser = { $script:uiCalled = $true; return 'Normal' }
      $res = Invoke-YellowProfileMain -PreviewChooser -WhatIf -ChooserPrompt $mockChooser
      [pscustomobject]@{
        Success = $res.Success
        Lines = $res.Lines
        Selected = $res.Selected
        UICalled = $script:uiCalled
      } | ConvertTo-Json -Depth 5
    `);
    const report = parseReport(output);
    expect(report.Success).toBe(true);
    expect(report.UICalled).toBe(false);
    expect(report.Selected).toBe('WhatIf');
    expect(report.Lines.join('\n')).toContain('zero UI shown and zero state changed under WhatIf');
  });
});
