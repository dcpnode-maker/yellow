# Q239 — Order195 reusable browser proof lifecycle

## RESOLVED — exact test-only lifecycle optimization admitted

Order449's retained validation attempts exposed a real wall-time weakness in the
existing Order195 geometry proof. One unchanged 30-second test sequentially starts
and tears down seven Chromium roots and profiles for five Apple widths, Win95 and
Enterprise ERP. The exact test passed in focused runs but reached 30,007 ms in the
isolated standing attempt without an assertion result. Its startup loop alone
permits 20 seconds for each browser, while DevTools target creation, socket opening
and commands have no independent deadline.

This question proposes a test-infrastructure-only repair in
`tests/operator-appearance-geometry.test.ts`:

- retain the exact seven cases, fixture markup, CSS under test, assertions and
  existing 30-second test deadline;
- own one temporary profile, one Chromium root, one DevTools target and one socket
  for the complete assertion sequence;
- give every navigation a unique proof token and require the returned navigation
  to have a frame and loader identity; read a result only when the current document
  exposes that exact token, so a prior 1,440px Apple document cannot satisfy Win95
  or ERP;
- bound startup, target creation, socket opening, every DevTools command, each
  document proof and the whole session;
- reserve six seconds inside the existing deadline for bounded socket closure,
  graceful/forced owned-root reaping and stderr draining; reject malformed socket
  messages and synchronously failed sends while removing pending requests;
- keep the outer temporary-directory `finally`, use `windowsHide: true`, and never
  discover, attach to, stop or inspect an unrelated browser.

Root read the complete private proposal at SHA-256
`442739db73feef01b4011a3cbf17b9dd833ccc59ca5fdb936f4935fe63d2e62d`
and admits its application to the one named test file with two mandatory
strengthenings: decoded DevTools messages must reject null, arrays and malformed
object/error/id shapes without throwing out of the event listener while retaining
the matching pending request until its complete shape validates, and the socket
open deadline must reject its promise directly before closing the socket. Those
strengthenings, `windowsHide: true`, the unique navigation token and loader check,
and the 22-second session/six-second cleanup budget are part of the accepted change.

No test execution is admitted until root coordinates it against the concurrent
Order451 proof. This remains test infrastructure, not UI/product work, and does not
alter CSS, operator JavaScript, routes, runtime functions, fixture exports,
database state, assertions or the 30-second deadline. Root will independently
inspect the final diff and execute the focused lifecycle/geometry proof before any
combined standing run.
