# BUILD-CONTINUITY-002 — OmniRoute setup

Founder direction, 13 September 2026: prepare OmniRoute-style free model pools
for parallel internal workers under Codex coordination. This is an extension of
BUILD-CONTINUITY-001, not a new Yellow product or release lineage.

Scope: this order; `tools/build-continuity/omniroute.py`,
`tools/build-continuity/OMNIROUTE.md`,
`tools/build-continuity/provider-pool.json`; independent review at
`handoff/reviews/BUILD-CONTINUITY-002-OMNIROUTE.md`; append-only ledger/decision.

Prepare pinned OmniRoute 3.8.50 from the published MIT npm archive. Upstream:
https://github.com/diegosouzapw/OmniRoute . npm SHA512 integrity:
`sha512-qK6REDWQYGh8lwGwDgFMsBqAMXnxIePudr8cSuSYeB9iIlywNhDJxHKt6Cwa31lPci8jXE5bbvl+az0lvyt0Mg==`.
Published archive is 121,369,534 bytes; unpacked 452,524,798 bytes. Inspect exact
launcher/configuration and license before execution. Skip installation lifecycle
scripts and unneeded optional packages. No plugin, cookie/session import,
credential harvesting, browser automation, account rotation, MITM, public tunnel,
provider purchase, or model request is authorized through this launcher.

Use a separate private data directory under Git metadata and bind only 127.0.0.1.
Generate random local secrets privately; never print them or put them in Git.
Require gateway API authentication. Configure only official API providers after
their accounts/keys and free-only conditions are verified. No imaginary balance,
enabled route, VM, or live inference receipt. Kilo email/terms submission remains
blocked by automatic approval review until explicit founder approval.

Root owns `continuity.py`, `start.py`, its tests and main README; this lane must
not edit those files or actual existing `.git/yellow-continuity` state. A dedicated
`.git/yellow-omniroute` directory may be used for installation and smoke checks;
never remove or replace an existing directory. Persistent host activation remains
separate from the current temporary cloud environment.

Proof: show pinned installed version, inspect bind/auth configuration, attempt a
local unauthenticated rejection/health check if runtime dependencies support it.
Record actual failures and leave full-provider activation pending when keys are
missing. No Yellow application/database changes or new PR without canonical gates.
