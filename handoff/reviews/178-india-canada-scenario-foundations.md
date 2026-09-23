# Final independent review — Order 178 India and Canada scenario foundations

**Verdict:** APPROVED — D-458
**Reviewed tip:** `4d72db248efdf0f6337b532121e1b7fd5e0d35eb`
**Product candidate:** `4d72db248efdf0f6337b532121e1b7fd5e0d35eb`
**Base:** `f90165d` (independently approved Order177)
**Reviewer:** independent non-implementing OpenAI Codex
**Date:** 2026-08-26

## D-457 closure

The corrected validator binds `IN` to exact `Asia/Kolkata` and `CA` to a bounded set
of Canadian IANA zones after syntactic IANA validation. Fresh hostile execution
rejected `IN`/`America/Toronto`, `CA`/`Asia/Kolkata`, valid-but-unsupported Canadian
`America/Whitehorse`, and non-Canadian `America/New_York`; supported
`CA`/`America/Vancouver` remained valid. The permanent D-457 regression covers both
cross-country swaps, an unsupported valid zone and a missing timezone.

## Reviewer-executed evidence

- exact Base-to-candidate scope contains only the nine Order178-permitted product,
  test and governance files and `git diff --check` passed;
- focused tests passed **8/8 (86 assertions)**;
- standing tests passed **231/231 (2,825 assertions)** with 480 database opt-ins
  skipped because Order178 requires no local stack;
- strict typecheck passed; import boundaries scanned **66** TypeScript files;
  licence policy passed **23** installed packages; `bun audit` found no vulnerability;
- fresh disposable materialisation produced India SHA-256
  `2124cd3d94a31fc79029e9016aabb22179fee1add09aecf086b5b3a8811a0d3e`
  and Canada SHA-256
  `f2ffaa95e21eece09ea81e713e1c94a9287cc9c45a4db7308021aa9215ce4339`;
- each payload contained exactly 1,096 unique local dates from 2024-01-01 through
  2026-12-31, including 2024-02-29 and all six named Toronto DST-transition dates;
- both capability envelopes remained `pending_policy` / `future_phase` with false
  database and imported-reservation authority; a second run reported both files
  unchanged; byte tampering exited nonzero with content-addressed drift;
- relative roots, normalized traversal and scenario-key escape probes rejected;
  a real Windows junction redirect also rejected before writing outside the root;
- every disposable output, link and outside-target directory was removed completely.
  No Docker service or local app was started, and ports 3000/3002 were not touched.

Approval is limited to Order178's deterministic offline fixture scope. It grants no
database import, legal/fiscal authority, runtime/local-app change, merge, push,
promotion, deployment or Phase-wide completion authority.

## Preserved prior rejection — D-457

Candidate `2dfca4663b0a1b81faf6656f72d721f26b1feba6` was rejected because its
validator accepted valid but cross-jurisdiction combinations: `IN`/`INR` with
`America/Toronto` and `CA`/`CAD` with `Asia/Kolkata`. Its otherwise-green evidence
was exact scope, focused 7/7 (82), standing 230/230 (2,821), typecheck, 66
boundaries, 23 licences, audit, two 1,096-date outputs, hashes, leap/Toronto-DST,
unchanged replay, hard-failing tamper and cleanup. That rejection remains immutable;
D-458 approves only the separately corrected candidate named above.
