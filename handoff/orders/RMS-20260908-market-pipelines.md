# Order RMS-20260908 — market collection and private import foundation

**Author:** Codex, from the founder's 8 September 2026 research-to-build directive.
**Phase:** 9 collection prerequisite for Phase 14 RMS; existing fiscal and UI work remains owned by the active build.
**Baseline:** reviewed remote main `3503b0c01f336637d2583963c17b792f6ad59efe`; separate worktree. PR92 is the current development receiving lane.
**Status:** implemented and independently reviewed within the bounded collection/POSIX staging scope; delivery receipt and remaining integration gates are recorded below. This order was committed as `cb4803e6` before implementation.

## Scope

- `src/contexts/distribution/market-shopping.ts`: deterministic observation validation, exact-context cache, single-process budgeted route runner, explicit failure classification, cadence and exact cost quote.
- `src/contexts/distribution/index.ts`: export that collection surface only.
- `tests/market-shopping.test.ts`: adversarial synthetic tests for that contract.
- `scripts/research/pricelabs-import.ts` and `tests/pricelabs-import.test.ts`: offline, bounded and checksum-verified archive ingestion to a private staging bundle and preview, without operational writes.
- `docs/research/PRICELABS-MARKET-INTEGRATION-20260908.md`, this order, `handoff/reviews/RMS-20260908-market-pipelines.md`, and append-only `DECISIONS.log`/`handoff/LEDGER.md`: authority, commands, evidence and integration gaps.

## Architecture decision and natural-solution test

This is acquisition infrastructure and an offline import preparation tool, not a new hotel aggregate. Reuse the distribution context and existing operational domain commands for subsequent imports/publication. There is no new table, event, state transition, tenant authorization service, rate writer or dependency. Caller-scoped context keys are collection isolation inputs, not authentication. Production callers must supply verified identity and permissions. One runner is deliberately single-process; a durable multi-worker shared budget/lease requires its own admitted persistence design.

The founder approves alternative routes selected on demand, not simultaneous duplicate shopping. Methods reaching the same upstream share a budget and stop/cooldown state. Independent supported providers can handle failures. No code changes access-block identity, uses stealth or rotates proxies to evade restrictions. Unknown/old source age, incompatible stay/occupancy/currency/package/eligibility or ambiguous money cannot become an actionable rate.

Collection cadence in property-local date distance: 0–7 hourly; 8–20 every 2h; 21–30 every 3h; 31–45 every 4h; 46–90 every 5h; 91–180 every 6h; 181+ configurable 1/2/7/15 days or calendar month. Cost quotations use exact minor units and a 30% gross margin: ceiling(all-in cost × 100 / 70), not a 30% markup. No customer is billed here.

PriceLabs data is external research evidence. Preserve listing identity, membership overlap, source strings/units, original dates and provenance. Listing records are not proven unique physical units. Market and host geographies require explicit matching. Forward availability is not booked demand. Do not infer Yellow Net from source revenue. The private staging bundle can be populated immediately; promotion to PMS properties/reservations requires explicit identity/configuration mappings and existing governed commands.

## Forbidden

No migrations, protected schema/referee edits, direct database mutations, production imports, operational prices/inventory updates, new dependencies, credential use/storage, purchases, API/MCP activation, uploads of client data to public git or external AI, stable runtime/WSL restart, global configuration changes, self-merge, deployment or whole-app completion claims.

## Definition of done

1. Unit tests attempt duplicate in-flight work, shared upstream pressure, cooldown bypass, stale/incomparable/unknown-age observations, wrong-context cache results, unavailable-as-booked errors, calendar boundaries and exact rounding.
2. Import tests reject unsafe paths/tampered source files and show deterministic membership-preserving output with unknown unit mapping and source amount semantics.
3. Run the importer on the private verified archive; reconcile all counts and emit an explicit non-operational staging receipt outside git.
4. Run focused tests, typecheck, boundaries and diff checks. A non-implementing reviewer executes focused proof. Run the canonical database wrapper in an isolated disposable environment before any PR; if its execution is unavailable, record the exact failure and hand off the branch without implying database acceptance.
5. Record source baseline, tests actually run, unresolved live connector/authentication and persistent-worker integration, and send a privacy-minimised priority handoff to PR92 and the earlier PR86 research lane.

## Executable evidence

`bun test tests/market-shopping.test.ts tests/pricelabs-import.test.ts`

`bun run typecheck && bun run boundaries`

`bun scripts/research/pricelabs-import.ts --archive /private/PriceLabs-Research-Archive-2026-09-08 --output /private/Yellow-PriceLabs-Staging`

`./setup.sh --db-only` only against a collision-proof disposable Compose project, never the active founder environment.

## Completion evidence and remaining gates

Root executed the final market/import and existing RMS economics/provider tests together: **38 pass, 0 fail, 271 assertions** on Bun 1.3.14. Typecheck passed; import boundaries passed for 184 TypeScript files. A separate reviewer executed the new tests and verified two byte-identical imports of the private archive; exact source hashes and adversarial repair history are in the admitted review.

The writer establishes private POSIX file modes and deliberately rejects native Windows before filesystem effects (`unsupported_windows_acl`); an identity-bound NTFS ACL implementation remains required for a native Windows writer. Existing staging/HTML can be reviewed privately without rerunning that writer. An imported listing is not yet an operational Yellow property.

The isolated database setup stopped immediately at `Missing docker. Install Docker Engine/Desktop with the Compose plugin.` No canonical database/referee acceptance is claimed, so this branch is a reviewed source handoff, not a merge-ready PR. Live adapter activation, durable worker/time-window coordination, tenant and physical-unit mapping, operational import and dashboard/RMS wiring remain explicit next work. The underlying Windows/WSL crash and disk-growth problem also remains a desktop-host task; no host repair was performed here.

