# Independent review — Order 178 India and Canada scenario foundations

**Verdict:** CHANGES REQUIRED — D-457
**Reviewed tip:** `2dfca4663b0a1b81faf6656f72d721f26b1feba6`
**Product candidate:** `2dfca4663b0a1b81faf6656f72d721f26b1feba6`
**Base:** `f90165d` (independently approved Order177)
**Reviewer:** independent non-implementing OpenAI Codex
**Date:** 2026-08-26

## Finding

### F1 — Valid IANA zones are not bound to the manifest jurisdiction

`validateScenarioManifest()` validates that a timezone exists in ICU but does not
bind it to the selected country. Fresh hostile probes changed only the property
timezone and proved that both of these invalid combinations are accepted:

- country `IN`, currency `INR`, timezone `America/Toronto`;
- country `CA`, currency `CAD`, timezone `Asia/Kolkata`.

That contradicts D-456 and Required foundation 1, which require the Indian scenario
to use `Asia/Kolkata` and the Canadian scenario to use a Canadian IANA timezone. It
also lets an otherwise closed source claim jurisdiction-local civil inputs under an
unrelated timezone.

Bind country, currency and timezone coherently during manifest validation. India
must require exact `Asia/Kolkata`; Canada must reject zones outside the bounded
Canadian scenario contract. Add permanent hostile tests using valid IANA zones from
the wrong country, then submit a new immutable candidate for a complete independent
restart.

## Reviewer-executed evidence

- exact Base-to-candidate scope contains only the eight Order178-permitted files and
  `git diff --check` passed;
- focused tests passed **7/7 (82 assertions)**;
- standing tests passed **230/230 (2,821 assertions)** with 480 database opt-ins
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
- the disposable output directory was removed completely. No Docker service or local
  app was started, and ports 3000/3002 were not touched.

No approval, merge, push, promotion, deployment or Phase-wide completion authority
is granted.
