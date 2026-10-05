# Continue Yellow development when chat credits run out

Prepared 13 September 2026. This is internal development tooling. The receiving
Codex task and `docs/PROJECT-STATUS.md` remain authoritative. Read
`handoff/orders/BUILD-CONTINUITY-001.md` before use.

## Current laptop state — 13 September 2026

Kilo OAuth is authenticated and two independent proposal workers have completed
concurrently after a first bounded coding task passed. Google Antigravity CLI is
also authenticated using the existing Google AI Pro allowance, with **Use AI
Credits off**. Its synthetic coding proposal passed 8 behavioral and 8
input-preservation checks. This is included subscription capacity, not new free
credits or unlimited usage.

See [FREE-CAPACITY.md](FREE-CAPACITY.md) and the appended receiving-host section in
`handoff/reviews/BUILD-CONTINUITY-001.md` for actual proof and limitations.
FreeModels.Pro was tested at the founder's request: its advertised/requested
Claude label disagreed with its response's Nemotron model field, and the second
request returned429. It is **not** an automatic build route.

The app build remains paused for this capacity setup. No feature work, database
change, new deployment, credit purchase or unattended build is implied.

## Original bootstrap instructions

Use the existing laptop checkout and **Kilo's free hosted models**. A small VM
may host the controller later; neither a GPU nor a phone cluster is required for
hosted inference. Do not switch a dirty laptop checkout to this tooling branch.
The receiving coordinator can integrate only this order, review and tooling directory.

From a checkout containing this tooling, with Python 3.10+ and Node/npm installed:

```sh
python tools/build-continuity/start.py --install-kilo --kilo
```

The installer pins `@kilocode/cli@7.6.2`, installs one matching platform package
privately under Git metadata, disables lifecycle scripts, and verifies the binary.
It does not change Yellow's dependencies, runtime or global npm installation.

