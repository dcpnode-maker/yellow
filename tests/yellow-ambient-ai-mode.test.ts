import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("renders Yellow as an ambient PMS mode instead of a separate assistant modal", () => {
  expect(app).toContain('className={`yellow-ai-mode ${yellowVisualState}`}');
  expect(app).toContain('className="yellow-neon-field"');
  expect(app).toContain("Yellow is active");
  expect(app).toContain('aria-label="Activate Yellow"');
  expect(app).toContain('aria-label="Send request to Yellow"');
  expect(app).toContain("useState<Status | null>(focusedLane ?? null)");
  expect(app).toContain("openOperationalTable");
  expect(app).toContain("/today?lane=${lane}");
  expect(app).toContain("<MovementGrid");
  expect(app).toContain('className={`workspace${activeLane ? " movement-mode" : ""}`}');
  expect(app).not.toContain("SignalOrb");
  expect(app).not.toContain('className="assistant"');
});

test("uses a procedural neon-yellow field with a motion-safe mobile command surface", () => {
  expect(css).toContain(".yellow-neon-field");
  expect(css).toContain("radial-gradient");
  expect(css).toContain("yellow-neon-breathe");
  expect(css).not.toContain(".yellow-rays");
  expect(css).not.toContain("repeating-conic-gradient");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  expect(css).toContain("animation: none");
  expect(css).toContain(".yellow-command-surface");
  expect(css).toContain("grid-template-columns: minmax(0, 720px)");
  expect(css).toContain(".yellow-command-surface > * { pointer-events: auto; }");
  expect(css).toContain("overflow-y: auto");
  expect(css).toContain("grid-column: 1 / -1");
  expect(css).not.toContain(".overwatch-launch");
  expect(css).not.toContain(".signal-orb");
});
