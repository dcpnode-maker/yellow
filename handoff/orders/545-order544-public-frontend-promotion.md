# Order 545 — Order544 public frontend promotion

## Objective

Package the independently accepted Order544 source into Yellow's tracked production
frontend assets and promote only the public application container.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/public/yellow-next/index.html`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/public/yellow-next/assets/*`
- `handoff/reviews/545-order544-public-frontend-promotion.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Build only the accepted Order544 frozen source through the existing Vite production
   configuration. Generated HTML must reference the new hashed application bundle.
2. Recreate only the existing `yellow-public-demo` app service using the protected
   environment file. PostgreSQL, Valkey and tunnel services remain untouched.
3. Local and public health return HTTP 200. The public hashed bundle contains the
   accepted conversational guest-allocation contract.
4. Root verifies proposal-only behaviour on desktop and 375px public browser without
   confirming or mutating public guest data; neon remains procedural and image-free.

## Exclusions

- No database, seed, provider, environment, tunnel, schema, migration, source,
  dependency or public data mutation.
- No claim of whole-PMS completion.

## Verification

- Production build output and asset reference.
- Container identity/status and local/public health.
- Public bundle string receipt and desktop/375px browser proof.
