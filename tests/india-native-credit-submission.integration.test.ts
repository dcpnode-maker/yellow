import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { Database } from "../src/kernel";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { creditSqlState } from "./fixtures/india-native-fiscal-credit-note-fixture";
import { assertCreditSubmissionTargets, CREDIT_SUBMISSION_CANONICAL, CREDIT_SUBMISSION_DRAFT,
  createCreditSubmissionScenario, creditSubmissionFinancialFingerprint, ownerCreditProjection,
  parseCreditSubmissionTargetMode, requestCreditSubmission } from "./fixtures/india-native-credit-submission-fixture";

const deployUrl = process.env.YELLOW_ORDER447_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER447_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER447_DATABASE === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Required Order447 proof needs exact admitted credentials");
const targetMode = required || deployUrl || runtimeUrl
  ? parseCreditSubmissionTargetMode(process.env.YELLOW_ORDER447_TARGET_MODE) : undefined;
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order447 proof requires paired deploy/runtime credentials");
  assertCreditSubmissionTargets(deployUrl, runtimeUrl, "runtime", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1", process.env.YELLOW_ORDER447_CI_DATABASE_ADDRESS);
}
const db = required ? describe.serial : describe.skip;

describe("Order447 bounded SQL source and target containment", () => {
  test("draft changes only the existing private projector without ledger/table/grant mutations", () => {
    const source = readFileSync(CREDIT_SUBMISSION_DRAFT, "utf8");
    expect(readFileSync(CREDIT_SUBMISSION_CANONICAL, "utf8")).toBe(source);
    expect(source).toContain("india_fiscal_submission_project_wire");
    expect(source).toContain("ca6b253d5fd162f4ff79aa810d479c14cf5e11692ffbfcec2732d4f34c8a3cd0");
    expect(source).not.toMatch(/\b(?:CREATE\s+TABLE|GRANT\s|INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)\b/i);
  });
  test("rejects candidate86, mismatched URLs and URL options without connecting", () => {
    const deploy = "postgres://yellow_deploy:synthetic@127.0.0.1:55503/yellow_order446_credit_upgrade_20260907";
    const runtime = deploy.replace("yellow_deploy", "yellow_runtime");
    expect(() => assertCreditSubmissionTargets(deploy, runtime, "runtime", "native-draft")).not.toThrow();
    expect(() => assertCreditSubmissionTargets(deploy, runtime, "rollback", "native-draft")).toThrow();
    expect(() => assertCreditSubmissionTargets(deploy, runtime + "?options=-crole=app_role", "runtime", "native-draft")).toThrow();
    expect(() => assertCreditSubmissionTargets(deploy.replace("credit_upgrade", "credit_candidate"), runtime, "runtime", "native-draft")).toThrow();
    expect(() => assertCreditSubmissionTargets(deploy, deploy, "runtime", "native-draft")).toThrow();
    const ciDeploy = "postgres://yellow_deploy:synthetic@127.0.0.1:55432/yellow_order447_current88_ci";
    const ciRuntime = ciDeploy.replace("yellow_deploy", "yellow_runtime");
    expect(() => assertCreditSubmissionTargets(ciDeploy, ciRuntime, "runtime", "ci-canonical", true,
      "127.0.0.1:55432")).not.toThrow();
    expect(() => assertCreditSubmissionTargets(ciDeploy, ciRuntime, "runtime", "ci-canonical")).toThrow();
    expect(() => assertCreditSubmissionTargets(ciDeploy.replace("55432", "55503"), ciRuntime.replace("55432", "55503"),
      "runtime", "ci-canonical", true, "127.0.0.1:55503")).toThrow();
    expect(() => assertCreditSubmissionTargets(ciDeploy, ciRuntime, "runtime", "ci-canonical", true,
      "127.0.0.1:55433")).toThrow();
  });
});

