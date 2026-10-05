# PROOF-20260930 — independent inherited-fixture review

Accepted bounded test-only source reconciliation; no overall release acceptance.
Basis6b0be810f5d78cdd3ebd9b3ad57f593594d5ef79, exact seven-file order.
The faster worker implemented two tests. Root authored/reviewed and did not edit
those test files; root personally executed the baseline and final proof.

## Executed proof

- Frozen e06 baseline:6 passed,1 optional DB skip,2 failed,83 assertions. Both old
  pure failures reproduced; the same tests are unchanged at composition6b0be81.
- Final candidate:8 passed,1 optional DB skip,0 failed,111 assertions. Optional
  PostgreSQL board skip remains a skip and is not accepted as database evidence.
- Exact candidate canonical `./setup.sh --db-only`:11 passed,0 failed of11,
  using the admitted owned referee stack. Races, journal/seal, invoice and RLS
  checks executed. Existing source migrations/referee remain untouched.
- Worker types passed; boundaries207 passed. Root complete diff whitespace and
  exact scope/source checks passed. Safe receipts are in
  `/workspace/yellow-coordination/fixtures-proof/`.

## Contract review

Order632 explicitly requires nullable marketCode/sourceCode on board rows.
Fixture adds both raw nullable values; exact public key equality adds only those
two fields and explicitly checks nulls. Every prior field, state, pagination,
filter, budget and authority assertion is retained. Board implementation bytes
remain identical to composition; no product change was needed.

The existing source places MovementGrid after ReservationWorkspace and immediately
before LegacyReservationWorkspace. The Finance test now slices to that following
declaration. All rendered action, exact reservation and honest context assertions
remain unchanged. Protected frontend bytes remain identical to composition.

## Separate unchanged provenance result

Root found the repository was shallow and fetched its normal origin branch's
missing history. Existing P0 reference97209531aaa7babaa5f6f3013b3e9b2c633d5284
now resolves the exact required historical referee SHA3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1.
The unchanged provenance test passed1/0/4 assertions; four optional DB cases stayed
skipped. No referee, provenance literal, masked-region or race assertion changed.
Earlier missing-history observations remain historical shallow-checkout findings.

## Frozen test hashes

```text
69549367d8da2fc7ce298b73a08b1faac4ca9f75f057d24fa682150d2d2adfa9  tests/reservation-board.integration.test.ts
9ea2b04d0ea69a342a28df44615b5a805cb9ed28c34485ac8ac1f4400c3e54c2  tests/yellow-reservation-finance-entry.test.ts
```

No domain/migration/permissions/frontend/referee/dependency/provider behavior
change. Browser, frontend size, tracked MCP policy and full standing/release/live
acceptance remain open. No PR/push, self-merge, deployment or dirty-laptop overwrite.
Quota policy: continue under laptop monitor; checkpoint/stop at<=1%, no paid
fallback/reset/automatic resume. Cloud has no direct quota reader/hardcap.
