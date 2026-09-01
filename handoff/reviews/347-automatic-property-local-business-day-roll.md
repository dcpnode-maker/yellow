# Order 347 builder evidence — pending fresh Tier-3 review

**Builder:** `/root/order347_builder`
**Status:** built only; this is not independent review or approval.

Intentional-red commit `2c6bfc7` failed the exact absence proof before production.
D984 then corrected the contract to preserve direct `business_day` DML denial and
admit only the app-role owner-mediated write capability.

Builder-executed evidence on fresh isolated PostgreSQL 16.15:

- focused roll/contention/rollback/hostility/authority/discovery/worker: `10/0`;
- exact schema match; acceptance `23/0`; runtime authority `10/0`; runtime DML
  `5/0`; SECURITY DEFINER `3/0`; migration runner `39/0`;
- standing `1193/0 + 905 skips` (`18417` assertions);
- typecheck, 134-file boundaries, 23-package licences, audit and diff green;
- fresh migrations1–61, 111 tables, referee `11/11`.

Business-day seal passed `3/3`. The legacy Order104 suite's nine functional tests
pass; its separate pre-existing catalogue oracle still expects 87 rather than the
approved current 111 tables and is outside this order's directly affected oracle
scope. Positive-tax P1–P6 passed in the first isolated run and P7/P8 in the second;
combined heavy reruns exposed connection-time pressure only, not a product assertion.

A fresh non-implementing Tier-3 reviewer must personally execute mandatory P1–P7 on
the exact candidate. No approval, Phase completion or application completion is
claimed.
