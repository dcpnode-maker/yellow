# INTEGRATION-20260930 — reviewed Yellow composition

## Authority and source

The founder explicitly resumed Yellow PMS/CRM work after the saved checkpoint.
This phase-7 integration proof order composes already reviewed cloud changes only.
Canonical app-source basis remains e06e400a57485cc10a8a35c21dcb1e01b5a667d1.
The laptop's dirty app checkout and exact serving revision are not available here.
Historical active-order/status pointers remain historical; this explicit finite
order does not close Phase 7 or any whole PMS/CRM capability.

Branch: phase-7/yellow-reviewed-composition-20260930.
Checkout: /workspace/yellow-integration.

## Inputs

- crm: `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`, basis `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`; exact accepted manifest at `/workspace/yellow-coordination/delivery/crm/manifest.json`.
- crs: `fbc5f00b961fd202bb95bc70b450486fc8d0dd25`, basis `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`; exact accepted manifest at `/workspace/yellow-coordination/delivery/crs/manifest.json`.
- crm-routing: `3f4dd3afba1287d1f382fbcbe0a639a5d0e774ae`, basis `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`; exact accepted manifest at `/workspace/yellow-coordination/delivery/crm-routing/manifest.json`.
- pms-offers: `224e01addb57eca5163902013ae91077e77eeef5`, basis `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`; exact accepted manifest at `/workspace/yellow-coordination/delivery/pms-offers/manifest.json`.
- property-profile: `04b4161b47b8383f8fad9738a758dc5d2a1437e4`, basis `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`; exact accepted manifest at `/workspace/yellow-coordination/delivery/property-profile/manifest.json`.
- license-policy: `9384f225d87e464a29a0c7e7b2c8254b6fca2f7d`, basis `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`; exact accepted manifest at `/workspace/yellow-coordination/delivery/license-policy/manifest.json`.

## Scope — exact forty files

- `DECISIONS.log`
- `docs/CONTRACTS.md`
- `handoff/LEDGER.md`
- `handoff/orders/CRM-20260930-department-routing-queue.md`
- `handoff/orders/CRM-20260930-departure-dispatch-queue.md`
- `handoff/orders/INTEGRATION-20260930-reviewed-yellow-composition.md`
- `handoff/orders/PMS-20260930-physical-offer-contract.md`
- `handoff/orders/PMS-CRS-20260930-staff-offer-search.md`
- `handoff/orders/POLICY-20260930-0bsd-license.md`
- `handoff/orders/PROFILE-20260930-public-property-evidence.md`
- `handoff/reviews/CRM-20260930-department-routing-queue.md`
- `handoff/reviews/CRM-20260930-departure-dispatch-queue.md`
- `handoff/reviews/INTEGRATION-20260930-reviewed-yellow-composition.md`
- `handoff/reviews/PMS-20260930-physical-offer-contract.md`
- `handoff/reviews/PMS-CRS-20260930-staff-offer-search.md`
- `handoff/reviews/POLICY-20260930-0bsd-license.md`
- `handoff/reviews/PROFILE-20260930-public-property-evidence.md`
- `scripts/license-check.ts`
- `scripts/research/property-profile-capture.ts`
- `src/app.ts`
- `src/contexts/distribution/index.ts`
- `src/contexts/distribution/property-profile-candidate-evidence.ts`
- `src/contexts/distribution/property-profile-public-capture.ts`
- `src/contexts/reservations/offers.ts`
- `src/contexts/stay-operations/departure-service-coordination.ts`
- `src/http/crs-search.ts`
- `src/http/departure-services-query.ts`
- `src/http/operator.ts`
- `tests/crm-20260930-department-routing.integration.test.ts`
- `tests/crm-20260930-departure-dispatch-queue.integration.test.ts`
- `tests/crm-20260930-routing-query.test.ts`
- `tests/license-check.test.ts`
- `tests/pms-20260930-physical-offers.integration.test.ts`
- `tests/pms-20260930-physical-offers.test.ts`
- `tests/pms-crs-20260930-staff-search.http.test.ts`
- `tests/pms-crs-20260930-staff-search.integration.test.ts`
- `tests/pms-crs-20260930-staff-search.test.ts`
- `tests/property-profile-candidate-evidence.test.ts`
- `tests/property-profile-public-capture.test.ts`
- `tests/reservation-offers.integration.test.ts`

## Implementation boundary

