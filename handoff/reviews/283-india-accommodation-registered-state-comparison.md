# Order 283 — Independent Tier-3 review

**Verdict:** **CHANGES REQUIRED — one governance-proof finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order283_tier3_review`)
**Reviewed commit:** `1cea37f5230685775932a48bbdaeee9adcaf9712`
**Reviewed base:** `b257949be4f779a2c889181e7b2c70533cff2840`
**Reviewed range:** `b257949be4f779a2c889181e7b2c70533cff2840..1cea37f5230685775932a48bbdaeee9adcaf9712`
**Date:** 2026-08-29

## Independence, constitution and exact scope

I implemented none of Order283. Before review I read `PROJECT.md`, `AGENTS.md`, ran
`./state.sh`, and completely read the mandatory compliance, entity and PostgreSQL
skills, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, the current Phase-7 material,
Order282, Order283 and D-741/D-742. I also read the relevant architecture, contract,
domain and security records before inspecting or executing the candidate.

The worktree was clean at exact candidate
`1cea37f5230685775932a48bbdaeee9adcaf9712`. The exact base is an ancestor and the
range contains only the declared thirteen paths: the pure value module, one bounded-
context export, focused/current-canary tests, documentation and governance records.
There is no migration, table, seed, role, grant, dependency, credential, HTTP route,
application composition, provider, runtime-promotion or deployment file in the range.
`git diff --check`, `git show --check`, ancestry, name-status, scope and clean-tree
checks passed.

Reviewer file SHA-256 identities were:

- product source: `CF54B52BCCF7EC59754B014D5E24E61F5B43E79887C8A70DD889DDA56E4B1507`;
- exhaustive/hostile test: `0B516AA88713CC5F8CF1CF819C82A7B3C7F03D674B112028234056CF879BC726`;
- intentional-current canary: `A059650DDAFC8D7DAC1B66E1EC3EC4FECDEBBF993A73AAF912370A47FABA4A8F`.

## Reviewer-personal primary-source audit

I personally audited these primary official sources:

- CBIC's published [Integrated Goods and Services Tax Act](https://cbic-gst.gov.in/hindi/IGST-bill-e.html):
  section 2(15) defines location of the supplier of services by the supplying place of
  business, fixed establishment, establishment most directly concerned, or usual
  residence; section 7(3) treats services as inter-State when that legally determined
  supplier location and place of supply are in different State/UTs; section 8(2)
  treats the same-State/UT case as intra-State subject to section 12, but expressly
  excludes supplies to or by an SEZ developer/unit; section 7(5)(b) affirmatively
  treats supplies to or by an SEZ developer/unit as inter-State; and section 12(3)(b)
  places hotel lodging at the immovable property.
- CBIC [Circular 48/22/2018-GST](https://cbic-gst.gov.in/pdf/Circular_48-22-2018-GST.pdf):
  the specific SEZ provision prevails, so short-term accommodation supplied to an SEZ
  developer/unit is inter-State even where the ordinary supplier-location/place-of-
  supply comparison would be same-State/UT.
- Official Notification 60/2020's substituted
  [FORM GST INV-01 / schema version 1.1](https://gstcouncil.gov.in/sites/default/files/2024-05/notfctn-60-central-tax-hindi-2020.pdf)
  and the GSTN-authorized IRIS IRP
  [Notified E-invoice Schema](https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/):
  supplier state, mandatory `Pos`, recipient state, `SupTyp`, and the separate
  same-State IGST exception field (`IgstOnIntra` in IRP JSON) are distinct schema
  concepts. The notified supply-type enumeration separately includes SEZ variants.

These sources confirm that comparing a registration state's two-digit code with
property-derived `Pos` can only be evidence. It cannot determine intra/inter-State
nature without a lawful supplier-location/establishment selection and the applicable
SEZ/other exception truth. Recipient state is not the comparison operand under
sections 7(3)/8(2).

## Source, lineage and containment audit

The product function accepts exactly the plain, accessor/proxy/symbol-free three-key
input `{tenantId,supplier,placeOfSupply}`. The complete Order272 supplier and Order282
place-of-supply sources and every nested object must be exact and frozen. Null, array,
prototype, proxy, accessor, symbol, missing, surplus and thawed shapes fail closed.

The function independently recomputes the complete Order272 supplier evidence hash
and the exact Order282 fixed-order candidate JSON and tenant-bound candidate hash.
Supplier property, registration id/hash and complete jurisdiction identity must equal
the Order282 lineage. Tenant remains outside the returned value but is included in
both source and result hash verification. Cross-mixed tenant/property/reservation/
folio/Party/registration/classification/jurisdiction/hash evidence rejects without
mutation.

The fixed-order result contains only property/reservation/folio, frozen jurisdiction,
supplier registration/hash/state, recipient lineage, buyer hashes, classification
lineage, place-of-supply hash/rule/`pos`, comparison rule, and one of the two exact
relationship literals. Every nested value is frozen; replay and rejection preserve
caller bytes. The only comparison expression is `supplier.stateCode ===
placeOfSupply.pos`. Recipient state is neither exposed as an operand nor read through
a fallback.

Manual and executable scans confirm no `Tx`, kernel/database import, SQL, DML, lock,
service resolver, fact, outbox/event, journal, posting, document, submission,
idempotency, network or runtime authority. The source contains no intra/inter-State,
CGST/SGST/UTGST/IGST decomposition, `SupTyp`, `IgstOnIntra`, reverse-charge,
`ItemList`, item-value or document field. Product source and product-facing documents
correctly describe the same/different result as evidence only and retain the
supplier-location and SEZ exclusions.

## Reviewer-personal executable proof

I did not reuse builder results. I created fresh Compose project
`yellow-review283-tier3-reviewer` on unused host port `5593` with only the pinned
PostgreSQL 16.15 service (`docker compose -p ... up -d --no-deps postgres`). I did
not create a second app or Valkey. I provisioned fresh disposable authority roles and
separate seeded deployment, invariant-fixture and migration-admin databases, then
personally executed:

- Order283 current canary plus exhaustive/hostile/real composition:
  **12 passed, 0 failed, 4,187 expectations**;
- Order272/279/280/281 adjacent approved roots: **50/0, 551 expectations**;
- Order282 place-of-supply: **12/0, 353 expectations**;
- Order275 SellerDtls: **9/0, 111 expectations**;
- Order256 positive-tax folio eligibility: **7/0, 48 expectations**;
- database acceptance against the separately seeded canonical deployment database:
  **15/0, 42 expectations**;
- runtime-DML authority: **5/0, 109 expectations**;
- full migration replay on disposable child databases: **39/0, 186 expectations**;
- fresh catalogue: **50 migrations / 102 public tables / 92 RLS-enabled tenant
  tables / 92 policies**; normalized schema exact; referee **11 passed, 0 failed of
  11**;
- standing `bun test`: **916 passed, 831 database/environment skips, 0 failed,
  13,655 expectations; 1,747 tests across 310 files**;
- `bun run typecheck`: exit 0; import boundaries: **106 TypeScript files**, pass;
  dependency policy: **23 packages**, pass; `bun audit`: no vulnerabilities;
  diff/scope/ancestry/static gates: pass.

The exhaustive matrix produced exactly 36 same-code diagonal and 1,260 different-code
off-diagonal results, including leading-zero codes. Changing recipient state through
all current codes changed lineage/hash evidence but never the relationship. Real
Order272/Order282 PostgreSQL composition proved supplier `27`, recipient `29`,
property `Pos` `36` yields only `different_state_or_union_territory`, with exact
replay, deep freeze, tenant-bound hash and zero source/effect writes.

Harness notes: the product-only focused file first reported its own 11/0 and 4,184
assertions; adding the separately registered current-canary file reproduced the exact
12/0 and 4,187 gate. The first referee command reached the Windows `python3` Store
alias rather than an interpreter; rerunning unchanged through the repository's Bash
Python 3.12 plus psycopg2 2.9.12 passed 11/11. The first migration run's tool-output
capture detached at its 30-second yield; it completed, and I reran the full suite to
capture the exact final 39/0 and 186 assertions. None was a product failure or stable-
runtime mutation.

## Finding requiring correction

### [P2] The candidate's new governance proof overstates FORCE RLS coverage

The candidate newly claims `92 forced-RLS tenant tables` or `92 forced-RLS
tables+policies` in `BUILD-PLAN.md`, D-742 and Order283's proof text. Reviewer-personal
catalogue and normalized-schema inspection prove instead:

- 92 public tenant tables have RLS enabled;
- 92 tenant-isolation policies exist;
- only 2 tables have `relforcerowsecurity = true`:
  `property_fiscal_location` and `india_gst_item_classification`.

Repository search independently confirms `FORCE ROW LEVEL SECURITY` exists only in
migrations 0049 and 0050 and their schema snapshot statements. This does not identify
a defect in the pure Order283 product function, but it is a false executable-proof
claim in the exact candidate and therefore cannot remain in an auditable Tier-3
record.

Required correction: use the exact wording **92 RLS-enabled tenant tables / 92
policies; 2 FORCE-RLS tables** in mutable Order283/build records, and preserve the
append-only decision/ledger rules by adding the appropriate corrective record rather
than silently rewriting durable history. Then rerun the exact catalogue/schema gate
and route the corrected descendant to fresh independent review.

No other product or containment finding remains.

## Cleanup and stable-runtime preservation

Before removal, the disposable project contained exactly one PostgreSQL container and
only `yellow_review283_admin`, `yellow_review283_dev` and
`yellow_review283_test`; migration child databases were absent. I removed the exact
review container, network and volume. Post-cleanup counts for all three are zero.

The stable app/PostgreSQL/Valkey retained their exact pre-review full container ids
`92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf`,
`f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12` and
`aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa`.
All remain running and healthy with restart count 0 and unchanged start timestamps;
stable `/health` remains HTTP 200 with exact body `{"status":"ok"}`. I did not
restart, mutate or promote the stable runtime.

Apart from this authorized review record, I changed no repository file. Because the
governance-proof finding remains in the exact candidate, the verdict is **CHANGES
REQUIRED**.
