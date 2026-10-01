# Published property guest booking — laptop receiving packet

Base7b64ede37a4ded1ffe2e77295f2d3e95b30442be, reviewed PR100 invitation/context
successor. Laptop remains source/controller/public host. This packet adds the
staff-published anonymous booking backend; no cloud/laptop runtime promotion.

Contract docs/contracts/PUBLIC-BOOKING-SITE-20261002.md contains exact request/
response shapes and proposed route map for the original-design guest page.
Guest start supplies canonical property name/timezone before date construction;
full offers supplies canonical unit/type/plan names. Tokens stay memory/Bearer,
not URLs/query parameters/logs. No new guest role or staff-auth substitution.

Canonical105 file migrations/0105_public_booking_site.sql:
SHA256 be9931b96bd6fb3ae06969c956c7050d8aaa8d44199ea0b8990daa02a3522585.
Immutable104 SHA2564c41dc4765ecbfe705999c5d5980ea482579403bdc681e468669fd3021c6be4a.
105 adds no table or runtime DML grant. Versioned explicit staff publication,
reserved-key guard, runtime-only published directory and current issuer/site
checks preserve tenant/RLS/canonical writes. Domain takes existing rate/quote/
publication/hold/complete-tax/profile/commit/idempotency/event service ports.
Public purposes are distinct from invitation/staff credentials.

App/server hunk ONLY:
handoff/patches/BOOKING-20261002-public-site-app-server.patch.
Zero-context prepared against this pinned cloud basis; standalone check uses
`git apply --check --unidiff-zero`. Laptop manually reconciles the narrow import/
option/routes/composition/pool-lifecycle additions against its protected current
App/server cookie/auth source; never apply old line offsets blindly. No cloud
frontpage/auth/header/theme/ribbon edits. Existing invitation-context route hunk
is separate and must mount once, not twice. Runtime directory uses a managed
owned max2-connection yellow_runtime pool; its closer is registered with existing
ownSqlPool. Do not give this pool app_role/global read or deployment credentials.

Proof on owned disposable namespace ONLY:
- Independent prototype and fresh canonical105 PG18 suites15pass0fail115assertions.
- Current ledger105/checksums104+105/tables130 verified by independent reviewer.
- Strict completePG18 schema snapshot/check green, snapshotSHA256
  671994b96ccbe402e92d2110fba69f6c5d08b21b06dbdbabb87d39a363555efd.
- Canonical ./setup.sh --db-only11passed0failed.
- Combined focused75pass0fail762assertions; strict types and214boundaries.
- Independent mounted composition2pass0fail33assertions; assembled full types
  passed with exact canonical105 readiness fixtures. Reproduction and RED/green
  logs: handoff/proofs/BOOKING-20261002/mounted-composition/.
- Full standing2607pass1637explicitDB/environment-skips0fail45481assertions;
  native public15 cases and invitation13 cases separately ran with real PG flags.
  Owned subreaper reaped113 proof descendants; no unrelated process termination.
- Review handoff/reviews/BOOKING-20261002-public-site-flow.md;
  sanitized proof records handoff/receipts/BOOKING-20261002-public-site/.

Receiving order: fetch immutable publication; reconcile reviewed PR100/invitation
context first; preserve applied101–104 ledger bytes; assess/apply105 through the
canonical deploy runner only after laptop review; retain strict schema/frontier
and release/readiness105 closures; integrate isolated App/server hooks into current
normal-auth source; build guest page on exact DTOs and run external actual guest
journey, origin/session/tenant/property/withdraw/revoke/replay/last-unit acceptance.
Use laptop-owned selected source closure; no whole dirty checkout replacement.
All105 application here is owned/disposable proof; no serving/laptop/production
DB received105 and no business dataset was copied/seeded/reset.

Limitations: no payments/card/provider activation, marketing/referral pipeline,
confirmed external tax/provider data, full storefront frontend or public admission.
Canonical duplicate-review gate prevents attaching prior guest identity from
self-asserted contacts; returning/duplicate profiles need authorized staff help.
Process-local30/min budgets are initial bounds, not distributed abuse protection.
Property check-in/out clock defaults are unproved and are not invented.
Actual proxy-host Origin comparison must be tested at laptop's fixed public host;
no untrusted forwarded-header inference or wildcard-Origin relaxation is allowed.

Next operational gap recorded in the original module inventory: CRM enquiry →
versioned group-price/displacement draft → revenue-manager approval → explicit
higher-authorized escalation. These commands/approval routing are not claimed
implemented by this booking packet; controller must choose their exact source/order.
