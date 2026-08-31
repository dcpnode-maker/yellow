# Order 306 — India GST accommodation historical resolution

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D843
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-accommodation-historical-resolution`
**Base:** `1fca2ce` (independently approved Order 305 governance head)
**Risk tier:** 3 — statutory historical rate identity and applicability evidence;
fresh independent executable review mandatory

## Outcome

Resolve the exact governed India lodging extension version applicable to one active
same-tenant property and one canonical property-local business date. PostgreSQL owns
the property's timezone and local-day interval; the service uses the exact approved
retired-v1/active-v2 launch history and returns frozen, tenant-hidden historical
resolution evidence. It never chooses by clock, latest version, maximum version or
caller-supplied extension identity.

## Exact contract

- Public input is exactly `{ propertyNode, businessDate }`; tenant, timezone,
  instant, extension ids, versions and status are never caller authority.
- In one tenant transaction, prove the active property, derive its exact PostgreSQL
  local-midnight-to-next-local-calendar-midnight UTC envelope, and require exactly
  one applicable `tax_assignment` for key `in-gst-lodging`.
- Read the two tenant-visible canonical Order305 history members and revalidate the
  complete Order304 pair: deterministic ids, owners, type/key, v1-retired/v2-active,
  adjacent Kolkata-midnight periods, exact content, rates, thresholds, ITC flags and
  official-source hashes.
- Select exactly one pair member whose effective period contains the complete
  property-local day. Equality at bounds is valid; both, neither, a gap, overlap or a
  day crossing the cutover fails closed. DST 23/25-hour days and awkward offsets use
  database-derived bounds, never fixed-24-hour or JavaScript date arithmetic.
- Return recursively frozen property/day, assignment, selected-extension and pair
  evidence with a deterministic evidence hash. No tenant identifier escapes.
- Preserve the existing active-only current resolver unchanged; it continues to
  select active v2 for current dates.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and bounded Phase-7 plan/roadmap;
- one new bounded historical-resolution service under `src/contexts/tax-fiscal/` and
  exact exports from that context index;
- intentional-red, permanent hostile/unit and live PostgreSQL zero-effect proof;
- bounded `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md` and
  `tests/PMS_QA_Test_Suite.md` documentation;
- fresh independent Tier-3 review evidence.

## Forbidden boundary

No migration/schema/grant/RLS/seed change; no installed-database conversion or
repair; no extension writer/lifecycle mutation; no current active-only resolver
change; no split-day allocation, section14/calendar, tax calculation, GST
decomposition, posting, fiscal document, IRP, API/UI, local promotion, merge/deploy
or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** the historical resolver/export does not exist before production.
- **P1 exact historical choice:** whole local days before the cutover select v1 and
  whole local days at/after it select v2; exact equality and microsecond edges are
  executable.
- **P2 fail closed:** missing/overlapping assignment, missing/duplicate/invisible or
  altered history, wrong status/version/key/content/source evidence, gap/overlap and
  cross-cutover days reject without partial output.
- **P3 database authority:** live tenant/property concealment, DST and awkward-offset
  bounds use transaction-local PostgreSQL truth and repeated reads have exact zero
  effects across extension, assignment, audit, outbox, finance and fiscal roots.
- **P4 evidence sensitivity:** independent changes to selected identity, version,
  content, each period bound and source evidence change or invalidate the hash;
  output is recursively frozen and tenant-hidden.
- **P5 preservation:** current active-only v2 resolution, schema, fresh setup,
  referee, standing and static gates remain green.

## Definition of done

- [x] Intentional red precedes production (`639913c`: 0 pass / 1 fail before the
  historical-resolution service existed).
- [x] Focused hostile and live PostgreSQL proofs are green (focused 26 pass / 9
  expected skips / 535 assertions; live 3 pass / 0 fail / 30 assertions).
- [x] Standing/static/setup/schema/referee preservation gates are green (standing
  1,088 pass / 890 skip / 0 fail / 16,652 assertions; typecheck; 123-file boundary;
  23-package licence; audit 0; exact schema; 59 migrations / 110 tables and referee
  11/11).
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Build evidence — D843

The bounded resolver accepts only property plus canonical business date, derives the
same-transaction PostgreSQL local-day envelope and exact lodging assignment, then
revalidates the canonical deterministic pair internally before selecting the sole
whole-day-containing member. Permanent proof rejects hostile input, foreign or
inactive property, missing/ambiguous assignment, altered identity/status/version/
period/content/source evidence, gaps, overlaps, microsecond truncation and a local day
crossing the Kolkata cutover. It proves v1/v2 equality edges, DST 23/25-hour and
awkward-offset envelopes, recursive freezing, tenant concealment, evidence-hash
sensitivity, zero writes and preservation of current active-only v2 resolution.
Direct disposable PostgreSQL proof is 3/0(30); fresh preservation is 59 migrations,
110 tables, exact schema and referee11/11. Full standing and static results are
recorded above. Temporary proof databases were dropped; the daemon-hung inherited
Order305 container remains unchanged and the founder local was untouched.
