$ErrorActionPreference = 'Stop'

$canonical = 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow'
$active = 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment'
$preserved = @(
    $canonical,
    $active,
    'E:\yellow\ollama',
    'E:\yellow\toolchains',
    'E:\yellow\docker-data'
) | ForEach-Object { [IO.Path]::GetFullPath($_).TrimEnd('\') }

$junctionLeaves = @(
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order171-backend\node_modules',
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order339-review-d952\mutant\node_modules'
)

$targets = @(
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order171-backend',
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order305-tier3-review',
    'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order339-review-d952',
    'D:\Yellow\backups',
    'D:\Yellow\cleanup-quarantine',
    'D:\Yellow\codex-reviews',
    'D:\Yellow\disposable-diagnostics-archive',
    'D:\Yellow\order368-proof',
    'D:\Yellow\order370-recovery',
    'D:\Yellow\order388-builder-pg16',
    'D:\Yellow\order388-d1150-pgdata',
    'D:\Yellow\order395-pg-proof',
    'D:\Yellow\order408-tier3-exact-pg',
    'D:\Yellow\order410-tier3-r2-pg',
    'D:\Yellow\order412-builder-pg',
    'D:\Yellow\order414-rereview-migrations70',
    'D:\Yellow\order415-final-review-pg',
    'D:\Yellow\order388-d1150-postgres.log',
    'D:\Yellow\order410-tier3-r2-init.pw',
    'D:\Yellow\order410-tier3-r2-pg.log',
    'D:\Yellow\order410-tier3-r2-schema.raw.sql',
    'E:\yellow\backups',
    'E:\yellow\cleanup-quarantine',
    'E:\yellow\git-worktrees',
    'E:\yellow\order356-review-1f477d69ca2f4b4dbd0357311169045a',
    'E:\yellow\order356-review-2adf985831ae45de9dc88e29895fa28a',
    'E:\yellow\order356-review-8e92266417f541a29af18f643b83c948',
    'E:\yellow\order356-review-abe49f9a03a24e24827ae32bb31a4bc9',
    'E:\yellow\order356-review-c48b4f64db53449b95e4cf6d2f105099',
    'E:\yellow\order385-builder-pg16',
    'E:\yellow\order385-migration-pg16',
    'E:\yellow\order386-domain-pg16',
    'E:\yellow\order386-review-fresh-7c31a9',
    'E:\yellow\order387-builder-proof-a32f184c',
    'E:\yellow\order387-builder-proof-b41d2f7e',
    'E:\yellow\order387-domain-9c4e2b7a',
    'E:\yellow\order388-review-a17f2c',
    'E:\yellow\order391-builder-b3cf2c6',
    'E:\yellow\order391-review-6dbdc5a',
    'E:\yellow\order396-fresh-tier3-a83f2d1',
    'E:\yellow\proof-archives',
    'E:\yellow\review-order373',
    'E:\yellow\review-order389-tier3',
    'E:\yellow\review395-fresh',
    'E:\yellow\reviews',
    'E:\yellow\tmp',
    'E:\yellow\order386-domain-pg16.log',
    'E:\yellow\order386-domain.log',
    'E:\yellow\order396-f30a742.tar'
)

$registered = @(git -C $canonical worktree list --porcelain |
    Where-Object { $_ -like 'worktree *' } |
    ForEach-Object { [IO.Path]::GetFullPath($_.Substring(9)).TrimEnd('\') })

foreach ($target in $targets) {
    $resolved = [IO.Path]::GetFullPath($target).TrimEnd('\')
    if ($resolved -in $preserved -or $resolved -in $registered) {
        throw "Refusing preserved or registered target: $resolved"
    }
    if (-not ($resolved.StartsWith('D:\Yellow\', [StringComparison]::OrdinalIgnoreCase) -or
              $resolved.StartsWith('E:\yellow\', [StringComparison]::OrdinalIgnoreCase) -or
              $resolved.StartsWith('C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order', [StringComparison]::OrdinalIgnoreCase))) {
        throw "Target escaped approved roots: $resolved"
    }
}

foreach ($leaf in $junctionLeaves) {
    if (Test-Path -LiteralPath $leaf) {
        $item = Get-Item -LiteralPath $leaf -Force
        if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Expected reparse leaf is not a reparse point: $leaf"
        }
        Remove-Item -LiteralPath $leaf -Force
    }
}

$removed = 0
foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
        $removed++
    }
}

$remaining = @($targets | Where-Object { Test-Path -LiteralPath $_ })
if ($remaining.Count -ne 0) {
    throw "Approved targets remain: $($remaining -join ', ')"
}

[pscustomobject]@{
    RemovedTargets = $removed
    RemainingTargets = $remaining.Count
    CanonicalPreserved = Test-Path -LiteralPath $canonical
    ActivePreserved = Test-Path -LiteralPath $active
    OllamaPreserved = Test-Path -LiteralPath 'E:\yellow\ollama'
    ToolchainsPreserved = Test-Path -LiteralPath 'E:\yellow\toolchains'
    DockerDataPreserved = Test-Path -LiteralPath 'E:\yellow\docker-data'
} | Format-List
