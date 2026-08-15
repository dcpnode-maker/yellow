import { describe, expect, test } from "bun:test";
import { normalizeSchemaDump, schemaMismatch } from "../scripts/schema-drift";

const dump = (token: string, newline = "\n") => [
  "-- PostgreSQL database dump",
  `\\restrict ${token}`,
  "SET statement_timeout = 0;",
  "SELECT pg_catalog.set_config('search_path', '', false);",
  "CREATE TABLE public.alpha (id integer);",
  "GRANT SELECT ON TABLE public.alpha TO app_role;",
  "ALTER TABLE public.alpha ENABLE ROW LEVEL SECURITY;",
  `\\unrestrict ${token}`,
  "-- PostgreSQL database dump complete",
  "",
  "",
].join(newline);

describe("schema dump normalization", () => {
  test("removes only a matching random wrapper pair and is deterministic across CRLF", () => {
    const first = normalizeSchemaDump(dump("AbC123"));
    const second = normalizeSchemaDump(dump("ZyX987", "\r\n"));
    expect(first).toBe(second);
    expect(first).not.toContain("\\restrict");
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
  });

  test("retains headers, settings, ACLs, object order, RLS, and SQL bodies", () => {
    const normalized = normalizeSchemaDump(dump("Token9"));
    const required = [
      "-- PostgreSQL database dump",
      "SET statement_timeout = 0;",
      "SELECT pg_catalog.set_config",
      "CREATE TABLE public.alpha",
      "GRANT SELECT ON TABLE public.alpha",
      "ALTER TABLE public.alpha ENABLE ROW LEVEL SECURITY",
      "-- PostgreSQL database dump complete",
    ];
    let previous = -1;
    for (const value of required) {
      const index = normalized.indexOf(value);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });

  test("rejects duplicate, malformed, mismatched, reversed, and required missing wrappers", () => {
    expect(() => normalizeSchemaDump("SELECT 1;\n", true)).toThrow("exactly one");
    expect(() => normalizeSchemaDump(dump("Token").replace("\\restrict Token", "\\restrict bad-token"))).toThrow("Malformed");
    expect(() => normalizeSchemaDump(dump("Token").replace("\\unrestrict Token", "\\unrestrict Other"))).toThrow("do not match");
    expect(() => normalizeSchemaDump(dump("Token").replace("\\unrestrict Token", "\\restrict Token"))).toThrow("one pg_dump");
    expect(() => normalizeSchemaDump("\\unrestrict Token\nSELECT 1;\n\\restrict Token\n")).toThrow("out of order");
  });

  test("normalization is idempotent and controlled mismatches are actionable", () => {
    const normalized = normalizeSchemaDump(dump("Token"));
    expect(normalizeSchemaDump(normalized)).toBe(normalized);
    expect(schemaMismatch(normalized, normalized)).toBeNull();
    expect(schemaMismatch(normalized.replace("alpha", "beta"), normalized)).toContain("Schema drift at line");
  });
});
