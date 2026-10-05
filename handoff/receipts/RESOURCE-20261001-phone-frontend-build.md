# RESOURCE-20261001 — Actual Android frontend compilation

Controller and final verifier: Codex laptop root. Implementation and independent review were delegated to separate bounded agents; root dispatched through the existing authenticated coordinator and personally inspected actual device receipts.

## Inputs and transport

- Authoritative receiving HEAD: e06e400a57485cc10a8a35c21dcb1e01b5a667d1. This is a source-bound dirty-checkout snapshot, not a claim that all input files are committed.
- 121 frontend source/configuration inputs, 2,194,625 bytes; no generated public bundles, dependencies, credentials or business data.
- Compressed archive: 493,655 bytes, SHA256 48d4e5556c3c279f9ce213e4bc1e3ed0782f6543688fe392f13cfce1b8f0e2c1.
- Exact manifest: c00bee3d65525808a306e64369773fe8c562475042a96d56ac636aee8e7fac1e.
- All 60 immutable source chunk commands completed on client0.3.0 with exit0. Root read every command result in two batches of30, with zero failed commands. Assembler completed exit0, reconstructed the pinned archive and verified every input before exclusive extraction into the owned snapshot directory.
- Final assembler request SHA256: fc99dd5297ca223addae548d4bce36cd1fcb4e302bd4a4f817e56fcdfac3ff9a.

## Actual toolchain and build

OnePlus10R ran Node24.18.0 on Android/arm64. Vite8.3.0, Rolldown1.2.9 and React plugin6.1.1 installed from the official HTTPS npm registry with lifecycle scripts disabled. The native Android binding loaded; its exact package integrity matched the laptop Bun lock.

The exact frontend direct imports were installed in bounded groups: React/ReactDOM19.3.0, TanStack Query5.103.1, Framer Motion13.4.0, MapLibre6.11.1, PMTiles4.5.0 and Cesium1.138.0. All three installation commands completed exit0. Final diagnostic npm lock SHA256: c8f1431c5acdba42473ad7f8a49dd7367dd8228b3a1209b4e28a59ede53945cc.

The actual Vite compile command completed exit0 in2,278.100846ms. It verified the pinned manifest and all121 input hashes before and after execution. It produced20 files totaling3,098,702 bytes under the isolated phone workspace's build-output directory. A separate read-only phone command subsequently rehashed all20 outputs and checked the exact output set and byte total. Root decoded and verified the complete proof bytes on the laptop.

- Final hardened compile request SHA256: 7928f13bf8b2a5f246f15c8351e9bb8902de69263925ec2db1a00ed5d6be47e6.
- Complete compile script SHA256: 65da3bd39712d8fcf68cc6ced23b5f8d6f743c0d2b0815e849f4af0b0188d618.
- Complete returned proof: E:/YellowWorkspace/Data/BuildArtifacts/yellow-phone-frontend-20261001-v1/android-build-proof.json.
- Exact proof SHA256: 6e0bd40001ea2ec79591ad1cbe9de62bb8edc592efcd8ca39dba29ee1f401cb1.
- Root retained sanitized stage/toolchain/dependency/summary proofs and immutable request files separately from private pairing/command receipts. No credential was posted to a chat or made public.

## Retained failures and review

The first installation failed before network activity because npm refuses to load /dev/null as both user and global configuration. Root preserved the workspace and failed receipt; the reviewed repair verified the exact existing manifest and used two distinct empty configuration files. The repair completed exit0.

Before dispatch, root found the original assembler did not store the manifest where the compile expected it. The corrected assembler pins and writes that exact manifest. Independent review also found that existsSync misses dangling symlinks before emptyOutDir; the final compile uses lstat absence checks, source realpath containment and post-build output-root verification. These obsolete prepared requests were never dispatched. The final script uses a digest-verified split-argument launcher within existing command bounds; it does not detach or extend worker deadlines.

## Acceptance boundary

This is actual Android frontend compilation and independent output-hash evidence. The npm graph is diagnostic; its transitive graph and resulting bytes are not asserted identical to the canonical Bun release. Strict TypeScript7 checks remain on laptop/cloud because its published native packages do not list Android. Browser/touch acceptance, APK signing, iOS builds, backend/RBAC/database behavior, reboot/Doze/travel recovery and live promotion are separate work. The phone runs one owned bounded job at a time and hosts no production database. Root obtained actual quota readings before dispatch batches; latest read remained17% above the persistent1% pause threshold.
