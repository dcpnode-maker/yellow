# docs/research/ — how the decisions were reached

> **Development documentation snapshot — 2026-09-05.** Source:
> [`61dbeea`](https://github.com/dcpnode-maker/yellow/commit/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e).
> This updates the original project documentation on main; main's executable code
> is still an older integrated baseline. Implemented contracts, setup behavior and
> proof described below refer to that development revision, not a claim that main
> or the local app already runs them. Planned capabilities remain planned.


Archive, not instructions. `PROJECT.md` and `DECISIONS.log` are what govern; these
files explain WHY, which matters when someone later asks "can we just change X?"

## Current research and requirements

The [2026-09-05 staff/STR ecosystem research](STAFF-STR-ECOSYSTEM-2026-09.md)
adds the founder's Beds24/major-PMS and PriceLabs comparisons. Its implementation
direction is tracked in the [feature register](../FEATURE-REGISTER.md),
[staff journeys](../design/STAFF-JOURNEYS.md), [OTA plan](../integrations/OTA-CONNECTIVITY.md),
[voice/RMS plan](../architecture/VOICE-RMS-PLAN.md) and
[regional packs](../architecture/REGIONAL-PACKS.md). Public documentation research
is not hands-on product verification, legal advice or a completed integration.

## Original design archive

| File | What it established |
|---|---|
| `differential-analysis-round-1.md` | Folio belongs to Account, not reservation. 12 missing entities. Automation trigger+condition+action shape. |
| `differential-analysis-round-2.md` | Space → SellableUnit → Slot composition. Dorm-bed vs private-room exclusivity. Inventory system-of-record per property. |
| `differential-analysis-round-3.md` | JSONB vs EAV (~50,000× measured). GIN serves `@>` not `->>`. Two tenancy tiers, not three. `set_config(..., true)` under PgBouncer. |
| `system-stress-test-round-4.md` | Natural-Solution Test. One insert-only fact_log unifying ledger/rates/reservations/config. space_occupancy as single choke point. Trust accounting with zero new primitives. |
| `PMS-master-build-prompt.md` | The original 12-context scope statement and NFRs. |
| `../ARCHITECTURE-v3.html` | The zero-cost full-stack architecture: four doctrines, 16 primitives, 13 contexts, INR cost model, spend triggers. |

Provenance: designed clean-room from USALI 12th, HTNG/OpenTravel, and public modern-PMS
APIs. Those original research rounds did not use Oracle/OPERA materials. The separately
dated September research includes public Oracle documentation; this does not alter
the original archive's provenance.
