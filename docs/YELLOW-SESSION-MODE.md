# Yellow Session Mode

## Purpose & Scope
`scripts/enter-yellow-mode.ps1` is a small, reversible Windows 11 session helper designed to assist developer environments by reporting memory usage and offering an explicit, non-destructive path to gracefully close designated optional user-facing applications.

## Key Design Principles & Invariants
- **Read-Only by Default**: Without explicit action flags, the script operates strictly as an informational diagnostic tool. It reports available physical RAM (or safely reports `Unavailable` if inaccessible), lists grouped top process footprints, and identifies candidates without modifying any system or process state.
- **Top Footprint Diagnostics & Protection**: High-footprint processes (such as Codex, ChatGPT, node, bun, browsers, and Yellow backend services) are retained and displayed in the grouped memory diagnostics, but are strictly excluded from candidate selection.
- **Strict Candidate Allowlist**: Only explicit application process names are eligible candidates: `Zed`, `Claude`, `Spotify`, `Teams`, `ms-teams`, `OneDrive`, `AcroRd32`, `Acrobat`, `utweb`, `Telegram`, `WhatsApp`, `Discord`.
- **Fully Qualified Path & Window Requirements**: Candidates must reside in the current Windows interactive session, have an accessible StartTimeUtc, possess a non-zero main window handle (`MainWindowHandle -ne 0`), and have a fully qualified Windows absolute executable path (rejecting drive-relative and root-relative paths). Note: a non-zero `MainWindowHandle` confirms desktop window attachment; it does not test visibility state or protect specifically against minimized windows.
- **Graceful Lifecycle Management**: The script never issues force-kill or tree-kill calls (`Stop-Process`, `taskkill /F`). Only the win32/live adapter `CloseMainWindow()` is permitted.
- **Strict Revalidation & Drift Check**: Selected PIDs are preflighted against candidate policy before any action. Immediately before issuing each close signal, the process snapshot is re-fetched and re-checked individually across StartTime, Path, ProcessName, SessionId, and MainWindowHandle to prevent PID reuse, drift, or closing background instances. If a target is omitted from the live snapshot, exit is treated as unverified (`StillRunning`) and zero close actions are attempted.
- **Support for ShouldProcess & Confirm**: Uses `ShouldProcess` per target process to honor PowerShell `-Confirm` and `-WhatIf` mechanics. `ShouldProcess` executes *before* fresh revalidation so user confirmation delays cannot render the live check stale. In non-interactive or automated environments, pass `-Confirm:$false` alongside `-Apply -ConfirmSavedWork -ProcessIds <PIDs>` to bypass the High-impact confirmation prompt.
- **Bounded Wait & Verification**: The script verifies termination using `Process.WaitForExit(5000)` on verified process handles or a bounded poll (monotonic Stopwatch with max 20 polls). If process status cannot be verified with certainty, it safely reports the application as still-running rather than assuming exit from snapshot omission.
- **Truthful Reporting**:
  - `Exited`: The application's termination was positively verified (via `WaitForExit` or `HasExited`), not merely acknowledged.
  - `Refused`: `CloseMainWindow()` returned false (e.g. refused or already closing).
  - `StillRunning`: The application received the request but remained active or unverified after 5s (e.g., waiting on user confirmation to save unsaved documents).

## Usage

### Read-Only Diagnostic Report
```powershell
.\scripts\enter-yellow-mode.ps1
```

### Dry Run (WhatIf)
```powershell
.\scripts\enter-yellow-mode.ps1 -Apply -ProcessIds 1234, 5678 -ConfirmSavedWork -WhatIf
```

### Graceful Close of Specific Candidate Processes (Interactive)
```powershell
.\scripts\enter-yellow-mode.ps1 -Apply -ProcessIds 1234, 5678 -ConfirmSavedWork
```

### Unattended Execution
```powershell
.\scripts\enter-yellow-mode.ps1 -Apply -ProcessIds 1234, 5678 -ConfirmSavedWork -Confirm:$false
```

## Reversibility & Realistic Expectations
- **No System Mutation**: No registry keys, scheduled tasks, Windows services, or boot/autostart settings are touched.
- **Restoration**: Applications closed via this helper are reopened manually by the user as needed.
- **Memory Observations**: Closing individual processes does not guarantee a 1:1 recovery of working set memory due to shared memory pages and Windows memory manager caching.
- **Standalone Harness**: This script is not a persistent supervisor or daemon. Core orchestration remains owned by the primary coordination owner.
