import { SQL } from "bun";

import { app, createApp } from "./app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginGuard, LocalLoginService } from "./contexts/identity";
import { PartyProfileService } from "./contexts/crm";
import { CashierService, ChargeCorrectionService, ChargeService, FolioService, FolioSettlementService, FolioStatementService, FolioTransferService, HostedDepositService, LocalPaymentProvider, PaymentService, ReceivableService } from "./contexts/financials";
import { AvailabilityProjectionConsumer, AvailabilityProjectionService, AvailabilityService, HoldExpiryWorker, HoldService, InventoryPolicyService, InventoryService, OperationalBlockService, ReservationOccupancyService, RestrictionService } from "./contexts/inventory";
import { ReservationBoardService, ReservationCommitService, ReservationDetailService, ReservationGuestService, ReservationLifecycleService, ReservationOfferSearchService, ReservationSegmentService, ReservationTravelService } from "./contexts/reservations";
import { CheckInService, CheckoutReadinessService, CheckoutService, VehicleRegisterService } from "./contexts/stay-operations";
import { HousekeepingSheetService, HousekeepingTaskService } from "./contexts/housekeeping";
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
import { OperatorHttpApi, type OperatorLocalReviewCredentials } from "./http/operator";
import { HostedDepositProviderHttpApi } from "./http/provider";
import { ApprovalService, Database, ExtensionRegistry, PostgresEventBus, PostgresIdempotency } from "./kernel";
import type { OperatorRuntimeStatus } from "./project-status";
import { PostgresDueHoldScopeSource } from "./workers/postgres-due-hold-scopes";

const port = Bun.env.PORT === undefined ? 3000 : Number(Bun.env.PORT);
const workbenchEnabled = Bun.env.YELLOW_OPERATOR_WORKBENCH === "1";
const hostedDepositEnabled = Bun.env.YELLOW_HOSTED_DEPOSIT_WORKBENCH === "1";
const hostedProviderOnly = Bun.env.YELLOW_HOSTED_PROVIDER_ONLY === "1";
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

function localReviewCredentials(): OperatorLocalReviewCredentials | undefined {
  if (Bun.env.YELLOW_LOCAL_REVIEW_PREFILL !== "1") return undefined;
  if (!workbenchEnabled || hostedProviderOnly) {
    throw new Error("local review prefill requires the operator workbench");
  }
  const credentials = {
    tenant: Bun.env.YELLOW_LOCAL_REVIEW_TENANT ?? "",
    email: Bun.env.YELLOW_LOCAL_REVIEW_EMAIL ?? "",
    password: Bun.env.YELLOW_LOCAL_REVIEW_PASSWORD ?? "",
  };
  if (Object.values(credentials).some((value) => value.length === 0)) {
    throw new Error("local review prefill requires tenant, email and password");
  }
  return credentials;
}

function required(name: "YELLOW_RUNTIME_DATABASE_URL" | "YELLOW_EXTENSION_REGISTRAR_DATABASE_URL" | "YELLOW_TOKEN_SECRET" |
  "YELLOW_HOSTED_DEPOSIT_CALLBACK_SECRET"): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`${name} is required when YELLOW_OPERATOR_WORKBENCH=1`);
  return value;
}

function registrarDatabaseUrl(): string {
  const value = required("YELLOW_EXTENSION_REGISTRAR_DATABASE_URL");
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("YELLOW_EXTENSION_REGISTRAR_DATABASE_URL must be a valid URL"); }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)
      || decodeURIComponent(parsed.username) !== "yellow_extension_registrar"
      || parsed.password === "" || parsed.hash !== "") {
    throw new Error("YELLOW_EXTENSION_REGISTRAR_DATABASE_URL must authenticate the exact registrar role");
  }
  return value;
}

