# PR-FIX-013 - Historical test profile scope

CI36499476998 at 15f4b384 passed five jobs including the complete Linux quality
suite and actual map artifacts. Database Phase3 failed only the fixed September18
housekeeping fixture's `profile=[]` assertion. This repair copies the exact
test-owned UUID, bounded tenant-specific historical profile insert and matching
UUID/tenant assertion from public green PR86 ac58c91.

Only this test file and this order/question/receipt change. Production seed/profile
insertion-time semantics, fiscal permission additions, migrations and renderer/UI
source remain unchanged. Protected source diff is empty. Types pass; 203 boundary
files pass. Local non-DB/static tests pass3, skip26 explicitly; those skips are not
database proof. The Windows Docker CLI currently times out, while live /health
still returns200. No restart or live DB mutation is performed.

Fresh exact-SHA CI must execute all27 isolated seed tests and the remaining full
database gate before PR93 is reported green. No own merge or deployment.
