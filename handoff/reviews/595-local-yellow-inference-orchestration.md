# Order 595 independent review — 2026-09-22

Reviewer: `/root/order595_review_replacement` (independent; did not implement Order 595)

## R1 verdict (retained)

**CHANGES REQUESTED.** The local/Ollama and OmniRoute security boundaries are supported by executable proof, but the retained-container status wrapper misreports an offline Docker daemon, and the order's required laptop-side fake-endpoint Android orchestration proof is absent. Real-device pairing and nested Codex shell execution remain explicit, acceptable limitations rather than claimed proof.

## Findings

1. **P1 — offline Docker status is not a boolean and misclassifies retained containers.** `tools/local-ai/yellow-host.ps1:20-36` lets `docker info --format` write to the PowerShell success stream and then also returns `$true/$false`. On this host the exact status command returned `docker_ready: ["", false]`; because a non-empty array is truthy, all four retained IDs were inspected and reported `missing` instead of `desktop-offline`. This defeats the safe resource/status contract and could make operators believe the preserved runtime identities were lost. Capture/suppress command stdout and return one Boolean; add an offline-daemon regression test.
2. **P1 — required fake-endpoint phone orchestration proof is missing.** `tools/local-ai/android/tests/test_android_kit.py` has five source-text assertions only. No test starts a laptop-side fake endpoint and proves the selected worker/unique local port/status or reconnect path against it. Add the bounded proof required by the order; do not substitute a real phone mutation.

No bypass flag, public inference bind, broad deletion, container/volume deletion, provider/model call, or secret output was found in the scoped source. Phone install is pinned by exact APK size/digest and `adb -s`, but no authorized device exists, so no installation was attempted.

## Reviewer-executed proof

