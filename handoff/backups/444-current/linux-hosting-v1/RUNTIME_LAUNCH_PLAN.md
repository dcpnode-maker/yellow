# Candidate 444 launch command (root-owned; not executed here)

Required existing app-binding file: `/workspace/yellow-coordination/release-20261001/receiving-b9-linux-v1/database-proof-v2/private-app/runtime.env` (nonsecret metadata identifies it; stat verified regular mode 0600; values unread and uncopied). Required variables are those documented in `candidate-compose.yml`: runtime DB password, extension registrar DB password, and token secret. `--env-file` is for Compose interpolation only; the app receives only explicit keys in the Compose `environment` allowlist.

Root must verify the file path/permissions again without reading contents, confirm the existing PostgreSQL CID/network/alias and before-fingerprint, confirm port 53018 is unused, and obtain the candidate immutable image ID plus build nonce from reviewed proofs. Supply only the nonsecret image ID and a fresh random nonsecret nonce in the shell environment:

```sh
YELLOW_CANDIDATE_IMAGE_ID='<verified sha256 image ID>' \
CANDIDATE_444_NONCE='<fresh random nonce>' \
docker --host unix:///var/run/docker.sock compose \
  --project-name yellow-candidate-444-v1 \
  --env-file /workspace/yellow-coordination/release-20261001/receiving-b9-linux-v1/database-proof-v2/private-app/runtime.env \
  -f /workspace/yellow-coordination/release-20261001/candidate-444-v1/candidate-compose.yml \
  up -d --wait --wait-timeout 25 --no-build --pull never app
```

Do not run `compose config` or print environment values. Root owns exact-CID ownership inspection, HTTP proof, and after-fingerprint. This candidate shares synthetic103; any source DB fingerprint change is a hard failure requiring exact-owned app cleanup. No DB migrations or seed actions are included.
