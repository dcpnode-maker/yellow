# docs/research/ — how the decisions were reached

Archive, not instructions. `PROJECT.md` and `DECISIONS.log` are what govern; these
files explain WHY, which matters when someone later asks "can we just change X?"

| File | What it established |
|---|---|
| `differential-analysis-round-1.md` | Folio belongs to Account, not reservation. 12 missing entities. Automation trigger+condition+action shape. |
| `differential-analysis-round-2.md` | Space → SellableUnit → Slot composition. Dorm-bed vs private-room exclusivity. Inventory system-of-record per property. |
| `differential-analysis-round-3.md` | JSONB vs EAV (~50,000× measured). GIN serves `@>` not `->>`. Two tenancy tiers, not three. `set_config(..., true)` under PgBouncer. |
| `system-stress-test-round-4.md` | Natural-Solution Test. One insert-only fact_log unifying ledger/rates/reservations/config. space_occupancy as single choke point. Trust accounting with zero new primitives. |
| `PMS-master-build-prompt.md` | The original 12-context scope statement and NFRs. |
| `../ARCHITECTURE-v3.html` | The zero-cost full-stack architecture: four doctrines, 16 primitives, 13 contexts, INR cost model, spend triggers. |

Provenance: designed clean-room from USALI 12th, HTNG/OpenTravel, and public modern-PMS
APIs. No Oracle/OPERA materials were used at any point.