- `python -m unittest discover -s tools/local-ai -p 'test_*.py' -v` — **PASS, 4/4**.
- `python tools/local-ai/android/tests/test_android_kit.py` — **PASS, 5/5 static checks**; does not satisfy fake-endpoint orchestration.
- `python -m unittest tools.build-continuity.test_omniroute -v` — initial **PASS, 2/2**. After the final Windows process-tree repair, reviewer reran it: **PASS, 3/3**.
- `python tools/build-continuity/omniroute.py --smoke` — initial and final **PASS**: health 200, unauthenticated models 401, no authenticated/model/chat/completion call. Final post-smoke check: TCP 20129 listener count **0**.
- TOML/JSON parse — **PASS**: seven TOML files (including both timestamped backups and private local config) and `workers.json` / `wsl-crash-manifest.json` parsed.
- `yellow-ai.ps1` local implement/review dry-runs — **PASS**: `workspace-write` / `read-only`, provider `yellow_ollama`, model `qwen3.5:9b`, `bypass:false`.
- `yellow-phone.ps1` pair/install dry-runs — **PASS** without mutation: pairing secret not printed; exact three pinned packages selected.
- Ollama/status — **PASS**: 0.34.2, loopback `127.0.0.1:11434`; sole tag `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, 6,594,474,711 bytes; no model loaded.
- ADB status — **LIMITATION CONFIRMED**: no mDNS service and no authorized device. No pairing/install mutation.
- Container status — **FAIL** as described above; Docker was offline and no container was started.
- Crash manifest — **PASS**: all three exact recorded artifacts absent; directory itself exists. Recorded digests: `58618C9FA5CCD0CC9314A9840951BA868F1BE0292E0E39E1AB9756A187EFC897`, `B02C3AE8648342FB9B5D0D750B3CF17195CFAAE8A43BE773B79CFC485B8D4E74`, `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855`.
- Authenticated OmniRoute discovery was inspected without printing the key: HTTP 200, 490 records. No provider/model generation was invoked.

## Final hashes

- `tools/build-continuity/omniroute.py` — `A95EDE2C368B4E99992DB7BBFD8D901B0AA44F2674C2211E7F0AEF45C1ACB606`
- `tools/build-continuity/test_omniroute.py` — `C0CB0CBBEC18E0A7179E23198E0D180E4FE8030BA12D612A42812C2C3084BCA5`
- `tools/local-ai/yellow-ai.ps1` — `8C3C3DE9A420A086F0C3820C432D99366AE9098ABF38D9A657A5A074AD0798E0`
- `tools/local-ai/yellow-host.ps1` — `20C01D333DD0A6F6A5315CF8D7D6A8A166A534FF0697BC3A8984C508328AF2B0`
- `tools/local-ai/yellow-phone.ps1` — `51FEAE8A9C746A3D670B5438B76F32705D578D38B25B6F87D71CAEFEDD5211F1`
- `tools/local-ai/test_local_ai.py` — `B0C3F9CB16194990E53530604CF2C379EAD1649C7AC8ABC2B8A80770BE5054E4`
- `tools/local-ai/workers.json` — `07A5BCB33B332F86AFC593F79A9C0D933F4302F604EE2B1EAB5D28E92060D404`
- `tools/local-ai/wsl-crash-manifest.json` — `7ABC5E8B785B7C7CA03CF3D03A84398A70C36BB25BBC70A519F7E79413BDF59A`
- Android `bootstrap.sh`, `guard.sh`, `install-boot-helper.sh`, `start-server.sh`, `Invoke-PhoneTunnel.ps1`, `README.md`, test — respectively `B29735E9A89EB9A2F569548611D91026D12ECA2D9F9BC08E9EEE8C2FE0282FB4`, `3908C9CA748EBDF4DBE8F050E74C87BD4DDE1AA22E8C7DAED1A272B2B0037A05`, `CF1C18F1F980E0961D8A4384F5275C09E2BA055BCFEC538359AAECA64B3BB827`, `45DAC4DCF8E808C82615D00484EF26FDB10C4ABDFDB9A1F4120D66905D3B4953`, `AAB003D6139526BFE9769CB52355021826A3B75601EFE9F5DBD7F5E8072C2251`, `2563D5D0E26A3D770B6DC4805F1ACE7AB0BE6613941FCDF7F5F975AA778FB46B`, `01F7C844F0F897BC7A5614A56ABA0BBC0B9A99C84C5D8CC2420C22365D47281D`.
- `docs/LOCAL-AI.md` — `A81B1B7CB623D2A89E17E2126DA40818CE0C8A901882EBBB98EF5BFF04206E53`
- Ollama executable — `AD41DCF55C5DE96D4A0BFF7C559A17285C3AA064A6F12D23DB3EBF59AD8E4125`.
- SQL.js source and colocated runtime matched exactly: package `D05999C98BA0A89B01775BE9C647DD787429D1C07BC8CEC3B159D06736FA4C4C`, JS `F1C84000DBC856C9D87F4F3AABC4D3654BD436165DB4BE3DA13751DB3A9C20D7`, WASM `38C14F6E379210BC942BDC4EBCA44E7BFDB4318ECC1C72CA666A28FDCE96670A`.
- ADB `B4A6B455702684652CCCF7B46258B29E653538904359A58FD4931CF3EF286B3F`; APKs `E6265A57EB5CA363808488E3B01955958BED93BC0C8A0D281849B363B11027EC`, `6F7CF9B94F539D3EFD4AF3544FF819947B49395275D8CFA7E5F80DE14F3D9CF8`, `4497DBBF81906DF52E59ED387A5223D225AA0DE3ACA817CC557A621E4DADDA44`.
- Active Codex config `8AB1C8BFE45A9FDD568D99264EE4046DF9CFF08DF2CE0B126B2381C2CDE4947F`; private local config `C73CADF42693291B1E2141BD99F915EDB2F41C5B1A39AC0232C8DE371E5D0B73`. Timestamped active-config backup matches the active hash.

No foreground serve, local Codex generation, external provider/model call, real-phone mutation, container start, or secret printing was performed.

## R2 re-review — final repair

Reviewer: `/root/order595_review_replacement` (same independent non-implementer)

### Final verdict

**APPROVED.** Both R1 findings are repaired and personally reproduced against the final files. Order 595 remains bounded local-inference preparation: real-device pairing/install/throughput and nested Codex shell execution are explicitly unclaimed, and those documented limitations do not block acceptance.

### Reviewer-executed repair proof

- `tools/local-ai/yellow-host.ps1 -Action status` — **PASS**. Returned the scalar `docker_ready:false`; postgres `9f507e09cc38`, Valkey `781c68656c43`, app `dbe35dabd624`, and tunnel `e17219ecd7aa` each reported `desktop-offline`. No Docker/container start or mutation occurred.
- `python tools/local-ai/android/tests/test_android_kit.py` — **PASS, 6/6**. The added proof rendered the selected OnePlus 10R tunnel mapping as laptop `127.0.0.1:11435` to phone `127.0.0.1:8080`, started a real loopback-only fake HTTP endpoint, loaded the fixture API key through a temporary file, and received authenticated health/models HTTP 200 through `Invoke-PhoneWorkerProbe.ps1`. The secret was absent from probe output; the temporary key file and fake endpoint were removed, and post-test listener count on 11435 was zero.
- `python -m unittest discover -s tools/local-ai -p 'test_*.py' -v` — **PASS, 4/4**, including the repaired scalar Docker readiness contract.
- Static safety inspection — **PASS**. Tunnel and probe endpoints are fixed to `127.0.0.1`; SSH uses explicit `127.0.0.1:<worker-port>:127.0.0.1:8080`; the probe accepts the API key only as a file, sends it as an Authorization header, and emits only statuses plus `secret_printed:false`. No public bind, bypass, credential literal, broad delete, Docker removal, or volume removal was introduced.
- Retained final OmniRoute proof remains valid: focused 3/3, health 200, unauthenticated models 401, and port 20129 closed after smoke. Final OmniRoute hashes are unchanged from R1.

### R2 final hashes

- `tools/local-ai/yellow-host.ps1` — `FE9E77177AB4A83D513B67E75B4FF7C3A1A872828364A46879B9066A01E72EF4`
- `tools/local-ai/test_local_ai.py` — `D5ED0C902AFDB4ABCC8CD3232AC11C6FA07EECCA606005272A9C1DA0E4218A8D`
- `tools/local-ai/android/Invoke-PhoneTunnel.ps1` — `5094B8EBBDA341CCD5EA79C892DF2975B15B98C33548FE7A212CB613BF7ACB6C`
- `tools/local-ai/android/Invoke-PhoneWorkerProbe.ps1` — `B1225499D8262608E35D6D1820D3E926C89D9EB8F5F7539F308CA4C8FD109452`
- `tools/local-ai/android/tests/test_android_kit.py` — `EEC4D941763BDB45E36F72327046BD8C06FD6C0C54CF8A52A3F837E9F5DF41CF`
- `tools/local-ai/android/README.md` — `DD58CB8BE54A93BFD7B7355706CA1D495EE7F45169164A19D6C0291BCC6F5025`
- `docs/LOCAL-AI.md` — `D3A0E8E92167A86BD647064153212A2B5C8BF4DB13ECE195DC4ED62AEE73387A`
- `handoff/LEDGER.md` at review time — `3850C62655B1C0CB354E784D11EBE38207B5CE67F6BA4DB62F62C16EC00CAF42`
- `tools/build-continuity/omniroute.py` — `A95EDE2C368B4E99992DB7BBFD8D901B0AA44F2674C2211E7F0AEF45C1ACB606`
- `tools/build-continuity/test_omniroute.py` — `C0CB0CBBEC18E0A7179E23198E0D180E4FE8030BA12D612A42812C2C3084BCA5`

No implementation file was edited by the reviewer. No phone, container, provider, model, public runtime, or secret-bearing external system was mutated during R2.

## R3 re-review — provisioned OnePlus 10R and runtime hardening

Reviewer: `/root/order595_review_replacement` (independent non-implementer)

### Verdict

**SOURCE REPAIRS APPROVED; LIVE DEVICE ACCEPTANCE PENDING NETWORK RETURN.** The API-key-file and running watchdog changes are correct in the reviewed source and pass the independent suites. The OnePlus 10R left the local network before this reviewer could complete the required authenticated localhost proof and phone-side runtime inspection, so this review does **not** independently accept or repeat the claimed live model/runtime facts. A restored authenticated LAN path, or a founder-authorized authenticated overlay, is required for final live acceptance; roaming must not be bypassed with a public bind.

### Independent proof and findings

- Inspected `tools/local-ai/android/start-server.sh`: llama.cpp receives `--api-key-file "$YELLOW_ROOT/run/api-key"`; the secret is no longer expanded into process arguments. The server remains `--host 127.0.0.1 --port 8080`, one model, `--parallel 1`.
- The initial guard still runs before launch. The server PID is then supervised by a 30-second `while kill -0` loop; every interval invokes `guard.sh`, and a failed battery/thermal guard calls the exact `stop_server` path and exits non-zero. EXIT/INT/TERM also stop and reap the child.
- `python -m unittest discover -s tools/local-ai -p 'test_*.py' -v` — **PASS, 4/4**.
- `python tools/local-ai/android/tests/test_android_kit.py` — **PASS, 6/6**. The final test explicitly requires `--api-key-file`, rejects command-substitution of the key, and requires the runtime watchdog/guard stop path in addition to the loopback fake-endpoint proof.
- Static review found no `0.0.0.0`, public phone inference bind, literal private/API key, or secret-print path in the scoped scripts.
- Live attempt: the announced `127.0.0.1:11435` tunnel had disappeared before the reviewer request reached it. A reviewer-started exact-key SSH connection to `u0_a146@192.168.29.235:8022` used BatchMode and printed no key material but timed out. ADB mDNS returned no services; port 8022 was closed/unreachable at the recorded phone address and the other two current ARP peers. Therefore authenticated health/models 200, unauthenticated models 401, model byte/digest proof, pinned phone checkout, loopback socket, and live watchdog process remain **not independently reverified in R3**.
- Claimed but deliberately not accepted from implementer evidence alone pending reconnection: official Qwen3-4B Q4_K_M at 2,497,280,256 bytes / SHA-256 `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`, llama.cpp `b29c606e28a01b1bc8c1351026a0fa6e616bf6c4`, authenticated health/models, unauthenticated 401, loopback-only runtime, and live watchdog.

### R3 hashes

- `tools/local-ai/android/start-server.sh` — `2FC7432B1A69891542B56C1E3F847C0E554421577B7E9C71D7406A29BE2C66FD`
- `tools/local-ai/android/tests/test_android_kit.py` — `82ABDDC69404928EB0EE2AC978D66591319392EA8D062BE829F97F76E07F394B`
- `tools/local-ai/android/guard.sh` — `3908C9CA748EBDF4DBE8F050E74C87BD4DDE1AA22E8C7DAED1A272B2B0037A05`
- `tools/local-ai/android/bootstrap.sh` — `B29735E9A89EB9A2F569548611D91026D12ECA2D9F9BC08E9EEE8C2FE0282FB4`

No API key, SSH private key, or private-key content was printed. No implementation source, phone state, model, provider, container, or public runtime was modified by this review.

## R4 re-review — live OnePlus 10R acceptance

Reviewer: `/root/order595_review_replacement` (independent non-implementer)

### Final live verdict

**APPROVED.** The phone returned to the authenticated LAN and every fact withheld in R3 was personally verified. The OnePlus 10R is accepted as one bounded, loopback-only, authenticated worker. This does not authorize a public bind, unattended use, RAM pooling, high-risk Yellow judgment, or operation without the battery/thermal guard.

### Exact reviewer commands and results

- `Get-NetTCPConnection -State Listen -LocalPort 11435` — laptop tunnel listener `127.0.0.1:11435`, PID `23324`; no wildcard bind.
- Unauthenticated `GET http://127.0.0.1:11435/v1/models` — **HTTP 401**.
- `Invoke-PhoneWorkerProbe.ps1 -Worker oneplus10r -ApiKeyFile <private file>` — health **200**, models **200**, authenticated `true`, `public_bind:false`, `secret_printed:false`. The key value was never printed.
- Read-only SSH used BatchMode, the retained private identity, target `u0_a146@192.168.29.235:8022`, and printed no key material. Device identity: OnePlus `CPH2423`, device `OP5567L1`, Android aarch64 kernel `5.10.236-android12-9-o-g59fc6a68975e`.
- Phone model file `/data/data/com.termux/files/home/.yellow-phone-worker/models/Qwen3-4B-Q4_K_M.gguf` — **2,497,280,256 bytes**, SHA-256 **`7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`**.
- `git -C ~/.yellow-phone-worker/llama.cpp rev-parse HEAD` — **`b29c606e28a01b1bc8c1351026a0fa6e616bf6c4`**. Resolved binary `~/.yellow-phone-worker/llama-build/bin/llama-server`, SHA-256 **`6bd60bfeeb5779e6fa66ee82341150a3d925e1d9f9f3e7f95d48171f3f3eba51`**; reported `0.4.1-dev`, build 1, commit `b29c606`, Clang 21.1.8 for Android aarch64.
- `pgrep -af llama-server` / `ps -ef` — watchdog shell PID `32430` is parent of server PID `32462` and had an active `sleep 30` child. Server arguments were exactly the Qwen model, `--host 127.0.0.1 --port 8080 --api-key-file .../run/api-key --ctx-size 8192 --threads 4 --parallel 1 --jinja`; no secret appeared in process arguments. API-key file metadata was mode `600`, 43 bytes; content was not read to output.
- Android denied direct `/proc/net/tcp*` inspection to the Termux UID, so loopback acceptance rests on the exact live process arguments plus successful access exclusively through the SSH loopback forward. No LAN/public listener was claimed.
- `guard.sh` — **pass** before and after inference. The same watchdog/server PIDs remained alive across multiple 30-second cycles and after inference, demonstrating the live supervisor loop without forcing an unsafe failure. The reviewer did not lower thresholds or simulate heat.
- Resource proof: physical RAM total **11,978,129,408 bytes**; available before inference **4,960,210,944 bytes**, after **4,992,679,936 bytes**. Battery was **100% / FULL**, battery temperature **22.6°C** before and **22.5°C** after. `termux-thermal-sensor` did not return parseable independent sensor JSON during the reviewer probe; the configured guard itself passed, so no separate thermal-sensor maximum is claimed.
- First deliberately tiny inference (`max_tokens:16`, thinking enabled by default) returned HTTP 200 but consumed the cap in reasoning and produced empty content (`finish_reason:length`); it is retained as a limit, not called success. A second bounded request disabled thinking, used `max_tokens:32`, and returned exactly **`PHONE_OK`**, HTTP **200**, stop reason `stop`, 16 prompt tokens, 3 completion tokens, **1.721 s**. No external provider was involved.
- Final source proof retained from R3: local AI **4/4**, Android **6/6**; `start-server.sh` SHA-256 `2FC7432B1A69891542B56C1E3F847C0E554421577B7E9C71D7406A29BE2C66FD`; Android test SHA-256 `82ABDDC69404928EB0EE2AC978D66591319392EA8D062BE829F97F76E07F394B`.

No configuration, package, model, threshold, phone data, Yellow application, container, or provider was changed. The only live inference was the bounded acceptance prompt above.

## R5 review — background supervisor amendment

Reviewer: `/root/order595_review_replacement` (independent non-implementer)

### Verdict

**CHANGES REQUESTED.** The 45°C stop / 42°C resume design is thermally conservative, preserves loopback/authentication by delegating to the already reviewed server launcher, and recovers when the *server child* exits under a call or memory pressure while the supervisor remains alive. The boot installation path is incomplete, however: following the documented fresh-install sequence can create a boot entry that points to a supervisor which was never installed or made executable.

### Findings

