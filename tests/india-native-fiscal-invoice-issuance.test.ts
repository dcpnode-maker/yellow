import { describe, expect, test } from "bun:test";

const preparationUrl = new URL(
  "../migrations/0077_india_native_fiscal_source_completion.sql",
  import.meta.url,
);
const historicalPreparationUrl = new URL(
  "../handoff/drafts/order434/0076-native-preparation.sql",
  import.meta.url,
);
const sourceUrl = (await Bun.file(preparationUrl).exists() ? preparationUrl : historicalPreparationUrl);

async function documentContextSource(): Promise<{ source: string; complete: string }> {
  const complete = await Bun.file(sourceUrl).text();
  const start = complete.indexOf(
    "CREATE OR REPLACE FUNCTION public.lock_india_native_document_context(",
  );
  const revoke = complete.indexOf(
    "REVOKE ALL ON FUNCTION public.lock_india_native_document_context(uuid,uuid,uuid,uuid,uuid,uuid)",
    start,
  );
  const end = revoke < 0 ? -1 : complete.indexOf(";", revoke) + 1;
  if (start < 0 || revoke <= start || end <= revoke) {
    throw new Error("native document-context helper is unavailable");
  }
  return { source: complete.slice(start, end), complete };
}

async function issueAuthorityLockSource(): Promise<{ source: string; complete: string }> {
  const complete = await Bun.file(sourceUrl).text();
  const start = complete.indexOf(
    "CREATE OR REPLACE FUNCTION public.lock_india_native_issue_authority(",
  );
  const revoke = complete.indexOf(
    "REVOKE ALL ON FUNCTION public.lock_india_native_issue_authority(uuid,uuid,uuid,uuid,uuid)",
    start,
  );
  const end = revoke < 0 ? -1 : complete.indexOf(";", revoke) + 1;
  if (start < 0 || revoke <= start || end <= revoke) {
    throw new Error("native issue-authority lock helper is unavailable");
  }
  return { source: complete.slice(start, end), complete };
}

