import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { Database } from "../src/kernel";
import {
  createNativeIssuanceFixture,
  type NativeStatutoryOriginalConfiguration,
} from "./fixtures/india-native-fiscal-source-completion-fixture";

const deployUrl = process.env.YELLOW_ORDER440_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order440 issued-wire proof requires explicit deploy and runtime database URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

interface IssuedRow {
  document_id: string;
  document_sha256: string;
  content_json: string;
  doc_no: string;
  issue_date: string;
}

// This proof-only reader deliberately uses real RLS and immutable native origin.
// It is not a production endpoint or a grant of document/provider authority.
async function issuedSource(database: Database, contextTenant: string, rowTenant: string,
  property: string, document: string): Promise<readonly IssuedRow[]> {
  return database.withTenantTransaction(contextTenant, tx => tx<IssuedRow[]>`
    SELECT d.id::text AS document_id,d.sha256 AS document_sha256,
           d.content::text AS content_json,d.doc_no,
           to_char(d.business_date,'DD/MM/YYYY') AS issue_date
      FROM public.document d
      JOIN public.india_gst_native_fiscal_document_origin o
        ON o.tenant_id=d.tenant_id AND o.document_id=d.id AND o.property_node=d.property_node
       AND o.source_kind='native_current_transaction_graph' AND o.source_version=2
     WHERE d.tenant_id=${rowTenant}::uuid AND d.property_node=${property}::uuid
       AND d.id=${document}::uuid AND d.status='issued' AND d.kind='invoice'
  `);
}

// Exact rows, not just totals: projection must neither write a new source nor
// modify a field while leaving aggregate counts/balances unchanged.
async function retainedRows(deploy: SQL, tenant: string): Promise<readonly unknown[]> {
  const tables = ["document", "document_series", "journal", "posting_line", "fact_log", "outbox",
    "fiscal_submission", "india_gst_native_fiscal_document_origin",
    "india_gst_accommodation_final_component_tax_journal_binding",
    "india_gst_accommodation_final_component_tax",
    "india_gst_accommodation_final_component_tax_room_night",
    "india_gst_accommodation_final_component_tax_component"] as const;
  const snapshots: unknown[] = [];
  for (const table of tables) {
    // Identifiers come exclusively from the closed literal catalogue above.
    const rows = await deploy.unsafe<{ body: string }[]>(
      `SELECT to_jsonb(t)::text AS body FROM public.${table} t WHERE tenant_id=$1::uuid ORDER BY to_jsonb(t)::text`,
      [tenant],
    );
    snapshots.push({ table, rows: rows.map(row => row.body) });
  }
  return snapshots;
}

