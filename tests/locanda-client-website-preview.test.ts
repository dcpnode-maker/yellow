import { expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

test("Order 462 Locanda preview is a separate, premium blue guest site with a complete browse-to-enquiry path", async () => {
  const [home, stays, detail, css] = await Promise.all([
    Bun.file(resolve(root, "src/http/client/locanda.html")).text(),
    Bun.file(resolve(root, "src/http/client/locanda-stays.html")).text(),
    Bun.file(resolve(root, "src/http/client/locanda-detail.html")).text(),
    Bun.file(resolve(root, "src/http/client/locanda.css")).text(),
  ]);
  expect(home).toContain("A more considered");
  expect(home).toContain("Born in Riyadh");
  expect(home).toContain("One-Bedroom Apartment with Balcony");
  expect(home).toContain("Two-Bedroom Apartment with Terrace");
  expect(home).toContain("For residents and owners");
  expect(home).toContain('fetchpriority="high"');
  expect(home).toContain('loading="lazy"');
  expect(home).toContain('decoding="async"');
  expect(home).toContain('location.assign(\'/client/locanda-homes/stays?\'');
  expect(stays).toContain("/client/locanda-homes/stays/one-bedroom");
  expect(detail).toContain("Plan your stay");
  expect(detail).toContain("Booking preview · availability is not yet live");
  expect([home, stays, detail].join("\n")).not.toContain("width=8256");
  expect(css).toContain("--navy:#031225");
  expect(css).toContain("scroll-snap-type:x mandatory");
  expect(css).toContain("@media(max-width:800px)");
});

test("Order 462 client preview does not claim live booking or embed Yellow PMS data", async () => {
  const pages = await Promise.all([
    Bun.file(resolve(root, "src/http/client/locanda.html")).text(),
    Bun.file(resolve(root, "src/http/client/locanda-stays.html")).text(),
    Bun.file(resolve(root, "src/http/client/locanda-detail.html")).text(),
  ]);
  const site = pages.join("\n");
  expect(site).not.toMatch(/api\/v1|accessToken|payment|card number|availability is live/i);
  expect(site).toContain("governed booking flow");
});
