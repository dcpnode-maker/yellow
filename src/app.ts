import { Elysia } from "elysia";

import { SECURITY_HEADERS } from "./http/security-headers";

export function createApp() {
  return new Elysia()
    .onAfterHandle(({ set }) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        set.headers[name] = value;
      }
    })
    .onError(({ set }) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        set.headers[name] = value;
      }
    })
    .get("/health", () => ({ status: "ok" as const }));
}

export const app = createApp();
