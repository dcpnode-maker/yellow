# Question 011 — Android idle local-LLM workers for Yellow

Status: architect decision and scoped work order required  
Requested by: founder  
Pilot device: OnePlus 10R (personal device; personal data must remain isolated)

## Founder intent

Use otherwise-idle compute from three personal Android phones (OnePlus 10R, OnePlus 11R, OnePlus Nord 5) as independent local-LLM workers for bounded Yellow coding tasks.

The worker must:

- run only while the device is connected to power, on unmetered networking, and not being used;
- pause promptly when the device becomes interactive or the user starts using it;
- pause on unsafe thermal or resource conditions;
- never inspect or request access to personal applications, messages, contacts, photos, credentials, notifications, microphone, camera, location, or shared storage;
- avoid a persistent Yellow checkout;
- fetch only the minimum task-specific repository context;
- submit work as commits on isolated task branches / draft pull requests;
- never write or merge `main`;
- erase temporary task source after a result is uploaded or abandoned.

Start with the OnePlus 10R and expand only after measured validation.

## Why the builder stopped

`AGENTS.md` permits implementation only from an architect-authored order. The existing Order 014 scope permits prototype-only frontend work and does not authorize an Android worker, task broker, GitHub credential flow, or local-model runtime. This question deliberately does not widen Order 014.

## Proposed system boundary

The phone is a low-trust, bounded implementation worker—not an architect, reviewer, CI authority, source of truth, or merge authority.

```
trusted coordinator -> signed bounded job -> phone worker
phone worker -> patch + evidence -> phone/<device>/<job> branch -> draft PR -> normal CI/review
```

The local model process receives task text and explicitly supplied files only. It never receives a GitHub credential or unrestricted network access. A deterministic host layer performs all fetching, validation, branch creation, commit creation, upload, cleanup, and audit logging.

## Proposed OnePlus 10R pilot

### Runtime

- Native Kotlin Android application rather than an unrestricted shell or accessibility service.
- `llama.cpp` Android runtime.
- Initial model: `Qwen2.5-Coder-3B-Instruct-GGUF`, `Q4_K_M` (approximately 2.1 GB).
- Conservative context window (4K initially; 8K only if memory and thermal measurements permit).
- One inference job at a time; thread count and batch size established by benchmark rather than assumed.
- The model file is the only intentionally persistent large artifact.

The model choice is provisional and must be replaced if a controlled task benchmark shows excessive review burden or unsafe thermal behavior.

### Scheduling and immediate pause

Use WorkManager constraints as the coarse gate:

- charging required;
- unmetered network required for job acquisition/result upload;
- device idle required;
- battery not low;
- storage not low.

Use a long-running `CoroutineWorker`/foreground notification for visible, cancellable work. Add stricter runtime gates:

- do not start until the device has remained non-interactive for a cooldown period;
- observe `PowerManager.isInteractive()` and screen interactive-state broadcasts;
- cancel/pause inference immediately on interactive state;
- observe charging state throughout the job;
- observe thermal status; pause at `THERMAL_STATUS_MODERATE` or above and resume only after a cooldown at `NONE`/`LIGHT`;
- expose a permanent notification action: **Pause Yellow worker**;
- default to no work during calls or media activity if reliable non-sensitive signals are available without privileged permissions.

Android WorkManager explicitly supports charging, unmetered network, storage, battery and device-idle constraints and stops work when constraints become unmet. Android also documents long-running local-ML workers through a managed foreground service.

### Minimal-storage repository flow

No persistent clone is required for patch-only tasks.

1. Receive a signed manifest pinned to an immutable base commit SHA.
2. Verify signature, expiry, device assignment, order identifier, allowed file globs, maximum download bytes, maximum output bytes, and validation command allowlist.
3. Fetch only named source blobs plus a small architect/Codex-generated context pack.
4. Store them only in the app-private cache directory.
5. Run the local model with a structured patch contract.
6. Reject changes outside the allowlist and reject malformed or oversized patches.
7. Run lightweight deterministic checks that fit the supplied context.
8. Use the GitHub Git Data API to create blobs/tree/commit/ref on `phone/10r/<job-id>`.
9. Open or update a draft PR containing model/runtime/base-SHA/test/thermal evidence.
10. Zero references, close file descriptors, and delete the task cache whether the job succeeds, fails, pauses too long, or is cancelled.

A build/test task necessarily needs more files and dependencies. Such a job may use a size-capped ephemeral sparse worktree/cache, but it must declare the expected storage budget before acceptance and delete it afterward. Full database/Docker acceptance remains on trusted CI, not the phone.

The current repository is only a few megabytes; the model weights, dependency cache, and build outputs—not Yellow source—are the dominant storage costs.

### Authentication and task integrity

Preferred:

- GitHub App installation tokens minted by a trusted coordinator, scoped to this repository and short-lived;
- Android Keystore-backed device identity;
- signed job manifests with replay protection;
- branch namespace restricted to `phone/<device-id>/...`;
- no long-lived personal access token exposed to the model process;
- no inbound port on the phone;
- coordinator egress restricted to required GitHub/model endpoints;
- remote revoke/kill switch.

Do not attach these personal phones as general self-hosted runners to the public repository. Untrusted public pull requests can compromise persistent self-hosted runners.

### Initial task allowlist

Suitable for evaluation:

- prototype-only UI components already specified by an approved order;
- mock fixtures and deterministic fixture consistency checks;
- tests generated from an approved specification;
- documentation and examples;
- formatting/type errors with a narrow file allowlist;
- log classification and candidate patch generation;
- accessibility/static review that produces a report or draft patch.

Never delegate to the phone model:

- migrations or production schema;
- occupancy;
- journals, posting, payments, fiscal chains or money semantics;
- RLS, tenancy, identity/authentication or secrets;
- state machines or production events;
- dependency, workflow, build-security or supply-chain changes;
- architectural decisions;
- merges or approval decisions.

These exclusions repeat, rather than weaken, `PROJECT.md` and Order 014.

## Evaluation gate before adding the 11R and Nord 5

Run a controlled suite of at least 20 small tasks with known expected outcomes. Record:

- completion and correct-patch rate;
- tests passed;
- human/Codex review time added or saved;
- tokens per second and end-to-end latency;
- peak memory;
- model and temporary storage;
- maximum thermal status and cooldown frequency;
- pause latency after the device becomes interactive;
- abandoned/resumed job correctness;
- battery behavior while connected to power;
- any personal-data permission requested (target: zero).

Expansion is allowed only if the worker produces net-positive reviewed throughput without interfering with normal phone use.

## Architect decisions requested

1. Should the worker live in this repository under a clearly isolated tools directory, or in a separate repository with Yellow containing only the job contract?
2. Approve or replace the native Kotlin + llama.cpp + 3B Q4 pilot.
3. Define the trusted coordinator and GitHub App/token-minting boundary.
4. Approve the signed job manifest and temporary-context approach.
5. Approve the initial task allowlist and explicit forbidden list.
6. Issue a tightly scoped implementation order containing files, tests, threat-model requirements, and acceptance criteria.
7. Decide whether successful phone-generated patches may target the Order 014 branch or must always target a separate integration branch.

Until those decisions and an order exist, no Android worker code should be added.
