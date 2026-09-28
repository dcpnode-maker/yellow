import { SQL } from "bun";

import { createApp } from "./app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginGuard, LocalLoginService } from "./contexts/identity";
import { PartyProfileService } from "./contexts/crm";
import { BusinessDayDiscrepancyCarryOperatorService, BusinessDayRollService, BusinessDayRollWorker, BusinessDaySealService, CashierService, ChargeCorrectionService, ChargeService, FolioService, FolioSettlementService, FolioStatementService, FolioTransferService, HostedDepositService, LocalPaymentProvider, OwnerTrustExpenseWorkbenchService, PaymentService, ReceivableService } from "./contexts/financials";
import { AvailabilityProjectionConsumer, AvailabilityProjectionService, AvailabilityService, HoldExpiryWorker, HoldService, InventoryPolicyService, InventoryService, OperationalBlockService, ReservationOccupancyService, RestrictionService } from "./contexts/inventory";
import { ReservationArrivalRollService, ReservationArrivalRollWorker, ReservationBoardService, ReservationCommitService, ReservationDepartureRollService, ReservationDepartureRollWorker, ReservationDetailService, ReservationGuestService, ReservationLifecycleService, ReservationOfferSearchService, ReservationSegmentService, ReservationTravelService } from "./contexts/reservations";
import { ArrivalPickupTaskAutomationConsumer, ArrivalPickupTaskDispatchService, CheckInService, CheckoutReadinessService, CheckoutService, VehicleParkingAssignmentService, VehicleRegisterService } from "./contexts/stay-operations";
import { ArrivalRoomCleaningTaskService, HousekeepingDiscrepancyService, HousekeepingSheetService, HousekeepingTaskService } from "./contexts/housekeeping";
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
import {
  FiscalSubmissionAdapterAvailabilityService,
  FiscalSubmissionDeliveryRuntime,
  FiscalSubmissionRepository,
  FiscalSubmissionService,
  FiscalSubmissionWorker,
  loadIndiaIrpAdapterRegistrationsFromEnvironment,
  TaxJurisdictionResolutionService,
  VerifiedIndiaIrpAdapterRegistry,
} from "./contexts/tax-fiscal";
import { OperatorHttpApi, type OperatorLocalReviewCredentials } from "./http/operator";
import { HostedDepositProviderHttpApi } from "./http/provider";
import {
  ApprovalService,
  assertRuntimeReleaseReadiness,
  buildInfoFromEnvironment,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  PostgresIdempotency,
} from "./kernel";
import type { OperatorRuntimeStatus } from "./project-status";
import { ServerLifecycle, installServerLifecycleSignals } from "./runtime/server-lifecycle";
import { PostgresDueArrivalScopeSource } from "./workers/postgres-due-arrival-scopes";
import { PostgresDueDepartureScopeSource } from "./workers/postgres-due-departure-scopes";
import { PostgresDueHoldScopeSource } from "./workers/postgres-due-hold-scopes";
import { PostgresDueBusinessDayScopeSource } from "./workers/postgres-due-business-day-scopes";
import { PostgresDueFiscalSubmissionSource } from "./workers/postgres-due-fiscal-submissions";

