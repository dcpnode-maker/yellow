[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SourceRoot,
    [Parameter(Mandatory)][string]$ArchivePath,
    [switch]$ShowPaths
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-StreamSha256([IO.Stream]$Stream) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToHexString($sha.ComputeHash($Stream)).ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-SourceMap([string]$Root) {
    $rootItem = Get-Item -LiteralPath $Root -Force
    if (-not $rootItem.PSIsContainer) { throw 'Source root must be a directory' }
    $fullRoot = [IO.Path]::GetFullPath($rootItem.FullName).TrimEnd('\', '/')
    $map = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $pending = [Collections.Generic.Stack[IO.DirectoryInfo]]::new()
    $pending.Push([IO.DirectoryInfo]$rootItem)
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($entry in @(Get-ChildItem -LiteralPath $directory.FullName -Force)) {
            $relative = [IO.Path]::GetRelativePath($fullRoot, $entry.FullName).Replace('\', '/')
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                if ($entry.PSIsContainer -and $relative -ceq 'node_modules') { continue }
                throw "Unexpected reparse point: $relative"
            }
            if ($entry.PSIsContainer) { $pending.Push([IO.DirectoryInfo]$entry); continue }
            if (-not $map.TryAdd($relative, (Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256).Hash.ToLowerInvariant())) {
                throw "Duplicate source path: $relative"
            }
        }
    }
    return $map
}

function Get-ArchiveMap([string]$Path) {
    $map = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $zip = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        foreach ($entry in $zip.Entries) {
            if ([string]::IsNullOrEmpty($entry.Name)) { continue }
            $relative = $entry.FullName.Replace('\', '/')
            if ($relative.StartsWith('/') -or $relative -match '(^|/)\.\.(/|$)') { throw "Unsafe archive path: $relative" }
            $stream = $entry.Open()
            try { $hash = Get-StreamSha256 $stream }
            finally { $stream.Dispose() }
            if (-not $map.TryAdd($relative, $hash)) { throw "Duplicate archive path: $relative" }
        }
    } finally { $zip.Dispose() }
    return $map
}

$source = Get-SourceMap $SourceRoot
$archive = Get-ArchiveMap $ArchivePath
$added = @($source.Keys | Where-Object { -not $archive.ContainsKey($_) } | Sort-Object)
$removed = @($archive.Keys | Where-Object { -not $source.ContainsKey($_) } | Sort-Object)
$modified = @($archive.Keys | Where-Object { $source.ContainsKey($_) -and $source[$_] -cne $archive[$_] } | Sort-Object)
$report = [ordered]@{
    sourceFiles = $source.Count
    archiveFiles = $archive.Count
    added = $added.Count
    removed = $removed.Count
    modified = $modified.Count
}
if ($ShowPaths) { $report['addedPaths'] = $added; $report['removedPaths'] = $removed; $report['modifiedPaths'] = $modified }
[pscustomobject]$report | ConvertTo-Json -Depth 3
