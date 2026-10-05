# Order 490 — Commercial configuration preflight and full price-JSON integrity

## Objective

Resolve both Order 489 independent-review release blockers without changing rate
authority: a replay must detect renamed/missing canonical policy rows before *any*
create command, and current price JSONB must be proven complete at the stored
PostgreSQL boundary rather than relying on a decoder that ignores unknown fields.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/scripts/provision-colleague-commercial-configuration.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/colleague-current-date-scenario.test.ts`
- `handoff/reviews/490-commercial-configuration-preflight-and-pricing-json-integrity.md`

## Required behaviour

- Before creating the four named policies, use existing immutable policy-created fact
  provenance to distinguish a clean unconfigured scenario from renamed/deleted/drifted
  canonical policies. If canonical provenance exists but rows are absent or altered,
  fail before any service write, fact, or outbox record.
- Retain service-owned policy/rate-plan/rate-price writes only; do not repair drift by
  creating replacements and do not update BAR or any insert-only rate row.
- Check each current `rate_price.pricing` JSONB document against a canonical JSONB
  object generated from bigint-safe source values. The comparison must reject extra
  top-level or nested keys, explicit nulls where absent is canonical, missing keys,
  quoted numeric values, and altered amounts before replay returns success.
- Expand the disposable PostgreSQL proof to assert no additional policy/fact/outbox
  rows after renamed-all-policy drift, and reject unknown and explicit-null pricing
  shapes with no write.

## Exclusions

- No migration, schema/ACL/role change, public deployment, rate publication, financial
  posting, new data source, real data, or direct production DML.

## Required verification

- Fresh isolated PostgreSQL 16 migration/seed/review-seed proof, strict TypeScript,
  focused hostile replay test and a new independent reviewer-executed proof before
  any public deployment decision.