1. **P1 — boot helper does not install or validate the supervisor it executes.** `install-boot-helper.sh:11` writes `exec "$YELLOW_ROOT/supervise-worker.sh"`, but the helper neither copies the adjacent `supervise-worker.sh` into `$YELLOW_ROOT`, makes it executable, nor refuses installation when it is absent/non-executable. The README instructs operators to run bootstrap and then this helper, with no intervening supervisor installation step. The static test only asserts that the filename appears in the generated boot script. On a fresh phone this can report “Boot helper installed” yet fail at boot instead of providing the founder-requested recovery. Install the reviewed file atomically with mode 700 or fail closed on an exact executable/hash check, and exercise the generated boot entry in an isolated test.
2. **P2 — retry validation admits a zero-delay pressure loop.** `supervise-worker.sh:9-10` accepts `YELLOW_RETRY_SECONDS=0`; when the guard fails, or the child is repeatedly killed by Android/calls, the `while true` loop can retry without delay and consume battery/CPU precisely during the pressure condition it should relieve. Values made only of punctuation also pass the shell character filter and later make `sleep` terminate the supervisor. Validate retry as a positive bounded number independently from the temperature floats and add behavioral tests for zero/malformed values.

### Reviewer-executed proof and assessment

- First `python tools/local-ai/android/tests/test_android_kit.py` run was contaminated by the existing live SSH tunnel already owning fixed port 11435; the fake probe reached the phone with the fixture key and correctly failed authentication. The reviewer stopped only exact SSH PID 25372, confirmed listener count zero, reran the suite, and received **7 Android worker tests passed**. The identical loopback-only SSH forward was restored as PID 17308 on `127.0.0.1:11435` afterward.
- Thermal behavior: running inference inherits stop threshold 45°C; restart preflight overrides the guard to 42°C, so a stopped worker cannot restart in the 42–45°C band. `resume < stop` is explicitly enforced. Sensor/JSON failures fail closed under `set -e`. Battery below 20% also remains stopped and retried at the configured interval.
- Restart behavior: server exits other than code 2 are retried after the cooling pause, covering a killed child from a call or Android memory pressure if the supervisor survives. Code 2 (missing/corrupt prerequisites) exits rather than looping. If Android kills the supervisor/Termux process itself, no in-process loop can recover; Termux:Boot provides reboot recovery only after the installation defect above is fixed. Wake lock reduces sleep suspension but is not immunity from Android process death.
- Quoting is sound for `YELLOW_ROOT`, threshold propagation, start-server invocation, PID/result capture, and generated boot script. EXIT/INT/TERM attempts wake-lock release. SIGKILL cannot run that trap, a platform limitation that should not be represented as guaranteed wake-lock cleanup.
- Loopback/auth are preserved: the supervisor never opens a socket or handles credentials; it invokes the reviewed `start-server.sh`, whose loopback and API-key-file contracts remain separately tested. No public bind or credential literal appears in the five reviewed files.

### R5 hashes

- `tools/local-ai/android/guard.sh` — `E17F4EBEBEC2D07A952E47BC727BEFD43D90471C87BF9235FAD0AED1141383D8`
- `tools/local-ai/android/supervise-worker.sh` — `F0CCC75518BA783D4D27B412CAD33BF7996A2E8F69DCF198A97FCCE0D96B2375`
- `tools/local-ai/android/install-boot-helper.sh` — `6D2A029D1DC8FD32FD3E4F6ACF26CEE7ED1836AF8E96877C4C3BBA27FA5688FB`
- `tools/local-ai/android/README.md` — `C54F16189CBCB44CCF47215A8F6FAD42181242D9FE7DCF02B92CDE36CB454F71`
- `tools/local-ai/android/tests/test_android_kit.py` — `448CB171F6DA8335F75F08D7599D91A3914BCEF9631B7E0E8F95244B316C0044`

No implementation file or phone state was changed. The only runtime action was a reversible cycle of the exact laptop SSH tunnel required to isolate the existing fake-endpoint test.

## R6 re-review — background supervisor repairs

Reviewer: `/root/order595_review_replacement` (independent non-implementer)

### Verdict

**APPROVED.** Both R5 blockers are repaired. The documented fresh path now installs an executable supervisor before boot-helper creation, the helper fails closed when any required executable is absent, retry delay is a positive integer, and temperature inputs use strict decimal syntax with enforced restart hysteresis.

### Independent proof

- The reviewer stopped only the exact existing loopback SSH tunnel, ran `python tools/local-ai/android/tests/test_android_kit.py`, and received **7 Android worker tests passed**. The identical `127.0.0.1:11435 → 127.0.0.1:8080` authenticated forward was restored afterward as PID 25496.
- `bootstrap.sh` now copies `guard.sh`, `start-server.sh`, and `supervise-worker.sh` from the same source directory and sets all three to mode 700. README now directs fresh resilient operation through `sh supervise-worker.sh` and retains the foreground alternative.
- A reviewer-created exact temporary phone root with no executables made the deployed, source-identical boot helper exit **2** with `missing executable guard.sh; run bootstrap.sh first`; it did not claim successful installation.
- A separate temporary phone root with executable fixture guard/start/supervisor files made the helper exit **0**, created the boot entry at mode **700**, and the generated entry contained the exact quoted `exec "$YELLOW_ROOT/supervise-worker.sh"`. Both temporary roots were removed by an exact trap after proof.
- Against the deployed source-identical supervisor: `YELLOW_RETRY_SECONDS=0` exited **2**; `YELLOW_RETRY_SECONDS=.` exited **2**; `YELLOW_MAX_TEMP_C=45x` exited **2**; `YELLOW_RESUME_TEMP_C=42..0` exited **2**. Equal stop/resume `42/42` was rejected before wake-lock acquisition with the explicit hysteresis error.
- Defaults remain stop 45°C, resume below 42°C, retry 60 seconds. Server child exits caused by calls or Android pressure remain retryable while the supervisor survives; whole-Termux death remains a platform limitation handled only at boot, not overstated as in-process recovery.
- Quoting, wake-lock release traps, loopback/auth delegation, API-key-file handling, and one-request concurrency remain intact. No new public bind, secret output, or destructive phone behavior was found.

### R6 hashes

- `tools/local-ai/android/bootstrap.sh` — `F0DD90E0C8E743CD7C82E9BD6BCDF60C488FC8600A95CEFCDC7A93EA183A3527`
- `tools/local-ai/android/guard.sh` — `E17F4EBEBEC2D07A952E47BC727BEFD43D90471C87BF9235FAD0AED1141383D8`
- `tools/local-ai/android/supervise-worker.sh` — `A32113825392E11C24AB2A911D020AF66EEDC1C7566D3823F71CD4C3418A8F6A`
- `tools/local-ai/android/install-boot-helper.sh` — `31FA68ECE5527471594151DD4C5E982E422B568DE91CFB23BF4380F9D780D4D2`
- `tools/local-ai/android/README.md` — `8D27620CE54BC191B109C6D858B44706026394DA805997CDAFFFBDA41084C0F4`
- `tools/local-ai/android/tests/test_android_kit.py` — `86146A544214B2C28B59C621E9CBF81F994AF90F4D56168966F48724250CF35E`

No implementation source or persistent phone configuration was changed by the reviewer; only exact temporary proof directories and the reversible laptop tunnel cycle were used.

## R7 review — Codex and Aider phone harnesses

Reviewer: `/root/order595_review_replacement` (independent non-implementer)

### Verdict

**CHANGES REQUESTED.** Authentication, native argument-array quoting, model discovery, Aider no-commit/no-repo-map flags, explicit-file path rejection, and environment restoration are sound. Two advertised containment guarantees are not enforced: Codex can workspace-write the main repository, and Aider's 128 KiB cap excludes the prompt. Aider also accepts an unrelated Git repository rather than proving the workspace is a secondary worktree of this Yellow repository.

### Findings

1. **P1 — Codex implementation can target the main repository.** `Invoke-PhoneCodex.ps1` accepts `-Sandbox workspace-write` with any resolved workspace and has no Git/worktree relationship check. The README says implementation workers require a distinct worktree and the main repository is read-only only, but reviewer dry-run `workspace-write` against the main Yellow root was accepted. Enforce read-only for the main root and workspace-write only for a registered secondary Yellow worktree.
2. **P1 — the 128 KiB Aider input cap ignores the prompt.** `Invoke-PhoneAider.ps1` sums only selected file lengths. A reviewer supplied a 131,073-character prompt plus the 7,724-byte `PROJECT.md`; dry-run accepted it and reported only 7,724 input bytes. This defeats the protection motivated by the 4B phone model's bounded context. Count UTF-8 prompt bytes, file bytes, and fixed harness instruction overhead together before model discovery/invocation.
3. **P2 — “separate Git worktree” validation is repository-agnostic.** The Aider harness only rejects when `git rev-parse --show-toplevel` equals the main repository. Any unrelated Git repository passes, so the bridge does not establish that it is a secondary worktree of Yellow. Compare the resolved common Git directory or registered `git worktree list` identities to the current Yellow repository before granting implementation mode.

### Independent proof and retained strengths

- The reviewer stopped only the exact live tunnel occupying fixed fake port 11435, ran `python tools/local-ai/android/tests/test_android_kit.py`, and received **9 Android worker tests passed**. The identical authenticated loopback forward was restored afterward as PID 21568.
- Safe dry-runs against existing secondary worktree `yellow-order175-folio-responsive-containment` succeeded. Codex reported read-only, authenticated loopback, no secret output. Aider reported explicit `PROJECT.md`, 7,724 input bytes, `auto_commit:false`, `repo_map:false`, and no secret output.
- Negative Aider proofs: main repository rejected; `..\yellow\PROJECT.md` escape rejected; existing 168,755-byte `BUILD-PLAN.md` rejected over 128 KiB. These protections work for the paths and bytes they cover.
- Pinned private runtime reported **aider 0.86.2**. Invocation uses a PowerShell argument array, explicit files, `--no-auto-commits`, `--no-dirty-commits`, `--map-tokens 0`, no streaming/update/release noise, and post-run `git diff --check` limited to the selected paths. There is no shell-built command string or automatic commit.
- Both bridges discover the model only through the authenticated loopback `/models` endpoint and keep the key out of JSON/config/arguments. Child-only API environment variables are restored in `finally`, including `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8` for Windows Aider compatibility. Codex likewise restores `CODEX_HOME` and `YELLOW_PHONE_API_KEY`.
- PowerShell path and argument handling uses `-LiteralPath`, native argument arrays, ordinal-insensitive prefix comparison, and UTF-8-no-BOM writes. The Aider explicit-file boundary is effective for ordinary paths. Reparse/junction escape resistance is not independently claimed by these tests.
- The full Codex-on-10R context-heavy attempt remains stopped and is not presented as successful. The prior direct Aider smoke (`AIDER_PHONE_OK`, 620 input / 70 output) is context supplied by the implementer, not rerun during this dry-run-only review.