const port = Bun.env.PORT === undefined ? 3000 : Number(Bun.env.PORT);
const workbenchEnabled = Bun.env.YELLOW_OPERATOR_WORKBENCH === "1";
const hostedDepositEnabled = Bun.env.YELLOW_HOSTED_DEPOSIT_WORKBENCH === "1";
const hostedProviderOnly = Bun.env.YELLOW_HOSTED_PROVIDER_ONLY === "1";
const holdExpiryEnabled = workbenchEnabled && Bun.env.YELLOW_HOLD_EXPIRY_WORKER === "1";
const projectionWorkerEnabled = workbenchEnabled && Bun.env.YELLOW_AVAILABILITY_PROJECTION_WORKER === "1";
const pickupTaskWorkerEnabled = workbenchEnabled && Bun.env.YELLOW_PICKUP_TASK_WORKER === "1";
const reservationArrivalRollEnabled = workbenchEnabled && Bun.env.YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER === "1";
const reservationDepartureRollEnabled = workbenchEnabled && Bun.env.YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER === "1";
const businessDayRollEnabled = workbenchEnabled && Bun.env.YELLOW_BUSINESS_DAY_ROLL_WORKER === "1";
const fiscalSubmissionDeliveryEnabled = workbenchEnabled && Bun.env.YELLOW_FISCAL_SUBMISSION_WORKER === "1";
// Construct one protected, immutable provider snapshot before database pools or
// intake exist. A configured adapter is not permission to enable its worker.
const providerConfiguration = await loadIndiaIrpAdapterRegistrationsFromEnvironment(Bun.env);
if (!providerConfiguration.ok) {
  throw new Error("India IRP provider deployment configuration is invalid");
}
const verifiedIndiaIrpAdapterRegistrations = providerConfiguration.value;
if (fiscalSubmissionDeliveryEnabled && verifiedIndiaIrpAdapterRegistrations.length === 0) {
  throw new Error("enabled fiscal submission worker requires a verified provider adapter");
}
const maxRequestBodySize = 16 * 1024;
const processStartedAt = new Date().toISOString();
const buildInfo = buildInfoFromEnvironment(Bun.env);
const runtimeAbort = new AbortController();
const runtimeWorkerTasks: Promise<void>[] = [];
const runtimeResourceClosers: Array<() => void | Promise<void>> = [];

function superviseWorker(promise: Promise<void>, failureMessage: string): void {
  runtimeWorkerTasks.push(promise.catch(() => { console.error(failureMessage); }));
}

