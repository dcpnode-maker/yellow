# Independent launch contract review — 9ff

Review scope: read-only review of `LAPTOP_RECEIVING_AND_HOSTING_CONTRACT.md` and `LAUNCH_SPEC_9FF.json` against immutable cloud source `9ff27ad8765dc75ebae9e083d4635c7a9b89fa62` at tree `4311a79c0c9ffc33877809162b1b38ae1b3c944a`. No source or review-target documents were changed. Immutable source was read; no database, container, connector, network configuration, credential value, or laptop data was accessed. This review did not inspect OCI bytes; root separately reports its image proof and effective Docker command.

## Findings

**F1 — Worker flags are named but their selected states are unspecified (medium).** `LAUNCH_SPEC_9FF.json` names six controller-selected flags at lines 32–39, but provides no on/off values for them in `nonsecret_environment` (lines 16–26) or elsewhere. `src/server.ts` gates each on both `YELLOW_OPERATOR_WORKBENCH === "1"` and its own flag being exactly `"1"`: `YELLOW_HOLD_EXPIRY_WORKER`, `YELLOW_AVAILABILITY_PROJECTION_WORKER`, `YELLOW_PICKUP_TASK_WORKER`, `YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER`, `YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER`, and `YELLOW_BUSINESS_DAY_ROLL_WORKER`. As specified, with these variables absent, those six workers remain off. The fiscal worker is explicitly off in the spec; if enabled, source also requires a verified provider adapter or startup throws. Make intended states explicit before treating this as an exact worker launch contract. The contract correctly says to drain old owners and establishes a single owner; it does not itself prove a successful worker cycle.

**F2 — Runtime role contract omits a required connection limit (low).** The role table at contract line 67 lists the `yellow_runtime` login/password and privilege boundary but omits `rolconnlimit = -1`, which migration `0015_runtime_database_authority.sql` requires along with those listed attributes. The registrar row at line 69 captures LOGIN, limit 4 and nonprivileged status; migration 0018 also requires a password, zero role memberships, and ownership of no database objects. These are documentation completeness gaps in a section introduced as the existing role contract. They do not show a configured database role is currently wrong; no database was inspected.

**N1 — “Disable public demo” is broader than the source switch.** The launch spec sets `YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN=0` and `YELLOW_LOCAL_REVIEW_PREFILL=0`, which disables the environment-gated automatic synthetic login/prefill. The server still sets `publicOperatorSurface: "yellow-next"` and the app serves the UI shell; that is not automatic demo authentication. The proposed Access gate protects the whole Workers route, but this review did not verify Access configuration. Phrase the contract as automatic demo login disabled unless the intention is to remove the public shell, which has no corresponding server flag.

## Source checks that passed

- Image command and application command agree: `Dockerfile` runtime CMD is `bun run start`; `package.json` maps `start` to `bun src/server.ts`. The reviewed spec records the root-inspected image Entrypoint and that CMD. No server/container was started.
- The corrected `YELLOW_OPERATOR_WORKBENCH=1`, `HOST=0.0.0.0`, `PORT=3000`, and `YELLOW_OPERATOR_ALLOW_NON_LOOPBACK=1` match `src/server.ts`: workbench mode is enabled, nonloopback bind requires the allow flag, and the published host side is loopback-only in the spec.
- In workbench mode, `src/server.ts` requires `YELLOW_RUNTIME_DATABASE_URL`, `YELLOW_EXTENSION_REGISTRAR_DATABASE_URL`, and `YELLOW_TOKEN_SECRET`. It validates a PostgreSQL URL with username exactly `yellow_extension_registrar`, nonempty password, and no fragment; it builds separate runtime and registrar pools. The spec supplies all three names without values. No credential value was read.
- `YELLOW_LOCAL_REVIEW_PREFILL=0`, `YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN=0`, `YELLOW_HOSTED_DEPOSIT_WORKBENCH=0`, `YELLOW_HOSTED_PROVIDER_ONLY=0`, and `YELLOW_FISCAL_SUBMISSION_WORKER=0` match source gates and leave those modes disabled.
- Migration 0015 source requires `yellow_deploy` direct LOGIN/SUPERUSER session and database ownership for that migration; it requires `yellow_owner` to be NOLOGIN/limit 0/no password/nonprivileged; `yellow_runtime` LOGIN/limit -1/password/nonprivileged; and `app_role` NOLOGIN/limit 0/no password/nonprivileged. Migration 0018 requires registrar LOGIN/limit 4/password/nonprivileged, no role membership, and no owned database objects. These are role-definition requirements, not evidence of live role attributes.
- The metadata/frontier wording is accurate. `CURRENT_MIGRATION_FRONTIER` is 100. `assertRuntimeReleaseReadiness` checks for the existence of `public.schema_migration` and its release catalogue/authority predicates; it does not compare an exact applied row count or prove an applied frontier of 103. The docs/spec explicitly distinguish cloud-tested 100, laptop-reported source 103, unknown laptop applied frontier, and the required independent ledger/schema proof.
- The route, connector binding, external authenticated test, integrated laptop image, runtime lifetime, and deletion recovery are marked proposed, unconfigured, unverified, or false. The text makes no verified public-live, stable-lifetime, or successful-restore claim. Restart policy `unless-stopped` is explicitly proposed and untested.