function runtimeApp() {
  if (!workbenchEnabled && !hostedProviderOnly) return app;
  if (hostedProviderOnly) {
    const routes = new HostedDepositProviderHttpApi({
      callbackSecret: required("YELLOW_HOSTED_DEPOSIT_CALLBACK_SECRET"),
      providerOrigin: Bun.env.YELLOW_HOSTED_PROVIDER_ORIGIN ?? "http://127.0.0.1:3001",
      guestOrigin: Bun.env.YELLOW_HOSTED_GUEST_ORIGIN ?? "http://127.0.0.1:3000",
      callbackOrigin: Bun.env.YELLOW_HOSTED_CALLBACK_ORIGIN,
    });
    return createApp({ hostedDepositRoutes: routes, hostedDepositSurface: "provider" });
  }
  const databaseUrl = required("YELLOW_RUNTIME_DATABASE_URL");
  const database = Database.connect(databaseUrl, { maxConnections: 12, prepare: false });
  const eventPool = new SQL(databaseUrl, { max: 4, prepare: false });
  const events = new PostgresEventBus(eventPool);
  const hostedRuntime = hostedDepositEnabled ? (() => {
    const paymentProvider = new LocalPaymentProvider({ decide: (request) =>
      request.phase === "capture" ? "indeterminate" : "approved" });
    const payments = new PaymentService({ database, events, provider: paymentProvider });
    const hostedDeposits = new HostedDepositService({ database, payments, events });
    const routes = new HostedDepositProviderHttpApi({
      hostedDeposits,
      payments,
      callbackSecret: required("YELLOW_HOSTED_DEPOSIT_CALLBACK_SECRET"),
      providerOrigin: Bun.env.YELLOW_HOSTED_PROVIDER_ORIGIN ?? "http://127.0.0.1:3001",
      guestOrigin: Bun.env.YELLOW_HOSTED_GUEST_ORIGIN ?? "http://127.0.0.1:3000",
      callbackOrigin: Bun.env.YELLOW_HOSTED_CALLBACK_ORIGIN,
    });
    return { hostedDeposits, routes };
  })() : undefined;
  const registrarUrl = registrarDatabaseUrl();
  const tokens = new Hs256TokenSigner(required("YELLOW_TOKEN_SECRET"));
  const loginPool = new SQL(databaseUrl, { max: 4 });
  const extensionPool = new SQL(databaseUrl, { max: 4, prepare: false });
  const registrarPool = new SQL(registrarUrl, { max: 2, prepare: false });
  const login = new LocalLoginService(loginPool, tokens, new LocalLoginGuard());
  const registry = new ExtensionRegistry(extensionPool, registrarPool);
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
  const reservationTravel = new ReservationTravelService({ events, idempotency: new PostgresIdempotency() });
  const parties = new PartyProfileService({ events, idempotency: new PostgresIdempotency() });
  const folioStatements = new FolioStatementService();
  const charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  const chargeCorrections = new ChargeCorrectionService({ events, idempotency: new PostgresIdempotency() });
  const folios = new FolioService({ events, idempotency: new PostgresIdempotency() });
  const folioTransfers = new FolioTransferService({ events, idempotency: new PostgresIdempotency(), folios });
  const folioSettlements = new FolioSettlementService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const cashiers = new CashierService({ database, events, idempotency: new PostgresIdempotency(), approvals });
  const receivables = new ReceivableService({ database, events, idempotency: new PostgresIdempotency(), approvals });
  const checkIns = new CheckInService({ database, events, idempotency: new PostgresIdempotency() });
  const checkoutReadiness = new CheckoutReadinessService({ database });
  const checkouts = new CheckoutService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
    occupancy: reservationOccupancy,
  });
  const vehicleRegister = new VehicleRegisterService({ database });
  const housekeeping = new HousekeepingTaskService({ database, events, idempotency: new PostgresIdempotency() });
  const housekeepingSheets = new HousekeepingSheetService({ database, events, idempotency: new PostgresIdempotency() });
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
    operatorApi: new OperatorHttpApi(login, availability, inventory, new PostgresIdempotency(), restrictions, rates, pricing, blocks, policy, holds, projection, runtimeStatus, rateBuilder, reservations, reservationOffers, reservationGuests, reservationLifecycle, reservationSegments, parties, folioStatements, charges, new ReservationBoardService(), new ReservationDetailService(), folios, chargeCorrections, folioTransfers, hostedRuntime?.hostedDeposits, folioSettlements, cashiers, receivables, checkIns, housekeeping, housekeepingSheets, checkoutReadiness, checkouts, vehicleRegister, reservationTravel),
    operatorLocalReviewCredentials: localReviewCredentials(),
    ...(hostedRuntime ? { hostedDepositRoutes: hostedRuntime.routes, hostedDepositSurface: "guest" as const } : {}),
  });
}

runtimeApp().listen({ hostname: runtimeHostname(), port, maxRequestBodySize });
