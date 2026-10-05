[CmdletBinding()]
param(
  [Parameter(Mandatory)] [ValidateSet('oneplus10r','oneplus11r','nord5')] [string]$Worker,
  [Parameter(Mandatory)] [ValidatePattern('^[^\s@]+@[^\s@]+$')] [string]$SshTarget,
  [switch]$DryRun
)
$ports = @{ oneplus10r = 11435; oneplus11r = 11436; nord5 = 11437 }
$local = $ports[$Worker]
if ($DryRun) {
  [pscustomobject]@{
    action = 'phone-tunnel'
    worker = $Worker
    local_endpoint = "http://127.0.0.1:$local"
    remote_endpoint = '127.0.0.1:8080'
    ssh_target = $SshTarget
    public_bind = $false
  } | ConvertTo-Json -Compress
  exit 0
}
Write-Host "Forwarding localhost:$local to the authenticated phone loopback service on 8080."
& ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L "127.0.0.1:${local}:127.0.0.1:8080" $SshTarget
if ($LASTEXITCODE -ne 0) { throw "SSH tunnel failed ($LASTEXITCODE)" }
