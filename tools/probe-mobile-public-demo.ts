type Check = Readonly<{ name: string; ok: boolean; evidence: string }>;

function trimTrailingSlash(value: string): string {
  let next = value;
  while (next.endsWith("/")) next = next.slice(0, -1);
  return next;
}

const baseUrl = trimTrailingSlash(process.env.YELLOW_PUBLIC_DEMO_URL ?? "https://lying-jones-terminal-church.trycloudflare.com");

async function text(pathOrUrl: string): Promise<string> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function assetUrls(html: string, extension: "css" | "js"): readonly string[] {
  const matches = html
    .replaceAll("<", " ")
    .replaceAll(">", " ")
    .replaceAll("\n", " ")
    .replaceAll("\t", " ")
    .split(" ")
    .filter((part) => part.startsWith("href=") || part.startsWith("src="))
    .map((part) => part.slice(part.indexOf("=") + 1).replaceAll('"', "").replaceAll("'", ""))
    .filter((url) => url.endsWith(`.${extension}`))
    .filter((url) => url.includes("/yellow-next/assets/") || url.includes("/assets/"));
  return [...new Set(matches)].map((url) => url.startsWith("/") ? url : `/yellow-next/${url.startsWith("./") ? url.slice(2) : url}`);
}

function includesAll(source: string, values: readonly string[]): boolean {
  return values.every((value) => source.includes(value));
}

function compactCss(source: string): string {
  return source.replaceAll(" ", "").replaceAll("\n", "").replaceAll("\t", "").replaceAll("\r", "").replaceAll(";}", "}");
}

async function main() {
  const html = await text("/");
  const cssUrls = assetUrls(html, "css");
  const jsUrls = assetUrls(html, "js");
  if (cssUrls.length === 0 || jsUrls.length === 0) throw new Error("The public shell did not reference built CSS and JS assets.");

  const css = (await Promise.all(cssUrls.map(text))).join("\n");
  const compactedCss = compactCss(css);
  const js = (await Promise.all(jsUrls.map(text))).join("\n");

  const checks: Check[] = [
    {
      name: "mobile shell uses bottom safe-area navigation",
      ok: includesAll(compactedCss, [".mobile-nav", "position:fixed", "bottom:0", "env(safe-area-inset-bottom)", "grid-template-columns:repeat(7,minmax(0,1fr))"]),
      evidence: `${cssUrls.length} CSS asset(s) inspected`,
    },
    {
      name: "mobile content clears nav and clips horizontal overflow",
      ok: includesAll(compactedCss, ["overflow-x:hidden", "padding:28px18px100px", "calc(104px+env(safe-area-inset-bottom))"]),
      evidence: "root overflow and workspace bottom clearance present",
    },
    {
      name: "Today colleague path remains mobile-scrollable",
      ok: includesAll(compactedCss, [".today-demo-path-grid", "overflow-x:auto", "scroll-snap-type:xproximity", "grid-template-columns:repeat(7,minmax(142px,76vw))"]),
      evidence: "demo path is horizontally contained for phone widths",
    },
    {
      name: "Overwatch launch avoids bottom navigation",
      ok: includesAll(compactedCss, [".yellow-launch", "bottom:75px", ".yellow-next.yellow-ai-active.yellow-launch", ".yellow-next.yellow-ai-active.yellow-launch{"]),
      evidence: "assistant launcher has mobile offset and active state",
    },
    {
      name: "public shell exposes colleague path copy",
      ok: includesAll(js, ["COLLEAGUE DEMO PATH", "Review the implemented PMS flow in order", "Multilingual AI assistant"]),
      evidence: `${jsUrls.length} JS asset(s) inspected`,
    },
    {
      name: "public shell exposes multilingual confirmation-gated assistant copy",
      ok: includesAll(js, ["Ask Yellow in Indian English/Hindi", "explicit confirmation before actions", "requiresConfirmation"]),
      evidence: "assistant copy and confirmation flag are bundled",
    },
  ];

  console.table(checks.map((check) => ({ check: check.name, ok: check.ok, evidence: check.evidence })));
  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) throw new Error(`Mobile public demo probe failed: ${failed.map((check) => check.name).join(", ")}`);
}

await main();