describe("Order434 private native fiscal document lock context", () => {
  test("keeps the exact six-selector private contract before quoted-tax composition", async () => {
    const { source, complete } = await documentContextSource();
    expect(source).toMatch(
      /lock_india_native_document_context\(\s*p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_actor uuid,\s*p_supplier_registration uuid\s*\) RETURNS jsonb/,
    );
    expect(complete.indexOf("lock_india_native_document_context(")).toBeLessThan(
      complete.indexOf("CREATE OR REPLACE FUNCTION public.compose_india_native_quoted_tax_source("),
    );
    expect(source).toContain(
      "REVOKE ALL ON FUNCTION public.lock_india_native_document_context(uuid,uuid,uuid,uuid,uuid,uuid)",
    );
    expect(source).toContain("FROM PUBLIC,app_role,yellow_runtime");
    for (const forbidden of ["p_issue_date", "p_document", "p_doc_no", "p_next_no", "p_hash"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  test("derives one property-local issue clock and requires current issue authority", async () => {
    const { source, complete } = await documentContextSource();
    expect(source).toContain(
      "v_authority:=public.read_india_native_issue_authority(",
    );
    expect(source).toContain(
      "v_transaction_timestamp:=(v_authority->>'transactionTimestamp')::timestamptz",
    );
    expect(source).toContain("v_issue_date:=(v_authority->>'invoiceIssueDate')::date");
    expect(source).toContain("(v_transaction_timestamp AT TIME ZONE v_property_timezone)::date<>v_issue_date");
    expect(source).toContain("CASE WHEN pg_catalog.date_part('month',v_issue_date)<4 THEN 1 ELSE 0 END,4,1");
    const authorityStart = complete.indexOf(
      "CREATE OR REPLACE FUNCTION public.read_india_native_issue_authority(",
    );
    const authorityEnd = complete.indexOf(
      "CREATE OR REPLACE FUNCTION public.read_india_native_valuation_evidence(",
    );
    const authority = complete.slice(authorityStart, authorityEnd);
    expect(authority).toContain("session_user<>'yellow_runtime'");
    expect(authority).toContain("current_user<>'yellow_owner'");
    expect(authority).toContain("current_setting('role',true) IS DISTINCT FROM 'app_role'");
    expect(authority).toContain("ARRAY['tax-fiscal.documents:issue','tax-fiscal.india-valuation:finalize']");
    expect(source).toContain("registration.scheme='in-gstin'");
  });

  test("locks the unsealed issue day before the exact FY series and immutable tail", async () => {
    const { source } = await documentContextSource();
    const dayLock = source.indexOf("FOR SHARE;");
    const seriesLock = source.indexOf("FOR UPDATE;");
    const tailLock = source.indexOf("FOR KEY SHARE OF document,origin;");
    expect(dayLock).toBeGreaterThan(0);
    expect(seriesLock).toBeGreaterThan(dayLock);
    expect(tailLock).toBeGreaterThan(seriesLock);
    expect(source).toContain("day.business_date=v_issue_date");
    expect(source).toContain("v_sealed_at IS NOT NULL");
    expect(source).toContain("series.supplier_registration_id=p_supplier_registration");
    expect(source).toContain("series.kind='invoice'");
    expect(source).toContain("series.financial_year_start=v_financial_year_start");
    expect(source).toContain("series.fiscal");
    expect(source).toContain("native document context must be locked before publication");
  });

  test("validates the configured prefix, int64 counter, Rule-46 reference and exact chain tail", async () => {
    const { source } = await documentContextSource();
    expect(source).toContain("pg_catalog.char_length(v_series.prefix) NOT BETWEEN 1 AND 12");
    expect(source).toContain("v_series.prefix !~ '^[A-Za-z0-9/-]+$'");
    expect(source).toContain("v_series.next_no NOT BETWEEN 1 AND 9223372036854775806");
    expect(source).toContain("pg_catalog.char_length(v_series.prefix||v_series.next_no::text)>16");
    expect(source).toContain("v_series.next_no=1");
    expect(source).toContain("v_series.last_doc_hash IS NOT NULL");
    expect(source).toContain("v_tail_document_no:=v_series.prefix||(v_series.next_no-1)::text");
    expect(source).toContain("v_tail_document_hash IS DISTINCT FROM v_series.last_doc_hash");
    expect(source).toContain("document.doc_no=v_series.prefix||v_series.next_no::text");
  });

  test("returns only the locked context and performs no allocation, document write, or publication", async () => {
    const { source } = await documentContextSource();
    for (const key of [
      "tenantId", "propertyNode", "reservationId", "folioId", "actorId",
      "supplierRegistrationId", "documentKind", "transactionTimestamp",
      "propertyTimezone", "issueDate", "financialYearStart", "seriesId", "prefix",
      "nextNo", "tailDocumentId", "tailDocumentHash",
    ]) expect(source).toContain(`'${key}'`);
    expect(source).not.toMatch(/INSERT\s+INTO\s+public\.(?:document|document_series|outbox|fact_log)/i);
    expect(source).not.toMatch(/UPDATE\s+public\.document_series/i);
    expect(source).not.toMatch(/DELETE\s+FROM/i);
    expect(source).not.toContain("pg_catalog.pg_advisory_xact_lock(");
  });
});

describe("Order434 private native issue-authority lock source contract", () => {
  test("keeps the exact five-selector private helper immediately before valuation evidence", async () => {
    const { source, complete } = await issueAuthorityLockSource();
    expect(source).toMatch(
      /lock_india_native_issue_authority\(\s*p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid\s*\) RETURNS jsonb/,
    );
    expect(complete.indexOf("lock_india_native_issue_authority(")).toBeLessThan(
      complete.indexOf("read_india_native_valuation_evidence("),
    );
    expect(source).toContain(
      "REVOKE ALL ON FUNCTION public.lock_india_native_issue_authority(uuid,uuid,uuid,uuid,uuid)",
    );
    expect(source).toContain("FROM PUBLIC,app_role,yellow_runtime");
  });

  test("snapshots every selected authority tuple and covering path before locking", async () => {
    const { source } = await issueAuthorityLockSource();
    for (const field of [
      "tenant", "property", "grantNodes", "actor", "userRoles", "roles",
      "rolePermissions", "permissions",
    ]) expect(source).toContain(`'${field}'`);
    expect(source).toContain("grant_node.path @> property.path");
    expect(source).toContain("'path',g.path");
    expect(source).toContain("ARRAY[\n    'tax-fiscal.documents:issue','tax-fiscal.india-valuation:finalize']");
    expect(source).toContain("native issue authority graph is incomplete");
  });

  test("locks each table with SHARE in deterministic primary-key order", async () => {
    const { source } = await issueAuthorityLockSource();
    const orderedMarkers = [
      "PERFORM 1 FROM public.tenant tenant",
      ") locked_nodes;",
      "PERFORM 1 FROM public.app_user actor",
      ") locked_user_roles;",
      ") locked_roles;",
      ") locked_role_permissions;",
      ") locked_permissions;",
    ];
    let previous = -1;
    for (const marker of orderedMarkers) {
      const next = source.indexOf(marker);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
    expect(source.match(/FOR SHARE/g)).toHaveLength(7);
    for (const order of [
      "ORDER BY node.id FOR SHARE",
      "ORDER BY actor.id FOR SHARE",
      "ORDER BY ur.user_id,ur.role_id,ur.scope_node FOR SHARE",
      "ORDER BY role_row.id FOR SHARE",
      "ORDER BY rp.role_id,rp.permission_code FOR SHARE",
      "ORDER BY permission.code FOR SHARE",
    ]) expect(source).toContain(order);
  });

  test("rereads exact authority and graph once, then fails drift without chasing locks", async () => {
    const { source } = await issueAuthorityLockSource();
    expect(source.match(/public\.read_india_native_issue_authority\(/g)).toHaveLength(2);
    expect(source).toContain("v_before IS DISTINCT FROM v_after");
    expect(source).toContain("v_graph_before IS DISTINCT FROM v_graph_after");
    expect(source).toContain("native issue authority changed while locking");
    expect(source).toContain("RETURN v_after;");
  });

  test("rejects post-publication use and has no advisory, mutation, or public authority", async () => {
    const { source } = await issueAuthorityLockSource();
    expect(source).toContain("6441674055002974568::bigint");
    expect(source).toContain("native issue authority must be locked before publication");
    expect(source).not.toContain("pg_catalog.pg_advisory_xact_lock(");
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)\b/i);
    expect(source).not.toContain("GRANT EXECUTE");
  });
});
