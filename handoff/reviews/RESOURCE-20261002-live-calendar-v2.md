# Independent Calendar v2 source acceptance

Reviewer: Astra chat 01a0fc8e-461e-71b3-8c5e-aa2784db1ed3. Implementer/integrator: laptop Codex. Review completed 2026-10-02; no reviewer edits. Order: RESOURCE-20261002-live-calendar-and-ecosystem-plan.md, base93bf7f94ce36bbe67404853661ed40f641b5db01.

Accepted exact seven-file manifest source-freeze-v2.json SHA256 ec8f39291580b79ff78669d7fe07a38175065e698b3daab7e123e4f83128039f under hosting/live-calendar-release-v1. All7 files matched before/after the reviewer personally executed checks. The original source-freeze.json and failed findings remain preserved.

Initial review found two blockers: shared midnight conversion selected the prior Santiago date and shortened the range, omitting a stay; invalid timezone threw during component initialization. V2 uses a dedicated Calendar civil-day boundary finder, leaves shared reservation-creation conversion unchanged, catches invalid initialization, disables Today and displays an explicit error.

Reviewer personally executed seven-file Calendar/navigation/session battery:42 passed,0 failed,319 assertions. Separate probes passed actual-component Santiago range including previously omitted stay; ambiguous midnight selects first occurrence; skipped civil date disables querying; installed QueryObserver aborts obsolete range and suppresses its late result; invalid-timezone rendering is explicit with Today disabled. No blocking source finding remains.

Readonly release-helper comparison: SHA256 bafa12f95c345c973b77963dd49f372f22972e66f11deac21c9d65064e4bf166, only declared predecessor/prefix/PID substitutions against previously reviewed smooth-navigation helper. Current predecessor manifest and22 asset hashes independently matched. App11228, watcher4776, PG2124, connector7876 and current owner380624beab12f3ad2ab0d224fa82b2cbca314be11ee4559ad037b87a426d381b were retained for exact-owner admission.

Acceptance is bounded source acceptance, not deployed/browser/touch proof, room allocation or sellability. Root must build and verify successor source/assets, public readiness, unchanged auth and authorized board reads before recording live admission. Preserve predecessor runtime/private config and rollback evidence. Wider ecosystem stages remain explicit in docs/LIVE-ECOSYSTEM-20261002.md.
