# Order 462 — private PriceLabs intake and current-line market pipelines

Status: ACTIVE, founder resumed after the 2026-09-09 restart.
Owner: Codex. Risk: source integration is routine; private data handling and any
new database/schema require independent, personally executed proof before use.

## Intent and sequence

Implement the founder's receiving handoff, not another research-only plan:
1. Reuse published market/PriceLabs code and preserve all supplied source fields.
2. Create one private staging dataset/database, separate from operational PMS.
3. Finish current-line Phase 4 integration proof; retain accepted Phase 1–3/5/6
   completion and audit only changed contracts. Then close Phase 7 and continue
   the retained priorities 11, 13, 17 / RMS and AI.

## Exact inputs

- PR92 comment 5590380190: phase-9/live-market-adapters,
  b235e94de6626e2724e7c7984d794d45b20c058a; includes the earlier foundation.
- PR92 comments 5589245925, 5596522587 and 5596558144: foundation,
  fiscal closure and source-catalogue/onboarding requirements.
- Private founder Drive research archive dated 2026-09-08. Actual rows and hashes
  must be verified; handoff-reported counts are not local import evidence.
- Retained Order460 checkpoint. Existing migrations 86–90 have already run;
  do not repeat migrations, seed, overwrite receipts or create another app instance.

## Scope

- The incoming scripts/research/pricelabs-import.ts, market-source-batch.ts,
  market-source-example.json and tests for those scripts.
- Incoming distribution market-shopping.ts, market-batches.ts,
  market-source-adapters.ts, index.ts and their three tests.
- Incoming two research documents and two RMS-20260908 orders/reviews. Preserve
  their source evidence; append rather than replace current DECISIONS/LEDGER.
- New scripts/research/pricelabs-windows-intake.ps1,
  pricelabs-staging.ts, pricelabs-staging-schema.sql and their focused tests.
- This order, handoff/reviews/462-pricelabs-intake.md,
  docs/research/PRICELABS-RECEIVING-INTEGRATION-20260909.md,
  docs/PROJECT-STATUS.md, DECISIONS.log and handoff/LEDGER.md.
- Private ignored evidence under .yellow/evidence/order462; source archive and
  derived private records only under D:/Yellow/data/pricelabs. Verify exact paths,
  absence of reparse traversal and current-user/SYSTEM-only ACL before writes.
- Bounded synthetic native SQL proof at D:/Yellow/temp/order462-acl-tests and
  current-user-only command receipts at
  D:/Yellow/temp/order462-private-proof-20260909. These contain no real client
  archive. A one-shot provisioner may create only yellow_pricelabs_staging and
  its three named NOLOGIN roles on the retained PG16 host after independent
  inspection. It must refuse overwrite/cleanup and leave all existing database
  and role catalogues unchanged. Independent live proof is required before
  any real archive is loaded.

## Boundaries

No operational reservation, occupancy, guest, financial or pricing mutation.
Research observations are comparison-only, not confirmed bookings or sellability.
No automatic property/tenant mapping, provider activation, paid queries, credential
sharing, proxy identity rotation, source-data publication or new dependency.
No WSL, Docker, bash/state scripts, deletion, history editing or whole-tree staging.
Preserve mixed/paused Order445 source and all existing development.

## Staging contract

Keep raw field strings, missing markers, source hashes, membership and lineage.
Require explicit authenticated ownership/mapping before operational use.
One content-addressed batch: same archive import is an idempotent no-op; conflicting
content fails. A private research namespace must not be accessible to app roles.
Reuse the existing native PostgreSQL server only if a new staging database is
needed; independently inspect and execute its isolation proof before real intake.
Windows must fail closed unless ACLs are verified, never emulate POSIX chmod.

## Proof and completion

Run the five imported unit/contract suites, typecheck and import boundaries.
Test malformed archive, digest mismatch, traversal/reparse links, partial records,
idempotence and no operational writes. Test Windows privacy with synthetic data
before handling the real archive. A separate nonimplementer executes data-safety
and DB-isolation proofs. Record exact commands, results and limitations.
Distinguish source integrated, synthetic proof, real staging import, application
wiring and runtime availability. No whole-phase completion from staging alone.

## Checkpoint after restart continuation

Source integrated and native synthetic intake independently verified. Root final
six suites:61 pass,15 retained platform skips,0fail,369 assertions; typecheck and
197 boundaries pass. Independent native/intake:19 pass,6 POSIX skips,0fail,141.
Original review findings and fixture setup failure are retained; fixes did not
relax privacy or enable the original POSIX writer on Windows.

Completed actual database proof: retained server restored under Order460;
independent provision receipt995e3933 creates one staging database, three
NOLOGIN roles and two tables with unchanged previous catalogues. Final combined
integration2/0 (182 assertions), receiptc9fcb596, includes the actual exported
guard rejecting a rollback-only predefined-role grant through the existing pinned
native psql client. Final PMS/cluster fingerprints and restored access pass.
Earlier oracle/client failures and synthetic batches remain separate evidence;
no real archive is loaded.

Still required, not silently complete:
1. Materialize the private source ZIP locally. The Drive connector returned an
   authenticated file reference without a supported local resolver; founder asked
   to download the exact research ZIP into Downloads. Never make it public.
2. Safe bounded extraction into private NTFS research root, verify actual archive
   hashes/counts, load once, prove no-op reimport and preserve original source.
3. Authenticated operational mapping/RMS wiring remains separate follow-on work.

No changes are yet published or reflected in a running local app. Preserve the
Order460 checkpoint and all existing mixed changes while preparing the next
selective tested source publication.

### September12 receiving recheck

The retained native server has recovered under Order460; no staging re-provision
or synthetic fixture replay was performed. Root source regression on the market,
PriceLabs and sandbox suites passes66/15 explicit platform skips/0fail(399).
This is not a real client import. The receiving directory still lacks the source
archive. A fresh metadata request through the current Drive connection returns404
for the recorded private archive and a targeted PriceLabs search returns no result.
The September9 authenticated reference is historical evidence, not proof of current
access. No deletion, download, sharing change or operational mapping is inferred.
