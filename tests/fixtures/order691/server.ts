// Order691 mounted UI proof. Loopback only: all folio data is synthetic and API writes are refused.
import { resolve } from "node:path";

const entrypoint = resolve(import.meta.dir, "main.tsx");
const buildConfig = {
  entrypoints: [entrypoint],
  target: "browser",
  write: false,
  minify: false,
};
// The installed Bun runtime supports write:false although its bundled type omits the option.
const built = await Bun.build(buildConfig as unknown as Parameters<typeof Bun.build>[0]);
if (!built.success) throw new AggregateError(built.logs, "Could not build Order691 browser fixture.");
const javascript = built.outputs.find((output) => output.kind === "entry-point" && output.path.endsWith("main.js"));
const stylesheet = built.outputs.find((output) => output.kind === "asset" && output.path.endsWith(".css"));
if (!javascript) throw new Error("Order691 fixture bundle omitted its JavaScript entry.");
const index = await Bun.file(resolve(import.meta.dir, "index.html")).text();
const html = index.replace("</head>", `<style>
  body{margin:0;background:#f4f6f8;color:#253140;font:14px/1.45 system-ui,sans-serif}
  .order691-fixture{box-sizing:border-box;max-width:1500px;margin:0 auto;padding:24px;min-width:0}
  .order691-fixture-header{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}
  .order691-fixture-header h1{margin:0;font-size:24px}.order691-fixture-header p{margin:4px 0;color:#596675}
  .order691-fixture-header>div>p:first-child{font-size:10px;font-weight:750;letter-spacing:.1em}
  .order691-fixture-badge{padding:5px 9px;border:1px solid #b6c4d0;border-radius:999px;font-size:11px;font-weight:750}
  .order691-fixture-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:18px 0;padding:12px;border:1px solid #d9e0e6;border-radius:10px;background:white}
  .order691-fixture-controls fieldset{border:0;padding:0;margin:0}.order691-fixture-controls legend,.order691-fixture-controls label{font-size:12px;font-weight:650}
  .order691-fixture-controls button,.order691-fixture-controls select{min-height:38px;padding:6px 9px;border:1px solid #cbd4dc;border-radius:7px;background:white;color:#263341}
  .order691-fixture-controls [aria-pressed=true]{background:#edf1f4}.order691-fixture-controls label{display:flex;align-items:center;gap:6px}
  .order691-fixture-safety,.order691-fixture-read-log{font-size:12px;color:#52606d}.order691-fixture-read-log{min-height:20px}
  @media(max-width:700px){.order691-fixture{padding:12px}.order691-fixture-controls{align-items:stretch;flex-direction:column}.order691-fixture-controls>*{width:100%}.order691-fixture-controls fieldset>div{display:flex;gap:5px;flex-wrap:wrap}}
</style></head>`);

const server = Bun.serve({ hostname: "127.0.0.1", port: 4176, async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/") return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (url.pathname.startsWith("/api/")) return Response.json({ detail: "Order691 synthetic fixture refuses all API requests." }, { status: 404 });
  if (url.pathname === "/__order691/main.js") return new Response(javascript, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
  if (url.pathname === "/__order691/main.css" && stylesheet) return new Response(stylesheet, { headers: { "content-type": "text/css; charset=utf-8" } });
  return new Response("Not found", { status: 404 });
} });
console.log(`Order691 synthetic mounted proof: http://127.0.0.1:${server.port}/`);
