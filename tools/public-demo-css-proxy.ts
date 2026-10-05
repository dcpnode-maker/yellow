// The bounded Yellow review runtime is the local server on 3000. Keep the public
// tunnel proxy separate from it on 3011 so the proxy is the only passwordless edge.
const upstream = "http://127.0.0.1:3000";
const publicDemoPropertyId = "4518a22f-b455-54c6-a50a-4584383749b9";
const publicDemoEnvironment = Bun.file(new URL("../../yellow-public-demo.env", import.meta.url));
const css = Bun.file(new URL("../src/http/operator/operator.css", import.meta.url));
const html = Bun.file(new URL("../src/http/operator/index.html", import.meta.url));
const script = Bun.file(new URL("../src/http/operator/operator.js", import.meta.url));
const locanda = Bun.file(new URL("../src/http/client/locanda.html", import.meta.url));
const locandaCss = Bun.file(new URL("../src/http/client/locanda.css", import.meta.url));
const locandaResultsCss = Bun.file(new URL("../src/http/client/locanda-results.css", import.meta.url));
const locandaMapCss = Bun.file(new URL("../src/http/client/locanda-map.css", import.meta.url));
const locandaMapScript = Bun.file(new URL("../src/http/client/locanda-map.js", import.meta.url));
const locandaGuestProgramCss = Bun.file(new URL("../src/http/client/locanda-guest-program.css", import.meta.url));
const locandaGuestProgramScript = Bun.file(new URL("../src/http/client/locanda-guest-program.js", import.meta.url));
const locandaStays = Bun.file(new URL("../src/http/client/locanda-stays.html", import.meta.url));
const locandaDetail = Bun.file(new URL("../src/http/client/locanda-detail.html", import.meta.url));
const locandaReactIndex = Bun.file(new URL("../public/locanda-next/index.html", import.meta.url));
const locandaReactAssetRoot = new URL("../public/locanda-next/assets/", import.meta.url);
const yellowReactIndex = Bun.file(new URL("../public/yellow-next/index.html", import.meta.url));
const yellowReactAssetRoot = new URL("../public/yellow-next/assets/", import.meta.url);
// This is deliberately appended only at the passwordless public-demo edge.  The
// internal workbench retains its selectable development skins; the shared demo
// has one stable, reviewable Yellow visual contract.
const publicYellowTheme = `
/* Shared demo visual contract — Yellow PMS is yellow, white, charcoal and grey only. */
html:root,html:root[data-theme],html:root[data-workspace-skin]{--ink:#171512!important;--muted:#6f6a60!important;--paper:#fff!important;--card:#fff!important;--line:#e7e4dc!important;--accent:#ffd400!important;--accent-strong:#8e7000!important;--accent-ink:#171512!important;--brand:#ffd400!important;--focus:#b38c00!important;--nav:#fff!important;--shell-ink:#171512!important;--shell-muted:#6f6a60!important;--surface-subtle:#fffdf5!important;--card-shadow:0 14px 42px rgba(28,25,18,.07)!important}
html,body,.workbench{background:#fff!important;color:#171512!important}.ambient-stage{display:none!important}
.app-bar{position:sticky!important;top:0!important;z-index:100!important;min-height:76px!important;padding:0 clamp(1rem,3vw,3.25rem)!important;border-bottom:1px solid #e7e4dc!important;background:#fff!important;color:#171512!important;box-shadow:0 1px 0 rgba(0,0,0,.025)!important;backdrop-filter:none!important}
.app-bar .brand{color:#171512!important}.app-bar .brand small,.app-bar .session-state{color:#6f6a60!important}.app-bar .brand-mark{background:#ffd400!important;color:#171512!important;box-shadow:none!important}.app-bar .quiet,.app-bar .client-website-preview{border-color:#ddd8ca!important;background:#fff!important;color:#171512!important}.app-bar .quiet:hover,.app-bar .client-website-preview:hover{border-color:#c9a000!important;background:#fff9dd!important;color:#171512!important}
.workbench{display:grid!important;grid-template-columns:224px minmax(0,1fr)!important;grid-template-areas:"nav head" "nav content"!important;gap:0 2rem!important;max-width:1520px!important;margin:0 auto!important;padding:0 clamp(1rem,3vw,3rem) 4rem!important}.workbench-head{grid-area:head!important;min-height:118px!important;margin:0!important;padding:2rem 0 1.45rem!important;border-bottom:1px solid #e7e4dc!important}.workbench-head h1,.workbench h1,.section-heading h2{color:#171512!important}.workbench-head p,.section-heading p,.lede{color:#6f6a60!important}.eyebrow,.workbench-head .eyebrow{color:#907200!important}
.domain-bar{grid-area:nav!important;position:sticky!important;top:96px!important;align-self:start!important;display:block!important;max-height:calc(100dvh - 116px)!important;margin:1.25rem 0 0!important;padding:1rem!important;overflow:auto!important;border:1px solid #e7e4dc!important;border-radius:16px!important;background:#fff!important;box-shadow:0 10px 32px rgba(28,25,18,.055)!important}.domain-bar>.property-context{display:grid!important;width:100%!important;margin-bottom:1rem!important;padding-bottom:1rem!important;border-bottom:1px solid #eeeae0!important}.domain-nav-label{display:block!important;margin:0 0 .65rem!important;color:#8b8373!important;font-size:.66rem!important;letter-spacing:.12em!important;text-transform:uppercase!important}.workspace-navigation-disclosure{display:block!important}.workspace-navigation-disclosure>summary{display:none!important}.workspace-group{display:block!important;margin:0!important;border:0!important}.workspace-group>summary{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:.75rem .55rem!important;color:#746c5f!important;font-size:.68rem!important;font-weight:800!important;letter-spacing:.09em!important;text-transform:uppercase!important;cursor:default!important}.workspace-group>summary::marker{display:none!important}.workspace-group-items{display:grid!important;gap:.18rem!important;margin:0 0 .5rem!important}.domain-tab,.day-close-nav{display:flex!important;align-items:center!important;gap:.65rem!important;width:100%!important;min-height:40px!important;padding:.6rem .65rem!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#403c34!important;text-align:left!important;font-size:.83rem!important}.domain-tab:hover,.day-close-nav:hover{background:#fff9df!important;color:#171512!important}.domain-tab.is-active{background:#fff4bf!important;color:#171512!important;box-shadow:inset 3px 0 #ffd400!important}.domain-tab .domain-icon,.day-close-nav .day-close-icon{display:block!important;width:18px!important;height:18px!important;margin:0!important;color:#8a7000!important}
#workbench-view>section:not([hidden]){grid-column:2!important;min-width:0!important}.card,.today-lane,.housekeeping-condition-board,.invoice-workbench__queue,.invoice-workbench__detail{border-color:#e7e4dc!important;background:#fff!important;box-shadow:0 8px 26px rgba(28,25,18,.035)!important}.primary,.invoice-workbench__print,.invoice-workbench__issue :is(.invoice-workbench__readiness-submit,.invoice-workbench__issue-submit){background:#ffd400!important;border-color:#d5ad00!important;color:#171512!important}.quiet,.secondary{border-color:#ddd8ca!important;background:#fff!important;color:#28241e!important}.metric,.reservation-summary>div,.projection-summary,.cause-explainer,.reservation-reinstate-panel{border-color:#eee9dc!important;background:#fffdf5!important}.jarvis-launch{border-color:#d5ad00!important;background:#ffd400!important;color:#171512!important;box-shadow:0 10px 28px rgba(135,106,0,.22)!important}
@media(max-width:767px){.app-bar{min-height:64px!important;padding:0 .9rem!important}.app-actions>*:not(.client-website-preview){display:none!important}.app-bar .client-website-preview{display:inline-flex!important;min-height:34px!important;padding:.45rem .6rem!important;font-size:.68rem!important}.workbench{display:block!important;padding:0 .85rem 5.6rem!important}.workbench-head{min-height:auto!important;padding:1.35rem 0 1rem!important}.domain-bar{position:fixed!important;z-index:110!important;right:0!important;bottom:0!important;left:0!important;top:auto!important;display:block!important;max-height:none!important;margin:0!important;padding:.35rem .5rem calc(.35rem + env(safe-area-inset-bottom))!important;overflow:visible!important;border:0!important;border-top:1px solid #e7e4dc!important;border-radius:0!important;box-shadow:0 -8px 24px rgba(28,25,18,.1)!important}.domain-bar>.property-context,.domain-bar>.domain-nav-label,.workspace-navigation-disclosure>summary,.workspace-group>summary{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}.workspace-navigation-disclosure,.workspace-navigation-disclosure[open]>.domain-nav,.domain-nav{display:flex!important;gap:.2rem!important;overflow-x:auto!important;scrollbar-width:none!important}.workspace-group,.workspace-group[open],.workspace-group-items{display:contents!important}.domain-tab,.day-close-nav{display:block!important;flex:0 0 auto!important;min-width:58px!important;min-height:45px!important;padding:.34rem .5rem!important;border-radius:7px!important;text-align:center!important;font-size:.65rem!important;line-height:1.15!important}.domain-tab .domain-icon,.day-close-nav .day-close-icon{display:block!important;width:17px!important;height:17px!important;margin:0 auto .18rem!important}.domain-tab.is-active{box-shadow:inset 0 -3px #ffd400!important}.jarvis-launch{right:.8rem!important;bottom:4.45rem!important}}
`;
// This proxy is the only passwordless boundary. Mark the document at parse time so
// public visitors never see the normal staff credential form during auto-entry.
const automaticDemoBootstrap = '<style>html[data-yellow-automatic-demo-login="1"] #login-form>:not(#login-message){display:none!important}html[data-yellow-automatic-demo-login="1"] #login-form{min-height:0;padding:0;border:0;background:transparent;box-shadow:none}html[data-yellow-automatic-demo-login="1"] #login-message{display:block;margin:1rem 0 0;font-weight:700}</style><script src="/assets/operator-public-demo.js" defer></script>';
const operatorSecurityHeaders = {
  "content-security-policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'",
  "permissions-policy": "camera=(), geolocation=(), microphone=(self), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cache-control": "no-store",
} as const;
const yellowReactSecurityHeaders = {
  "content-security-policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; form-action 'self'",
  "permissions-policy": "camera=(), geolocation=(), microphone=(self), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cache-control": "no-store",
} as const;