### R7 hashes

- `tools/local-ai/android/Invoke-PhoneCodex.ps1` — `BF29CE16E7C63A890B54BD955DC78C751FE36B6B6F2197FD120077FE20EC32CA`
- `tools/local-ai/android/Invoke-PhoneAider.ps1` — `727AAEDC6300027050C41BFC5104FFC104C6CC435D5B8DAEC6DB2CB3CD189D8F`
- `tools/local-ai/android/README.md` — `6C110C90405337A772D3154E587F27CDD03931F5ED163966FC7F03EC94F2EB1B`
- `tools/local-ai/android/tests/test_android_kit.py` — `8E7BAB0A7A51B4DE45F647AB0EDA0B3789A0EB511F2007590E3BB7E32DE54639`
- private `aider.exe` — `F5712CF697EDD82C1E262B475CCB493AD483EDE2E177986A28DC50E11CC68A03`

No model generation, implementation edit, commit, repository-map generation, persistent environment mutation, or phone mutation occurred in R7.

## R8 re-review — harness containment repairs

Reviewer: `/root/order595_review_replacement` (independent non-implementer)

### Verdict

**APPROVED.** All three R7 containment findings are repaired and personally reproduced. Phone implementation mode now requires a registered secondary Yellow worktree, Codex main-root writes fail closed, and Aider counts UTF-8 prompt bytes together with explicit file bytes before any model invocation.

### Independent proof

- The reviewer stopped only the exact tunnel occupying fixed fake port 11435, ran `python tools/local-ai/android/tests/test_android_kit.py`, and received **9 Android worker tests passed**. The identical authenticated loopback forward was restored afterward as PID 30228.
- Codex `workspace-write` dry-run on the main Yellow repository was rejected with `Phone workspace-write requires a separate registered Yellow Git worktree.`
- A 131,073-character ASCII/UTF-8 Aider prompt plus `PROJECT.md` was rejected with `Phone task input and prompt exceed the 128 KiB bounded context limit.` The rejection occurs before key loading/model discovery.
- The reviewer created an exact temporary unrelated Git repository under private `.git/yellow-local-ai` state. Both Codex `workspace-write` and Aider rejected it with `Workspace is not a registered Yellow Git worktree.` The exact temporary repository was then deleted after its resolved path was verified inside the private review root.
- Positive dry-runs on registered secondary worktree `yellow-order175-folio-responsive-containment` passed: Codex accepted `workspace-write`; Aider accepted explicit `PROJECT.md`, reported **7,740 bytes** including the bounded prompt, `auto_commit:false`, `repo_map:false`, authenticated loopback, and no secret output.
- Ordinary explicit-file containment, 128 KiB file rejection, no-commit/no-dirty-commit, map-tokens zero, and post-run selected-file `git diff --check` remain intact from R7.
- Secret handling remains bounded: key values are used only for authenticated local discovery and child environment variables, never JSON/config/process arguments. Dry-run sentinel checks confirmed `CODEX_HOME`, `YELLOW_PHONE_API_KEY`, `OPENAI_API_BASE`, `OPENAI_API_KEY`, `PYTHONUTF8`, and `PYTHONIOENCODING` were unchanged. Non-dry restoration remains guarded by the inspected `finally` blocks; no non-dry generation was needed or performed in R8.
- Registered-worktree matching uses normalized absolute Git top-level paths from the main repository's porcelain worktree list. Read-only Codex inspection may still target another Git workspace by design; write mode cannot.

### R8 hashes

- `tools/local-ai/android/Invoke-PhoneCodex.ps1` — `4FA84D80363F1168F852EBA8F7D880CE7C72B5C99866592C95B1D973D2932B1E`
- `tools/local-ai/android/Invoke-PhoneAider.ps1` — `B1496EBD002FE606E96659F43A3E288B73EB92FAC8AE108849A2B9B9A4C898C3`
- `tools/local-ai/android/README.md` — `6C110C90405337A772D3154E587F27CDD03931F5ED163966FC7F03EC94F2EB1B`
- `tools/local-ai/android/tests/test_android_kit.py` — `EAB8153233A8A4858FE7A35D47C9026FA8225169AA759A3CE03BBDCC3A7737F9`

No model generation, implementation edit, commit, repository map, persistent environment change, or phone mutation occurred. The only filesystem mutation was the exact temporary unrelated Git repository used for the negative proof, which was removed after verification.

## R10 review — Aider worktree-side-effect hardening

Reviewer: `/root/order595_review_replacement` (independent Spark Tester)

### Verdict

**APPROVED.** The bridge now explicitly prevents Aider from modifying `.gitignore`, disables addition of Aider ignore entries, relocates all three histories into private Git state, disables thinking, and bounds the request timeout. The secondary worktree remained byte-for-byte unchanged during the required dry-run.

### Independent evidence

- Exact bridge/test source inspected. Invocation adds `--no-gitignore`, `--no-add-gitignore-files`, `--no-restore-chat-history`, `--thinking-tokens 0`, `--timeout 180`, and explicit chat/input/LLM history files under `.git/yellow-local-ai/aider-history/<worker>`.
- Pinned Aider 0.86.2 `--help` independently confirmed support for all eight hardening/history flags; native PowerShell argument-array invocation preserves paths and values without command-string interpolation.
- The reviewer stopped only exact 10R tunnel PID 30228, ran `python tools/local-ai/android/tests/test_android_kit.py`, and received **9 Android worker tests passed**. The identical authenticated forward was restored on `127.0.0.1:11435` as PID 19548.
- Safe dry-run against registered secondary worktree `yellow-order175-folio-responsive-containment` succeeded for explicit `PROJECT.md`, reported 7,755 bounded input bytes, authenticated loopback, `auto_commit:false`, `repo_map:false`, and `secret_printed:false`. No Aider generation occurred.
- Secondary `.gitignore` SHA-256 before and after was exactly `C89DBE01BA043178B1497562AA72C99DADB27E7817C3586352F0573B2F6ACD7D`; porcelain status was the same pre-existing ` M .gitignore` before and after. `git diff --check -- .gitignore PROJECT.md` passed and the scoped diff-name set did not change.
- Authenticated post-restoration 10R probe returned health 200 and models 200 with `public_bind:false` and `secret_printed:false`.
- Private history root exists under `.git/yellow-local-ai`; dry-run created no history files. The worktree still contains pre-existing `.aider.chat.history.md` and `.aider.input.history` residue from the earlier pre-repair live attempt. This review did not delete or alter that evidence; the approved repair prevents new harness invocations from selecting those paths.
- Environment restoration remains in the inspected `finally` block for API base/key and Windows UTF-8 variables. The timeout is finite at 180 seconds; thinking tokens are zero in both the flag set and the bounded non-thinking prompt.

### Final hashes

- `tools/local-ai/android/Invoke-PhoneAider.ps1` — `DFB667C1A691F922A26FC6223B4B719401E5FED69057B53BAF91672EB34AD84D`
- `tools/local-ai/android/tests/test_android_kit.py` — `A33B197990C03CA46A3BB0CD91DE62B70191444F05D7F08A935FD742ECCD4A13`

### Residual risk

- This was a required dry-run, so the private history destinations were inspected and CLI-validated but not exercised by a new model generation. The earlier exact Aider smoke remains separate evidence.
- Existing worktree `.aider*` files and the already-dirty `.gitignore` predate this repair. They were proven unchanged, not remediated; cleanup requires a separately scoped decision if desired.

No product file, phone/model, secret, provider, or Aider-generated content was changed.

## R11 review — final Aider non-thinking optimization

Reviewer: `/root/order595_review_replacement` (independent Spark Tester)

### Verdict

**APPROVED.** The narrow optimization is additive and preserves all R10 containment guarantees. Aider is now told not to perform the model-setting capability check and receives `/no_think` as the first prompt line while retaining `--thinking-tokens 0` and the 180-second bound.

### Independent evidence

- Exact source/test inspection found `--no-check-model-accepts-settings` in the native argument array and the message begins `"/no_think`nWork only in the listed files. ..."`. It is not shell-concatenated, and the supplied prompt remains one array argument.
- Pinned Aider 0.86.2 `--help` independently confirmed both `--no-check-model-accepts-settings` and `--thinking-tokens` are supported options.
- Focused static execution imported `test_android_kit.py` and personally ran `test_phone_aider_bridge_is_worktree_and_file_bounded` — **PASS, 1/1**. The prior full **9/9** remains applicable because the fake endpoint, tunnel, phone server, supervisor, Codex bridge, and containment paths were unchanged; the new focused assertion covers both added tokens.
- Safe Aider dry-run against registered secondary worktree `yellow-order175-folio-responsive-containment` and explicit `PROJECT.md` — **PASS**: 7,772 bounded bytes, authenticated loopback endpoint, `auto_commit:false`, `repo_map:false`, `secret_printed:false`; no model generation.
- Secondary `.gitignore` retained exact SHA-256 `C89DBE01BA043178B1497562AA72C99DADB27E7817C3586352F0573B2F6ACD7D` and identical pre-existing porcelain status before/after dry-run.
- All prior hardening remains present: registered Yellow worktree enforcement; explicit files; UTF-8 prompt+file 128 KiB bound; no commits; map tokens zero; no gitignore changes; private histories; no history restore; thinking tokens zero; timeout 180; UTF-8 child environment and `finally` restoration.

