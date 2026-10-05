import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const repository = resolve(import.meta.dir, "..");
const propertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const reservationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const tenantId = "33333333-3333-4333-8333-333333333333";

test("mounted Billing returns the selected reservation and blocks return without navigation authority", async () => {
  const executable = resolveChromiumPath();
  if (!executable) throw new Error("Owned Chromium required for mounted Billing return proof");
  const directory = await mkdtemp(join(tmpdir(), "yellow-order773-billing-"));
  const profile = join(directory, "profile");
  const buildDir = join(directory, "build");
  await mkdir(profile);
  await mkdir(buildDir);
  let server: ReturnType<typeof Bun.serve> | undefined;
  let chrome: ReturnType<typeof Bun.spawn> | undefined;
  let socket: WebSocket | undefined;
  const pending = new Map<number, (value: any) => void>();
  let commandId = 0;
  try {
    const entry = join(directory, "entry.tsx");
    const module = (path: string) => JSON.stringify(resolve(repository, path));
    await writeFile(entry, `
import React from ${module("node_modules/react/index.js")};
import {createRoot} from ${module("node_modules/react-dom/client.js")};
import {flushSync} from ${module("node_modules/react-dom/index.js")};
import {QueryClient,QueryClientProvider} from ${module("node_modules/@tanstack/react-query/build/modern/index.js")};
import {reactAuthSession} from ${module("frontend/yellow/src/auth-session.ts")};
import {configureYellowApi} from ${module("frontend/yellow/src/yellow-api.tsx")};
import ${module("frontend/yellow/src/styles.css")};
import ${module("frontend/yellow/src/ui/reference-theme.css")};

const P=${JSON.stringify(propertyId)},R=${JSON.stringify(reservationId)},A=${JSON.stringify(actorId)},T=${JSON.stringify(tenantId)};
configureYellowApi(P);
const token='synthetic.'+btoa(JSON.stringify({sub:A,tid:T})).replaceAll('=','')+'.signature';
const reads=[],writes=[];
const reservation={reservationId:R,primaryPartyId:A,confirmationNo:'SYN-773',status:'in_house',bookerPartyId:null,groupId:null,
 channelCode:'DIRECT',marketCode:'RETAIL',sourceCode:'WEB',originCode:null,currency:'INR',guaranteePolicyId:null,eta:null,etd:null,notes:null,
 createdAt:'2026-10-05T00:00:00Z',cancelledAt:null,cancelReason:null,cancellationNo:null,guests:[{partyId:A,displayName:'Synthetic Selected Guest',role:'primary',sharePct:null}],segments:[],folios:[],alerts:[],travel:[],history:[]};
const stay={reservationId:R,confirmationNo:'SYN-773',primaryGuestDisplayName:'Synthetic Selected Guest',status:'in_house',operationalState:'in_house',
 stayFrom:'2026-10-04T14:00:00Z',stayTo:'2026-10-06T10:00:00Z',unitTypeLabel:'Standard',sellableUnitLabel:'101',channelCode:'DIRECT',sourceCode:'WEB',marketCode:'RETAIL'};
window.fetch=async(input,init={})=>{
 const url=String(input),method=init.method||'GET';
 if(url.endsWith('/auth/local:login'))return Response.json({accessToken:token,tokenType:'Bearer',expiresInSeconds:900,user:{id:A,displayName:'Synthetic operator'}});
 if(url.endsWith('/me/properties'))return Response.json({properties:[{id:P,name:'Synthetic property',timezone:'UTC'}]});
 if(method!=='GET'){writes.push(method+' '+url);return Response.json({}, {status:405});}
 reads.push(url);
 if(url.includes('/cashier-sessions'))return Response.json({drawers:[]});
 if(url.includes('/reservation-board'))return Response.json({reservations:[stay],nextCursor:null});
 if(url.endsWith('/reservations/'+R))return Response.json({reservation,actions:{canCancel:false,canManageAlerts:false,canModify:false,canOpenPrimaryFolio:false,canReinstate:false}});
 return Response.json({}, {status:404});
};
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
const root=createRoot(document.getElementById('root'));
let mode='standalone';
const render=next=>{mode=next;flushSync(()=>root.render(React.createElement(QueryClientProvider,{client:queryClient},React.createElement(CashierWorkbench,{key:mode,drawers:[],initialReservationId:mode==='standalone'?null:R,
 canMovePresentation:()=>mode!=='locked',onReturnToReservation:mode==='standalone'?undefined:(id=>{window.order773.calls.push(id);history.pushState(null,'','/p/'+P+'/res/'+encodeURIComponent(id));})}))));};
const {CashierWorkbench}=await import(${module("frontend/yellow/src/workspaces/FinanceWorkspace.tsx")});
window.order773={calls:[],render,ready:async()=>{await reactAuthSession.signIn({tenant:'synthetic',email:'operator@example.invalid',password:'synthetic-only'},P);render('standalone');},observations:()=>({body:document.body.innerText,button:document.querySelector('[aria-label="Return to selected reservation"]')?.outerHTML??null,calls:[...window.order773.calls],path:location.pathname,reads:[...reads],writes:[...writes]})};
await window.order773.ready();
`);
    const build = await Bun.build({ entrypoints: [entry], outdir: buildDir, target: "browser", format: "esm", define: { "process.env.NODE_ENV": '"production"' } });
    expect(build.success).toBe(true);

    server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/entry.js" || path === "/entry.css") {
        const file = join(buildDir, path.slice(1));
        if (!existsSync(file)) return new Response("missing", { status: 404 });
        return new Response(Bun.file(file), { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } });
      }
      return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>', { headers: { "content-type": "text/html; charset=utf-8" } });
    } });

    chrome = Bun.spawn([executable, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore", windowsHide: true });
    let debugPort = "";
    for (let attempt = 0; attempt < 250 && !debugPort; attempt++) {
      try { debugPort = (await Bun.file(join(profile, "DevToolsActivePort")).text()).split(/\r?\n/)[0]?.trim() ?? ""; }
      catch { await Bun.sleep(20); }
    }
    if (!debugPort) throw new Error("Owned Chromium debugging endpoint unavailable");
    const targets = await fetchJsonBounded<Array<{ type: string; webSocketDebuggerUrl: string }>>(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find(item => item.type === "page");
    if (!target) throw new Error("Owned Chromium page unavailable");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolveOpen, reject) => { socket!.onopen = () => resolveOpen(); socket!.onerror = () => reject(new Error("Owned Chromium CDP connection failed")); });
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (typeof message.id === "number") { pending.get(message.id)?.(message); pending.delete(message.id); }
    };
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolveReply, reject) => {
      const id = ++commandId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP deadline: ${method}`)); }, 5000);
      pending.set(id, value => { clearTimeout(timer); resolveReply(value); });
      socket!.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async <T,>(expression: string): Promise<T> => {
      const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(response.exceptionDetails)}`);
      return response.result?.result?.value as T;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${propertyId}/today?workspace=finance` });
    const waitFor = async <T,>(expression: string, predicate: (value: T) => boolean): Promise<T> => {
      const end = Date.now() + 10_000;
      while (Date.now() < end) {
        const value = await evaluate<T>(expression);
        if (predicate(value)) return value;
        await Bun.sleep(25);
      }
      throw new Error(`Mounted Billing observation timed out: ${expression}`);
    };

    const standalone = await waitFor<{ button: string | null; writes: string[] }>("window.order773?.observations()", value => value !== undefined);
    expect(standalone.button).toBeNull();
    expect(standalone.writes.filter(path => !path.includes("auth/local:login"))).toEqual([]);

    await evaluate("window.order773.render('reservation')");
    const selected = await waitFor<{ button: string | null; body: string }>("window.order773.observations()", value => Boolean(value?.button) && value.body.includes("Synthetic Selected Guest"));
    expect(selected.body).toContain("Synthetic Selected Guest");
    expect(selected.button).toContain("Return to reservation");
    expect(selected.button).not.toContain("disabled");
    await evaluate("document.querySelector('[aria-label=\\\"Return to selected reservation\\\"]').click()");
    const returned = await evaluate<{ calls: string[]; path: string }>("window.order773.observations()");
    expect(returned.calls).toEqual([reservationId]);
    expect(returned.path).toBe(`/p/${propertyId}/res/${reservationId}`);

    await evaluate("window.order773.render('locked')");
    const locked = await waitFor<{ button: string | null; path: string; calls: string[] }>("window.order773.observations()", value => Boolean(value?.button?.includes("disabled")));
    expect(locked.button).toContain("disabled");
    await evaluate("document.querySelector('[aria-label=\\\"Return to selected reservation\\\"]').click()");
    const afterLockedClick = await evaluate<{ calls: string[]; path: string }>("window.order773.observations()");
    expect(afterLockedClick.calls).toEqual([reservationId]);
    expect(afterLockedClick.path).toBe(`/p/${propertyId}/res/${reservationId}`);
    expect(afterLockedClick.reads).toContain(`/api/v1/properties/${propertyId}/reservations/${reservationId}`);
    expect(afterLockedClick.writes.filter(path => !path.includes("auth/local:login"))).toEqual([]);
  } finally {
    socket?.close();
    if (chrome) await terminateOwnedProcess(chrome);
    server?.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