databaseDescribe("Order440 genuine issued-document wire candidate", () => {
  let deploy: SQL;
  let runtime: Database;
  const issuedTenants: { tenant: string; property: string; document: string }[] = [];

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    const [identity] = await deploy<{ database_name: string; migrations: number }[]>`
      SELECT current_database()::text AS database_name,
        (SELECT count(*)::int FROM public.schema_migration) AS migrations
    `;
    if (!identity || !identity.database_name.startsWith("yellow_order440_") || identity.migrations !== 78) {
      throw new Error("Order440 proof requires an isolated synthetic 78-migration database");
    }
  });

  afterAll(async () => {
    try { await runtime?.close(); } finally { await deploy?.close(); }
  });

  const families: readonly [NativeStatutoryOriginalConfiguration, "split" | "igst"][] = [
    ["karnataka_supplier_karnataka_property", "split"],
    ["chandigarh_supplier_chandigarh_property", "split"],
    ["maharashtra_supplier_karnataka_property", "igst"],
  ];
  for (const [configuration, family] of families) {
    test(`projects real ${configuration} invoice without changing any retained financial record`, async () => {
      const candidate = await createNativeIssuanceFixture(deploy, runtime, {
        label: `w440-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
        roomNightAmounts: ["10000", "20000"],
        statutoryOriginalConfiguration: configuration,
      });
      const receipt = await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
      const { tenant, property } = candidate.fixture;
      const before = await retainedRows(deploy, tenant);
      const rows = await issuedSource(runtime, tenant, tenant, property, receipt.documentId);
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.doc_no).toBe(receipt.docNo);
      expect(row.document_sha256).toBe(new Bun.CryptoHasher("sha256").update(row.content_json).digest("hex"));
      const input = Object.freeze({ documentId: row.document_id,
        documentSha256: row.document_sha256, contentJson: row.content_json });
      const result = projectIssuedIndiaIrpWireCandidate(input);
      if (!result.ok) throw new Error(`Real issued wire projection failed: ${result.error.code}`);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(result.value.kind).toBe("india_irp_1_1_issued_wire_candidate");
      expect(result.value.authenticatedProviderSandboxCertified).toBe(false);
      expect(result.value.documentId).toBe(receipt.documentId);
      expect(result.value.documentSha256).toBe(row.document_sha256);
      expect(result.value.wireSha256).toBe(new Bun.CryptoHasher("sha256").update(result.value.wireJson).digest("hex"));
      expect(result.value.wireSha256).not.toBe(row.document_sha256);
      expect(projectIssuedIndiaIrpWireCandidate(input)).toEqual(result);
      const original = JSON.parse(row.content_json);
      const wire = JSON.parse(result.value.wireJson);
      expect(Object.keys(wire).sort()).toEqual(Object.keys(original).sort());
      expect(wire.Version).toBe("1.1");
      expect(wire.DocDtls).toEqual({ Typ: "INV", No: receipt.docNo, Dt: row.issue_date });
      expect(wire.TranDtls).toEqual(original.TranDtls);
      expect(wire.SellerDtls).toEqual(original.SellerDtls);
      expect(wire.BuyerDtls).toEqual(original.BuyerDtls);
      expect(wire.ItemList).toHaveLength(2);
      for (let index = 0; index < 2; index++) {
        const source = original.ItemList[index];
        const item = wire.ItemList[index];
        expect(Object.keys(item).sort()).toEqual(Object.keys(source).sort());
        expect(source.Qty).toBe("1.000");
        expect(source.Unit).toBe("OTH");
        expect(item.Qty).toBe(1);
        expect(item.Unit).toBe(source.Unit);
        for (const key of ["SlNo", "IsServc", "HsnCd"]) expect(item[key]).toBe(source[key]);
        // These fixture amounts are deliberately small exact integers/halves.
        for (const key of ["UnitPrice", "TotAmt", "AssAmt", "GstRt", "TotItemVal",
          ...(family === "igst" ? ["IgstAmt"] : ["CgstAmt", "SgstAmt"])]) {
          expect(typeof item[key]).toBe("number");
          expect(item[key]).toBe(Number(source[key]));
        }
      }
      expect(wire.ValDtls.AssVal).toBe(300);
      expect(wire.ValDtls.TotInvVal).toBe(315);
      expect(Object.keys(wire.ValDtls).sort()).toEqual(Object.keys(original.ValDtls).sort());
      for (const [key, amount] of Object.entries(original.ValDtls)) {
        expect(typeof wire.ValDtls[key]).toBe("number");
        expect(wire.ValDtls[key]).toBe(Number(amount));
      }
      // Rehashed arbitrary input is not origin authority; wrong source bytes with
      // the stored hash must fail before any transport candidate can be produced.
      expect(projectIssuedIndiaIrpWireCandidate({ ...input, contentJson: `${row.content_json} ` }).ok).toBe(false);
      expect(await retainedRows(deploy, tenant)).toEqual(before);
      expect(await issuedSource(runtime, tenant, tenant, crypto.randomUUID(), receipt.documentId)).toEqual([]);
      issuedTenants.push({ tenant, property, document: receipt.documentId });
    }, 180_000);
  }

  test("two real tenant contexts cannot read each other's issued source even with explicit foreign IDs", async () => {
    expect(issuedTenants.length).toBe(3);
    const first = issuedTenants[0]!;
    const second = issuedTenants[1]!;
    expect(await issuedSource(runtime, first.tenant, second.tenant, second.property, second.document)).toEqual([]);
    expect(await issuedSource(runtime, second.tenant, first.tenant, first.property, first.document)).toEqual([]);
    expect(await issuedSource(runtime, first.tenant, first.tenant, first.property, first.document)).toHaveLength(1);
    expect(await issuedSource(runtime, second.tenant, second.tenant, second.property, second.document)).toHaveLength(1);
  });
});
