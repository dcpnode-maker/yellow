# Review 419 — Public synthetic demo automatic entry

## Scope reviewed

The automatic synthetic-demo session boundary in the live source, including
`src/app.ts` and `tests/local-login-prefill.security.test.ts`.

## Independent reviewer

`/root/astra_review` (did not implement the change), 2026-09-19.

## Reviewer-executed proof

```powershell
bun test tests/local-login-prefill.security.test.ts
```

Result: 9 passed, 0 failed, 62 assertions.

The reviewer also executed an in-memory supplement covering disabled/missing entry,
credential-free public HTML, hostile request-body replacement resistance, and a
financial POST without identity returning 401.

## Finding

Narrow approval: automatic demo entry keeps process-scoped credentials out of the
browser request. The ordinary 900-second tenant-scoped token and existing endpoint
authorization remain in use.

## Retained limits

This does not approve the full Order 419 public-write sandbox. Before treating it as
complete, verify synthetic tenant/grants and independently execute browser proofs for
all exposed confirmation-gated mutations and audit outcomes. Source-based rate limits
must not be treated as trusted when the proxy peer is not verified.

## Proxy follow-up

The reviewer independently inspected `tools/public-demo-css-proxy.ts` after its
credential bridge was added and ran a mocked `bun -e` harness. It passed HTML secrecy,
hostile-input isolation, fixed loopback login destination and credential-free response
checks. The proxy was corrected to bind `127.0.0.1`, preserve the operator security
headers and use the pre-existing same-origin bootstrap script rather than inline code,
so the operator CSP remains effective.

The reviewer then independently exercised the in-memory demo-session cache using a
dummy Bun harness. It reuses only an unchanged token response before JWT `exp - 30s`,
does not trust an inflated `expiresInSeconds`, and refuses to cache error, malformed
or near-expiry responses. Disabling the environment entry or removing credentials
clears the cached entry and returns 404 immediately. The cache necessarily contains a
short-lived bearer token in process memory; it never contains the plaintext login
credentials and never serves it after the deadline.

## Follow-up independent boundary review

`/root/astra_review` completed a fresh read-only review on 2026-09-20 and ran:

```powershell
bun test tests/local-login-prefill.security.test.ts tests/local-login-abuse.test.ts tests/public-demo-proxy.intentional-red.test.ts
```

Result: **20 passed, 0 failed, 148 assertions**. Unauthenticated public root and
automatic-entry script requests returned `200` with `no-store`; the protected
properties endpoint returned `401`; no credential value was emitted; public
`operator.js` matched the inspected candidate SHA-256.

The review confirms the automatic session preserves ordinary role scopes; the legacy
`read-only` method name is not a mutation restriction. Order 419 is therefore still
unapproved: exact live token scopes/property grants, confirmation-to-domain/audit
correlation, replay and foreign-property denial, outbox evidence, and financial
invariant proof remain required. The reviewer also observed that served root HTML
lacks the automatic-demo marker injected by current proxy source. Refresh the proxy
through an approved local process operation before claiming source/serving parity.

## Read-only runtime grant evidence

On 2026-09-20, root queried the currently running synthetic PostgreSQL container
without changing data. `Yellow Review Operator` has the existing governed scopes for
reservation lifecycle and booking, Party reads/writes, check-in/check-out, folios,
cashiers, charges, inventory configuration/restrictions/blocks, rates, housekeeping,
vehicles, and related financial controls. Its current role grants cover only the four
synthetic review properties (`Yellow Demo Property`, `Harbourlight Test Lodge`,
`Riverstone Test Hotel`, and `Yellow Identity Gate Review Property`), all in the
synthetic demo tenant.

This confirms that public automatic entry can reach the same authorization boundary
as manual demo operation. It does not prove any mutation or authorize a claim of
per-visitor audit identity: the proxy deliberately reuses one short-lived synthetic
operator token, and Order 419 still requires an independently executed
confirmation-to-audit/outbox workflow proof.

## Root synthetic write evidence (awaiting independent reproduction)

On 2026-09-20 root used the public automatic-entry route and the already-proven
synthetic role to create one fictional Party without contacts. The canonical
property request returned `201`; an identical retry using the same idempotency key
returned `201` with `idempotency-replayed: true`; the same body sent to an ungranted
foreign property returned `403`.

