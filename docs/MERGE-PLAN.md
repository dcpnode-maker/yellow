# MERGE-PLAN.md — combining Yellow with the existing PMS

There are two systems: **Yellow** (this repo — validated 80-table schema, invariant
battery, no application code yet) and the **existing PMS** (working prototype seen
Aug 2026: Vite dev server, reservations, folios, rate plans with company linkage,
reports with PDF, travel/vehicle capture). They are not competitors. They hold
different kinds of value, and the merge is a one-way flow.

## The asymmetry that decides everything

| | Yellow | Existing PMS |
|---|---|---|
| Holds | Correctness under concurrency, multi-tenancy, ledger integrity, compliance design | **Proven UX, real workflows, features shaped by actual use** |
| Proven by | 11/11 invariant battery, 80-table validated schema | It runs, and people used it |
| Missing | All application code | The invariants (see below) |

**Yellow's schema is the base. The existing PMS is the requirements source and the
UX reference.** Not because Yellow is "better," but because the direction of safe
travel is one-way: you can port a working screen onto a correct foundation, but you
cannot retrofit tenant isolation, claim-range occupancy, or an insert-only ledger
into a system whose data already flows the other way. That's the same reasoning that
made the folio-ownership fix cheap on paper and a migration nightmare after launch.

## Capture NOW, before memory fades

Do this while the existing system is still fresh — it costs an hour and it's the
input to every later decision. Put the results in `docs/legacy/`:

- [ ] **Schema dump** — `pg_dump --schema-only` of the existing database.
- [ ] **Screenshots of every screen**, including empty and error states.
- [ ] **Feature inventory** — one line per feature, marked: *keep · rethink · drop*.
- [ ] **What actually got used** — which screens saw daily use, which were dead.
- [ ] **What annoyed you** — every workaround someone invented is a requirement in
      disguise.
- [ ] **Sample data export** — a few real reservations/folios (anonymised) as
      migration test fixtures.

## What each side contributes

**From the existing PMS → Yellow (already started):**
- Travel/transport capture and vehicle register → `travel_detail`, `vehicle` (done)
- Human-readable references (`FOL-…`) → `folio_no` (done)
- Bulk room create, Reports screen, property switcher → `UI-SPEC.md` §5 (done)
- Rate plans with company linkage and inline derivation → validated existing design
- Still to mine: any screen, field, or report not yet in `UI-SPEC.md`

**From Yellow → the merged system (non-negotiable, these are the reason Yellow exists):**
- Claim-range occupancy — no double-booking under concurrency
- RLS on tables *and* views — tenant isolation
- Insert-only ledger with deferred balance assertion
- Business-day sealing, gapless document numbering, fiscal chains
- Extension registry — verticals, tax, statutory rules as data
- The invariant battery as a permanent gate

## Merge sequence (this is Phase 12+, not now)

1. **Inventory** — legacy feature list mapped against `BUILD-PLAN.md` phases. Every
   legacy feature becomes either a phase task or an explicit "drop, because…" line
   in `DECISIONS.log`.
2. **Gap orders** — anything the existing system does that Yellow's plan doesn't
   cover becomes a work order (`handoff/orders/`), built by Codex, reviewed by Fable.
3. **Data migration** — legacy → Yellow via the Phase 12 importer, with a dry-run
   reconciliation report that must tie to the rupee/fils before any live cutover.
4. **UX port** — legacy screens rebuilt against `UI-SPEC.md`'s three-tier model.
   Legacy modals become drawers with deep links; nothing is copied pixel-for-pixel.
5. **Retire** — the existing system becomes read-only reference, then archive.

## What NOT to do

- **Don't port legacy code directly.** Port the *requirements* the code embodies.
  Code written against a different data model carries that model's assumptions in.
- **Don't merge the schemas.** Yellow's is validated; legacy tables enter only as
  migration sources.
- **Don't keep two live systems past cutover.** Two systems mean two ledgers, and
  two ledgers mean neither is trustworthy.
- **Don't let the merge start before Phase 5.** Until the ledger exists in Yellow,
  there's nothing to migrate *into*.
