# Order 279 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**
**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order279_review`)
**Reviewed commit:** `6ae170ff2ae8cba2f934397d5e69e9196408e9ee`
**Reviewed base:** `8e001e97c83f9cadceedce4776fec0ba3b99afc2`
**Reviewed range:** `8e001e9..6ae170f`
**Date:** 2026-08-29

## Independence, constitution and exact scope

I implemented none of Order279. I read `PROJECT.md` and `AGENTS.md`, ran
`./state.sh`, and read the Yellow constitution, architecture, compliance/entity/
PostgreSQL skills, roster/workflow, Order279, the relevant Order188/276/278 contracts,
and D-725 through D-730 before evaluating the exact candidate.

The reviewed head was exact clean commit
`6ae170ff2ae8cba2f934397d5e69e9196408e9ee`; exact independently approved Order278
descendant `8e001e97c83f9cadceedce4776fec0ba3b99afc2` is its ancestor. The thirteen changed
paths are exactly the declared source/export, two tests, three contracts, order and
governance records. There is no migration, schema, seed, dependency, credential,
local-runtime or deployment path in the range. `git diff --check`, `git show --check`,
ancestry, name-status and clean-worktree proofs passed.

## Official schema and explicit-association audit

I personally checked the GSTN-authorized IRIS IRP **Notified E-invoice Schema** at
`https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`. It names buyer
GSTIN, legal name, optional trade name, address1, location, PIN and state as
`BuyerDtls.Gstin`, `LglNm`, `TrdNm`, `Addr1`, `Loc`, `Pin` and `Stcd`; mandatory buyer
place of supply is separately named `Pos`. Order279 composes the exact approved
Order278 BuyerDtls bytes and does not invent `Pos` or any supply/tax decision.

The input parser accepts only the exact accessor/proxy/symbol-free five-key plain
object `{tenantId,propertyNode,folioId,recipientPartyId,registrationId}`, with
lowercase canonical UUID shapes and no surplus field. The single anchor query binds
`folio.tenant_id` both to the explicit tenant and transaction-local
`current_setting('app.tenant_id', true)`, then equality-joins the folio's exact
tenant/account/reservation and exact account/reservation property. Its output parser
rechecks the selected folio and tenant, both properties, exact canonical identifiers,
bounded window, declared status/role sets and equal canonical currencies.

The source never reads account Party, reservation primary/booker Party,
`reservation_guest`, `party_role`, folio name or folio number. Only the explicitly
selected Party and registration enter the exact Order276 resolver. PostgreSQL proof
changed account Party, both reservation Party references, Party-role detail, folio
name and folio number without changing the candidate; explicitly choosing a different
valid Party/registration changed only the selected recipient evidence. Two sibling
windows sharing one account/reservation and recipient produced distinct exact
associations and hashes.

The stored folio/account/reservation statuses, account role and common currency remain
evidence only: settled/frozen/checked-out evidence still resolves, while incoherent
currency fails closed. Missing, duplicate, malformed, foreign tenant/property/folio/
Party/registration and hostile stored shapes all fail closed.

I independently recomputed both GSTIN check digits used by the database fixture.
`27AAPFU0939F1ZV` correctly ends in `V`; the corrected alternate
`29AAPFU0939F1ZR` correctly ends in `R`. Thus the alternate selection and cross-tenant
proof exercise canonical Order276 evidence rather than an invalid-checksum shortcut.

## Determinism, immutability and zero authority

The result fixes field order for folio/account/reservation/window/status/currency and
property lineage, recipient Party/registration/evidence lineage and the exact approved
BuyerDtls wrapper. `associationJson` is the direct fixed-order serialization and
`associationHash` is SHA-256 over those exact bytes. Reviewer execution confirmed
byte-identical replay, different sibling hashes and recursive freeze through the
BuyerDtls payload.

Source and SQL scans found SELECT only: no insert/update/delete, `FOR UPDATE`/share,
advisory or financial lock, event/fact/outbox/idempotency, journal/posting, fiscal
submission, document series, provider, network, API, HTTP, UI or local-runtime path.
Before/after row-count and byte digests proved successful and failed reads leave
folio, account, reservation, Party registration, facts, events, documents, journals,
postings and submissions unchanged. This value is candidate evidence only; it neither
persists nor authorizes a legal invoice buyer.

## Reviewer-personal executable proof

I did not rely on builder-recorded results. I created isolated disposable PostgreSQL
16.15/Valkey stacks on unused ports, never started an application container, and ran:

- canonical `./setup.sh --db-only`: **48 migrations, 100 public tables, 90 RLS
  tables/policies, 11 passed and 0 failed of 11 referee checks**;
- exact Order279 intentional-red/current candidate suite with required deploy/runtime
  URLs: **10 passed, 0 failed, 124 expectations**;
- adjacent exact Order276 database suite: **13 passed, 0 failed, 105 expectations**;
- adjacent exact Order278 suite: **9 passed, 0 failed, 108 expectations**;
- adjacent Order188 financial sibling-window proof: **8 passed, 0 failed,
  47 expectations**, plus migration acceptance **2 passed, 0 failed,
  13 expectations**;
- database acceptance: **13 passed, 0 failed, 34 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 107 expectations**;
- migration runner against disposable databases: **39 passed, 0 failed,
  184 expectations**;
- schema drift: exact match; direct catalogue recount: **48 migrations / 100 tables /
  90 RLS tables / 90 policies**;
- `bun test`: **884 passed, 805 environment/database-only skips, 0 failed,
  8,979 expectations; 1,689 tests across 302 files**;
- `bun run typecheck`: exit0; `bun run boundaries`: **102 TypeScript files**, pass;
  `bun run license-check`: **23 packages**, pass; `bun audit`: no vulnerabilities;
  exact range authority/scope/diff checks: pass.

One initial WSL-side disposable Compose context disappeared before a focused run and
produced connection-closed infrastructure failures; I discarded that run and reran
all focused database proof with Windows Bun against a separately named persistent
disposable stack, producing the green results above. Both exact disposable stacks,
their networks and volumes are absent. Stable app `92cffafb9351`, PostgreSQL
`f4f02655770a` and Valkey `aa3061bdf231` remained healthy with restart count zero.

## Findings and bounded approval

No finding remains. I recommend approval only for the exact read-only Order279 folio
buyer-candidate association at commit
`6ae170ff2ae8cba2f934397d5e69e9196408e9ee`.

This grants no persisted or legal buyer designation; no `Pos`, `SupTyp`, B2C/`URP`,
export, SEZ, deemed-export or CGST/SGST/IGST decision; no item/value/tax calculation;
no financial posting/correction; no document allocation/issue/number/hash chain; no
provider/submission/API/HTTP/UI/local promotion; and no merge, public deployment,
Phase-7-complete or application-complete authority. Apart from this review record, I
changed no file and did not mutate the stable runtime.
