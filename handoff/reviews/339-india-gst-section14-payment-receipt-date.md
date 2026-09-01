# Order 339 fresh independent Tier3 executable review

**Disposition:** WITHHOLD — permanent-proof sensitivity

**Reviewer:** `/root/order335_fresh_rereview`, fresh independent non-implementing
Tier3 reviewer

**Implementation:** `ea190dd`

**Governance reviewed:** `ede6749`

**Approved base:** `3f91134`

**Intentional red:** `7dc6339`

## Finding

**P1 — returned calendar source lineage is not mutation-bound by permanent proof.**

The implementation correctly returns `calendar.authorityId` and
`calendar.sourceDigestSha256`, but replacing the returned digest with an unrelated
64-character constant survives all permanent Order339 tests. The existing final-hash
assertion recomputes SHA-256 from the mutant's own returned body, so it proves internal
self-consistency rather than equality to the rederived Order338 source lineage.

Required repair: permanently assert that both returned `calendarAuthorityId` and
`calendarSourceDigestSha256` exactly equal the supplied-and-rederived Order338 result
and governed calendar input. Include a hostile source mutation that retains all dates,
branches and final self-hashing but substitutes one or both returned source fields.

Removing the explicit `working_day_calendar_required` guard also survives the current
test. The current non-calendar negative uses a bank date outside the Order338 calendar,
so the later coverage check rejects it independently. With valid Order302 and Order338
ancestry, bank coverage after the rate-change date appears to make the explicit guard
behaviorally redundant. The repair should either pin the required guard structurally/
semantically or document and executable-prove that redundancy without weakening the
order's explicit contract.

## Official statutory semantics

CBIC's official CGST Act section14 states that receipt ordinarily means the earlier of
supplier-books entry and bank credit, with bank credit substituted when that credit is
after four working days from the rate change. Candidate production matches this:
bank on/before the established fourth working date uses ordinary earlier-of, while
only strict `bankDate > fourthWorkingDayDate` substitutes bank. It does not infer
weekends, holidays, locale, timezone or current time.

## Source, ancestry and containment

The exact nine-field composer reruns Order307 from the complete rate-version pair,
Order302 from books/bank and the derived change date, and Order338 from tenant,
through-date and complete governed calendar input. Each supplied result must be
deeply frozen and insertion-byte equal. Calendar bank-date coverage, exact input
shape, hostile graph rejection and tenant-hidden final hashing are present.

Strict ancestry `3f91134 -> 7dc6339 -> ea190dd -> ede6749` passes. The bounded diff
contains only the admitted pure module/export, two proofs, docs and governance; no
migration,SQL,seed,role,writer,dependency,Compose,API/UI or runtime path changed.

## Reviewer mutation results

- Killed: `>=` instead of strict `>`; always-bank; always-earlier; missing coverage;
  ignoring Order307,Order302 or Order338 supplied-result replay; omitting tenant from
  the final hash.
- Survived: unrelated returned calendar source digest; removed explicit
  calendar-required-state guard for the redundancy reason above.

## Personally executed gates

- Focused Orders302/307/338/339: **26 pass,0 fail,233 assertions**.
- Standing: **1169 pass,0 fail,890 expected skips,17686 assertions**,2059 tests
  across380 files.
- TypeScript passed; import boundaries passed for130 files; licence policy passed
  for23 packages; audit found0 vulnerabilities; ancestry,scope and diff hygiene pass.
- `.yellow`,port3000,containers,database/data,credentials and stable local were never
  touched. No product source or permanent test was edited.

## Boundary

**WITHHOLD** exact candidate `ea190dd` on proof completeness only. This grants no
section14 applicability/six-case matrix,rate,value,amount,rounding,posting,correction,
document,IRP,API/UI/local,merge,push,deployment or downstream authority.
