# CONTRACTS.md — API conventions + the interfaces that must not drift

## 1. Conventions (every endpoint)
Base `/api/v1`. Auth: bearer (staff JWT w/ tenant+scopes | api_client). Server derives
`tenant_id` from the token — never from the body. JSON: money `{amount_minor,currency}`,
instants ISO-8601 with offset, stay periods `{from,to}` half-open, ids uuid.
**Idempotency-Key header required on every mutating POST**; the kernel stores
tenant+operation+key-hash → canonical request-hash+exact successful JSON response for
24 h in the command transaction. Exact retries replay; changed requests conflict.
Errors: `{type,title,status,detail,errors?[],correlation_id}` with stable `type`
slugs (`availability/no_fit`, `finance/journal_unbalanced`, `auth/scope_missing`,
`conflict/occupancy`, …). Pagination: cursor `?after=<opaque>&limit≤200`. Filtering:
whitelisted params only. Every response carries `X-Correlation-Id`.

## 2. THE availability contract (the interface everything hangs off)

`POST /api/v1/properties/{node}/availability:search`
```json
{ "stay": {"from":"2026-09-01","to":"2026-09-04"},
  "party": {"adults":2,"children":[{"age":6}]},
  "unit_types": ["DLX"]?, "rate_plans": ["BAR"]?,
  "attributes": {"gender_policy":"female"}?,        // hot-column predicates only
  "channel": "direct", "currency": "AED"? }
```
→ options[]: `{unit_type, rate_plan, per_night:[{date,amount_minor}], total, taxes[],
policies{cancellation,deposit,guarantee}, restrictions_applied[], available_count}`.
Served from projection (+Valkey). **Never a promise** — truth is the commit below.

`POST /availability:hold` {option_ref | unit_type+stay, ttl_s≤900} → `{hold_id,expires_at}`
(writes occupancy via choke; this IS the arbitration).

Transitional authenticated operator surface for preparing degraded operation:
`GET|POST /api/v1/properties/{node}/offline-leases` and
`POST /api/v1/properties/{node}/offline-leases/{id}/release`. Placement accepts one exact
currently bookable sellable id, UTC `[from,to)`, stable device id, optional non-guest device
label, and an explicit integer `leaseHours` from 1–168. PostgreSQL derives expiry and the
existing hold/occupancy lifecycle arbitrates. This reserves capacity only: offline reservation
creation, lease consumption, device authentication during sync, and conflict resolution remain
future reservation/PWA contracts.

`POST /reservations:commit` {hold_id? | direct option, guest{party|inline}, payment{...},
idempotency} → 201 reservation | 409 `conflict/occupancy` (someone won the race) |
Positional (bed) claims: on exclusion violation the server retries the next free
position, max 3 attempts, THEN returns 409 — losers of a bed race don't fail while
other beds remain free. Exclusive claims never retry (the space is simply taken). |
422 policy/payment. Direct commit without hold attempts the choke write inside the txn.

## 3. Module surfaces (names are the contract; bodies follow §1 shapes)

**reservations**: create/commit · get · modify (diff-based) · cancel · reinstate ·
check_in {segment,space?,keys?} · check_out {settlements[]} · move {to_space} ·
extend/shorten · group: create/status/allotment/rooming_list(bulk)
**financials**: postCharge {folio,tx_code,amount,qty} · transfer {lines[],to_folio|account} ·
adjust {reverses_line,reason} · settle {folio,method,instrument?,amount} ·
routeRules→Automation CRUD · folio: open_window/get/statement · deposits: request/apply ·
cashier: open/close · day: readiness/seal · ar: invoice(from folio)/allocate/statement
**inventory**: spaces/unit_types/sellable_units CRUD · restrictions batch ·
ooo/oos open+close · authority get/set · projection rebuild (admin)
**rates**: plans CRUD · prices batch-insert (insert-only; supersede) · packages · policies
**hk/stay**: condition set · tasks CRUD/assign/complete/verify · sheets generate ·
discrepancies · queue · messages send/thread
**profiles**: parties search(trgm)/create/merge/anonymise · consent · instruments(tokenize via PSP webhook)
**distribution**: channels connect · maps CRUD · inbound replay {id} · push status/cursors
**compliance**: documents issue/get/render · fiscal submit/status · statutory list_due/submit ·
erasure request/execute
**kernel**: extensions CRUD+activate · automations CRUD+test(dry_run) · approvals decide

## 4. Internal context interfaces (in-process, typed)
Each context exports ONLY: `queries` (pure reads), `commands` (Tx-taking, return Result),
`events` it emits. Anything else is private. The MCP server (v3 §10) is generated from
these same command/query surfaces — no privileged path.

## 5. Payment provider port
`PaymentProvider`: createToken(hostedSession) · authorize {instrument,amount,capture:'auto'|'manual',
lodging{checkin,checkout,folio_ref}} · incrementalAuth · capture · refund · void ·
webhook(verify,normalize→payment rows). Implement: `upi` (zero-MDR), `card:<psp>`.

## 6. Automation condition/action AST
condition: `{all:[...]}|{any:[...]}|{not:...}|{path,"op":eq|neq|gt|gte|lt|lte|in|contains,"value"}`
paths address event payload + subject snapshot. action: `{type, ...typed fields}` per
EXTENSIONS.md §automation-actions. Engine executes inside a NEW journal-owning txn.

## 7. FiscalDocumentProvider port (five mandate patterns — v2 §6.1)
prepare(document)→jurisdiction payload (UBL/PINT/IRP-JSON) · submit(payload)→
{mode, authority_ref?, status} · poll(ref) · qr(document) · chain(document,prev_hash).
Implement: `sa-zatca` (clearance, XAdES, PIH chain, TLV QR) · `in-irp` (IRN+signed QR) ·
`ae-asp:<provider>` (PINT AE generate + hand-off; ASP does transmission — UAE law).
