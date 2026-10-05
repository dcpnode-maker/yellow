# Order 595 — Local Yellow inference orchestration

Founder direction, 22 September 2026: pause feature delivery long enough to make
Codex use low-cost local and free-capacity models for routine Yellow work, while
retaining Astra/GPT-class models for mission, architecture, delegation and final
high-risk judgment. The host is Windows 11, CPU-only, with 15.35 GiB RAM.

## Scope

- this order and its independent review;
- `tools/local-ai/**` and `docs/LOCAL-AI.md`;
- existing reviewed `tools/build-continuity/omniroute.py`, a focused companion
  test, and its private `.git/yellow-omniroute` runtime for verification and
  activation. A source edit is limited to securely colocating the exact pinned
  `sql.js` WASM dependency omitted by the lifecycle-disabled install and making
  foreground process launch work on Windows; it may not add providers, credentials,
  tunnels, interception, or external model calls;
- backed-up user configuration under `C:\Users\astha\.codex\*.toml`;
- the exact official Ollama runtime under `E:\yellow\ollama\app`, upgraded only
  from a digest-verified upstream release while preserving the model store;
- private, untracked runtime dependencies under `.git/yellow-local-ai/**`, including
  Google's official Android platform tools used only with an authenticated device;
- exact Ollama model store `E:\yellow\ollama\models` through Ollama's own model
  commands only;
- the three exact WSL crash artifacts currently under
  `C:\Users\astha\AppData\Local\Temp\wsl-crashes`;
- stopping, but not deleting, exact inactive Yellow proof/review containers after
  inventory;
- append-only handoff ledger and decision record.

No Yellow application, migration, database, serving source, public-container
deletion, provider purchase, account creation, credential submission, browser
automation, unattended phone mutation before an identified ADB/SSH target, Windows service disabling, driver/firmware
change, registry cleaner, broad process killer, WSL distribution removal, Docker
volume deletion, or recursive drive cleanup is in scope.

## Founder amendment — bounded offline build mode

The founder subsequently authorized the exact public app, database, Valkey and
tunnel containers to be stopped without deletion while local inference consumes the
host's RAM, provided their identities and persistent data are preserved and the
review environment can be started again on demand. This replaces the earlier
always-running constraint; it does not authorize container or volume deletion.

## Required result

1. Preserve Astra/GPT as coordinator and high-risk authority. Local workers may
   implement bounded orders and draft tests; they do not self-approve high-risk
   Yellow changes.
2. Use one resident local model at a time. On this host select the strongest model
   that fits alongside Codex and Yellow build dependencies; do not install a second
   large resident model merely to claim a panel.
3. Remove only positively identified obsolete local model tags. Refresh/verify the
   selected official model through Ollama and prove a local API response plus an
   actual Codex `--oss` read-only tool turn.
4. Reuse the independently reviewed pinned OmniRoute 3.8.50 bootstrap. Bind only
   loopback, require its generated local key, keep provider activation free-only,
   and never print secrets. Direct Ollama remains the fastest default; OmniRoute is
   an optional external-capacity/skills lane rather than mandatory middleware.
5. Provide repeatable PowerShell launchers for `local-implement`, `local-review`,
   `omni`, `status`, and safe resource preparation. Default sandboxes must be
   workspace-write for implementation and read-only for review. No bypass flag.
6. Back up each Codex TOML before editing; parse/validate final TOML; prove model
   switching by command output. Document clearly that the current Desktop model
   picker may not expose custom providers and that these lanes are invoked through
   Codex CLI wrappers unless independently proven otherwise.
7. Delete only the three inventoried WSL crash files after recording path, size and
   digest. Preserve their machine-check finding in documentation: sustained CPU
   inference is blocked from unattended use until the host is stable under a bounded
   smoke test.
8. Do not promise that local models equal frontier models. Record measured latency,
   tool reliability and memory, and route architecture/security/fiscal/RLS/finance
   decisions back to Astra/GPT.
9. Add a phone-worker kit under `tools/local-ai/android/**` for the founder's
   OnePlus 10R, 11R and Nord 5. Treat each as an independent worker; never represent
   storage-backed RAM expansion as physical memory or claim RAM pooling over Wi-Fi.
   Use a loopback-only llama.cpp server reached through an authenticated SSH tunnel,
   one model per device, distinct laptop ports and distinct Git worktrees. Include
   thermal/battery cutoffs, a charge-limit recommendation, bounded context/concurrency,
   reconnect/status scripts and an explicit manual pairing step. Start installation
   only after `adb devices -l` or an authenticated SSH target identifies the exact
   phone. Do not expose inference unauthenticated on the LAN.

## Proof

- pre/post disk and memory inventory;
- exact stopped-container list and proof public app/database/Valkey/tunnel identities
  remained running;
- Ollama tag/digest/list proof and local health/chat proof;
- Codex `--oss` read-only repository task completes with no hosted-provider route;
- OmniRoute smoke: health 200, unauthenticated models 401, authenticated discovery
  only after a local secret is loaded without output;
- launcher tests cover quoting, scope, sandbox, secret redaction and failure paths;
- Android bootstrap static tests plus one laptop-side fake-endpoint orchestration
  proof; real-device throughput and always-on status remain unclaimed until the
  founder completes pairing and the device proof runs;
- independent non-implementing reviewer inspects the destructive target manifest,
  personally reruns proofs and records verdict under
  `handoff/reviews/595-local-yellow-inference-orchestration.md`.
