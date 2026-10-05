import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CAPABILITY_REGISTRY, isOperationalCapability } from "../frontend/yellow/src/ecosystem/capability-registry";

const source = (file: string) => readFileSync(new URL(`../frontend/yellow/src/${file}`, import.meta.url), "utf8");
const surface = source("ui/HotelSearch.tsx");

test("shared search is present in every shell and respects both existing navigation locks", () => {
  const app = source("App.tsx");
  const headers = [...app.matchAll(/<OperatorHeader\b[\s\S]*?<\/OperatorHeader>/g)];
  expect(headers.length).toBe(10);
  for (const [header] of headers) {
    const entries = [...header.matchAll(/<HotelSearch\b[^>]*\/>/g)];
    expect(entries.length).toBe(1);
    expect(entries[0]![0]).toContain('key={propertyId} propertyId={propertyId}');
    expect(entries[0]![0]).toContain('timezone={selected?.timezone ?? "UTC"}');
    expect(entries[0]![0]).toContain('locked={reservationLifecycleBusy || voiceTransferRecoveryLocked}');
  }
});

test("queries are property-scoped, explicit-submit reads and reuse the existing reservation index", () => {
  expect(surface).toContain('queryKey: ["yellow-reservation-command-index", propertyId]');
  expect(surface).toContain('queryKey: ["hotel-search-profiles", propertyId, submitted]');
  expect(surface).toContain('open && !locked && submitted.length >= 2');
  expect(surface).toContain('queryFn: () => searchPartyProfiles(submitted)');
  expect(surface).toContain('gcTime: 0');
  expect(surface).not.toMatch(/localStorage|sessionStorage|commitCheckIn|postFolioCharge|api.openai|openrouter/);
  expect(surface).toContain('board.isSuccess ? board.data.reservations ?? [] : []');
  expect(surface).toContain('profiles.isSuccess ? profiles.data : []');
});

test("native dialog has escape, focus return, bounded input and partial-failure guidance", () => {
  expect(surface).toContain('<dialog');
  expect(surface).toContain('aria-labelledby={headingId}');
  expect(surface).toContain('modal.showModal()');
  expect(surface).toContain('onCancel={() => setOpen(false)}');
  expect(surface).toContain('trigger.current?.focus()');
  expect(surface).toContain('maxLength={100}');
  expect(surface).toContain('board.isError &&');
  expect(surface).toContain('profiles.isError &&');
  expect(surface).toContain('matches.total > matches.results.length');
});

test("ecosystem opens actual property search and truthfully identifies the partial beta", () => {
  const search = CAPABILITY_REGISTRY.find(row => row.key === "guest-services.universal-search");
  expect(search).toBeDefined();
  expect(search!.status).toBe("beta");
  expect(isOperationalCapability(search!)).toBe(true);
  expect(search!.route).toBe("/p/:propertyId/today?hotelSearch=1");
  expect(search!.statusReason).toContain("not yet included");
  expect(source("workspaces/EcosystemHub.tsx")).toContain('window.location.assign(routeFor(capability, propertyId))');
});
