// Synthetic, loopback-only built-UI proof. No production forwarding or database.
import { resolve, sep } from "node:path";
import { godEyeAsset } from "../../../src/http/god-eye-assets";
import { SECURITY_HEADERS, YELLOW_MAP_CSP } from "../../../src/http/security-headers";
const root = resolve(import.meta.dir, "../../../public/yellow-next");
const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const app = Bun.serve({ hostname: "127.0.0.1", port: 4175, async fetch(request) {
  const url = new URL(request.url), path = url.pathname;
  if (path === "/__gps-proof.js") {
    // Deterministic browser-facing failure/success seam; never real device GPS.
    const mode = url.searchParams.get("mode") === "success" ? "success" : "denied";
    return new Response(`Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail){setTimeout(()=>${mode === "success" ? "ok({coords:{latitude:30.3165,longitude:78.0322,accuracy:25}})" : "fail({code:1})"},0)}}});`, {headers:{"content-type":"text/javascript"}});
  }
  if (path.endsWith("/auth/demo:enter")) return Response.json({ accessToken: "«REDACTED-SECRET»" });
  if (path.endsWith("/me/properties")) return Response.json({ properties: [{ id: property, name: "Synthetic map review", timezone: "UTC" }] });
  if (path.endsWith("/reservation-board")) return Response.json({ reservations: [], nextCursor: null });
  if (path.endsWith("/group-blocks")) return Response.json({ groups: [] });
  if (path.endsWith("/groups") && request.method === "GET") return Response.json({ groups: [], nextCursor: null });
  if (path.startsWith("/api/")) return Response.json({ detail: "Synthetic review route unavailable; nothing forwarded" }, { status: 404 });
  if (path.startsWith("/yellow-next/cesium/")) return godEyeAsset(path.slice("/yellow-next/cesium/".length));
  const relative = path.startsWith("/yellow-next/assets/") ? path.slice("/yellow-next/".length) : "index.html";
  const target = resolve(root, relative);
  if (!target.startsWith(root + sep)) return new Response("Not found", { status: 404 });
  const file = Bun.file(target);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  const body = relative === "index.html" && url.searchParams.has("gpsProof")
    ? (await file.text()).replace("<head>", `<head><script src="/__gps-proof.js?mode=${url.searchParams.get("gpsProof") === "success" ? "success" : "denied"}"></script>`)
    : file;
  return new Response(body, { headers: { ...SECURITY_HEADERS,
    ...(relative === "index.html" ? {"content-type":"text/html; charset=utf-8"} : {}),
    "content-security-policy": YELLOW_MAP_CSP,
    "permissions-policy": "camera=(), geolocation=(self), microphone=(), payment=(), usb=()",
  } });
} });
console.log(`Synthetic map proof: http://127.0.0.1:${app.port}/p/${property}/today?workspace=market-map`);
