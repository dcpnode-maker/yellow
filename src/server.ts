import { SQL } from "bun";

import { app, createApp } from "./app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginGuard, LocalLoginService } from "./contexts/identity";
import { PartyProfileService } from "./contexts/crm";
import { ChargeService, FolioStatementService } from "./contexts/financials";
import { AvailabilityProjectionConsumer, AvailabilityProjectionService, AvailabilityService, HoldExpiryWorker, HoldService, InventoryPolicyService, InventoryService, OperationalBlockService, ReservationOccupancyService, RestrictionService } from "./contexts/inventory";
import { ReservationCommitService, ReservationGuestService, ReservationLifecycleService, ReservationOfferSearchService, ReservationSegmentService } from "./contexts/reservations";
import {
  createRateIntentProposalAdapterFromEnvironment,
  RateConfigurationService,
  RateIntentService,
  RateModelService,
  RatePricingService,
  RatePublicationService,
  RateQuoteService,
  RateTargetService,
} from "./contexts/rates";
import { OperatorHttpApi } from "./http/operator";
import { ApprovalService, Database, ExtensionRegistry, PostgresEventBus, PostgresIdempotency } from "./kernel";
import type { OperatorRuntimeStatus } from "./project-status";
import { PostgresDueHoldScopeSource } from "./workers/postgres-due-hold-scopes";

const port = Bun.env.PORT === undefined ? 3000 : Number(Bun.env.PORT);
const workbenchEnabled = Bun.env.YELLOW_OPERATOR_WORKBENCH === "1";
const holdExpiryEnabled = workbenchEnabled && Bun.env.YELLOW_HOLD_EXPIRY_WORKER === "1";
const projectionWorkerEnabled = workbenchEnabled && Bun.env.YELLOW_AVAILABILITY_PROJECTION_WORKER === "1";
const maxRequestBodySize = 16 * 1024;
const processStartedAt = new Date().toISOString();

function runtimeHostname(): string {
  const requested = Bun.env.HOST;
  if (!workbenchEnabled) return requested ?? "0.0.0.0";
  if (!requested || requested === "127.0.0.1" || requested === "localhost" || requested === "::1") {
    return requested ?? "127.0.0.1";
  }
  if (Bun.env.YELLOW_OPERATOR_ALLOW_NON_LOOPBACK === "1") return requested;
  throw new Error("non-loopback operator binding requires YELLOW_OPERATOR_ALLOW_NON_LOOPBACK=1");
}

function required(name: "YELLOW_RUNTIME_DATABASE_URL" | "YELLOW_TOKEN_SECRET"): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`${name} is required when YELLOW_OPERATOR_WORKBENCH=1`);
  return value;
}

function runtimeApp() {
  if (!workbenchEnabled) return app;
  const databaseUrl = required("YELLOW_RUNTIME_DATABASE_URL");
  const tokens = new Hs256TokenSigner(required("YELLOW_TOKEN_SECRET"));
  const database = Database.connect(databaseUrl, { maxConnections: 12, prepare: false });
  const loginPool = new SQL(databaseUrl, { max: 4 });
  const eventPool = new SQL(databaseUrl, { max: 4 });
  const extensionPool = new SQL(databaseUrl, { max: 4 });
  const login = new LocalLoginService(loginPool, tokens, new LocalLoginGuard());
  const events = new PostgresEventBus(eventPool);
  const registry = new ExtensionRegistry(extensionPool);
  const approvals = new ApprovalService(events);
  const inventory = new InventoryService(events);
  const restrictions = new RestrictionService(events);
  const rates = new RateConfigurationService(events);
  const pricing = new RatePricingService(events);
  const blocks = new OperationalBlockService(events);
  const policy = new InventoryPolicyService(events);
  const holds = new HoldService(events);
  const reservationOccupancy = new ReservationOccupancyService(events);
  const reservations = new ReservationCommitService({
    holds,
    occupancy: reservationOccupancy,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const reservationGuests = new ReservationGuestService({ events, idempotency: new PostgresIdempotency() });
  const reservationLifecycle = new ReservationLifecycleService({
    events, idempotency: new PostgresIdempotency(), occupancy: reservationOccupancy,
  });
  const reservationSegments = new ReservationSegmentService({
    events, idempotency: new PostgresIdempotency(), occupancy: reservationOccupancy,
  });
  const parties = new PartyProfileService({ events, idempotency: new PostgresIdempotency() });
  const folioStatements = new FolioStatementService();
  const charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  const projection = new AvailabilityProjectionService();
  const availability = new AvailabilityService();
  const publication = new RatePublicationService(registry, approvals, events);
  const rateBuilder = {
    models: new RateModelService(registry),
    targets: new RateTargetService(registry),
    publication,
    quote: new RateQuoteService(publication, availability, projection),
    intent: new RateIntentService(createRateIntentProposalAdapterFromEnvironment(Bun.env)),
  };
  const reservationOffers = new ReservationOfferSearchService(rates, rateBuilder.quote, availability);
  const runtimeStatus: OperatorRuntimeStatus = {
    workbenchEnabled,
    holdExpiryWorkerEnabled: holdExpiryEnabled,
    availabilityProjectionWorkerEnabled: projectionWorkerEnabled,
    processStartedAt,
  };
  if (projectionWorkerEnabled) {
    const projectionConsumer = new AvailabilityProjectionConsumer(events, projection);
    projectionConsumer.run({ onError() { console.error("availability projection consumer failed"); } })
      .catch(() => console.error("availability projection consumer stopped unexpectedly"));
  }
  if (holdExpiryEnabled) {
    const discoveryPool = new SQL(databaseUrl, { max: 2 });
    const expiry = new HoldExpiryWorker(database, holds, new PostgresDueHoldScopeSource(discoveryPool));
    expiry.run({
      onError() { console.error("hold expiry worker discovery failed"); },
      onResult(result) {
        if (result.failures.length > 0) {
          console.error(`hold expiry worker failed for ${result.failures.length} scope(s)`);
        }
      },
    }).catch(() => console.error("hold expiry worker stopped unexpectedly"));
  }
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(login, availability, inventory, new PostgresIdempotency(), restrictions, rates, pricing, blocks, policy, holds, projection, runtimeStatus, rateBuilder, reservations, reservationOffers, reservationGuests, reservationLifecycle, reservationSegments, parties, folioStatements, charges),
  });
}

runtimeApp().listen({ hostname: runtimeHostname(), port, maxRequestBodySize });
