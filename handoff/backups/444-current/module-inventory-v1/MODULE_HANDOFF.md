# Yellow backend module inventory — 2026-10-01

Input source: **444072ffdff2b7745345d88f71b603c17e11ace6**, tree
`2fd5f9b5f55cc3404d81c88385f90c8c17582223`, clean detached
`/workspace/yellow-candidate-444`. Product source is unchanged from reviewed
`b9ba702a074a487feeafa056abb49abcdcf01ba8`; successors corrected tests.
This inventory does not cover the laptop's newer restored 734/737 UI or dirty
source. Laptop remains controller, integration point and public hosting owner.
No CompSet work, cloud tunnel probes, product edits or database writes occurred.

## Completion findings

| Module | Actual implemented scope | Completion boundary |
| --- | --- | --- |
| CRM / operational tasks | Existing parties, housekeeping, arrival pickup and departure service commands. Cloud fixes prioritize unfinished departure requests and permit a department-role queue filter. Linked reservation groups are present. | Two bounded cloud queue fixes accepted; whole CRM is partial. Sales enquiry → evidence-bound group price/displacement → RM decision → explicit higher-role escalation is **not implemented in this input**. |
| CRS | Staff search across 1–4 explicitly authorized properties, canonical physical-unit offers/evidence; existing hold, release, commit and reservation operations. | Staff search slice accepted. No claim of a complete central reservation/distribution system. Four properties is a request budget. |
| RMS / rates | Ten typed model families, evaluators, composition, exact-money economics, authoritative quotes, immutable rate releases, approval/simulation/publish/undo and recommendation adapter contract/fallback. | Functional rate foundation, not a completed forecasting/optimization system. Default server binds no live recommendation adapter. Group whole-stay forecasting, historical-KPI-safe interactive waterfall/equalizer and commercial escalation remain unbuilt here. |
| Booking engine | Existing **staff** offer → temporary hold → authoritative commit journey and reusable reservation services. | No mounted public guest quote/hold/reserve journey found in this input. Hosted-deposit guest pages are payment pages, not a booking engine. |

## Exact source and HTTP contracts

All property paths below use `P = /api/v1/properties/:property`. All staff routes
use the existing operator tenant transaction boundary, token identity and current
property grants; they do not create a separate task, inventory or money store.

### CRM / tasks and group enquiries

- `src/contexts/crm/parties.ts`: governed party search/create/update;
  `POST P/parties:search`, plus existing guest profile commands. Party search uses
  `crm.parties:read`; writes use `crm.parties:write`. Parties alone are not CRM task distribution.
- `src/contexts/stay-operations/departure-service-coordination.ts` and
  `src/http/departure-services-query.ts`, mounted at `src/app.ts:679`:
  `GET P/departure-services?target_role_id=<UUID>`;
  `GET P/reservations/:reservation/departure-services`;
  `POST P/reservations/:reservation/departure-services/proposals`;
  `POST P/departure-services/:serviceRequest/:action` and reservation-specific actions.
  Read permission: `stay-operations.departure-services:read`.
  Commands map to `:request`, `:escalate`, `:confirm`, `:dispatch`, `:work`,
  with an idempotency key, actor/property authorization and canonical state transition.
  Active open/assigned/in-progress work precedes completed history under the
  100-row bound. Role filtering occurs before LIMIT; it is routing metadata,
  not a personally owned inbox or a new staff permission.
- `src/contexts/stay-operations/pickup-task-dispatch.ts` and
  `pickup-task-automation.ts`, `src/app.ts:629`: task detail plus
  `POST P/reservations/:reservation/arrival-pickup-task/:task/{assign,start,complete}`.
  Permissions: `stay-operations.pickup-tasks:dispatch/work`.
- `src/contexts/housekeeping/tasks.ts`, `src/app.ts:722`: task list/detail,
  `POST P/housekeeping/tasks/:task/transition`, sheet generation and conditions.
  Permissions include `housekeeping.tasks:read/work/inspect` and
  `housekeeping.sheets:read/generate`. Lifecycle is assigned → in_progress →
  done → verified; cleaning progress does not grant inspection authority.
