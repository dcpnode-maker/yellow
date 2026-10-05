import { describe, expect, test } from "bun:test";
import {
  PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS,
  parsePublicPropertyCapture,
} from "../src/contexts/distribution/property-profile-public-capture";
import { composePropertyProfileEvidence } from "../src/contexts/distribution/property-profile-candidate-evidence";
import { runPropertyProfileCaptureCli } from "../scripts/research/property-profile-capture";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CAPTURED = "2026-09-30T12:34:56.123456Z";
const URL = "https://hotelaketadehradun.com/";

function html(nodes: unknown[]): string {
  return "<html><script type=\"application/ld+json\">" + JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }) + "</script></html>";
}

function capture(body: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceUrl: URL,
    finalUrl: URL,
    httpStatus: 200,
    capturedAt: CAPTURED,
    body,
    ...overrides,
  };
}

const hotel = {
  "@type": ["LodgingBusiness", "Hotel"],
  "@id": "https://hotelaketadehradun.com/#hotel",
  name: "Aketa Dehradun",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rajpur Road",
    addressLocality: "Dehradun",
    addressCountry: "IN",
  },
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "Pool", value: false },
    { "@type": "LocationFeatureSpecification", name: "Gym" },
  ],
  image: [
    { "@type": "ImageObject", contentUrl: "https://images.example/aketa.jpg?original=1", width: 1600 },
    { "@type": "ImageObject", contentUrl: "data:image/png;base64,ignore", width: 1, height: 1 },
  ],
  sameAs: [
    "https://www.booking.com/hotel/in/aketa.html",
    "https://maps.app.goo.gl/unresolved",
  ],
  dateModified: "2026-09-28T09:00:00Z",
};

