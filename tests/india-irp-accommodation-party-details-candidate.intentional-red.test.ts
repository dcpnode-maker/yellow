import { expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

test("Order422 intentional red: party-details composer is not admitted yet", () => {
  const source = Bun.file(new URL("india-irp-accommodation-party-details-candidate.ts", sourceRoot));
  const index = Bun.file(new URL("index.ts", sourceRoot));
  expect(source.size).toBeGreaterThan(0);
  expect(index.size).toBeGreaterThan(0);
  return Promise.all([source.text(), index.text()]).then(([moduleText, indexText]) => {
    expect(moduleText).toContain("export function composeIndiaIrpAccommodationPartyDetailsCandidate");
    expect(moduleText).toContain("eligible_irp_accommodation_party_details_candidate");
    expect(indexText).toContain('from "./india-irp-accommodation-party-details-candidate"');
  });
});
