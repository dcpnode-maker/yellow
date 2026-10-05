# Order 547 — Order546 public frontend promotion

## Objective

Package the independently accepted Order546 continuity source into Yellow's tracked
production frontend assets and promote only the public application container.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/public/yellow-next/index.html`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/public/yellow-next/assets/*`
- `handoff/reviews/547-order546-public-frontend-promotion.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Build only the Order546 source accepted in Review546 through the existing Vite
   production configuration. Generated HTML references the resulting hashed bundle.
2. Recreate only the existing `yellow-public-demo` app service using the protected
   environment file. PostgreSQL, Valkey and tunnel services remain untouched.
3. Local and public health return HTTP 200. The public hashed bundle contains the
   accepted check-in guest-conversation continuity contract.
4. Root verifies a proposal-only named-arrival guest interaction on the public app at
   desktop and 375px without confirming a write. The check-in journey remains visible,
   proposal cancellation retains it, and the Yellow activation field remains
   procedural neon light with no image, canvas or video element.

## Exclusions

- No database, seed, provider, environment, tunnel, schema, migration, dependency,
  source or public data mutation.
- No claim of whole-PMS completion or native streaming voice acceptance.

## Verification

- Review546 exact accepted hashes before build.
- Production build output and asset reference.
- Container identity/status and local/public health.
- Public bundle receipt and desktop/375px non-mutating browser proof.
