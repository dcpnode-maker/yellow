# Yellow local AI lanes

Order 595 makes local inference an optional implementation lane. It does not
replace Astra/GPT for architecture, security, tenancy, occupancy, finance, fiscal,
payments, migrations, final acceptance, or any other high-risk decision.

## Current laptop baseline

- Windows 11, Ryzen 5 5500U (6 cores / 12 threads), 15.35 GiB physical RAM.
- Integrated Radeon graphics borrows system RAM. Its reported shared memory is not
  additional RAM and is not counted as model capacity.
- The system-managed page file remains unchanged. SSD paging is an emergency safety
  valve, not unified RAM and not a performance substitute for physical memory.
- Ollama `0.34.2` is bound to `127.0.0.1:11434`, cloud access is disabled, parallelism
  is one, and only one model may remain loaded.
- The sole retained model is `qwen3.5:9b`, digest `6488c96fa5fa`, 6.6 GB. The obsolete
  `qwen3.5:2b-q4_K_M` tag was removed after the 9B model and upgraded runtime passed
  local API proof.
- The runtime context is 8,192 tokens, with Codex compaction at 6,500. A bounded
  Yellow worker must receive a narrow order and explicit files; it is not a second
  frontier coordinator.
- Vulkan now uses the integrated Radeon only when `OLLAMA_IGPU_ENABLE=1` is set.
  The controlled 22 September A/B probe changed Ollama from `100% CPU` to
  `100% GPU`; warm generation measured about 6.96 tokens/second versus the earlier
  5.77 CPU tokens/second. This is shared-memory acceleration, not extra capacity.

Docker Desktop, WSL, and the retained public-review containers may be offline while
the local model is loaded. Use `yellow-host.ps1` to switch modes without deleting
containers or volumes. Do not run Docker and the 9B model concurrently on this host.

## Measured evidence and limits

The previous Ollama `0.32.15` runtime hung on streamed `/v1/responses`. The official
Windows `0.34.2` archive was verified as
`8F3FD071A2A2F9497B562F43502C77C2B701A99D1EE5DFDA28DA8C786373063B` before the
runtime was replaced; the model store was preserved. A cold streamed Responses call
returned `STREAM_OK` and `response.completed` in 17 seconds. The first full Codex
turn had to ingest about 5,629 project tokens and took about 4 minutes 53 seconds;
subsequent similar prompts used the local cache and were materially faster. With a
16K slot the model process used about 7.2 GiB and left only 1.26 GiB free, so the
supported configuration was reduced to 8K and the model is unloaded between tasks.

Qwen produced a valid Codex shell-tool request twice. The nested Codex CLI process
was prevented from executing even `git branch --show-current` by the parent desktop
host's shell safety policy. Neither `workspace-write` nor approval policy `never`
changed that outer denial. No bypass flag was used. Therefore model routing and tool
selection are proven, but a completed shell-tool execution from this nested desktop
task is **not yet claimed**; it must be rerun from a standalone Windows terminal or a
host version that permits the sandboxed child command.

Two deleted WSL panic reports recorded fatal local machine-check exceptions with
`Processor Context Corrupt`. Their paths, sizes and SHA-256 values remain in
`tools/local-ai/wsl-crash-manifest.json`. Until a bounded sustained CPU smoke test is
stable, local inference is supervised only—never an unattended overnight workload.

## Commands

From the repository root:

```powershell
.\tools\local-ai\yellow-ai.ps1 -Action status
.\tools\local-ai\yellow-ai.ps1 -Action start
.\tools\local-ai\yellow-ai.ps1 -Action local-implement -Prompt 'Bounded order and exact files'
.\tools\local-ai\yellow-ai.ps1 -Action local-review -Prompt 'Read-only bounded review'
.\tools\local-ai\yellow-ai.ps1 -Action prepare
```

`local-implement` uses `workspace-write`; `local-review` uses `read-only`. Both use a
private Codex home under `.git/yellow-local-codex`, strict config, and no bypass.
The current Desktop model picker is not assumed to expose custom providers; use the
wrapper. `prepare` unloads the model to return RAM to builds.

`start` launches the loopback runtime with Vulkan and the explicit integrated-GPU
opt-in, one loaded model, one parallel request, 8K context and cloud disabled. Verify
`processor` in `status`; retain GPU mode only while it reports correctly and remains
stable. Ollama's current [official GPU documentation](https://github.com/ollama/ollama/blob/main/docs/gpu.mdx)
identifies Vulkan as the additional Windows AMD path.