describe("public property JSON-LD capture parser", () => {
  test("extracts lodging node only, explicit provider aliases, provenance and source-advertised media", async () => {
    const result = await parsePublicPropertyCapture(capture(html([
      { "@type": "Organization", name: "Aketa Hospitality Company" },
      hotel,
      { "@type": "WebSite", name: "Aketa website" },
    ])));
    expect(result.issues).toContainEqual({ code: "unresolved-short-link", path: "$.jsonld[0].@graph[1].sameAs[1]" });
    expect(result.observations).toHaveLength(1);
    const observation = result.observations[0]!;
    expect(observation.identity).toEqual({
      provider: "hotelaketadehradun.com",
      accountNamespace: null,
      externalId: "https://hotelaketadehradun.com/#hotel",
    });
    expect(observation.explicitAliases).toEqual([{
      provider: "www.booking.com",
      accountNamespace: null,
      externalId: "https://www.booking.com/hotel/in/aketa.html",
    }]);
    expect(observation.name).toBe("Aketa Dehradun");
    expect(observation.address).toBe("Rajpur Road, Dehradun, IN");
    expect(observation.amenities).toEqual([
      { canonicalKey: "pool", name: "Pool", value: false, scope: "unknown", sourcePath: "$.jsonld[0].@graph[1].amenityFeature[0].value" },
      { canonicalKey: null, name: "Gym", value: null, scope: "unknown", sourcePath: "$.jsonld[0].@graph[1].amenityFeature[1].value" },
    ]);
    expect(observation.images).toEqual([{
      url: "https://images.example/aketa.jpg?original=1",
      width: 1600,
      height: null,
      rightsStatus: "unknown",
      sourcePath: "$.jsonld[0].@graph[1].image[0]",
    }]);
    expect(observation.source).toMatchObject({
      capturedAt: CAPTURED,
      sourceUpdatedAt: "2026-09-28T09:00:00Z",
      httpStatus: 200,
    });
    expect(result.contentSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  test("does not execute scripts or promote company-only documents to lodging profiles", async () => {
    const body = "<script>globalThis.__profileCaptureScriptRan = true</script>"
      + html([{ "@type": "Organization", name: "A company" }]);
    const result = await parsePublicPropertyCapture(capture(body));
    expect((globalThis as { __profileCaptureScriptRan?: boolean }).__profileCaptureScriptRan).toBeUndefined();
    expect(result.observations).toEqual([]);
    expect(result.issues).toContainEqual({ code: "no-lodging-node", path: "$.jsonld" });
  });

  test("HTML parsing ignores attribute lookalikes, comments, textarea contents and untrusted schema contexts", async () => {
    const json = JSON.stringify({ "@type": "Hotel", name: "Should not be promoted" });
    const body = `<script data-type="application/ld+json" type="text/plain">${json}</script>`
      + `<!--<script type="application/ld+json">${json}</script>-->`
      + `<textarea><script type="application/ld+json">${json}</script></textarea>`
      + `<template><script type="application/ld+json">${json}</script></template>`
      + `<script type="application/ld+json">${JSON.stringify({ "@context": "https://evil.example", "@type": "https://evil.example/Hotel", name: "Evil" })}</script>`
      + [
        "https://schema.org/not-a-type/Hotel",
        "https://evil@schema.org/Hotel",
        "https://schema.org:444/Hotel",
        "https://schema.org/Hotel?type=evil",
        "https://schema.org/Hotel#evil",
      ].map(type => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": type, name: "Invalid type identity" })}</script>`).join("");
    const result = await parsePublicPropertyCapture(capture(body));
    expect(result.observations).toEqual([]);
    expect(result.issues).toContainEqual({ code: "no-lodging-node", path: "$.jsonld" });

    const templateThenValid = await parsePublicPropertyCapture(capture(
      `<template><script type="application/ld+json">${json}</script></template>`
        + html([{ "@context": "https://schema.org", "@type": "https://schema.org/Hotel", name: "Valid sibling" }]),
    ));
    expect(templateThenValid.observations).toHaveLength(1);
    expect(templateThenValid.observations[0]?.name).toBe("Valid sibling");
  });

  test("rejects duplicate JSON keys instead of accepting last-key-wins identity or provenance", async () => {
    const body = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Hotel","@id":"https://hotel.example/a","@id":"https://hotel.example/b","name":"A"}]}</script>`;
    const result = await parsePublicPropertyCapture(capture(body));
    expect(result.observations).toEqual([]);
    expect(result.issues).toContainEqual({ code: "invalid-jsonld", path: "$.jsonld[0]" });
  });

  test("bounds diagnostics and traversal for deeply nested large arrays of null", async () => {
    let graph: unknown[] = Array.from({ length: 10_000 }, () => null);
    for (let index = 0; index < 8; index += 1) graph = [graph];
    const body = html([{ "@type": "Hotel", name: "Bounded" }, ...graph]);
    const result = await parsePublicPropertyCapture(capture(body));
    expect(result.issues.length).toBeLessThanOrEqual(PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxIssues);
    expect(JSON.stringify(result).length).toBeLessThan(50_000);
    expect(result.issues.some(issue => ["node-limit", "issue-limit", "nesting-limit"].includes(issue.code))).toBe(true);
  });

  test("surfaces malformed JSON-LD while extracting a separate valid lodging node", async () => {
    const body = "<script type='application/ld+json'>{bad json</script>" + html([hotel]);
    const result = await parsePublicPropertyCapture(capture(body));
    expect(result.issues).toContainEqual({ code: "invalid-jsonld", path: "$.jsonld[0]" });
    expect(result.observations).toHaveLength(1);
  });

  test("rejects unsafe and relative image URLs without fetching or rewriting URLs", async () => {
    const result = await parsePublicPropertyCapture(capture(html([{
      ...hotel,
      image: [
        "//images.example/relative.jpg",
        "http://images.example/insecure.jpg",
        "https://user:pass@images.example/private.jpg",
        "https://images.example/signed.jpg?access_token=do-not-output",
        "https://localhost./private.jpg",
        "https://images.example/a\nb.jpg",
        "https://images.example/a\tb.jpg",
        "https://images.example/a\rb.jpg",
        "https://images.example/a b.jpg",
      ],
    }])));
    expect(result.observations[0]?.images).toEqual([]);
    expect(result.issues.filter(issue => issue.code === "invalid-url")).toHaveLength(9);
  });

  test("does not merge same-name nodes without stable IDs and reports each ambiguity", async () => {
    const result = await parsePublicPropertyCapture(capture(html([
      { "@type": "Hotel", name: "Same Hotel" },
      { "@type": "Hotel", name: "Same Hotel" },
    ])));
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0]?.identity.externalId).not.toBe(result.observations[1]?.identity.externalId);
    expect(result.issues.filter(issue => issue.code === "missing-stable-identity")).toHaveLength(2);
  });

  test("preserves allowed query identity and exact source URLs when a node lacks @id", async () => {
    const body = html([{ "@type": "Hotel", name: "Query identified property" }]);
    const one = await parsePublicPropertyCapture(capture(body, {
      sourceUrl: "https://hotel.example/property?id=123",
      finalUrl: "https://hotel.example/property?id=123",
    }));
    const two = await parsePublicPropertyCapture(capture(body, {
      sourceUrl: "https://hotel.example/property?id=456",
      finalUrl: "https://hotel.example/property?id=456",
    }));
    expect(one.observations[0]?.source.sourceUrl).toBe("https://hotel.example/property?id=123");
    expect(one.observations[0]?.source.finalUrl).toBe("https://hotel.example/property?id=123");
    expect(one.observations[0]?.identity.externalId).not.toBe(two.observations[0]?.identity.externalId);
    expect(composePropertyProfileEvidence({
      observations: [...one.observations, ...two.observations],
    }).drafts).toHaveLength(2);
    const changedCapture = await parsePublicPropertyCapture(capture(html([{ "@type": "Hotel", name: "Changed body" }] ), {
      sourceUrl: "https://hotel.example/property?id=123",
      finalUrl: "https://hotel.example/property?id=123",
    }));
    expect(one.observations[0]?.identity.externalId).not.toBe(changedCapture.observations[0]?.identity.externalId);
  });

  test("snapshots capture envelopes and rejects own accessors and cycles without invoking getters", async () => {
    let getterCalls = 0;
    const withGetter = Object.defineProperties({}, {
      sourceUrl: { value: URL, enumerable: true },
      finalUrl: { value: URL, enumerable: true },
      status: { value: 200, enumerable: true },
      capturedAt: { value: CAPTURED, enumerable: true },
      body: { enumerable: true, get() { getterCalls += 1; return html([hotel]); } },
    });
    const rejected = await parsePublicPropertyCapture(withGetter);
    expect(rejected.issues).toContainEqual({ code: "invalid-capture", path: "$" });
    expect(getterCalls).toBe(0);
    const cyclic: Record<string, unknown> = capture(html([hotel]));
    cyclic.self = cyclic;
    expect((await parsePublicPropertyCapture(cyclic)).issues).toContainEqual({ code: "invalid-capture", path: "$" });
  });

  test("rejects impossible UTC dates and credential-like source query keys", async () => {
    const impossibleDate = await parsePublicPropertyCapture(capture(html([hotel]), {
      capturedAt: "2026-02-30T10:00:00.123456Z",
    }));
    expect(impossibleDate.issues).toContainEqual({ code: "invalid-capture-time", path: "$.capturedAt" });
    const secretQuery = await parsePublicPropertyCapture(capture(html([hotel]), {
      sourceUrl: "https://hotel.example/property?access_token=do-not-output",
    }));
    expect(secretQuery.issues).toContainEqual({ code: "invalid-url", path: "$.sourceUrl/finalUrl" });
    expect(JSON.stringify(secretQuery)).not.toContain("do-not-output");
  });

  test("enforces a document-wide evidence-string budget", async () => {
    const amenities = Array.from({ length: 33 }, (_, index) => ({
      "@type": "LocationFeatureSpecification",
      name: "Source amenity " + index,
      value: true,
    }));
    const images = Array.from({ length: 33 }, (_, index) => "https://images.example/" + index + ".jpg");
    const result = await parsePublicPropertyCapture(capture(html([{
      ...hotel,
      amenityFeature: amenities,
      image: images,
    }])));
    expect(result.observations).toEqual([]);
    expect(result.issues).toContainEqual({ code: "evidence-limit", path: "$.jsonld[0].@graph[0]" });
  });

  test("honors exact 2 MiB UTF-8 boundary and rejects one additional multibyte byte", async () => {
    const prefix = html([hotel]) + "é";
    const baseBytes = new TextEncoder().encode(prefix).byteLength;
    const exactBody = prefix + "x".repeat(PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxUtf8Bytes - baseBytes);
    expect(new TextEncoder().encode(exactBody).byteLength).toBe(PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxUtf8Bytes);
    const exact = await parsePublicPropertyCapture(capture(exactBody));
    expect(exact.utf8Bytes).toBe(PROPERTY_PROFILE_PUBLIC_CAPTURE_LIMITS.maxUtf8Bytes);
    expect(exact.observations).toHaveLength(1);

    const overBody = exactBody + "x";
    const over = await parsePublicPropertyCapture(capture(overBody));
    expect(over.observations).toEqual([]);
    expect(over.issues).toContainEqual({ code: "capture-too-large", path: "$.body" });
  });

  test("real CLI wrapper is offline, inspectable, and preserves empty extraction as incomplete", async () => {
    const root = mkdtempSync(join(tmpdir(), "yellow-profile-capture-"));
    try {
      const input = join(root, "capture.json");
      const output = join(root, "draft.json");
      writeFileSync(input, JSON.stringify({ captures: [capture(html([
        { "@type": "Organization", name: "Company only" },
      ]))] }));
      const receipt = await runPropertyProfileCaptureCli(["--input", input, "--output", output]);
      const draft = JSON.parse(readFileSync(output, "utf8")) as {
        status: string;
        profiles: unknown[];
        captures: Array<{ contentSha256: string; observationCount: number }>;
        issues: Array<{ code: string }>;
      };
      expect(receipt.status).toBe("incomplete");
      expect(draft.status).toBe("incomplete");
      expect(draft.profiles).toEqual([]);
      expect(draft.captures[0]?.observationCount).toBe(0);
      expect(draft.captures[0]?.contentSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(draft.issues.map(issue => issue.code)).toContain("no-lodging-node");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
