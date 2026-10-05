# Order710 — active Housekeeping discrepancy workflow

Status: live; bounded browser acceptance below. This does not
declare Housekeeping or the whole ecosystem finished.

Housekeeping now mounts the existing server-owned unresolved discrepancy list
and an explicit physical-observation form. A staff member must choose a currently
loaded exact room, occupied/vacant observation and valid occupied person count,
then confirm that observation. A successful initial list read is required before
a new report. Matching truth creates no discrepancy; existing/new mismatches are
distinguished. Reports never resolve discrepancies or mark rooms clean/ready.

The controller binds receipts to the submitted room/observation and verifies
mismatches against refreshed authoritative discrepancy/condition reads. Uncertain
writes retain the same payload/key and parent lock; reconciliation stays available.
Generation checks prevent a delayed token lookup from posting after unmount or
property change. Root retains the component through condition refetch failures
and keeps existing task transitions mutually exclusive with discrepancy reports.

## Implementation and pre-release proof

- completion_queue709 implemented the four scoped workbench/client/style/test
  files. Root owns only the active Housekeeping integration and wiring regression.
- Builder focused proof:18 passed,0 failed,82 assertions, including existing
  non-database HTTP/domain suites.
- Independent review709 personally ran focused710/controller/wiring/HTTP/domain:
  21 passed,0 failed,98 assertions. The final list-read gate, uncertain parent lock,
  exact receipt/readback and pre-POST generation guard were inspected.
- Review caught early parent unlocking and missing receipt/observation binding;
  root caught loss of the existing synchronous task lock. Corrected before release.
- Root combined integration/progression proof11/0/97 and production Vite545-module
  build passed. Full independent gates and mounted browser evidence follow.

No fictional physical observation has been reported as a real hotel observation.
Mocked transport/domain proof is not a live physical-room or real concurrency proof.
No database migration, new service, credential/grant expansion or second app.

## Final release and browser checks

Independent review709 personally ran combined709/710/adjacent tests44/0/240,
full backend/frontend types and208-file boundaries. Review710 records limitations.
Final shared app imagef04a548a4f1672e110ab64e3f6b25686cb5cac9892fb1cd96e32dd10772791ca
is healthy; local/public health200 and public final bundle identity verified.
Ledger101 unchanged;708 rollback retained. Same PostgreSQL, Valkey and tunnel.

Root browser verified real server list load and refresh, empty unresolved state,
exact room choices, occupied/vacant controls, and count0 disabling confirmation
while count2 enables it. Report remains disabled without explicit confirmation.
Vacant removes person-count input.320/390/1280 CSS-width checks found no workbench
horizontal overflow. The public route independently showed the server empty list
and disabled unconfirmed report. Draft was left without checking confirmation or
submitting a fabricated physical observation. No live discrepancy POST is claimed.

Existing backend/domain behavior remains unchanged; no synthetic live observation
or real concurrency proof was newly run for this UI-only integration. Physical
phone touch and the broader Housekeeping/service ecosystem remain unverified or
unfinished. Same-type in-house room moves continue under Order711 with mandatory
independent isolated PostgreSQL proof before release.
