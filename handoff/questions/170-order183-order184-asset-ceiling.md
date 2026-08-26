# Question 170 — Order183/184 combined operator asset ceiling

**Status:** OPEN — hard-floor assertion failure
**Order:** 183 resumed on independently approved Order184
**Raised by:** Codex integration owner
**Date:** 2026-08-26

## Stop

The exact approved Order184 operator assets total 97,940 bytes gzip under the independent
reviewer and remain below the explicit 98,304-byte ceiling. Replaying the paused Order183
correction work onto that approved base makes the same combined HTML/CSS/JavaScript
assertion execute at 99,960 bytes gzip. The registered assertion therefore fails by
1,656 bytes. `handoff/ROADMAP.md` defines any executed pre-registered proof failure as a
hard floor: do not weaken the assertion and stop the phase.

No financial database proof, migration, local promotion or live-data mutation has been
run from this resumed candidate. The sole approved Order184 app on loopback3000 remains
unchanged and healthy.

## Recommended resolution

Keep both product requirements exact and keep the 96 KiB ceiling exact. Authorize a
bounded representation-only reduction inside the already scoped operator HTML/CSS/JS:
deduplicate repeated UI strings/selectors/helpers and remove mechanically redundant
presentation bytes without hiding a skin, removing correction disclosure, changing DOM
order, changing an API, minifying source into unreadability, adding a dependency or
raising the ceiling. Re-run the complete Order184 material/browser matrix and Order183
financial/UI proof after the combined assets are back at or below 98,304 bytes.

Rejected alternatives: raise the ceiling; delete or alias a skin; weaken the gzip test;
remove financial safety copy or correction states; externalize an asset/dependency; or
promote the unreviewed financial candidate.
