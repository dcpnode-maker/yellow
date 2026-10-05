import { SQL } from "bun";

import { PartyDuplicateReviewRequiredError, PartyProfileService } from "../src/contexts/crm";
import { AvailabilityService, HoldService, ReservationOccupancyService } from "../src/contexts/inventory";
import { ReservationCommitService } from "../src/contexts/reservations";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type Tx,
} from "../src/kernel";
import { uuidV5 } from "./lib/uuid-v5";
import { SEED_TENANT, TENANT_NAME, URL_NAMESPACE_UUID } from "./seed";
import { REVIEW_EMAIL } from "./seed-review";

const PROPERTY_NAME = "Riverstone Test Hotel";
const RATE_PLAN_CODE = "AP_FLEX";
const SHOWCASE_VERSION = "public-demo-showcase-v1";

const GUESTS = Object.freeze([
  "Aarav Mehta", "Aisha Khan", "Neel Shah", "Riya Iyer", "Kabir Malhotra", "Anaya Rao",
  "Vikram Sethi", "Meera Nair", "Arjun Kapoor", "Diya Menon", "Rohan Desai", "Tara Bhat",
  "Ishaan Verma", "Naina Kulkarni", "Dev Patel", "Sana Qureshi", "Aditya Joshi", "Kavya Singh",
]);

const CHANNELS = Object.freeze(["direct_web", "booking_com", "expedia", "airbnb", "agoda", "corporate"]);

function localDate(timeZone: string, offsetDays: number): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offsetDays));
  return day.toISOString().slice(0, 10);
}

function zonedInstant(date: string, hour: number, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const wanted = Date.UTC(year, month - 1, day, hour);
  let guess = wanted;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  for (let pass = 0; pass < 3; pass += 1) {
    const rendered = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value]));
    const actual = Date.UTC(Number(rendered.year), Number(rendered.month) - 1, Number(rendered.day), Number(rendered.hour) % 24, Number(rendered.minute), Number(rendered.second));
    guess += wanted - actual;
  }
  return new Date(guess);
}

async function id(name: string): Promise<string> {
  return uuidV5(URL_NAMESPACE_UUID, `${TENANT_NAME}/${SHOWCASE_VERSION}/${name}`);
}

async function getOrCreateParty(tx: Tx, parties: PartyProfileService, actorId: string, propertyId: string, index: number): Promise<string> {
  const displayName = `RIV Demo · ${GUESTS[index]!}`;
  const email = `guest.${String(index + 1).padStart(2, "0")}@demo.yellow.invalid`;
  const existing = await tx<Array<{ id: string }>>`
    SELECT p.id FROM party p JOIN contact_point cp ON cp.tenant_id=p.tenant_id AND cp.party_id=p.id
    WHERE p.tenant_id=${SEED_TENANT.id}::uuid AND cp.kind='email' AND cp.value=${email}
  `;
  if (existing.length === 1 && existing[0]) return existing[0].id;
  if (existing.length !== 0) throw new Error(`showcase party ${email} is ambiguous`);
  let created;
  try {
    created = await parties.create(tx, {
    kind: "person", displayName, legalName: null, roles: ["guest"],
    contacts: [{ kind: "email", value: email, isPrimary: true }],
    acknowledgedDuplicatePartyIds: [],
    idempotencyKey: `${SHOWCASE_VERSION}:party:${index}`,
    envelope: createAuditEnvelope({ actorId, tenantId: SEED_TENANT.id, propertyNode: propertyId, requestId: await id(`party-${index}`), operation: "party.created" }),
    });
  } catch (error) {
    if (error instanceof PartyDuplicateReviewRequiredError) {
      throw new Error(`showcase party ${index} collided with ${JSON.stringify(error.candidates.map(({ partyId, reasons }) => ({ partyId, reasons })) )}`);
    }
    throw error;
  }
  return created.party.partyId;
}

