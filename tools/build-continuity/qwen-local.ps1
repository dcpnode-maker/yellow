[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$ollamaExe = 'E:\yellow\ollama\app\ollama.exe'; $model = 'qwen3.5:2b-q4_K_M'; $models = 'E:\yellow\ollama\models'; $runtime = 'D:\Yellow\runtime\qwen-worker'; $endpoint = 'http://127.0.0.1:11434'
$runtime = Join-Path $runtime ([guid]::NewGuid().ToString('N'))
$log = Join-Path $runtime 'ollama.stdout.log'; $errLog = Join-Path $runtime 'ollama.stderr.log'; $pidFile = Join-Path $runtime 'ollama.pid'
if (-not (Test-Path -LiteralPath $ollamaExe -PathType Leaf)) { throw "Required native binary is missing: $ollamaExe" }
if (-not (Test-Path -LiteralPath $models -PathType Container)) { throw "Required model store is missing: $models" }
$os = Get-CimInstance Win32_OperatingSystem; $freeRamGiB = $os.FreePhysicalMemory / 1MB; $freeDiskGiB = ([IO.DriveInfo]::new('E')).AvailableFreeSpace / 1GB
if ($freeRamGiB -lt 4) { throw "Refusing to start: free RAM is $([math]::Round($freeRamGiB,2)) GiB; required >= 4 GiB." }
if ($freeDiskGiB -lt 5) { throw "Refusing to pull: free E: space is $([math]::Round($freeDiskGiB,2)) GiB; required >= 5 GiB." }
$existing = Get-CimInstance Win32_Process -Filter "Name='ollama.exe'" | Where-Object { $_.ExecutablePath -eq $ollamaExe }; if ($existing) { throw "Refusing to reuse an existing Ollama process: $($existing.ProcessId -join ',')" }
$listener = Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue; if ($listener) { throw "Port 11434 is occupied by PID $($listener.OwningProcess -join ',')" }
foreach ($path in @($models, (Split-Path $runtime -Parent), 'D:\Yellow\runtime')) {
  if ((Test-Path -LiteralPath $path) -and ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Redirected runtime or model path is refused.' }
}
if (Test-Path -LiteralPath $runtime) { throw "Refusing to alter existing runtime directory: $runtime" }; New-Item -ItemType Directory -Path $runtime | Out-Null
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User; $acl = New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')); Set-Acl -LiteralPath $runtime -AclObject $acl
$oldEnv = @{}; foreach ($name in 'OLLAMA_MODELS','OLLAMA_HOST','OLLAMA_NO_CLOUD','OLLAMA_CONTEXT_LENGTH','OLLAMA_NUM_PARALLEL','OLLAMA_MAX_LOADED_MODELS','OLLAMA_MAX_QUEUE','OLLAMA_KEEP_ALIVE') { $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$env:OLLAMA_MODELS=$models; $env:OLLAMA_HOST='127.0.0.1:11434'; $env:OLLAMA_NO_CLOUD='1'; $env:OLLAMA_CONTEXT_LENGTH='2048'; $env:OLLAMA_NUM_PARALLEL='1'; $env:OLLAMA_MAX_LOADED_MODELS='1'; $env:OLLAMA_MAX_QUEUE='2'; $env:OLLAMA_KEEP_ALIVE='0'; $p=$null
try {
  $p = Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WorkingDirectory (Split-Path $ollamaExe) -RedirectStandardOutput $log -RedirectStandardError $errLog -WindowStyle Hidden -PassThru; $p.Id | Set-Content -LiteralPath $pidFile -NoNewline
  $ready=$false; for ($i=0; $i -lt 45; $i++) { Start-Sleep -Milliseconds 500; try { Invoke-RestMethod "$endpoint/api/tags" -TimeoutSec 2 | Out-Null; $ready=$true; break } catch {} }; if (-not $ready) { throw 'Ollama did not become ready within 22.5 seconds.' }
  $pull = Invoke-RestMethod "$endpoint/api/pull" -Method Post -ContentType 'application/json' -Body (@{model=$model;stream=$false} | ConvertTo-Json) -TimeoutSec 600
  if ($pull.status -cne 'success') { throw 'Official model pull did not complete.' }
  if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB -lt 4) { throw 'RAM headroom changed after download; inference not started.' }
  $body = @{model=$model; prompt='Return only Python source defining unique_names(values). Require a list of strings, raising TypeError otherwise. Strip whitespace, discard empty values, deduplicate using Unicode casefold, preserve first-seen spelling and order, and never mutate input. No markdown fences or explanation.'; stream=$false; keep_alive=0; think=$false; options=@{num_predict=400; num_thread=2; num_gpu=0; num_ctx=2048; temperature=0}} | ConvertTo-Json -Depth 5
  $response = Invoke-RestMethod "$endpoint/api/generate" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 90
  $response | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $runtime 'response.json') -Encoding utf8
  [pscustomobject]@{Model=$model;ResponseFile=(Join-Path $runtime 'response.json');Done=$response.done;DoneReason=$response.done_reason;Seconds=($response.total_duration/1e9);FreeRAMGiB=((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB)} | ConvertTo-Json
} finally {
  if ($p -and -not $p.HasExited) { $p.Kill($true); if (-not $p.WaitForExit(5000)) { throw 'Owned Ollama process did not stop.' } }
  foreach ($name in $oldEnv.Keys) { [Environment]::SetEnvironmentVariable($name,$oldEnv[$name],'Process') }
}
