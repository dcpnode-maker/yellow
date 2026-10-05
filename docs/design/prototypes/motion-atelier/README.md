# Motion Atelier

Ten original three-dimensional UI motion studies under Order444 / Q215. This is
an approval artifact, **not the live app and not a native-performance benchmark**.
No source under `src/`, database, real document or business operation is modified.

See [DESIGN.md](DESIGN.md) for the requested direction, composition, safety and
accessibility boundaries. Scene modules are separated by ownership to support
parallel work without duplicated applications or dependencies.

## Reproduce

From the active Yellow worktree, using the existing Bun, Chromium and FFmpeg:

```powershell
bun scripts/capture-motion-atelier.ts --only=01 --stills
bun scripts/capture-motion-atelier.ts --only=01
bun scripts/capture-motion-atelier.ts
```

The capture script serves only this folder and the existing pinned Urbanist font
on a temporary loopback port. It owns and closes its headless Chromium instance.
Hardware ANGLE/D3D11 is the default; `--software` explicitly selects SwiftShader.
The existing application on port3000 is never restarted or contacted. Temporary
profiles are bounded to `D:/Yellow/temp/motion-atelier/`; frames are streamed to
FFmpeg rather than retained as large image sequences. Outputs and receipts go to
`.yellow/evidence/motion-atelier/`. `--stills` captures first/middle/final frames.

Interface: `window.motionAtelier.ready`, `ids`, `select(id)`, `renderAt(seconds)`,
`inspect()`. Scene time is0–7seconds. GIFs are900×612,20fps,140frames,7seconds.
Human review of the actual images is still required after an executable pass.

## Capture receipt — 7 September2026

Final run: all ten GIFs,140distinct frames each,7seconds each, zero browser
errors, no clipped visible DOM text and no external asset requests. Actual AMD
Radeon ANGLE/D3D11 renderer;270.187seconds for the batch,61.55MiB finalGIFs.
First/middle/final PNGs and `capture-proof.json` retained. Root inspected actual
images across all concepts. Typecheck passed. Temporary capture directory empty
after owned-process cleanup; live3000 remains ready at a1085178/frontier85.
No production/native performance, OCR, forecasting or completed-workflow claim.

Initial attempts exposed missing CDPmobile, favicon404 and D→C renameEXDEV; these
were corrected and the final complete capture passed. Software rendering was
explicitly replaced with verified hardware. Earlier failed attempts are not
counted as successful exports. Founder selection/visual acceptance remains open.

## Dependency provenance

Three.js **r180**, pinned deliberately for this isolated study, not asserted to be
the latest release. Files downloaded unchanged from the official upstream GitHub
tag: [mrdoob/three.js r180](https://github.com/mrdoob/three.js/tree/r180).
The original MIT license is retained at [vendor/LICENSE](vendor/LICENSE).
No npm install or root lockfile change. The font is the existing local, licensed
Urbanist1.330 dependency. No external asset calls at runtime.
Additional unchanged r180 EffectComposer/RenderPass/ShaderPass/Pass/MaskPass/
SSAOPass/OutputPass, CopyShader/SSAOShader/OutputShader and SimplexNoise files
provide deterministic depth-aware contact occlusion. Their exact paths are
admitted by Q215 and covered by the same retained upstream MIT license.

| File | SHA256 |
|---|---|
| three.module.js | c8211c69345d2e9949dc7a8ac969380497aa0600a5a8ac6a459c8cd02dd9cb8a |
| three.core.js | eb077d2417f61d3e6d9264c317cabc4ea35769ed6b0ab533067292a550784c20 |
| RoundedBoxGeometry.js | c1b7c9bd2cddff2e3f3a0723f618a3d364a47450e3d25771d21faed88410bec8 |
| RoomEnvironment.js | c20f0b4677f6128a138d7152b85cbef9091f4f45cdfa05adca04d40c1697c7ae |
| LICENSE | bfe119ea4fd413f5f7ca3fcd63adb0c4a073ed39daa2fe7d3e6b769e21272601 |