- `src/contexts/reservations/groups.ts`, `src/app.ts:603`,
  `src/http/operator.ts:5554`: `GET/POST P/groups`, detail, candidate lookup,
  `PUT P/groups/:groupId/members/:reservationId`. Reads use
  `reservations.lifecycle:read`; creation/linking use `reservations.lifecycle:write`,
  property grants, strict body and idempotency. Migration 0101 is the accepted
  linked-group prerequisite. These are reservation associations, **not**
  group commercial approvals. Departure-service escalation and rate-publication
  approval are also distinct from the requested sales/RM workflow.

Accepted cloud source inputs: queue
`40eb866a7f51645ee3de84806dbd1a8e17ca8a56`, role filter
`3f4dd3afba1287d1f382fbcbe0a639a5d0e774ae`.
Neither establishes unified shift views, SLA/delegation settings, guest request
routing or the requested versioned group quotation/approval timeline.

### CRS / reservation operations

- `src/http/crs-search.ts`, route `src/app.ts:490`:
  `POST /api/v1/crs/availability:search`.
  Required permission `inventory.availability:read`; all explicit property IDs
  must be granted before any evaluation. Strict 1–4 distinct-property envelope,
  bounded body/response, serial evaluation in one tenant transaction, full
  canonical offer evidence preserved, whole-batch failure instead of partial data.
- `src/contexts/reservations/offers.ts`, `src/app.ts:487`:
  `POST P/availability:search`, governed rates, policy and actual physical inventory.
- `src/contexts/inventory/holds.ts` and `src/contexts/reservations/commit.ts`:
  `GET/POST P/holds`, `POST P/holds/:holdId/release`,
  `POST /api/v1/reservations:commit` (`src/app.ts:573–582`).
  Holds use `inventory.holds:read/write`; commit uses `reservations.booking:write`.
  Lifecycle read/update/cancel/reinstate/segment change/room move routes also exist
  in `src/app.ts`; they retain their existing distinct permissions and commands.
- Server composition: `src/server.ts:282–285` wires RateQuoteService and
  ReservationOfferSearchService. No inventory mutation was added by CRS search.

Accepted cloud inputs: CRS
`fbc5f00b961fd202bb95bc70b450486fc8d0dd25`, physical-offer correction
`224e01addb57eca5163902013ae91077e77eeef5`.
Source/channel configuration is not proof of an authenticated live OTA pipeline.

### RMS / rates and explanations

- `src/contexts/rates/models.ts`: simple-fixed, calendar, bar-ladder, derived,
  room-matrix, occupancy-los, contract-negotiated, package, rms-api-managed,
  expert-composition; guided/expert/AI authoring. Actual typed evaluation is in
  `evaluators.ts`, composition in `composition.ts`, exact-money calculations in
  `economics.ts`, authoritative tax/availability evidence in `quote.ts`.
- `src/contexts/rates/publication.ts`: versioned release creation, simulation,
  approval request/decision, publish and undo. Published evidence is not an
  unrestricted override. AI intent proposals do not approve/publish themselves.
- `src/app.ts:508–555`: rate configuration and prices; below
  `P/rate-builder/:ratePlanId`: `GET` builder, `GET /approvals`,
  `POST /approvals/:approvalId/decision`, `POST /releases`,
  `POST /intents:interpret`, `POST /quotes:resolve`, and
  `POST /releases/:releaseId/{simulate,approval-request,publish,undo}`.
  Read/write scopes are `rates.configuration:read/write`; price-cell operations
  use `rates.pricing:read/write`. Live property grants and domain approval rules
  still apply. There is no separate group-RM authority inferred from these scopes.
- `recommendations.ts` validates exact tenant/property/release/unit/date/currency,
  adapter identity, timeliness and evidence. `publication.ts:844–855` defaults to
  an empty RateRecommendationRegistry; `server.ts:271` supplies no registry.
  `rms-api-managed` can therefore fall back to the local evaluator; its presence
  is not proof of a working external RMS provider.
- Economics requires attributable caller inputs. A displacement calculation
  helper is not a forecast acquisition pipeline or whole-stay group approval engine.
  Saved market-batch studies/adapters do not prove live connectivity or uplift.

### Booking engine / guest quotes and reservation

- Staff core: `offers.ts`, inventory holds, `commit.ts`, `state-machine.ts`,
  `src/http/operator.ts`, `src/http/operator/` booking workbench and above routes.
