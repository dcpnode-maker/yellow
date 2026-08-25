import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

test("Order 158: the operator surface has one responsive application shell", async () => {
  const html = await Bun.file(htmlFile).text();
  const css = await Bun.file(cssFile).text();

  expect(html).toContain("Yellow · Hotel Operations");
  expect(html).toContain('class="domain-bar card" aria-label="Property workspace"');
  expect(html).toContain('class="property-context">Current property');
  expect(html).toContain('id="availability-reservation-shortcut"');
  for (const view of ["availability", "reservations", "folios", "operations", "inventory", "restrictions", "rates", "status"]) {
    expect(html).toContain(`data-view="${view}" aria-controls="${view}-view"`);
  }
  expect(css).toContain("grid-template-columns: 244px minmax(0, 1fr)");
  expect(css).toContain("@media (max-width: 1020px)");
  expect(css).toContain("@media (max-width: 600px)");
  expect(css).toContain("min-height: 44px");
  expect(css).toContain("prefers-reduced-motion: reduce");
});

test("Order 158: presentation fixes do not add browser persistence or authority", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();

  expect(script.match(/if \(activeView === "status"\) void loadSystemStatus\(\);/g)).toHaveLength(2);
  expect(script).toContain('availabilityReservationShortcut.addEventListener("click"');
  expect(script).toContain('setView("reservations")');
  expect(html).toContain("A ten-minute hold protects inventory temporarily; it is not a reservation.");
  expect(`${html}\n${script}`).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|sendBeacon/);
  expect(html).not.toMatch(/<script(?![^>]*\bsrc=)|<style\b|style\s*=/i);
});
