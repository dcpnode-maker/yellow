import { SQL } from "bun";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile, rename, unlink } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { types as utilTypes } from "node:util";

import { PartyProfileService } from "../src/contexts/crm";
import { ChargeService, FolioService } from "../src/contexts/financials";
import { HoldService } from "../src/contexts/inventory";
import { ReservationCommitService } from "../src/contexts/reservations";
import {
  createPositiveTaxAttributionSnapshot,
  IndiaGstAccommodationFinalValuationService,
  IndiaNativeFiscalOperatorReadService,
  IndiaNativeFiscalSeriesConfigurationService,
  TaxAttributionPersistenceService,
  type IndiaNativeFiscalOperatorReadiness,
} from "../src/contexts/tax-fiscal";
import { IndiaGstAccommodationOrdinaryRegimeEvidenceService } from
  "../src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence";
import { IndiaGstAccommodationSourceIntakeService } from
  "../src/contexts/tax-fiscal/india-gst-accommodation-source-intake";
import { issueIndiaNativeFiscalInvoiceForOperator } from
  "../src/commands/issue-india-native-fiscal-invoice";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";
import { REVIEW_EMAIL, REVIEW_FISCAL_PERMISSIONS, REVIEW_ROLE_NAME } from "./seed-review";
import { SEED_TENANT, URL_NAMESPACE_UUID } from "./seed";
import { uuidV5 } from "./lib/uuid-v5";

export const FISCAL_REVIEW_MANIFEST_SCHEMA = "yellow-order444-fiscal-review/v1" as const;
export const FISCAL_REVIEW_PROPERTY_NAME = "Yellow Synthetic India Fiscal Review";
export const FISCAL_REVIEW_PROPERTY_TIMEZONE = "Asia/Kolkata";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MANIFEST_LIMIT = 32 * 1024;
const SOURCE_AMOUNT_MINOR = 10_000n;
const SOURCE_TAX_MINOR = 500n;
const SOURCE_PAYMENT_MINOR = 10_500n;
const FISCAL_SETUP_EMAIL = "fiscal-setup@yellow.local";
const FISCAL_SETUP_ROLE_NAME = "Synthetic fiscal series setup";
const SERIES_PERMISSION = "tax-fiscal.series:configure";

export interface FiscalReviewSeedManifest {
  readonly schema: typeof FISCAL_REVIEW_MANIFEST_SCHEMA;
  readonly tenantSlug: string;
  readonly propertyNode: string;
  readonly operatorEmail: string;
  readonly issuedDocumentId: string;
  readonly eligible: Readonly<{
    readonly reservationId: string;
    readonly folioId: string;
    readonly recipientRegistrationId: string;
  }>;
}

export interface FiscalReviewSeedOptions {
  readonly deploymentDatabaseUrl: string;
  readonly runtimeDatabaseUrl: string;
  readonly manifestPath?: string;
  readonly logger?: (line: string) => void;
}

export interface FiscalReviewSeedResult extends FiscalReviewSeedManifest {
  readonly issuedReservationId: string;
  readonly issuedFolioId: string;
  readonly issuedReplayed: boolean;
  readonly eligibleKind: "ready";
}