Read-only database verification for the returned Party identifier found exactly one
Party row, one actor-bound `party.created` fact-log row, and one actor-bound
`party.created` outbox row. No real identity, contact, financial, reservation or
external-provider data was used. This is root's implementation/test evidence only;
it is not the required independent Order 419 proof.

## Independent synthetic Party workflow proof

On 2026-09-20 `/root/astra_review` independently executed the public automatic
demo workflow using a distinct fictional Party with no contacts. The canonical
create returned `201` with no replay flag; the identical request/key replay returned
`201` with `idempotency-replayed: true` and the same Party response. The same body
against an ungranted UUID selector returned `403 auth/property_forbidden` and created
no outbox row.

The reviewer then issued read-only PostgreSQL assertions. They proved exactly one
Party and zero contacts, exactly one `party.created` fact and one `party.created`
outbox event, each bound to the expected synthetic actor, tenant, property and
creation correlation. The final boolean assertions returned `t|t|t`.

This accepts one representative non-financial public write/replay/audit/outbox path.
It does not establish full Order 419 completion: the account is granted each of the
four existing synthetic properties, so an actual second-tenant/foreign-property
fixture was not available for an isolation proof; the UI/AI confirmation layer and
financial mutation paths retain their separate proof obligations.

## Fresh published-browser evidence

On 2026-09-20 root opened the current public Cloudflare URL in a clean in-app
browser session after the Docker service restart. No credentials were supplied. The
automatic entry transitioned to the property-scoped Today route and displayed the
authenticated synthetic `Yellow Review Operator`, the selected `Yellow Demo
Property`, the three synthetic due-ins (Aarav Mehta, Kavya Iyer and Rohan
Kulkarni), the synthetic due-out, the synthetic in-house stay, guest-profile
controls, check-in/checkout preparation controls, and the `Talk to Overwatch`
launcher. This is live UI evidence for automatic entry plus the focused Order 418
operational surface; it is root-executed smoke evidence, not an independent proof
of mutation, AI confirmation, browser voice permission, cross-tenant isolation or
financial invariants.

## Fresh phone and Overwatch smoke evidence

On 2026-09-20 root repeated the published public-demo smoke at an explicit
390x844 phone viewport. The page reported a 375px rendered client width with the
same 375px document scroll width and no browser warning or error output. The
focused Today workflow remained usable with its due-in, due-out, in-house,
reservation, guest-profile and operational-preparation controls visible.

Root opened Overwatch, chose Marathi, and received localized suggested prompts.
The localized arrivals prompt returned the three current synthetic live arrivals
and a live-PMS basis statement. The localized Aarav check-in preparation prompt
then navigated to the authoritative reservation check-in workbench and presented
`Check-in progress · ARR-CLEAN` with the explicit state: `No check-in has been
performed` and that Overwatch will not bypass room, folio or confirmation controls.
No confirmation was selected and no mutation was sent. This is root-executed mobile
and confirmation-preflight smoke evidence only; it is not an independent proof of
browser microphone permission, spoken-input recognition, a completed check-in,
financial mutation, isolation, or all Order 419 acceptance items.

## Fresh configured-property browser evidence

On 2026-09-20 root opened the public demo's live `Inventory setup` and `Rates`
surfaces without mutating data. `Yellow Demo Property` reported two configured room
types (`STD · Standard Room` and `DLX · Deluxe Room`), nine physical spaces across
floors and parking, and six sellable guest rooms. The same surface exposed the
audited, retry-safe guided sequence for room type, physical space and sellable-unit
creation, plus bounded bulk-room preview.

The public Rates surface displayed the intended guided hotel setup: property/market,
rooms/inventory, guest experience and policies, distribution scope, rate strategy,
then review/publish. Advanced direct policy, base-plan, price-row and correction
tools remained behind an explicit secondary disclosure rather than dominating the
default operating navigation. This is root-executed read-only browser smoke evidence
for the synthetic property configuration, not proof of every CRUD action, every
commercial model, external channel publishing, financial correctness or independent
Order 419 completion.
