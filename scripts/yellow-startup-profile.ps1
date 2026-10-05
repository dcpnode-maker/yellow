param(
    [switch]$Audit,
    [switch]$Plan,
    [switch]$PreviewChooser,
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$Choose,
    [switch]$WhatIf,
    [scriptblock]$RegistryGetEntries = $null,
    [scriptblock]$GetMemoryInfo = $null,
    [scriptblock]$GetTopProcesses = $null,
    [scriptblock]$ChooserPrompt = $null
)

$script:YellowProfileDotSourced = $MyInvocation.InvocationName -eq '.'

$script:AllowlistedNames = @(
    'Claude',
    'utweb',
    'Adobe Acrobat Synchronizer',
    'MicrosoftEdgeAutoLaunch_*',
    'GoogleChromeAutoLaunch_*'
)

$script:ProtectedNames = @(
    'Docker', 'Docker Desktop', 'GoogleDrive', 'Google Drive', 'Ollama',
    'SecurityHealth', 'WindowsDefender', 'Audio', 'Realtek'
)

function Test-YellowAllowlistMatch {
    param([Parameter(Mandatory)][string]$Name)
    foreach ($prot in $script:ProtectedNames) {
        if ($Name -like $prot -or $Name -eq $prot) { return $false }
    }
    foreach ($pattern in $script:AllowlistedNames) {
        if ($pattern.EndsWith('*')) {
            $prefix = $pattern.Substring(0, $pattern.Length - 1)
            if ($Name.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
        } else {
            if ($Name.Equals($pattern, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
        }
    }
    return $false
}

function Test-YellowIsProtected {
    param([Parameter(Mandatory)][string]$Name)
    foreach ($prot in $script:ProtectedNames) {
        if ($Name -like $prot -or $Name -eq $prot) { return $true }
    }
    return $false
}

function Get-YellowLiveHKCURunEntries {
    $runPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $approvedPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
    $entries = @()
    if (Test-Path $runPath -ErrorAction SilentlyContinue) {
        $props = Get-ItemProperty -Path $runPath -ErrorAction SilentlyContinue
        if ($props) {
            foreach ($prop in $props.PSObject.Properties) {
                $pName = $prop.Name
                if ($pName -notin @('PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider')) {
                    $status = 'Enabled'
                    if (Test-Path $approvedPath -ErrorAction SilentlyContinue) {
                        $apprProp = Get-ItemProperty -Path $approvedPath -Name $pName -ErrorAction SilentlyContinue
                        if ($apprProp -and $null -ne $apprProp.$pName) {
                            $bytes = [byte[]]$apprProp.$pName
                            if ($null -eq $bytes -or $bytes.Length -eq 0) { $status = 'Enabled' }
                            elseif ($bytes.Length -ge 4 -and [System.BitConverter]::ToInt32($bytes, 0) -in @(2, 0)) { $status = 'Enabled' }
                            elseif ($bytes.Length -ge 4 -and [System.BitConverter]::ToInt32($bytes, 0) -in @(3, 1)) { $status = 'Disabled' }
                            else { $status = 'Unknown' }
                        }
                    }
                    $entries += [pscustomobject]@{ Name = $pName; Status = $status }
                }
            }
        }
    }
    return ,$entries
}

function Get-YellowLiveMemoryInfo {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($os) {
        return [pscustomobject]@{
            FreeMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
            TotalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
        }
    }
    return [pscustomobject]@{ FreeMB = 0; TotalMB = 0 }
}

function Get-YellowLiveTopProcesses {
    $procs = Get-Process -ErrorAction SilentlyContinue |
        Sort-Object -Property WorkingSet64 -Descending |
        Select-Object -First 5 -Property ProcessName, @{Name='WorkingSetMB'; Expression={[math]::Round($_.WorkingSet64 / 1MB, 0)}}
    return ,$procs
}

function Show-YellowWinFormsPreviewChooser {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue | Out-Null
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue | Out-Null

    $form = [System.Windows.Forms.Form]::new()
    $form.Text = 'Yellow Sign-In Profile Chooser (Preview Only)'
    $form.Size = [System.Drawing.Size]::new(460, 230)
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true

    $label = [System.Windows.Forms.Label]::new()
    $label.Text = "PREVIEW ONLY — Sign-in profile chooser (not preboot BCD).`nNo system changes will be made.`n`nNormal: Would launch optional user startup apps.`nYellow Optimized: Would skip optional user startup apps to save RAM.`n(Cancel defaults to Normal)"
    $label.Location = [System.Drawing.Point]::new(20, 15)
    $label.Size = [System.Drawing.Size]::new(410, 95)
    $form.Controls.Add($label)

    $btnNormal = [System.Windows.Forms.Button]::new()
    $btnNormal.Text = 'Normal Windows'
    $btnNormal.Location = [System.Drawing.Point]::new(40, 130)
    $btnNormal.Size = [System.Drawing.Size]::new(160, 40)
    $btnNormal.DialogResult = [System.Windows.Forms.DialogResult]::OK

    $btnYellow = [System.Windows.Forms.Button]::new()
    $btnYellow.Text = 'Yellow Optimized'
    $btnYellow.Location = [System.Drawing.Point]::new(240, 130)
    $btnYellow.Size = [System.Drawing.Size]::new(160, 40)
    $btnYellow.DialogResult = [System.Windows.Forms.DialogResult]::Yes

    $form.Controls.Add($btnNormal)
    $form.Controls.Add($btnYellow)
    $form.AcceptButton = $btnNormal
    $form.CancelButton = $btnNormal

    $result = $form.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) { return 'YellowOptimized' }
    return 'Normal'
}

function Invoke-YellowProfileMain {
    param(
        [switch]$Audit,
        [switch]$Plan,
        [switch]$PreviewChooser,
        [switch]$Install,
        [switch]$Uninstall,
        [switch]$Choose,
        [switch]$WhatIf,
        [scriptblock]$RegistryGetEntries = $null,
        [scriptblock]$GetMemoryInfo = $null,
        [scriptblock]$GetTopProcesses = $null,
        [scriptblock]$ChooserPrompt = $null
    )

    $lines = [System.Collections.Generic.List[string]]::new()

    # Mutation entrypoints are strictly disabled / not-ready
    if ($Install -or $Uninstall -or $Choose) {
        $mode = if ($Install) { '-Install' } elseif ($Uninstall) { '-Uninstall' } else { '-Choose' }
        $lines.Add("NOT READY: $mode is disabled in this delivery gate.")
        $lines.Add('System mutation prohibited: No registry, manifest, or process changes were performed.')
        $lines.Add('Pending founder decision between sign-in profile manager vs explicit preboot configuration.')
        return [pscustomobject]@{ Success = $false; Lines = @($lines); Selected = $null }
    }

    if ($PreviewChooser) {
        if ($WhatIf) {
            $lines.Add('WhatIf: Preview chooser UI requested; zero UI shown and zero state changed under WhatIf.')
            return [pscustomobject]@{ Success = $true; Lines = @($lines); Selected = 'WhatIf' }
        }
        $selected = if ($ChooserPrompt) { & $ChooserPrompt } else { Show-YellowWinFormsPreviewChooser }
        $lines.Add("Preview Chooser: Operator selected '$selected'. (Preview only; no processes started, no system changes made).")
        return [pscustomobject]@{ Success = $true; Lines = @($lines); Selected = $selected }
    }

    $regReader = if ($RegistryGetEntries) { $RegistryGetEntries } else { ${function:Get-YellowLiveHKCURunEntries} }

    if ($Plan) {
        $lines.Add('=== Yellow Windows Startup Profile Plan (Read-Only) ===')
        $lines.Add('Note: Read-only inspection. No files, registry keys, or startup entries are modified.')
        $entries = & $regReader
        $eligible = @()
        $protected = @()
        $other = @()
        foreach ($e in $entries) {
            if (Test-YellowIsProtected $e.Name) { $protected += $e.Name }
            elseif (Test-YellowAllowlistMatch $e.Name) {
                if ($e.Status -eq 'Enabled') { $eligible += $e.Name }
                elseif ($e.Status -eq 'Disabled') { $lines.Add("Item '$($e.Name)' matches allowlist but is disabled in StartupApproved; will be skipped.") }
                else { $lines.Add("Item '$($e.Name)' matches allowlist but has unknown/unsupported StartupApproved status; rejected.") }
            } else { $other += $e.Name }
        }
        $lines.Add('Eligible optional items for future management: ' + $(if ($eligible.Count) { $eligible -join ', ' } else { '(None)' }))
        $lines.Add('Protected items (always preserved untouched): ' + $(if ($protected.Count) { $protected -join ', ' } else { '(None)' }))
        $lines.Add('Other unmanaged items (untouched): ' + $(if ($other.Count) { $other -join ', ' } else { '(None)' }))
        return [pscustomobject]@{ Success = $true; Lines = @($lines); EligibleNames = @($eligible); Selected = $null }
    }

    # Default Audit Mode
    $lines.Add('=== Yellow Windows Startup Profile Audit (Read-Only) ===')
    $lines.Add('Scope: Read-only local system report. Never inspects secrets, command lines, or environment.')
    $memProvider = if ($GetMemoryInfo) { $GetMemoryInfo } else { ${function:Get-YellowLiveMemoryInfo} }
    $topProcProvider = if ($GetTopProcesses) { $GetTopProcesses } else { ${function:Get-YellowLiveTopProcesses} }
    $mem = & $memProvider
    $lines.Add("Memory: Free Physical RAM: $($mem.FreeMB) MB (Total: $($mem.TotalMB) MB). Note: WorkingSet includes shared pages; free RAM is transient.")
    $lines.Add('Top WorkingSet Processes:')
    $tops = & $topProcProvider
    if ($tops) { foreach ($p in $tops) { $lines.Add("  - $($p.ProcessName): $($p.WorkingSetMB) MB") } }
    $lines.Add('Current HKCU Run Startup Names:')
    $entries = & $regReader
    if ($entries) {
        foreach ($e in $entries) {
            $cat = if (Test-YellowAllowlistMatch $e.Name) { '[Allowlist Candidate]' } else { '[Unmanaged/Protected]' }
            $lines.Add("  - $($e.Name) (Status: $($e.Status)) $cat")
        }
    } else { $lines.Add('  (None found)') }
    return [pscustomobject]@{ Success = $true; Lines = @($lines); Selected = $null }
}

if (-not $script:YellowProfileDotSourced) {
    $res = Invoke-YellowProfileMain `
        -Audit:$Audit `
        -Plan:$Plan `
        -PreviewChooser:$PreviewChooser `
        -Install:$Install `
        -Uninstall:$Uninstall `
        -Choose:$Choose `
        -WhatIf:$WhatIf `
        -RegistryGetEntries $RegistryGetEntries `
        -GetMemoryInfo $GetMemoryInfo `
        -GetTopProcesses $GetTopProcesses `
        -ChooserPrompt $ChooserPrompt

    if ($res -and $res.Lines) { $res.Lines | ForEach-Object { Write-Output $_ } }
    if ($res -and (-not $res.Success)) { exit 1 }
}