db("Order447 authenticated native credit submission", () => {
  let deploy: SQL; let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    const [row] = await deploy<{ frontier: number; installed: boolean }[]>`SELECT max(version)::int frontier,
      position('Order447 authenticated full-credit branch' in pg_get_functiondef('public.india_fiscal_submission_project_wire(uuid,uuid,uuid)'::regprocedure))>0 installed
      FROM public.schema_migration`;
    expect(row).toEqual({ frontier: targetMode === "native-draft" ? 87 : 88, installed: true });
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  for (const variant of ["ordinary", "correction", "transfer"] as const) test(`${variant}: exact original INV and CRN SQL/TypeScript wires, no financial mutation`, async () => {
    const scenario = await createCreditSubmissionScenario(deploy, runtime, { variant });
    const before = await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId);
    for (const document of [scenario.candidate.invoice.documentId, scenario.documentId]) {
      const [source] = await deploy<{ content: string; hash: string }[]>`SELECT content::text content,sha256 hash FROM public.document
        WHERE tenant_id=${scenario.tenantId}::uuid AND id=${document}::uuid`;
      expect(source).toBeDefined();
      const typed = projectIssuedIndiaIrpWireCandidate({ documentId: document, documentSha256: source!.hash, contentJson: source!.content });
      expect(typed.ok).toBe(true); if (!typed.ok) throw new Error(typed.error.code);
      const sql = await ownerCreditProjection(deploy, scenario.tenantId, scenario.propertyNode, document);
      expect(sql.wireText).toBe(typed.value.wireJson); expect(sql.wireSha256).toBe(typed.value.wireSha256);
      expect(sql.documentSha256).toBe(source!.hash); expect(sql.wireText).not.toContain("YellowCredit");
      if (document === scenario.documentId) {
        expect(JSON.parse(sql.wireText).DocDtls.Typ).toBe("CRN");
        expect(JSON.parse(sql.wireText).RefDtls).toEqual({ PrecDocDtls: [{ InvNo: scenario.candidate.invoice.docNo,
          InvDt: JSON.parse(source!.content).RefDtls.PrecDocDtls[0].InvDt }] });
        for (const privateValue of [scenario.candidate.invoice.documentId, scenario.credit.reason, scenario.credit.sourceEvidenceHash])
          expect(sql.wireText).not.toContain(privateValue!);
      }
    }
    const key = `credit447-${crypto.randomUUID()}`;
    const receipts = await Promise.all(Array.from({ length: 4 }, () => runtime.withTenantTransaction(scenario.tenantId,
      tx => requestCreditSubmission(tx, scenario, key))));
    expect(new Set(receipts.map(value => value.submissionId)).size).toBe(1);
    expect(receipts.filter(value => value.replayed === false)).toHaveLength(1);
    expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(before);
  }, 120_000);

  test("private projection remains denied to app_role; wrong property and tenant fail closed", async () => {
    const scenario = await createCreditSubmissionScenario(deploy, runtime);
    const before = await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId);
    let state: string | undefined;
    try { await runtime.withTenantTransaction(scenario.tenantId, tx => tx`SELECT public.india_fiscal_submission_project_wire(
      ${scenario.tenantId}::uuid,${scenario.propertyNode}::uuid,${scenario.documentId}::uuid)`); }
    catch (error) { state = creditSqlState(error); }
    expect(state).toBe("42501");
    await expect(ownerCreditProjection(deploy, scenario.tenantId, crypto.randomUUID(), scenario.documentId)).rejects.toBeDefined();
    await expect(ownerCreditProjection(deploy, crypto.randomUUID(), scenario.propertyNode, scenario.documentId)).rejects.toBeDefined();
    expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(before);
  }, 120_000);

  test("current actor authority is required on first call and durable replay", async () => {
    const scenario = await createCreditSubmissionScenario(deploy, runtime);
    const before = await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId);
    const key = `credit447-authority-${crypto.randomUUID()}`;
    async function denied(actor: string, requestKey: string) {
      let state: string | undefined;
      try { await runtime.withTenantTransaction(scenario.tenantId, tx => requestCreditSubmission(tx, { ...scenario, actorId: actor }, requestKey)); }
      catch (error) { state = creditSqlState(error); }
      expect(state).toBe("42501");
    }
    await denied(scenario.unauthorizedActorId, key);
    const receipt = await runtime.withTenantTransaction(scenario.tenantId, tx => requestCreditSubmission(tx, scenario, key));
    expect(receipt.replayed).toBe(false);
    await deploy`DELETE FROM public.user_role WHERE tenant_id=${scenario.tenantId}::uuid AND user_id=${scenario.actorId}::uuid`;
    await denied(scenario.actorId, key);
    await denied(scenario.actorId, `credit447-new-${crypto.randomUUID()}`);
    expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(before);
  }, 120_000);

  test("hostile copied credit metadata without a native binding is not adoptable", async () => {
    const scenario = await createCreditSubmissionScenario(deploy, runtime);
    const before = await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId);
    // All hostile object creation is rolled back, including a private copied
    // non-fiscal series. A real copied CRN source reaches the private projector;
    // app_role still has no ability to create its immutable binding.
    let reachedProjection = false;
    try {
      await deploy.begin(async tx => {
        await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
        const series = crypto.randomUUID(); const forged = crypto.randomUUID();
        await tx`INSERT INTO public.document_series(tenant_id,id,property_node,kind,prefix,next_no,fiscal)
          VALUES(${scenario.tenantId}::uuid,${series}::uuid,${scenario.propertyNode}::uuid,'credit_note','FORGED447-',1,false)`;
        await tx`INSERT INTO public.document SELECT (jsonb_populate_record(NULL::public.document,
          to_jsonb(d)||jsonb_build_object('id',${forged}::uuid,'series_id',${series}::uuid))).*
          FROM public.document d WHERE d.tenant_id=${scenario.tenantId}::uuid AND d.id=${scenario.documentId}::uuid`;
        const [bound] = await tx<{ count: number }[]>`SELECT count(*)::int count FROM public.india_native_fiscal_credit_note
          WHERE tenant_id=${scenario.tenantId}::uuid AND document_id=${forged}::uuid`;
        expect(bound?.count).toBe(0); reachedProjection = true;
        await tx`SELECT public.india_fiscal_submission_project_wire(${scenario.tenantId}::uuid,${scenario.propertyNode}::uuid,${forged}::uuid)`;
      });
      throw new Error("Forged CRN must not project");
    } catch (error) { expect(creditSqlState(error)).toBe("55000"); }
    expect(reachedProjection).toBe(true);
    expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(before);
  }, 120_000);
});
