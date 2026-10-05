# Concrete worker tests — findings-based, not architecture redesign

Current Codex defines precise tasks; Qwen writes complete files; parent inspects,
tests and integrates. Batch leaf jobs, not giant open-ended project prompts. Each
worker gets the actual runner/API, exact source context, finite output/time and
one concrete file. No model can approve its own output.

| Worker | Actual finding | Specific task / state |
|---|---|---|
|1|Wrong task, missing fixture, partial answers|Existing fit-0930e complete CDP regression file; already running, never resend|
|2|Oversized18,448-char prompt; stale finance test end marker|7,250-byte packet: complete existing test file, correct LegacyReservationWorkspace delimiter, four deterministic helper tests, preserve every original assertion; prepared only|
|3|Duplicate generic map coverage, wrong runner, unfinished analysis|11,031-byte packet: initial invalid nonce does not bind; rejected high revision does not poison state; inspect immutable via Reflect.set; prepared only|

Prepared bulk manifest:

    python tools/yellow-harness/worker-jobs/findings-packets.py

Default prints digests/provenance/budgets, not full prompt text. `--include-prompts`
returns the pinned public task payload to a future fixed operator, not an arbitrary
execution API. Worker2 uses3072 output tokens/360s; Worker3 uses2048/240s;16K
context/256reserve. UTF8 ceiling is a conservative preflight, not measured tokens
or VRAM fit. Oversized input fails locally before GPUs rather than silently trimming.

Actual Worker2 boundary proof: exact d708ff29 public App has MovementGrid at2793,
next LegacyReservationWorkspace at2959. The old ReservationWorkspace marker is
not found afterward. Only labelled boundary/billing evidence is supplied instead
of sending16KB irrelevant JSX; full original test file is supplied unchanged.
Worker3 receives complete pure functions and complete existing protocol tests,
explicitly labelled excerpts, with full-file and supplied-byte SHA256.

Seven offline tests verify unchanged live Worker1 prompt, exact pins/digests,
real source boundaries, finite capacities, missing assertions, wrong runners,
disabled tests and incomplete artifacts. Delivery triage always accepted=false;
it is not a parser, sandbox or executable proof. Parent must read all code and
run scoped verification. The prepared Worker2/3 tasks have not been sent; no GPU
admission, new model or paid worker fallback was started by this preparation.
