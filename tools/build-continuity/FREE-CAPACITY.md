# Laptop model capacity — 13 September 2026

Internal build tooling, BUILD-CONTINUITY-001. App feature work was paused by the
founder while this setup was activated. No app/database/release mutation occurred.

| Route | Actual status | Cost boundary |
| --- | --- | --- |
| Kilo / Nemotron Ultra550B Free | Authenticated; first code accepted, then two simultaneous proposal workers completed | Exact free model plus helper whitelist; fresh zero-price catalogue guard; reported cost0 for all three |
| Google Antigravity / Gemini3.8Flash Low | Authenticated; one synthetic code proposal passed16 checks | Existing Google AI Pro included allowance; Use AI Credits observed off; no new purchase |
| FreeModels.Pro | First chat200; requested ClaudeSonnet5 but response model field Nemotron3Super120B; second call429; stopped | No key, login or payment sent; not a trusted automatic route |
| Kilo / North Mini Code Free | Two small attempts rejected: summary instead of code, then malformed/wrong-signature proposal | Free but not accepted coding capacity; not the default |
| Gemini CLI0.59.0 | Installed privately; account service rejected this route and directed Antigravity migration | Not usable capacity; do not count twice |
| OmniRoute | Tooling prepared only; not installed/running | A router creates no credits; unnecessary for two independent CLI processes |
| OpenRouter API controller | Offline tooling prepared, but no API key activated here | Kilo OAuth is not an OpenRouter API key |
| Alibaba Model Studio | Official offer researched; no account quota/key activated here | Eligible90-day trial, typically1M combined tokens per model; Free Quota Only must be enabled and verified first |
| Groq / Cloudflare | Official free tiers researched only | No account/key activated; not secured worker capacity |
| Qwen OAuth | Current upstream docs say discontinued15April2026 | Do not count the historical2,000 requests/day |

## What was verified

The pinned Kilo7.6.2 Windows client lives once inside this checkout's private Git
directory. Its OAuth credential and caches inherit a current-user-only ACL.
The launcher denies tools and nested agents, disables project config/external
plugins, snapshot duplication and session ingestion, and restricts model choice.
No billing account, auto-top-up or provider key was added. The first synthetic run
preceded the session-ingestion opt-out; no sensitive data was used. Do not claim
all historical model transcripts stayed exclusively local.

Kilo first proposal passed62 edge-case/input checks. Two later independent
processes generated regression tests and a catalogue helper concurrently. The
coordinator corrected one test expectation and one helper import before final
acceptance. The focused committed-source candidate suite passes46 tests. Model
outputs are proposals, not self-verifying proof.

Antigravity was already installed and signed by Google; it automatically updated
from1.1.19 to1.2.2. Official sign-in reused the existing Google AI Pro entitlement.
The UI showed100% remaining weekly and five-hour Gemini allowance immediately
before the test; this is a snapshot, not a permanent promise. Use AI Credits was
observed off. Strict permissions denied all seven documented namespaces: file
read/write, commands, unsandboxed execution, URL read/execute and MCP. Only an
empty synthetic workspace was trusted; no Yellow checkout was shared.

The observed Antigravity response and metadata are in
[activation-proof-20260913.json](activation-proof-20260913.json).
Its code passed eight cases (including Unicode casefold/order) and eight
input-preservation assertions. Invocation printed a warning that
`--disable-slash-commands` makes `--mode plan` ineffective. Do not claim plan
mode was active; explicit deny permissions remained configured. For subsequent
plan-mode calls, omit the conflicting slash-command flag.

The existing Antigravity settings file was overwritten with the restricted
profile during activation without a pre-edit backup; earlier settings cannot be
claimed preserved. Existing conversation/history files were left in place.
This restricted profile also affects other Antigravity CLI sessions. Back up and
inspect it before any future change; do not silently loosen permissions.

## Parallel work

Use one coordinator and at most two initially verified independent proposal
lanes, each with a small approved context and disjoint outputs. Kilo's guarded
`kilo-free.ps1 -Action Run -PromptFile ...` can run in separate PowerShell
processes. The original API `batch.py` is **not** authenticated by Kilo login.
Keep application edits/tests/integration with the coordinator until a scoped
order authorizes them. Do not start an unattended feature build merely because a
provider login works. Stop on quota/auth errors; no account rotation or payment
fallback. Free queues can be slow: the larger Kilo proofs took minutes.

FreeModels.Pro received only a public synthetic function specification. Its
public chat transport returned a model identifier inconsistent with the selected
label, and rate-limited the next call. Neither its reported model identity nor
advertised unlimited access has been verified. No automatic adapter was enabled.

## Primary sources

- [Kilo free models](https://kilo.ai/landing/free-models) and [current gateway catalogue](https://app.kilo.ai/api/openrouter/models)
- [Antigravity headless CLI](https://antigravity.google/docs/cli/headless/) and [AI credit controls](https://antigravity.google/docs/cli/credits/)
- [Alibaba free quota rules](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)
- [Qwen Code authentication](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/auth.md)
- [Groq free limits](https://console.groq.com/docs/rate-limits)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [FreeModels.Pro terms](https://freemodels.pro/terms) and [privacy](https://freemodels.pro/privacy)

This setup does not establish a Yellow release pass. Windows ran13 of the
original16 controller tests successfully; three symlink fixtures errored because
the host lacks symlink creation privilege. Linux's historical16/16 result is not
a Windows pass. The newer focused free-price/catalogue suite passed46/46 here.

## Subsequent Spark, FCC and native Qwen evidence

Spark's separate allowance was100% remaining at first check; main Codex weekly
was3%. These are dated snapshots, not current quota guarantees. Spark passed22
synthetic checks, then produced Q285's fixture proposal concurrently with Kilo's
Q286 verifier tests. Root corrected/integrated both:12pass,3native opt-in skips,
0fail,77assertions. This does not prove a native database action/release gate.

FCC6.2.23 is installed. Its bounded read-only dashboard smoke returned admin401
without authentication, admin200 with authentication, health200, inference
POST405. It was stopped afterward. No cloud inference entitlement is verified;
OmniRoute remains uninstalled.

Native Ollama pulled/ran qwen3.5:2b-q4_K_M, but its answer raises AttributeError
instead of the required TypeError for non-string list members. It is not an
accepted coding lane. Existing9B weights were neither loaded nor deleted.
The smaller model used two CPU threads,2048context and one request; no WSL or
Docker VM was started. Six exact idle Claude Desktop processes and Yellow3000
preview were stopped under the founder's resource instruction. Databases,
documents and Windows security were retained. The week queue is prepared;
the existing goal remains paused until the founder resumes it.

Later FCC smoke rerun after exact-listener checks failed readiness; the owned
child was stopped. Earlier smoke success is historical, not a current pass.
Keep FCC off and out of the worker queue. Final coordinator tool tests passed11;
Qwen's executed benchmark passed20/22 and therefore remains rejected for coding.
