[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SourceRoot,
    [Parameter(Mandatory)][string]$OutputArchive
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = Get-Item -LiteralPath $SourceRoot -Force
if (-not $source.PSIsContainer) { throw 'Source root must be a directory' }
if (Test-Path -LiteralPath $OutputArchive) { throw 'Output archive must be new; overwrite is forbidden' }
$outputParent = Split-Path -Parent $OutputArchive
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) { throw 'Output archive parent is absent' }

$root = [IO.Path]::GetFullPath($source.FullName).TrimEnd('\', '/')
$excludedNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@('node_modules', '.env', 'app.env', 'runtime-private') | ForEach-Object { [void]$excludedNames.Add($_) }
$files = [Collections.Generic.List[IO.FileInfo]]::new()
$pending = [Collections.Generic.Stack[IO.DirectoryInfo]]::new()
$pending.Push([IO.DirectoryInfo]$source)
while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($entry in @(Get-ChildItem -LiteralPath $directory.FullName -Force)) {
        $relative = [IO.Path]::GetRelativePath($root, $entry.FullName).Replace('\', '/')
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            if ($entry.PSIsContainer -and $entry.Name -ieq 'node_modules') { continue }
            throw "Unexpected reparse point: $relative"
        }
        if ($entry.PSIsContainer) {
            if ($excludedNames.Contains($entry.Name)) { continue }
            $pending.Push([IO.DirectoryInfo]$entry)
            continue
        }
        # DECISIONS.log is governed source history. Exclude only runtime logs,
        # which live outside the source tree or use the known supervisor naming.
        if ($excludedNames.Contains($entry.Name) -or ($entry.Name.EndsWith('.log', [StringComparison]::OrdinalIgnoreCase) -and $entry.Name -ine 'DECISIONS.log')) { continue }
        $files.Add([IO.FileInfo]$entry)
    }
}

$zip = [IO.Compression.ZipFile]::Open($OutputArchive, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files | Sort-Object FullName) {
        $relative = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zip.Dispose() }

[pscustomobject]@{
    archive = [IO.Path]::GetFullPath($OutputArchive)
    sourceFiles = $files.Count
    sha256 = (Get-FileHash -LiteralPath $OutputArchive -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json