## VPC citation status

The contract cites official Cloudflare Workers VPC pages for tunnel requirements, fixed HTTP services and API. This review did not fetch those pages: the task prohibited connector use, and no public-web result was obtained through an allowed tool. Therefore QUIC/outbound UDP 7844 (and the no-HTTP/2-substitute claim), no-custom-domain requirement, and beta pricing are **citation-only** in this review. The claim is recorded as a cited source assertion, not independently verified here.

## Proof and hashes

Read-only source commands used:

- `git -C /workspace/yellow-release rev-parse HEAD^{tree}` and `git -C /workspace/yellow-release status --porcelain` to confirm the inspected checkout identity/clean state.
- `sed -n '1,70p' Dockerfile`; `sed -n '1,65p' package.json` for image CMD and package start mapping.
- `sed -n '45,185p' src/server.ts`; `sed -n '285,405p' src/server.ts` and `rg -n 'YELLOW_OPERATOR_WORKBENCH|YELLOW_.*WORKER|...' src/server.ts` for startup flags, binds, required URLs and worker gates.
- `sed -n '1,90p' migrations/0015_runtime_database_authority.sql`; `sed -n '1,40p' migrations/0018_extension_type_registration_capability.sql` for role requirements.
- `rg -n 'CURRENT_MIGRATION_FRONTIER|schema_migration|assertRuntimeReleaseReadiness' src/kernel/build-info.ts` and source inspection of the readiness query.

The two reviewed root files had these SHA-256 values at review time:

- `LAPTOP_RECEIVING_AND_HOSTING_CONTRACT.md`: `2e988d98dfc1c866198f0201b13043dcd40123904ec146d81f5184cafd77a3a9`
- `LAUNCH_SPEC_9FF.json`: `8387ab0432891432030d2c29c5e6de7dbcaa959ccc20c8788681db48ed2e1bf8`

No edits were made to either reviewed file.


## Final recheck of root revisions

Re-read the current contract and launch spec after root's corrections. The prior findings are preserved above as history; the reviewed revisions address them:

- F1 is closed for the proposed initial launch: all six operational worker flags and the fiscal delivery flag are explicitly `0`. The spec says operational workers remain off until controller cutover, single ownership, exact final flag values, and startup/cursor/idempotency proof are recorded. Future worker enablement remains pending evidence, not claimed as running.
- F2 is closed: `yellow_runtime` now lists connection limit `-1`; the registrar row includes external password, nonprivileged boundary, connection limit `4`, zero memberships and no owned database objects, tied to migration 0018 catalogue checks.
- N1 is closed: the contract now says automatic demo login and prefill are disabled, explicitly says Yellow Next's UI shell remains served, and requires Access to protect shell and API together. Access deployment remains proposed and unverified.

No new source mismatch was found in the changed text. The full base/cloud source IDs and launch command remain consistent with the prior source review. The documents continue to make no applied-103, deployed-public-route, guaranteed-lifetime, or completed-restore claim. Workers VPC protocol, custom-domain and beta-price statements remain citation-only because official pages were not fetched under the no-connector instruction.

Final target hashes at recheck:

- `LAPTOP_RECEIVING_AND_HOSTING_CONTRACT.md`: `620931641ac868db0310babc7257d4c94894d3b9cf621a9b8cda936a05c611b9`
- `LAUNCH_SPEC_9FF.json`: `2f7a436b9e14f237bb0f0fa94d2c7b7a3286d6adc583dc4a30d679087d0898b1`
