# Order 683 — delivered bounded reservation-flow repair

2026-09-24. Serving source `D:/Yellow/git-live-order611-source-v2`; production
changes are local and uncommitted. This receipt is not whole-PMS certification.

## Root cause and repair

Every availability quote includes a fresh transaction timestamp in its hash; the
old UI searched for the old option reference after re-quoting. Real read-only
requests against the serving property reproduced changed references with identical
room, dates, commercial evidence and totals. The UI now compares stable identity
and full commercial evidence, not the ephemeral reference. Actual price/policy
changes still return to Offer for review. Six-digit recorded timestamps reconcile
exactly with equivalent three-digit instants, never by truncating precision.

Unknown creation results retain the exact body and idempotency key and replay
without a new availability search (the original booking may have used the room).
Success shows the server confirmation number. Close opens that reservation's
canonical detail. No invented success and no live test booking were submitted.

Arrival detail now opens the existing room-assignment/check-in journey in a native
dialog. Type a room number to filter server candidates; changing the filter clears
selection/confirmation. Current server readiness still gates check-in. Already
assigned stays show current readiness; this is not a new arbitrary reassignment
or future-arrival/early-check-in command. Pending/unknown arrival actions lock
Close/Escape and retain an exact-action retry until canonical readback verifies it.

## Executed proof

- Independent `ecosystem_journey_gaps`: bounded source approved; 683/609 tests
  10/0/44; isolated real PG18 commit-service tests 5/0. Legacy HTTP suite 3/5:
  two fixture-role incompatibilities remain and are NOT counted green. See review683.
- Independent `order679_independent_review`: popup source review and adjacent
  tests 15/0/97. Root reported mounted proof separately, not substituted for theirs.
- Root final focused suite across681/683/684/609: 23/0/134; full typecheck and
  207-file boundaries pass; Vite production build passes (lazy map chunk warning).
- Actual built React UI at loopback4174, synthetic server only, no live proxy:
  unchanged refreshed reference → confirmation `Y-683-PROOF`; Close → its detail;
  genuine 420000→450000 price change → Offer, no booking request;
  uncertain first response → locked form → exact retry → success, 2 searches total,
  2 byte-identical bodies and identical keys. After the first write the fixture
  offers no inventory, proving retry does not perform another availability search.
- Dialog: missing identity blocks check-in; Room107 selection/confirmation cleared
  by filter108; assignment pending rejects Close/Escape; injected503 remains locked;
  exact retry gives verified assignment, 2 identical bodies/keys. Desktop and375px
  mobile screenshot proof; Close remains legible and keyboard focus returns.
- Initial synthetic fixture lacked identityGate and produced a console exception;
  fixed fixture contract, not disguised as a production defect. Actual parent
  lifecycle click guard blocked dialog controls: fixed by existing narrow recovery
  marker; repeated mounted selection and exact-retry proof then passed.

## Release

Single existing `yellow-public-demo-app-1` recreated; healthy image
`f8406c787be8e8c8455a9adeefe1378f3d36db0b768cec5a537030abaaefbc3f` combines681/683/684.
Exact679 rollback retained as `yellow-public-demo-app:before-orders681-683-684`.
Only generated frontend and independently reviewed calendar backend delta copied
over679. Root compared all three existing backend files to the frozen679 baseline.
Built and served index SHA256 both
`68fac81e73c32b20fe52e9b7687f1fadf6d6df9fd29502d6f68e723559de2394`.
No serving database restart, migration or test mutation. Existing tunnel unchanged:
https://lying-jones-terminal-church.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations

## Limits

Current backend commit re-quotes; it does not atomically bind an accepted quote hash
or price. The UI recheck repairs the reported false rejection but is not a promise
of atomic price freezing. A backend commercial-acceptance binding is separate
high-risk work. No full repository/HTTP gate, PR, Git publication, complete group
booking flow, or full ecosystem completion is claimed.
