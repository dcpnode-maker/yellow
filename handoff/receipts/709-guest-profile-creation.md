# Order709 — guest creation in active reservations

Status: live with the bounded browser acceptance below. This is a bounded
workflow, not ecosystem completion.

The active React booking Guest step and reservation Guests & shares editor now
offer Create guest profile beside existing-profile search. Creation uses the
existing property-scoped canonical Party command. Name fields retain reviewed
field dictation; email/phone use typed native inputs. No booking, guest allocation,
merge, marketing consent or financial mutation follows profile creation implicitly.
Allocation role selection and its existing Save remain separate.

Possible duplicates use server-masked hints. Staff either select an existing Party
after exact-ID lookup or acknowledge the exact current candidate set to create a
distinct profile. Network, unexpected success status, malformed receipt and failed
readback retain the frozen payload/key. Parent navigation and other commands stay
locked while the explicit reconciliation control remains usable. A verified
canonical duplicate-review response can resume review, including an empty current
candidate set. Only a fully validated creation receipt supplies a known Party ID.
Readback verifies ID, names, active person/guest status and expected contact masks.

## Implementation and pre-release proof

- guest_contract709 implemented only the four component/controller/style/test files;
  root integrated both reservation surfaces and parent busy/unmount guards.
- Builder final focused proof: 14 passed, 0 failed, 69 assertions. Frontend types
  and import boundaries passed. This is injected transport/controller proof, not
  real PostgreSQL arbitration or mounted interaction proof.
- Independent review caught an uncertain-retry deadlock, missing expected contact
  hint comparison and over-broad known-ID recovery. These were corrected before
  release. Root preserved the pending form across detail refetch errors.
- Root integration709/710 plus existing housekeeping progression: 11 passed,
  0 failed, 97 assertions. Existing Order708 regressions:17/0/176.
- Production frontend build passed:545 modules. Existing large map chunk warning
  remains. Candidate includes both709 and710; no backend/schema/provider change.

## Independent proof and live acceptance

Independent review709 personally executed combined709/710/adjacent regressions:
44 passed,0 failed,240 assertions; full backend/frontend types and208-file boundaries
passed. The reviewer is not the implementer. No seed/delete suite targeted live.

Root verified the running app: created the explicitly synthetic profile
`Order709 QA Guest 20260925` in the synthetic review property. Authoritative Party
ID is6d575d28-3d21-40eb-ae94-edf6e916269a; separate exact-ID read confirms the expected
masked example.invalid email and primary flag. Repeating the same name showed
masked duplicate review; Use this profile selected that same ID. A separate search
confirmed exactly one matching QA profile, not a second creation. Find current
offers returned two current offers. No reservation commit was submitted.

In an existing stay, Guests & shares → Manage → Create → duplicate Use this profile
offered separate Add as accompanying/Add as sharer controls; nothing was silently
attached or saved. Root closed the editor without changing the allocation.

First mounted390px check found Cancel clipped (43.5px width,63px content). Builder
corrected nonshrinking button width, then independent review caught a CSS specificity
error that still made it dark. Final quiet-selector correction passed reviewer-run
18/0/105 focused proof. Root public320/390px recheck measured Cancel76.8x44px,
transparent background and no guest-form horizontal overflow. Name fields reserve
48px for44px microphones. No actual microphone recording was attempted.

Final app-only imagef04a548a4f1672e110ab64e3f6b25686cb5cac9892fb1cd96e32dd10772791ca
serves JSindex-Cht78Y-A.js and reservation CSSReservationWorkspace-B8pTJq-K.css.
Root final Vite545-module build passed. Local/public health200, healthy container,
migration ledger101 unchanged. Prior708 retained as before-orders709-710; DB,
Valkey and tunnel were not recreated. Current public URL remains temporary:
https://faq-lift-iso-completely.trycloudflare.com/; localhttp://localhost:3010/.

Live real transport/profile creation was tested by root, not a fresh real-PG Party
fixture suite. Fault injection/controller cases were automated, not induced in the
live app. Physical-phone audio/touch, full booking commit and guest-allocation save
are outside this receipt's new proof. Inherited ready503/build_revision_unavailable
and ecosystem incompleteness remain. No commit/PR/merge or provider activation.
