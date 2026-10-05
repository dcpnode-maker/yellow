/** Ephemeral isolated map QA surface. No database, hotel records or disk tile cache. */
import { resolve, extname } from "node:path";
import { createOvertureMapReader } from "../src/http/overture-map";
import { SECURITY_HEADERS } from "../src/http/security-headers";

const directory = resolve(process.argv[2] ?? "D:/Yellow/temp/order679-map-fixture");
const read = createOvertureMapReader();
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  const match = /^\/api\/public\/overture\/([^/]+)\/([^/]+)$/.exec(path);
  if (match?.[1] && match[2]) {
    const start = performance.now();
    const response = await read(request, match[1], match[2]);
    console.log(JSON.stringify({ source: match[2], range: request.headers.get("range"), status: response.status, bytes: response.headers.get("content-length"), ms: Math.round(performance.now() - start) }));
    return response;
  }
  const relative = path.startsWith("/yellow-next/assets/") ? path.slice("/yellow-next/".length) : "index.html";
  if (!/^assets\/[A-Za-z0-9_.-]+$/.test(relative) && relative !== "index.html") return new Response("Not found", { status: 404 });
  const file = Bun.file(resolve(directory, relative));
  if (!await file.exists()) return new Response("Not found", { status: 404 });
  return new Response(file, { headers: { ...SECURITY_HEADERS, "content-type": ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html" } as Record<string, string>)[extname(relative)] ?? "application/octet-stream" } });
} });
console.log(`Isolated read-only map QA: http://127.0.0.1:${server.port}`);
