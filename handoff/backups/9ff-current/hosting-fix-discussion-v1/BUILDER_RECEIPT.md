# Synthetic origin builder receipt

Scope: artifact preparation only for `SYNTHETIC_ORIGIN_ORDER.md`. No Docker
mutation, container launch, network change, database query, credential read, or
external route activity was performed by this builder.

Added `compose.yml` for one reviewed `9ff` app on `127.0.0.1:53009`, attached only
to the pinned existing external network. It pins the immutable image config ID,
platform, user, command,
resource bounds, restart policy and source/job labels. Compose interpolates only the
runtime database URL, extension registrar URL and newly generated token secret.
The existing authority file is supplied as a Docker Compose `--env-file`; the
runner uses filesystem metadata only and never reads or prints it.

Added `run_synthetic_origin.py` with a complete preflight admission boundary,
private token env file, 180-second overall deadline with 15 seconds reserved for
cleanup, bounded private command logs, and non-sensitive health/readiness/revision/
frontier/asset/unauthenticated/sensitive-path proof. Every Docker CLI call pins
`unix:///var/run/docker.sock`. Cleanup runs only after launch was attempted and
requires the exact full CID, image, name, job label, source label and per-invocation
nonce. It refuses symlinked authority/task paths and any reused job/token/receipt
path. It preserves inherited proxy/trust/Docker configuration and home settings
while clearing only Docker endpoint/context/TLS selectors. Docker CLI/plugin
children are terminated as a process group on timeout or interruption. Errors
exposed to the console contain only stage and exception type. Successful proof
leaves the app running, retains the private token file on the VM for local
diagnostic recovery (not an off-VM backup), and writes the exact socket-pinned
`docker stop <full-CID>` command to its private receipt.

The targeted negative tests cover image/source label, owned name, prior container
identity/source, external network, port, dirty source, fresh path, authority mode,
inherited secret collisions, symlink paths, same-origin asset paths, RED-admission
cleanup refusal, explicit daemon selection, and nonce-gated exact ownership cleanup.
RED admission cannot trigger token-file deletion unless this invocation created it.
All 17 tests pass, along with Python compilation and static Compose checks. The
parent reviewer is responsible for independent review and any actual launch proof.
