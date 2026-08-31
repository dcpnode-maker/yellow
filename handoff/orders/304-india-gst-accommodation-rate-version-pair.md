# Order 304 — India GST accommodation rate-version pair evidence

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D837
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-accommodation-rate-version-pair`
**Base:** `7010f75` (independently approved Order 303 governance head)
**Risk tier:** 3 — statutory old/new-rate pairing; fresh independent executable review mandatory

## Outcome

Add one migration-free, tenant-bound read/composition service that proves an exact
retired predecessor and active successor are the governed India hotel-accommodation
rate-version pair at Notification 15/2025's Kolkata-midnight cutover. The result is
frozen, deterministic evidence only. It does not select a historical rate for a stay,
change extension state, seed production history or implement section 14.

## Authority and exact contract

- Notification 20/2019-Central Tax (Rate), read with Notification 04/2022-Central
  Tax (Rate), is the predecessor: 12% aggregate GST with ITC through INR 7,500 and
  18% with ITC above, with no below-INR-1,000 nil band from 18 July 2022.
- Notification 15/2025-Central Tax (Rate) is the successor from Kolkata civil
  midnight on 22 September 2025, exact UTC instant
  `2025-09-21T18:30:00.000000Z`: 5% without ITC through INR 7,500 and 18% with ITC
  above.
- Official source-byte SHA-256 evidence is fixed as Notification 20/2019
  `ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901`,
  Notification 04/2022
  `c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716`, and
  Notification 15/2025
  `46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289`.
- Caller input is exact `propertyNode`, `predecessorExtensionId` and
  `successorExtensionId`; tenant truth comes only from the authenticated transaction
  and exact property.
- Both ids must be uniquely visible through the existing registry. They share exact
  owner, `tax_jurisdiction` type and `in-gst-lodging` key. The predecessor is
  `retired`, the successor `active`, and the successor is the exact next version.
- The predecessor effective period is exactly
  `[2022-07-17T18:30:00.000000Z,2025-09-21T18:30:00.000000Z)` and the successor is
  exactly `[2025-09-21T18:30:00.000000Z,infinity)`. No gap, overlap or one-microsecond
  drift is accepted.
- Both canonical contents retain the established India, tax-exclusive,
  document-rounded, transaction-value, `slab_percent`, `room_revenue` contract. The
  unique `GST_ROOM` slabs must match the exact predecessor/successor rates and ITC
  flags above; unrelated content remains hashed but is not reinterpreted.
- Output hides tenant identity, binds it inside the deterministic evidence hash,
  exposes the exact version/period/content/source evidence and statutory lower-band
  delta, and is recursively frozen.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and bounded Phase-7 plan/roadmap text;
- new `src/contexts/tax-fiscal/india-gst-accommodation-rate-version-pair.ts`;
- bounded value/type/error exports in `src/contexts/tax-fiscal/index.ts`;
- focused intentional-red and permanent hostile unit proof;
- one bounded live PostgreSQL integration proof using existing extension registry and
  effective-period projections, with zero writes after fixture setup;
- bounded contract/domain/security/QA documentation;
- fresh independent Tier-3 review evidence.

## Forbidden boundary

No migration/schema/function/grant/RLS change; no extension writer, activation,
retirement or seed conversion; no resolver change or retired historical selection;
no clock, `latest`/`max(version)` choice or caller tenant; no historical tax
calculation, split-stay allocation, section 14 six-case matrix or working-day policy;
no SEZ/decomposition, posting, fiscal document, IRP, API/UI, local promotion,
merge/deploy or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** production module/export is absent before implementation.
- **P1 exact pair:** exact retired-v1/active-v2 identity, periods, rates, ITC, source
  hashes and cutover yield one deterministic deeply frozen result.
- **P2 adjacency:** independent one-microsecond gap/overlap, UTC-midnight impostor,
  malformed/non-increasing bounds and bounded-successor mutants fail closed.
- **P3 identity/authority:** status, version, owner, tenant, id, type and key mutants,
  duplicates, invisibility and caller-shape attacks fail closed.
- **P4 statutory content:** independent threshold, rate, ITC, nil-band, upper-band,
  ordering, duplicate-`GST_ROOM` and semantic-content mutants fail closed.
- **P5 evidence:** each id, version, period, content and official-source hash changes
  the evidence hash; nested output is frozen and tenant remains hidden.
- **P6 live preservation:** real tenant/global visibility and both exact period reads
  work through existing projections; foreign tenant is concealed, current resolver
  remains active-only, and no extension/fact/outbox/financial/fiscal row changes.
- **P7 preservation:** focused/standing/static/setup/referee gates remain green.

## Definition of done

- [x] Intentional red precedes production (`ae0e926`: 0 pass / 1 fail before the
  production module existed).
- [x] Focused hostile and live zero-effect proof is green (unit/intentional 9 pass,
  live PostgreSQL 2 pass / 19 assertions).
- [x] Standing/static/setup/referee preservation gates are green (standing 1,077
  pass / 885 skip / 0 fail / 16,425 assertions; typecheck; 122-file boundary;
  23-package licence; audit 0; schema match; 59 migrations / 110 tables and
  referee 11/11).
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.

## Build evidence — D837

The exact candidate composes caller-identified retired version 1 and active version 2
through the existing tenant-visible registry and selected-period projection. Permanent
hostile proof covers identity, ownership, status, versions, content, source hashes,
microsecond adjacency, concealment, recursive freezing and evidence sensitivity. A
fresh migration-only PostgreSQL database proved both live cases and byte-equivalent
zero-effect snapshots; schema drift matched the committed snapshot. A separately
rebuilt seeded disposable database applied all 59 migrations and passed the invariant
referee 11/11. Full standing and static gates are recorded above. The exact disposable
`yellow-order304-proof` containers, network and volume were verified and removed;
the founder local was untouched. No approval or downstream authority is claimed.
