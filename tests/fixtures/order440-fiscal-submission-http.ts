import { SQL } from "bun";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../../src/commands/issue-india-native-fiscal-invoice";
import {
  FiscalSubmissionAdapterAvailabilityService,
  FiscalSubmissionService,
  type FiscalSubmissionAdapterIdentity,
} from "../../src/contexts/tax-fiscal";
import { BearerTenantResolver, Hs256TokenSigner } from "../../src/contexts/identity";
import { createApp } from "../../src/app";
import { OperatorHttpApi } from "../../src/http/operator";
import type { Database } from "../../src/kernel";
import { LAUNCH_EXTENSION_TYPES } from "../../scripts/seed";
import { createNativeIssuanceFixture } from "./india-native-fiscal-source-completion-fixture";

export const FISCAL_REQUEST_SCOPE = "tax-fiscal.submissions:request";
export const FISCAL_RETRY_SCOPE = "tax-fiscal.submissions:retry";

export interface FiscalSubmissionHttpScenario {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly unauthorizedActorId: string;
  readonly roleId: string;
  readonly documentId: string;
  readonly provider: Readonly<FiscalSubmissionAdapterIdentity>;
}

export interface FiscalSubmissionHttpReceipt {
  readonly submissionId: string;
  readonly documentId: string;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly retryCount: number;
  readonly status: string;
  readonly disposition: string;
  readonly transitionSeq: number;
  readonly provider: {
    readonly key: string;
    readonly extensionId: string;
    readonly extensionVersion: number;
  };
  readonly replayed: boolean;
}

export interface FiscalSubmissionHttpBody {
  readonly fiscalSubmission: FiscalSubmissionHttpReceipt;
}

export function fiscalSubmissionHttpApp(
  database: Database,
  tokens: Hs256TokenSigner,
  identities: readonly unknown[],
  submissions: Pick<FiscalSubmissionService, "request" | "retry"> = new FiscalSubmissionService(),
) {
  const dependencies = {
    submissions,
    adapters: new FiscalSubmissionAdapterAvailabilityService(identities),
  };
  const OperatorConstructor = OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi;
  const operator = new OperatorConstructor(
    {},
    undefined,
    ...Array.from({ length: 44 }, () => undefined),
    dependencies,
  );
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: operator,
  });
}

export async function fiscalToken(
  tokens: Hs256TokenSigner,
  scenario: Pick<FiscalSubmissionHttpScenario, "tenantId" | "actorId">,
  scopes: readonly string[] = [FISCAL_REQUEST_SCOPE, FISCAL_RETRY_SCOPE],
): Promise<string> {
  return tokens.issue({ userId: scenario.actorId, tenantId: scenario.tenantId, scopes });
}

export async function createFiscalSubmissionHttpScenario(
  deploy: SQL,
  database: Database,
  grantPermissions = true,
): Promise<FiscalSubmissionHttpScenario> {
  const providerSchema = LAUNCH_EXTENSION_TYPES.find(({ type }) => type === "fiscal_provider")?.jsonSchema;
  if (!providerSchema) throw new Error("Canonical fiscal provider extension schema is unavailable");
  await deploy`INSERT INTO public.extension_type(type,json_schema)
    VALUES('fiscal_provider',${JSON.stringify(providerSchema)}::jsonb) ON CONFLICT DO NOTHING`;
  const issued = await createNativeIssuanceFixture(deploy, database, {
    label: `http440-${crypto.randomUUID().slice(0, 18)}`,
    roomNightAmounts: ["10000", "20000"],
    statutoryOriginalConfiguration: "karnataka_supplier_karnataka_property",
  });
  const issuedReceipt = await new IssueIndiaNativeFiscalInvoiceCommand(database).execute(issued.request);
  const [role] = await deploy<{ role_id: string }[]>`
    SELECT role_id::text
    FROM public.user_role
    WHERE tenant_id = ${issued.fixture.tenant}::uuid
      AND user_id = ${issued.fixture.actor}::uuid
    ORDER BY role_id
    LIMIT 1
  `;
  if (!role) throw new Error("Fiscal HTTP native fixture role is unavailable");
  const provider = Object.freeze({
    providerKey: "india-irp",
    providerExtensionId: crypto.randomUUID(),
    providerExtensionVersion: 1,
  });
  await deploy`
    INSERT INTO public.extension(id,tenant_id,type,key,version,effective,content,status)
    VALUES(
      ${provider.providerExtensionId}::uuid,
      ${issued.fixture.tenant}::uuid,
      'fiscal_provider',
      ${`in-irp-${provider.providerExtensionId}`}::text,
      ${provider.providerExtensionVersion}::integer,
      tstzrange(NULL,NULL,'[)'),
      ${JSON.stringify({ jurisdiction: "IN", mode: "in_house_reporting", provider_key: provider.providerKey,
        document_formats: ["irp_json_1_1"] })}::jsonb,
      'active'
    )
  `;
  const scenario = Object.freeze({
    tenantId: issued.fixture.tenant,
    propertyNode: issued.fixture.property,
    actorId: issued.fixture.actor,
    unauthorizedActorId: issued.fixture.unauthorizedActor,
    roleId: role.role_id,
    documentId: issuedReceipt.documentId,
    provider,
  });
  if (grantPermissions) await grantFiscalSubmissionHttpPermissions(deploy, scenario);
  return scenario;
}

export async function grantFiscalSubmissionHttpPermissions(
  deploy: SQL,
  scenario: Pick<FiscalSubmissionHttpScenario, "roleId">,
): Promise<void> {
  await deploy`
    INSERT INTO public.role_permission(role_id,permission_code)
    SELECT ${scenario.roleId}::uuid, code
    FROM public.permission
    WHERE code IN (${FISCAL_REQUEST_SCOPE}, ${FISCAL_RETRY_SCOPE})
    ON CONFLICT DO NOTHING
  `;
}

export function fiscalRequest(
  scenario: FiscalSubmissionHttpScenario,
  token: string,
  idempotencyKey: string,
  body: unknown = {
    documentId: scenario.documentId,
    providerExtensionId: scenario.provider.providerExtensionId,
  },
  suffix = "",
): Request {
  return new Request(
    `http://yellow.test/api/v1/properties/${scenario.propertyNode}/fiscal-submissions${suffix}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-correlation-id": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    },
  );
}

export function fiscalRetryRequest(
  scenario: FiscalSubmissionHttpScenario,
  token: string,
  submissionId: string,
  idempotencyKey: string,
  body: unknown = { providerExtensionId: scenario.provider.providerExtensionId },
  suffix = "",
): Request {
  return new Request(
    `http://yellow.test/api/v1/properties/${scenario.propertyNode}/fiscal-submissions/${submissionId}/retry${suffix}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-correlation-id": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    },
  );
}