function ownSqlPool(pool: SQL): SQL {
  runtimeResourceClosers.push(() => pool.close({ timeout: 0 }));
  return pool;
}

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
  if (!workbenchEnabled && !hostedProviderOnly) return createApp({ buildInfo });
  if (hostedProviderOnly) {
    const routes = new HostedDepositProviderHttpApi({
      callbackSecret: required("YELLOW_HOSTED_DEPOSIT_CALLBACK_SECRET"),
      providerOrigin: Bun.env.YELLOW_HOSTED_PROVIDER_ORIGIN ?? "http://127.0.0.1:3001",
      guestOrigin: Bun.env.YELLOW_HOSTED_GUEST_ORIGIN ?? "http://127.0.0.1:3000",
      callbackOrigin: Bun.env.YELLOW_HOSTED_CALLBACK_ORIGIN,
    });
    return createApp({
      buildInfo,
      readinessProbe: async () => undefined,
      readinessTarget: "synthetic_provider",
      hostedDepositRoutes: routes,
      hostedDepositSurface: "provider",
    });
  }
  const databaseUrl = required("YELLOW_RUNTIME_DATABASE_URL");
  const database = Database.connect(databaseUrl, { maxConnections: 12, prepare: false });
  runtimeResourceClosers.push(() => database.close());
  const eventPool = ownSqlPool(new SQL(databaseUrl, { max: 4, prepare: false }));
  const readinessPool = ownSqlPool(new SQL(databaseUrl, { max: 1, prepare: false }));
  let fiscalDeliveryRuntime: FiscalSubmissionDeliveryRuntime | undefined;
  const readinessProbe = async (): Promise<void> => {
    await assertRuntimeReleaseReadiness(readinessPool);
    if (fiscalSubmissionDeliveryEnabled && fiscalDeliveryRuntime?.state !== "running") {
      throw new Error("fiscal submission delivery runtime is unavailable");
    }
  };
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
  const loginPool = ownSqlPool(new SQL(databaseUrl, { max: 4 }));
  const extensionPool = ownSqlPool(new SQL(databaseUrl, { max: 4, prepare: false }));
  const registrarPool = ownSqlPool(new SQL(registrarUrl, { max: 2, prepare: false }));
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
  const reservationArrivalRolls = new ReservationArrivalRollService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const reservationDepartureRolls = new ReservationDepartureRollService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const businessDayRolls = new BusinessDayRollService({ database, events });
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
  const businessDayCarry = new BusinessDayDiscrepancyCarryOperatorService({ events, idempotency: new PostgresIdempotency() });
  const businessDaySeal = new BusinessDaySealService({ events, idempotency: new PostgresIdempotency() });
  const ownerTrustExpenses = new OwnerTrustExpenseWorkbenchService({ events, idempotency: new PostgresIdempotency() });
  const checkIns = new CheckInService({ database, events, idempotency: new PostgresIdempotency() });
  const checkoutReadiness = new CheckoutReadinessService({ database });
  const checkouts = new CheckoutService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
    occupancy: reservationOccupancy,
  });
  const vehicleRegister = new VehicleRegisterService({ database });
  const vehicleParking = new VehicleParkingAssignmentService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const pickupTaskDispatch = new ArrivalPickupTaskDispatchService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const housekeeping = new HousekeepingTaskService({ database, events, idempotency: new PostgresIdempotency() });
  const housekeepingSheets = new HousekeepingSheetService({ database, events, idempotency: new PostgresIdempotency() });
  const arrivalRoomCleaning = new ArrivalRoomCleaningTaskService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const housekeepingDiscrepancies = new HousekeepingDiscrepancyService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  const projection = new AvailabilityProjectionService();
  const availability = new AvailabilityService();
  const publication = new RatePublicationService(registry, approvals, events);
  const taxJurisdictionResolver = new TaxJurisdictionResolutionService(registry);
  const fiscalSubmissions = new FiscalSubmissionService();
  const fiscalAdapterRegistry = new VerifiedIndiaIrpAdapterRegistry(verifiedIndiaIrpAdapterRegistrations);
  const fiscalSubmissionAdapters = new FiscalSubmissionAdapterAvailabilityService(fiscalAdapterRegistry.identities());
  const rateBuilder = {
    models: new RateModelService(registry),
    targets: new RateTargetService(registry),
    publication,
    quote: new RateQuoteService(publication, taxJurisdictionResolver, availability, projection),
    intent: new RateIntentService(createRateIntentProposalAdapterFromEnvironment(Bun.env)),
  };
  const reservationOffers = new ReservationOfferSearchService(rates, rateBuilder.quote, availability);
  const runtimeStatus: OperatorRuntimeStatus = {
    build: buildInfo,
    workbenchEnabled,
    holdExpiryWorkerEnabled: holdExpiryEnabled,
    availabilityProjectionWorkerEnabled: projectionWorkerEnabled,
    pickupTaskWorkerEnabled,
    reservationArrivalRollWorkerEnabled: reservationArrivalRollEnabled,
    reservationDepartureRollWorkerEnabled: reservationDepartureRollEnabled,
    businessDayRollWorkerEnabled: businessDayRollEnabled,
    get fiscalSubmissionDeliveryWorkerState() {
      return fiscalDeliveryRuntime?.state ?? "disabled";
    },
    processStartedAt,
  };
  if (projectionWorkerEnabled) {
    const projectionConsumer = new AvailabilityProjectionConsumer(events, projection);
    superviseWorker(projectionConsumer.run({ signal: runtimeAbort.signal,
      onError() { console.error("availability projection consumer failed"); } }),
    "availability projection consumer stopped unexpectedly");
  }
  if (holdExpiryEnabled) {
    const discoveryPool = ownSqlPool(new SQL(databaseUrl, { max: 2 }));
    const expiry = new HoldExpiryWorker(database, holds, new PostgresDueHoldScopeSource(discoveryPool));
    superviseWorker(expiry.run({ signal: runtimeAbort.signal,
      onError() { console.error("hold expiry worker discovery failed"); },
      onResult(result) {
        if (result.failures.length > 0) {
          console.error(`hold expiry worker failed for ${result.failures.length} scope(s)`);
        }
      },
    }), "hold expiry worker stopped unexpectedly");
  }
  if (pickupTaskWorkerEnabled) {
    const pickupTasks = new ArrivalPickupTaskAutomationConsumer(events);
    superviseWorker(pickupTasks.run({ signal: runtimeAbort.signal,
      onError() { console.error("arrival pickup task consumer failed"); },
    }), "arrival pickup task consumer stopped unexpectedly");
  }
  if (reservationArrivalRollEnabled) {
    const discoveryPool = ownSqlPool(new SQL(databaseUrl, { max: 2, prepare: false }));
    const worker = new ReservationArrivalRollWorker(
      reservationArrivalRolls,
      new PostgresDueArrivalScopeSource(discoveryPool),
    );
    superviseWorker(worker.run({ signal: runtimeAbort.signal,
      onError() { console.error("reservation arrival-roll worker discovery failed"); },
      onResult(result) {
        if (result.failures.length > 0) {
          console.error(`reservation arrival-roll worker failed for ${result.failures.length} scope(s)`);
        }
      },
    }), "reservation arrival-roll worker stopped unexpectedly");
  }
  if (reservationDepartureRollEnabled) {
    const discoveryPool = ownSqlPool(new SQL(databaseUrl, { max: 2, prepare: false }));
    const worker = new ReservationDepartureRollWorker(
      reservationDepartureRolls,
      new PostgresDueDepartureScopeSource(discoveryPool),
    );
    superviseWorker(worker.run({ signal: runtimeAbort.signal,
      onError() { console.error("reservation departure-roll worker discovery failed"); },
      onResult(result) {
        if (result.failures.length > 0) {
          console.error(`reservation departure-roll worker failed for ${result.failures.length} scope(s)`);
        }
      },
    }), "reservation departure-roll worker stopped unexpectedly");
  }
  if (businessDayRollEnabled) {
    const discoveryPool = ownSqlPool(new SQL(databaseUrl, { max: 2, prepare: false }));
    const worker = new BusinessDayRollWorker(
      businessDayRolls,
      new PostgresDueBusinessDayScopeSource(discoveryPool),
    );
    superviseWorker(worker.run({ signal: runtimeAbort.signal,
      onError() { console.error("business-day roll worker discovery failed"); },
      onResult(result) {
        if (result.failures.length > 0) {
          console.error(`business-day roll worker failed for ${result.failures.length} scope(s)`);
        }
      },
    }), "business-day roll worker stopped unexpectedly");
  }
  if (fiscalSubmissionDeliveryEnabled) {
    const fiscalPool = ownSqlPool(new SQL(databaseUrl, { max: 4, prepare: false }));
    const fiscalRepository = new FiscalSubmissionRepository(fiscalPool);
    const fiscalWorker = new FiscalSubmissionWorker(fiscalRepository, fiscalAdapterRegistry);
    fiscalDeliveryRuntime = new FiscalSubmissionDeliveryRuntime(
      fiscalWorker,
      new PostgresDueFiscalSubmissionSource(fiscalPool),
    );
    superviseWorker(fiscalDeliveryRuntime.run({ signal: runtimeAbort.signal,
      onError() { console.error("fiscal submission delivery runtime failed"); },
      onResult(result) {
        if (result.failures.length > 0) {
          console.error(`fiscal submission delivery failed for ${result.failures.length} item(s)`);
        }
      },
    }), "fiscal submission delivery runtime stopped unexpectedly");
  }
  return createApp({
    buildInfo,
    readinessProbe,
    readinessTarget: "yellow_runtime_database",
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(login, availability, inventory, new PostgresIdempotency(), restrictions, rates, pricing, blocks, policy, holds, projection, runtimeStatus, rateBuilder, reservations, reservationOffers, reservationGuests, reservationLifecycle, reservationSegments, parties, folioStatements, charges, new ReservationBoardService(), new ReservationDetailService(), folios, chargeCorrections, folioTransfers, hostedRuntime?.hostedDeposits, folioSettlements, cashiers, receivables, checkIns, housekeeping, housekeepingSheets, checkoutReadiness, checkouts, vehicleRegister, reservationTravel, pickupTaskDispatch, arrivalRoomCleaning, housekeepingDiscrepancies, vehicleParking, undefined, undefined, businessDayCarry, businessDaySeal, ownerTrustExpenses, {
      submissions: fiscalSubmissions,
      adapters: fiscalSubmissionAdapters,
    }),
    operatorLocalReviewCredentials: localReviewCredentials(),
    ...(hostedRuntime ? { hostedDepositRoutes: hostedRuntime.routes, hostedDepositSurface: "guest" as const } : {}),
  });
}

const server = runtimeApp().listen({ hostname: runtimeHostname(), port, maxRequestBodySize });
const serverLifecycle = new ServerLifecycle({
  controller: runtimeAbort,
  workerTasks: runtimeWorkerTasks,
  stopIntake: async () => { await server.stop(false); },
  forceStopIntake: async () => { await server.stop(true); },
  closeResources: async () => {
    await Promise.allSettled(runtimeResourceClosers.map(async (close) => close()));
  },
});
installServerLifecycleSignals(serverLifecycle);
