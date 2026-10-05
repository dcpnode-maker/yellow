# Question215 — Ten genuinely rendered 3D motion directions

Accepted founder direction,2026-09-07; presentation-only continuation of Order444.
The founder rejects both previous studies, explicitly requests UI/UX Pro Max,
game-quality graphical depth and ten different GIF prototypes before approval.
This supersedes the single Luminous selection, not the prohibition on live UI
integration without approval. Fiscal checkpoint4c46bee3/CI remains separate.

## Scope and ownership

- Root: this file; Order444; docs/PROJECT-STATUS.md; DECISIONS.log;
  handoff/LEDGER.md; docs/design/prototypes/motion-atelier/README.md,
  DESIGN.md, index.html, atelier.css, atelier.js, kit.js, concepts-signature.js.
- spatial_design_direction: docs/design/prototypes/motion-atelier/concepts-architecture.js.
- q212_independent_proof, newly assigned visual builder only:
  docs/design/prototypes/motion-atelier/concepts-intelligence.js.
- native_resume_builder: scripts/capture-motion-atelier.ts.
- Root may vendor only exact Three.js r180 module/core, RoundedBoxGeometry,
  RoomEnvironment and the upstream MIT LICENSE under
  docs/design/prototypes/motion-atelier/vendor/. No root package/lock change.
- Rendered refinement admission: first frames reveal flat contact lighting. Root
  may also vendor these unchanged r180 files for depth-aware ambient occlusion:
  `vendor/postprocessing/{EffectComposer,RenderPass,ShaderPass,Pass,MaskPass,SSAOPass,OutputPass}.js`,
  `vendor/shaders/{CopyShader,SSAOShader,OutputShader}.js`,
  `vendor/math/SimplexNoise.js`. Same upstream MIT license; no other dependencies.
- Generated screenshots, GIFs and receipts:
  .yellow/evidence/motion-atelier/; bounded temporary captures may use
  D:/Yellow/temp/motion-atelier/. No new worktree, DB, Docker, WSL or app3000.

No product src, migration, business API, authentic guest record, camera upload,
payment, identity-verification claim, deployment or live UI change is admitted.
All operational numbers/checks are prominently labelled illustrative sample data.

## Design and motion

Use the installed UI/UX Pro Max skill and its required design-system/Three.js/
UX searches, then apply the relevant design-system skill for readable tokens and
scene/state rules. The generated grey/bento/hover recommendation is not the
founder's requested direction and is not adopted as a substitute for art direction.
Figma-import motion is not a source of authority here: there is no supplied Figma
timeline. Original Three.js geometry, PBR materials, lighting, actual shadows and
camera/object choreography create these studies; no CSS box rotations pretending
to be game-level 3D or ten palette swaps.

Ten directions: architectural hotel twin, detailed suite configurator, exploded
floor selection, resort/STR landscape, optical identity lens, candidate decision
orbits, revenue terrain, ceramic journey ribbon, sculptural concierge gateway,
and compact mobile spatial-room selection. Each differs in geometry/choreography
and screen composition, not just color.
Prefer composed bright/neutral surroundings, strong text contrast and restrained
highlights; no eye-straining neon wallpaper. One meaningful hero motion at a time.
GIFs intentionally loop to show the requested studies; prototype playback has
pause/replay and reduced-motion rest state. They are not native performance proof.

## Module contract

Scene modules export arrays named architectureConcepts, intelligenceConcepts or
signatureConcepts. Each entry has id (01–10), title, subtitle, category, layout,
summary, checks (four strings), create(THREE,kit).
create returns {root:THREE.Group, update(seconds), camera(seconds)}.
camera returns {position:[x,y,z], target:[x,y,z], fov?:number}.
Use deterministic time0..7, no random/time-dependent rendering. Geometry occupies
roughly x/z±4 and y0..5; stage groundy=-0.12. Safe baseline camera[9,7,11],
target[0,1.4,0],fov38. kit exposes roundedBox(w,h,d,r,material), mat(color,options),
label(text,{size,color}), tube(points,radius,color), smooth(a,b,t).
Main renderer owns ambient/environment/key lights, tone mapping, shadows and camera.

## Verification and delivery

Render one scene end-to-end first, inspect real frames, then batch ten.
Owned Chromium only, loopback ephemeral server, pinned same-origin assets only.
Fixed-time frames encoded with existing FFmpeg; stream frames where possible
to prevent unnecessary disk growth. Keep final GIFs and a few inspection frames,
not unbounded raw footage. Check actual WebGL renderer, no JS/shader errors,
distinct frame hashes, readable uncut overlay, final GIF frame counts/duration.
Root views representative first/middle/final frames and corrects visible defects.
Deliver ten labelled GIFs, clearly design studies for selection; no quality or
native FPS claim solely because code compiled. No founder spending/account needed.