### Final hashes

- `tools/local-ai/android/Invoke-PhoneAider.ps1` — `4EBE87B3FE2A4FD62EA60FDDA160ED4DCCF5C2243B8A8369CA20D4611C09B5CA`
- `tools/local-ai/android/tests/test_android_kit.py` — `6F3C47913D8FBF2036D22A963A412745AC64935C5DA9CD1A62DCBCB0D0300F3E`

### Residual risk

- Dry-run cannot prove the phone model will always obey `/no_think`; the explicit directive plus zero thinking-token budget minimizes that behavior, while the earlier Aider smoke remains the live inference evidence.
- The full 9/9 suite was not rerun because this source change does not touch or invalidate the fake-tunnel proof. The directly affected focused test and dry-run were rerun.

No generation, secret output, phone mutation, product edit, or tunnel lifecycle change occurred.

## R9 review — OmniRoute Windows cold-start timeout repair

Reviewer: `/root/order595_review_replacement` (independent Spark Tester)

### Verdict

**APPROVED.** The smoke deadline is now a bounded 90 seconds, which accommodates the observed 59.8-second Windows cold start with about 30 seconds of margin. The security proof is unchanged: loopback health must return 200, unauthenticated model discovery must return 401, no authenticated/model request is made, and the exact Windows process tree is removed in `finally`.

### Independent evidence

- Exact diff inspected at `tools/build-continuity/omniroute.py:460-484`: startup deadline changes from 35 to 90 seconds with an explicit cold-start rationale; health polling remains loopback-only with per-request timeout 5 seconds; unauthenticated `/v1/models` has a bounded 30-second request timeout and must equal 401.
- `python -m unittest tools.build-continuity.test_omniroute -v` — **PASS, 3/3**: SQL.js colocation/idempotence, refusal to overwrite unexpected WASM, and exact Windows `taskkill /PID <launcher> /T /F` cleanup contract.
- Port 22129 was verified free before use. `python tools/build-continuity/omniroute.py --smoke --port 22129` — **PASS**, exit 0 in **9.798 seconds**: health HTTP 200; unauthenticated gateway HTTP 401; tool explicitly reported no authenticated gateway, models, chat, or completion endpoint call.
- Post-smoke: port 22129 listener count **0** and matching Node/cmd gateway process count **0**.
- Final hashes: `omniroute.py` `35B86C9CD181353AFFBEA19D3A67B98015E2776144079EC0A0ACBE6B03F0A986`; focused test `C0CB0CBBEC18E0A7179E23198E0D180E4FE8030BA12D612A42812C2C3084BCA5`.

### Residual risk

- This reviewer run was warm at 9.798 seconds and did not reproduce a Windows cold-cache start. Acceptance relies on the supplied observed 59.8-second cold-start fact plus direct inspection that the new 90-second bound covers it.
- The focused suite does not assert the 90-second deadline constant, so an accidental future regression could evade unit tests; the executable smoke remains the effective proof. Adding a mocked monotonic-time deadline test would improve regression coverage but is not required to accept this narrow repair.
- Hosts slower than 90 seconds still fail closed and retain the private smoke log. Increasing beyond 90 seconds should require new measured evidence rather than an unbounded wait.

No provider was activated, no authenticated endpoint or model was called, no secret was printed, and no Yellow product source was touched.

## R12 review — fail-closed phone temperature guard (2026-09-22)

Reviewer: `/root/astra_orchestration_architecture/guard_independent_review`, independent non-implementer.

### Verdict

**APPROVED for the scoped guard repair and offline supervision contract.** Missing optional thermal tooling no longer means a cool phone: a finite, range-checked battery temperature can establish a reading; absent readings fail closed. The hottest available reading controls admission. This is not real-device 11R acceptance or a claim of instantaneous thermal shutdown.

### Personally executed proof

- Read `PROJECT.md`, Order595, current Phase0 section, decisions D1507/D1508, and the exact guard, start, supervisor and test sources. `bash ./state.sh` failed because the Windows WSL launcher has no `/bin/bash`; `./state.ps1` succeeded: branch `phase-0/founder-context-demo-readiness`, HEAD `a043bb29`, 293 uncommitted paths, app/PostgreSQL/Valkey down.
- `python -B -m unittest discover -s tools/local-ai/android/tests -p test_temperature_guard.py -v`: **8 tests passed**, 0.027 seconds. Actual embedded Python is executed by the tests. Coverage includes 45/49 C refusal without optional sensors, cool battery fallback, unknown temperature refusal, hottest reading wins, invalid/nonfinite readings, optional sensor timeout with/without battery fallback, low battery, unsafe temperature thresholds, and hysteresis guard predicates.
- `Get-NetTCPConnection -State Listen -LocalPort 11435,11436,11437`: retained listener `127.0.0.1:11435`, PID19548. This explains why the fixed-port fake proof cannot safely run unchanged alongside the live 10R tunnel. No stop, restart or request to that listener occurred.
- Executed `test_android_kit.py` using `python -B -` and an in-memory fixture-only substitution from `oneplus10r/11435` to `nord5/11437`; the actual tunnel dry-run and actual probe scripts were unchanged. Added `SO_EXCLUSIVEADDRUSE` and disabled address reuse on the in-memory fake server so an occupied port refuses binding. **9 Android worker tests passed.** Only synthetic `fixture-phone-key` authenticated requests reached the locally owned fake HTTP server; its normal finally cleanup closed the server and removed its synthetic key file. No phone or provider request occurred.
- Located existing bundled `C:/Users/astha/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/usr/bin/sh.exe`; `--version` reports GNU Bash5.2.37. Executed the exact `guard.sh` body through this shell from Python stdin, with only deterministic shell functions replacing `termux-battery-status` and `timeout`; the latter asserts the requested battery timeout equals15. **7/7 cases passed**: 45 refuses,44.9 allows at threshold45;42 refuses,41.9 allows at threshold42; missing temperature refuses;19% battery refuses; threshold46 refuses. Actual embedded Python ran with no optional thermal command available. Shell fixtures do not measure real Android timeout behavior.
- Executed the exact `supervise-worker.sh` body through the same shell with pure shell functions at the guard/server/wake/sleep command boundaries. First guard refusal causes a retry, second admission calls the server, server exit3 causes the next cooling wait, and controlled exit releases the wake lock. Exact trace: `WAKE; GUARD:42; GUARD:42; START:45; UNWAKE`. Thus the production supervisor supplies42 for restart admission and45 to the running-server launcher.
- Preserved two failed reviewer-harness attempts: invoking GNU Bash as `sh` initially rejected the hyphenated fixture function in POSIX mode; after `set +o posix`, Windows default stdin encoding produced a Python non-UTF-8 error at the existing degree symbol. Explicit `encoding='utf-8'` corrected the fixture transport. Neither failure required or caused production changes.

### Contract and limitations

- “42 C resume” means **strictly below42 C**: equality is refused. “45 C stop” means **45 C or above**. The committed unit suite directly substantiates these predicates; the additional reviewer shell fixture substantiates their supervisor wiring.
- `start-server.sh` runs the guard before launching, then after each30-second sleep; a later refusal calls its existing server-stop function and exits3. Battery acquisition is bounded by `timeout15`; optional thermal acquisition passes `timeout=5` to Python. Therefore45 C is a sampled cutoff, not an instantaneous interrupt. Real Android scheduling, sensor freshness, TERM/reaping behavior, and physical temperature accuracy were not exercised by these offline fixtures.
- Temperature threshold is constrained to(0,45], minimum battery threshold to[20,100], battery percentage to[0,100], and readings to[-20,125], with booleans/null/nonfinite values refused. A failed optional thermal probe can use a valid battery reading by design; this does not demonstrate CPU thermal telemetry.
- No implementation file, credentials, provider configuration, phone, tunnel, model, database or product file changed during this review. The only persistent reviewer edit is this append-only review record. Full database/PR gates were not run and are not claimed by this tooling-only acceptance.

### Reviewed SHA-256 identities

- `tools/local-ai/android/guard.sh`: `13F2CD416011DD213DD20987159220F965BC631CB82DF8891D150D9C6EE6BA66`
- `tools/local-ai/android/start-server.sh`: `2FC7432B1A69891542B56C1E3F847C0E554421577B7E9C71D7406A29BE2C66FD`
- `tools/local-ai/android/supervise-worker.sh`: `A32113825392E11C24AB2A911D020AF66EEDC1C7566D3823F71CD4C3418A8F6A`
- `tools/local-ai/android/tests/test_temperature_guard.py`: `F325BE230F550D32156FFBAF516712832C4A876FFE66B7DD7AECDAF6FCA7E713`

## R13 review — OnePlus 11R inference and boot-source acceptance (2026-09-22)

Reviewer: `/root/astra_orchestration_architecture/guard_independent_review`, independent non-implementer. Parent retained implementation ownership. Reviewer operated only read-only SSH inspection, one bounded synthetic inference, and private laptop fixtures; the parent alone repaired/replaced the SSH listener.

### Verdict

**APPROVED: live 11R inference transport, no-UI launcher, and repaired boot-installer source.** The parent may install the exact approved boot source within existing Order595 authority. Installed-hook verification follows separately. No reboot, unattended endurance, actual high-temperature shutdown, real CPU-temperature telemetry, or model-generated operating-system action is accepted or claimed. Founder policy keeps laptop/phone models proposal-only.

### Independent live proof

