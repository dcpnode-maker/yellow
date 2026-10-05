# Yellow phone workers

This kit is an opt-in worker lane for the OnePlus 10R, 11R, and Nord 5. Each
phone is an independent CPU worker. Wi-Fi does not pool RAM, and Android
storage-backed memory is not represented as physical RAM.

Current founder policy: these models are proposal/reasoning workers only. Normal
dispatch uses bounded inference with explicit input artifacts. The Codex/Aider
bridge commands below document earlier transport experiments; they do not authorize
autonomous OS execution. Missing capabilities must be returned as a structured
`capability_request` for an Astra/Sol/native Codex executor. See
`docs/LOCAL-AI.md` for the exact handoff contract and current 11R evidence.

The laptop-side contracts are fixed:

| worker | phone service | laptop tunnel | worktree |
| --- | ---: | ---: | --- |
| oneplus10r | `127.0.0.1:8080` | `127.0.0.1:11435` | distinct, assigned manually |
| oneplus11r | `127.0.0.1:8080` | `127.0.0.1:11436` | distinct, assigned manually |
| nord5 | `127.0.0.1:8080` | `127.0.0.1:11437` | distinct, assigned manually |

## Manual pairing (required)

On the phone, install Termux and (optionally) Termux:API and Termux:Boot from
the same trusted source. Enable an SSH daemon and identify the exact target
with an authenticated, interactive `ssh` session. Do not expose port 8080 on
the LAN. The bootstrap is intentionally not an ADB/SSH discovery tool.

After confirming the target, copy this directory to Termux and run:

```sh
sh bootstrap.sh
```

Set `YELLOW_MODEL` to one local GGUF file (or put its absolute path in
`~/.yellow-phone-worker/run/model`). The bootstrap does not download a model
and does not contain credentials. Run `sh supervise-worker.sh` for resilient
background operation, or `sh start-server.sh` for one foreground session.
The server refuses to start when the thermal/battery guard fails and binds
only to loopback. The generated API key is stored with mode 600 and is never
printed.

Install the optional Termux:Boot helper only after pairing:

```sh
sh install-boot-helper.sh
```

It uses a Termux wake lock, stops inference at 45 C, and automatically waits
until sensors fall below 42 C before restarting. It does not bypass Android
charging, thermal, or battery policy. A charge limit of 80% and active cooling
are recommended for sustained work. Stop the worker if Android reports thermal
throttling or the phone is hot to touch.

The guard uses finite battery temperature when optional thermal readings are absent,
and fails closed when no usable temperature is available. Its cutoff is sampled,
not instantaneous. Set `YELLOW_BOOT_SSH=1` only after a distinct public key has
been installed to add an optional key-only SSH boot service on `127.0.0.1:8022`.
The default does not add SSH. The inference supervisor waits through a hot boot
until its below 42 C admission guard passes.

## Laptop tunnel

Use an already authenticated SSH target and an explicit worker name:

```powershell
.\Invoke-PhoneTunnel.ps1 -Worker oneplus10r -SshTarget user@phone-host
```

The script forwards only the selected laptop port to the phone's loopback
8080. It does not discover devices, copy files, create keys, or select a
model. The local API remains authenticated with the phone's API key.

After the tunnel is live, probe the exact selected worker with the API key
file copied through the already authenticated channel:

```powershell
.\Invoke-PhoneWorkerProbe.ps1 -Worker oneplus10r -ApiKeyFile .\private\oneplus10r.key
```

The probe accepts only the fixed loopback port assigned to the selected
worker, checks authenticated `GET /health` and `GET /v1/models`, and never
prints the key. `Invoke-PhoneTunnel.ps1 -DryRun` renders the exact mapping
without opening SSH; the test suite combines that mapping with a real local
fake endpoint to prove laptop orchestration without mutating a phone.

## Codex worker bridge

After a worker tunnel and private key file are present, invoke the phone model
through a bounded Codex subprocess. Give each implementation worker a distinct
Git worktree; use the main repository only for read-only inspection.

```powershell
.\Invoke-PhoneCodex.ps1 -Worker oneplus10r -Sandbox read-only `
  -Workspace C:\path\to\yellow -Prompt "Inspect one bounded order."
```

The bridge discovers the model through its authenticated loopback endpoint,
injects the API key only into the child process, disables remote apps/plugins,
and never prints the secret. A phone worker is not an acceptance authority for
architecture, finance, fiscal, RLS, migration, or posting work.

### Lightweight Aider bridge

For implementation, prefer the pinned Aider bridge because the full Codex
skills/tool envelope is too large for the 10R's 4B model. It requires a
separate Git worktree and explicit files, disables repository-map context and
automatic commits, caps aggregate packet/prompt/files at a conservative 6 KiB, and runs `git diff --check` before
returning work to Codex/Astra:

```powershell
.\Invoke-PhoneAider.ps1 -Worker oneplus10r -Workspace C:\path\to\worktree `
  -Files src\bounded.ts,tests\bounded.test.ts -Prompt "Implement Order N only."
```

## Endpoint

Use `GET /health` through the tunnel for the llama.cpp health endpoint and
`/v1/chat/completions` with the API key for inference. Keep one model and one
bounded request resident per phone; concurrency is deliberately set to 1.
