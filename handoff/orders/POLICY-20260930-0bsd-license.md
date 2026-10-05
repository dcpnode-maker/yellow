# POLICY-20260930 — Founder-approved0BSD dependency policy

Status: explicitly authorized legal/business policy decision. Founder selected
“Include0BSD (Recommended)” in the policy question after the concrete one-line
proposal,17/0/40 policy tests and67-package zero-failure proposal audit were
reviewable. Approval applies to this SPDX identifier only; no dependency or
license-discovery bypass is authorized.

Basis: `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`.
Branch: `phase-7/license-0bsd-policy-20260930`.

## Scope and acceptance

- `scripts/license-check.ts`: add only the exact SPDX identifier `0BSD` to the
  existing explicit allowlist; retain parser, SPDX AND/OR, exception handling and
  manifest discovery. No package-specific exemption or forged metadata.
- `tests/license-check.test.ts`: add precise approval/conjunction/exception
  regression while preserving every existing policy assertion.
- This order; NEW `handoff/reviews/POLICY-20260930-0bsd-license.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md` authorization/proof records.

No package/lockfile/dependency version change, source domain/HTTP/UI/migration,
global seed, deployment, payment, credential or other license policy change.

Independent bounded reviewer personally executes the policy suite and actual
installed-package audit (not empty/symlink-skipped package discovery), verifies
forbidden/unknown/malformed licenses still fail, checks exact scope/full staged
whitespace. Canonical unchanged setup11/11 precedes any reviewable PR. Record
the primary SPDX source https://spdx.org/licenses/0BSD.html and founder decision.
Other standing/PMS/live-integration gates remain independent; this policy repair
does not make Yellow release GREEN, merge/deploy or prove phase completion.
