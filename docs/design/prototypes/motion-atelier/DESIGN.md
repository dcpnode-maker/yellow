# Yellow Motion Atelier — ten approval studies

Founder feedback, 7 September 2026: palette changes and floating boxes did not
meet the requested visual quality. These studies replace that exploration with
original, genuinely rendered spatial scenes. They are not approved product UI.

## Art direction

A considered hospitality workspace, with physical depth and calm reading surfaces.
Ivory limestone, dark olive ink, brushed champagne metal, translucent optical
glass, upholstered furniture, and warm architectural light. Visual interest comes
from precision geometry, depth, shadows and choreography—not saturation or clutter.

1. **Atlas:** section a furnished hotel around its atrium and service route.
2. **Sanctuary:** detailed suite with staged privacy, work and lounge changes.
3. **Cascade:** five furnished floors separate; one level comes forward.
4. **Courtyard:** STR resort with cottages, terraces, planting, water and paths.
5. **Lens:** a physical optical carriage examines an illustrative identity draft.
6. **Converge:** room candidates follow individual rails toward a selection plinth.
7. **Contours:** real demand-height geometry, contour lines and a moving section.
8. **Continuity:** a ceramic path carries a guest token through handoff portals.
9. **Threshold:** layered architectural gateway opens onto a furnished suite.
10. **Palm:** native-sized mobile surface with a dimensional suite preview.

Each is a different interaction metaphor and spatial composition, not ten skins.
Numbers, guests, checks and geometry are synthetic. Demonstration steps explain the
animation; they are not claims that an AI inspected real hotel data or evaluated
every possible outcome. Lens neither photographs a real ID nor verifies identity.

## Applied skills

UI/UX Pro Max was explicitly requested and used: full instruction/pro-rules reads,
design-system search, Three.js stack search, motion/accessibility search. Its generic
grey/bento/hover suggestion was not treated as the founder's art direction. The
design-system skill supplies token consistency, accessible contrast, states and
clear component responsibilities. Figma motion import was inspected but does not
apply because no Figma timeline was supplied. No additional paid plugin is needed.

## Framing and motion

- Neutral static typography and a single dominant spatial scene; task details
  never travel around the camera with the geometry.
- Short titles, a four-stage illustrative flow, and a visible concept/sample badge.
- Deterministic seven-second camera/object choreography. CSS does not simulate 3D.
- Frame sequences are for approval; GIF delivery does not establish native FPS.
- The interactive study has pause/replay, keyboard-focus styling and a resting
  initial frame under reduced motion. The requested GIFs necessarily loop.
- Do not integrate into the live application before founder selection. Production
  should retain an ordinary accessible task surface and a lightweight fallback;
  camera motion must never be mandatory to perform a hotel operation.

## Technical composition

Pinned Three.js r180, locally served ES modules, original procedural geometry,
physical materials, one shadow-casting key light, environmental reflections,
hemisphere/fill lighting, ACES tone mapping and a receiving ground plane.
Depth-aware ambient occlusion adds contact definition and restrained environmental
intensity prevents white materials from losing their shape. The beauty targets
use4×MSAA. Occlusion sampling is deterministic across independent captures.
Fine details are geometry; surfaces use no downloaded third-party art or guest data.
Per-scene update functions seek to any timestamp without accumulating state.
The isolated capture server has no application/DB/provider dependency.

Renderer output, shader errors, geometry counts, deterministic frames and visible
framing are checked before delivery. The supplied capture script records evidence;
code validity alone is not visual acceptance.