- Dedicated-key, strict-known-host SSH through laptop port18022 personally identified `CPH2487`, `OP5961L1`, `uid=10411(u0_a411)`. This inspection did not read private-key bytes or print API-key contents.
- `git -C .yellow-phone-worker/llama.cpp rev-parse HEAD`: `b29c606e28a01b1bc8c1351026a0fa6e616bf6c4`.
- Actual configured `Qwen3-4B-Q4_K_M.gguf`: **2,497,280,256 bytes**, SHA-256 `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`. Actual `llama-build/bin/llama-server`: SHA-256 `6bd60bfeeb5779e6fa66ee82341150a3d925e1d9f9f3e7f95d48171f3f3eba51`.
- Actual process chain: supervisor6842 -> launcher6932 -> llama6957, arguments include loopback127.0.0.1:8080, key-file authentication, context8192, threads4, parallel1, `--jinja --no-ui`. Phone key metadata: mode600,43bytes. Guard/start/supervisor hashes match the source identities below.
- Actual `termux-battery-status`:36.2 C initially,36.0 C on final pre-install check,100% battery; actual `.yellow-phone-worker/guard.sh` returned success twice. `/proc/meminfo`: MemTotal15,583,572kB, MemAvailable7,482,392kB at initial inspection. These are instantaneous readings, not sustained performance or thermal proof; battery fallback does not establish CPU temperature.
- Python urllib against the existing authenticated tunnel `http://127.0.0.1:11436`: unauthenticated `/v1/models`401; authenticated `/health`200 and `/v1/models`200. Loaded the local API key solely in process memory without output. One `/v1/chat/completions` request,40-second request bound, max_tokens24,temperature0, synthetic `/no_think` instruction: exact `REVIEW11R_OK`, **2.640 seconds**,11 completion +19 prompt =30 tokens. This is inference transport proof only.
- Optional UI fallback remains a provenance limitation: upstream pinned source permits downloaded `latest` UI assets with a fetched checksum. Inference source is pinned, but the full binary is not reproducible from that commit alone. Reviewed `--no-ui` disables serving the unused UI; this review made no browser/UI request. For future clean builds both `LLAMA_BUILD_UI=OFF` and `LLAMA_USE_PREBUILT_UI=OFF` are needed; existing cached assets may otherwise remain embedded.

### Finding and repair personally verified

- **Initial boot SSH source7FEB1F79 was not approved.** Running `sshd -T` with its exact options showed `PasswordAuthentication no`, but also **`KbdInteractiveAuthentication yes` and `AuthenticationMethods any`**. Thus its stated key-only contract was not enforced.
- Parent repaired the generated hook with `-o KbdInteractiveAuthentication=no -o AuthenticationMethods=publickey`, then replaced only its identified SSH listener. Reviewer subsequently executed the repaired `sshd -T` options: password=no,keyboard-interactive=no,authenticationmethods=publickey,pubkey=yes,listenaddress=127.0.0.1:8022. Fresh strict-key SSH succeeded. Actual replacement listener12727 has those exact command-line options, and the copied candidate at `.yellow-phone-kit/install-boot-helper.sh` matches CE22559D below.
- The running inference supervisor/model were not restarted by this review. Parent's exact listener replacement is attributed to the implementer; reviewer independently verified the resulting settings and process.

### Personally executed offline proof

- `python -B -m unittest discover -s tools/local-ai/android/tests -p test_temperature_guard.py -v`: **8/8 passed**,0.025s.
- Current `test_android_kit.py` with the same R12 in-memory fixture-only Nord5/11437 redirection and exclusive bind: **9/9 passed**. Neither live phone tunnel was stopped; no request reached those tunnels from this fake-endpoint suite.
- Executed exact installer body using GNU Bash5.2.37 against `.git/yellow-local-ai/guard-review-r13-fixture`, redirecting only `$HOME` references in memory to a dedicated fixture variable; real HOME was never reassigned. Supplied three harmless worker scripts and a synthetic public-key marker. **Four cases pass**: default0 installs only model hook; opt-in1 installs both; missing key refuses before hook creation; invalid opt-in refuses before hook creation. Generated model hooks actually execute the harmless supervisor fixture and never invoke the deliberately failing guard/start fixtures. Thus hot boot reaches the supervisor cooling loop instead of terminating at a premature guard.
- Executed generated SSH-hook body with only its `exec` boundary captured: exact password=no,keyboard-interactive=no,publickey-only,pubkey=yes,loopback127.0.0.1,port8022 command. No local SSH daemon was started. Windows fixture `chmod` was a bounded assertion of mode700 rather than a POSIX permission test; actual installed modes require final phone inspection.
- Reviewer fixture limitations/failures retained: initial Git-shell PATH omitted `/usr/bin` so `mkdir` was unavailable; adding that path fixed fixture dispatch. POSIX mode initially refused overriding the `exec` special builtin; Bash mode fixed command interception. Earlier remote inventory stopped at the wrong candidate path (`.yellow-phone-worker` instead of `.yellow-phone-kit`); retry read the correct path. A CRLF terminal `true` and case-sensitive SSH-setting filter were reviewer transport/filter errors; corrected read-only checks produced the evidence above. None was repaired by weakening product assertions or changing implementation.

### Accepted source SHA-256 identities

- `guard.sh`: `13F2CD416011DD213DD20987159220F965BC631CB82DF8891D150D9C6EE6BA66`
- `start-server.sh`: `436DC530F35ECB11C440B5E025E02A8B0251EA192EC85A206590EFFA0C671C63`
- `supervise-worker.sh`: `A32113825392E11C24AB2A911D020AF66EEDC1C7566D3823F71CD4C3418A8F6A`
- `install-boot-helper.sh`: `CE22559D30E6C7B9B4C4E59091AE0D77FEBB8DAF512BFB2D5CF4D292BA311249`
- `tests/test_android_kit.py`: `716B42CD60A03256A5C2885B116BF2B0159F3DFD6E658A2F1C6DF594393D69CC`
- `tests/test_temperature_guard.py`: `F325BE230F550D32156FFBAF516712832C4A876FFE66B7DD7AECDAF6FCA7E713`

Only this review record and the private synthetic laptop fixture were persistently written by the reviewer. No product, database, public service, provider, real credential, model or phone configuration was changed by the reviewer.

### R13 final installed-hook verification

After source approval, the parent installed the two previously absent hooks with `YELLOW_BOOT_SSH=1` and reported opening Termux:Boot once. Reviewer then personally performed fresh strict-known-host, dedicated-key SSH read-only inspection:

- `stat -c '%a %n'` reports **700** for both exact hooks.
- `yellow-llama.sh` SHA-256: `187558691f944ad75aad577bd7b5dc86b462954e38d1f49babba1f9b01f9c2cb`.
- `yellow-loopback-ssh.sh` SHA-256: `e215282906de4427438bc72680c8fc0fe13cce645ebc312f23334bcbf4504c15`.
- Reviewer independently extracted both heredoc bodies from approved installerCE22559D in laptop memory and SHA-256 compared them to the phone results: **both exact matches**. Also inspected their full nonsensitive text: model hook delegates directly to supervisor; SSH hook checks the public-key file and enforces no-password/no-keyboard-interactive/publickey-only on127.0.0.1:8022.
- Running supervisor6842/launcher6932/llama6957 remained intact with `--no-ui`; hardened SSH listener12727 retained exact approved options. Another actual guard execution returned `GUARD_OK`.

**Final verdict: APPROVED installed boot configuration and independently proven 11R inference transport.** Boot-application opening/package state is parent-reported, not independently audited here. No reboot or post-reboot persistence test occurred; autostart after a real reboot remains unproven. Sampled battery-temperature protection, lack of CPU telemetry, and proposal-only worker authority remain explicit limitations.

Final bounded connectivity check: independent TCP connects from the laptop to actual phone192.168.29.95 ports8080 and8022 both returned `ConnectionRefusedError` after2.215 seconds within a3-second bound, while an authenticated request through retained loopback tunnel11436 returned health200. These are corroborating reachability observations, not Android socket-table proof; a firewall can also reject connections. Final laptop listeners remain127.0.0.1:11435/PID19548,11436/PID15836,18022/PID27388; fake-port11437 has no listener. The reviewer neither stopped nor replaced any of them.

## R14 — independent context/dispatcher admission review — 2026-09-22

**Reviewer:** Astra reviewer `/root/astra_review`, non-implementer of this candidate. **Verdict: CHANGES REQUIRED for the new context/dispatcher/wrapper admission slice.** This does not withdraw the prior bounded transport/guard acceptance in R1–R13. No new phone inference, real credential submission, public application/database operation, provider call, deployment or process restart was performed for R14.

Read PROJECT.md, AGENTS.md, Order595, relevant decision/ledger records and existing review; used the code-review skill's security/correctness lens. Personally ran `./state.ps1`: 293 dirty entries; app/PostgreSQL/Valkey down. Existing unrelated dirty files were preserved. Inspection covers the requested ten source/document files plus the appended decision/ledger claims; the tools directory and LOCAL-AI documentation are untracked, so a tracked-only Git diff is not a complete source comparison.

### Executed evidence

- `python -B -m unittest discover -s tools/local-ai -p 'test_*.py' -v`: **8 passed, 0 failed**, 0.108 seconds. This is the three context tests plus five launcher/source-contract tests, not the separate Android live-port suite.
- `[System.Management.Automation.Language.Parser]::ParseFile(...)` personally executed for `yellow-ai.ps1`, `android/Invoke-PhoneAider.ps1`, `android/Invoke-PhoneCodex.ps1`: **0 parse errors in each**. No wrapper was launched against a real model.
- `git diff --check -- tools/local-ai docs/LOCAL-AI.md DECISIONS.log handoff/LEDGER.md`: no whitespace errors in tracked changes; CRLF normalization warning only. Supplementary `git diff --no-index --check -- NUL <file>` for each of the ten untracked candidate files finds **ORCHESTRATION.md:255: new blank line at EOF**. The ledger's unqualified diff-clean claim does not cover that file.
- `python -B D:/Yellow/temp/astra595-context-hostility.py`: reviewer-owned synthetic fixtures and two ephemeral loopback HTTP servers; all seven failure predicates below reproduced. Marker keys were fabricated. Servers shut down; temporary fixtures/junction were removed. No real private key was read by this harness.
- Independent read-only receipt verification used only receipt metadata and canonicalized generated response text, without printing prompts, response contents or credentials. All three saved context SHA-256 values match. The single response SHA-256 matches after Python universal-newline normalization and trimming, as used by the dispatcher; a first raw PowerShell/CRLF comparison did not match, so that was corrected rather than reported as tampering.

