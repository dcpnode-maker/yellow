# HARNESS-005 Windows installer build evidence

Parent implementation evidence, 2026-09-28. This is not independent release
acceptance or permission to activate credentials, models or workers.

Sources: T3 `aea2f6e0eb0ceed32c651a49f17ad2b5c744f217`, adapter
`4b23fb0e2e630182c090a77d47ad0bad03aab524`, unchanged Paperclip
`d554c4789ed3930f8a53ac9fdf6503b3187097da`.

## Supported upstream monitor cache

Rust/MSVC are absent. The upstream packager supports
`T3CODE_DESKTOP_REUSE_RESOURCE_MONITOR=true`; it was used without removing any
native-load, self-containment, license or artifact validation gates.

Official v0.0.42 release assets were checked against GitHub's release digest
and byte length. The generic x64 ZIP has SHA256
`dd8ffab5b2adb64b017201d1488731900eee10b295955f66b9006712584eda9c` but
contains a macOS `.app`/Mach-O payload. It is retained and rejected as Windows
input. The genuine Windows NSIS asset is 197907216 bytes with SHA256
`9bd4a00ae9b4880f85e81376844e4fc1dbc9f719120958d7445b4c2b281e267f`.
It was not run or installed.

The checksum-pinned electron-builder 7zip toolset extracted exactly one bounded
x64 PE monitor member. Native resource-monitor source was checked unchanged
against the upstream commit. The staged executable SHA256 is
`8e92939e272a74483b2f08830dfaaefc5616af8ebfec036c7f67584b2b1bfb4b`.
An initial inline Node PowerShell quoting attempt failed; the supported helper
was put in a source `.mjs` file instead. No package gate was weakened.

## First preparation payload (superseded)

From `D:/Yellow/harness/t3code`:

```powershell
$env:PATH='D:/Yellow/harness/t3code/node_modules/.bin;C:/Program Files/nodejs;'+$env:PATH
& 'C:/Program Files/nodejs/node.exe' node_modules/vite-plus/bin/vp run --filter @t3tools/web --filter t3 --filter @t3tools/desktop build
& 'C:/Program Files/nodejs/node.exe' node_modules/vite-plus/bin/vp run --filter t3 --filter @t3tools/web --filter @t3tools/desktop typecheck
$env:T3CODE_DESKTOP_REUSE_RESOURCE_MONITOR='true'
& 'C:/Program Files/nodejs/node.exe' scripts/build-desktop-artifact.ts --platform win --target nsis --arch x64 --skip-build --output-dir 'D:/Yellow/harness/state-pilot/artifacts/Universal-Harness'
```

All three commands exited 0. Web transformed 6018 modules and ran its licence
gate; server assets and client were staged; desktop bundles passed. Non-fatal
upstream warnings about large web chunks, optional Linux x11 import and CJS
import.meta remain. Server/web/desktop typechecks passed.

Final packaging proof: 48 Windows payload files and 18 sidecar native files
validated, server.asar 69981852 bytes. Installer:
`D:/Yellow/harness/state-pilot/artifacts/Universal-Harness/T3-Code-0.0.40-x64.exe`,
134122798 bytes, SHA256
`0c6707aa3a222d0103ef43006bc503f53e42761c8666a7349ffa8bb2af3538fd`.
The upstream artifact basename/version is retained while productName is
Universal Harness. BUILD-RECEIPT.json beside the installer records exact pins.

## Current permission/lifecycle payload

The same three build/typecheck/package commands were personally rerun at T3
`66409d89686e47c988b7384db17c2e77f2ec6a27` (adapter/Paperclip pins unchanged).
All exited 0; 6018 web modules/licence gate, assets/bundles and all three
typechecks passed. Packaging completed 09:20:23Z, validated 48 payload files
and 18 native sidecars; server.asar is now 69982756 bytes. The installer at
the same path is 134124334 bytes, SHA256
`16ee5b135cd461caba14cec41cb3cba6810c46bc0b3913088fc15cacf50d20da`.
The adjacent BUILD-RECEIPT.json has been updated to this exact payload.

Parent identity-checked desktop stop at root19556 returned processCount0;
profile check passed with all providers disabled; new root720 ready in 7437 ms,
799 MiB across 8 owned processes. No Paperclip, user app or credential changed.
This exercises the final tracked launcher, not installed clean-machine acceptance.

## Remaining distribution limits

This packages the T3-derived desktop and server, including the new preparation
UI. It does not bundle Paperclip or the external adapter or their configured
runtime. Those are still launched from the reviewed local checkouts by the
tracked launcher. No installer execution or installed clean-machine smoke was
performed; no signing claim is made. It is not a self-contained complete
Universal Harness distribution or live-model qualification.
