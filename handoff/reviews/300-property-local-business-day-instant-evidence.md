# Order 300 fresh independent Tier-3 review

**Reviewer:** `/root/order300_fresh_review`, fresh non-implementing OpenAI Codex agent

**Candidate:** `bfdda8e20d321880a54fae09474d72a6558173c9`

**Approved base:** `0b90973`

**Result:** **CHANGES REQUIRED**

## Independence and inspection

I did not implement Order 300. I read `PROJECT.md`, `AGENTS.md`, ran `state.sh`,
read the mandatory PostgreSQL patterns, Order 300, D-820/D-821, the review roster
and workflow, then inspected ancestry, the exact three-commit range and every changed
path. The approved base is an ancestor, the worktree was clean and exactly at the
candidate, and the 15 changed paths stay inside the order's declared scope.

The production query uses the exact active same-tenant property and transaction-local
tenant context, reads its stored timezone, and asks PostgreSQL to convert local
calendar midnight and next-calendar-date midnight to UTC. Source and exact-range
inspection found no JavaScript Date/timezone conversion, host/process clock, fixed
24-hour arithmetic, extension containment/applicability decision, migration, schema,
dependency or write authority. The returned values are validated as canonical
six-digit UTC instants and the current candidate includes timezone and both instants
in both assignment and jurisdiction evidence hashes.

## Blocking finding: the permanent proof does not independently bind the upper instant

Order 300 P4 and D-820 require a timezone change **or either bound independently** to
change both evidence references. The committed test changes `propertyTimezone` and
`businessDayFromInstant` together, and never changes `businessDayToInstant`.

I temporarily removed `businessDayToInstant` from both the assignment and jurisdiction
hash payloads, leaving the result field and all other production behavior unchanged.
The complete committed Order 300 focused proof still passed **13/0 with 5 expected
database skips and 79 assertions**. I restored the exact candidate bytes afterwards.
Thus a regression that silently drops the upper instant from both hashes is not caught,
and the pre-registered proof claim in D-821 is not reproducible.

Required repair: add permanent equality-based assertions that vary only one envelope
field at a time and prove both `assignment.evidenceRef` and
`jurisdiction.evidenceRef` change for (1) timezone only, (2) lower instant only and
(3) upper instant only. Rerun the focused/live/standing/static/setup gates and request
a fresh independent Tier-3 rereview.

## Reviewer-executed evidence

- Fresh isolated WSL Docker Compose project `yellow-order300-review-0831`, dedicated
  ports, applied all **59 migrations**, produced exactly **110 public tables**, and
  passed referee **11 passed / 0 failed of 11**.
- Required live PostgreSQL resolver proof passed **13/0 with 70 assertions**. It proves
  exact UTC, Kolkata, New York 23-hour and 25-hour dates, Kathmandu, missing/foreign
  property concealment, malformed stored evidence rejection, stable frozen evidence,
  contained adapter authority and zero writes.
- Full standing passed **1058/0**, with 882 expected database skips, 16,069 assertions
  and 1,940 tests across 345 files. TypeScript, 120-file boundaries, 23-package licence
  policy, dependency audit and exact-range whitespace are green.
- Static inspection confirms canonical `YYYY-MM-DDTHH:MM:SS.ffffffZ` validation and
  SHA-256 evidence references. No JS timezone/clock/fixed-24-hour or extension-
  applicability inference exists.
- The disposable mutation was exactly restored; only this review and append-only
  governance records remain. The isolated review stack is removed after recording.

## Verdict

Exact candidate `bfdda8e20d321880a54fae09474d72a6558173c9` is **CHANGES
REQUIRED** solely because the non-waivable permanent proof does not catch loss of the
business-day upper instant from either evidence hash. The final Order 300 DoD checkbox
remains unchecked. No applicability, section 14, tax calculation, fiscal, API/UI,
local, integration, merge, deployment, Phase-complete or application-complete
authority is granted.