In Kilo, use `/connect` for the account, `/models` for a model currently marked
**Free**, and `/resume-codex` in a new session to import available local Codex CLI
history. Review the import notice for omitted content. This cannot import an
inaccessible ChatGPT cloud conversation. Use the generated `handoff-context.json`
and repository orders for that handoff. `/sessions` retains working sessions when
models change. Keep one coordinator and assign bounded orders to workers.
Sources: [CLI documentation](https://kilo.ai/docs/code-with-ai/platforms/cli),
[free model terms](https://kilo.ai/landing/free-models).

Kilo currently offers free hosted models without a credit card or external provider
key. Availability changes; no fixed token allowance or frontier-model equivalence
is promised. Select free models explicitly. Automatic paid model selection and
credit purchases are outside this setup. Use only public source or source explicitly
approved for the selected provider; do not import credentials or guest/hotel data.

## Small automatic API worker

`continuity.py` performs bounded proposal generation through official APIs. The
default routes try `cohere/north-mini-code:free`, then
`nvidia/nemotron-3-ultra-550b-a55b:free`, then `openrouter/free`. Their zero prices
were read from the live public catalog in this session. They require an
OpenRouter account key in `OPENROUTER_API_KEY`, configured in the local host's
environment, never pasted into chat or committed. The live model price is checked
before each call and nonzero/unknown prices are rejected; the request caps input
and output prices at zero. The free router can choose different models, so its
quality is variable. [Free router](https://openrouter.ai/openrouter/free),
[live catalog](https://openrouter.ai/api/v1/models).

```sh
python tools/build-continuity/start.py
python tools/build-continuity/start.py --api
```

The first command prepares a read-only handoff without any model request. The
second attempts it. This is a connection/context check, not a coding benchmark.

For a coding assignment the coordinator supplies a JSON manifest:

```json
{
  "id": "unique-order-lane-id",
  "base_sha": "exact-current-40-character-commit",
  "order": "handoff/orders/APPROVED-ORDER.md",
  "inputs": ["src/exact-file.ts", "tests/exact-file.test.ts"],
  "outputs": ["src/exact-file.ts"],
  "goal": "Exact bounded implementation and acceptance criteria"
}
```

```sh
python tools/build-continuity/continuity.py /path/to/task.json --repo .
```

The worker always includes PROJECT/AGENTS/CODEX plus the order. It reads only
named tracked files, limits context/output/call counts, rejects unsafe paths,
and retains the same instructions, replies and attempt receipts on fallback.
Task/source/config changes require a new task id. Interrupted calls consume an
attempt; restarts cannot silently reset the budget. HTTP429 pauses the task until
the recorded reset; HTTP401/403 stops it. Do not rotate accounts to evade quotas.

The prepared handoff includes the first110 explicitly labelled lines of current
status rather than its entire historical ledger. Optional `input_ranges` maps
an input filename to inclusive `[first_line, last_line]`; the full file hash
still participates in change detection. Canonical instructions and the order
cannot be shortened through this setting. Full transcripts remain in private
state; bounded tasks avoid repeatedly sending the whole project history.

Results live under `.git/yellow-continuity/<task-id>/`: `state.json` preserves the
conversation and receipts; `proposal.json` contains scoped proposed file contents.
The worker does not execute model code, modify source, run tests, integrate, push,
merge or deploy. The coordinator reviews and integrates proposals and executes the
order's required proof. These private files are not part of normal Git pushes:
back up that directory separately if moving hosts. Owner-only permissions are
applied on POSIX; Windows host ACLs must protect private state.

The anonymous Zen adapter is experimental and disabled in the default routes.
This session's public endpoint probe returned HTTP403. Official Zen setup requires
an account/API key; anonymous usability has not been demonstrated. The adapter
never accepts a Zen key, so it cannot debit a Zen billing account. Do not treat it
as secured capacity. [Zen documentation](https://opencode.ai/docs/zen/).

## Additional capacity

For independent work, `batch.py` accepts a JSON list of objects with `task` and
`config` file paths. Give each lane a separate manifest, disjoint outputs, and its
chosen model order. Run `python tools/build-continuity/batch.py batch.json --workers 2`.
Up to four calls can be in flight. Validation rejects overlapping output paths
before starting. Quota/access rejection blocks new calls to that provider for
the rest of the batch; calls already in flight may finish. Each worker keeps its
own durable receipt. Start a review lane after its implementation proposal is
available; dependent work is not independent. This is a proposal pipeline, with
Codex retaining integration and test authority. Speed is measured by accepted,
tested work, not by tokens consumed or number of active models.

Alibaba Model Studio has a real **temporary** new-user offer: eligible Singapore
International models typically receive 1 million combined input/output tokens per
model for 90 days. Enable **Free Quota Only**, wait for it to take effect, and verify
each selected model before calling. ECS VM trials are separate and eligibility-
dependent. No Alibaba account, quota or VM has been provisioned here.
[Model quota rules](https://www.alibabacloud.com/help/en/model-studio/new-free-quota),
[VM trial center](https://www.alibabacloud.com/free).

Receiving-host correction: the installed Gemini CLI0.59.0 reached Google's
sign-in service, but the service rejected this individuals route and directed
migration to Antigravity. Antigravity subsequently authenticated and generated a
passing synthetic proposal. Do not count Gemini CLI separately.
[Qwen Code's current authentication documentation](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/auth.md)
says free Qwen OAuth was discontinued on15April2026; the historical2,000/day
claim is not available capacity. Qwen API use requires its own valid entitlement.

If “Deep Harness” means [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
it is an MIT developer preview requiring model access, not free model credits.
Its published [safety notice](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md)
identifies unaudited, powerful local execution. It is not installed as Yellow's
controller. OmniRoute/LiteLLM can route existing entitlements; their installation
does not create new model allowances. Adding another framework is unnecessary for
this first continuation setup.

## Historical originating cloud state (superseded by laptop activation below)

The accompanying review records personally executed offline checks. These prove
bounded routing and state behavior, not model quality. A real external coding
generation has not passed in this session. Kilo sign-in is blocked on explicit
email-method and Terms & Conditions approval by automatic approval review.
No provider credits, card, cloud VM or laptop process has been activated. The pinned Kilo CLI installation and version probe passed in this temporary workspace; provider sign-in is pending. OmniRoute preparation is recorded separately in OMNIROUTE.md.
This environment is a temporary cloud workspace, not the founder's laptop.

Yellow's canonical PostgreSQL 11/11 gate remains required for a reviewable PR and
application release; Docker/PostgreSQL are unavailable here. A tooling branch
publication is not that proof. Astra can coordinate while this session has access;
after credits expire, a running external worker follows saved instructions and
checkpoints. This is not a permanently running copy of Astra.

## Reproduce focused proof

```sh
python -m unittest discover -s tools/build-continuity -p 'test_*.py' -v
```

CLI provenance: npm `@kilocode/cli@7.6.2`, MIT, upstream
`https://github.com/Kilo-Org/kilocode`. Downloaded wrapper archive SHA-512 integrity:
`sha512-u6jkEF4nN5lXoSSIRl1RApciDzHP4HvrsG+DZbMod8MPDysOYtfQujeuI+6tAhmWhJxj3w3d6b5I0dvXPirGew==`.
The archive's license, manifest, launcher and postinstall code were inspected.
This is provenance review, not a complete audit of the compiled CLI or its services.

## Activated Windows laptop profile — 13 September 2026

The receiving coordinator imported only the 14 new files from commit
`35e100963b433b00497cc334ff7e9fb08b897d71`; the current branch and its existing
staged/unstaged work were preserved. Kilo 7.6.2 was installed privately and the
founder completed official device authorization. No OmniRoute gateway has been
installed or started on this laptop.

For subsequent Windows use, prefer the guarded entry point:

```powershell
& .\tools\build-continuity\kilo-free.ps1 -Action Models
& .\tools\build-continuity\kilo-free.ps1
& .\tools\build-continuity\kilo-free.ps1 -Action Run -PromptFile "PATH-TO-CURATED-PUBLIC-TASK.txt"
```

Use `-Action Login` if the official login must be renewed. Do not paste a token
in chat. The script resolves this checkout's private Git directory, verifies the
accepted Windows binary and current-user-only ACL, and checks live public pricing
before a model task. It pins
`kilo/nvidia/nemotron-3-ultra-550b-a55b:free` for the main and helper model and
allows only that provider/model. An unavailable or nonzero/unknown-price model
stops the launcher; it does not choose or purchase another model.

`kilo-free.json` defines a proposal-only worker with a two-step ceiling. A
one-step ceiling caused the tested North model to summarize instead of supplying
code, so the ceiling was deliberately raised; its subsequent proposal still
failed acceptance. North is not recommended for coding on this evidence.
All tool permissions,
nested agents, project configuration, external plugins, snapshot duplication,
remote control, session ingest/sharing and telemetry are disabled for these runs.
The OAuth credential remains under the protected private Kilo data directory.
Do not use plain `kilo` from another profile and assume these controls apply.
The original `start.py` is a generic installer, not this laptop's free-only guard.

Supply only the exact public source and task needed, never guest data, credentials,
environment files or a full private transcript. Review proposed code and execute
its tests as coordinator. Two concurrent CLI processes can use disjoint tasks;
do not start dependent work before its inputs are accepted. Free capacity and
latency are variable and are not equivalent to guaranteed paid capacity.

The default main/helper/agent model is free Nemotron. The launcher also exposes
an explicit optional North model parameter; when selected, it rewrites all these
model fields and the whitelist together and applies the same live price gate.
It does not automatically fail over to North. For the initial proofs use the
default Nemotron route. Prompt files must be approved public-task text files
directly inside the protected continuity directory, named `*-prompt.txt` or
`worker-*.txt`; the generic placeholder above is not an arbitrary-path allowance.

## Week queue and verified lanes — 13 September continuation

Read [WEEK-PLAN.md](WEEK-PLAN.md) and [week-plan.json](week-plan.json).
Sixteen dependency-linked cards are prepared; the first two source proposals
have been integrated. This is a capacity plan, not a completion guarantee or
a running scheduler. The existing goal is paused; the founder must Resume goal.

Spark uses the existing account's separate allowance, not unlimited free usage.
`spark-proposal.ps1` pins gpt-5.3-codex-spark, disables tools and uses an empty
read-only workspace. `prepare-proposals.ps1` prepares only the bounded Q285/Q286
packets, not a general weekly dispatcher. Two cloud proposals maximum.

FCC6.2.23 is installed at `D:\Yellow\runtime\free-claude-code`, upstream
`bf59598ccc04b02befa1d649dfbcc569534c365c`. `fcc-local.ps1` provides a loopback-only
authenticated read-only dashboard. Inference/writes are blocked by
`fcc_guard.py`. Secrets stay local; no paid provider or free Claude entitlement
has been activated. Leave the dashboard off when idle.

`qwen-local.ps1` runs native Windows Ollama, never WSL. The smaller
`qwen3.5:2b-q4_K_M` downloaded and answered in13.43seconds including load, but
failed non-string input validation. Runtime availability is verified; coding
acceptance is not. Keep it out of the production coding queue. Initial low-RAM
refusal and the later outcome are both in `qwen-local-proof.json`. Its owned
server is stopped after each bounded attempt; the9B model stays unloaded.

FCC's post-hardening smoke rerun failed readiness and shut down its child.
Earlier dashboard smoke success does not certify the changed launcher. Leave
FCC off/out of the coding queue; Spark/Kilo/Gemini are the verified cloud lanes.