### Blocking findings

1. **P1 — automatic context sources bypass the claimed source boundary.** `yellow_context.py:_skill_catalog` directly reads every discovered SKILL.md instead of the confined, bounded, binary/credential-checked source reader. A recognized synthetic `sk-or-v1-...` marker in an *unselected* skill description appears in the resulting laptop packet with `skills=[]`. A real Windows directory junction beneath the synthetic `.agents/skills` directory pointing outside the synthetic repository is also followed, and the external description enters the catalogue. Both actual-effect predicates returned true. `_decision_excerpt` likewise bypasses the safe resolver/per-file admission, though its selected excerpt does receive a pattern check. Apply the same canonical path/reparse, size/encoding and credential checks to every automatically consumed source; add durable negative tests. The ordinary explicit-input tests currently pass while these alternate paths bypass them.

2. **P1 — authenticated redirect/error handling can disclose the phone API key.** `dispatch_local_workers.py:_discover_phone_model` uses the default urllib redirect handler. A 302 from one reviewer-owned loopback origin to another sends the original Authorization Bearer header to the second origin. The implementation does not restrict redirects to the configured endpoint; an external redirect was deliberately not attempted. Disable redirects or enforce an exact allowed origin without forwarding credentials. In a second probe, an internal newline in a fabricated key causes an uncaught invalid-header exception whose string contains both key fragments. `dispatch()` records `str(exc)` for arbitrary exceptions, which would persist/print that material. Validate key shape and replace raw exception text with an allowlisted sanitized failure code. Recheck all authenticated adapters for this property; only the Python discovery path was dynamically reproduced here.

3. **P2 — private directory membership is not generated-packet integrity or secret admission.** The actual `_private_context` admits both a generated packet overwritten after generation (manifest still original) and a wholly fabricated manifestless private file. Neither hash/name/manifest/source identity nor lane is checked. `_dispatch` also admits a recognized synthetic credential marker supplied through the assigned task directly into the captured request payload. Its `resolve()` precedes `is_symlink()`, making that leaf check ineffective; direct symlink creation was unavailable under this Windows principal and is explicitly not claimed as an executed reproduction. PowerShell wrappers likewise check location/leaf type/size but not a generated manifest; ancestor reparse confinement is not established. Require exact generated manifest/digest/lane and bounded final payload admission including assigned task. Treat recognizable-secret checks as defense in depth, not a claim to detect every secret, and retain coordinator explicit-input allowlisting.

4. **P2 — current budgets and governing-context claims do not match admission.** Dispatcher/local wrapper accept 32 KiB and phones 24 KiB without actual tokenizer count or a demonstrated conservative bound for the documented 6,144-token input allowance within the 8,192-token window. The phone dispatcher does not include its added `/no_think\n` in reported/admitted bytes. Aider still permits 128 KiB aggregate files+prompt+packet, and omits its generated instructions/template overhead from that calculation. This does not establish the published total-context guarantee. Separately, the generator truncates constitution/order guardrails, while ORCHESTRATION.md says full PROJECT/AGENTS/order and says never silently trim mandatory instructions. A read-only call to the actual Order595 phone summarizer confirmed a truncated scope with the explicit no-credential-submission/no-application-database exclusions absent. A hash reference is not delivery of those rules. Keep complete mandatory constraints or explicitly govern a complete compact contract; fail admission rather than dropping required constraints. Test exact complete-rendered budgets for every admitted adapter, or clearly disable/exclude legacy adapters from those guarantees.

5. **P2 — governance/documentation needs exact reconciliation before acceptance.** ORCHESTRATION.md still describes a CPU-only host, a 48 KiB laptop generator ceiling, a 10R registry awaiting pairing, and full instruction packets, whereas current source/docs say iGPU enabled, 32 KiB, accepted-supervised 10R and bounded summaries. The newly appended D1508 reuses an existing D1508 at DECISIONS.log lines1615/1617; preserve append-only history and disambiguate by a new unique corrective decision. The ledger assertion of universal symlink/credential rejection is contradicted by findings1–3. Legacy write-enabled Codex/Aider launchers remain clearly nondefault experiments under the proposal-only policy; this review does not newly admit them as autonomous executors or as enforced proposal-only sandboxes.

### Calibration claims and remaining proof boundary

Personally inspected these three private receipts:

- `dispatch-3a1d17f102c268c2327356033fccebc7d788ad4a22d90890fa3f56453d1a72f9.json`: context **21,226 bytes**, zero results, three TimeoutError failures.
- `dispatch-06198539362a5e8966df437aaa99c0969a132c48704664fcaeeebd7536282e8b.json`: context **10,460 bytes**, laptop rendered input **10,766 bytes**, **293.777 seconds**, one response and two phone TimeoutError failures. Canonical response hash matches; response includes database/migration/invariant subject matter. No token usage or finish-reason evidence is retained, so a specific claim that it exhausted its token budget is not independently proven by this receipt.
- `dispatch-9f0e8605d546f07e71ff4bb12938d44a51211898a6c4099219b8bda8ec331fea.json`: context **5,638 bytes**, zero results, two phone TimeoutError failures.

These support the negative timeout/latency account. Labels “21.2/10.5/5.6 KiB” are approximate decimal-kilobyte labels, not exact KiB conversions. Negative calibration does **not** prove useful microtask quality/throughput on the phones; prior tiny transport replies remain separate evidence. The GPU5.77→6.96tokens/s comparison was not present in these dispatch receipts and was not rerun here. Do not upgrade it to reviewer-personally-measured R14 evidence.

The dispatcher currently records receipts after completion, without durable before-call task/attempt/lease/telemetry data, actual token usage, or proof of server idle following timeout. Its single-process thread-pool bound does not enforce a cross-process per-node lease. ORCHESTRATION correctly describes these as coordinator procedures/outstanding work; no durable scheduler, automatic safe resume, three-node useful-work acceptance or timeout cancellation was proven here. No inference retry was performed merely to fill that gap.

### Frozen candidate hashes (SHA-256)

```text
tools/local-ai/yellow_context.py D77239B19B65F53A36FFEFB65F46237279B35F03FDA02EC99503F5C6634E1F10
tools/local-ai/test_yellow_context.py 755E473A07C0B82572FC3E1A47E3955F7555E2FED76A75A9C4F5EB5D65D313A3
tools/local-ai/dispatch_local_workers.py AF61A0E4D1BFCF9667C20B2E3CB330E634B56DFEAF99018E1D57ECF7C06148F7
tools/local-ai/yellow-ai.ps1 03005BC335B4AF9D5EB380178542886576426E070125EB950BC345C97E8A055B
tools/local-ai/android/Invoke-PhoneAider.ps1 28B81DA1D22D35E1F21D90FE8121F65E947633A3E76D72A600F4BF4A997AD0EB
tools/local-ai/android/Invoke-PhoneCodex.ps1 D547880E7E0C4974B3E3C2BF5B9B53DA0CF5DCA3E0999E3B9085002DCD28536F
tools/local-ai/workers.json 3D97B224B233E76BA1B31AF221B280B4AAF62ECBE1B3953013F81F8788BADA61
tools/local-ai/test_local_ai.py 891FCB223D890582B529F843016567F5C6A959AA726B08A2E4523C07ABC10710
tools/local-ai/ORCHESTRATION.md 7F81114D7A4C2C28F0735493531FD59D5EAB7570B637E0B8482A4EDEC906B4AE
docs/LOCAL-AI.md D05154FFE3DB1857DA5E3EF7EE3272BFBA77075D942B43E18FC92DA4FF717E1C
```

**Disposition:** preserve prior accepted transport evidence; repair findings1–5 and rerun independent hostile admission/credential proofs on a newly frozen candidate. No implementation, order, decision or ledger edits were made by this reviewer. Only this review and the reviewer-owned temporary synthetic harness were written.

**End-of-review rehash warning:** after this section was written, a final read-only rehash found concurrent implementation changes: `yellow_context.py` is now `DAF6DEF95391380D6DF040CB88AF2D512C30FD4CE07BF29113CC91873A981D43` and `dispatch_local_workers.py` is now `290F6D99D501E9D1AD8BD4240729117F14F3EAEE66AA4CB9FAA8DB778E1F585C`; ORCHESTRATION remains the hash above. R14 findings and executable evidence bind to the inspected hashes listed above, **not these unreviewed replacement bytes**. No acceptance or failure reproduction is asserted for the replacement. A stable new freeze and independent rerun are required. The review-file whitespace check passes.

## R15 — independent repaired-admission review — 2026-09-22

**Reviewer:** `/root/astra_review`, non-implementer. **Verdict: CHANGES REQUIRED**, narrowed to the two reproducible residual boundary defects below. R14 remains preserved. No real phone/model/provider call, credential access, public/database mutation or implementation edit occurred.

### Personally executed proof

- `python -B -m unittest discover -s tools/local-ai -p 'test_*.py' -v`: **13 passed, 0 failed**, 1.213 seconds.
- `python -B -m unittest discover -s tools/local-ai/android/tests -p 'test_temperature_guard.py' -v`: **8 passed, 0 failed**, 0.025 seconds; actual embedded guard Python with synthetic sensor fixtures. Did not run the separate `test_android_kit.py` live-port fixture because it binds11435, which may be an existing real tunnel.
- PowerShell AST parser on the three changed launchers: **0 errors each**.
- `git diff --no-index --check -- NUL <file>` on all twelve listed untracked candidate files: clean. `git diff --check -- DECISIONS.log handoff/LEDGER.md`: clean except existing line-ending warning. R14 EOF whitespace defect is fixed.
- `python -B D:/Yellow/temp/astra595-r15-hostility.py`: actual imported implementation, synthetic repository, real temporary Windows directory junctions, intercepted request payloads and two reviewer-owned ephemeral loopback HTTP origins. Eleven positive safety predicates pass; two residual predicates fail. The final output reports actual6154/reported6144 phone bytes. Temporary junctions/files and HTTP servers were cleaned up.

