# OmniRoute continuity gateway

This is a bounded local gateway for parallel internal workers. It uses the published
MIT `omniroute@3.8.50` npm archive only after its byte count, SHA-512 integrity,
package identity, and license are verified. The launcher never accepts provider
credentials, performs provider sign-in, imports sessions/cookies, installs plugins,
starts a tunnel/MITM proxy, or sends a model request.

The install and generated secrets live only in `.git/yellow-omniroute/`, with
owner-only POSIX permissions. They are not Git content. The gateway binds to
`127.0.0.1`, requires a generated gateway API key, disables its live WebSocket,
credential checks, background services, update notifier, tunnel flag, and MITM flag.
The initial dashboard password, data-encryption key, signing secrets, and gateway key
are generated privately and never printed.

## Install and local proof

Run from the Yellow checkout on a host with Node `>=22.22.2 <23` or `>=24 <27` and npm:

```sh
(cd .. && npm pack --ignore-scripts omniroute@3.8.50)
python tools/build-continuity/omniroute.py --install
python tools/build-continuity/omniroute.py --smoke
```

`npm pack` obtains the exact sibling archive `../omniroute-3.8.50.tgz`; the launcher
still rejects it unless its pinned byte count, SHA-512 integrity, package identity, and
MIT license match. `--install` then uses
`npm install --ignore-scripts --omit=optional --no-audit --no-fund`, followed only by
the matching `@esbuild/<platform>` executable required by the packaged `tsx` launcher
(also with `--omit=optional`).
The package may need npm registry access for ordinary runtime dependencies; if that is
unavailable, the command stops without replacing the private directory. Lifecycle
scripts and all other optional packages stay excluded.

`--smoke` starts a foreground temporary instance on `127.0.0.1:20129`, checks a local
health endpoint, verifies that unauthenticated `GET /v1/models` returns HTTP 401, then
stops it. It makes no authenticated gateway/models request, no chat/completion request,
and no provider request.

If both checks pass, run the foreground gateway with:

```sh
python tools/build-continuity/omniroute.py --serve
```

Use `--port <port>` consistently with `--smoke` and `--serve` when the default local
port is occupied. Do not use daemon mode, a public bind address, a reverse proxy, or a
tunnel for this continuity setup.

## Verified OpenRouter free route

On 2026-09-22 one founder-authorized OpenRouter key was stored in OmniRoute's encrypted
private state and its authenticated provider test returned HTTP 200. The key is not in
Git, this document, Goose configuration, or process arguments. A request through the
loopback gateway using `poolside/laguna-s-2.1:free` returned
`YELLOW_OMNIROUTE_READY`; the same route through Goose returned
`YELLOW_GOOSE_READY`. No paid model fallback is authorized.

Start the graphical fallback from the Yellow checkout with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-continuity/start-goose-omniroute.ps1
```

The launcher starts the loopback-only gateway when necessary, reads its gateway key
from private Git metadata, rejects hosted model ids without a `:free` suffix, exports
the key only to the launched Goose process, and opens Goose in this checkout.

Other providers remain candidates pending their own proof. Recheck OpenRouter's live
catalog and zero-price fields immediately before each bounded proposal assignment.
The NVIDIA Nemotron 3 Super listing still needs a fresh check because its UI displayed
a retirement date of `10/02/26`; the date format was not resolved.

Kilo, Gemini CLI, and Qwen Code use separate native authentication and are not routed
through OmniRoute OAuth. Kilo email and Terms submission remains blocked by automatic
approval review until the founder explicitly authorizes it; do not attempt a workaround.

This temporary cloud workspace is not persistent laptop activation. The Yellow
application, database, and release gates are unchanged.