export async function seedDemoShowcaseStays(databaseUrl: string): Promise<void> {
  const pool = new SQL(databaseUrl, { max: 1, prepare: false });
  const events = new PostgresEventBus(pool);
  const database = Database.connect(databaseUrl, { maxConnections: 1, prepare: false });
  try {
    await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const propertyRows = await tx<Array<{ id: string; timezone: string }>>`
        SELECT id, timezone FROM org_node WHERE tenant_id=${SEED_TENANT.id}::uuid AND kind='property' AND name=${PROPERTY_NAME}
      `;
      const property = propertyRows[0];
      if (!property || propertyRows.length !== 1) throw new Error(`${PROPERTY_NAME} is unavailable or ambiguous`);
      const users = await tx<Array<{ id: string }>>`
        SELECT id FROM app_user WHERE tenant_id=${SEED_TENANT.id}::uuid AND email=${REVIEW_EMAIL} AND status='active'
      `;
      const actor = users[0];
      if (!actor || users.length !== 1) throw new Error("demo review operator is unavailable or ambiguous");
      const plans = await tx<Array<{ id: string }>>`
        SELECT id FROM rate_plan WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${property.id}::uuid AND code=${RATE_PLAN_CODE} AND status='active'
      `;
      const plan = plans[0];
      if (!plan || plans.length !== 1) throw new Error(`${RATE_PLAN_CODE} is unavailable or ambiguous`);

      const parties = new PartyProfileService({ events, idempotency: new PostgresIdempotency() });
      const availability = new AvailabilityService();
      let created = 0;
      for (let index = 0; index < GUESTS.length; index += 1) {
        const partyId = await getOrCreateParty(tx, parties, actor.id, property.id, index);
        const arrivalOffset = index < 6 ? 0 : index < 12 ? -1 : 1 + ((index - 12) % 3);
        const nights = 1 + (index % 4);
        const arrival = localDate(property.timezone, arrivalOffset);
        const departure = localDate(property.timezone, arrivalOffset + nights);
        const from = zonedInstant(arrival, 15, property.timezone);
        const to = zonedInstant(departure, 11, property.timezone);
        const reservationKey = await id(`reservation-${arrival}-${index}`);
        const existing = await tx<Array<{ id: string }>>`
          SELECT id FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND id=${reservationKey}::uuid
        `;
        if (existing.length === 1) continue;
        if (existing.length !== 0) throw new Error(`showcase reservation ${index} is ambiguous`);
        const options = await availability.search(tx, { propertyNode: property.id, from, to, partySize: index % 5 === 0 ? 3 : 2, channelCode: CHANNELS[index % CHANNELS.length] });
        const choice = options.find(({ bookable }) => bookable);
        if (!choice) continue;
        const ids = [reservationKey, await id(`segment-${arrival}-${index}`)];
        const commits = new ReservationCommitService({
          holds: new HoldService(events), occupancy: new ReservationOccupancyService(events), events,
          idempotency: new PostgresIdempotency(), idFactory: () => ids.shift() ?? crypto.randomUUID(),
        });
        const result = await commits.commitDirect(tx, {
          primaryPartyId: partyId, ratePlanId: plan.id, adults: index % 5 === 0 ? 3 : 2, childAges: index % 4 === 0 ? [7] : [],
          channelCode: CHANNELS[index % CHANNELS.length]!, sellableUnitId: choice.sellableUnitId, from, to,
          idempotencyKey: `${SHOWCASE_VERSION}:reservation:${arrival}:${index}`,
          envelope: createAuditEnvelope({ actorId: actor.id, tenantId: SEED_TENANT.id, propertyNode: property.id, requestId: await id(`reservation-command-${arrival}-${index}`), operation: "reservation.confirmed" }),
        });
        if (result.reservationId !== reservationKey) throw new Error(`showcase reservation ${index} identity drifted`);
        created += 1;
      }
      console.log(`demo showcase stays: ${created} created`);
    });
  } finally {
    await database.close();
    await pool.close({ timeout: 0 });
  }
}

if (import.meta.main || process.env.YELLOW_RUN_DEMO_SHOWCASE_STAYS === "1") {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_DEPLOY_DATABASE_URL or DATABASE_URL is required");
  await seedDemoShowcaseStays(databaseUrl);
}
