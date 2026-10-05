import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const reservation = "67600000-0000-4000-8000-000000000001";
const segment = "67600000-0000-4000-8000-000000000002";

test("Order676 actual React editor: success, denial, conflict and exact uncertain retry", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Order676 browser proof");
  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-order676-browser-"));
  const buildDirectory = resolve(temporary, "build");
  const profile = resolve(temporary, "profile");
  let server: ReturnType<typeof Bun.serve> | undefined;
  let chrome: ReturnType<typeof Bun.spawn> | undefined;
  let socket: WebSocket | undefined;
  try {
    const build = Bun.spawn([Bun.which("bun")!, "x", "vite", "build", "--config", resolve(root, "frontend/yellow/vite.config.ts"), "--outDir", buildDirectory, "--emptyOutDir"], {
      cwd: root, stdout: "pipe", stderr: "pipe", windowsHide: true,
    });
    const [exit, stdout, stderr] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()]);
    expect(exit, `${stdout}\n${stderr}`).toBe(0);
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith("/api/")) return new Response("intercept missing", { status: 418 });
      const part = pathname.startsWith("/yellow-next/assets/") ? pathname.slice("/yellow-next/".length) : "index.html";
      const file = resolve(buildDirectory, part);
      if (!file.startsWith(buildDirectory) || !existsSync(file)) return new Response("Not found", { status: 404 });
      return new Response(Bun.file(file), { headers: { "content-type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" } as Record<string, string>)[extname(file)] ?? "application/octet-stream" } });
    } });
    chrome = Bun.spawn([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore", windowsHide: true });
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let n = 0; n < 800; n += 1) {
      if (existsSync(portFile)) { try { port = (await readFile(portFile, "utf8")).split(/\r?\n/u)[0]?.trim() ?? ""; } catch { /* startup race */ } }
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error("Browser debugger unavailable");
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json() as { webSocketDebuggerUrl: string };
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((yes, no) => {
      const timeout = setTimeout(() => no(new Error("Debugger socket opening timed out")), 5_000);
      socket!.addEventListener("open", () => { clearTimeout(timeout); yes(); }, { once: true });
      socket!.addEventListener("error", () => { clearTimeout(timeout); no(new Error("Debugger socket unavailable")); }, { once: true });
    });
    let nextId = 0;
    const pending = new Map<number, (value: { id?: number; result?: unknown; error?: { message?: string } }) => void>();
    socket.addEventListener("message", (event) => { const item = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } }; if (item.id) { pending.get(item.id)?.(item); pending.delete(item.id); } });
    const send = (method: string, params: object = {}) => new Promise<unknown>((yes, no) => {
      const id = ++nextId;
      const timeout = setTimeout(() => { pending.delete(id); no(new Error(`Browser command ${method} timed out`)); }, 10_000);
      pending.set(id, (item) => {
        clearTimeout(timeout);
        if (item.error) no(new Error(item.error.message)); else yes(item.result);
      });
      socket!.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T> => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }) as { result?: { value?: T }; exceptionDetails?: { text?: string } };
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
      return result.result?.value as T;
    };
    const waitFor = async (expression: string) => {
      for (let n = 0; n < 200; n += 1) { if (await evaluate<boolean>(expression)) return; await Bun.sleep(50); }
      throw new Error(`Timed out: ${expression}; ${await evaluate<string>("document.body.innerText.slice(-1200)")}`);
    };
    const click = (label: string) => evaluate<void>(`(()=>{const item=[...document.querySelectorAll('button,label')].find(node=>node.textContent?.includes(${JSON.stringify(label)}));if(!item)throw Error('Missing ${label}');item.click()})()`);
    const setDeparture = (value: string) => evaluate<void>(`(()=>{const item=document.querySelector('.reservation-departure-change input[type="datetime-local"]');if(!item)throw Error('Missing departure input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(item,${JSON.stringify(value)});item.dispatchEvent(new Event('input',{bubbles:true}));item.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await send("Page.enable"); await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__calls=[];window.__errors=[];window.__scenario=new URL(location.href).searchParams.get('scenario')||'success';window.__to='2026-09-26T05:30:00.000Z';window.__patches=0;
      addEventListener('error',event=>window.__errors.push(String(event.message)));
      const property='${property}',reservation='${reservation}',segment='${segment}',party='67600000-0000-4000-8000-000000000003';
      const period=()=>({from:'2026-09-24T09:30:00.000Z',to:window.__to});
      const detail=()=>({actions:{canCancel:false,canManageAlerts:false,canModify:false,canOpenPrimaryFolio:false,canReinstate:false},reservation:{reservationId:reservation,primaryPartyId:party,confirmationNo:'Y-676',status:'in_house',bookerPartyId:null,groupId:null,channelCode:'DIRECT',marketCode:null,sourceCode:null,originCode:null,currency:'INR',guaranteePolicyId:null,eta:null,etd:null,notes:null,createdAt:'2026-09-24T00:00:00.000Z',cancelledAt:null,cancelReason:null,cancellationNo:null,guests:[{partyId:party,displayName:'Asha Rao',role:'primary',sharePct:null}],segments:[{segmentId:segment,sequence:1,unitTypeId:'67600000-0000-4000-8000-000000000004',sellableUnitId:'67600000-0000-4000-8000-000000000005',from:period().from.replace('.000Z','.000000Z'),to:period().to.replace('.000Z','.000000Z'),adults:1,childAges:[],ratePlanId:'67600000-0000-4000-8000-000000000006',priceOverride:null,status:'in_house'}],folios:[],alerts:[],travel:[],history:[]}});
      window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href),path=url.pathname,method=init.method||'GET';window.__calls.push({path,method,body:init.body||null,key:new Headers(init.headers||{}).get('idempotency-key')});let body,status=200;
        if(path.endsWith('/auth/demo:enter'))body={accessToken:'order676-token'};
        else if(path.endsWith('/me/properties'))body={properties:[{id:property,name:'Test property',timezone:'Asia/Kolkata'}]};
        else if(path.endsWith('/reservation-board'))body={reservations:[],nextCursor:null};
        else if(path.endsWith('/checkout-readiness'))body={ready:false,blockers:['unavailable'],reservationStatus:'in_house',room:null,folios:[]};
        else if(path.endsWith('/reservations/'+reservation)&&method==='GET')body=detail();
        else if(path.endsWith('/reservation-segments'))body={reservation:{reservationId:reservation,confirmationNo:'Y-676',status:'in_house',segments:[{segmentId:segment,sequence:1,status:'in_house',unitTypeId:'67600000-0000-4000-8000-000000000004',sellableUnitId:'67600000-0000-4000-8000-000000000005',period:period(),actions:{canChangeDeparture:window.__scenario!=='denial',canMoveRoom:true}}]}};
        else if(path.endsWith('/departure')&&method==='PATCH'){window.__patches++;if(window.__scenario==='uncertain'&&window.__patches===1)throw Error('reset');if(window.__scenario==='conflict'){status=409;body={detail:'occupancy conflict'};}else{const request=JSON.parse(init.body),before=period();window.__to=request.newDeparture;body={segment:{reservationId:reservation,segmentId:segment,beforePeriod:before,afterPeriod:period(),financialJournalId:null}};}}
        else{status=404;body={detail:'Unexpected mock route '+path};}
        return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
      };
    ` });
    const base = `http://127.0.0.1:${server.port}/p/${property}/res/${reservation}`;
    for (const scenario of ["denial", "conflict", "uncertain", "success"] as const) {
      await send("Page.navigate", { url: `${base}?scenario=${scenario}` });
      await waitFor("document.body.textContent.includes('Stay segments')");
      await click("Change departure");
      await waitFor("document.body.textContent.includes('Current departure:')");
      if (scenario === "denial") {
        expect(await evaluate<boolean>("document.body.textContent.includes('Departure changes are unavailable')")).toBe(true);
        expect(await evaluate<number>("window.__patches")).toBe(0);
        continue;
      }
      await setDeparture("2026-09-27T11:00");
      await click("I confirm this departure change");
      await click("Confirm departure change");
      if (scenario === "conflict") {
        await waitFor("document.body.textContent.includes('occupancy conflict')");
        expect(await evaluate<boolean>("!![...document.querySelectorAll('button')].find(item=>item.textContent?.includes('Refresh current stay'))")).toBe(true);
        expect(await evaluate<number>("window.__patches")).toBe(1);
      } else if (scenario === "uncertain") {
        await waitFor("document.body.textContent.includes('Retry exact request')");
        expect(await evaluate<boolean>("document.querySelector('.reservation-workspace .back-link').disabled")).toBe(true);
        await click("Retry exact request");
        await waitFor("document.body.textContent.includes('Departure changed. The refreshed reservation')");
        const writes = await evaluate<Array<{ body: string; key: string }>>("window.__calls.filter(item=>item.path.endsWith('/departure'))");
        expect(writes).toHaveLength(2);
        expect(writes[0]?.body).toBe(writes[1]?.body);
        expect(writes[0]?.key).toBe(writes[1]?.key);
      } else {
        await waitFor("document.body.textContent.includes('Departure changed. The refreshed reservation')");
        expect(await evaluate<number>("window.__patches")).toBe(1);
      }
      expect(await evaluate<string[]>("window.__errors")).toEqual([]);
    }
  } finally {
    socket?.close(); chrome?.kill(); if (chrome) await chrome.exited;
    server?.stop(true);
    const exactTemporary = resolve(temporary);
    const exactTempRoot = resolve(tmpdir());
    if (!exactTemporary.startsWith(`${exactTempRoot}${sep}`) ||
        !basename(exactTemporary).startsWith("yellow-order676-browser-")) {
      throw new Error("Order676 browser cleanup target is outside its owned temporary directory");
    }
    await rm(exactTemporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 120_000);
