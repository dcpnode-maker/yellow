import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { chmodSync, copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  PLACE_CATALOG_LIMITS,
  PlaceCatalog,
  PlaceCatalogError,
  PlaceCatalogInputError,
} from "../src/contexts/distribution/place-catalog";

const repository = resolve(import.meta.dir, "..");
const temporary = mkdtempSync(join(tmpdir(), "yellow-place-catalog-"));
const sourcePath = join(temporary, "places.ndjson");
const catalogPath = join(temporary, "places.sqlite");
let catalog: PlaceCatalog;

function place(id: string, name: string, longitude: number, latitude: number, changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    names: { primary: name },
    categories: { primary: "hotel" },
    confidence: 0.85,
    websites: [`https://example.com/${id}`],
    addresses: [{ freeform: "1 Road", locality: "Dubai", region: "Dubai", postcode: null, country: "AE" }],
    operating_status: null,
    sources: [{ property: "fixture", dataset: "synthetic", record_id: id }],
    overture_release: "2026-08-19.0",
    overture_schema_version: "1.18.0",
    ...changes,
  };
}

beforeAll(() => {
  const attack = "</script><img src=x onerror=alert(1)>";
  const records = [
    place("dubai-a", "Desert Hotel", 55.2708, 25.2048, { websites: ["https://shared.example/stay", "https://shared.example/book", "javascript:alert(1)"] }),
    place("dubai-b", "Desert House", 55.2800, 25.2100, { websites: ["https://shared.example/other"], operating_status: "open" }),
    place("solo-domain", "Solo Domain Hotel", 54.9000, 25.2150, { websites: ["https://solo.example/stay", "https://solo.example/book"] }),
    place("xss-safe", attack, 55.29, 25.22),
    place("date-east", "Date East", 179.5, 10),
    place("date-west", "Date West", -179.5, 10),
  ];
  writeFileSync(sourcePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const result = Bun.spawnSync([
    "python3", join(repository, "scripts/research/build-place-catalog.py"), sourcePath, "--output", catalogPath,
  ], { cwd: repository, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  catalog = new PlaceCatalog({ path: catalogPath });
});

afterAll(() => {
  catalog?.close();
  chmodSync(catalogPath, 0o644);
  rmSync(temporary, { recursive: true, force: true });
});

function inputError(action: () => unknown): PlaceCatalogInputError {
  try {
    action();
  } catch (error) {
    if (error instanceof PlaceCatalogInputError) return error;
    throw error;
  }
  throw new Error("expected input error");
}

function writableCatalogCopy(name: string): string {
  const path = join(temporary, name);
  copyFileSync(catalogPath, path);
  chmodSync(path, 0o644);
  return path;
}

function expectCorrupt(action: () => unknown, code?: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PlaceCatalogError);
    expect((error as PlaceCatalogError).kind).toBe("catalog_corrupt");
    if (code !== undefined) expect((error as PlaceCatalogError).code).toBe(code);
    return;
  }
  throw new Error("expected corrupt catalog error");
}

describe("Order RMS-PLACES-001 immutable public place catalog", () => {
  test("searches a bounded bbox and returns neutral source strings", () => {
    const result = catalog.search({ mode: "bbox", west: 55, south: 25, east: 56, north: 26, limit: 20 });
    expect(result.release).toBe("2026-08-19.0");
    expect(result.schemaVersion).toBe("1.18.0");
    expect(result.places.map(({ id }) => id)).toEqual(["dubai-a", "dubai-b", "xss-safe"]);
    expect(result.places.find(({ id }) => id === "xss-safe")?.name).toBe("</script><img src=x onerror=alert(1)>");
    expect(result.places[0]?.status).toBe("unknown");
    expect(result.places[0]?.sources).toEqual([{ dataset: "synthetic", property: "fixture", record_id: "dubai-a" }]);
    expect(result.places[0]?.websites).toEqual(["https://shared.example/book", "https://shared.example/stay"]);
  });

  test("supports a narrow antimeridian bbox without scanning the globe", () => {
    const result = catalog.search({ mode: "bbox", west: 179, south: 9, east: -179, north: 11 });
    expect(result.places.map(({ id }) => id)).toEqual(["date-east", "date-west"]);
    expect(inputError(() => catalog.search({ mode: "bbox", west: 170, south: 9, east: -170, north: 11 })).code).toBe("bbox_too_large");
    expect(inputError(() => catalog.search({ mode: "bbox", west: NaN, south: 9, east: 10, north: 11 })).code).toBe("invalid_bbox");
  });

  test("enforces keyword length and uses deterministic opaque pagination", () => {
    expect(inputError(() => catalog.search({ mode: "keyword", q: " " })).code).toBe("invalid_keyword");
    const first = catalog.search({ mode: "keyword", q: "DESERT", limit: 1 });
    expect(first.places.map(({ id }) => id)).toEqual(["dubai-a"]);
    expect(first.truncated).toBe(true);
    expect(first.nextCursor).toBeString();
    const second = catalog.search({ mode: "keyword", q: "desert", limit: 1, cursor: first.nextCursor });
    expect(second.places.map(({ id }) => id)).toEqual(["dubai-b"]);
    expect(second.truncated).toBe(false);
    expect(inputError(() => catalog.search({ mode: "keyword", q: "date", cursor: first.nextCursor })).code).toBe("invalid_cursor");
    expect(catalog.search({ mode: "keyword", q: "missing" }).places).toEqual([]);
  });

  test("normalizes exact URLs and exposes domain ambiguity explicitly", () => {
    const exact = catalog.search({ mode: "url", url: "HTTPS://SHARED.EXAMPLE:443/stay#ignored" });
    expect(exact.places.map(({ id }) => id)).toEqual(["dubai-a"]);
    expect(exact.ambiguous).toBe(false);
    const domain = catalog.search({ mode: "domain", domain: "SHARED.EXAMPLE." });
    expect(domain.places.map(({ id }) => id)).toEqual(["dubai-a", "dubai-b"]);
    expect(domain.ambiguous).toBe(true);
    const firstPage = catalog.search({ mode: "domain", domain: "shared.example", limit: 1 });
    expect(firstPage.places.map(({ id }) => id)).toEqual(["dubai-a"]);
    expect(firstPage.nextCursor).toBeString();
    const secondPage = catalog.search({ mode: "domain", domain: "shared.example", limit: 1, cursor: firstPage.nextCursor });
    expect(secondPage.places.map(({ id }) => id)).toEqual(["dubai-b"]);
    expect(secondPage.truncated).toBe(false);
    const singlePlaceDomain = catalog.search({ mode: "domain", domain: "solo.example" });
    expect(singlePlaceDomain.places.map(({ id }) => id)).toEqual(["solo-domain"]);
    expect(singlePlaceDomain.ambiguous).toBe(false);
    expect(inputError(() => catalog.search({ mode: "url", url: "javascript:alert(1)" })).code).toBe("invalid_url");
    expect(inputError(() => catalog.search({ mode: "domain", domain: "shared.example/path" })).code).toBe("invalid_domain");
  });

  test("validates exact proposal ids and preserves requested order", () => {
    expect(catalog.byIds(["dubai-b", "dubai-a"]).map(({ id }) => id)).toEqual(["dubai-b", "dubai-a"]);
    expect(inputError(() => catalog.byIds(["dubai-a", "dubai-a"])).code).toBe("invalid_ids");
    expect(inputError(() => catalog.byIds(["missing"])).code).toBe("unknown_ids");
    expect(inputError(() => catalog.byIds(Array.from({ length: PLACE_CATALOG_LIMITS.maximumIds + 1 }, (_, index) => `id-${index}`))).code).toBe("invalid_ids");
  });

  test("rejects invalid limits and an offset beyond the hard cursor bound", () => {
    expect(inputError(() => catalog.search({ mode: "id", id: "dubai-a", limit: 0 })).code).toBe("invalid_limit");
    expect(inputError(() => catalog.search({ mode: "id", id: "dubai-a", limit: 201 })).code).toBe("invalid_limit");
    const oversized = Buffer.from(JSON.stringify({ v: 1, offset: 10_001, query: "wrong" })).toString("base64url");
    expect(inputError(() => catalog.search({ mode: "id", id: "dubai-a", cursor: oversized })).code).toBe("invalid_cursor");
  });

  test("opens SQLite read-only and reports unavailable, closed, and corrupt catalogs", () => {
    const directReadOnly = new Database(catalogPath, { readonly: true });
    expect(() => directReadOnly.exec("DELETE FROM places")).toThrow();
    directReadOnly.close();

    expect(() => new PlaceCatalog({ path: join(temporary, "absent.sqlite") })).toThrow(PlaceCatalogError);
    try {
      new PlaceCatalog({ path: join(temporary, "absent.sqlite") });
    } catch (error) {
      expect((error as PlaceCatalogError).kind).toBe("catalog_unavailable");
    }

    const corruptPath = join(temporary, "corrupt.sqlite");
    const corrupt = new Database(corruptPath, { create: true });
    corrupt.exec("CREATE TABLE metadata(key TEXT,value TEXT); INSERT INTO metadata VALUES('catalog_format','wrong')");
    corrupt.close();
    expect(() => new PlaceCatalog({ path: corruptPath })).toThrow(PlaceCatalogError);

    const shortLived = new PlaceCatalog({ path: catalogPath });
    shortLived.close();
    try {
      shortLived.search({ mode: "id", id: "dubai-a" });
    } catch (error) {
      expect((error as PlaceCatalogError).kind).toBe("catalog_unavailable");
    }
  });

  test("detects a tampered spatial index before serving the catalog", () => {
    const path = writableCatalogCopy("tampered-rtree.sqlite");
    const writable = new Database(path);
    writable.exec("DELETE FROM place_rtree WHERE id=(SELECT rowid FROM places WHERE id='dubai-a')");
    writable.close();
    expectCorrupt(() => new PlaceCatalog({ path }), "catalog_index_mismatch");
  });

  test("treats tampered unsafe URLs and invalid confidence or country as corrupt data", () => {
    const unsafePath = writableCatalogCopy("tampered-url.sqlite");
    const unsafe = new Database(unsafePath);
    unsafe.exec(`UPDATE places SET websites_json='["javascript:alert(1)"]' WHERE id='dubai-a';
      UPDATE websites SET normalized_url='javascript:alert(1)',normalized_domain='invalid' WHERE place_rowid=(SELECT rowid FROM places WHERE id='dubai-a') AND normalized_url='https://shared.example/book'`);
    unsafe.close();
    expectCorrupt(() => new PlaceCatalog({ path: unsafePath }), "catalog_index_mismatch");

    const valuesPath = writableCatalogCopy("tampered-values.sqlite");
    const values = new Database(valuesPath);
    values.exec("PRAGMA ignore_check_constraints=ON; UPDATE places SET confidence=2,country='UNITED ARAB EMIRATES' WHERE id='dubai-a'");
    values.close();
    expectCorrupt(() => {
      const opened = new PlaceCatalog({ path: valuesPath });
      try { opened.search({ mode: "id", id: "dubai-a" }); } finally { opened.close(); }
    });
  });

  test("rejects private or untyped provenance in existing catalogs before returning a record", () => {
    const publicSource = { property: "", dataset: "synthetic", record_id: "public-fixture" };
    const sources = [
      { ...publicSource, clientId: "synthetic-private-marker" },
      { ...publicSource, guestId: "synthetic-private-marker" },
      { ...publicSource, arbitrary: { guestId: "synthetic-private-marker" } },
      { ...publicSource, record_id: { guestId: "synthetic-private-marker" } },
      { ...publicSource, confidence: true },
      { ...publicSource, between: [0, { guestId: "synthetic-private-marker" }] },
    ];
    sources.forEach((source, index) => {
      const path = writableCatalogCopy(`private-provenance-${index}.sqlite`);
      const writer = new Database(path);
      writer.query("UPDATE places SET sources_json=? WHERE id='dubai-a'").run(JSON.stringify([source]));
      writer.close();
      const opened = new PlaceCatalog({ path });
      try {
        expectCorrupt(() => opened.search({ mode: "id", id: "dubai-a" }), "invalid_catalog_provenance");
        expectCorrupt(() => opened.byIds(["dubai-a"]), "invalid_catalog_provenance");
      } finally { opened.close(); }
    });
  });

  test("uses the same Unicode keyword keys as the importer and rejects incompatible old keys", () => {
    const unicodeSource = join(temporary, "unicode.ndjson");
    const unicodePath = join(temporary, "unicode.sqlite");
    const cases = [
      ["unicode-street", "Straße Hotel", "Straße"],
      ["unicode-greek", "ΟΣ Hotel", "ΟΣ"],
      ["unicode-turkish", "İSTANBUL Hotel", "İSTANBUL"],
      ["unicode-width", "\ufeffＡＢＣ\u00a0Hotel\ufeff", "\ufeffＡＢＣ"],
    ] as const;
    writeFileSync(unicodeSource, cases.map(([id, name]) => JSON.stringify(place(id, name, 55.2, 25.2))).join("\n") + "\n");
    const built = Bun.spawnSync(["python3", join(repository, "scripts/research/build-place-catalog.py"), unicodeSource, "--output", unicodePath], { stdout: "pipe", stderr: "pipe" });
    expect(built.exitCode).toBe(0);
    const opened = new PlaceCatalog({ path: unicodePath });
    try {
      for (const [id, , q] of cases) expect(opened.search({ mode: "keyword", q }).places.map(place => place.id)).toEqual([id]);
    } finally { opened.close(); }
    chmodSync(unicodePath, 0o644);
    const old = new Database(unicodePath);
    old.exec("UPDATE places SET name_search='strasse hotel' WHERE id='unicode-street'");
    old.close();
    expectCorrupt(() => new PlaceCatalog({ path: unicodePath }), "catalog_name_index_mismatch");
  });
});