type Row = Record<string, unknown>;

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function exactDataRecord(value: unknown, keys: readonly string[], label: string): Row {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new Error(`${label} must be a plain own-data record`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length || keys.some((key) => {
    const descriptor = descriptors[key];
    return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
  })) throw new Error(`${label} has an invalid shape`);
  const result: Row = Object.create(null);
  for (const key of keys) result[key] = (descriptors[key] as PropertyDescriptor & { value: unknown }).value;
  return result;
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${label} must be a canonical UUID`);
  return value;
}

function requireVisible(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > maximum
      || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

export function fiscalReviewSeedManifestJson(value: FiscalReviewSeedManifest): string {
  const manifest = exactDataRecord(value, [
    "schema", "tenantSlug", "propertyNode", "operatorEmail", "issuedDocumentId", "eligible",
  ], "fiscal review manifest");
  const eligible = exactDataRecord(manifest.eligible, [
    "reservationId", "folioId", "recipientRegistrationId",
  ], "fiscal review manifest eligible source");
  if (manifest.schema !== FISCAL_REVIEW_MANIFEST_SCHEMA) throw new Error("fiscal review manifest schema is invalid");
  const canonical: FiscalReviewSeedManifest = Object.freeze({
    schema: FISCAL_REVIEW_MANIFEST_SCHEMA,
    tenantSlug: requireVisible(manifest.tenantSlug, "tenantSlug", 64),
    propertyNode: requireUuid(manifest.propertyNode, "propertyNode"),
    operatorEmail: (() => {
      const email = requireVisible(manifest.operatorEmail, "operatorEmail", 254);
      if (!EMAIL.test(email)) throw new Error("operatorEmail is invalid");
      return email;
    })(),
    issuedDocumentId: requireUuid(manifest.issuedDocumentId, "issuedDocumentId"),
    eligible: Object.freeze({
      reservationId: requireUuid(eligible.reservationId, "eligible.reservationId"),
      folioId: requireUuid(eligible.folioId, "eligible.folioId"),
      recipientRegistrationId: requireUuid(
        eligible.recipientRegistrationId,
        "eligible.recipientRegistrationId",
      ),
    }),
  });
  const encoded = `${JSON.stringify(canonical)}\n`;
  if (new TextEncoder().encode(encoded).length > MANIFEST_LIMIT) throw new Error("fiscal review manifest is too large");
  return encoded;
}

async function writeManifest(path: string, manifest: FiscalReviewSeedManifest): Promise<void> {
  if (!isAbsolute(path)) throw new Error("YELLOW_FISCAL_REVIEW_MANIFEST_PATH must be absolute");
  const encoded = fiscalReviewSeedManifestJson(manifest);
  try {
    const existing = await lstat(path);
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error("fiscal review manifest target must be a regular file");
    const current = await readFile(path, "utf8");
    if (current === encoded) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${path}.tmp-${process.pid}-${crypto.randomUUID()}`;
  let created = false;
  try {
    const handle = await open(temporary, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
    created = true;
    try {
      await handle.writeFile(encoded, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
    created = false;
  } finally {
    if (created) await unlink(temporary).catch(() => undefined);
  }
}

interface SeedIds {
  readonly property: string;
  readonly setupActor: string;
  readonly setupRole: string;
  readonly unitType: string;
  readonly spaces: readonly [string, string];
  readonly sellables: readonly [string, string];
  readonly ratePlan: string;
  readonly folioSeries: string;
  readonly revenueAccount: string;
  readonly cgstAccount: string;
  readonly sgstAccount: string;
  readonly sellerRegistration: string;
  readonly supplierLocation: string;
  readonly supplierSez: string;
  readonly recipientRegistration: string;
  readonly recipientSez: string;
  readonly classification: string;
  readonly reservations: readonly [string, string];
  readonly segments: readonly [string, string];
}

async function seedIds(): Promise<SeedIds> {
  const make = (name: string) => uuidV5(URL_NAMESPACE_UUID, `${SEED_TENANT.slug}/fiscal-review/${name}`);
  return Object.freeze({
    property: await make("property"), setupActor: await make("setup-actor"), setupRole: await make("setup-role"),
    unitType: await make("unit-type"),
    spaces: Object.freeze([await make("space-issued"), await make("space-eligible")]) as readonly [string, string],
    sellables: Object.freeze([await make("sellable-issued"), await make("sellable-eligible")]) as readonly [string, string],
    ratePlan: await make("rate-plan"), folioSeries: await make("folio-series"),
    revenueAccount: await make("room-revenue"), cgstAccount: await make("cgst-payable"),
    sgstAccount: await make("sgst-payable"), sellerRegistration: await make("seller-registration"),
    supplierLocation: await make("supplier-location"),
    supplierSez: await make("supplier-sez"), recipientRegistration: await make("recipient-registration"),
    recipientSez: await make("recipient-sez"), classification: await make("classification"),
    reservations: Object.freeze([await make("reservation-issued"), await make("reservation-eligible")]) as readonly [string, string],
    segments: Object.freeze([await make("segment-issued"), await make("segment-eligible")]) as readonly [string, string],
  });
}

interface SeedAuthority {
  readonly actorId: string;
  readonly roleId: string;
}

async function provisionStaticReviewContext(deploy: SQL, ids: SeedIds): Promise<SeedAuthority> {
  const authority = await deploy<Array<{ actor_id: string; role_id: string }>>`
    SELECT actor.id::text AS actor_id, role.id::text AS role_id
    FROM public.app_user actor
    JOIN public.role role ON role.tenant_id=actor.tenant_id AND role.name=${REVIEW_ROLE_NAME}
    WHERE actor.tenant_id=${SEED_TENANT.id}::uuid AND actor.email=${REVIEW_EMAIL}
      AND actor.status='active'`;
  const row = authority[0];
  if (authority.length !== 1 || !row) throw new Error("baseline review identity must be seeded before fiscal review");
  await deploy.begin(async tx => {
    await tx`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency,config)
      VALUES(${ids.property}::uuid,${SEED_TENANT.id}::uuid,'yellow_demo.fiscal_review'::ltree,
        'property',${FISCAL_REVIEW_PROPERTY_NAME},${FISCAL_REVIEW_PROPERTY_TIMEZONE},'INR',
        '{"source":"synthetic-local-review","jurisdiction":"IN"}'::jsonb)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.app_user(id,tenant_id,email,display_name,auth,status)
      VALUES(${ids.setupActor}::uuid,${SEED_TENANT.id}::uuid,${FISCAL_SETUP_EMAIL},
        'Synthetic fiscal setup authority','{}'::jsonb,'active') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.role(id,tenant_id,name)
      VALUES(${ids.setupRole}::uuid,${SEED_TENANT.id}::uuid,${FISCAL_SETUP_ROLE_NAME}) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.role_permission(role_id,permission_code)
      VALUES(${ids.setupRole}::uuid,${SERIES_PERMISSION}) ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node) VALUES
      (${SEED_TENANT.id}::uuid,${ids.setupActor}::uuid,${ids.setupRole}::uuid,${ids.property}::uuid),
      (${SEED_TENANT.id}::uuid,${row.actor_id}::uuid,${row.role_id}::uuid,${ids.property}::uuid)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy,attrs)
      VALUES(${ids.unitType}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,
        'FISCAL-ROOM','Synthetic fiscal room','hotel',2,'{"source":"synthetic-fiscal-review"}'::jsonb)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.space(id,tenant_id,property_node,code,profile_key,capacity,attrs) VALUES
      (${ids.spaces[0]}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,'FISCAL-101','hotel',1,'{"source":"synthetic-fiscal-review"}'::jsonb),
      (${ids.spaces[1]}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,'FISCAL-102','hotel',1,'{"source":"synthetic-fiscal-review"}'::jsonb)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
      (${ids.sellables[0]}::uuid,${SEED_TENANT.id}::uuid,${ids.unitType}::uuid,'Fiscal Room 101','active'),
      (${ids.sellables[1]}::uuid,${SEED_TENANT.id}::uuid,${ids.unitType}::uuid,'Fiscal Room 102','active')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
      (${SEED_TENANT.id}::uuid,${ids.sellables[0]}::uuid,${ids.spaces[0]}::uuid,'exclusive'),
      (${SEED_TENANT.id}::uuid,${ids.sellables[1]}::uuid,${ids.spaces[1]}::uuid,'exclusive')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status)
      VALUES(${ids.ratePlan}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,
        'FISCAL-REVIEW','Synthetic fiscal review rate','INR',false,'active') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.document_series(id,tenant_id,property_node,kind,prefix,next_no,fiscal)
      VALUES(${ids.folioSeries}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,'folio','FR-F/',1,false)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.account(id,tenant_id,property_node,role,name,currency,status) VALUES
      (${ids.revenueAccount}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,'revenue','Synthetic room revenue','INR','open'),
      (${ids.cgstAccount}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,'tax_payable','Synthetic CGST payable','INR','open'),
      (${ids.sgstAccount}::uuid,${SEED_TENANT.id}::uuid,${ids.property}::uuid,'tax_payable','Synthetic SGST payable','INR','open')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
      ('YRF_ROOM','Synthetic fiscal room revenue','revenue','Rooms','guest','revenue'),
      ('YRF_CGST','Synthetic fiscal CGST','tax','liabilities.tax','guest','tax_payable'),
      ('YRF_SGST','Synthetic fiscal SGST','tax','liabilities.tax','guest','tax_payable')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES
      (${SEED_TENANT.id}::uuid,${ids.property}::uuid,'INR','YRF_ROOM',${ids.revenueAccount}::uuid),
      (${SEED_TENANT.id}::uuid,${ids.property}::uuid,'INR','YRF_CGST',${ids.cgstAccount}::uuid),
      (${SEED_TENANT.id}::uuid,${ids.property}::uuid,'INR','YRF_SGST',${ids.sgstAccount}::uuid)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.tax_assignment(tenant_id,property_node,jurisdiction_key,effective)
      VALUES(${SEED_TENANT.id}::uuid,${ids.property}::uuid,'in-gst-lodging',daterange(NULL,NULL,'[)'))
      ON CONFLICT DO NOTHING`;
  });
  const checks = await deploy<Array<{ exact: boolean }>>`
    SELECT
      (SELECT count(*)=1 FROM public.org_node WHERE id=${ids.property}::uuid
        AND tenant_id=${SEED_TENANT.id}::uuid AND path='yellow_demo.fiscal_review'::ltree
        AND kind='property' AND name=${FISCAL_REVIEW_PROPERTY_NAME}
        AND timezone=${FISCAL_REVIEW_PROPERTY_TIMEZONE} AND currency='INR'
        AND config='{"source":"synthetic-local-review","jurisdiction":"IN"}'::jsonb)
      AND (SELECT count(*)=1 FROM public.app_user WHERE id=${ids.setupActor}::uuid
        AND tenant_id=${SEED_TENANT.id}::uuid AND email=${FISCAL_SETUP_EMAIL} AND auth='{}'::jsonb AND status='active')
      AND (SELECT count(*)=1 FROM public.role WHERE id=${ids.setupRole}::uuid
        AND tenant_id=${SEED_TENANT.id}::uuid AND name=${FISCAL_SETUP_ROLE_NAME})
      AND (SELECT count(*)=5 FROM public.role_permission rp
        WHERE rp.role_id=${row.role_id}::uuid AND rp.permission_code IN (
          ${REVIEW_FISCAL_PERMISSIONS[0].code},${REVIEW_FISCAL_PERMISSIONS[1].code},
          ${REVIEW_FISCAL_PERMISSIONS[2].code},${REVIEW_FISCAL_PERMISSIONS[3].code},
          ${REVIEW_FISCAL_PERMISSIONS[4].code}))
      AND NOT EXISTS(SELECT 1 FROM public.role_permission WHERE role_id=${ids.setupRole}::uuid
        AND permission_code<>${SERIES_PERMISSION})
      AND (SELECT count(*)=2 FROM public.user_role WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND scope_node=${ids.property}::uuid AND (user_id,role_id) IN (
          (${ids.setupActor}::uuid,${ids.setupRole}::uuid),(${row.actor_id}::uuid,${row.role_id}::uuid))) AS exact`;
  if (checks.length !== 1 || checks[0]?.exact !== true) throw new Error("fiscal review static context collides with non-canonical data");
  return Object.freeze({ actorId: row.actor_id, roleId: row.role_id });
}

interface FiscalDates {
  readonly issueDate: string;
  readonly serviceDate: string;
  readonly nightDate: string;
  readonly from: Date;
  readonly to: Date;
}

async function fiscalDates(deploy: SQL, ids: SeedIds): Promise<FiscalDates> {
  const clockRows = await deploy<Array<{ issue_date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS issue_date
    FROM public.org_node property WHERE property.id=${ids.property}::uuid
      AND property.tenant_id=${SEED_TENANT.id}::uuid`;
  const clock = clockRows[0];
  if (clockRows.length !== 1 || !clock) throw new Error("fiscal review property clock is unavailable");
  const retained = await deploy<Array<{ reservation_id: string; service_date: string; night_date: string;
    recorded_service_date: string | null }>>`
    SELECT reservation.id::text AS reservation_id,
      (upper(segment.period) AT TIME ZONE property.timezone)::date::text AS service_date,
      (lower(segment.period) AT TIME ZONE property.timezone)::date::text AS night_date,
      service.service_provision_date::text AS recorded_service_date
    FROM public.reservation reservation
    JOIN public.org_node property ON property.tenant_id=reservation.tenant_id AND property.id=reservation.property_node
    JOIN public.reservation_segment segment ON segment.tenant_id=reservation.tenant_id
      AND segment.reservation_id=reservation.id AND segment.id IN (${ids.segments[0]}::uuid,${ids.segments[1]}::uuid)
    LEFT JOIN public.india_gst_accommodation_service_provision_snapshot service
      ON service.tenant_id=reservation.tenant_id AND service.reservation_id=reservation.id
    WHERE reservation.tenant_id=${SEED_TENANT.id}::uuid
      AND reservation.id IN (${ids.reservations[0]}::uuid,${ids.reservations[1]}::uuid)
    ORDER BY reservation.id`;
  if (retained.length > 2 || retained.some(row => row.recorded_service_date !== null
      && row.recorded_service_date !== row.service_date)) {
    throw new Error("retained fiscal review service evidence conflicts with its immutable stay period");
  }
  const serviceDates = new Set(retained.map(row => row.service_date));
  const nightDates = new Set(retained.map(row => row.night_date));
  if (serviceDates.size > 1 || nightDates.size > 1) {
    throw new Error("retained fiscal review sources have divergent immutable service dates");
  }
  const initialDates = retained.length === 0 ? (await deploy<Array<{ service_date: string; night_date: string }>>`
    SELECT (${clock.issue_date}::date-1)::text AS service_date,
      (${clock.issue_date}::date-2)::text AS night_date`)[0] : undefined;
  const serviceDate = retained[0]?.service_date ?? initialDates?.service_date;
  const nightDate = retained[0]?.night_date ?? initialDates?.night_date;
  if (!serviceDate || !nightDate) throw new Error("fiscal review service date is unavailable");
  return Object.freeze({ issueDate: clock.issue_date, serviceDate, nightDate,
    from: new Date(`${nightDate}T12:00:00.000Z`), to: new Date(`${serviceDate}T12:00:00.000Z`) });
}

interface JurisdictionMember {
  readonly extensionId: string;
  readonly key: string;
  readonly version: number;
  readonly contentHash: string;
}

async function selectedJurisdiction(deploy: SQL, ids: SeedIds, date: string): Promise<JurisdictionMember> {
  const rows = await deploy.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${SEED_TENANT.id},true)`;
    await tx`SET LOCAL ROLE yellow_owner`;
    return tx<Array<{ member: JurisdictionMember; content: unknown }>>`
      SELECT public.read_india_native_rate_history_day(${SEED_TENANT.id}::uuid,${ids.property}::uuid,
        ${date}::date)->'selectedExtension' AS member, extension.content
      FROM public.extension extension
      WHERE extension.type='tax_jurisdiction' AND extension.key='in-gst-lodging'
        AND extension.version=2 AND extension.tenant_id IS NULL`;
  });
  const row = rows[0];
  if (rows.length !== 1 || !row || !row.member || row.member.key !== "in-gst-lodging"
      || row.member.version !== 2 || !UUID.test(row.member.extensionId)
      || !/^[0-9a-f]{64}$/.test(row.member.contentHash)) {
    throw new Error("canonical dated India GST jurisdiction is unavailable");
  }
  const content = row.content as { country?: unknown; price_display?: unknown; rounding?: unknown; taxes?: unknown };
  const room = Array.isArray(content.taxes)
    ? content.taxes.find((tax): tax is { code: string; slabs: Array<{ upto_minor: number | null; rate: number }> } =>
      typeof tax === "object" && tax !== null && (tax as { code?: unknown }).code === "GST_ROOM")
    : undefined;
  if (content.country !== "IN" || content.price_display !== "tax_exclusive" || content.rounding !== "document"
      || !room || !Array.isArray(room.slabs) || room.slabs[0]?.upto_minor !== 750000 || room.slabs[0]?.rate !== 0.05) {
    throw new Error("canonical dated India GST configuration does not match the admitted review source");
  }
  return Object.freeze(row.member);
}

function eventBus(pool: SQL): PostgresEventBus { return new PostgresEventBus(pool); }
function envelope(actorId: string, property: string, operation: string, requestId: string) {
  return createAuditEnvelope({ actorId, tenantId: SEED_TENANT.id, propertyNode: property, requestId, operation });
}

async function requestId(name: string): Promise<string> {
  return uuidV5(URL_NAMESPACE_UUID, `${SEED_TENANT.slug}/fiscal-review/request/${name}`);
}

function gstin(state: string, body: string): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", prefix = state + body;
  let factor = 2, sum = 0;
  for (let i = prefix.length - 1; i >= 0; i--) {
    const addend = factor * alphabet.indexOf(prefix[i]!);
    sum += Math.floor(addend / 36) + addend % 36;
    factor = factor === 2 ? 1 : 2;
  }
  return prefix + alphabet[(36 - sum % 36) % 36];
}

function tenantHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}

