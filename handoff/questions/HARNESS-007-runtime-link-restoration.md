# HARNESS-007: retained runtime dependency restoration

2026-09-28. Worker 2's fresh version probe returned 127: the loader cannot find
`libllama-common.so.0`. Inspection shows the expected versioned ELF libraries
are retained but all relative SONAME links were omitted during Kaggle restoration.
Model SHA256 passes, and chmod alone does not fix dependency resolution.

The founder's approval was to restore both workers, including the verified
runtime. The original order described executable-bit repair only; that is too
narrow for this observed restoration defect. Coordination decision: explicitly
add exact private-runtime alias restoration, not a security setting change,
dependency download, new model, system-library alteration or loader bypass.

The fixed repair script checks the runtime's exact resolved path, regular ELF
targets and `readelf` SONAME, rejects conflicting existing aliases and never
overwrites files. It recreates only `.so` / `.so.0` relative links to the seven
already inspected versioned members, then requires the original runtime revision
and both CUDA devices before any separately approved finite inference.

No broader authority is inferred from the later request for security bypasses.
Retain failed loader diagnostics and report the actual finite-test result.
