# Order710 — observed room discrepancies in active Housekeeping

Founder continuation, Phase7, after/alongside Order709. Scope restores an existing
governed workflow in the active React app; legacy HTML/JS presence is not delivery.
Reuse existing Order235 GET/POST /properties/:property/housekeeping/discrepancies.
No new domain state, schema, grants, resolution policy or readiness/occupancy effect.

Acceptance: list server-owned open discrepancies, with bounded-list explanation,
empty/error/retry states. Staff explicitly choose an exact loaded room, occupied
or vacant observation, and persons1–99 for occupied (null for vacant). Explain and
confirm physical observation before POST. Matching observation creates no report;
existing/new mismatch receipts are distinguished. Reporting NEVER resolves a
discrepancy or marks a room clean/ready. Use minimized server evidence only.
One frozen request/key across uncertain network/5xx/receipt/readback failures.
Explicit same-key reconciliation; no new key/edit/cancel while uncertain. Read
current discrepancy list and refresh conditions after receipt; verify receipt in
authoritative list before success for mismatch outcomes. Permission, stale room,
changed property/unmount failures are handled without guessed writes.

Exclusive scope:
- Builder: new frontend/yellow/src/workspaces/HousekeepingDiscrepancyWorkbench.tsx,
  housekeeping-discrepancy-client.ts, housekeeping-discrepancy.css;
  tests/order710-housekeeping-discrepancies.test.tsx.
  Props propertyId:string, getToken:()=>Promise<string>, rooms:readonly
  {spaceId:string;code:string;floor:string}[], disabled?:boolean,
  onBusyChange?:(busy:boolean)=>void, onRefresh:()=>Promise<void>.
  Inject fetch/token in testable transport/controller. No yellow-api changes.
- Root: frontend/yellow/src/App.tsx (only HousekeepingWorkspace import, integration,
  aggregate busy/navigation guards); tests/order710-housekeeping-integration.test.ts.
- Governance: this order, handoff/questions/710.md if required,
  handoff/reviews/710-housekeeping-discrepancies.md,
  handoff/receipts/710-housekeeping-discrepancies.md,
  docs/PROJECT-STATUS.md, handoff/LEDGER.md.
- Generated public/yellow-next/**; temporary proof/build evidence only
  D:/Yellow/temp/order710-*.

Proof: focused controller/transport/render/wiring tests with non-DB existing
operator-housekeeping-discrepancy-http.integration.test.ts and
housekeeping-discrepancy-reporting.domain.test.ts. Independent non-implementer
personally executes proof, full types/boundaries. Actual mobile/desktop browser
verifies workspace, explicit room selection, validation, observation confirmation,
read-only list and refresh. Do not report a fictional physical observation as
real; any end-to-end POST proof uses explicit synthetic test fixture/evidence.
Never point seeding database suites at live. App-only existing-stack release with
rollback; no second public app or expanded credentials/services.

This is one pending workflow, not ecosystem completion. Continue next evidenced
slice once accepted; same-type room move remains next and requires reviewer-run
isolated PostgreSQL arbitration proof before release.
