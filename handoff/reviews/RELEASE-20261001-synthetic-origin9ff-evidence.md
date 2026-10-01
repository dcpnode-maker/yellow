# Final hosting evidence review — 2026-10-01

## Verified bounded claim

The root launch receipt records an executed isolated synthetic launch for source `9ff27ad8765dc75ebae9e083d4635c7a9b89fa62`, image config `sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0`, container `d002232dfdb8ba671ca51fc53ae8657ea72cc361740acd61c91b49e8f5bdca59`, and loopback bind `127.0.0.1:53009`. Its recorded checks are health 200, readiness 200 at revision 9ff/frontier 100, unauthenticated properties 401, selected sensitive paths 404, and UI/asset responses with recorded hashes. This is evidence of a local synthetic origin for the recorded run.

The snapshot script is a read-only fingerprint routine: it asserts synthetic `yellow_dev`, PG18, frontier 100, verifies all 100 ledger filenames/checksums against the local migrations, summarizes 130 public tables without emitting row contents, and hashes a schema-only dump (normalizing only the random PG18 restriction-token lines). The before and after JSON files are byte-identical (`c270911a0baaae355f176c7bfe1906c50526a50d51d1aca18743b2c0eae32192`). Parsed comparisons confirm equal identity, migration ledger, all 130 table row-count/digest summaries, and schema hash (`b924ed9532046a563df6332881716130deeb2e69dc88341d0123849d61c8edf9`). Both snapshots say `raw_business_rows_emitted: false` and `mutation_executed: false`. This supports preservation of the captured synthetic database state across the before/after snapshots.

## Limits

The receipt establishes only a loopback synthetic launch. It does not establish a public app route, Cloudflare Access/VPC setup, UDP/QUIC connectivity, external use, or provider health. The 401 check is an unauthenticated denial; it is not a successful login or authorization proof. Readiness identifies 9ff and frontier 100, not the laptop-integrated 101–103 release. Equal snapshots establish equality of the captured database identity, ledger, schema digest, and table summaries at the two sample points; they do not prove every VM/service state remained unchanged between those points or independently verify the old service's runtime state. No restart/deletion recovery, uptime, off-VM backup, or durability claim follows from this launch.

## Hash bindings

- `run-9ff-origin-20261001/receipt.json`: `6a0c707ca5f42dec668a0cf2090576eca5ccfeb0deb4abc4ada721d0c34e712f`
- `snapshot_synthetic_database.py`: `9ea1fe5ea8fea6b0b885f831730cabd4902ebd768deb01bd168208f4f42bbc90`
- `SYNTHETIC_DATABASE_BEFORE.json`: `c270911a0baaae355f176c7bfe1906c50526a50d51d1aca18743b2c0eae32192`
- `SYNTHETIC_DATABASE_AFTER.json`: `c270911a0baaae355f176c7bfe1906c50526a50d51d1aca18743b2c0eae32192`

Review was read-only. I did not inspect the launch command log or token file, inspect environment state, launch a container, query the database, or change proposal/configuration files.
