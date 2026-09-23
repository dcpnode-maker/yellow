# Order 287 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**  
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order287_review`)  
**Reviewed commit:** `4f25f8e39b8a9f0e327b954b7f0496caa5a38184`  
**Reviewed base:** `c2a8c76` (independently approved Order286 descendant)  
**Reviewed range:** `c2a8c76..4f25f8e`  
**Date:** 2026-08-29

## Independence, required reads and exact scope

I implemented none of Order287. Before inspecting or executing it I completely read
`PROJECT.md`, `AGENTS.md`, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, Order287 and the
mandatory `yellow-compliance-rules`, `yellow-entity-patterns` and
`yellow-postgres-patterns` skills, and ran `./state.sh`. I inspected D-755 through
D-757, including D-756's pure-boundary clarification, and the approved Orders283–286
source and review lineage.

The worktree was clean and `HEAD` was exactly
`4f25f8e39b8a9f0e327b954b7f0496caa5a38184` before this authorized review record.
`c2a8c76` is a strict ancestor; the exact linear range contains only Order287 admission
`854c7d3` and build `4f25f8e`. The thirteen changed paths are exactly the declared
pure composer/export, two focused tests, three product documents, scoped plan/order/
decision/ledger records and no other product surface. `git diff --check`,
`git show --check`, ancestry, name-status and scope checks passed.

## Reviewer-personal official-law audit

I checked current official primary material rather than relying on builder notes:

- The official CBIC [Integrated Goods and Services Tax Act, 2017](https://cbic-gst.gov.in/hindi/IGST-bill-e.html)
  states in section 7(3) that a service is inter-State when supplier location and
  place of supply are in two different States, two different Union territories, or
  a State and a Union territory. Section 7(5)(b) separately makes supplies **to or
  by** an SEZ developer or SEZ unit inter-State.
- The same official Act states in section 8(2) that same-State/Union-territory
  services are intra-State, while its proviso expressly excludes services to or by
  an SEZ developer or unit. It also identifies lodging accommodation in section
  12(3)(b) as located where the immovable property is located.
- CBIC [Circular 48/22/2018-GST](https://cbic-gst.gov.in/pdf/Circular_48-22-2018-GST.pdf)
  specifically confirms that section 7(5)(b) overrides the ordinary same-location
  result for short-term accommodation and related services supplied to an SEZ unit
  or developer. It separately conditions zero-rating/refund benefit on receipt for
  authorized operations and specified-officer evidence; Order287 correctly does not
  infer or expose that separate authority.
- The official GSTN-authorized IRP
  [notified e-invoice schema](https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/)
  separately models `SupTyp`, `IgstOnIntra`, item and tax values. Their absence here
  is therefore correct containment for a supply-nature evidence composer, not a
  missing derivation.

The legal precedence is exact. The ordinary registered supplier-state versus
property place-of-supply relationship applies only to affirmative regular/regular
truth. Any affirmative SEZ-unit or SEZ-developer status on either side invokes
section 7(5)(b), even when the ordinary state codes match. This order does not decide
zero rating, authorized operations, levy, decomposition, IRP supply type or invoice
treatment.

## Exhaustive 18-way result audit

I inspected and personally executed the two-relationship × three-supplier-status ×
three-recipient-status proof. `R` means affirmative regular/non-SEZ, `U` an SEZ unit
and `D` an SEZ developer. Each cell is `nature / direction / rule`.

For `same_state_or_union_territory`:

| supplier \ recipient | R | U | D |
| --- | --- | --- | --- |
| R | intra / none / 8(2) | inter / to / 7(5)(b) | inter / to / 7(5)(b) |
| U | inter / by / 7(5)(b) | inter / both / 7(5)(b) | inter / both / 7(5)(b) |
| D | inter / by / 7(5)(b) | inter / both / 7(5)(b) | inter / both / 7(5)(b) |

For `different_state_or_union_territory` the same eight SEZ cells remain section
7(5)(b); only regular/regular changes to `inter / none / 7(3)`. Thus all eighteen
cases are represented, only regular/regular reaches ordinary comparison, and unit
versus developer identity never changes the statutory direction.

## Source, lineage, hash, date and containment audit

The six-key input is exact plain, accessor-free, proxy-free and symbol-free. Every
complete Order283–286 result must be recursively frozen and have its exact fixed
shape. The composer reconstructs and rehashes the complete Order283 candidate and
Order284–286 evidence with the supplied, unexposed tenant; carried hashes are not
trusted. It cross-checks every identity duplicated across roots: property,
jurisdiction, property-derived Pos/state, supplier registration/hash, service-
location id/hash and registered-place state, plus recipient Party/registration/hash.

D-756 is accurate: reservation/folio exist only in Order283 and each status-root id
exists only in its own approved result. A pure no-database composer has no second
authority against which to compare a fully self-consistent rehashed change to those
isolated identities. The implementation neither falsely claims such an authority nor
weakens the real overlaps: it revalidates each complete source hash, rejects every
un-rehashed isolated tamper, and rejects every self-consistent cross-mix where a
sibling source supplies an independent lineage value.

Both status snapshots must exactly equal the explicit canonical `supplyDate`.
Malformed and impossible Gregorian dates, earlier/later status snapshots, status/
taxpayer/approval mismatches, invalid finite `[)` validity, unsupported forms,
inactive/non-official registration evidence and hostile nested legal-rule/source
shapes fail closed. There is no clock, prior/latest/nearest selection, recipient-
state or GSTIN/address/name/config fallback.

The candidate key order, minimized supplier/recipient/status lineage,
`candidateJson`, tenant-bound SHA-256, recursive freeze and byte-identical replay are
exact. Caller and approved-source bytes stay unchanged. Direct inspection and static
scans found no transaction, SQL/database, lock, read/write, migration, fact/outbox,
journal/posting, tax-detail, document/submission, dependency, network, HTTP/UI,
`SupTyp`, `IgstOnIntra`, zero-rating, authorized-operations, levy, decomposition,
rate, amount, rounding, item or payment/refund authority.

## Reviewer-personal executable proof

I did not reuse builder output. At exact `4f25f8e` I personally executed:

- `bun test tests/india-gst-accommodation-supply-nature.intentional-red.test.ts
  tests/india-gst-accommodation-supply-nature.test.ts` → **12 passed / 0 failed /
  398 expectations**. This includes all eighteen statutory combinations, hostile
  dates/shapes/hashes/lineage, exact bytes/freeze/replay and zero-effect/static
  containment.
- `bun test` on the exact Order283–286 adjacent suites → **36 passed / 30 expected
  database-environment skips / 0 failed / 4,753 expectations**.
- standing `bun test` → **957 passed / 861 environment skips / 0 failed / 14,668
  expectations; 1,818 tests across 318 files**.
- `bun run typecheck` → exit 0; `bun run boundaries` → **110 TypeScript files**, pass;
  `bun run license-check` → **23 installed packages**, pass; `bun audit` → **no
  vulnerabilities**; `git diff --check`, `git show --check`, direct forbidden-source
  scans and clean-tree checks → pass.

Order287 has no database proof lane because it is deliberately pure and no database
artifact changed. I verified byte identity from approved base `c2a8c76` through the
candidate for `migrations/`, `tests/schema/expected.sql`, `setup.sh`,
`tests/run_invariants.py`, database-acceptance/runtime-DML tests, `package.json`,
`bun.lock` and `docker-compose.yml`; the migration tree object and migration0053
SHA-256 remain exact. The independently approved Order286 base evidence therefore
remains exactly **53 migrations / 105 public tables / 95 RLS-enabled tenant tables /
95 tenant-isolation policies / 5 FORCE-RLS tables / normalized schema match /
referee 11 passed, 0 failed of 11**. No claim relies on a changed or newly executed
schema.

## Stable-local preservation and bounded approval

I performed only read-only stable-runtime inspection. Before recording this verdict,
the retained services were unchanged and healthy at restart count zero:

| Stable service | Exact container id | Start timestamp | Restarts | Health |
| --- | --- | --- | ---: | --- |
| app | `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf` | `2026-08-29T06:37:36.392830169Z` | 0 | healthy |
| PostgreSQL | `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12` | `2026-08-29T02:59:30.103272572Z` | 0 | healthy |
| Valkey | `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa` | `2026-08-29T02:59:30.442755852Z` | 0 | healthy |

Port `3000` remained bound only to the exact app container and `/health` remained
HTTP 200 with `{"status":"ok"}`. I did not query or mutate the stable database, start
review services, restart, replace, promote, merge, deploy or push anything.

No product, statutory-mapping, lineage, date, hash, deterministic-shape,
zero-effect, scope or executable-proof finding remains. Approval is limited to the
exact pure accommodation supply-nature evidence at `4f25f8e`. It grants no Form-F2,
authorized-operations/zero-rating/refund, levy/exemption/reverse-charge, `SupTyp`,
`IgstOnIntra`, tax decomposition/rate/amount, item, posting/correction,
invoice/document/number/hash-chain, provider/submission, API/HTTP/UI, local
promotion, merge, deployment, Phase-7 completion or application-complete authority.
Apart from this review record, I changed no repository file.
