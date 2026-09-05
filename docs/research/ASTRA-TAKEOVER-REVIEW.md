# Astra — Yellow takeover findings and independent research

**5 September 2026 · Order438/439 · Implementation candidate; final acceptance recorded in the release review**

The shared conversation is now incorporated into the canonical Yellow task. Its
full visible text was read, including every user request; four redacted plugin
entries remain unavailable. The research below was completed before implementation
and is retained with its original snapshot and limits. This addendum records what
the subsequent repository audit found and what the takeover is changing.

## Findings that determine the build

| Finding | Evidence | Action in this consolidation |
|---|---|---|
| Documentation and the usable application describe different revisions | Main2e55b884 holds an older integrated app; PR80 contains the newer operational flows | Consolidate a reviewed application candidate and show its exact source revision/readiness |
| Open PR count greatly exaggerates unfinished independent implementation | 62 open PRs; 52 already preserved in main, 5 unique historical prototypes/foundations, 4 superseded by the development stack, 1 current integration | Close superseded and archived PRs with exact source retention in the consolidation manifest |
| The fiscal draft boundary is incomplete | Applied0074 grants the runtime a native issue capability while Review430 remains CHANGES REQUIRED | Forward migration0075 revokes that exact capability; preserve history and all unfinished434 work |
| Development434 contains substantial genuine invoice proof but is not accepted as a release | D1371 records native maximum-bound and winner evidence; complete integration/concurrency/independent acceptance remains unfinished | Reserve future evidence/completion migrations76/77 and keep them outside the production runner |
| Core project and status files are stale | PROJECT describes81 tables, native Windows setup asserts89, shell frontier is125; the state parser mistakes historical phase references for current work | Current project status, explicit task and accurate75-migration/125-table catalogue references |
| No connected Yellow cloud app was found | No repository deployment workflow or existing Sites origin; no supplied OCI host/DNS/credentials | Build traceable release images after green main CI; require a concrete private preview target before claiming cloud deployment |
| A simple health response is insufficient | Existing /health only proves the process responds | Add build identity and database readiness while preserving /health compatibility |

The archive manifest preserves the OTA evidence normalizer, exact-money channel
contract and Android model-preparation work. None is a missing live hotel user flow:
the first two are pure contracts without UI/API/persistence integration; the Android
worker explicitly stops at MODEL_READY. Their old PRs can close without pretending
those foundations have been shipped or deleting their source branches.

## Requirements carried into the main Codex task

- Preserve the complete hospitality product: all18 phases and the13 bounded contexts,
  including reservations, stay operations, native finance, channels, CRS/CRM, STR,
  owner/trust functions, region packs and eventual integrations.
- Make Codex the single development/coordinating owner. Use independent internal agents
  for review and bounded model work; the implementer does not approve or merge itself.
- Keep TypeScript/Bun/Elysia/PostgreSQL now; require measured Yellow journey evidence
  before a rewrite. Preserve RLS, exact money, atomic occupancy, append-only accounting,
  outbox ordering, authorizations and approval rules.
- Build toward one authorized command/query layer for touch, keyboard, automation,
  integrations, chat and voice. Speech/models propose intent; runtime policy authorizes
  the exact entity and command. Ambiguous or privileged operations require resolution
  and the applicable approval, never invented authority.
- Keep the staff-first, low-training journey design, multiple coherent appearance
  directions and device-appropriate desktop/tablet/mobile experiences. Native iOS,
  Android and watch use remain planned product work, not browser theme claims.
- Use frontier models for research/build/evaluation where valuable. Select cheap,
  reliable production speech/model components from measured multilingual hotel tasks,
  latency, cost and recovery behavior. The existing rate-intent adapter is not Jarvis.
- Preserve roadmap priority11→13→17 subject to dependencies. Keep tax/provider/OTA
  activation, voice, RMS and native clients visibly uncompleted until their proofs pass.
- Provide one versioned Git source, an exact local revision, and reproducible cloud
  artifacts. A retained scratch checkout is not evidence of the founder's Windows app.
- Treat WSL crash-dump cleanup separately from application data. No user's host, VHD,
  database volume or previous checkout has been deleted by this consolidation.

## Verification record and limits

