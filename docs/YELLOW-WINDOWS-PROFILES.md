# Reversible Windows Sign-In Profiles (Partial Draft & Concept Preview)

> **STATUS: PARTIAL DRAFT / CONCEPT PREVIEW ONLY**  
> **Notice**: **No profiles are installed, no live optimization is active, and no RAM savings have been realized.**  
> The founder is actively deciding between a user-level sign-in profile manager versus an explicit preboot (BCD/firmware) configuration. All live registry and startup modifications are strictly prohibited and disabled in this gate. Optional candidates on the laptop are already disabled or unmanaged.

`scripts/yellow-startup-profile.ps1` is a small (<=220 lines), read-only audit, planning, and UI preview utility. It contains **no registry writers, installers, uninstallers, process launchers, manifest managers, or locking mechanisms**.

---

## Operating Scope & Boundaries

### 1. Read-Only Audit & Plan
- **Audit**: Reads current free physical memory and top processes by WorkingSet (for informational display only, without inspecting environment variables, secrets, or raw command lines).
- **Plan**: Inspects current-user `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run` entries against an allowlist of optional applications:
  - Allowlisted: `Claude`, `utweb`, `Adobe Acrobat Synchronizer`, `MicrosoftEdgeAutoLaunch_*`, `GoogleChromeAutoLaunch_*`.
  - Protected (never eligible): `Docker Desktop`, `Google Drive`, `Ollama`, audio drivers, Windows Defender / security services, core Windows services, HKLM keys, Startup folders, Scheduled Tasks, and UWP apps.
  - StartupApproved status: Entries marked disabled or with unknown/unsupported byte formats are flagged and rejected.

### 2. Preview Chooser Dialog
- Invoked via `-PreviewChooser`, displays a preview WinForms dialog explaining that it is a **sign-in chooser preview, not a preboot BCD bootloader**.
- Has two options: `Normal Windows` and `Yellow Optimized`.
- Closing the dialog or canceling defaults to `Normal`.
- Returns only the selected string; **executes zero processes and modifies zero system state**.
- Under `-WhatIf`, the UI is completely suppressed and zero actions are taken.

### 3. Hard-Disabled Mutating Modes
- `-Install`, `-Uninstall`, and `-Choose` return an explicit `NOT READY` error and exit with code 1.
- No system changes are made or claimed.

---

## Important System Realities

1. **Transient RAM & Working Sets**:
   - `WorkingSet` figures include shared memory pages (DLLs, system mapped files). Adding up working sets across processes double-counts shared memory.
   - Free physical RAM fluctuates dynamically as the Windows Cache Manager adjusts standby caches.
2. **Comparable Benchmarks**:
   - Meaningful RAM savings measurements require clean, comparable restarts, not promises or instantaneous single-point readings.
3. **App Self-Restoration & Tasks**:
   - Background update tasks or repair tasks in Task Scheduler can still launch applications independently of `HKCU Run`.

---

## Usage Commands

### Audit Mode (Read-Only)
```powershell
pwsh -NoProfile -File .\scripts\yellow-startup-profile.ps1
```

### Plan Mode (Read-Only)
```powershell
pwsh -NoProfile -File .\scripts\yellow-startup-profile.ps1 -Plan
```

### Preview Chooser (UI Preview Only)
```powershell
pwsh -NoProfile -File .\scripts\yellow-startup-profile.ps1 -PreviewChooser
```
