# Starting the existing Yellow demo runtime on Windows

`scripts/start-yellow-existing.ps1` is a small, opt-in helper for the already
provisioned `yellow-public-demo` Docker project. It is not an installer, recovery
tool, system optimizer, or resource-savings guarantee.

Requirements: Windows PowerShell 7 (`pwsh`), Docker Desktop with the Docker Desktop
CLI, and access to the existing Docker context. Use a normal, non-administrator
PowerShell session unless your Docker installation independently requires otherwise.

```powershell
# Safe default: read-only Docker status and exact existing-container report.
pwsh -NoProfile -File .\scripts\start-yellow-existing.ps1

# Explicitly opt in to starting only the validated existing containers.
pwsh -NoProfile -File .\scripts\start-yellow-existing.ps1 -Start
```

The helper recognizes only project `yellow-public-demo` with one container for
each Compose service: `yellow-public-demo-postgres-1`,
`yellow-public-demo-valkey-1`, `yellow-public-demo-app-1`, and
`yellow-public-demo-tunnel`. It checks that app port 3000 is published solely as
`127.0.0.1:3010`. It will not create or replace containers or touch unrelated
services. If a service is missing, duplicated, renamed, or bound differently, it
stops and directs the operator to the runtime owner’s recovery process.

`-Start` may call `docker desktop start --detach --timeout ...` if the engine is
unavailable, then starts the existing database/cache containers before the app.
The tunnel is started only after `GET http://127.0.0.1:3010/health` returns 200.
That endpoint is a health/liveness check, not proof of complete application
readiness. Docker health status and the HTTP probe are reported separately. The
helper does not probe the public tunnel, so public reachability is always reported
as unverified. Timeouts leave services as-is; there is no stop, kill, or cleanup.

External Docker CLI calls and the aggregate startup/readiness wait are bounded.
The helper never prints container environment values, credentials, or raw command
errors. Its timeout can terminate only its own Docker CLI child process, not the
Docker daemon or a container.

No startup task is registered by this order. If an operator later chooses a
per-user logon task, inspect it before creating it and use the exact script path:

```powershell
$taskName = 'YellowExistingRuntime'
Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$helper = 'C:\path\to\yellow\scripts\start-yellow-existing.ps1'
$action = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument "-NoProfile -File `"$helper`" -Start"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Description 'Starts only the existing validated Yellow demo containers.'
```

Remove only that named per-user task if no longer wanted:

```powershell
Get-ScheduledTask -TaskName 'YellowExistingRuntime' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'YellowExistingRuntime' -Confirm
```

These registration/removal examples are documentation only; this order did not
run them. Do not add auto-build, seed, migration, or unrestricted agent work to a
startup task.