interface StatutoryResult { readonly recipientRegistrationId: string; readonly sellerRegistrationId: string }

async function provisionStatutory(
  deploy: SQL, ids: SeedIds, member: JurisdictionMember, partyId: string,
  serviceDate: string, issueDate: string,
): Promise<StatutoryResult> {
  const sellerBody = { registrationId: ids.sellerRegistration, propertyNode: ids.property,
    scheme: "in-gstin", currency: "INR", jurisdiction: { extensionId: member.extensionId,
      ownerTenantId: null, key: member.key, version: String(member.version), contentHash: member.contentHash },
    gstin: gstin("29", "ABCDE1234F1Z"), stateCode: "29", legalName: "Synthetic Yellow Review Hotel",
    tradeName: null, addressLine: "1 Synthetic Review Road", locality: "Bengaluru", postalCode: "560001" };
  const sellerEvidenceHash = tenantHash({ registrationId: ids.sellerRegistration,
    tenantId: SEED_TENANT.id, ...Object.fromEntries(Object.entries(sellerBody).filter(([key]) => key !== "registrationId")) });
  const recipientBody = { registrationId: ids.recipientRegistration, partyId, scheme: "in-gstin",
    gstin: gstin("29", "FGHIJ5678K1Z"), stateCode: "29", legalName: "Synthetic Fiscal Review Guest",
    tradeName: "Synthetic Review Buyer", addressLine1: "2 Synthetic Review Road", locality: "Bengaluru", pin: "560002" };
  const recipientEvidenceHash = tenantHash({ registrationId: ids.recipientRegistration,
    tenantId: SEED_TENANT.id, ...Object.fromEntries(Object.entries(recipientBody).filter(([key]) => key !== "registrationId")) });
  const portalEvidence = sha256("yellow-order444:synthetic-gst-portal-evidence");
  const supplierServiceStatusId = await uuidV5(
    URL_NAMESPACE_UUID,
    `${SEED_TENANT.slug}/fiscal-review/supplier-status/${serviceDate}`,
  );
  const supplierIssueStatusId = await uuidV5(
    URL_NAMESPACE_UUID,
    `${SEED_TENANT.slug}/fiscal-review/supplier-status/${issueDate}`,
  );
  await deploy.begin(async tx => {
    await tx`INSERT INTO public.property_fiscal_registration(tenant_id,id,property_node,scheme,currency,
      jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,
      registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code)
      VALUES(${SEED_TENANT.id}::uuid,${ids.sellerRegistration}::uuid,${ids.property}::uuid,'in-gstin','INR',
        ${member.extensionId}::uuid,NULL,${member.key},${member.version},${member.contentHash},${sellerBody.gstin},'29',
        ${sellerBody.legalName},NULL,${sellerBody.addressLine},${sellerBody.locality},${sellerBody.postalCode})
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,
      legal_name,trade_name,address_line1,locality,pin)
      VALUES(${SEED_TENANT.id}::uuid,${ids.recipientRegistration}::uuid,${partyId}::uuid,'in-gstin',${recipientBody.gstin},
        '29',${recipientBody.legalName},${recipientBody.tradeName},${recipientBody.addressLine1},${recipientBody.locality},${recipientBody.pin})
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.india_gst_supplier_service_location(tenant_id,id,supplier_registration_id,
      supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule)
      VALUES(${SEED_TENANT.id}::uuid,${ids.supplierLocation}::uuid,${ids.sellerRegistration}::uuid,
        ${sellerEvidenceHash},'lodging_accommodation','principal_place_of_business',
        'supply_made_from_registered_place_of_business','IGST_ACT_2_15_A') ON CONFLICT DO NOTHING`;
    const supplierStatuses = serviceDate === issueDate
      ? [[supplierIssueStatusId, issueDate] as const]
      : [[supplierServiceStatusId, serviceDate] as const, [supplierIssueStatusId, issueDate] as const];
    for (const [statusId, statusAsOf] of supplierStatuses) {
      await tx`INSERT INTO public.india_gst_supplier_registration_status_snapshot(tenant_id,id,supplier_registration_id,
        supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
        gst_status_evidence_sha256,legal_rule)
        VALUES(${SEED_TENANT.id}::uuid,${statusId}::uuid,${ids.sellerRegistration}::uuid,${sellerEvidenceHash},
          ${statusAsOf}::date,'active','regular','gst_common_portal',${portalEvidence},
          'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS') ON CONFLICT DO NOTHING`;
    }
    await tx`INSERT INTO public.india_gst_supplier_sez_status(tenant_id,id,supplier_registration_id,
      supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
      gst_status_evidence_sha256,legal_rule)
      VALUES(${SEED_TENANT.id}::uuid,${ids.supplierSez}::uuid,${ids.sellerRegistration}::uuid,${sellerEvidenceHash},
        ${serviceDate}::date,'active','regular','gst_common_portal',${portalEvidence},
        'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,
      recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
      gst_status_evidence_sha256,legal_rule)
      VALUES(${SEED_TENANT.id}::uuid,${ids.recipientSez}::uuid,${ids.recipientRegistration}::uuid,${recipientEvidenceHash},
        ${serviceDate}::date,'active','regular','gst_common_portal',${portalEvidence},
        'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.property_fiscal_location(tenant_id,property_node,country_code,state_code,address_line1,locality,pin)
      VALUES(${SEED_TENANT.id}::uuid,${ids.property}::uuid,'IN','29','3 Synthetic Review Road','Bengaluru','560003')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.india_gst_item_classification(tenant_id,id,property_node,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,line_id,
      revenue_group,classification_system,classification_code,is_service_code)
      VALUES(${SEED_TENANT.id}::uuid,${ids.classification}::uuid,${ids.property}::uuid,${member.extensionId}::uuid,NULL,
        ${member.key},${member.version},${member.contentHash},'IN','room','room_revenue','SAC','996311','Y')
      ON CONFLICT DO NOTHING`;
    for (const [semantic, code] of [["CGST", "YRF_CGST"], ["SGST", "YRF_SGST"]] as const) {
      await tx`INSERT INTO public.tax_semantic_route(tenant_id,property_node,currency,jurisdiction_extension_id,
        jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,
        semantic_code,tx_code) VALUES(${SEED_TENANT.id}::uuid,${ids.property}::uuid,'INR',${member.extensionId}::uuid,
        NULL,${member.key},${member.version},${member.contentHash},'tax',${semantic},${code}) ON CONFLICT DO NOTHING`;
    }
  });
  return Object.freeze({ recipientRegistrationId: ids.recipientRegistration, sellerRegistrationId: ids.sellerRegistration });
}