The final executable release decision belongs in the Order438/439 independent
reviews and the exact GitHub Actions run, not in a prediction here. The managed
executor supplies Bun1.3.14 but cannot launch a supported nonroot PostgreSQL/Docker
server; full DB acceptance must run in genuine CI PostgreSQL16 containers or the
supported user-local Docker/WSL environment. No skipped database test is a pass.

No public/customer production deployment is claimed. A configured private preview
still needs TLS/access control, a concrete host and database destination, separate
migration/runtime authority, backup/restore evidence and a serving-revision check.
The repository's broader production identity and operational requirements remain.

The following original research is intentionally retained as a dated, read-only
assessment. Its statement that no files were changed describes that earlier research
stage, not the subsequent Order438/439 implementation.

---

# Astra Ankit — Yellow independent review

**Prepared for Ankit · 5 September 2026 · Research and source review only**

**Decision:** Retain PostgreSQL and the existing TypeScript/Bun/Elysia domain core for the next delivery cycle. Build the shared command/query boundary and adaptive experiences around that core. Validate performance and total operating cost on actual Yellow journeys before selecting a different language, database topology, mobile framework, or production AI model.

The shared conversation contains a credible product direction. It does not establish that Yellow is already fast, inexpensive to operate at scale, complete, or capable of the proposed voice experience. The largest immediate opportunity I found is closing the distance between the requirements, development branch, reviewed integration, and the application Ankit can actually use.

**Scope and evidence**

