# Order 092 — OTA research evidence and integration-archetype contract

**Phase:** 4 · Cross-cutting future-Distribution foundation while the Order-087 privilege/security floor remains open
**Branch:** `phase-4/ota-research-evidence-contract`
**Base:** `phase-4/rms-economic-metric-contract` at `aa07830`
**Tier:** 3 — canonical external-evidence and capability-claim semantics
**Written by:** OpenAI Codex, founder-authorized temporary architect/builder under D-95/D-115/D-221

## Outcome

Give the future adaptive RMS, agent retrieval and Distribution context one strict executable language
for public OTA research evidence without turning any research record into tenant contract truth,
current adapter capability or live execution authority.

The contract distinguishes `push_ari`, `pull_quote_plus_change_notice`, `metasearch_feed`,
`buyer_distribution`, `channel_manager`, `extranet`, `reseller_distribution`, `lead_marketplace`,
`none` and `unknown`. There is deliberately no generic OTA adapter. Source, evidence state,
applicability, effective/review instants, documented access, authorization, rights, unknowns and
verified fallbacks remain explicit, bounded and canonically serializable.

This is a pure normalizer and evidence projection in the existing Distribution bounded context. It
does not import the external 31-record research package, persist knowledge, decide that a claim is
true, authorize an adapter, read tenant contracts, expose credentials, calculate money, recommend a
rate or publish anything.

## Natural-Solution Test

- Distribution is one of PROJECT.md's fixed 13 contexts and already has an empty public surface.
  OTA connectivity research belongs there rather than in Rates, Kernel or an invented 14th context.
- Order 090 retained the governed RAG/tool boundary and Order 091 fixed room-economics arithmetic,
  but neither defines which kind of external evidence may describe a channel surface.
- The external KB v0.2 is useful research input, not repo authority. Its schema v0.1 omits the
  required `lead_marketplace` archetype and consequently labels Furnished Finder as
  `reseller_distribution`; this contract fixes that product taxonomy without rewriting the external
  workspace or importing its claims.
- The external model library's `gross_room_value` includes mandatory fees whereas Order 091 defines
  gross booked room revenue. That mapping remains a later canonical channel-economics order; Order
  092 carries no money.

## Scope

