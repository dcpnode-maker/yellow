import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../frontend/yellow/src/ui/BusinessMappings.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../frontend/yellow/src/ui/business-mappings.css", import.meta.url), "utf8");

test("business mappings load and save through explicitly property-scoped authenticated requests", () => {
  expect(api).toContain("async function loadCommercialMappings(propertyId: string)");
  expect(api).toContain("async function saveCommercialMappings(propertyId: string, input: SaveCommercialMappingsInput)");
  expect(api).toContain("/api/v1/properties/${encodeURIComponent(propertyId)}/commercial-mappings");
  expect(api).toContain("authorization: `Bearer ${await session()}`");
  expect(component).toContain("expectedVersion: snapshot.latestVersion");
  expect(component).toContain("await loadCommercialMappings(propertyId)");
  expect(component).not.toMatch(/localStorage|sessionStorage/);
});

test("the form exposes demand, distribution, channel and market mappings with shared searchable table controls", () => {
  for (const text of ["Demand groups and segments", "Source and channel relationships", "Channel codes", "Market to segment", "Add demand group", "Add segment", "Add distribution group", "Add source", "Add market mapping"]) {
    expect(component).toContain(text);
  }
  expect(component).toContain("<TableControls label=\"Market mappings\"");
  expect(component).toContain("queryTableRows(marketRows, marketColumns, query)");
  expect(component).toContain("originalIndex");
  expect(component).toContain("confirmRemove");
  expect(component).toContain("onDirtyChange");
  expect(component).toContain("beforeunload");
  expect(component).toContain("dialog.showModal()");
  expect(component).toContain("onCancel={() => finishConfirmation(false)}");
  expect(component).toContain("confirmationReturnFocus.current");
  expect(component).not.toContain("window.confirm");
  expect(component).toContain("Discard edits and reload");
  expect(component).toContain("Remove from draft");
  expect(styles).toContain("@media (max-width: 760px)");
});

test("draft state and errors are explicit; company and room class mappings remain unchanged", () => {
  expect(component).toContain("Drafts do not change live reports.");
  expect(component).toContain("active configuration and operational business rules remain unchanged");
  expect(component).toContain("result.draft?.content ?? result.active?.content ?? EMPTY_CONTENT");
  expect(component).toContain("companies: content.companies");
  expect(component).toContain("roomClasses: content.roomClasses");
  expect(component).toContain("saved version to verify before retrying");
  expect(component).toContain("newer mapping version was saved elsewhere");
  expect(component).toContain("Read only for this session");
  expect(component).not.toMatch(/<textarea|JSON\.stringify\(.*content/);
});
