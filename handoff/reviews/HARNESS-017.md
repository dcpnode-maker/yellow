# Bounded runtime recovery - implementation receipt

The25-minute launchers timed out, but inspection found no owned build process
left and retained CLI binaries present. A single explicit recovery per worker
preserved first-attempt-failure.json and did not restart notebooks, replay source
tests or redownload weights. Exact runtime source SHA, model size/hash and actual
CUDA device enumeration were checked before model use. Worker3's pre-generation
wrong source path was preserved and separately corrected to the real pinned file.

All3 fixed1,024-token model calls produced inert proposals. HARNESS-015's receipt
records actual durations/hashes and reported generation12.8-13.4t/s. Those are
bounded advisory calls, not model quality/capacity or native T3 acceptance.

Focused helper proof:7 Python+6 Node tests pass. Recovery rejects active, unverified
and replayed jobs; runtime inspection rejects non-owned roots; proposal reads bind
the stored digest and withhold credential-like content. Telemetry excludes private
keys/proposals and never inflates the fixed10-step denominator.

No original process/kernel/session was killed. New recovery subprocess groups
have fixed deadlines and only that newly owned group may be signaled at timeout.
The first-build unpinned UI fallback history remains an acceptance limitation.
No generated code or automatic source application occurred. Independent security
review and full native execution-factory admission remain outstanding.
