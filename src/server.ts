import { SQL } from "bun";

import { app, createApp } from "./app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "./contexts/identity";
import { AvailabilityService, HoldService, InventoryPolicyService, InventoryService, OperationalBlockService, RestrictionService } from "./contexts/inventory";
import { RateConfigurationService, RatePricingService } from "./contexts/rates";
import { OperatorHttpApi } from "./http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "./kernel";

const port = Bun.env.PORT === undefined ? 3000 : Number(Bun.env.PORT);
const workbenchEnabled = Bun.env.YELLOW_OPERATOR_WORKBENCH === "1";
const maxRequestBodySize = 16 * 1024;

function runtimeHostname(): string {
  const requested = Bun.env.HOST;
  if (!workbenchEnabled) return requested ?? "0.0.0.0";
  if (!requested || requested === "127.0.0.1" || requested === "localhost" || requested === "::1") {
    return requested ?? "127.0.0.1";
  }
  if (Bun.env.YELLOW_OPERATOR_ALLOW_NON_LOOPBACK === "1") return requested;
  throw new Error("non-loopback operator binding requires YELLOW_OPERATOR_ALLOW_NON_LOOPBACK=1");
}

function required(name: "DATABASE_URL" | "YELLOW_TOKEN_SECRET"): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`${name} is required when YELLOW_OPERATOR_WORKBENCH=1`);
  return value;
}

function runtimeApp() {
  if (!workbenchEnabled) return app;
  const databaseUrl = required("DATABASE_URL");
  const tokens = new Hs256TokenSigner(required("YELLOW_TOKEN_SECRET"));
  const database = Database.connect(databaseUrl, { maxConnections: 12 });
  const loginPool = new SQL(databaseUrl, { max: 4 });
  const eventPool = new SQL(databaseUrl, { max: 4 });
  const login = new LocalLoginService(loginPool, tokens);
  const events = new PostgresEventBus(eventPool);
  const inventory = new InventoryService(events);
  const restrictions = new RestrictionService(events);
  const rates = new RateConfigurationService(events);
  const pricing = new RatePricingService(events);
  const blocks = new OperationalBlockService(events);
  const policy = new InventoryPolicyService(events);
  const holds = new HoldService(events);
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(login, new AvailabilityService(), inventory, new PostgresIdempotency(), restrictions, rates, pricing, blocks, policy, holds),
  });
}

runtimeApp().listen({ hostname: runtimeHostname(), port, maxRequestBodySize });
