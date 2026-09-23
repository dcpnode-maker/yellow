import { describe, expect, test } from "bun:test";

const migrationUrl = new URL("../migrations/0074_india_native_fiscal_invoice_authority.sql", import.meta.url);

describe("Order 430 fiscal database authority intentional-red", () => {
  test("P0: native fiscal issue authority is absent until the forward migration provides it", async () => {
    const migration = await Bun.file(migrationUrl).text();
    expect(migration).toMatch(/CREATE\s+TABLE\s+public\.india_gst_native_fiscal_document_origin/i);
    expect(migration).toMatch(/FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(migration).toMatch(/property_fiscal_registration_tenant_property_id_uq/i);
    expect(migration).toMatch(/FOREIGN\s+KEY\s+\(tenant_id,property_node,supplier_registration_id\)\s*REFERENCES\s+public\.property_fiscal_registration\(tenant_id,property_node,id\)/i);
    expect(migration).toMatch(/document_series_tenant_property_fk/i);
    expect(migration).toMatch(/document_series_scope_fk/i);
    expect(migration).toMatch(/india_gst_supplier_registration_status_snapshot/i);
    expect(migration).toMatch(/supplier_registration_status\.status_as_of=applicability\.time_of_supply_date/i);
    expect(migration).toMatch(/registration_status\.status_as_of=v_issue_date/i);
    expect(migration).toMatch(/registration_status\.gst_registration_status='active'/i);
    expect(migration).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_india_native_fiscal_series/i);
    expect(migration).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.commit_india_native_fiscal_invoice/i);
    expect(migration).toMatch(/p_tenant_id::text\|\|':india-final-component-tax-correction:'\|\|p_journal_id::text,408/i);
    expect(migration).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.commit_india_native_fiscal_invoice/i);
    expect(migration).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.commit_india_native_fiscal_invoice/i);
  });

  test("P0: the issue capability owns legal allocation, immutable evidence and the replay receipt", async () => {
    const migration = await Bun.file(migrationUrl).text();
    expect(migration).toMatch(/INSERT\s+INTO\s+public\.document\b/i);
    expect(migration).toMatch(/UPDATE\s+public\.document_series\s+SET\s+next_no=next_no\+1,last_doc_hash=v_hash/i);
    expect(migration).toMatch(/INSERT\s+INTO\s+public\.fact_log/i);
    expect(migration).toMatch(/INSERT\s+INTO\s+public\.outbox/i);
    expect(migration).toMatch(/INSERT\s+INTO\s+public\.api_idempotency/i);
    expect(migration).toMatch(/document_india_native_fiscal_immutable/i);
    expect(migration).toMatch(/india_gst_native_fiscal_document_origin_immutable/i);
    expect(migration).toMatch(/prevent_india_native_fiscal_origin_mutation/i);
    expect(migration).toMatch(/financial_year_start date,next_no bigint,created boolean/i);
    expect(migration).toMatch(/v_existing\.next_no,false/i);
    expect(migration).toMatch(/v_existing\.next_no,true/i);
    expect(migration).toMatch(/blocked_pending_fiscal_document_origin_policy/i);
    expect(migration).toMatch(/ARRAY\['BuyerDtls','ItemList','SellerDtls','TranDtls','ValDtls','Version'\]::text\[\]/i);
    expect(migration).toMatch(/jsonb_typeof\(v_sections->'SellerDtls'\)<>'object'/i);
  });
});