- Guest surface: `src/http/guest/guest.js:20` calls only
  `/api/public/hosted-deposits/:bearer` and
  `/api/public/hosted-deposit-returns/:correlation`; `src/app.ts:839` mounts these
  payment reads and `/pay/` pages. No public quote/hold/reserve route was found
  in the mounted app. Staff permissions must not be reused as public guest auth.
- Missing integration slice: a properly constrained guest quote → hold → commit
  surface reusing canonical services, with exact property/channel authorization,
  bounded input, authoritative quote evidence, expiry/idempotency/concurrency
  proofs and independent authorization review. This is an implementation gap
  report, not permission to duplicate the laptop UI, allocate migrations or
  bypass guest authorization. Controller should issue a finite disjoint order.

## Executed evidence and limits

**Fresh on exact 444 input, Bun 1.3.14:**

| Batch | Result | Proof files |
| --- | --- | --- |
| CRM/CRS helper, mounted HTTP, strict departure contract/permissions | 41 pass, 0 fail, 225 assertions | `crm-crs-with-matching-deps.log` |
| Rate evaluators/composition/reuse/economics/authoring/intent/provider | 53 pass, 0 fail, 571 assertions | `rms.log` |
| Existing staff booking source/JS-state contracts | 4 pass, 0 fail, 28 assertions | `staff-booking.log` |

Total **98 pass / 0 fail / 824 assertions**, no skipped tests in successful
batches. These are pure/mocked HTTP/source tests; they are not a fresh native-PG,
browser, public guest booking or full-app acceptance run. Exact commands, input
hashes and exit codes are in `FOCUSED_TEST_PROOF.json`.

Initial CRM/CRS attempt failed because this detached checkout lacked Elysia.
That failed log is retained (`crm-crs.log`: 23 pass, 3 import errors). Retest used
the existing b9 dependency directory with exactly matching lock SHA256
`5718ec41f5e14e35ce2ff4f6947e17a999545cfa46b1437271fb568ce28fb282`;
temporary symlink was removed and Git status stayed clean. No install, network
provider call, live DB fixture or source correction was needed.

**Retained native-PG independent proof, not newly executed on 444:**
`handoff/reviews/INTEGRATION-20260930-reviewed-yellow-composition.md:126`
records the non-implementer's personal execution: CRM initial queue 1/0/33,
role queue 1/0/40, CRS 6/0/66, physical offers 1/0/69;
signed authorization, revocation, tenant-local transactions, all-property
authorization before evaluation, read fingerprints and unsafe-runtime guards.
These prove the accepted bounded inputs, not complete CRM/RMS/guest booking.

**Private origin:** fresh read-only `/health` 200, `/ready` 200 and mounted
`/api/v1/me/properties` 401 at `127.0.0.1:53018`.
`PRIVATE_ORIGIN_READ.json` preserves response hashes. The initial
`/api/v1/properties` 404 is an unmounted path, not an authorization proof.
Retained launch proof pins image
`sha256:265557572fb06f6699b85fd2732ebcacd12bc5e9299feacbe5ece2f0883dafce`
and source 444; worker startup, interactive login, production data recovery and
public URL are not asserted. The app is synthetic/private and remains preserved.

## Controller handoff and phase honesty

The cloud worker did **not** finish whole CRM, RMS, CRS or the public booking
engine. It returned independently accepted finite CRM queue/CRS search changes;
other existing foundation code is identified above. Laptop owns the original
734/737 ribbon/module restoration, final source admission and stable public link.
No cloud ngrok probes or public deployment are part of this inventory.

`docs/PROJECT-STATUS.md` retains stale serving/frontier prose. Actual input has
103 immutable migrations; current receipt evidence must take precedence over old
serving descriptions. Its phase classification remains 0–3/5/6 reviewed,
4 integration review outstanding, 7 partial and 8–17 planned. This audit does
not independently re-certify old phases or claim all 18 complete.

Next controller decisions are the exact guest booking API/auth slice and the
sales-group commercial approval slice. New source handoff is needed before
either to avoid duplicating local-only modules. No credentials, emergency
credits, additional DB authority or schema changes are requested by this packet.
