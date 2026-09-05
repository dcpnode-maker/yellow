# Yellow release and local review

Yellow releases one exact source revision. A green branch, a merged commit, a
published image, a running local app and a cloud deployment are separate facts.

## Current release boundary

The repository can build and publish immutable application and migration images
after CI succeeds on `main`. It does not contain an approved cloud host, registry
promotion target, DNS name, TLS ingress or production credential. No public or
customer production deployment is claimed.

The intended first cloud environment is a private founder preview. Customer
production still requires the authentication, recovery, key rotation, backup,
restore and operational gates recorded in
[ARCHITECTURE-V1.md](ARCHITECTURE-V1.md) and [SECURITY.md](SECURITY.md).

## One current local app

On a supported Docker Engine/Compose environment with Bun 1.3.14, Python 3.12+
and `psycopg2-binary==2.9.12`, check out a clean reviewed `main` and run:

```bash
./scripts/local-review.sh
```

The launcher:

1. identifies the exact Git revision and refuses a dirty checkout;
2. creates protected, ignored local credentials when absent;
3. runs the canonical database setup and 11/11 invariant referee;
4. idempotently seeds the real tenant-scoped founder review data;
5. builds that revision into the local image and enables the implemented workers;
6. starts the sole loopback app at `http://127.0.0.1:3000`;
7. verifies readiness, embedded revision and real local login.

The operator password is stored in `.env.local-review`, mode 600, and is never
printed. Use the displayed `operator@yellow.local` identity. The file is ignored
by Git. Stop the stack while preserving its PostgreSQL volume with:

```bash
./scripts/local-review.sh stop
```

Check the running liveness/readiness receipt with:

```bash
./scripts/local-review.sh status
```

Update the local app only from a reviewed, clean `main` revision:

```bash
./scripts/local-review.sh stop
git switch main
git pull --ff-only
./scripts/local-review.sh
```

The final command reruns migrations, the 11/11 invariant referee, review seeding,
the image build, readiness and login proof for the new exact revision. Existing local
PostgreSQL data is retained; the review seed remains idempotent.

The local database contains synthetic review data. Never point this launcher at
a database or volume that contains hotel data to preserve.

## Immutable image publication

`.github/workflows/release.yml` runs only when the repository's `CI` workflow
finishes successfully for a push to `main`, with Windows state, quality, container,
database and supported local-review jobs all explicitly successful. It checks out
the exact successful SHA and publishes two amd64 images to GitHub Container Registry:

- `ghcr.io/dcpnode-maker/yellow:<sha>-amd64` — application runtime;
- `ghcr.io/dcpnode-maker/yellow:<sha>-migrations-amd64` — one-shot migration tool.

Both carry the OCI `org.opencontainers.image.revision` label and
`YELLOW_BUILD_SHA`. The application keeps `/health` as dependency-free process
liveness. `/ready` reports the exact revision and expected migration frontier 75,
and fails closed unless the revision is present and the runtime database role proves
the core catalogue and Order 439 issue-authority containment. It does not claim to
read the deployment-only migration ledger. Registry digests and the expected frontier
in the workflow summary are the image receipt. There is deliberately no mutable
`latest` tag.

The operator app reports readiness target `yellow_runtime_database`. The separate
synthetic provider reports `synthetic_provider`; that response is not an operator-app
or production-provider receipt.

These images target amd64 because no approved cloud host architecture is recorded.
Add a reviewed arm64/multi-platform builder only after the target is known and
executed on CI; do not claim the planned OCI Arm host accepts an amd64 image.

## Cloud promotion contract

Cloud promotion remains disabled until the founders provide the exact approved
host/runner, registry access, private ingress and recovery target required by D-68.
At that point a protected GitHub `production-preview` environment should:

1. select one published source SHA and both immutable registry digests;
2. capture a restorable PostgreSQL backup;
3. run the matching migration image with deployment authority;
4. deploy the runtime image with only runtime and extension-registrar authority;
5. verify `/ready`, the exact SHA, authenticated status and one representative read;
6. record the image digest, migration frontier and rollback revision.

The deployment job must allow only reviewed `main`, prevent self-review, serialize
promotions and keep long-lived secrets out of workflow source. A forward migration
is not rolled back; application rollback selects the previously recorded runtime
digest only after compatibility proof.

The synthetic hosted-deposit provider and review identities are local test
facilities. They are never production payment or customer identity services.