- `handoff/orders/092-ota-research-evidence-contract.md`
- `src/contexts/distribution/knowledge.ts`
- `src/contexts/distribution/index.ts`
- `tests/ota-knowledge-record.test.ts`
- `docs/OTA-KNOWLEDGE-CONTRACT.md`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/GATE-3-MANIFEST.md` only after every proof is green
- `handoff/LEDGER.md`
- `DECISIONS.log` only after every proof is green

## Required work

1. Commit this order and an intentional-red focused proof importing the absent Distribution exports
   before production code.
2. Accept only one strict, bounded version-1 input shape containing:
   - stable record identity, channel group/brand/role, topic and atomic claim;
   - evidence state and exactly one source with type, title, HTTPS URL and retrieval instant;
   - observation, nullable effective interval and review-due instants;
   - integer confidence basis points from 0 through 10,000;
   - applicability scope plus bounded region, property-type and shopper-context-key sets;
   - documented access class, exact integration archetype, authorization class, documented
     read/write booleans, certification flag, nullable interface version, exact granularity,
     constraints and fallbacks;
   - bounded explicit unknowns; and
   - permitted research uses plus explicit personal/contract-data flags.
3. Normalize every set-like string array by strict validation, uniqueness and lexical sorting. Reject
   all missing/unknown fields, invalid enum/string/count/date/URL values, URL credentials/fragments,
   control characters, duplicates, reversed effective/review intervals or mutation of the source.
4. Enforce source/archetype semantics at the boundary:
   - `verified` uses an official primary source; `observed` uses an authorized connector or public
     journey; `inferred` cannot claim documented writes;
   - public journeys/connectors never claim `supplier_api_write`;
   - `push_ari` requires verified official API evidence, supplier-write access, non-public
     authorization and an interface version;
   - `buyer_distribution` is read/book access, not supplier write;
   - `lead_marketplace` is partner-manual/lead evidence and cannot claim booking/ARI writes;
   - `none` cannot claim documented writes; and
   - contract or personal data is rejected from this shared public-research contract.
5. Return a recursively frozen normalized snapshot whose constant authority envelope states:
   `researchOnly=true`, `liveExecutionAuthority=false`, `tenantContractAuthority=false`, and
   `adapterCapabilityAuthority=false`.
6. Provide a deterministic canonical JSON projection. Equivalent unordered input sets produce
   byte-identical output; material claim/source/archetype changes do not.
7. Document the research/contract/adapter/property authority planes, the external v0.2 package as
   unimported input, the two known taxonomy/money-basis conflicts, exact future registry preflight,
   and why unsupported custom-model output must retain intent through verified fallback rather than
   silent semantic degradation.
8. Run focused/default proofs, typecheck, boundaries, licence/audit, exact schema, isolated Phase-3
   gate, protected hashes and fresh app-never-started `./setup.sh --db-only` at 11/11. Record Order
   092 as UNVERIFIED debt, refresh Graphify, rebuild only the founder app, open a stacked draft PR
   and require green replacement final-tip CI. Do not merge.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, CI, package or
  lock files; any table/column/extension, fact, event, state, route, worker, cache, permission,
  RLS/tenant, occupancy, reservation, journal, fiscal, tax, rate-price or authentication change
- Copying the external OTA/RMS workspace or its 31 records into the repository; representing its
  current claims, URLs, public percentages or product names as independently verified by Order 092
- A database/vector store, embedding, scraper, crawler, network request, secret, connector session,
  OTA/PMS credential, tenant contract, guest PII, cross-tenant data or model training
- A generic OTA adapter; treating a buyer API, public shopper feature, research connector, partner
  manual or marketplace observation as certified supplier-write authority
- Channel enrolment, paid programme/financial commitment, promotion, rate/inventory/restriction
  mutation, Distribution outbox/push cursor, reconciliation or any live external action
- Channel economics, guest total, mandatory-fee/tax classification, commission calculation, model,
  forecast, causality, bid price, recommendation, approval or automatic decision
- AI/model authority, fabricated review/approval, self-merge or advancing independent review beyond
  Order 044

## Pre-registered proof

### P0 — intentional red

Import `normalizeOtaKnowledgeRecord`, `canonicalOtaKnowledgeJson`, `OTA_INTEGRATION_PATTERNS`,
`OTA_RESEARCH_AUTHORITY` and `OtaKnowledgeError` from the Distribution public surface. Before
production code, the focused test must fail because those exports do not exist.

### P1 — strict canonical public research evidence

Normalize one verified, certification-gated Booking-style `push_ari` research record. Prove every
field, lexical set order, canonical source instant, integration version and the constant four-false/
research-only authority envelope. Recursively freeze the result and preserve the input byte-for-byte.

### P2 — no generic adapter and no authority escalation

Prove the exact integration-archetype catalogue contains `lead_marketplace` and no generic adapter.
Normalize lead-marketplace, buyer-distribution and metasearch examples. Reject supplier-write claims
from public/connector evidence, buyer/lead surfaces, public authorization, inferred evidence and
unversioned push ARI.

### P3 — hostile input fails closed

Reject missing/unknown nested fields, enum/string/count/date/URL violations, URL credentials or
fragments, duplicate set values, interval reversal, PII/contract flags and every bounded-array or
control-character escape. Rejected input yields no partial mutable result.

### P4 — deterministic transport evidence

Equivalent records with differently ordered set fields serialize byte-identically; a material claim,
source or archetype change serializes differently. JSON output includes source/applicability/unknowns
and the non-authority envelope, contains no secret or executable field, and is recursively frozen.

### P5 — standing evidence

The complete existing suite, exact schema, isolated Phase-3 gate, protected hashes and fresh referee
remain green. Graphify stays derived and the localhost app changes only its honest order/debt status.

## Definition of done

- [x] P0 is committed red before production code.
- [x] P1-P4 are green with strict bounded research-only semantics.
- [x] The external taxonomy/money-basis conflicts and future authority planes are explicit.
- [x] P5 and both protected hashes remain exact.
- [x] Order 092 is recorded as UNVERIFIED review debt; no approval or merge is claimed.

## Builder evidence — UNVERIFIED

- Intentional red commit `93402dd`: 0 pass, 1 fail and 1 import error because the Distribution
  research-contract exports did not exist.
- Implementation `0ea6832`: P1-P4 pass 4/4 with 57 assertions. Manual review replaced
  locale-sensitive set ordering with explicit code-point ordering and added claim, source and
  archetype discrimination proofs before commit.
- Fresh exact implementation tip `0ea68322822cb3a48028e77a4cf27486682832b3`: native Linux
  standing suite 121 pass / 0 fail / 326 database skips / 1,585 assertions; typecheck, 59-file
  import boundaries, licence policy and `bun audit` are green.
- Windows full-suite and Phase-3 attempts retained the inherited Bun glob NUL-path defect in the
  founder manifest assertion. No assertion was weakened: a fresh native-Linux checkout passed that
  manifest proof and the complete 13-suite Phase-3 gate from the top.
- Fresh Compose project `yellow-order-092-proof`, with the app never started: exact schema,
  deployment acceptance 4/4, native isolated Phase-3 gate 13/13 suites and referee 11/11. The first
  setup attempt used the wrong PostgreSQL-port environment variable and started no database; its
  exact disposable project was removed, the port precondition corrected and the complete database
  sequence restarted.
- Protected SHA-256 hashes remain exact: `migrations/0001_init.sql`
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
  `tests/run_invariants.py` `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Disposable Graphify code map: 2,314 nodes, 6,602 directed endpoint pairs and 104 communities.
  It reports no missing endpoints or self-loops, but 108 dangling edges and 909 same-endpoint
  collapses; 413 semantic documents and eight SQL files are deliberately absent. It is incomplete
  navigation evidence, not architecture or correctness authority, and is not committed.
- This is builder evidence only. Independent review remains through Order 044; no merge is claimed.