Preserve each accepted source/test hunk. Resolve only the combination of approved
operator wiring/imports and additive contract, decision and ledger records. Keep
all inherited decision/ledger bytes and all sibling review records intact. No new
feature semantics, provider transport, permissions, inventory/booking mutations,
state transitions, migrations, dependency versions or frontend changes.

A verified failure needing another path or product behavior requires an explicit
question/successor order before that fix; do not broaden this order silently.
External safe proof adapters and logs may live under /workspace/yellow-coordination;
private proof authority is not tracked, exported or printed.

## Acceptance

1. Verify all six input commits and manifests; record exact union scope and input
   hashes. The integration diff contains only authorized accepted deltas plus this
   order, its independent review and appended integration decision/ledger receipts.
2. Run combined typecheck, import boundaries and the allowed-license audit against
   the populated frozen dependencies. A zero-package audit is not acceptance.
3. Run the normal complete standing suite with database-required flags absent;
   record pass/fail/assertion/skip totals honestly. Do not treat skips as DB proof
   or change assertions, timeout predicates or authority to manufacture green.
4. Run the focused CRM/CRS/PMS/profile/policy suites on the integrated bytes.
   Required PostgreSQL work uses the exact owned disposable target and restricted
   runtime authority; real rows/sequences and existing command/state receipts must
   remain proved. Execute canonical ./setup.sh --db-only on this source: 11/11.
5. An independent non-implementer personally executes integrated tenant/property
   denial and same-transaction evidence proof, inspects the full combined diff,
   and records exact source bytes, commands, outcome and limitations.
6. Commit locally only when scope, review and complete whitespace checks pass.
   A reviewable PR additionally requires all current applicable release gates;
   no self-merge, deployment or dirty-laptop integration is authorized here.

## Quota and coordination

Latest reported quota is 21% remaining PLAN; this runtime cannot read live account
usage. Laptop supplies telemetry. At a reported 1%, checkpoint safely and stop new
model calls/job dispatch; purchased credits remain emergency-only. No reset or
automatic resume. Reuse bounded existing workers, with no cost promise.

The actual Lighthouse roster/group brief and protected current laptop source
subsets remain requested separately. CompSet Studio and market-data acquisition
stay laptop-owned. Public property evidence is unverified until owned identities
and rights are accepted; this order adds no live provider or browser acceptance.

## Mandatory quota checkpoint — 2026-09-30T21:44:49+00:00

The founder tightened the rule: usage reading unavailable also requires pause.
No callable quota reader was found in this host. Latest laptop report is20%
remaining; no per-batch cloud reading exists. Root stopped the ongoing default
standing run and the independent reviewer stopped before any executable proof.
The composed source remains an unapproved WIP; static receipts are saved, but
standing/PG/referee/independent acceptance and publication are not complete.
The exact staged binary checkpoint preserves all forty authorized files. No
implementation commit, PR, push, merge, deployment or automatic resume.

## Explicit founder resume — 2026-09-30T21:50:24+00:00

Founder directs continuation with the laptop monitor responsible for the1% stop
signal, overriding pause solely for unavailable cloud-local usage readings.
Current source/tests are unchanged. Resume exact bounded integration proof; keep
all interrupted receipts and incomplete review history. No emergency-credit
fallback, reset or automatic quota resume.

## Bounded composition source acceptance — standing remains incomplete

Independent non-implementer personally verified all six accepted manifests and
source/patch hashes, exact40-path union, combined operator wiring and preserved
contract/governance additions. Integrated restricted PostgreSQL passed initial
CRM1/0/33, routing1/0/40, physical offers1/0/69 and CRS6/0/66; pure/mounted CRS
27/0/163. Nine authority-negative controls reject at intended guards. Root legacy
8/0/83 and exact-source canonical setup11/11 pass. Types207-boundaries, populated
67-package policy audit and vulnerability audit pass.

This permits a LOCAL reviewed composition checkpoint under acceptance item6.
Overall standing/order/release completion is still incomplete: the first default
standing was quota-interrupted; six pure/source-artifact defects reproduce on
pristine e06 and candidate, browser execution remains unresolved. After an official
digest-verified PowerShell runtime was provided outside Git, native-helper tests
passed7/0/19. This is environment proof only. No release-green, PR, live serving,
laptop integration or phase-completion claim. A separate governed catalogue order
reconciles current100 fixtures; it is not silently included in this40-file scope.