interface SourceResult {
  readonly reservationId: string;
  readonly folioId: string;
  readonly valuationId: string;
}

async function createSource(
  deploy: SQL, database: Database, bus: PostgresEventBus, ids: SeedIds, actorId: string,
  partyId: string, member: JurisdictionMember, dates: FiscalDates, index: 0 | 1,
): Promise<SourceResult> {
  const label = index === 0 ? "issued" : "eligible";
  const quoteHash = sha256(`yellow-order444:fiscal-review:${label}:quote`);
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash }, currency: "INR",
    line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: SOURCE_AMOUNT_MINOR,
      nights: 1, personNights: 2, roomNights: [{ businessDate: dates.nightDate, amountMinor: SOURCE_AMOUNT_MINOR }] },
    assignments: [{ businessDate: dates.nightDate, jurisdictionKey: member.key,
      evidenceRef: `tax-assignment:${sha256(`yellow-order444:${label}:assignment`)}` }],
    jurisdiction: { extensionId: member.extensionId, ownerTenantId: null, key: member.key,
      version: member.version, contentHash: member.contentHash,
      evidenceRef: `tax-jurisdiction:${sha256(`yellow-order444:${label}:jurisdiction`)}` },
    evaluation: { schemaVersion: 1, jurisdictionKey: member.key, country: "IN", priceDisplay: "tax_exclusive",
      rounding: "document", inputTotalMinor: SOURCE_AMOUNT_MINOR, baseTotalMinor: SOURCE_AMOUNT_MINOR,
      taxTotalMinor: SOURCE_TAX_MINOR, grandTotalMinor: SOURCE_PAYMENT_MINOR,
      taxes: [{ code: "GST_ROOM", name: "GST on accommodation", taxMinor: SOURCE_TAX_MINOR,
        components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: SOURCE_AMOUNT_MINOR,
          taxMinor: null, rateBasisPoints: 500 }] }] },
  });
  let holdId: string | undefined;
  const lineage = await deploy<Array<{ hold_id: string }>>`
    SELECT hold_id::text FROM public.tax_attribution_reservation_binding
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND reservation_id=${ids.reservations[index]}::uuid`;
  if (lineage.length === 1) holdId = lineage[0]!.hold_id;
  if (!holdId) {
    const existing = await deploy<Array<{ id: string }>>`
      SELECT id::text FROM public.hold WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND property_node=${ids.property}::uuid AND status='active'
        AND holder @> ${JSON.stringify({ fiscal_review_source: label })}::text::jsonb ORDER BY id`;
    if (existing.length > 1) throw new Error(`synthetic ${label} hold is ambiguous`);
    if (existing[0]) holdId = existing[0].id;
  }
  if (!holdId) {
    const held = await database.withTenantTransaction(SEED_TENANT.id, async tx => new HoldService(bus).place(tx, {
      sellableUnitId: ids.sellables[index], from: dates.from, to: dates.to, ttlSeconds: 600,
      holder: Object.freeze({ fiscal_review_source: label, synthetic: true }),
      envelope: envelope(actorId, ids.property, "hold.created", await requestId(`${label}-hold`)),
    }));
    holdId = held.id;
  }
  const attribution = await database.withTenantTransaction(SEED_TENANT.id, async tx =>
    new TaxAttributionPersistenceService({ events: bus, idempotency: new PostgresIdempotency() }).record(tx, {
      tenantId: SEED_TENANT.id, propertyNode: ids.property, snapshot,
      idempotencyKey: `review-fiscal-${label}-attribution`,
      envelope: envelope(actorId, ids.property, "tax.attribution_recorded", await requestId(`${label}-attribution`)),
    }));
  await database.withTenantTransaction(SEED_TENANT.id, tx => tx`
    SELECT * FROM public.record_tax_attribution_hold_binding(${SEED_TENANT.id}::uuid,${ids.property}::uuid,
      ${actorId}::uuid,${holdId}::uuid,${attribution.attributionId}::uuid)`);
  const generated = [ids.reservations[index], ids.segments[index]];
  const reservations = new ReservationCommitService({ holds: new HoldService(bus), events: bus,
    idempotency: new PostgresIdempotency(), idFactory: () => generated.shift() ?? "" });
  const reservation = await database.withTenantTransaction(SEED_TENANT.id, async tx => reservations.commitHeld(tx, {
    holdId: holdId!, primaryPartyId: partyId, ratePlanId: ids.ratePlan, adults: 2, childAges: [], channelCode: "direct",
    idempotencyKey: `review-fiscal-${label}-reservation`,
    envelope: envelope(actorId, ids.property, "reservation.confirmed", await requestId(`${label}-reservation`)),
  }));
  if (reservation.reservationId !== ids.reservations[index] || reservation.segmentId !== ids.segments[index]) {
    throw new Error(`synthetic ${label} reservation identities are inconsistent`);
  }
  const folio = await database.withTenantTransaction(SEED_TENANT.id, async tx =>
    new FolioService({ events: bus, idempotency: new PostgresIdempotency() }).openPrimary(tx, {
      tenantId: SEED_TENANT.id, reservationId: reservation.reservationId,
      idempotencyKey: `review-fiscal-${label}-folio`,
      envelope: envelope(actorId, ids.property, "folio.opened", await requestId(`${label}-folio`)),
    }));
  const charge = await database.withTenantTransaction(SEED_TENANT.id, async tx =>
    new ChargeService({ events: bus, idempotency: new PostgresIdempotency() }).postCharge(tx, {
      tenantId: SEED_TENANT.id, folioId: folio.folioId, txCode: "YRF_ROOM", amountMinor: SOURCE_AMOUNT_MINOR.toString(),
      idempotencyKey: `review-fiscal-${label}-charge`,
      envelope: envelope(actorId, ids.property, "journal.posted", await requestId(`${label}-charge`)),
    }));
  const roots = await deploy<Array<{ id: string }>>`
    SELECT line.id::text FROM public.posting_line line JOIN public.account account
      ON account.tenant_id=line.tenant_id AND account.id=line.account_id
    WHERE line.tenant_id=${SEED_TENANT.id}::uuid AND line.journal_id=${charge.journalId}::uuid
      AND line.folio_id=${folio.folioId}::uuid AND account.role='guest' AND line.seq=1`;
  if (roots.length !== 1 || !roots[0]) throw new Error(`synthetic ${label} charge has no canonical posting root`);
  const lineageRows = await deploy<Array<{ id: string }>>`
    SELECT id::text FROM public.tax_attribution_reservation_binding
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND reservation_id=${reservation.reservationId}::uuid
      AND segment_id=${reservation.segmentId}::uuid AND attribution_id=${attribution.attributionId}::uuid`;
  if (lineageRows.length !== 1 || !lineageRows[0]) throw new Error(`synthetic ${label} reservation lineage is unavailable`);
  const intake = new IndiaGstAccommodationSourceIntakeService();
  const ordinary = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
  const recorded = await database.withTenantTransaction(SEED_TENANT.id, async tx => {
    const service = await intake.recordServiceProvision(tx, Object.freeze({ tenantId: SEED_TENANT.id,
      propertyNode: ids.property, reservationId: reservation.reservationId,
      reservationLineageId: lineageRows[0]!.id,
      serviceProvisionDate: dates.serviceDate, serviceProvisionSource: "governed_service_provision_record" as const,
      serviceProvisionEvidenceSha256: sha256(`yellow-order444:${label}:service`),
      legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
      idempotencyKey: `review-fiscal-${label}-service`,
      envelope: envelope(actorId, ids.property, "india_gst.accommodation_service_provision_recorded",
        await requestId(`${label}-service`)) }));
    const payment = await intake.recordPaymentReceipt(tx, Object.freeze({ tenantId: SEED_TENANT.id,
      propertyNode: ids.property, reservationId: reservation.reservationId,
      serviceProvisionSnapshotId: service.serviceProvision.serviceProvisionSnapshotId,
      amountMinor: SOURCE_PAYMENT_MINOR.toString(), currency: "INR" as const,
      coverageScope: "full_attribution" as const, supplierBooksEntryDate: dates.serviceDate,
      supplierBankCreditDate: dates.serviceDate,
      paymentReceiptSource: "governed_supplier_payment_receipt_record" as const,
      paymentReceiptEvidenceSha256: sha256(`yellow-order444:${label}:payment`),
      legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const,
      idempotencyKey: `review-fiscal-${label}-payment`,
      envelope: envelope(actorId, ids.property, "india_gst.accommodation_payment_receipt_recorded",
        await requestId(`${label}-payment`)) }));
    const ordinaryEvidence = await ordinary.record(tx, Object.freeze({ tenantId: SEED_TENANT.id,
      propertyNode: ids.property, reservationId: reservation.reservationId,
      serviceProvisionSnapshotId: service.serviceProvision.serviceProvisionSnapshotId,
      regime: "ordinary_rule47_30_day" as const,
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
      ordinaryRegimeEvidenceSha256: sha256(`yellow-order444:${label}:ordinary-regime`),
      idempotencyKey: `review-fiscal-${label}-ordinary`,
      envelope: envelope(actorId, ids.property, "india_gst.accommodation_ordinary_regime_recorded",
        await requestId(`${label}-ordinary`)) }));
    return Object.freeze({ service, payment, ordinaryEvidence });
  });
  const valuation = await database.withTenantTransaction(SEED_TENANT.id, async tx =>
    new IndiaGstAccommodationFinalValuationService({ idempotency: new PostgresIdempotency() }).finalizeNative(tx,
      Object.freeze({ tenantId: SEED_TENANT.id, propertyNode: ids.property,
        reservationId: reservation.reservationId, folioId: folio.folioId, buyerPartyId: partyId,
        serviceProvisionSnapshotId: recorded.service.serviceProvision.serviceProvisionSnapshotId,
        sources: Object.freeze([Object.freeze({ postingRootId: roots[0]!.id,
          sourceKind: "room_consideration", additionSubtype: null, discountEligibility: null,
          evidenceSource: "operator_attestation", evidenceReference: `synthetic-fiscal-review-${label}-room` })]),
        ordinaryAttestation: Object.freeze({ relationshipConclusion: "unrelated_not_distinct" as const,
          considerationConclusion: "money_only" as const, section152Conclusion: "all_additions_enumerated" as const,
          section153Conclusion: "all_discounts_eligible" as const,
          sourceCompletenessConclusion: "all_sources_classified" as const,
          evidenceSource: "operator_attestation", evidenceReference: `synthetic-fiscal-review-${label}-section15` }),
        expectedCurrentValuationId: null, expectedCurrentEvidenceHash: null, approvalRequestId: null,
        idempotencyKey: `review-fiscal-${label}-valuation`,
        envelope: envelope(actorId, ids.property, "india_gst.accommodation_final_valuation_recorded",
          await requestId(`${label}-valuation`)) })));
  return Object.freeze({ reservationId: reservation.reservationId, folioId: folio.folioId,
    valuationId: valuation.valuationId });
}