### R14 closure and positive controls

The exact recognized-secret catalogue attack now rejects before generation. The actual outside-repository skill-directory junction now rejects. Valid generated packet verification passes; wrong lane, changed body and missing manifest reject. Task credential marker rejects before request; response marker rejects before persistence. Cross-origin discovery redirect rejects and the second server sees no request/header. Malformed-key discovery returns a sanitized exception without either fabricated key fragment. Authenticated POST redirect/malformed-key paths additionally pass the authored tests. `_decision_excerpt` is no longer invoked by packet generation; its old unsafe direct reader is presently dead code, not a current automatic-read path.

The 10R registry/48KiB/full-instruction descriptions are corrected; D1508 and D1509 now have distinct identifiers. ORCHESTRATION explicitly assigns complete instruction reading and scope enforcement to the native coordinator, describes worker summaries as summaries, and retains proposal-only/capability-request restrictions. This is a bounded proposal transport contract, not evidence that a summary grants tools or replaces mandatory instructions. The legacy Codex/Aider paths remain explicitly nondefault experiments; no tool-enabled worker admission was exercised here.

### Residual blockers

1. **P2 — private context-root reparse escape still passes the actual verifier.** `verify_bundle()` resolves `.git/yellow-local-ai/context` before checking its path components, and resolves the candidate before the leaf `is_symlink()` check. Reviewer generated a legitimate synthetic packet/manifest, copied them to a separate temporary directory, replaced only the synthetic private context root with a Windows junction to that external directory, then called actual `_private_context` through the original lexical private path. It **accepted the external packet** (`external_private_root_junction_rejected=false`). The metadata/source fix is effective, but the packet-consumption path still does not uphold the no-reparse/private-repository boundary. Inspect every unresolved component from the actual repository root through `.git`, private directories, bundle and manifest; reject junctions/symlinks before resolution. Add this actual root-junction case and ordinary packet positive control to permanent tests. Direct symlink creation remains unavailable on this principal; no symlink execution proof is claimed.

2. **P2 — complete phone payload exceeds its admitted ceiling.** Actual `_dispatch` with a synthetic phone key and stubbed discovery/request accepts a rendered context+task of exactly6144 bytes, records `input_bytes=6144`, but passes a6154-byte user content to `_request` after prepending `/no_think\n`. No real network request occurred. Construct the exact user content before admission and receipt accounting; boundary tests must accept the true ceiling and reject the first byte above it. Aider's explicit-file/prompt sum likewise does not count its own generated instructions or harness template. Its reduction128KiB→6144bytes is real, but do not describe this as a proven whole-harness total bound: either account/reserve that overhead and test it, or keep the legacy experiment explicitly outside the admitted guarantee. This does not imply a6154-byte request necessarily exceeds the model's8192-token physical window; the reproduced defect is the exact advertised admission/receipt contract.

### Nonblocking documentation/proof limitations

ORCHESTRATION's opening still calls the host CPU-only despite the later iGPU evidence; fix that stale wording. LOCAL-AI still says the single calibration response “exhausted its output budget,” although retained receipts do not contain token counts/finish reason, and decimal-sized packet labels still use approximate KiB units. R14's receipt conclusions therefore remain: measured timeouts/latency and canonical response hashes are supported, usefulness/throughput/output-token exhaustion is not independently established here. No new representative task, token telemetry, durable lease or timeout-idle proof was added by R15. These limitations do not invalidate prior tiny authenticated transport proof.

### R15 inspected hashes (SHA-256)

```text
tools/local-ai/yellow_context.py 9B9BA21258536AE1ACF0BD3D5812C29A5988FA59878F1E322A042E3323C49651
tools/local-ai/verify_context.py 6C78CAF84FCAEABD16B984EC3BDAE7A0C78CCB3123BF55EFC7606371E755D338
tools/local-ai/dispatch_local_workers.py DCB8DBE34CB1615CFDC1824CBB4474FAA4F259D0355738788C2D84A8E8517E6D
tools/local-ai/test_yellow_context.py 1CE597C92C7E5CF43813A3C93BFD8751BE2E61F1F6C62FD60975B7E944490A1D
tools/local-ai/test_dispatcher_security.py 58D1F44B593920E73DAA1E0D56881D7E5E07801F2C490719CA3D15C7471777A8
tools/local-ai/yellow-ai.ps1 8A3B3E1085B17AC4F355FC00A87D8606E917A653FDB5AEDBF6174C52691BC355
tools/local-ai/android/Invoke-PhoneAider.ps1 BA4C5F62B0E09B85D427283C2D56B77C5211190B423B50C762B0670146B52577
tools/local-ai/android/Invoke-PhoneCodex.ps1 EC7E70EC1E8ED5B921BB68B92F05DF1E46D0988E11E5C84850B0E799A9D75E1A
tools/local-ai/workers.json 3D97B224B233E76BA1B31AF221B280B4AAF62ECBE1B3953013F81F8788BADA61
tools/local-ai/test_local_ai.py 891FCB223D890582B529F843016567F5C6A959AA726B08A2E4523C07ABC10710
tools/local-ai/ORCHESTRATION.md F698B826524AC7F66DC78BCFAAC7CD9DD2C253C628FE3A0F29E090683E2BD5F7
docs/LOCAL-AI.md D9FE8940FCB81A89A0526C3D0C24893E0C50CF5829C655849534BEE73C95A3FB
```

Only this review and a reviewer-owned synthetic proof script were written. No implementation fix was made. Request a new frozen candidate for the two remaining boundaries; do not relabel13/0 authored tests as full dispatcher acceptance.

## R16 — independent residual-boundary acceptance — 2026-09-22

**Reviewer:** `/root/astra_review`, non-implementer. **Verdict: ACCEPT the bounded context/dispatch source-admission slice**, following closure of the two R15 blockers and exact Aider-added message accounting. This is source/fixture acceptance, not admission of autonomous tool-enabled workers, useful three-node throughput, durable scheduling/resume or new live-device claims. Prior R14/R15 failures and proof limitations remain preserved.

Personally inspected the corrected verifier, dispatcher and full Aider wrapper. The verifier now checks unresolved private-directory ancestry for symlinks/junctions before resolving it. The dispatcher constructs `wire_text` once, uses its byte length for admission/receipt and sends that same string. Aider constructs `$message` once before admission, counts its UTF-8 bytes plus explicit file bytes, and passes the same variable to `--message`.

### Commands and independently observed results

- `python -B -m unittest discover -s tools/local-ai -p 'test_*.py' -v`: **14 passed, 0 failed**, 1.298 seconds, including the authored real Windows private-root junction regression and retained credential/redirect/manifest checks.
- `python -B D:/Yellow/temp/astra595-r16-boundaries.py`: **all five assertions pass**. Ordinary valid packet accepted; actual external Windows context-root junction rejected; phone request wire content **6144 bytes** equals receipt **6144 bytes**; the **6145-byte** candidate rejects before the intercepted request runs. The fixture loads only a fabricated phone key; discovery/request are intercepted, not real model calls. Temporary junction and directories were removed.
- `& D:/Yellow/temp/astra595-r16-aider.ps1`: independently executes the **actual extracted construction/admission block** from the frozen PowerShell source, not a reimplementation. Empty and8-byte multibyte context cases both accept exact constructed-message-plus37-file-bytes total6144 and reject6145. The script also verifies the actual Aider argument list uses that same `$message`. No Aider process, actual workspace file, key or model endpoint was accessed.
- PowerShell AST parse of `yellow-ai.ps1`, `Invoke-PhoneAider.ps1`, `Invoke-PhoneCodex.ps1`: **0 errors each**.
- Per-file `git diff --no-index --check -- NUL <file>` across the twelve R15 candidate files: clean. Tracked `git diff --check -- DECISIONS.log handoff/LEDGER.md`: clean, with only the existing CRLF normalization warning.

This deliberately bounded retest did not rerun Android transport/thermal workloads; personally executed R15 guard8/0 remains separate evidence. Aider's model-internal system templates and any Codex harness overhead are not measured here. Its explicit file+constructed-message accounting is now exact, but that does not newly authorize the legacy tool-enabled harness or establish an exact whole-model token total. R15's nonblocking stale CPU-only wording, output-budget evidence caveat, approximate units, and live usefulness/timeout-idle limitations remain.

### R16 hashes (SHA-256)

Changed and personally re-executed:

```text
tools/local-ai/yellow_context.py 2A8A328297483D5525A803688861B6FBE84C0E646842F13CEADFBEF21F0679E7
tools/local-ai/dispatch_local_workers.py 68A5C64E63AA176BCF35A3E3E1F48B686914DC693511361DD0938796CBF92B4B
tools/local-ai/test_yellow_context.py 59A2B5F9BCE431112E642D8F14A971C0065CF01A144B03067A71786C1733E466
tools/local-ai/android/Invoke-PhoneAider.ps1 9DA965ACC846EAF563ECCF37C3FABBB8323CE6AA2975827A09C527A6ECED8709
```

Rehashed unchanged from R15: `verify_context.py`6C78CAF8; `test_dispatcher_security.py`58D1F44B; `yellow-ai.ps1`8A3B3E10; `Invoke-PhoneCodex.ps1`EC7E70EC; `workers.json`3D97B224; `test_local_ai.py`891FCB22; `ORCHESTRATION.md`F698B826; `docs/LOCAL-AI.md`D9FE8940. Full corresponding hashes are in R15.

No implementation/order/decision/ledger, public state, phone process or provider was changed by the reviewer. Only the review and two synthetic reviewer proof scripts were written. Keep the one-coordinator/proposal-only/manual-admission policy and explicit independent high-risk gates; this acceptance does not close all of Order595's remaining runtime/productivity evidence.