I recovered and read the full visible text of [the shared conversation](https://chatgpt.com/share/6a9c5732-db10-83e9-b237-2f507e686e77). Four entries say the plugin output was redacted; their underlying contents are unavailable. I independently consulted primary technical sources and inspected selected Yellow implementation files, architecture, feature register, decisions, and delivery evidence.

Repository snapshots inspected:

- Main: [2e55b884](https://github.com/dcpnode-maker/yellow/commit/2e55b88488300b1d4efb551f8ec79698dbb52dad), a documentation merge on 5 September.
- Development: [6a981cce](https://github.com/dcpnode-maker/yellow/commit/6a981cce0672a6018fa79872e828e3c003fd3f71), on the branch associated with open [PR #80](https://github.com/dcpnode-maker/yellow/pull/80).
- A retained local checkout was older. Its read-only state command reported its services down. It does not establish the state of Ankit's Windows/WSL machine.

This is a targeted architectural review, not an exhaustive code audit, penetration test, measured performance comparison, or production acceptance test. Existing test results below are repository records; I did not rerun them. No application, deployment, database, device, or WSL configuration was changed.

**1. The benchmark facts are real; the operational conclusion needs restraint**

ARC Prize's verified table reports Astra at **62.71% with the standard harness at max reasoning**, and **99.95% with the provider adapter at high reasoning**. The corresponding reported evaluation costs are approximately **$26,098 and $18,817**. These are evaluation-run costs, not prices for one hotel command. The two configurations preserve working context differently, so a comparison that changes both model and harness does not isolate the model improvement. [ARC Prize results](https://arcprize.org/results/openai-gpt-6-astra)

ARC-AGI-3 examines exploration, modeling, goal discovery, and planning in unfamiliar interactive environments. ARC Prize explicitly says saturation does not prove AGI. Its human comparison concerns action efficiency in bounded games; it does not establish hotel-task reliability, real-world execution speed, or commercial cost efficiency. [ARC Prize analysis, 3 September 2026](https://arcprize.org/blog/astra)

My inference: a more capable model can help with architecture, debugging, research, simulations, and design iteration. Its value to Yellow must be established through Yellow-specific results. A puzzle benchmark does not certify tax correctness, resistance to ambiguous guest names, multilingual speech accuracy, or exceptional interface design.

The chat's quoted Astra context and base API prices are supported by the official model page: **1,050,000 context tokens; $10/million input and $50/million output tokens**. Rates differ for caching, long context and service modes. The model page does not list direct audio support; a voice product needs a speech pipeline. [Official model specification](https://developers.openai.com/api/docs/models/gpt-6-astra)

**2. The current project is more developed than main's application code suggests**

Main's README explicitly states that its documentation was synchronized while its application remains an older integrated baseline. It points to the development branch and PR #80. Therefore, reading only main could materially understate implemented work; reading development documentation alone could materially overstate what is usable. [Main README at the inspected revision](https://github.com/dcpnode-maker/yellow/blob/2e55b88488300b1d4efb551f8ec79698dbb52dad/README.md)

The development branch contains actual tenant transaction code, operational routes, financial and stay-operation surfaces, a local deterministic rate-intent adapter, and an optional compatible provider adapter. This is substantive work worth preserving. The rate adapter defaults to the local path and proposes changes; it is not an app-wide conversational assistant. [Transaction implementation](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/kernel/db.ts), [operator API](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/http/operator.ts), [rate-intent provider](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/contexts/rates/intent-provider.ts)

The feature register and voice/RMS plan distinguish foundations from unimplemented journeys. They do not claim a speech runtime, streaming ASR/TTS, generic authorized query catalogue, complete conversational gateway, or measured voice/RMS latency. [Feature register](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/docs/FEATURE-REGISTER.md), [voice/RMS proposal](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/docs/architecture/VOICE-RMS-PLAN.md)

A further distinction matters: the latest ledger is ahead of some status prose. It records working native invoice checkpoints and independent bounded proofs, but still says whole Order434 acceptance, migration work, and full independent review remain unfinished. It explicitly does not claim main/local/Phase7 completion. Consequently, “no implementation exists” and “fiscal issuance is finished” would both misrepresent this snapshot. [Development ledger](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/handoff/LEDGER.md)

**Recommendation:** Make each customer-facing capability show its implementation revision, relevant executable proof, review state, integrated revision, and serving-app revision. An order count, a phase number, or a large passing-test count cannot replace this chain. Skipped database tests remain skips. Preserve the existing review gates while making user-visible integration a first-class outcome.

**3. Keep the stack, but make that a measured decision**

The chat's argument against an immediate full rewrite is persuasive. No benchmark I inspected demonstrates that another complete stack would make Yellow materially faster or cheaper. That is an absence of evidence for a rewrite, not proof that Bun/Elysia is optimal.

| Option | My assessment for Yellow | Evidence needed to change direction |
|---|---|---|
| Current TypeScript/Bun/Elysia with PostgreSQL | Best-supported next step because useful implementation and integrity controls already exist | Profile complete customer journeys and quantify resource use |
| Node.js with TypeScript | A possible compatibility or operational alternative | Demonstrated Bun-specific reliability, tooling, or support disadvantage |
| Go or Rust for a bounded component | Plausible for a measured CPU or memory problem | End-to-end savings after serialization, deployment, testing, and maintenance costs |
| Full Go/Rust/Java/.NET rewrite | Currently unjustified | Sustained system-level benefit exceeding migration and regression costs |
| SQLite or an edge store | Useful candidate for device caches and eligible queues | Explicit synchronization, conflict, and inventory-authority rules |
| Distributed SQL, microservices, extra brokers/datastores | Keep as future options | A concrete availability, geographic, throughput, or isolation requirement |

Illustration, not a Yellow measurement: if application computation accounts for 20% of request latency, making it five times faster changes total latency to 84% of its original value—a **16% reduction**, not a fivefold improvement. The remaining time still exists.

PostgreSQL 18 is a supported production line and adds features such as asynchronous I/O and skip scans; PostgreSQL 16 remains supported. These features do not imply a uniform reservation-throughput improvement. Benchmark current supported minor releases against representative reads, commits, locks, migrations, and restore procedures before a major upgrade. [Version policy](https://www.postgresql.org/support/versioning/), [PostgreSQL 18 release notes](https://www.postgresql.org/docs/release/18.0/)

**4. Concrete performance candidates found in the code**

These are source observations and testable hypotheses, not measured defects.

| Observation at development revision 6a981cce | Implication and proposed measurement |
|---|---|
| operator.js is 700,027 bytes; operator.css is 312,466 bytes; the HTML shell is 130,627 bytes | The three source assets total 1,143,120 bytes before transport compression. Measure actual transferred bytes, parse/style/layout cost, and interaction latency on a representative phone. |
| The common HTML directly references the common script and stylesheet; the server serves these files | Investigate feature-based loading, splitting selected appearance assets, and versioned asset caching while retaining permission-safe dynamic data handling. |
| The tenant transaction wrapper awaits BEGIN, tenant setup, role setup, COMMIT and settlement verification around the operation | Measure these database exchanges, pool wait and domain query count. Co-locate app and database; do not remove tenancy/settlement checks to improve a benchmark. |
| Outbox publication takes a single shared transaction advisory lock | Measure cross-tenant write contention and lock hold time under bursts. Preserve the ordering guarantee; changing or partitioning it requires a proved ordering/recovery design. |
| Operator transport/presentation orchestration is concentrated in a roughly 311 KB TypeScript file | This is a maintenance and change-isolation concern. Extract cohesive application boundaries incrementally with behavior preserved. File size alone does not prove runtime slowness. |

Sources: [common HTML](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/http/operator/index.html), [script](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/http/operator/operator.js), [stylesheet](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/http/operator/operator.css), [asset/API code](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/http/operator.ts), [database wrapper](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/kernel/db.ts), [outbox](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/kernel/outbox.ts)

The asset figures are repository byte sizes. I did not measure compressed responses, runtime memory, or the live app's cache behavior. “no-cache” in the asset response means revalidation; it does not mean “never store.”

The chat's 16 ms figure should be treated as approximately a 60 Hz frame interval, not the time for a network transaction or a complete voice command. Google's INP guidance considers 200 ms or less good at the 75th percentile and explicitly distinguishes initial visual feedback from eventual asynchronous results. [INP guidance](https://web.dev/articles/inp)

Measure separately: first feedback, useful data display, authoritative commit, speech transcription delay, and final spoken response. Publish p50/p95/p99 with device, network, load, cache condition, database size, errors and freshness. A fast stale answer is not operational success.

One technical statement in PROJECT.md needs more precision: JSONB text extraction does **not invariably** force a sequential scan. PostgreSQL supports expression indexes; the relevant expression, operator, index and plan must match. The existing project's prohibition remains binding until formally revised, but it should not be generalized into a universal PostgreSQL limitation. [Project statement](https://github.com/dcpnode-maker/yellow/blob/2e55b88488300b1d4efb551f8ec79698dbb52dad/PROJECT.md), [expression indexes](https://www.postgresql.org/docs/18/indexes-expressional.html)

**5. Jarvis is feasible as a product boundary, with more work than a parser**

“Show today's arrivals,” “open room 201,” and “mark this task complete” are credible capabilities. The difficult parts are entity resolution, property/time context, freshness, current authorization, reliable execution, and recovery.

Proposed shared architecture:

~~~mermaid
flowchart TD
  I["Touch, keyboard, voice or chat"] --> R["Resolve intent and exact entities"]
  R --> P["Current identity, scope and policy"]
  P --> Q["Authorized query"]
  P --> C["Validated command and required approval"]
  Q --> D["PostgreSQL truth or labelled projection"]
  C --> T["Atomic transaction, audit and outbox"]
  D --> U["Result, freshness and interface update"]
  T --> U
~~~

Speech recognition and optional language models sit before the shared policy boundary. They may propose an interpretation; they cannot manufacture authority.

The code already performs some property/scope checks in the HTTP adapter before calling a service. For example, check-in readiness derives override authority there. Simply exposing an internal service method as an AI tool would not establish equivalent authorization. Move or consistently reuse the complete authorization-and-command boundary for every caller. [Operator boundary](https://github.com/dcpnode-maker/yellow/blob/6a981cce0672a6018fa79872e828e3c003fd3f71/src/http/operator.ts)

A useful capability definition records the parameter schema, entity resolution, permitted data fields, property and role scope, current-state checks, approval requirements, idempotency, freshness, and resulting UI destination. Start with a small useful catalogue and extend it through real callers.

A schema-valid response can still target the wrong Sharma or the wrong room. “Today” must use the hotel's business context. “Best room” needs explicit constraints and preferences. “Upgrade” must distinguish assignment, category, rate and inventory effects. Read-only information also needs field-level restrictions: housekeeping should not hear a guest's balance simply because a watch can speak it.

Approvals should bind the exact action, target, amount and state, expire when appropriate, and be revalidated before execution. Multi-step workflows need progress and partial-failure receipts. Guest notes, messages and imported content are data; they cannot change the application's policy.

**6. Low cost is achievable; zero operating cost and fixed routing percentages are not established**

The best idea in the chat is using powerful AI during development to produce reusable algorithms, tests, queries and workflows. Many repeated tasks can then execute without frontier inference.

However:

- A deterministic tool executing a request does not make unconstrained natural-language understanding deterministic.
- A small local model has compute, memory, power, maintenance and error-recovery costs.
- Hosting inference yourself is not automatically cheaper at low utilization.
- “90–98% avoids frontier AI” is an unvalidated target until a representative request corpus establishes coverage and safe fallback.
- A discovered rule needs testing, versioning and monitoring before promotion; not every useful reasoning task can be compiled into fixed code.

Select execution by **cost per correctly completed task**, including retries, clarification, supervision and failures. A local/shared model can win at sufficient utilization; a small metered model can win at low utilization. Keep provider substitution possible.

Illustrative arithmetic using the cited base Astra rates: 2,000 uncached input tokens plus 300 total billable output tokens cost **$0.035**. This is not a typical-command forecast; actual reasoning tokens, speech, tools, retries, context and service tier change the bill.

For ordinary operations, favor existing commands, parameterized queries, search and deterministic summaries. Add constrained interpretation where needed, then a measured small-model fallback. Treat frontier production reasoning as an optional capability with an explicit budget.

Measure infrastructure and support cost per property, per reservation and per occupied room-night. Include backups, restoration, monitoring, storage growth, messaging, provider fees and fleet support. A lower cloud bill can conceal a higher total cost.

**7. Design for each job and available window**

I agree with adaptive desktop/tablet/phone/watch experiences. I would revise the advice to “start almost empty”: a receptionist during arrivals or a revenue manager comparing dates needs visible working information. Simplicity means obvious next actions and well-managed detail, not universal blankness.

Preserve the requested appearance families and alternative designs. Compare genuinely different layouts on the same tasks before maintaining several full production presentation systems. Shared data and commands do not require identical layouts; changing colors alone does not create a distinct experience.

| Surface | Recommended interaction focus |
|---|---|
| Desktop | Operational queues, calendar, dense comparison, keyboard actions, stable work context |
| Tablet and iPad | List/detail panes, touch workflows, room/guest context |
| Phone | Tasks, room and guest context, alerts, quick actions, push-to-talk |
| Apple Watch and Wear OS | Brief status, notifications, bounded micro-actions, exact approvals where suitable, handoff to phone |

Adapt to available window size, including split-screen and foldables. Android's canonical layout guidance supports list/detail arrangements that change with window size. [Adaptive layout guidance](https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts)

Keep the existing web experience as the foundation. Evaluate a native phone/tablet client where speech, background behavior, notifications and offline operation justify it. React Native is a reasonable TypeScript-compatible candidate, but it is not a reason to rewrite the backend or assume watch support is solved. Its official platform guidance distinguishes additional partner/community platforms. [React Native platforms](https://reactnative.dev/docs/out-of-tree-platforms)

First test alternative designs on complete tasks: find arrivals and open the correct guest; resolve a room-readiness blocker; collect a payment and complete checkout. Measure completion, errors, recovery, keyboard/touch access and reduced-motion behavior. Visual polish remains valuable, but a design award is not evidence of hotel productivity.

**8. Voice needs its own feasibility and economics evaluation**

Start with push-to-talk and visible transcription. Add wake-word behavior only after proving platform support, consent, battery use and false-trigger behavior on target hardware.

Android's standard SpeechRecognizer may stream audio to remote servers and is not intended for continuous recognition. On-device availability and language support must be checked rather than assumed. [Android speech reference](https://developer.android.com/reference/android/speech/SpeechRecognizer)

Local speech is technically credible. sherpa-onnx documents local operation and Android/iOS support; whisper.cpp includes mobile bindings and speech examples. These are candidates, not measured winners for Yellow. [sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/), [whisper.cpp](https://github.com/ggml-org/whisper.cpp)

Benchmark the actual devices and languages: room numbers, names, accents, Hindi/English code-switching, intended Arabic support, noisy corridors and interrupted speech. Measure wrong-entity and wrong-action rates alongside word error rate, latency, peak memory and battery use. Check exact runtime and model/voice artifact terms separately.

A watch should usually be a thin interaction client. A generic mobile framework does not remove watch operating-system constraints. Never assume continuous listening or sensitive spoken output is appropriate everywhere.

**9. Edge operation and revenue intelligence require boundaries**

Edge software can improve cached reads, local speech and resilience. It also creates a fleet to deploy, update, monitor, replace and recover. Require a concrete latency, privacy, outage or utilization case before adding a device at every hotel.

Use stale-labelled caches for suitable reads and durable queues for explicitly eligible observations/tasks. Revalidate queued actions on synchronization. Financial commits and unrestricted inventory sales require the authoritative service, or a deliberately designed and proved capacity-lease mechanism. A disconnected device's cached availability is not permission to sell the same final room as an OTA. Yellow already documents this distinction and has an offline-capacity foundation; complete offline selling is a separate capability. [Existing architecture](https://github.com/dcpnode-maker/yellow/blob/2e55b88488300b1d4efb551f8ec79698dbb52dad/docs/ARCHITECTURE-V1.md)

Revenue intelligence should first earn trust using Yellow's own defined metrics and time-ordered backtests against simple baselines. Evaluate net contribution, uncertainty and outcomes. A language model's plausible explanation does not prove a demand forecast or optimal price. Competing offers, occupancy observations, events and flight activity are different signals with different rights, freshness and coverage. Missing data must stay visible. This is consistent with the project's voice/RMS plan, but the underlying predictive claims still need independent empirical validation.

**10. WSL storage growth should be diagnosed, not treated as one file category**

The chat raises a real operational concern, but I did not inspect the Windows host or diagnose the cause.

Separate crash dumps from virtual-disk growth, container/build caches, logs and duplicated development environments. Preserve enough crash evidence to identify the recurring cause. Microsoft documents maxCrashDumpCount, with a default of ten retained dumps and automatic removal of older dumps beyond the limit. Its count limit is useful, but it is not a total byte budget or a fix for a recurring crash. [Microsoft WSL configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)

A sensible future maintenance policy would record the responsible process, size growth, retention and a safe cleanup boundary. Deleting an active virtual disk or database is not cache cleanup. No cleanup or automated deletion was performed during this review.

**11. Recommended delivery sequence and acceptance evidence**

This sequence preserves the full product destination. It does not authorize implementation or override existing independent reviews and dependencies.

| Priority | Deliverable | Evidence of completion |
|---|---|---|
| 1 | Reconcile the real development, integrated and serving revisions | One current capability map, relevant proofs and a serving-app receipt |
| 2 | Finish a coherent operational journey | Synthetic hotel journey through reservation, room readiness, check-in, folio, payment, checkout and audit, with named remaining fiscal/provider gates |
| 3 | Establish the performance baseline | Real mobile/desktop journeys, concurrent booking bursts, query/pool/lock breakdown and cost measurements |
| 4 | Expose a small shared query/command catalogue | Same authority and result across touch, typed command and voice; ambiguity and stale-state cases tested |
| 5 | Evaluate device-appropriate design alternatives | Comparable tasks and information, accessible interaction and explicit selected layouts |
| 6 | Prove economical speech and intent routing | Representative multilingual corpus, target-device results, fallback and cost per successful task |
| 7 | Expand forecasts, automation and integrations | Time-aware evaluation, current source evidence, bounded policy and operational recovery |

The existing founder priority of phases 11 → 13 → 17 remains subject to dependencies. Avoid restarting a broad architecture exercise for every feature. Make each accepted improvement reach a usable integrated journey.

**Final judgment**

The existing core deserves preservation because it contains useful domain and integrity work, not because a particular model chose it. The chat is strongest on deterministic authority, common commands, adaptive interfaces and minimizing recurring frontier inference. It is weakest where it substitutes benchmark enthusiasm, unmeasured latency targets or “free” execution language for evidence.

Yellow's next substantial advance should be demonstrable: a complete staff journey in the current app, a smaller and more responsive client where measurements justify it, trustworthy commands available through every interface, and an operating-cost model grounded in actual use. The full hospitality scope remains intact.