function ready(value: IndiaNativeFiscalOperatorReadiness, label: string): Extract<IndiaNativeFiscalOperatorReadiness, { kind: "ready" }> {
  if (value.kind !== "ready") throw new Error(`synthetic ${label} source is not ready: ${value.kind}`);
  return value;
}

async function discoverReady(
  database: Database, ids: SeedIds, actorId: string, source: SourceResult,
): Promise<Extract<IndiaNativeFiscalOperatorReadiness, { kind: "ready" }>> {
  const result = await database.withTenantTransaction(SEED_TENANT.id, tx =>
    new IndiaNativeFiscalOperatorReadService().discover(tx, Object.freeze({ tenantId: SEED_TENANT.id,
      propertyNode: ids.property, actorId, reservationId: source.reservationId, folioId: source.folioId,
      recipientRegistrationId: ids.recipientRegistration, calendarEvidence: null })));
  if (!result.ok) throw new Error(`synthetic fiscal readiness failed: ${result.error.code}`);
  return ready(result.value, source.reservationId);
}

export async function runFiscalReviewSeed(options: FiscalReviewSeedOptions): Promise<FiscalReviewSeedResult> {
  if (!options || typeof options.deploymentDatabaseUrl !== "string" || !options.deploymentDatabaseUrl
      || typeof options.runtimeDatabaseUrl !== "string" || !options.runtimeDatabaseUrl
      || (options.logger !== undefined && typeof options.logger !== "function")) {
    throw new Error("fiscal review seed options are invalid");
  }
  const logger = options.logger ?? console.log;
  const ids = await seedIds();
  const deploy = new SQL(options.deploymentDatabaseUrl, { max: 4, prepare: false });
  const runtimePool = new SQL(options.runtimeDatabaseUrl, { max: 4, prepare: false });
  const database = Database.connect(options.runtimeDatabaseUrl, { maxConnections: 8, prepare: false });
  try {
    const authority = await provisionStaticReviewContext(deploy, ids);
    const dates = await fiscalDates(deploy, ids);
    await deploy`INSERT INTO public.business_day(tenant_id,property_node,business_date)
      VALUES(${SEED_TENANT.id}::uuid,${ids.property}::uuid,${dates.issueDate}::date) ON CONFLICT DO NOTHING`;
    const member = await selectedJurisdiction(deploy, ids, dates.serviceDate);
    const bus = eventBus(runtimePool);
    const party = await database.withTenantTransaction(SEED_TENANT.id, async tx =>
      new PartyProfileService({ events: bus, idempotency: new PostgresIdempotency() }).create(tx, {
        kind: "org", displayName: "Synthetic Fiscal Review Guest", legalName: "Synthetic Fiscal Review Guest",
        roles: ["guest"], contacts: [], acknowledgedDuplicatePartyIds: [],
        idempotencyKey: "review-fiscal-guest-party",
        envelope: envelope(authority.actorId, ids.property, "party.created", await requestId("party")),
      }));
    const statutory = await provisionStatutory(
      deploy, ids, member, party.party.partyId, dates.serviceDate, dates.issueDate,
    );
    const issuedSource = await createSource(deploy, database, bus, ids, authority.actorId,
      party.party.partyId, member, dates, 0);
    const eligibleSource = await createSource(deploy, database, bus, ids, authority.actorId,
      party.party.partyId, member, dates, 1);
    await database.withTenantTransaction(SEED_TENANT.id, async tx =>
      new IndiaNativeFiscalSeriesConfigurationService().configure(tx, Object.freeze({ tenantId: SEED_TENANT.id,
        propertyNode: ids.property, supplierRegistrationId: statutory.sellerRegistrationId,
        documentKind: "invoice" as const, prefix: "YR/",
        envelope: envelope(ids.setupActor, ids.property, "document.series.configured", await requestId("series")) })));

    const existingDocuments = await deploy<Array<{ document_id: string }>>`
      SELECT origin.document_id::text FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
      WHERE origin.tenant_id=${SEED_TENANT.id}::uuid AND origin.property_node=${ids.property}::uuid
        AND origin.reservation_id=${issuedSource.reservationId}::uuid AND origin.folio_id=${issuedSource.folioId}::uuid
        AND document.status='issued'`;
    let issuedDocumentId: string;
    let issuedReplayed: boolean;
    if (existingDocuments.length === 1 && existingDocuments[0]) {
      issuedDocumentId = existingDocuments[0].document_id;
      issuedReplayed = true;
    } else if (existingDocuments.length === 0) {
      const confirmation = await discoverReady(database, ids, authority.actorId, issuedSource);
      const receipt = await issueIndiaNativeFiscalInvoiceForOperator(database, Object.freeze({
        tenantId: SEED_TENANT.id, propertyNode: ids.property, actorId: authority.actorId,
        reservationId: issuedSource.reservationId, folioId: issuedSource.folioId,
        recipientRegistrationId: statutory.recipientRegistrationId, calendarEvidence: null,
        idempotencyKey: "review-fiscal-issued-document",
        envelope: envelope(authority.actorId, ids.property, "document.issued", await requestId("issued-document")),
        expectedSelectorHash: confirmation.selectorHash, expectedConfirmationHash: confirmation.evidenceHash,
      }));
      issuedDocumentId = receipt.documentId;
      issuedReplayed = receipt.replayed;
    } else {
      throw new Error("synthetic issued source has ambiguous immutable documents");
    }
    const eligible = await discoverReady(database, ids, authority.actorId, eligibleSource);
    if (eligible.confirmation.buyer.recipientRegistrationId !== statutory.recipientRegistrationId) {
      throw new Error("synthetic eligible source selected a different legal recipient");
    }
    const manifest: FiscalReviewSeedManifest = Object.freeze({ schema: FISCAL_REVIEW_MANIFEST_SCHEMA,
      tenantSlug: SEED_TENANT.slug, propertyNode: ids.property, operatorEmail: REVIEW_EMAIL,
      issuedDocumentId, eligible: Object.freeze({ reservationId: eligibleSource.reservationId,
        folioId: eligibleSource.folioId, recipientRegistrationId: statutory.recipientRegistrationId }) });
    if (options.manifestPath !== undefined) await writeManifest(options.manifestPath, manifest);
    logger(`fiscal review seed: tenant=${SEED_TENANT.slug} property=${FISCAL_REVIEW_PROPERTY_NAME}`);
    logger(`fiscal review documents: issued=${issuedDocumentId} eligible-reservation=${eligibleSource.reservationId}`);
    return Object.freeze({ ...manifest, issuedReservationId: issuedSource.reservationId,
      issuedFolioId: issuedSource.folioId, issuedReplayed, eligibleKind: "ready" as const });
  } finally {
    await database.close();
    await runtimePool.close({ timeout: 0 });
    await deploy.close({ timeout: 0 });
  }
}

if (import.meta.main) {
  const deploymentDatabaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  const runtimeDatabaseUrl = process.env.YELLOW_RUNTIME_DATABASE_URL;
  if (!deploymentDatabaseUrl || !runtimeDatabaseUrl) {
    throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL are required");
  }
  await runFiscalReviewSeed({ deploymentDatabaseUrl, runtimeDatabaseUrl,
    manifestPath: process.env.YELLOW_FISCAL_REVIEW_MANIFEST_PATH });
}