type PublicDemoCredentials = Readonly<{ tenant: string; email: string; password: string }>;
let cachedDemoEntry: { readonly body: string; readonly expiresAt: number } | null = null;

async function publicDemoCredentials(): Promise<PublicDemoCredentials | null> {
  const values = new Map<string, string>();
  for (const line of (await publicDemoEnvironment.text()).split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) values.set(match[1], match[2]);
  }
  if (values.get("YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN") !== "1") return null;
  const tenant = values.get("YELLOW_LOCAL_REVIEW_TENANT");
  const email = values.get("YELLOW_LOCAL_REVIEW_EMAIL");
  const password = values.get("YELLOW_LOCAL_REVIEW_PASSWORD");
  return tenant && email && password ? { tenant, email, password } : null;
}

function tokenCacheExpiry(accessToken: string): number | null {
  const encodedPayload = accessToken.split(".")[1];
  if (!encodedPayload) return null;
  try {
    const base64 = encodedPayload.replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "="))) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    const expiry = payload.exp * 1000 - 30_000;
    return expiry > Date.now() ? expiry : null;
  } catch {
    return null;
  }
}

Bun.serve({
  port: 3011,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    // A shared tunnel link should always land on the reviewed public dashboard,
    // never the internal-style legacy shell.  Classic remains an explicit,
    // reversible review route on the property URL.
    if (url.pathname === "/") {
      return new Response(null, {
        status: 302,
        headers: { location: `/p/${publicDemoPropertyId}/today`, "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/assets/operator.css") {
      return new Response(css, {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname === "/assets/operator.js") {
      return new Response(script, {
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/assets/operator-public-demo.js") {
      return new Response('(()=>{document.documentElement.dataset.yellowAutomaticDemoLogin="1";const form=document.querySelector("#login-form");if(!form)return;form.setAttribute("aria-label","Opening the shared Yellow demo");for(const child of form.children)if(child.id!=="login-message")child.hidden=true;const message=document.querySelector("#login-message");if(message)message.textContent="Opening the shared Yellow demo…"})()', {
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/api/v1/auth/demo:enter" && request.method === "POST") {
      const credentials = await publicDemoCredentials();
      if (!credentials) {
        cachedDemoEntry = null;
        return new Response("Not found", { status: 404 });
      }
      if (cachedDemoEntry && Date.now() < cachedDemoEntry.expiresAt) {
        return new Response(cachedDemoEntry.body, {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
      // The browser calls only this synthetic-demo route. The local demo identity is
      // read here, never returned in markup, JavaScript, or API response data.
      const upstreamResponse = await fetch(`${upstream}/api/v1/auth/local:login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const body = await upstreamResponse.text();
      if (!upstreamResponse.ok) return new Response(body, {
        status: upstreamResponse.status,
        headers: { "content-type": upstreamResponse.headers.get("content-type") ?? "application/problem+json; charset=utf-8", "cache-control": "no-store" },
      });
      const entry = JSON.parse(body) as { accessToken?: unknown };
      if (typeof entry.accessToken !== "string" || entry.accessToken.length < 20) {
        return new Response("Invalid demo-entry response", { status: 502, headers: { "cache-control": "no-store" } });
      }
      const expiresAt = tokenCacheExpiry(entry.accessToken);
      cachedDemoEntry = expiresAt === null ? null : { body, expiresAt };
      return new Response(body, {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/client/locanda-homes") {
      return new Response(locandaReactIndex, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    // The public landing surface is the component dashboard.  A classic query is
    // deliberately retained as a reversible review route while the existing
    // governed workspaces remain behind every navigation/action handoff.
    if (/^\/p\/[0-9a-f-]+\/res(?:\/.*)?$/.test(url.pathname) &&
        !/^\/p\/[0-9a-f-]+\/res\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(url.pathname)) {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }
    if (/^\/p\/[0-9a-f-]+\/(?:next|today|reservations|guests|housekeeping|res\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(url.pathname) && url.searchParams.get("classic") !== "1") {
      return new Response(yellowReactIndex, {
        headers: { ...yellowReactSecurityHeaders, "content-type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname.startsWith("/yellow-next/assets/")) {
      const assetName = url.pathname.slice("/yellow-next/assets/".length);
      if (!/^[A-Za-z0-9_-]+\.(?:css|js)$/.test(assetName)) return new Response("Not found", { status: 404 });
      const asset = Bun.file(new URL(assetName, yellowReactAssetRoot));
      if (!(await asset.exists())) return new Response("Not found", { status: 404 });
      return new Response(asset, {
        headers: {
          "content-type": assetName.endsWith(".css") ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname === "/client/locanda-next/media/locanda-riyadh-hero.png") {
      const asset = Bun.file(new URL("../public/locanda-next/media/locanda-riyadh-hero.png", import.meta.url));
      if (!(await asset.exists())) return new Response("Not found", { status: 404 });
      return new Response(asset, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
    }
    if (url.pathname.startsWith("/client/locanda-next/assets/")) {
      const assetName = url.pathname.slice("/client/locanda-next/assets/".length);
      if (!/^[A-Za-z0-9_-]+\.(?:css|js)$/.test(assetName)) return new Response("Not found", { status: 404 });
      const asset = Bun.file(new URL(assetName, locandaReactAssetRoot));
      if (!(await asset.exists())) return new Response("Not found", { status: 404 });
      return new Response(asset, {
        headers: {
          "content-type": assetName.endsWith(".css") ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname === "/client/locanda-homes.css") {
      return new Response(await Promise.all([locandaCss.text(), locandaResultsCss.text(), locandaMapCss.text(), locandaGuestProgramCss.text()]).then((parts) => parts.join("\n")), {
        headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/client/locanda-homes/stays") {
      const stays = (await locandaStays.text()).replace("</body>", '<script defer src="/client/locanda-map.js"></script></body>');
      return new Response(stays, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (url.pathname === "/client/locanda-map.js") {
      return new Response(locandaMapScript, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
    }
    if (url.pathname === "/client/locanda-guest-program.js") {
      return new Response(locandaGuestProgramScript, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
    }
    if (/^\/client\/locanda-homes\/stays\/(?:one-bedroom|two-bedroom)$/.test(url.pathname)) {
      const detail = (await locandaDetail.text()).replace("</body>", '<script defer src="/client/locanda-guest-program.js"></script></body>');
      return new Response(detail, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (/^\/p\/[0-9a-f-]+(?:\/.*)?$/.test(url.pathname)) {
      const operatorHtml = (await html.text())
        .replace("<html", '<html data-yellow-automatic-demo-login="1"')
        .replace('<script src="/assets/operator.js" defer></script>', `${automaticDemoBootstrap}<script src="/assets/operator.js" defer></script>`);
      return new Response(operatorHtml, {
        headers: { ...operatorSecurityHeaders, "content-type": "text/html; charset=utf-8" },
      });
    }
    const target = new URL(`${url.pathname}${url.search}`, upstream);
    const method = request.method.toUpperCase();
    return fetch(target, {
      method,
      headers: request.headers,
      body: method === "GET" || method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  },
});
