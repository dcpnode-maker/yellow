import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("Settings is a reachable, API-backed progressive disclosure workspace", () => {
  expect(app).toContain('type WorkspacePart =');
  expect(app).toContain('"settings"');
  expect(app).toContain('workspace=settings');
  expect(app).toContain('function PropertySettingsWorkspace');
  expect(app).toContain('queryKey: ["property-settings", propertyId]');
  expect(app).toContain('`/api/v1/properties/${propertyId}/operational-blocks`');
  expect(app).toContain('`/api/v1/properties/${propertyId}/restrictions`');
  expect(app).toContain('`/api/v1/properties/${propertyId}/inventory-policy`');
  expect(app).toContain('loadCommercialSnapshot()');
  expect(app).toContain('loadOperatingPerformance()');
  expect(app).toContain('function MobileSettingsShortcut');
  expect(app).toContain('PROPERTY SETUP');
  expect(app).toContain('Editing remains in the existing governed workflows.');
  expect(app).not.toContain('org_node.config');
});

test("Settings remains a compact mobile workspace rather than a dense configuration form", () => {
  expect(css).toContain('.settings-card-grid');
  expect(css).toContain('.settings-card-grid article');
  expect(css).toContain('min-height: 44px');
  expect(css).toContain('.mobile-settings-link');
  expect(css).toContain('@media (max-width: 980px)');
  expect(css).toContain('.property-settings { padding: 18px 12px');
  expect(css).toContain('overflow-x: clip');
});
