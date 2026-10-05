[CmdletBinding()]
param(
    [ValidateSet('dsh', 'goose')]
    [string]$Harness
)

$ErrorActionPreference = 'Stop'

$target = if ($Harness -eq 'dsh') {
    'YELLOW_GEMINI_DSH_API_KEY'
} else {
    'YELLOW_GEMINI_GOOSE_API_KEY'
}

$secure = Read-Host "Paste the private Gemini API key for $Harness" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($plain)) {
        throw 'No credential was entered.'
    }
    [Environment]::SetEnvironmentVariable($target, $plain, 'User')
    Write-Host "$target was stored in the Windows user environment. Restart that harness before use."
} finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    Remove-Variable plain -ErrorAction SilentlyContinue
}

