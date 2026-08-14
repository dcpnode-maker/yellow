import { Elysia } from "elysia";

import { SECURITY_HEADERS } from "./http/security-headers";

export const app = new Elysia()
  .onBeforeHandle(({ set }) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      set.headers[name] = value;
    }
  })
  .get("/health", () => ({ status: "ok" as const }));