## Bounded Yellow context packets

Do not send the repository, attachment archive, or raw conversation history to a
local model. Those inputs exceeded the devices' useful context and produced timeouts
and invented filenames. Generate one deterministic packet containing the constitution,
agent adapter, exact active-order guardrails and only the explicit task files or
selected skill instructions that still fit admission:

```powershell
python .\tools\local-ai\yellow_context.py `
  --order handoff/orders/595-local-yellow-inference-orchestration.md `
  --topic 'audit context packet failure paths' --lane laptop
```

The command writes content-addressed packet and manifest files under the private
`.git/yellow-local-ai/context` directory. It rejects repository escapes, symlinks,
binary/oversized files and recognizable credential material. Both lanes use a
conservative 6 KiB UTF-8 ceiling; wrapper admission includes the task prompt (and
Aider's explicit files) rather than silently truncating it. Large source or full-skill
inputs fail closed and must be decomposed by Astra/Sol. Pass the
printed packet path with `-ContextBundle`. The operating hierarchy, budgets, leases,
timeouts and capability-resume protocol are in
[`tools/local-ai/ORCHESTRATION.md`](../tools/local-ai/ORCHESTRATION.md).

Measured 22 September calibration prevents overclaiming. A 21.2 KiB full packet
timed out on all three nodes. A hash-linked 10.5 KiB compact packet completed on the
laptop in 293.777 seconds but timed out on both phones; the laptop response also
drifted into unrelated database-invariant tests and exhausted its output budget. A
5.6 KiB phone micro-packet still timed out on both phones. Receipts are private under
`.git/yellow-local-ai/results`. Therefore the laptop is a supervised, tightly scoped
draft/review assistant, while phones are admitted only for tiny classification,
formatting or second-opinion prompts with explicit expected output. None is an
autonomous Yellow implementation or acceptance authority. A timeout quarantines the
lane until `/slots` reports `is_processing=false`; never immediately retry stale work.

## Qwen versus Nemotron and oversized-model streaming

Keep `qwen3.5:9b` as the laptop default until a frozen Yellow benchmark proves a
replacement better. Qwen's [official 9B card](https://huggingface.co/Qwen/Qwen3.5-9B)
targets coding, reasoning and agents. NVIDIA's
[Nemotron Nano 9B v2 card](https://huggingface.co/nvidia/NVIDIA-Nemotron-Nano-9B-v2)
does report strong coding/tool benchmarks, but its published Qwen comparison is to
the older Qwen3-8B, not Qwen3.5-9B. That does not prove a current-model win.

The current Nemotron 3 Nano 30B-A3B Q4_K_M Ollama artifact is about 24 GB, so it
cannot remain resident in 15.35 GiB RAM. Layer-streaming projects such as
[AirLLM](https://github.com/lyogavin/airllm) can make models fit by moving layers
between storage and compute, but do not turn SSD into RAM or make a too-large model
fast. llama.cpp supports CPU inference, memory mapping, continuous batching and an
experimental [RPC backend](https://github.com/ggml-org/llama.cpp/tree/master/tools/rpc),
but batching amortizes prompt work; it does not remove weight/KV memory, and the RPC
documentation labels that backend proof-of-concept and insecure on untrusted networks.
For Yellow's build throughput, one fitting 9B worker plus two independent 4B phone
workers is safer than paging or distributing one oversized model, but the measured
calibration above means those phone workers must receive microtasks rather than a
governance packet plus coding context.

OmniRoute is an optional loopback gateway, not the default path:

```powershell
.\tools\local-ai\yellow-ai.ps1 -Action omni
```

It reuses the independently reviewed 3.8.50 bootstrap. Its lifecycle-disabled install
initially omitted the packaged SQL.js fallback and returned HTTP 500 for every route.
The bootstrap now verifies and atomically colocates the exact `sql.js@1.14.2`
`package.json`, loader and WASM from the installed dependency tree. Live proof on
Windows returned health `200`, rejected unauthenticated `/v1/models` with `401`, and
returned authenticated discovery `200` with 490 catalogue records while keeping the
generated key out of output. No provider, chat, completion or model request was made.
The Windows launcher owns and stops the complete gateway process tree; the smoke proof
confirmed that port 20129 had no listener afterward.
Provider activation remains pending explicit free-only account and current-price
proof. Installing a router does not create free inference quota.

The retained review runtime can be controlled without deletion:

```powershell
.\tools\local-ai\yellow-host.ps1 -Action status
.\tools\local-ai\yellow-host.ps1 -Action review-start
.\tools\local-ai\yellow-host.ps1 -Action review-stop
```

When Docker Desktop is offline, `status` returns one Boolean `docker_ready: false`
and reports every retained identity as `desktop-offline`; it does not misclassify the
preserved containers as missing.

## Phone workers

The OnePlus 10R, 11R and Nord 5 are independent workers. RAM is not pooled over Wi-Fi,
and Android RAM expansion is storage-backed paging rather than physical memory. Each
phone receives a distinct worktree/task and one request at a time.

Google platform-tools `37.0.1` is installed privately under `.git/yellow-local-ai`.
Android still requires a one-time user trust gesture. On the phone, connect to the
same Wi-Fi as the laptop and open **Developer options → Wireless debugging → Pair
device with pairing code**. Then run without printing the temporary code:

```powershell
.\tools\local-ai\yellow-phone.ps1 -Action pair -Endpoint 'PHONE_IP:PAIR_PORT' -PairingCode '123456'
.\tools\local-ai\yellow-phone.ps1 -Action connect -Endpoint 'PHONE_IP:CONNECT_PORT'
.\tools\local-ai\yellow-phone.ps1 -Action status
```

The pair port and connection port are different values shown by Android. Install
Termux, Termux:Boot and Termux:API only after `adb devices -l` identifies the intended
phone. All three APKs must come from the same source/signing family.

The prepared same-source F-Droid APKs are pinned and rehashed by the installer before
ADB can mutate a device:

- Termux 0.118.3 — 113,880,067 bytes — SHA-256 `E6265A57...B11027EC`
- Termux:Boot 0.8.1 — 26,000 bytes — SHA-256 `6F7CF9B9...3D9CF8`
- Termux:API 0.53.0 — 3,956,196 bytes — SHA-256 `4497DBBF...DADDA44`

Each is a valid APK ZIP with `AndroidManifest.xml` and signature metadata. Android's
package manager remains the authoritative signature verifier at install time. The
earlier no-authorized-device state is superseded: Review595 R4 accepted the 10R;
Review595 R13 now accepts the live 11R and installed boot configuration below.
Any additional phone still requires its own explicit trust and identity check.

The phone kit under `tools/local-ai/android` builds pinned llama.cpp in Termux,
generates a private API key, enforces thermal/battery guards, uses one model and one
request, and binds inference only to `127.0.0.1:8080`. Laptop tunnel ports are:

- OnePlus 10R: `127.0.0.1:11435`
- OnePlus 11R: `127.0.0.1:11436`
- OnePlus Nord 5: `127.0.0.1:11437`

The laptop-side orchestration proof renders the selected worker tunnel mapping, starts
a real authenticated fake llama.cpp endpoint on its exact loopback port, checks
`/health` and `/v1/models`, and proves the key is absent from output. This validates
the laptop contract without substituting for Android's manual pairing or claiming a
real-device throughput result.

For roaming on either 5G SIM, use an authenticated encrypted overlay such as
Tailscale to reach Termux SSH, then forward the local model port through SSH. Overlay
installation and account sign-in require the founder's manual consent and are not
claimed yet. Never expose Termux SSH or the inference port directly to the public
internet. Wireless Debugging is restricted to the trusted same LAN. The current 11R
transport depends on its authenticated ADB connection; turn it off when that lane
is not in use. Turning it off also disconnects the laptop's 11R tunnel.

Use an 80% charge limit where the device supports it, active airflow, and the guard's
thermal cutoff. “Always on” means supervised and thermally safe; it never means
disabling Android protection or forcing permanent maximum-performance mode.

## OnePlus 11R setup — 22 September 2026

The exact authenticated device is OnePlus CPH2487 / OP5961L1, Android 16 aarch64,
Termux user `u0_a411`. `/proc/meminfo` reports 15,583,572 KiB physical memory
(15,957,577,728 bytes, 14.86 GiB); Android storage expansion is not included.
It uses one Qwen3-4B-Q4_K_M model, 8,192-token context, four CPU threads and one
request slot. The verified GGUF is 2,497,280,256 bytes, SHA-256
`7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`, obtained from
the official `Qwen/Qwen3-4B-GGUF` repository. The pinned llama.cpp revision is
`b29c606e28a01b1bc8c1351026a0fa6e616bf6c4`.

The phone's SSH daemon listens only on `127.0.0.1:8022`, with password login
disabled and a distinct 11R public key. An authenticated ADB forward exposes that
SSH service only at laptop `127.0.0.1:18022`; an SSH tunnel then exposes phone
inference `127.0.0.1:8080` at laptop `127.0.0.1:11436`. API authentication remains
required through the tunnel. No phone inference or SSH LAN bind is used. Private
keys, the pinned SSH host identity and the API key remain under untracked
`.git/yellow-local-ai/android/keys/`; their values are not documentation or prompts.

Builder proof: direct `/no_think` response `ONEPLUS11R_OK` in 3.217 seconds and
tunneled `TUNNEL11R_OK` in 2.686 seconds; authenticated health/models 200 and
unauthenticated models 401. These tiny prompts establish transport and inference,
not coding throughput. Post-smoke battery temperature 36.2 C and available memory
7,288,748 KiB were measured. Independent Review595 R13 personally reproduced
`REVIEW11R_OK` in 2.640 seconds, model/source identities, authentication and active
supervision. Direct LAN connections to phone ports8080 and8022 were refused while
authenticated tunnel health remained200. Final builder inventory:35.0 C,
8,325,020 KiB available memory and139 GiB free storage (143 GiB before setup).

The guard repair has independent Review 595 R12 acceptance: battery temperature is
used when optional thermal sensors are unavailable; missing/nonfinite readings
fail closed. The hottest usable reading stops inference at 45 C or above, with
restart strictly below 42 C. Sensor checks are sampled every 30 seconds, with bounded
probe timeouts; this is not instantaneous thermal protection or a CPU-temperature
measurement. Android's own protections remain enabled.

The source-pinned build fetched upstream UI assets via its `latest` fallback after
the derived `b1` download failed. Archive SHA-256 is
`c473a9e2438c890362656918a67624676daa87d745bdd1e22479440b5d6945d0`;
the main llama-server executable is
`6bd60bfeeb5779e6fa66ee82341150a3d925e1d9f9f3e7f95d48171f3f3eba51`.
UI assets are not pinned by the source revision; `--no-ui` disables serving them.
No clean reproducible whole-binary build is claimed.

The laptop link requires the trusted ADB connection to remain available. After a
phone/laptop restart, rediscover the exact authorized 11R connection, restore ADB
`tcp:18022` to `tcp:8022`, and restore the authenticated SSH tunnel on 11436.
Wireless-debugging ports may change. This is a same-LAN setup, not roaming 5G access.
Review595 R13 independently verified both installed boot hooks against the approved
installer's exact generated bytes and mode700. The model hook waits for safe
temperature through the supervisor; the SSH hook requires public-key authentication
and explicitly disables both password and keyboard-interactive authentication.
Termux:Boot0.8.1 was launched once and Android reports stopped=false/notLaunched=false.
No reboot was performed, so actual post-reboot delivery and vendor background-policy
behavior remain untested. Supervision is active now; no sustained unattended or
coding-throughput claim follows from the small acceptance prompts.

## Founder worker protocol — proposal and reasoning only

Local laptop/10R/11R models produce bounded proposals, explanations and review
drafts. They are not autonomous executors. The earlier local Codex/Aider launchers
are retained transport experiments, not authority to give a local model unrestricted
terminal, browser, desktop, skill or credential access. Normal dispatch supplies
explicit input artifacts through inference and receives a proposal artifact.

When a worker needs a capability it does not possess, it returns:

```json
{
  "capability_request": {
    "task": "Order and bounded task identifier",
    "command_or_tool": "Exact proposed command or tool operation",
    "inputs": ["Explicit paths or artifact identifiers; never secret values"],
    "expected_artifact": "Exact result needed to resume reasoning",
    "risk": "Read-only, scoped mutation, or high-risk; explain why"
  }
}
```

The sole Astra/Sol coordinator validates scope and authority, assigns only that
bounded action to a proven executor with the required tools, and returns the
artifact and executable evidence to the waiting worker. The worker then resumes.
It may not install tools, bypass permissions, request broad OS access, expose keys,
or self-escalate. Preserve one coordinator lease, one writer per worktree/task,
exact input hashes and audit receipts. Independent non-implementer proof remains
mandatory for high-risk acceptance; local review drafts never replace that gate.
