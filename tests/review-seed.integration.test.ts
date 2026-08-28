import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService, verifyLocalPassword } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import {
  RateModelService,
  RatePublicationService,
  RateQuoteService,
  RateTargetService,
} from "../src/contexts/rates";
import { OperatorHttpApi } from "../src/http/operator";
import { ApprovalService, Database, ExtensionRegistry, PostgresEventBus } from "../src/kernel";
import { runReviewSeed, REVIEW_APPROVER_EMAIL, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_REVIEW_SEED_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_REVIEW_SEED_URL;
const PASSWORD = process.env.YELLOW_REVIEW_SEED_PASSWORD;
const APPROVER_PASSWORD = PASSWORD ? `${PASSWORD}-approver` : undefined;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_REVIEW_SEED === "1";
const SECRET = "yellow-order-046-test-token-secret-exactly-long-enough";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL, YELLOW_RUNTIME_DATABASE_URL and YELLOW_REVIEW_SEED_PASSWORD are required by the Order 046 proof");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let platformPool: SQL;
let eventPool: SQL;
let database: Database;
let models: RateModelService;
let targets: RateTargetService;
let publication: RatePublicationService;
let quote: RateQuoteService;
let first: Awaited<ReturnType<typeof runReviewSeed>>;

async function counts() {
  const cashAccountId = String(first.cashAccountId);
  const cashDrawerId = String(first.cashDrawerId);
  const propertyCurrency = String(SEED_PROPERTY.currency);
  const rows = await admin<Array<{
    users: number; roles: number; grants: number; unit_types: number;
    spaces: number; sellables: number; requester_facts: number; requester_events: number;
    approver_facts: number; approver_events: number; policies: number; rate_plans: number;
    model_versions: number; target_versions: number; release_versions: number;
    active_releases: number; approvals: number; approved_approvals: number;
    cash_accounts: number; cash_drawers: number; cash_denominations: number;
    cashier_sessions: number; cashier_counts: number;
    receivable_parties: number; receivable_roles: number; receivable_accounts: number;
    receivable_journals: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM app_user WHERE id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)) AS users,
      (SELECT count(*)::int FROM role WHERE id = ${first.roleId}::uuid) AS roles,
      (SELECT count(*)::int FROM user_role WHERE user_id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)) AS grants,
      (SELECT count(*)::int FROM unit_type WHERE tenant_id = ${SEED_TENANT.id}::uuid AND attrs @> '{"source":"local-review"}') AS unit_types,
      (SELECT count(*)::int FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid AND attrs @> '{"source":"local-review"}') AS spaces,
      (SELECT count(*)::int FROM sellable_unit AS su JOIN unit_type AS ut ON ut.id = su.unit_type_id
        WHERE su.tenant_id = ${SEED_TENANT.id}::uuid AND ut.attrs @> '{"source":"local-review"}') AS sellables,
      (SELECT count(*)::int FROM fact_log WHERE actor_id = ${first.userId}::uuid) AS requester_facts,
      (SELECT count(*)::int FROM outbox WHERE actor_id = ${first.userId}::uuid) AS requester_events,
      (SELECT count(*)::int FROM fact_log WHERE actor_id = ${first.approverUserId}::uuid) AS approver_facts,
      (SELECT count(*)::int FROM outbox WHERE actor_id = ${first.approverUserId}::uuid) AS approver_events,
      (SELECT count(*)::int FROM policy WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS policies,
      (SELECT count(*)::int FROM rate_plan WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND property_node = ${SEED_PROPERTY.id}::uuid AND code = 'FLEX') AS rate_plans,
      (SELECT count(*)::int FROM extension WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND type = 'rate_plan_model' AND key LIKE 'rate-plan:%') AS model_versions,
      (SELECT count(*)::int FROM extension WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND type = 'rate_plan_target' AND key LIKE 'rate-plan:%') AS target_versions,
      (SELECT count(*)::int FROM extension WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND type = 'rate_plan_release' AND key LIKE 'rate-plan:%') AS release_versions,
      (SELECT count(*)::int FROM extension WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND type = 'rate_plan_release' AND key LIKE 'rate-plan:%' AND status = 'active') AS active_releases,
      (SELECT count(*)::int FROM approval_request WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND kind = 'rate_plan_release') AS approvals,
      (SELECT count(*)::int FROM approval_request WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND kind = 'rate_plan_release' AND status = 'approved') AS approved_approvals
      ,(SELECT count(*)::int FROM account WHERE id = ${cashAccountId}::uuid
        AND tenant_id = ${SEED_TENANT.id}::uuid AND property_node = ${SEED_PROPERTY.id}::uuid
        AND role = 'cash' AND currency = ${propertyCurrency}) AS cash_accounts
      ,(SELECT count(*)::int FROM cash_drawer WHERE id = ${cashDrawerId}::uuid
        AND tenant_id = ${SEED_TENANT.id}::uuid AND property_node = ${SEED_PROPERTY.id}::uuid
        AND code = 'FRONT-DESK-1' AND active) AS cash_drawers
      ,(SELECT count(*)::int FROM cash_drawer_denomination
        WHERE tenant_id = ${SEED_TENANT.id}::uuid AND drawer_id = ${cashDrawerId}::uuid
          AND active) AS cash_denominations
      ,(SELECT count(*)::int FROM cashier_session
        WHERE tenant_id = ${SEED_TENANT.id}::uuid AND drawer_id = ${cashDrawerId}::uuid) AS cashier_sessions
      ,(SELECT count(*)::int FROM cashier_count
        WHERE tenant_id = ${SEED_TENANT.id}::uuid AND drawer_id = ${cashDrawerId}::uuid) AS cashier_counts
      ,(SELECT count(*)::int FROM party
        WHERE tenant_id = ${SEED_TENANT.id}::uuid
          AND id IN (${first.companyPartyId}::uuid, ${first.agentPartyId}::uuid)
          AND kind = 'org' AND status = 'active') AS receivable_parties
      ,(SELECT count(*)::int FROM party_role
        WHERE tenant_id = ${SEED_TENANT.id}::uuid
          AND ((party_id = ${first.companyPartyId}::uuid AND role = 'company')
            OR (party_id = ${first.agentPartyId}::uuid AND role = 'agent'))) AS receivable_roles
      ,(SELECT count(*)::int FROM account
        WHERE tenant_id = ${SEED_TENANT.id}::uuid AND property_node = ${SEED_PROPERTY.id}::uuid
          AND role = 'company' AND status = 'open'
          AND id IN (${first.companyReceivableAccountId}::uuid, ${first.agentReceivableAccountId}::uuid)) AS receivable_accounts
      ,(SELECT count(DISTINCT posting_line.journal_id)::int
        FROM posting_line
        WHERE tenant_id = ${SEED_TENANT.id}::uuid
          AND account_id IN (${first.companyReceivableAccountId}::uuid,
            ${first.agentReceivableAccountId}::uuid)) AS receivable_journals
  `;
  const row = rows[0];
  if (!row) throw new Error("Order 046 count probe returned no row");
  return row;
}

async function canonicalRateRows() {
  const policies = await admin<Array<{ id: string; kind: string; name: string; content: unknown }>>`
    SELECT id, kind, name, content
    FROM policy
    WHERE tenant_id = ${SEED_TENANT.id}::uuid
    ORDER BY kind, name, id
  `;
  const plans = await admin<Array<{
    id: string; code: string; name: string; currency: string; tax_inclusive: boolean;
    cancellation_policy: string | null; guarantee_policy: string | null; deposit_policy: string | null;
    parent_plan: string | null; derivation: unknown; market_code: string | null;
    source_code: string | null; status: string;
  }>>`
    SELECT id, code, name, currency::text, tax_inclusive, cancellation_policy,
           guarantee_policy, deposit_policy, parent_plan, derivation, market_code, source_code, status
    FROM rate_plan
    WHERE tenant_id = ${SEED_TENANT.id}::uuid
      AND property_node = ${SEED_PROPERTY.id}::uuid
      AND code = 'FLEX'
    ORDER BY id
  `;
  return { policies, plans };
}

function requirePolicyId(policies: readonly { id: string; kind: string }[], kind: string): string {
  const matches = policies.filter((policy) => policy.kind === kind);
  const policy = matches[0];
  if (!policy || matches.length !== 1) throw new Error(`canonical ${kind} policy is absent or duplicated`);
  return policy.id;
}

function compareEvidenceRows(
  left: Readonly<{ actor_id: string; name: string }>,
  right: Readonly<{ actor_id: string; name: string }>,
): number {
  if (left.actor_id < right.actor_id) return -1;
  if (left.actor_id > right.actor_id) return 1;
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

async function rateSnapshot() {
  const extensions = await admin<Array<Record<string, unknown>>>`
    SELECT id, type, key, version, content, status
    FROM extension
    WHERE tenant_id = ${SEED_TENANT.id}::uuid
      AND type IN ('rate_plan_model', 'rate_plan_target', 'rate_plan_release')
    ORDER BY type, key, version, id
  `;
  const approvals = await admin<Array<Record<string, unknown>>>`
    SELECT id, kind, subject_type, subject_id, requested_by, payload, status, decided_by, decided_at, created_at
    FROM approval_request
    WHERE tenant_id = ${SEED_TENANT.id}::uuid AND kind = 'rate_plan_release'
    ORDER BY id
  `;
  const evidence = await admin<Array<Record<string, unknown>>>`
    SELECT 'fact' AS source, id, actor_id, entity_type AS kind, entity_id AS subject_id,
           fact_type AS name, payload
    FROM fact_log
    WHERE actor_id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)
    UNION ALL
    SELECT 'event' AS source, id, actor_id, aggregate_type AS kind, aggregate_id AS subject_id,
           event_type AS name, payload
    FROM outbox
    WHERE actor_id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)
    ORDER BY source, id
  `;
  return { ...(await canonicalRateRows()), extensions, approvals, evidence };
}

async function housekeepingSnapshot() {
  const assignedDirtyTaskId = String(first.housekeepingExamples.assignedDirtyTaskId);
  const doneCleanTaskId = String(first.housekeepingExamples.doneCleanTaskId);
  return admin<Array<Record<string, unknown>>>`
    SELECT task.id, task.status AS task_status, task.kind, task.subject_type,
           task.assignee_party, task.department, task.priority, task.credits, task.sheet_id,
           task.payload, space.code AS room_code, condition.condition,
           to_char(condition.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS room_updated_at,
           condition.updated_by,
           CASE WHEN task.completed_at IS NULL THEN NULL ELSE
             to_char(task.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS completed_at
    FROM task
    JOIN space ON space.id=task.subject_id AND space.tenant_id=task.tenant_id
    JOIN unit_condition AS condition
      ON condition.space_id=space.id AND condition.tenant_id=task.tenant_id
    WHERE task.id IN (${assignedDirtyTaskId}::uuid, ${doneCleanTaskId}::uuid)
    ORDER BY space.code
  `;
}

async function housekeepingSheetFixtureSnapshot() {
  const fixture = first.housekeepingExamples;
  return admin<Array<Record<string, unknown>>>`
    SELECT reservation.id AS reservation_id, reservation.status AS reservation_status,
           reservation.confirmation_no, segment.id AS segment_id,
           segment.status AS segment_status, segment.seq,
           to_char(lower(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stay_start,
           to_char(upper(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stay_end,
           space.id AS space_id, space.code AS room_code, space.profile_key,
           sellable.id AS sellable_unit_id, occupancy.id AS occupancy_id,
           occupancy.slot_kind, occupancy.exclusive, occupancy.claim::text,
           condition.condition,
           to_char(condition.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS condition_updated_at,
           condition.updated_by,
           (SELECT count(*)::int FROM task_sheet
             WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
               AND sheet_date=${fixture.sheetDate}::date) AS sheets,
           (SELECT count(*)::int FROM task
             WHERE tenant_id=${SEED_TENANT.id}::uuid AND subject_id=space.id) AS tasks,
           (SELECT count(*)::int FROM fact_log
             WHERE entity_id IN (reservation.id, segment.id, occupancy.id)) AS facts,
           (SELECT count(*)::int FROM outbox
             WHERE aggregate_id IN (reservation.id, segment.id, occupancy.id)) AS events,
           (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
           (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
           (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
           (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents
    FROM reservation
    JOIN reservation_segment AS segment
      ON segment.reservation_id=reservation.id AND segment.id=${fixture.eligibleSegmentId}::uuid
    JOIN sellable_unit AS sellable ON sellable.id=segment.sellable_unit_id
    JOIN sellable_unit_space AS assignment ON assignment.sellable_unit_id=sellable.id
    JOIN space ON space.id=assignment.space_id AND space.id=${fixture.eligibleSpaceId}::uuid
    JOIN space_occupancy AS occupancy
      ON occupancy.slot_ref=segment.id AND occupancy.id=${fixture.eligibleOccupancyId}::uuid
    JOIN unit_condition AS condition ON condition.space_id=space.id
    WHERE reservation.id=${fixture.eligibleReservationId}::uuid
  `;
}

async function departureReadinessFixtureSnapshot() {
  const fixture = first.housekeepingExamples;
  return admin<Array<Record<string, unknown>>>`
    SELECT reservation.id AS reservation_id, reservation.status AS reservation_status,
           segment.id AS segment_id, segment.status AS segment_status,
           to_char(lower(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stay_start,
           to_char(upper(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stay_end,
           space.id AS space_id, space.code AS room_code,
           occupancy.id AS occupancy_id, occupancy.slot_ref, occupancy.slot_kind,
           occupancy.exclusive, occupancy.claim::text,
           account.id AS account_id, account.role AS account_role,
           account.party_id AS account_party_id, account.name AS account_name,
           account.currency::text AS account_currency, account.status AS account_status,
           to_char(account.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS account_created_at,
           folio.id AS folio_id, folio.folio_no, folio.window_no,
           folio.name AS folio_name, folio.status AS folio_status,
           to_char(folio.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS folio_created_at,
           COALESCE(balance.balance_minor, 0)::text AS balance_minor,
           COALESCE(balance.lines, 0)::int AS posting_lines,
           (SELECT count(*)::int FROM task_sheet
             WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
               AND sheet_date=${fixture.sheetDate}::date) AS sheets,
           (SELECT count(*)::int FROM task
             WHERE tenant_id=${SEED_TENANT.id}::uuid AND subject_id=space.id) AS tasks,
           (SELECT count(*)::int FROM fact_log
             WHERE entity_id IN (reservation.id, segment.id, occupancy.id, account.id, folio.id)) AS facts,
           (SELECT count(*)::int FROM outbox
             WHERE aggregate_id IN (reservation.id, segment.id, occupancy.id, account.id, folio.id)) AS events,
           (SELECT count(*)::int FROM api_idempotency
             WHERE tenant_id=${SEED_TENANT.id}::uuid) AS idempotency_records,
           (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
           (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
           (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
           (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents
    FROM reservation
    JOIN reservation_segment AS segment
      ON segment.reservation_id=reservation.id AND segment.id=${fixture.eligibleSegmentId}::uuid
    JOIN sellable_unit_space AS assignment ON assignment.sellable_unit_id=segment.sellable_unit_id
    JOIN space ON space.id=assignment.space_id AND space.id=${fixture.eligibleSpaceId}::uuid
    JOIN space_occupancy AS occupancy
      ON occupancy.slot_ref=segment.id AND occupancy.id=${fixture.eligibleOccupancyId}::uuid
    JOIN account ON account.id=${fixture.departureAccountId}::uuid
      AND account.party_id=reservation.primary_party
    JOIN folio ON folio.id=${fixture.departureFolioId}::uuid
      AND folio.account_id=account.id AND folio.reservation_id=reservation.id
    LEFT JOIN folio_balance AS balance
      ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
    WHERE reservation.id=${fixture.eligibleReservationId}::uuid
  `;
}

async function checkoutCommandFixtureSnapshot() {
  const fixture = first.housekeepingExamples;
  return admin<Array<Record<string, unknown>>>`
    SELECT reservation.id AS reservation_id, reservation.confirmation_no,
           reservation.status AS reservation_status, reservation.primary_party,
           segment.id AS segment_id, segment.status AS segment_status, segment.seq,
           to_char(lower(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stay_start,
           to_char(upper(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS stay_end,
           segment.unit_type_id, segment.sellable_unit_id,
           space.id AS space_id, space.code AS room_code,
           occupancy.id AS occupancy_id, occupancy.slot_ref, occupancy.slot_kind,
           occupancy.exclusive, occupancy.claim::text,
           (occupancy.period && prior_occupancy.period) AS overlaps_order202,
           account.id AS account_id, account.role AS account_role,
           account.party_id AS account_party_id, account.status AS account_status,
           folio.id AS folio_id, folio.folio_no, folio.window_no,
           folio.name AS folio_name, folio.status AS folio_status,
           to_char(folio.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS folio_created_at,
           COALESCE(balance.balance_minor, 0)::text AS balance_minor,
           COALESCE(balance.lines, 0)::int AS posting_lines,
           (SELECT count(*)::int FROM space_occupancy AS daily_occupancy
             JOIN reservation_segment AS daily_segment ON daily_segment.id=daily_occupancy.slot_ref
             WHERE daily_occupancy.tenant_id=${SEED_TENANT.id}::uuid
               AND daily_occupancy.space_id=space.id
               AND daily_segment.status='in_house'
               AND daily_occupancy.period && tstzrange(
                 ${fixture.sheetDate}::date::timestamptz,
                 (${fixture.sheetDate}::date + 1)::timestamptz, '[)')) AS sheet_date_occupancies,
           (SELECT count(*)::int FROM task_sheet
             WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
               AND sheet_date=${fixture.sheetDate}::date) AS sheets,
           (SELECT count(*)::int FROM task
             WHERE tenant_id=${SEED_TENANT.id}::uuid AND subject_id=space.id) AS tasks,
           (SELECT count(*)::int FROM fact_log
             WHERE entity_id IN (reservation.id, segment.id, occupancy.id, folio.id)) AS facts,
           (SELECT count(*)::int FROM outbox
             WHERE aggregate_id IN (reservation.id, segment.id, occupancy.id, folio.id)) AS events,
           (SELECT count(*)::int FROM api_idempotency
             WHERE tenant_id=${SEED_TENANT.id}::uuid) AS idempotency_records,
           (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
           (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
           (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
           (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents
    FROM reservation
    JOIN reservation_segment AS segment
      ON segment.reservation_id=reservation.id AND segment.id=${fixture.checkoutSegmentId}::uuid
    JOIN sellable_unit_space AS assignment ON assignment.sellable_unit_id=segment.sellable_unit_id
    JOIN space ON space.id=assignment.space_id AND space.id=${fixture.eligibleSpaceId}::uuid
    JOIN space_occupancy AS occupancy
      ON occupancy.slot_ref=segment.id AND occupancy.id=${fixture.checkoutOccupancyId}::uuid
    JOIN space_occupancy AS prior_occupancy
      ON prior_occupancy.id=${fixture.eligibleOccupancyId}::uuid
    JOIN account ON account.id=${fixture.departureAccountId}::uuid
      AND account.party_id=reservation.primary_party
    JOIN folio ON folio.id=${fixture.checkoutFolioId}::uuid
      AND folio.account_id=account.id AND folio.reservation_id=reservation.id
    LEFT JOIN folio_balance AS balance
      ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
    WHERE reservation.id=${fixture.checkoutReservationId}::uuid
  `;
}

async function vehicleFixtureSnapshot() {
  return admin<Array<Record<string, unknown>>>`
    SELECT vehicle.id, vehicle.reg_no, vehicle.make, vehicle.model, vehicle.colour,
           vehicle.driver_name, vehicle.reservation_id, vehicle.party_id,
           to_char(vehicle.entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS entered_at,
           CASE WHEN vehicle.exited_at IS NULL THEN NULL ELSE
             to_char(vehicle.exited_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS exited_at,
           vehicle.notes, vehicle.parking_space,
           reservation.status AS reservation_status,
           reservation.property_node AS reservation_property,
           reservation.primary_party, party.tenant_id AS party_tenant_id
    FROM vehicle
    JOIN reservation ON reservation.id=vehicle.reservation_id
      AND reservation.tenant_id=vehicle.tenant_id
    JOIN party ON party.id=vehicle.party_id AND party.tenant_id=vehicle.tenant_id
    WHERE vehicle.tenant_id=${SEED_TENANT.id}::uuid
      AND vehicle.property_node=${SEED_PROPERTY.id}::uuid
      AND vehicle.id IN (${first.vehicleExamples.arrivalVehicleId}::uuid,
        ${first.vehicleExamples.departureVehicleId}::uuid)
    ORDER BY vehicle.reg_no, vehicle.id
  `;
}

async function arrivalTravelFixtureSnapshot() {
  return admin<Array<Record<string, unknown>>>`
    SELECT travel.id, travel.reservation_id, travel.direction, travel.mode,
           travel.carrier, travel.service_no,
           to_char(travel.scheduled_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS scheduled_at,
           travel.pickup_requested, travel.pickup_task_id, travel.notes,
           reservation.status AS reservation_status,
           reservation.property_node AS reservation_property
    FROM travel_detail AS travel
    JOIN reservation ON reservation.id=travel.reservation_id
      AND reservation.tenant_id=travel.tenant_id
    WHERE travel.tenant_id=${SEED_TENANT.id}::uuid
      AND travel.id IN (${first.arrivalTravelExamples.cleanTravelId}::uuid,
        ${first.arrivalTravelExamples.dirtyTravelId}::uuid)
    ORDER BY travel.scheduled_at, travel.id
  `;
}

async function departureTravelFixtureSnapshot() {
  return admin<Array<Record<string, unknown>>>`
    SELECT travel.id, travel.reservation_id, travel.direction, travel.mode,
           travel.carrier, travel.service_no,
           to_char(travel.scheduled_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS scheduled_at,
           travel.pickup_requested, travel.pickup_task_id, travel.notes,
           reservation.confirmation_no, reservation.status AS reservation_status,
           reservation.property_node AS reservation_property
    FROM travel_detail AS travel
    JOIN reservation ON reservation.id=travel.reservation_id
      AND reservation.tenant_id=travel.tenant_id
    WHERE travel.tenant_id=${SEED_TENANT.id}::uuid
      AND travel.id=${first.departureTravelExamples.checkoutTravelId}::uuid
    ORDER BY travel.scheduled_at, travel.id
  `;
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DEPLOY_DATABASE_URL, logger: () => undefined });
  first = await runReviewSeed({ databaseUrl: DEPLOY_DATABASE_URL, password: PASSWORD,
    approverPassword: APPROVER_PASSWORD!, logger: () => undefined });
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4 });
  loginPool = new SQL(RUNTIME_DATABASE_URL, { max: 4 });
  platformPool = new SQL(RUNTIME_DATABASE_URL, { max: 4, prepare: false });
  eventPool = new SQL(RUNTIME_DATABASE_URL, { max: 4 });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 8 });
  const registry = new ExtensionRegistry(platformPool);
  const events = new PostgresEventBus(eventPool);
  models = new RateModelService(registry);
  targets = new RateTargetService(registry);
  publication = new RatePublicationService(registry, new ApprovalService(events), events);
  quote = new RateQuoteService(publication);
});
afterAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL || !PASSWORD) return;
  await database.close();
  await eventPool.close();
  await platformPool.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 046 reproducible local-review seed", () => {
  test("Order 077 P0: provisions two deterministic property-scoped review identities", async () => {
    const reviewers = await admin<Array<{ email: string }>>`
      SELECT email
      FROM app_user
      WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND email IN (${REVIEW_EMAIL}, ${REVIEW_APPROVER_EMAIL})
      ORDER BY email
    `;
    expect(reviewers).toEqual([
      { email: REVIEW_APPROVER_EMAIL },
      { email: REVIEW_EMAIL },
    ]);
  });

  test("P1: provisions exact identities, six-room inventory and governed rate evidence", async () => {
    expect(first).toMatchObject({
      tenant: "yellow-demo",
      property: "Yellow Demo Property",
      email: REVIEW_EMAIL,
      approverEmail: REVIEW_APPROVER_EMAIL,
      unitTypes: { created: 2, existing: 0 },
      rooms: { created: 6, existing: 0 },
      sellableUnits: { created: 6, existing: 0 },
      rate: {
        ratePlanId: expect.any(String),
        activeReleaseId: expect.any(String),
        activeReleaseVersion: 1,
        created: true,
      },
    });
    expect(first.checkInExamples.cleanReservationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.checkInExamples.dirtyReservationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.checkInExamples.unassignedReservationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.checkInExamples.unassignedSegmentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.checkInExamples.identityGatedReservationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.checkInExamples.identityGatePropertyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.housekeepingExamples.assignedDirtyTaskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.housekeepingExamples.doneCleanTaskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.housekeepingExamples).toMatchObject({ sheetDate: "2026-09-18" });
    for (const id of [
      first.housekeepingExamples.attendantPartyId,
      first.housekeepingExamples.eligibleReservationId,
      first.housekeepingExamples.eligibleSegmentId,
      first.housekeepingExamples.eligibleSpaceId,
      first.housekeepingExamples.eligibleSellableUnitId,
      first.housekeepingExamples.eligibleOccupancyId,
      first.housekeepingExamples.departureAccountId,
      first.housekeepingExamples.departureFolioId,
      first.housekeepingExamples.checkoutReservationId,
      first.housekeepingExamples.checkoutSegmentId,
      first.housekeepingExamples.checkoutOccupancyId,
      first.housekeepingExamples.checkoutFolioId,
      first.vehicleExamples.arrivalVehicleId,
      first.vehicleExamples.departureVehicleId,
      first.arrivalTravelExamples.cleanTravelId,
      first.arrivalTravelExamples.dirtyTravelId,
      first.departureTravelExamples.checkoutTravelId,
      first.conditionInitializationSpaceId,
    ]) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.cashAccountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.cashDrawerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.companyPartyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.agentPartyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.companyReceivableAccountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.agentReceivableAccountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await counts()).toEqual({
      users: 2, roles: 1, grants: 6, unit_types: 2, spaces: 6,
      sellables: 6, requester_facts: 23, requester_events: 20,
      approver_facts: 2, approver_events: 2, policies: 4, rate_plans: 1,
      model_versions: 1, target_versions: 1, release_versions: 1,
      active_releases: 1, approvals: 1, approved_approvals: 1,
      cash_accounts: 1, cash_drawers: 1, cash_denominations: 10,
      cashier_sessions: 0, cashier_counts: 0,
      receivable_parties: 2, receivable_roles: 2, receivable_accounts: 2,
      receivable_journals: 0,
    });
    const initializationCandidates = await admin<Array<{
      code: string; status: string; conditions: number;
    }>>`
      SELECT space.code, space.status,
             count(condition.space_id)::int AS conditions
        FROM space
        LEFT JOIN unit_condition AS condition
          ON condition.tenant_id=space.tenant_id AND condition.space_id=space.id
       WHERE space.tenant_id=${SEED_TENANT.id}::uuid
         AND space.property_node=${SEED_PROPERTY.id}::uuid
         AND space.id=${first.conditionInitializationSpaceId}::uuid
       GROUP BY space.code, space.status
    `;
    expect(initializationCandidates).toEqual([{ code: "203", status: "active", conditions: 0 }]);
  });

  test("P2: every inventory aggregate carries one fact and one outbox event", async () => {
    const rows = await admin<Array<{ entity_type: string; aggregates: number; facts: number; events: number }>>`
      SELECT fact.entity_type,
             count(DISTINCT fact.entity_id)::int AS aggregates,
             count(DISTINCT fact.id)::int AS facts,
             count(DISTINCT event.id)::int AS events
      FROM fact_log AS fact
      JOIN outbox AS event
        ON event.aggregate_type = fact.entity_type
       AND event.aggregate_id = fact.entity_id
       AND event.correlation_id = (fact.payload ->> 'request_id')::uuid
      WHERE fact.actor_id = ${first.userId}::uuid
        AND fact.entity_type IN ('unit_type', 'space', 'sellable_unit')
      GROUP BY fact.entity_type
      ORDER BY fact.entity_type
    `;
    expect(rows).toEqual([
      { entity_type: "sellable_unit", aggregates: 6, facts: 6, events: 6 },
      { entity_type: "space", aggregates: 6, facts: 6, events: 6 },
      { entity_type: "unit_type", aggregates: 2, facts: 2, events: 2 },
    ]);
  });

  test("Order 171 P1/P4: provisions only canonical local-review financial configuration", async () => {
    const rows = await admin<Array<{
      series: number; revenue_accounts: number; room_codes: number; room_routes: number;
      current_open_days: number; guest_accounts: number; folios: number; journals: number;
      postings: number; payments: number; documents: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM document_series
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
            AND kind='folio' AND prefix='FOL-' AND fiscal=false AND next_no >= 1) AS series,
        (SELECT count(*)::int FROM account
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
            AND role='revenue' AND name='Room Revenue' AND currency='USD' AND status='open') AS revenue_accounts,
        (SELECT count(*)::int FROM tx_code
          WHERE code='ROOM' AND name='Room charge' AND grp='revenue' AND usali_line='Rooms'
            AND default_dr='guest' AND default_cr='revenue') AS room_codes,
        (SELECT count(*)::int FROM tx_code_route AS route
          JOIN account AS revenue ON revenue.id=route.credit_account_id AND revenue.tenant_id=route.tenant_id
          WHERE route.tenant_id=${SEED_TENANT.id}::uuid AND route.property_node=${SEED_PROPERTY.id}::uuid
            AND route.currency='USD' AND route.tx_code='ROOM' AND route.debit_account_id IS NULL
            AND revenue.role='revenue' AND revenue.name='Room Revenue') AS room_routes,
        (SELECT count(*)::int FROM business_day AS day
          JOIN org_node AS property ON property.id=day.property_node AND property.tenant_id=day.tenant_id
          WHERE day.tenant_id=${SEED_TENANT.id}::uuid AND day.property_node=${SEED_PROPERTY.id}::uuid
            AND day.business_date=(CURRENT_TIMESTAMP AT TIME ZONE property.timezone)::date
            AND day.sealed_at IS NULL) AS current_open_days,
        (SELECT count(*)::int FROM account WHERE tenant_id=${SEED_TENANT.id}::uuid AND role='guest') AS guest_accounts,
        (SELECT count(*)::int FROM folio WHERE tenant_id=${SEED_TENANT.id}::uuid) AS folios,
        (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
        (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
        (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents
    `;
    expect(rows[0]).toEqual({
      series: 1, revenue_accounts: 1, room_codes: 1, room_routes: 1, current_open_days: 1,
      guest_accounts: 5, folios: 6, journals: 0, postings: 0, payments: 0, documents: 0,
    });
  });

  test("Order 200 P6: provisions three deterministic due-in readiness examples without check-in or ledger effects", async () => {
    const ids = first.checkInExamples;
    const cleanReservationId = String(ids.cleanReservationId);
    const dirtyReservationId = String(ids.dirtyReservationId);
    const identityGatedReservationId = String(ids.identityGatedReservationId);
    const examples = await admin<Array<{
      confirmation_no: string; reservation_status: string; segment_status: string;
      room_code: string; condition: string; folio_status: string; window_no: number;
      identity_documents: number;
    }>>`
      SELECT reservation.confirmation_no, reservation.status AS reservation_status,
             segment.status AS segment_status, space.code AS room_code,
             condition.condition, folio.status AS folio_status, folio.window_no,
             count(identity.id)::int AS identity_documents
      FROM reservation
      JOIN reservation_segment AS segment ON segment.reservation_id=reservation.id
      JOIN sellable_unit_space AS assignment ON assignment.sellable_unit_id=segment.sellable_unit_id
      JOIN space ON space.id=assignment.space_id
      JOIN unit_condition AS condition ON condition.space_id=space.id
      JOIN folio ON folio.reservation_id=reservation.id AND folio.window_no=1
      JOIN reservation_guest AS guest ON guest.reservation_id=reservation.id
      LEFT JOIN identity_document AS identity ON identity.party_id=guest.party_id
      WHERE reservation.id IN (${cleanReservationId}::uuid, ${dirtyReservationId}::uuid,
        ${identityGatedReservationId}::uuid)
      GROUP BY reservation.confirmation_no, reservation.status, segment.status, space.code,
               condition.condition, folio.status, folio.window_no
      ORDER BY reservation.confirmation_no
    `;
    expect(examples).toEqual([
      { confirmation_no: "ARR-CLEAN", reservation_status: "due_in", segment_status: "booked",
        room_code: "101", condition: "clean", folio_status: "open", window_no: 1,
        identity_documents: 1 },
      { confirmation_no: "ARR-DIRTY", reservation_status: "due_in", segment_status: "booked",
        room_code: "102", condition: "dirty", folio_status: "open", window_no: 1,
        identity_documents: 1 },
      { confirmation_no: "ARR-IDENTITY", reservation_status: "due_in", segment_status: "booked",
        room_code: "G01", condition: "clean", folio_status: "open", window_no: 1,
        identity_documents: 0 },
    ]);
    const configuration = await admin<Array<{
      adapter_key: string | null; active_adapters: number; required_identity_fields: unknown;
      base_property_config: unknown;
      occupancy_claims: number; facts: number; events: number; journals: number;
      postings: number; payments: number; documents: number;
    }>>`
      SELECT
        property.config->>'statutory_adapter_key' AS adapter_key,
        (SELECT count(*)::int FROM extension
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND type='statutory_adapter'
            AND key=property.config->>'statutory_adapter_key' AND status='active'
            AND effective @> CURRENT_TIMESTAMP) AS active_adapters,
        (SELECT content->'required_identity_fields' FROM extension
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND type='statutory_adapter'
            AND key=property.config->>'statutory_adapter_key' AND status='active'
            AND effective @> CURRENT_TIMESTAMP) AS required_identity_fields,
        (SELECT config FROM org_node
          WHERE id=${SEED_PROPERTY.id}::uuid AND tenant_id=${SEED_TENANT.id}::uuid) AS base_property_config,
        (SELECT count(*)::int FROM space_occupancy AS occupancy
          JOIN reservation_segment AS seeded_segment ON seeded_segment.id=occupancy.slot_ref
          WHERE seeded_segment.reservation_id IN (${cleanReservationId}::uuid,
            ${dirtyReservationId}::uuid, ${identityGatedReservationId}::uuid)) AS occupancy_claims,
        (SELECT count(*)::int FROM fact_log
          WHERE entity_id IN (${cleanReservationId}::uuid, ${dirtyReservationId}::uuid,
            ${identityGatedReservationId}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox
          WHERE aggregate_id IN (${cleanReservationId}::uuid, ${dirtyReservationId}::uuid,
            ${identityGatedReservationId}::uuid)) AS events,
        (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
        (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
        (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents
      FROM org_node AS property
      WHERE property.id=${String(ids.identityGatePropertyId)}::uuid
        AND property.tenant_id=${SEED_TENANT.id}::uuid
    `;
    expect(configuration[0]).toEqual({
      adapter_key: "local-review-recorded-identity", active_adapters: 1,
      required_identity_fields: ["identity_document"], base_property_config: {}, occupancy_claims: 0,
      facts: 0, events: 0, journals: 0, postings: 0, payments: 0, documents: 0,
    });
  });

  test("Order 231 P6: provisions one exact unassigned due-in segment without occupancy or effects", async () => {
    const rows = await admin<Array<{
      reservation_id: string; confirmation_no: string; reservation_status: string;
      segment_id: string; segment_status: string; segment_count: number;
      unit_type_code: string; sellable_unit_id: string | null; folio_status: string;
      window_no: number; occupancy_claims: number; facts: number; events: number;
    }>>`
      SELECT reservation.id AS reservation_id, reservation.confirmation_no,
             reservation.status AS reservation_status, segment.id AS segment_id,
             segment.status AS segment_status,
             (SELECT count(*)::int FROM reservation_segment AS counted
               WHERE counted.tenant_id=reservation.tenant_id
                 AND counted.reservation_id=reservation.id) AS segment_count,
             unit_type.code AS unit_type_code, segment.sellable_unit_id,
             folio.status AS folio_status, folio.window_no,
             (SELECT count(*)::int FROM space_occupancy
               WHERE tenant_id=segment.tenant_id AND slot_ref=segment.id) AS occupancy_claims,
             (SELECT count(*)::int FROM fact_log
               WHERE tenant_id=reservation.tenant_id
                 AND entity_id IN (reservation.id,segment.id)) AS facts,
             (SELECT count(*)::int FROM outbox
               WHERE tenant_id=reservation.tenant_id
                 AND aggregate_id IN (reservation.id,segment.id)) AS events
        FROM reservation
        JOIN reservation_segment AS segment
          ON segment.tenant_id=reservation.tenant_id
         AND segment.reservation_id=reservation.id
        JOIN unit_type
          ON unit_type.tenant_id=segment.tenant_id AND unit_type.id=segment.unit_type_id
        JOIN folio
          ON folio.tenant_id=reservation.tenant_id
         AND folio.reservation_id=reservation.id AND folio.window_no=1
       WHERE reservation.tenant_id=${SEED_TENANT.id}::uuid
         AND reservation.id=${first.checkInExamples.unassignedReservationId}::uuid
    `;
    expect(rows).toEqual([{
      reservation_id: first.checkInExamples.unassignedReservationId,
      confirmation_no: "ARR-UNASSIGNED", reservation_status: "due_in",
      segment_id: first.checkInExamples.unassignedSegmentId, segment_status: "booked",
      segment_count: 1, unit_type_code: "STD", sellable_unit_id: null,
      folio_status: "open", window_no: 1, occupancy_claims: 0, facts: 0, events: 0,
    }]);
  });

  test("Order 229 P6: reuses one exact dirty arrival and active attendant without pre-creating a cleaning task", async () => {
    const rows = await admin<Array<{
      reservation_id: string; reservation_status: string; segment_status: string;
      current_segments: number; property_node: string; room_id: string; room_code: string;
      room_status: string; condition: string; attendant_id: string; attendant_status: string;
      staff_roles: number; actionable_tasks: number; arrival_cleaning_tasks: number;
    }>>`
      SELECT reservation.id AS reservation_id,
             reservation.status AS reservation_status,
             segment.status AS segment_status,
             (SELECT count(*)::int FROM reservation_segment AS current_segment
               WHERE current_segment.tenant_id=reservation.tenant_id
                 AND current_segment.reservation_id=reservation.id
                 AND current_segment.status='booked'
                 AND current_segment.period @> CURRENT_TIMESTAMP) AS current_segments,
             reservation.property_node,
             space.id AS room_id,
             space.code AS room_code,
             space.status AS room_status,
             condition.condition,
             attendant.id AS attendant_id,
             attendant.status AS attendant_status,
             (SELECT count(*)::int FROM party_role AS staff
               WHERE staff.tenant_id=attendant.tenant_id
                 AND staff.party_id=attendant.id AND staff.role='staff') AS staff_roles,
             (SELECT count(*)::int FROM task
               WHERE tenant_id=reservation.tenant_id
                 AND property_node=reservation.property_node
                 AND kind='housekeeping' AND subject_type='space' AND subject_id=space.id
                 AND status IN ('assigned','in_progress')) AS actionable_tasks,
             (SELECT count(*)::int FROM task
               WHERE tenant_id=reservation.tenant_id
                 AND property_node=reservation.property_node
                 AND kind='housekeeping' AND subject_type='space' AND subject_id=space.id
                 AND payload @> '{"source":"arrival_room_cleaning"}'::jsonb) AS arrival_cleaning_tasks
        FROM reservation
        JOIN reservation_segment AS segment
          ON segment.tenant_id=reservation.tenant_id AND segment.reservation_id=reservation.id
        JOIN sellable_unit_space AS assignment
          ON assignment.tenant_id=segment.tenant_id
         AND assignment.sellable_unit_id=segment.sellable_unit_id
        JOIN space
          ON space.tenant_id=assignment.tenant_id AND space.id=assignment.space_id
        JOIN unit_condition AS condition
          ON condition.tenant_id=space.tenant_id AND condition.space_id=space.id
        JOIN party AS attendant
          ON attendant.tenant_id=reservation.tenant_id
         AND attendant.id=${first.housekeepingExamples.attendantPartyId}::uuid
       WHERE reservation.tenant_id=${SEED_TENANT.id}::uuid
         AND reservation.id=${first.checkInExamples.dirtyReservationId}::uuid
    `;
    expect(rows).toEqual([{
      reservation_id: first.checkInExamples.dirtyReservationId,
      reservation_status: "due_in", segment_status: "booked", current_segments: 1,
      property_node: SEED_PROPERTY.id, room_id: expect.any(String), room_code: "102",
      room_status: "active", condition: "dirty",
      attendant_id: first.housekeepingExamples.attendantPartyId,
      attendant_status: "active", staff_roles: 1,
      actionable_tasks: 0, arrival_cleaning_tasks: 0,
    }]);
  });

  test("Order 201 P6: provisions assigned-dirty and done-clean tasks without transitions, sheets or occupancy", async () => {
    const rows = await housekeepingSnapshot();
    expect(rows).toEqual([
      {
        id: first.housekeepingExamples.assignedDirtyTaskId,
        task_status: "assigned", kind: "housekeeping", subject_type: "space",
        assignee_party: expect.any(String), department: "Housekeeping", priority: 2,
        credits: null, sheet_id: null,
        payload: { source: "local-review", housekeeping_example: "assigned-dirty" },
        room_code: "103", condition: "dirty",
        room_updated_at: "2026-09-16T08:00:00.000Z", updated_by: first.userId,
        completed_at: null,
      },
      {
        id: first.housekeepingExamples.doneCleanTaskId,
        task_status: "done", kind: "housekeeping", subject_type: "space",
        assignee_party: expect.any(String), department: "Housekeeping", priority: 2,
        credits: null, sheet_id: null,
        payload: { source: "local-review", housekeeping_example: "done-clean" },
        room_code: "201", condition: "clean",
        room_updated_at: "2026-09-16T09:00:00.000Z", updated_by: first.userId,
        completed_at: "2026-09-16T09:00:00.000Z",
      },
    ]);

    const guards = await admin<Array<{
      sheets: number; occupancy: number; reservation_assignments: number; facts: number; events: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM task_sheet
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid) AS sheets,
        (SELECT count(*)::int FROM space_occupancy
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND space_id IN (
            SELECT subject_id FROM task WHERE id IN (
              ${String(first.housekeepingExamples.assignedDirtyTaskId)}::uuid,
              ${String(first.housekeepingExamples.doneCleanTaskId)}::uuid))) AS occupancy,
        (SELECT count(*)::int FROM reservation_segment AS segment
          JOIN sellable_unit_space AS assignment ON assignment.sellable_unit_id=segment.sellable_unit_id
          WHERE assignment.space_id IN (
            SELECT subject_id FROM task WHERE id IN (
              ${String(first.housekeepingExamples.assignedDirtyTaskId)}::uuid,
              ${String(first.housekeepingExamples.doneCleanTaskId)}::uuid))) AS reservation_assignments,
        (SELECT count(*)::int FROM fact_log WHERE entity_id IN (
          ${String(first.housekeepingExamples.assignedDirtyTaskId)}::uuid,
          ${String(first.housekeepingExamples.doneCleanTaskId)}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id IN (
          ${String(first.housekeepingExamples.assignedDirtyTaskId)}::uuid,
          ${String(first.housekeepingExamples.doneCleanTaskId)}::uuid)) AS events
    `;
    expect(guards[0]).toEqual({ sheets: 0, occupancy: 0, reservation_assignments: 0, facts: 0, events: 0 });
  });

  test("Order 235 P6: provisions deterministic vacant and occupied room truth without discrepancy effects", async () => {
    const rows = await admin<Array<{
      room_code: string; condition: string; current_persons: number; open_discrepancies: number;
    }>>`
      SELECT room.code AS room_code, condition.condition,
             COALESCE((
               SELECT segment.adults + jsonb_array_length(segment.children)
                 FROM space_occupancy AS occupancy
                 JOIN reservation_segment AS segment
                   ON segment.tenant_id=occupancy.tenant_id AND segment.id=occupancy.slot_ref
                 JOIN reservation
                   ON reservation.tenant_id=segment.tenant_id AND reservation.id=segment.reservation_id
                WHERE occupancy.tenant_id=room.tenant_id AND occupancy.space_id=room.id
                  AND occupancy.exclusive AND occupancy.slot_kind='segment'
                  AND occupancy.period @> TIMESTAMPTZ '2026-08-28T12:00:00.000Z'
                  AND segment.period @> TIMESTAMPTZ '2026-08-28T12:00:00.000Z'
                  AND segment.status='in_house' AND reservation.status IN ('in_house','due_out')
             ), 0)::int AS current_persons,
             (SELECT count(*)::int FROM discrepancy
               WHERE tenant_id=room.tenant_id AND space_id=room.id AND resolved_at IS NULL) AS open_discrepancies
        FROM space AS room
        JOIN unit_condition AS condition
          ON condition.tenant_id=room.tenant_id AND condition.space_id=room.id
       WHERE room.tenant_id=${SEED_TENANT.id}::uuid
         AND room.property_node=${SEED_PROPERTY.id}::uuid
         AND room.code IN ('103','202')
       ORDER BY room.code
    `;
    expect(rows).toEqual([
      { room_code: "103", condition: "dirty", current_persons: 0, open_discrepancies: 0 },
      { room_code: "202", condition: "pickup", current_persons: 1, open_discrepancies: 0 },
    ]);
  });

  test("Order 202 P7: provisions one isolated daily in-house eligible room without generating a sheet", async () => {
    expect(await housekeepingSheetFixtureSnapshot()).toEqual([{
      reservation_id: first.housekeepingExamples.eligibleReservationId,
      reservation_status: "in_house", confirmation_no: "HK-SHEET-ELIGIBLE",
      segment_id: first.housekeepingExamples.eligibleSegmentId,
      segment_status: "in_house", seq: 1,
      stay_start: "2026-09-17T15:00:00.000Z", stay_end: "2026-09-19T11:00:00.000Z",
      space_id: first.housekeepingExamples.eligibleSpaceId, room_code: "202", profile_key: "hotel",
      sellable_unit_id: first.housekeepingExamples.eligibleSellableUnitId,
      occupancy_id: first.housekeepingExamples.eligibleOccupancyId,
      slot_kind: "segment", exclusive: true, claim: "[0,)", condition: "pickup",
      condition_updated_at: "2026-09-18T07:00:00.000Z", updated_by: first.userId,
      sheets: 0, tasks: 0, facts: 0, events: 0,
      journals: 0, postings: 0, payments: 0, documents: 0,
    }]);
    const profile = await admin<Array<{ cadence: string; matches: number }>>`
      SELECT content->>'housekeeping_cadence' AS cadence, count(*)::int AS matches
      FROM extension
      WHERE type='vertical_profile' AND key='hotel' AND status='active'
        AND effective @> '2026-09-18T00:00:00Z'::timestamptz
        AND (tenant_id IS NULL OR tenant_id=${SEED_TENANT.id}::uuid)
      GROUP BY content->>'housekeeping_cadence'
    `;
    expect(profile).toEqual([{ cadence: "daily", matches: 1 }]);
  });

  test("Order 203 P5: reuses the isolated in-house fixture with one settled zero-balance folio only", async () => {
    expect(await departureReadinessFixtureSnapshot()).toEqual([{
      reservation_id: first.housekeepingExamples.eligibleReservationId,
      reservation_status: "in_house",
      segment_id: first.housekeepingExamples.eligibleSegmentId,
      segment_status: "in_house",
      stay_start: "2026-09-17T15:00:00.000Z",
      stay_end: "2026-09-19T11:00:00.000Z",
      space_id: first.housekeepingExamples.eligibleSpaceId,
      room_code: "202",
      occupancy_id: first.housekeepingExamples.eligibleOccupancyId,
      slot_ref: first.housekeepingExamples.eligibleSegmentId,
      slot_kind: "segment",
      exclusive: true,
      claim: "[0,)",
      account_id: first.housekeepingExamples.departureAccountId,
      account_role: "guest",
      account_party_id: expect.any(String),
      account_name: "Housekeeping Sheet Eligible Guest Ledger",
      account_currency: "USD",
      account_status: "open",
      account_created_at: "2026-09-17T14:00:00.000Z",
      folio_id: first.housekeepingExamples.departureFolioId,
      folio_no: "DEP-HK-SHEET-1",
      window_no: 1,
      folio_name: "Primary",
      folio_status: "settled",
      folio_created_at: "2026-09-17T14:00:00.000Z",
      balance_minor: "0",
      posting_lines: 0,
      sheets: 0,
      tasks: 0,
      facts: 0,
      events: 0,
      idempotency_records: 0,
      journals: 0,
      postings: 0,
      payments: 0,
      documents: 0,
    }]);
  });

  test("Order 204 P6: provisions one past-started non-overlapping checkout-ready stay without command effects", async () => {
    expect(await checkoutCommandFixtureSnapshot()).toEqual([{
      reservation_id: first.housekeepingExamples.checkoutReservationId,
      confirmation_no: "CHECKOUT-READY",
      reservation_status: "due_out",
      primary_party: expect.any(String),
      segment_id: first.housekeepingExamples.checkoutSegmentId,
      segment_status: "in_house",
      seq: 1,
      stay_start: "2025-09-18T15:00:00.000Z",
      stay_end: "2026-09-17T15:00:00.000Z",
      unit_type_id: expect.any(String),
      sellable_unit_id: first.housekeepingExamples.eligibleSellableUnitId,
      space_id: first.housekeepingExamples.eligibleSpaceId,
      room_code: "202",
      occupancy_id: first.housekeepingExamples.checkoutOccupancyId,
      slot_ref: first.housekeepingExamples.checkoutSegmentId,
      slot_kind: "segment",
      exclusive: true,
      claim: "[0,)",
      overlaps_order202: false,
      account_id: first.housekeepingExamples.departureAccountId,
      account_role: "guest",
      account_party_id: expect.any(String),
      account_status: "open",
      folio_id: first.housekeepingExamples.checkoutFolioId,
      folio_no: "DEP-CHECKOUT-1",
      window_no: 1,
      folio_name: "Primary",
      folio_status: "settled",
      folio_created_at: "2026-08-27T14:00:00.000Z",
      balance_minor: "0",
      posting_lines: 0,
      sheet_date_occupancies: 1,
      sheets: 0,
      tasks: 0,
      facts: 0,
      events: 0,
      idempotency_records: 0,
      journals: 0,
      postings: 0,
      payments: 0,
      documents: 0,
    }]);
  });

  test("Order 205 P5: provisions two literal property vehicle rows without parking or lifecycle effects", async () => {
    expect(await vehicleFixtureSnapshot()).toEqual([
      {
        id: first.vehicleExamples.arrivalVehicleId,
        reg_no: "DL01AB2048",
        make: "Tata",
        model: "Nexon EV",
        colour: "Midnight Blue",
        driver_name: "Arrival Clean Example",
        reservation_id: first.checkInExamples.cleanReservationId,
        party_id: expect.any(String),
        entered_at: "2026-09-18T06:30:00.000Z",
        exited_at: null,
        notes: null,
        parking_space: null,
        reservation_status: "due_in",
        reservation_property: SEED_PROPERTY.id,
        primary_party: expect.any(String),
        party_tenant_id: SEED_TENANT.id,
      },
      {
        id: first.vehicleExamples.departureVehicleId,
        reg_no: "ON-YLW-2026",
        make: "Toyota",
        model: "RAV4",
        colour: "Pearl White",
        driver_name: "Housekeeping Sheet Eligible Guest",
        reservation_id: first.housekeepingExamples.eligibleReservationId,
        party_id: expect.any(String),
        entered_at: "2026-09-17T13:45:00.000Z",
        exited_at: "2026-09-19T11:20:00.000Z",
        notes: null,
        parking_space: null,
        reservation_status: "in_house",
        reservation_property: SEED_PROPERTY.id,
        primary_party: expect.any(String),
        party_tenant_id: SEED_TENANT.id,
      },
    ]);
    const guards = await admin<Array<{
      facts: number; events: number; occupancy_references: number; idempotency_records: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_id IN (
          ${first.vehicleExamples.arrivalVehicleId}::uuid,
          ${first.vehicleExamples.departureVehicleId}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id IN (
          ${first.vehicleExamples.arrivalVehicleId}::uuid,
          ${first.vehicleExamples.departureVehicleId}::uuid)) AS events,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref IN (
          ${first.vehicleExamples.arrivalVehicleId}::uuid,
          ${first.vehicleExamples.departureVehicleId}::uuid)) AS occupancy_references,
        (SELECT count(*)::int FROM api_idempotency
          WHERE tenant_id=${SEED_TENANT.id}::uuid) AS idempotency_records
    `;
    expect(guards[0]).toEqual({ facts: 0, events: 0, occupancy_references: 0, idempotency_records: 0 });
  });

  test("Order 206 P5: provisions two exact arrival rows without pickup tasks or command effects", async () => {
    expect(await arrivalTravelFixtureSnapshot()).toEqual([
      {
        id: first.arrivalTravelExamples.cleanTravelId,
        reservation_id: first.checkInExamples.cleanReservationId,
        direction: "arrival",
        mode: "flight",
        carrier: "Air India",
        service_no: "AI141",
        scheduled_at: "2026-09-18T07:15:30.123456Z",
        pickup_requested: true,
        pickup_task_id: null,
        notes: null,
        reservation_status: "due_in",
        reservation_property: SEED_PROPERTY.id,
      },
      {
        id: first.arrivalTravelExamples.dirtyTravelId,
        reservation_id: first.checkInExamples.dirtyReservationId,
        direction: "arrival",
        mode: "train",
        carrier: "Indian Railways",
        service_no: "12952",
        scheduled_at: "2026-09-18T08:45:00.654321Z",
        pickup_requested: false,
        pickup_task_id: null,
        notes: null,
        reservation_status: "due_in",
        reservation_property: SEED_PROPERTY.id,
      },
    ]);

    const guards = await admin<Array<{
      departure_rows: number; pickup_tasks: number; task_subjects: number;
      facts: number; events: number; occupancy_references: number; idempotency_records: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM travel_detail
          WHERE tenant_id=${SEED_TENANT.id}::uuid AND direction='departure'
            AND reservation_id IN (${first.checkInExamples.cleanReservationId}::uuid,
              ${first.checkInExamples.dirtyReservationId}::uuid)) AS departure_rows,
        (SELECT count(*)::int FROM task WHERE id IN (
          SELECT pickup_task_id FROM travel_detail
          WHERE id IN (${first.arrivalTravelExamples.cleanTravelId}::uuid,
            ${first.arrivalTravelExamples.dirtyTravelId}::uuid))) AS pickup_tasks,
        (SELECT count(*)::int FROM task
          WHERE subject_id IN (${first.arrivalTravelExamples.cleanTravelId}::uuid,
            ${first.arrivalTravelExamples.dirtyTravelId}::uuid)) AS task_subjects,
        (SELECT count(*)::int FROM fact_log
          WHERE entity_id IN (${first.arrivalTravelExamples.cleanTravelId}::uuid,
            ${first.arrivalTravelExamples.dirtyTravelId}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox
          WHERE aggregate_id IN (${first.arrivalTravelExamples.cleanTravelId}::uuid,
            ${first.arrivalTravelExamples.dirtyTravelId}::uuid)) AS events,
        (SELECT count(*)::int FROM space_occupancy
          WHERE slot_ref IN (${first.arrivalTravelExamples.cleanTravelId}::uuid,
            ${first.arrivalTravelExamples.dirtyTravelId}::uuid)) AS occupancy_references,
        (SELECT count(*)::int FROM api_idempotency
          WHERE tenant_id=${SEED_TENANT.id}::uuid) AS idempotency_records
    `;
    expect(guards[0]).toEqual({
      departure_rows: 0,
      pickup_tasks: 0,
      task_subjects: 0,
      facts: 0,
      events: 0,
      occupancy_references: 0,
      idempotency_records: 0,
    });
  });

  test("Order 207 P5: provisions one exact checkout-ready departure row without task or command effects", async () => {
    expect(await departureTravelFixtureSnapshot()).toEqual([{
      id: first.departureTravelExamples.checkoutTravelId,
      reservation_id: first.housekeepingExamples.checkoutReservationId,
      direction: "departure",
      mode: "flight",
      carrier: "Air Canada",
      service_no: "AC43",
      scheduled_at: "2026-09-17T18:25:45.987654Z",
      pickup_requested: false,
      pickup_task_id: null,
      notes: null,
      confirmation_no: "CHECKOUT-READY",
      reservation_status: "due_out",
      reservation_property: SEED_PROPERTY.id,
    }]);

    const travelId = first.departureTravelExamples.checkoutTravelId;
    const guards = await admin<Array<{
      departure_rows: number; arrival_rows: number; pickup_tasks: number;
      task_subjects: number; facts: number; events: number;
      occupancy_references: number; idempotency_records: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM travel_detail
          WHERE tenant_id=${SEED_TENANT.id}::uuid
            AND reservation_id=${first.housekeepingExamples.checkoutReservationId}::uuid
            AND direction='departure') AS departure_rows,
        (SELECT count(*)::int FROM travel_detail
          WHERE tenant_id=${SEED_TENANT.id}::uuid
            AND reservation_id=${first.housekeepingExamples.checkoutReservationId}::uuid
            AND direction='arrival') AS arrival_rows,
        (SELECT count(*)::int FROM task WHERE id IN (
          SELECT pickup_task_id FROM travel_detail WHERE id=${travelId}::uuid)) AS pickup_tasks,
        (SELECT count(*)::int FROM task WHERE subject_id=${travelId}::uuid) AS task_subjects,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${travelId}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${travelId}::uuid) AS events,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${travelId}::uuid)
          AS occupancy_references,
        (SELECT count(*)::int FROM api_idempotency
          WHERE tenant_id=${SEED_TENANT.id}::uuid) AS idempotency_records
    `;
    expect(guards[0]).toEqual({
      departure_rows: 1,
      arrival_rows: 0,
      pickup_tasks: 0,
      task_subjects: 0,
      facts: 0,
      events: 0,
      occupancy_references: 0,
      idempotency_records: 0,
    });
  });

  test("P3: identical rerun is an exact no-op", async () => {
    const before = await counts();
    const housekeepingBefore = await housekeepingSnapshot();
    const sheetFixtureBefore = await housekeepingSheetFixtureSnapshot();
    const departureFixtureBefore = await departureReadinessFixtureSnapshot();
    const checkoutFixtureBefore = await checkoutCommandFixtureSnapshot();
    const vehicleFixtureBefore = await vehicleFixtureSnapshot();
    const arrivalTravelFixtureBefore = await arrivalTravelFixtureSnapshot();
    const departureTravelFixtureBefore = await departureTravelFixtureSnapshot();
    const logLines: string[] = [];
    const second = await runReviewSeed({ databaseUrl: DEPLOY_DATABASE_URL!, password: PASSWORD!,
      approverPassword: APPROVER_PASSWORD!, logger: (line) => logLines.push(line) });
    expect(second).toMatchObject({
      unitTypes: { created: 0, existing: 2 },
      rooms: { created: 0, existing: 6 },
      sellableUnits: { created: 0, existing: 6 },
      rate: {
        ratePlanId: first.rate.ratePlanId,
        activeReleaseId: first.rate.activeReleaseId,
        activeReleaseVersion: first.rate.activeReleaseVersion,
        created: false,
      },
    });
    expect(await counts()).toEqual(before);
    expect(await housekeepingSnapshot()).toEqual(housekeepingBefore);
    expect(second.housekeepingExamples).toEqual(first.housekeepingExamples);
    expect(second.checkInExamples).toEqual(first.checkInExamples);
    expect(second.vehicleExamples).toEqual(first.vehicleExamples);
    expect(second.arrivalTravelExamples).toEqual(first.arrivalTravelExamples);
    expect(second.departureTravelExamples).toEqual(first.departureTravelExamples);
    expect(await housekeepingSheetFixtureSnapshot()).toEqual(sheetFixtureBefore);
    expect(await departureReadinessFixtureSnapshot()).toEqual(departureFixtureBefore);
    expect(await checkoutCommandFixtureSnapshot()).toEqual(checkoutFixtureBefore);
    expect(await vehicleFixtureSnapshot()).toEqual(vehicleFixtureBefore);
    expect(await arrivalTravelFixtureSnapshot()).toEqual(arrivalTravelFixtureBefore);
    expect(await departureTravelFixtureSnapshot()).toEqual(departureTravelFixtureBefore);
    expect(logLines).toContain(
      `review departure readiness fixture: reservation=${first.housekeepingExamples.eligibleReservationId} segment=${first.housekeepingExamples.eligibleSegmentId} room=${first.housekeepingExamples.eligibleSpaceId} occupancy=${first.housekeepingExamples.eligibleOccupancyId} account=${first.housekeepingExamples.departureAccountId} folio=${first.housekeepingExamples.departureFolioId}`,
    );
    expect(logLines).toContain(
      `review checkout command fixture: reservation=${first.housekeepingExamples.checkoutReservationId} segment=${first.housekeepingExamples.checkoutSegmentId} room=${first.housekeepingExamples.eligibleSpaceId} occupancy=${first.housekeepingExamples.checkoutOccupancyId} account=${first.housekeepingExamples.departureAccountId} folio=${first.housekeepingExamples.checkoutFolioId}`,
    );
    expect(logLines).toContain(
      `review vehicle fixtures: arrival=${first.vehicleExamples.arrivalVehicleId} departure=${first.vehicleExamples.departureVehicleId}`,
    );
    expect(logLines).toContain(
      `review arrival travel fixtures: clean=${first.arrivalTravelExamples.cleanTravelId} dirty=${first.arrivalTravelExamples.dirtyTravelId}`,
    );
    expect(logLines).toContain(
      `review departure travel fixture: checkout=${first.departureTravelExamples.checkoutTravelId}`,
    );
  });

  test("P4: same identity with a different password fails without mutation", async () => {
    const before = await counts();
    await expect(runReviewSeed({ databaseUrl: DEPLOY_DATABASE_URL!, password: `${PASSWORD!}-collision`,
      approverPassword: APPROVER_PASSWORD!, logger: () => undefined }))
      .rejects.toThrow("Review user collides with non-canonical local-review data");
    expect(await counts()).toEqual(before);
    const users = await admin<Array<{ auth: unknown }>>`
      SELECT auth FROM app_user WHERE id = ${first.userId}::uuid
    `;
    expect(await verifyLocalPassword(PASSWORD!, users[0]?.auth)).toBe(true);
  });

  test("Order 077 P3: a divergent or shared approver secret fails atomically", async () => {
    const before = await counts();
    await expect(runReviewSeed({ databaseUrl: DEPLOY_DATABASE_URL!, password: PASSWORD!,
      approverPassword: `${APPROVER_PASSWORD!}-collision`, logger: () => undefined }))
      .rejects.toThrow("Review approver collides with non-canonical local-review data");
    await expect(runReviewSeed({ databaseUrl: DEPLOY_DATABASE_URL!, password: PASSWORD!,
      approverPassword: PASSWORD!, logger: () => undefined }))
      .rejects.toThrow("approverPassword must be distinct from password");
    expect(await counts()).toEqual(before);
    const users = await admin<Array<{ id: string; auth: unknown }>>`
      SELECT id, auth FROM app_user
      WHERE id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)
      ORDER BY id
    `;
    const requester = users.find(({ id }) => id === first.userId);
    const approver = users.find(({ id }) => id === first.approverUserId);
    expect(await verifyLocalPassword(PASSWORD!, requester?.auth)).toBe(true);
    expect(await verifyLocalPassword(APPROVER_PASSWORD!, approver?.auth)).toBe(true);
  });

  test("P5: login is least-scope and availability returns six real options", async () => {
    const tokens = new Hs256TokenSigner(SECRET);
    const app = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService()),
    });
    const login = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
    }));
    expect(login.status).toBe(200);
    const loginBody = await login.json() as { accessToken: string };
    expect(await tokens.verify(loginBody.accessToken)).toMatchObject({
      sub: first.userId,
      tid: SEED_TENANT.id,
      scp: "crm.parties:read crm.parties:write financials.adjustments:write financials.cashiers:operate financials.cashiers:read financials.charges:write financials.folios:close financials.folios:open financials.folios:read financials.folios:settle financials.receivables:read financials.receivables:transfer financials.transfers:write housekeeping.arrival-tasks:create housekeeping.arrival-tasks:read housekeeping.conditions:initialize housekeeping.discrepancies:read housekeeping.discrepancies:report housekeeping.sheets:generate housekeeping.sheets:read housekeeping.tasks:read housekeeping.tasks:work inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.offline_leases:read inventory.offline_leases:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write reservations.booking:write reservations.guests:read reservations.guests:write reservations.lifecycle:read reservations.lifecycle:write reservations.segments:read reservations.segments:write stay-operations.checkin:commit stay-operations.checkin:read stay-operations.checkout:commit stay-operations.checkout:read stay-operations.pickup-tasks:dispatch stay-operations.pickup-tasks:work stay-operations.vehicles:read",
    });
    const approverLogin = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_APPROVER_EMAIL,
        password: APPROVER_PASSWORD }),
    }));
    expect(approverLogin.status).toBe(200);
    const approverLoginBody = await approverLogin.json() as { accessToken: string };
    expect(approverLoginBody.accessToken).not.toBe(loginBody.accessToken);
    expect(await tokens.verify(approverLoginBody.accessToken)).toMatchObject({
      sub: first.approverUserId,
      tid: SEED_TENANT.id,
      scp: "crm.parties:read crm.parties:write financials.adjustments:post-seal financials.adjustments:write financials.cashiers:operate financials.cashiers:read financials.cashiers:supervise financials.charges:write financials.folios:close financials.folios:open financials.folios:read financials.folios:settle financials.receivables:approve financials.receivables:read financials.receivables:transfer financials.transfers:write housekeeping.arrival-tasks:create housekeeping.arrival-tasks:read housekeeping.conditions:initialize housekeeping.discrepancies:read housekeeping.discrepancies:report housekeeping.sheets:generate housekeeping.sheets:read housekeeping.tasks:inspect housekeeping.tasks:read housekeeping.tasks:work inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.offline_leases:read inventory.offline_leases:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write reservations.booking:write reservations.guests:read reservations.guests:write reservations.lifecycle:read reservations.lifecycle:write reservations.segments:read reservations.segments:write stay-operations.checkin:commit stay-operations.checkin:dirty-room-override stay-operations.checkin:read stay-operations.checkout:commit stay-operations.checkout:read stay-operations.pickup-tasks:dispatch stay-operations.pickup-tasks:work stay-operations.vehicles:read",
    });

    const headers = { "content-type": "application/json", authorization: `Bearer ${loginBody.accessToken}` };
    const properties = await app.handle(new Request("http://yellow.test/api/v1/me/properties", { headers }));
    expect(await properties.json()).toEqual({ properties: [
      {
        id: SEED_PROPERTY.id, name: SEED_PROPERTY.name,
        timezone: SEED_PROPERTY.timezone, currency: SEED_PROPERTY.currency,
      },
      {
        id: first.checkInExamples.identityGatePropertyId,
        name: "Yellow Identity Gate Review Property", timezone: "UTC", currency: "USD",
      },
    ] });

    const from = new Date(Date.now() + 30 * 86_400_000);
    from.setUTCHours(15, 0, 0, 0);
    const to = new Date(from.getTime() + 2 * 86_400_000);
    const availability = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
        method: "POST", headers,
        body: JSON.stringify({ from: from.toISOString(), to: to.toISOString(), partySize: 1 }),
      },
    ));
    expect(availability.status).toBe(200);
    const body = await availability.json() as { options: Array<{ sellableUnitName: string; bookable: boolean }> };
    expect(body.options.map(({ sellableUnitName }) => sellableUnitName)).toEqual([
      "Room 101", "Room 102", "Room 103", "Room 201", "Room 202", "Room 203",
    ]);
    expect(body.options.every(({ bookable }) => bookable)).toBe(true);
  });

  test("Order 078 P0/P1: canonical FLEX configuration is present exactly once", async () => {
    const { policies, plans } = await canonicalRateRows();
    expect(policies.map(({ kind, name, content }) => ({ kind, name, content }))).toEqual([
      {
        kind: "cancellation",
        name: "Flexible 48 hour cancellation",
        content: { kind: "cancellation", rules: [{ before_hours: 48, penalty: { basis: "nights", value: 1 } }] },
      },
      {
        kind: "deposit",
        name: "First night deposit",
        content: { kind: "deposit", deposit: { basis: "first_night", due: "at_booking" } },
      },
      {
        kind: "guarantee",
        name: "Card guarantee",
        content: { kind: "guarantee", guarantee: "card_on_file" },
      },
      {
        kind: "no_show",
        name: "First night no-show",
        content: { kind: "no_show", no_show_charge: { basis: "first_night", value: 1 } },
      },
    ]);
    expect(plans).toEqual([{
      id: expect.any(String),
      code: "FLEX",
      name: "Flexible public rate",
      currency: "USD",
      tax_inclusive: true,
      cancellation_policy: requirePolicyId(policies, "cancellation"),
      guarantee_policy: requirePolicyId(policies, "guarantee"),
      deposit_policy: requirePolicyId(policies, "deposit"),
      parent_plan: null,
      derivation: null,
      market_code: "LEISURE",
      source_code: "DIRECT",
      status: "active",
    }]);
    const facts = await admin<Array<{ actor_id: string; name: string; count: number }>>`
      SELECT actor_id, fact_type AS name, count(*)::int AS count
      FROM fact_log
      WHERE actor_id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)
        AND fact_type IN (
          'policy.created', 'rate_plan.created', 'rate_plan_model.drafted',
          'rate_plan_target.drafted', 'rate_plan_release.drafted',
          'rate_plan_release.approval_requested', 'rate_plan_release.approval_decided',
          'rate_plan_release.published'
        )
      GROUP BY actor_id, fact_type
      ORDER BY actor_id, fact_type COLLATE "C"
    `;
    const expectedFacts = [
      { actor_id: first.userId, name: "policy.created", count: 4 },
      { actor_id: first.userId, name: "rate_plan.created", count: 1 },
      { actor_id: first.userId, name: "rate_plan_model.drafted", count: 1 },
      { actor_id: first.userId, name: "rate_plan_release.approval_requested", count: 1 },
      { actor_id: first.userId, name: "rate_plan_release.drafted", count: 1 },
      { actor_id: first.userId, name: "rate_plan_target.drafted", count: 1 },
      { actor_id: first.approverUserId, name: "rate_plan_release.approval_decided", count: 1 },
      { actor_id: first.approverUserId, name: "rate_plan_release.published", count: 1 },
    ].sort(compareEvidenceRows);
    expect(facts).toEqual(expectedFacts);
    const events = await admin<Array<{ actor_id: string; name: string; count: number }>>`
      SELECT actor_id, event_type AS name, count(*)::int AS count
      FROM outbox
      WHERE actor_id IN (${first.userId}::uuid, ${first.approverUserId}::uuid)
        AND event_type IN ('policy.created', 'rate_plan.created', 'approval.requested',
                           'approval.decided', 'extension.activated')
      GROUP BY actor_id, event_type
      ORDER BY actor_id, event_type COLLATE "C"
    `;
    const expectedEvents = [
      { actor_id: first.userId, name: "policy.created", count: 4 },
      { actor_id: first.userId, name: "rate_plan.created", count: 1 },
      { actor_id: first.userId, name: "approval.requested", count: 1 },
      { actor_id: first.approverUserId, name: "approval.decided", count: 1 },
      { actor_id: first.approverUserId, name: "extension.activated", count: 1 },
    ].sort(compareEvidenceRows);
    expect(events).toEqual(expectedEvents);
  });

  test("Order 078 P2: one canonical active release has exact four-eyes approval", async () => {
    const { policies, plans } = await canonicalRateRows();
    const plan = plans[0];
    if (!plan) throw new Error("canonical FLEX plan is absent");
    const result = await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const release = await publication.getActiveRelease(tx, SEED_PROPERTY.id, plan.id);
      const model = (await models.listDraftVersions(tx, SEED_PROPERTY.id, plan.id))
        .find(({ id, extensionVersion }) => id === release.modelDraftId && extensionVersion === release.modelDraftVersion);
      const target = (await targets.listDraftVersions(tx, SEED_PROPERTY.id, plan.id))
        .find(({ id, extensionVersion }) => id === release.targetDraftId && extensionVersion === release.targetDraftVersion);
      const approvalPage = await publication.listPublicationApprovals(tx, {
        propertyNode: SEED_PROPERTY.id,
        ratePlanId: plan.id,
        limit: 10,
      });
      return { release, model, target, approvalPage };
    });
    expect(result.model).toMatchObject({
      modelKey: "simple-fixed", modelVersion: 1, authoringMode: "guided", componentModelKeys: [], status: "draft",
    });
    expect(result.target).toMatchObject({
      authoringMode: "guided",
      rules: [{ key: "property-default", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} }],
      status: "draft",
    });
    expect(result.release).toMatchObject({
      ratePlanId: plan.id,
      status: "active",
      evaluatorSpec: {
        modelKey: "simple-fixed",
        currency: "USD",
        base: { kind: "fixed", amountMinor: 12_500n },
        gate: { stayStart: "2020-01-01", stayEnd: "2100-01-01", dowMask: 127 },
        rules: [],
        floorMinor: null,
        ceilingMinor: null,
        eligibleTargetRuleKeys: [],
      },
      compositionSpec: {
        currency: "USD",
        guestEligibility: {
          minAdults: 1, maxAdults: 4, minChildren: 0, maxChildren: 3,
          minTotalGuests: 1, maxTotalGuests: 7,
        },
        package: null,
        promotions: [],
        policy: {
          cancellationPolicyId: requirePolicyId(policies, "cancellation"),
          depositPolicyId: requirePolicyId(policies, "deposit"),
          guaranteePolicyId: requirePolicyId(policies, "guarantee"),
          noShowPolicyId: requirePolicyId(policies, "no_show"),
          refundTreatment: "policy",
        },
        distribution: { mode: "all", channelCodes: [] },
      },
      rmsBinding: null,
      undoOfVersion: null,
    });
    expect(result.approvalPage.nextCursor).toBeNull();
    expect(result.approvalPage.approvals).toEqual([expect.objectContaining({
      releaseId: result.release.id,
      releaseVersion: result.release.extensionVersion,
      releaseStatus: "active",
      status: "approved",
      requestedBy: { id: first.userId, displayName: "Yellow Review Operator" },
      decidedBy: { id: first.approverUserId, displayName: "Yellow Rate Approver" },
    })]);
  });

  test("Order 078 P3: divergent active review rate fails without attempted repair", async () => {
    const rows = await admin<Array<{
      id: string;
      content: {
        evaluator: { base: { amountMinor: { $minor: string } } };
      };
    }>>`
      SELECT id, content
      FROM extension
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND type = 'rate_plan_release' AND status = 'active'
    `;
    const active = rows[0];
    if (!active || rows.length !== 1) throw new Error("canonical active release is absent");
    const original = structuredClone(active.content);
    const divergent = structuredClone(active.content);
    divergent.evaluator.base.amountMinor.$minor = "12501";
    await admin`UPDATE extension SET content = ${JSON.stringify(divergent)}::text::jsonb WHERE id = ${active.id}::uuid`;
    try {
      const before = await rateSnapshot();
      await expect(runReviewSeed({ databaseUrl: DEPLOY_DATABASE_URL!, password: PASSWORD!,
        approverPassword: APPROVER_PASSWORD!, logger: () => undefined }))
        .rejects.toThrow("active FLEX release collides with non-canonical local-review data");
      expect(await rateSnapshot()).toEqual(before);
    } finally {
      await admin`UPDATE extension SET content = ${JSON.stringify(original)}::text::jsonb WHERE id = ${active.id}::uuid`;
    }
  });

  test("Order 078 P4: real two-night quote is exact, bookable, no-tax and read-only", async () => {
    const { plans } = await canonicalRateRows();
    const plan = plans[0];
    if (!plan) throw new Error("canonical FLEX plan is absent");
    const sellables = await admin<Array<{ id: string }>>`
      SELECT sellable.id
      FROM sellable_unit AS sellable
      JOIN unit_type AS unit_type ON unit_type.id = sellable.unit_type_id
      WHERE sellable.tenant_id = ${SEED_TENANT.id}::uuid
        AND unit_type.attrs @> '{"source":"local-review"}'
      ORDER BY sellable.name, sellable.id
      LIMIT 1
    `;
    const sellable = sellables[0];
    if (!sellable) throw new Error("local-review sellable is absent");
    const stayStart = new Date(Date.now() + 30 * 86_400_000);
    stayStart.setUTCHours(15, 0, 0, 0);
    const stayEnd = new Date(stayStart.getTime() + 2 * 86_400_000);
    const before = await rateSnapshot();
    const resolved = await database.withTenantTransaction(SEED_TENANT.id, (tx) => quote.resolve(tx, {
      propertyNode: SEED_PROPERTY.id,
      ratePlanId: plan.id,
      sellableUnitId: sellable.id,
      stayStart,
      stayEnd,
      guests: { adults: 1, childAges: [] },
      selectedPromotionCodes: [],
      commercial: {},
      channelCode: "direct",
    }));
    expect(resolved).toMatchObject({
      propertyNode: SEED_PROPERTY.id,
      ratePlanId: plan.id,
      sellableUnitId: sellable.id,
      taxAssignmentState: "none",
      result: {
        state: "quoted",
        roomAmountMinor: 25_000n,
        packageExtraMinor: 0n,
        promotionDiscountMinor: 0n,
        preTaxSubtotalMinor: 25_000n,
        availabilityEvidence: { bookable: true },
      },
    });
    expect(resolved.result.rateEvaluations.map(({ evaluationResult }) => evaluationResult.amountMinor))
      .toEqual([12_500n, 12_500n]);
    expect(resolved.result.policyEvidence.map(({ kind }) => kind))
      .toEqual(["cancellation", "deposit", "guarantee", "no_show"]);
    expect(resolved.taxAssignments.every(({ jurisdictionKey, evidenceRef }) =>
      jurisdictionKey === null && evidenceRef === null
    )).toBe(true);
    expect(await rateSnapshot()).toEqual(before);
  });
});
