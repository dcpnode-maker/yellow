# Independent review — Order 727 staff charge correction

Reviewer: `financial_proof732`, a nonimplementing agent. Date: 2026-09-25. Verdict: **no blocking source or financial proof finding for the bounded Order 727 charge-correction UI**. Local browser acceptance and app-only promotion are root-owned separate gates.

I inspected the correction parser/controller, React panel, action ribbon and Finance workspace integration. The controller uses server-returned eligibility, exact bigint minor units, bounded reason and statement pages, a shared synchronous financial lease, current-session preflight, one retained idempotency key/body after an uncertain POST, exact receipt lineage validation and authoritative statement reconciliation. The panel names the guest, folio, original posting/date/amount, signed reversal and reason before confirmation; it exposes same-key recovery when uncertain. The original journal is not edited. No Order 727 backend, migration or grant change was found in this reviewed surface.

I personally ran:

`bun test tests/order727-folio-charge-correction.test.ts tests/order727-folio-charge-correction.test.tsx tests/order727-finance-integration.test.ts tests/order721-guest-billing-workspace.test.tsx tests/order714-finance-integration.test.ts tests/order714-additional-folio-window.test.tsx tests/order672-folio-workbench.test.ts tests/order672-folio-statement.test.ts`

Result: **55 pass, 0 fail, 418 assertions**. The Order 733 adjacent lock assertion is current and passed; the inspected source expression is `locked={depositLocked && additionalWindowLease.current === null && correctionLease.current === null}`. The three required genuine PostgreSQL financial suites passed independently in [Review 732](732-isolated-financial-proof.md): 9/9 corrections, 12/12 statements and 25/25 operator folio, all required flags enabled. This discharges the independent executable financial review for this bounded candidate.

Frozen source SHA-256: `FinanceWorkspace.tsx` `5F6FDF74177258116C10BC54636B46A894A3823C89F5AD58530D4821CD317556`; `folio-charge-correction.ts` `92A616C19755F0874D3FBC0B01D788E604AE1F1B14D9416BF2C5DA7FC318A6DA`. Other reviewed application files: `FolioActionRibbon.tsx` `946EBBEB0101D7406806F3DD7B3746DBDD5F69CEEDFD1A267FAE055B04F242CD`, `FolioChargeCorrection.tsx` `F79162146C43218AA4BA176E9751E9E72186CCDFB386A961EF3ACA55CDF95886`, correction CSS `2229ABFE3B0CDDEA394C63572ADD1B8B618B0C6AC414E1F50502A859C97CB78B`.

This review does not claim browser visual acceptance, serving-cluster authority remediation or real hotel-data financial execution. The inherited shared-cluster role drift remains a separate release limitation.
