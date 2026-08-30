# Order 298 — India GST accommodation effective rates

**Status:** READY — implementation and fresh Tier-3 review required
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-accommodation-effective-rates`

## Outcome

Replace the quarantined launch-era India hotel-accommodation slab fixture with the
effective ordinary accommodation rate truth applicable to Yellow's 2026 launch
fixture: 12% where the value of supply of one accommodation unit per day is at most
INR 7,500, and 18% above INR 7,500. Preserve the existing effective-dated extension,
assignment and evaluator architecture; add no table, migration or second tax engine.

## Authority and boundary

- CBIC Notification 20/2019-Central Tax (Rate), effective 1 October 2019, replaced
  declared-tariff hotel bands with value-of-supply bands at 6% CGST (12% aggregate)
  through INR 7,500 and 9% CGST (18% aggregate) above it.
- CBIC Notification 04/2022-Central Tax (Rate), effective 18 July 2022, removed the
  below-INR-1,000 hotel-accommodation exemption.
- The current CBIC services-rate table confirms 12% through INR 7,500 and 18% above.
- D-791 quarantines the stale D-23 launch fixture until this separately sourced order.

This order corrects only ordinary accommodation rate-source content and executable
boundaries for the already-supported 2026 fixture. It does not decide section 14
change-in-rate cases or infer an effective date from a clock.

## Exact contract

- `in-gst-lodging` remains tax-exclusive, document-rounded, `GST_ROOM`,
  `slab_percent`, transaction-value based and limited to `room_revenue`;
- the exact boundary is `<= 750000` minor INR at 12%, then 18% without an upper cap;
- INR 0, 1,000, 1,001, 7,500 and 7,501 boundary evidence is executable and exact;
- the extension effective period remains explicit and the evaluator consumes only
  the selected immutable version/content;
- obsolete nil/5% accommodation expectations are removed only where they encode the
  quarantined launch fixture; unrelated generic evaluator and restaurant examples
  remain unchanged.

## Scope

- `tests/seed_fixture.sql`
- `docs/EXTENSIONS.md`
- `tests/tax-evaluator.test.ts`
- `tests/rate-quote-tax-preview.integration.test.ts`
- `tests/PMS_QA_Test_Suite.md`
- Order298 intentional-red/focused effective-rate proof
- bounded Order298 additions to `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`
- Order298 decision, ledger and independent review evidence

## Forbidden boundary

No migration/schema/new table, runtime writer, clock/latest selection, buyer/B2B,
place-of-supply or supply-nature recomputation, SEZ authorized-operations/zero-rating,
section14 composition, CGST/SGST/UTGST/IGST decomposition, `SupTyp`, `IgstOnIntra`,
invoice item/value payload, posting/correction, document/number/hash chain, IRP,
submission, API/UI/local promotion, merge/deploy or Phase/application-complete claim.

## Definition of done

- [x] Intentional red proves the stale nil/5% launch fixture before correction.
- [x] Exact sourced 12%/18% boundaries and quote-preview behavior are green.
- [x] Standing/static/setup/referee preservation gates are green.
- [ ] Fresh independent Tier-3 approval is recorded against the exact candidate.
