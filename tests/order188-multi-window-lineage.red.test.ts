import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(import.meta.dir, "..", "migrations", "0020_multi_window_folio_routing.sql");

function normalizedMigration(): string {
  return readFileSync(migrationPath, "utf8").replace(/\s+/g, " ");
}

describe("Order 188 P0 typed immutable folio-transfer lineage", () => {
  test("migration 0020 owns typed root lineage and the bounded transfer capability", () => {
    if (!existsSync(migrationPath)) {
      expect(existsSync(migrationPath)).toBeTrue();
      return;
    }

    const sql = normalizedMigration();

    expect(sql).toMatch(/ADD CONSTRAINT\s+\w+\s+UNIQUE\s*\(tenant_id,\s*id\)/i);
    expect(sql).toMatch(/ADD COLUMN\s+folio_transfer_root_line_id\s+uuid/i);
    expect(sql).toMatch(/FOREIGN KEY\s*\(tenant_id,\s*folio_transfer_root_line_id\)\s+REFERENCES\s+(?:public\.)?posting_line\s*\(tenant_id,\s*id\)/i);
    expect(sql).toMatch(/CREATE INDEX\s+\w+\s+ON\s+(?:public\.)?posting_line\s*\(tenant_id,\s*folio_transfer_root_line_id\)\s+WHERE\s+folio_transfer_root_line_id IS NOT NULL/i);
    expect(sql).toMatch(/CHECK\s*\([^)]*folio_transfer_root_line_id[^)]*(?:<>|IS DISTINCT FROM)[^)]*id[^)]*\)/i);

    expect(sql).toMatch(/CREATE FUNCTION public\.create_folio_transfer\s*\(/i);
    expect(sql).toMatch(/p_tenant_id\s+uuid/i);
    expect(sql).toMatch(/p_source_folio\s+uuid/i);
    expect(sql).toMatch(/p_destination_folio\s+uuid/i);
    expect(sql).toMatch(/p_root_line_ids\s+uuid\[\]/i);
    expect(sql).toMatch(/(?:array_length\s*\(p_root_line_ids,\s*1\)|cardinality\s*\(p_root_line_ids\))/i);
    expect(sql).toMatch(/(?:BETWEEN\s+1\s+AND\s+50|<\s*1|>\s*50)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path\s*=\s*pg_catalog,\s*public/i);
    expect(sql).toMatch(/session_user\s*<>\s*'yellow_runtime'/i);
    expect(sql).toMatch(/(?:pg_catalog\.)?current_setting\s*\(\s*'role'\s*,\s*true\s*\)\s+IS DISTINCT FROM\s+'app_role'/i);
    expect(sql).toMatch(/current_user\s*<>\s*'yellow_owner'/i);
    expect(sql).toMatch(/(?:pg_catalog\.)?current_setting\s*\(\s*'app\.tenant_id'\s*,\s*true\s*\)/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.create_folio_transfer[\s\S]*FROM PUBLIC/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_folio_transfer[\s\S]*TO app_role/i);

    expect(sql).toMatch(/INSERT INTO (?:public\.)?journal[\s\S]*'transfer'/i);
    expect(sql).toMatch(/INSERT INTO (?:public\.)?posting_line[\s\S]*folio_transfer_root_line_id/i);
    expect(sql).toMatch(/:folio-transfer-root:/i);
    expect(sql).toMatch(/hashtextextended[\s\S]*188/i);
    expect(sql).toMatch(/corrected folio transfer roots must move with their contra companion/i);
    expect(sql).not.toMatch(/UPDATE\s+(?:public\.)?posting_line\s+SET\s+folio_id/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+(?:public\.)?posting_line/i);
  });
});
