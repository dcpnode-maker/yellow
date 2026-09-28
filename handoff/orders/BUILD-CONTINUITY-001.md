# BUILD-CONTINUITY-001 — free-model development continuation

Status: ACTIVE TOOLING PREPARATION; no production deployment or model quality claim.
Coordinator: Codex, under the founder's 13 September 2026 request to prepare a
working fallback before subscription credits expire. This is an internal build
tool, not Yellow's product AI or a competing roadmap.

Base: `75a2eba1cd34d0512d010bf3f91230ebed4720e7`, receiving draft PR92.
Branch: `phase-14/build-continuity`. Preserve Order472/460 and all 18 phases.

## Scope

- `handoff/orders/BUILD-CONTINUITY-001.md`
- `tools/build-continuity/**` (stdlib controller, focused proof, examples, guide)
- `handoff/reviews/BUILD-CONTINUITY-001.md`
- Append-only `DECISIONS.log` and `handoff/LEDGER.md` entries for this tooling.

Prepare an executable, dependency-free Python controller with replaceable official
model API routes, exact per-task input/output paths, bounded calls, persistent
conversation/provenance, and resumable tasks. No credentials in prompts or Git.
Use native Kilo's free-model selection for the full coding client, pinned to
7.6.2 after MIT/provenance inspection. Start the bounded API worker with official
free-only OpenRouter routes using an external key. Anonymous Zen is experimental
and disabled after the public probe returned403; it is not secured capacity.
Native Gemini/Qwen clients remain separate authenticated alternatives. Free
allowances are availability-dependent, never guaranteed or pooled by invented maths.

The coordinator writes each task manifest and order. Workers may read only the
named context and return proposed file contents. The controller accepts only named
output paths and writes proposals outside the working source. The coordinator
reviews/integrates and runs required tests; no model-selected shell commands,
database credentials, push, merge, deployment or account rotation. Persistent
state belongs in the repository's private Git directory, not model-owned memory.

## Proof and completion

1. Execute hostile path/symlink, changed-base, crash/resume, transcript persistence,
   bounded fallback and free-route rejection tests without network or credentials.
2. Attempt one small real provider call and one bounded synthetic coding task;
   record exact route, outcome, latency and actual output validation separately.
3. Independent non-implementer executes focused proof and reviews containment.
4. Publish only the scoped branch after inspection. A new PR/application release
   remains subject to Yellow's canonical 11/11 PostgreSQL gate; unavailable
   Docker/PostgreSQL here must be stated, not treated as passing.
5. Supply laptop commands and an exact receiving handoff. This cloud session is
   transient; a Git push alone is not a running laptop/server worker.

Do not touch application code, migrations, existing runtime, deployment secrets,
current project status, or provider billing. The founder has authorized routine
account setup/sign-in; any specific unresolved terms or host access remain explicit.

## MERGED

Merged in this continuity branch after local verification:

- `tools/build-continuity/test_continuity.py` hardened for Windows symlink-limited
  hosts (environmental skips) to keep continuity proofs deterministic.
- `tools/build-continuity/start.py` and continuity tooling execute a bounded handoff
  bootstrap and expose provider-lane execution for `--api` tasks.
- Independent review file `handoff/reviews/BUILD-CONTINUITY-001.md` documents synthetic
  and local proof for all tested scope files.

Verification run on this host:

- `python -m unittest discover -s tools/build-continuity -p 'test_*.py' -v`  
  Result: 13 passed, 3 skipped, 0 failed
- `python tools/build-continuity/start.py --api`  
  Result: prepared task successfully; API task remained `blocked` due missing live provider route.
