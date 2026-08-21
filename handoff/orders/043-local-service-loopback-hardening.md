# Order 043 — Local service loopback hardening

**Phase:** 2 · Local review safety
**Branch:** `phase-2/local-service-loopback-hardening`
**Tier:** 2 — development composition hardening
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Keep the local founder-review application usable while preventing PostgreSQL and
Valkey from being published to every host network interface by default.

## Scope

- `DECISIONS.log`
- `handoff/orders/043-local-service-loopback-hardening.md`
- `handoff/LEDGER.md`
- `docker-compose.yml`

## Required behavior

1. Bind the PostgreSQL published port to explicit IPv4 loopback while preserving
   `YELLOW_POSTGRES_PORT` and its existing default.
2. Bind the Valkey published port to explicit IPv4 loopback while preserving
   `YELLOW_VALKEY_PORT` and its existing default.
3. Do not change container ports, service discovery, images, credentials, health
   checks, volumes, application binding, or runtime behavior.

## Forbidden

- Any application, migration, test, invariant-referee, dependency, workflow, or
  production-deployment change.
- Removing host access, hard-coding proof ports, changing credentials, exposing a
  service publicly, self-approval, or merge.

## Pre-registered proofs

- **P1 (red):** before the change, rendered Compose configuration reports omitted
  host IPs for PostgreSQL and Valkey while the app reports `127.0.0.1`.
- **P2:** rendered configuration with non-default host ports reports exactly
  `127.0.0.1:<override>` to the unchanged container port for all three services.
- **P3:** an isolated Compose project starts PostgreSQL and Valkey healthy, Docker
  reports loopback-only published bindings, and both overridden ports accept local
  connections.
- **P4:** standing typecheck, boundaries, tests, licence/audit, schema drift, and
  `./setup.sh --db-only` remain green.

## Standing checks

Run P2 and P3 on isolated non-default ports, then restart the full standing self-check
from the top. Refresh the live local review stack from this branch, verify its app,
PostgreSQL, and Valkey ports are loopback-only, refresh Graphify, commit, push, and
open a draft descendant PR. Do not approve or merge.
