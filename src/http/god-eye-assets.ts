const ROOT = new URL("../../public/yellow-next/cesium/", import.meta.url);
const DIRECTORIES = new Set(["Assets", "Widgets", "Workers", "ThirdParty"]);
const MIME: Readonly<Record<string, string>> = {
  js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8",
  json: "application/json", wasm: "application/wasm", png: "image/png",
  jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml",
  webp: "image/webp", ktx2: "image/ktx2", xml: "application/xml",
  txt: "text/plain; charset=utf-8",
};

export function cesiumAssetPath(path: string): string | null {
  if (path.length > 240 || !/^[A-Za-z0-9_./-]+$/.test(path)) return null;
  const parts = path.split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) return null;
  if (parts.length === 1) return ["LICENSE.md", "ThirdParty.json"].includes(path) ? path : null;
  if (!DIRECTORIES.has(parts[0]!)) return null;
  const ext = parts.at(-1)!.split(".").at(-1)!;
  return MIME[ext] ? path : null;
}

export async function godEyeAsset(path: string): Promise<Response> {
  const safe = cesiumAssetPath(path);
  if (!safe) return new Response("Not found", { status: 404 });
  const file = Bun.file(new URL(safe, ROOT));
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  const extension = safe.split(".").at(-1)!;
  return new Response(file, { headers: {
    "content-type": MIME[extension] ?? "text/plain; charset=utf-8",
    "cache-control": "public, max-age=86400",
  } });
}
