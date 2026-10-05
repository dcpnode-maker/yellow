# HARNESS-010 — Yellow workspace activation proof

28 September 2026. Implementer: root Codex. Independent nonimplementer:
`/root/harness_acceptance_luna`, the existing founder-approved Luna reviewer.
Accepted only as runtime/project-file-ready local workspace activation, not an
autonomous builder, inference-quality test or full release.

## Frozen source and actual runtime

- T3 `d4b4ea0d146b9207900874bacb4c364f03281422`, branch
  `phase-0/yellow-personal-harness`, prior `c6160289e08c1019592aa77b7e6eef40d1244f12`.
- Adapter `ddd7c6c0143e98e91dcca6118e09ed5be93bbdaa`; Paperclip
  `d554c4789ed3930f8a53ac9fdf6503b3187097da`: untouched.
- Isolated state `D:/Yellow/harness/state-workspace`, marker
  `yellow-development-workspace-v1`, separate OS home and T3 userdata.
- Desktop on numeric loopback 38883. Parent stopped owned root 29784 successfully,
  then started root 21932; identity-confirmed journal and ready receipt retained.
  Measured startup 15,398 ms; startup subtree 10 processes / 871 MiB working set.
  This is one startup observation, not a capacity or latency benchmark.
- Existing Paperclip root 29156 on 38874 and its owned database were reused, not
  restarted. New company `507332e8-54e2-4e2c-9f9d-e72ee972896f`, Yellow development,
  remained empty; native Jobs UI confirmed Connected / 0 tasks / 0 agents.
  Zero budget means no enforced monetary limit, not free-only policy.
- Source roots: canonical Yellow; harness-app Yellow worktree; T3; adapter;
  Paperclip. Source is attached in place, never copied into the profile.

## Independent proof personally executed

Reviewer personally ran from `D:/Yellow/harness/t3code`:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test scripts/yellow-workspace.test.mjs scripts/yellow-harness-runtime.test.mjs
& 'C:/Program Files/nodejs/node.exe' scripts/yellow-harness-runtime.mjs status desktop --profile workspace
```

13 passed, 0 failed, 0 skipped. Actual wrapper failure fixtures prove coordinator
and desktop failures stop subsequent registration/open. Capture-failure and
replaced-PID/profile/creation-time fixtures retain the unconfirmed spawn and deny
new start/stop authority. Reviewer status personally confirmed running root 21932.

Reviewer opened `state.sqlite` using Node `DatabaseSync({readOnly:true})`, checked
exact equality of five registered titles/roots against `projectRoots` and zero
`projection_thread_messages`. Personally read harmless markers, content not
displayed: PROJECT.md 7,018 bytes in both Yellow roots; T3 package.json 4,102;
adapter README.md 9,194; Paperclip package.json 9,708. No authentication secrets,
model inference, state write, service mutation or native UI action by reviewer.

## Parent functional and preservation proof

- Focused Node tests independently 13/0/0; `vp fmt` and `vp lint` on four script
  files pass, scoped Git diff check passes. No application/server core changed;
  the previous staged web/server/desktop assets remain used.
- `yellow-workspace.mjs check` validates the decoded settings and isolated home;
  fixed installed CLI `codex login status` returns Logged in using ChatGPT.
  No key is copied or printed; no prompt, provider fallback or paid API called.
- Real native first-run UI showed Codex authenticated / ChatGPT Pro subscription /
  Ready. Declined import of the user's old project/conversation history. Real
  CLI open succeeds after setup; actual native window selects Yellow full repo
  and its current branch, with Supervised mode. Model picker shows GPT-6 Astra;
  entitlement to a generation and generated output remain untested.
- Repeating supported registration reports already_registered for all five
  roots. Read-only SQLite has zero threads and messages, confirming no coding
  turn during activation. Paperclip remains the only durable job coordinator.
- Desktop shortcut was absent before creation, saved once through Windows
  shortcut API and read back: normal Windows PowerShell, no security-policy
  override, `yellow-workspace.ps1 -Command open`, correct working directory.
  No existing shortcut or startup task was replaced.
- Canonical HEAD `57876f9d1760bb1f06fab77dad38631ee31d5784`, 388 preexisting changes,
  index SHA256 `1C996DA6C51AA0B2A045F192648B3A807CB998649241244DAFFE829CB8EF6AC8`
  before and after activation. All unrelated source/index changes preserved.
- Native screenshot retained for handoff:
  `D:/Yellow/harness/state-workspace/artifacts/yellow-workspace-ready-20260928.png`.

## Initial findings and retained failed attempts

Reviewer F1: missing child lifecycle exit-code checks. Fixed and actual copied
wrapper personally executed against failure stubs, no downstream operation.
Reviewer F2: first census failure could lose spawn ownership evidence. Fixed by
persisting a non-authoritative launch journal before capture, blocking duplicates,
and binding any receipt to exact PID/profile/creation time. Journal is never kill
authority. Both findings independently closed; no scoped regression reported.

Initial CLI open timed out while native first-run setup was unfinished; it
succeeded after normal setup, without changing core activation code. Initial
pilot desktop stop returned identity validation error; a read-only retained-owner
snapshot subsequently proved not_running / no retained processes. No broad
termination/retry; coordinator and user applications preserved. New workspace
stop/start then exited 0 with exact owner receipts. Missing isolated pwsh was
fixed using the existing exact bundled runtime path, not the user's entire PATH.
Initial source commit lacked Git identity; retry used the preceding commit's
OpenAI Codex / codex@yellow.local identity per command, not a global config edit.

## Boundaries and remaining product gates

Goose 1.51.0 and DSH 0.1.5-rc.2 are installed/discovered only, not authenticated
free routes or activated workers. Kaggle sessions remain off; no public relay was
created. Existing subscription lead is not free or unlimited. Workers and native
browser/device permissions remain disabled; source attachment is not unbounded
permission. No task was dispatched, accepted or applied. Primary company role
still needs an actual chat and explicit designation.

HARNESS-005's complete assignment/review workflow, exact free/local worker
connections, independent full current-runtime acceptance and self-contained
installer/clean-machine proof remain open. Older installer is not this source.
No Yellow operational database, source, live tunnel, migration, financial action,
global Windows service/security change, API spending, PR or merge occurred.
