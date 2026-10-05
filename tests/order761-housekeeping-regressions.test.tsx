import { expect, test } from "bun:test";
import { withHousekeepingAppBrowser, type HkAppBrowser } from "./housekeeping-task-app.browser.test";
const retained = "sessionStorage.getItem('yellow.housekeeping.sent.v1')";
async function assertConfirmationBounds(browser: HkAppBrowser, label: string) {
  const bounds=await browser.read<{safe:boolean;targetSizes:boolean}>("(()=>{const box=document.querySelector('.hk-task-confirm').getBoundingClientRect(),rectangles=[...document.querySelectorAll('.hk-task-confirm p,.hk-task-confirm label,.hk-task-confirm button')].flatMap(e=>{const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()].map(x=>({left:x.left,right:x.right,width:x.width}))}),controls=[...document.querySelectorAll('.hk-task-confirm button,.hk-task-confirm label,.hk-task-confirm input')].map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,left:r.left,right:r.right,width:r.width,height:r.height}});return{safe:box.width>0&&box.left>=0&&box.right<=innerWidth+1&&rectangles.length>0&&rectangles.every(x=>x.left>=box.left-1&&x.right<=box.right+1)&&controls.every(x=>x.width>0&&x.left>=box.left-1&&x.right<=box.right+1),targetSizes:controls.filter(x=>x.tag!=='INPUT').every(x=>x.height>=44),card:{left:box.left,right:box.right,width:box.width},viewport:innerWidth,rectangles,controls}})()");
  browser.events.push(label+" "+JSON.stringify(bounds));
  expect(bounds.safe,"Card, rendered text, and controls must fit their visible horizontal bounds").toBe(true);
  expect(bounds.targetSizes,"Buttons and checkbox labels retain 44px targets").toBe(true);
}
async function openHousekeepingInAssistant(browser: HkAppBrowser) {
  await browser.read("document.querySelector('.yellow-launch').focus()");
  await browser.send("Input.dispatchKeyEvent", {type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32,text:" "});
  await browser.send("Input.dispatchKeyEvent", {type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
  await browser.until("!!document.querySelector('[aria-label=\"Ask Yellow\"]')", "real assistant input");
  await browser.read("document.querySelector('[aria-label=\"Ask Yellow\"]').focus()");
  await browser.send("Input.insertText", {text:"show housekeeping"});
  await browser.click("Send request to Yellow");
  await browser.until("!!document.querySelector('.yellow-inline-workspace')", "actual current assistant housekeeping entry");
}
test("order761 current full App excludes competing dedicated and assistant housekeeping command owners before dispatch", async () => {
  await withHousekeepingAppBrowser("owner", async browser => {
    await browser.navigate(1440,"verify");
    await browser.read("window.hkOwnerNode=document.querySelector('.hk-task-workspace');true");
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length")).toBe(1);
    await openHousekeepingInAssistant(browser);
    const delegationBounds=await browser.read<{height:number;width:number}>("(()=>{const r=document.querySelector('[aria-label=\"Current housekeeping workspace\"] button').getBoundingClientRect();return{height:r.height,width:r.width}})()");
    browser.events.push("CURRENT_OWNER_TARGET "+JSON.stringify(delegationBounds));
    expect(delegationBounds.height,"The new current-owner delegation action needs a 44px target").toBeGreaterThanOrEqual(44);
    expect(delegationBounds.width).toBeGreaterThanOrEqual(44);
    await browser.screenshot("dedicated-and-assistant-before-dispatch");
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length"), "Dedicated and assistant entry must share one writable command owner before any request").toBe(1);
    expect(browser.writes).toHaveLength(0);
    await browser.click("Use current housekeeping workspace");
    expect(await browser.read<boolean>("document.querySelector('.hk-task-workspace')===window.hkOwnerNode")).toBe(true);
    expect(await browser.read<boolean>("document.activeElement===document.querySelector('.hk-task-workspace h1')")).toBe(true);
    if(await browser.read<boolean>("!!document.querySelector('[aria-label=\"Collapse navigation\"]')")) await browser.click("Collapse navigation");
    await browser.select(); browser.mode("lose-until-reconcile"); await browser.confirm();
    await browser.until("document.body.innerText.includes('response was interrupted')", "retained sent owner");
    const saved=await browser.read<string>(retained), first={...browser.writes[0]!}; expect(saved).toBeTruthy();
    expect(browser.writes).toHaveLength(1);
    expect(await browser.read<boolean>("!!document.querySelector('.yellow-next[aria-busy=true]')")).toBe(true);
    // Real keyboard duplicate-entry attempt during unresolved sent intent is
    // stopped by the unchanged shell capture guard, without a second owner.
    await browser.read("document.querySelector('.yellow-launch').focus()");
    await browser.send("Input.dispatchKeyEvent", {type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32,text:" "});
    await browser.send("Input.dispatchKeyEvent", {type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
    expect(await browser.read<boolean>("!!document.querySelector('[aria-label=\"Ask Yellow\"]')")).toBe(false);
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length")).toBe(1);
    expect(await browser.read<string | null>(retained)).toBe(saved); expect(browser.writes).toHaveLength(1);
    await browser.read("window.hkFixture.expire()");
    await browser.until("!!document.querySelector('.auth-workspace[inert]')", "expired session retains owner and lock");
    expect(await browser.read<string | null>(retained)).toBe(saved);
    await browser.read("window.hkFixture.restore()");
    await browser.until("!!document.querySelector('.hk-task-confirm')&&!document.querySelector('.auth-workspace[inert]')", "renewed original owner");
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length")).toBe(1);
    expect(await browser.read<boolean>("document.querySelector('.hk-task-workspace')===window.hkOwnerNode")).toBe(true);
    expect(await browser.read<string | null>(retained)).toBe(saved);
    expect(await browser.read<boolean>("!!document.querySelector('.yellow-next[aria-busy=true]')")).toBe(true);
    expect(browser.writes).toHaveLength(1);
    browser.mode("normal");
    await browser.read("window.hkThrowInvalidation=true;window.hkRejectInvalidation=true;true");
    await browser.click("I confirm reconciliation of this retained command."); await browser.click("Reconcile same request");
    await browser.until("!!document.querySelector('.hk-task-receipt')", "one exact owner settles verified replay");
    expect(browser.writes).toHaveLength(2); expect(browser.writes[1]).toMatchObject({key:first.key,body:first.body,path:first.path,replay:true});
    expect(await browser.read<string | null>(retained)).toBeNull();
    await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')", "accepted receipt releases lifecycle");
    expect(await browser.read<string[][]>("window.hkFixture.invalidations.map(x=>x.queryKey)")).toEqual([["overwatch-arrival-cleaning","00000000-0000-4000-8000-000000000001"],["overwatch-check-in","00000000-0000-4000-8000-000000000001"]]);
    await browser.screenshot("single-owner-reconciled");
  });
},70000);

test("order761 current full App 320px floor drawer retains readable doubled-text keyboard confirmation",async()=>{
  await withHousekeepingAppBrowser("mobile320",async browser=>{
    await browser.navigate(320,"complete"); await browser.select();
    expect(await browser.read<number>("document.querySelectorAll('.hk-floor-workbench').length")).toBe(1);
    expect(await browser.read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1);
    await assertConfirmationBounds(browser,"BOUNDS_320_NORMAL");
    await browser.read("[...document.querySelectorAll('.hk-task-workspace, .hk-task-workspace *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)*2]).forEach(([e,size])=>e.style.fontSize=size+'px')");
    expect(await browser.read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1);
    expect(await browser.read<boolean>("document.querySelector('.hk-floor-drawer').getBoundingClientRect().width>0")).toBe(true);
    const textBounds=await browser.read<{safe:boolean;rectangles:{left:number;right:number;width:number}[]}>("(()=>{const box=document.querySelector('.hk-task-confirm').getBoundingClientRect(),rectangles=[...document.querySelectorAll('.hk-task-confirm p,.hk-task-confirm label')].flatMap(e=>{const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()].map(x=>({left:x.left,right:x.right,width:x.width}))});return{safe:box.left>=0&&box.right<=innerWidth+1&&rectangles.every(x=>x.left>=box.left&&x.right<=box.right),card:{left:box.left,right:box.right,width:box.width},viewport:innerWidth,rectangles}})()");
    browser.events.push("MOBILE_TEXT_BOUNDS "+JSON.stringify(textBounds));
    expect(textBounds.safe,"Doubled-text confirmation must keep all text inside its visible card, independently of page overflow clipping").toBe(true);
    await assertConfirmationBounds(browser,"BOUNDS_320_DOUBLED");
    expect(await browser.read<boolean>("[...document.querySelectorAll('.hk-task-confirm button,.hk-task-confirm label')].every(e=>e.getBoundingClientRect().height>=44)")).toBe(true);
    await browser.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
    await browser.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
    expect(await browser.read<boolean>("document.activeElement!==document.body")).toBe(true);
    await browser.screenshot("doubled-text-unsent"); expect(browser.writes).toHaveLength(0);
    await browser.confirm(); await browser.until("!!document.querySelector('.hk-task-receipt')", "complete is a clean declaration, not inspection");
    expect(await browser.read<string>("document.querySelector('.hk-task-receipt').innerText")).toContain("done · clean");
    expect(await browser.read<string>("document.querySelector('.hk-task-receipt').innerText")).not.toContain("inspected");
    expect(browser.writes).toHaveLength(1); await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')", "native-shaped receipt settled");
    await browser.screenshot("clean-receipt");
  });
},70000);

for(const width of [375,1440]) test(`order761 current full App confirmation card text and controls fit ${width}px`,async()=>{
  await withHousekeepingAppBrowser(`bounds${width}`,async browser=>{
    await browser.navigate(width,"complete");
    if(width===1440&&await browser.read<boolean>("!!document.querySelector('[aria-label=\"Collapse navigation\"]')")) await browser.click("Collapse navigation");
    await browser.select(); await assertConfirmationBounds(browser,`BOUNDS_${width}_NORMAL`);
    expect(browser.writes).toHaveLength(0); await browser.screenshot("normal-unsent-bounds");
  });
},70000);

for (const context of ["renewal", "grant-removal", "property"] as const) test(`order761 actual full App rejects completed receipt body after ${context}`,async()=>{
  await withHousekeepingAppBrowser(`body-${context}`,async browser=>{
    await browser.navigate(1440,"verify"); await browser.select(); browser.mode("gate-body"); await browser.confirm();
    await browser.until("window.hkBodyHeadersReceived===1", "actual response headers arrived before held JSON body completion");
    expect(browser.events).toContain("BODY_START"); expect(browser.events).not.toContain("BODY_COMPLETE");
    expect(browser.writes).toHaveLength(1); const first={...browser.writes[0]!},saved=await browser.read<string>(retained);expect(saved).toBeTruthy();
    await browser.read("document.querySelector('.yellow-launch').focus()");
    await browser.send("Input.dispatchKeyEvent", {type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32,text:" "});
    await browser.send("Input.dispatchKeyEvent", {type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
    expect(await browser.read<boolean>("!!document.querySelector('[aria-label=\"Ask Yellow\"]')")).toBe(false);
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length")).toBe(1);
    expect(browser.writes).toHaveLength(1);
    if (context === "property") {
      const origin=await browser.read<string>("location.origin"),boot=await browser.read<string>("window.hkBootId");
      await browser.send("Page.navigate", {url:`${origin}/p/00000000-0000-4000-8000-000000000006/housekeeping`});
      await browser.until(`window.hkBootId!==${JSON.stringify(boot)}&&!!document.querySelector('.hk-task-locked')`, "foreign property cannot adopt sent command");
    } else {
      await browser.read("window.hkFixture.expire()"); await browser.until("!!document.querySelector('.auth-workspace[inert]')", "auth gate locks old owner");
      if(context === "grant-removal") {
        browser.mode("revoked");
        expect(await browser.read<boolean>("window.hkFixture.restore().then(()=>false,error=>error.message==='Property access is unavailable.')")).toBe(true);
      } else await browser.read("window.hkFixture.restore()");
      await browser.until(context === "renewal" ? "!!document.querySelector('.hk-task-confirm')&&!document.querySelector('.auth-workspace[inert]')" : "!!document.querySelector('.auth-workspace[inert]')||!!document.querySelector('.hk-task-locked')", "replacement current auth/grant context");
    }
    browser.gate(); await Bun.sleep(100);expect(browser.events).toContain("BODY_COMPLETE");
    expect(await browser.read<boolean>("!!document.querySelector('.hk-task-receipt')")).toBe(false);
    expect(await browser.read<string | null>(retained)).toBe(saved);
    expect(await browser.read<unknown[]>("window.hkFixture.invalidations")).toEqual([]); expect(browser.writes).toHaveLength(1);
    expect(browser.writes[0]).toMatchObject({key:first.key,body:first.body,path:first.path});
    await browser.screenshot("completed-old-body-suppressed");
  });
},70000);

for(const [mode,status] of [["unauthenticated",401],["deny",403],["missing",404],["integrity",409],["failure",500],["unavailable",503]] as const) test(`order761 current full App retains exact sent intent across native HTTP ${status}`,async()=>{
  await withHousekeepingAppBrowser(`http${status}`,async browser=>{
    await browser.navigate(1440,"verify");await browser.select();browser.mode("lose");await browser.confirm();
    await browser.until("document.body.innerText.includes('response was interrupted')", "unknown committed verify before denial");
    const saved=await browser.read<string>(retained),first={...browser.writes[0]!};expect(saved).toBeTruthy();
    const before=browser.events.length;browser.mode(mode);
    await browser.click("I confirm reconciliation of this retained command.");await browser.click("Reconcile same request");
    await browser.until(`!!document.querySelector('.hk-task-locked')||document.querySelector('.hk-task-message')?.textContent.includes('(${status})')`, "native denial/unavailable result retained");
    expect(browser.writes).toHaveLength(2);expect(browser.writes[1]).toMatchObject({key:first.key,body:first.body,path:first.path});
    expect(browser.events.slice(before).some(event=>event===`GET ${first.path.replace('/transition','')}`)).toBe(false);
    expect(await browser.read<string | null>(retained)).toBe(saved);
    expect(await browser.read<unknown[]>("window.hkFixture.invalidations")).toEqual([]);
    expect(await browser.read<boolean>("!!document.querySelector('.hk-task-receipt')")).toBe(false);
    if(status===401||status===403||status===404) expect(await browser.read<string>("document.querySelector('.hk-task-workspace').innerText")).not.toContain("Room 101");
    browser.mode("normal");await browser.read("window.hkFixture.restore()");
    await browser.until("!!document.querySelector('.hk-task-confirm')", "fresh current session can reconcile same command");
    await browser.click("I confirm reconciliation of this retained command.");await browser.click("Reconcile same request");
    await browser.until("!!document.querySelector('.hk-task-receipt')", "original exact replay receipt after denial");
    expect(browser.writes).toHaveLength(3);expect(browser.writes[2]).toMatchObject({key:first.key,body:first.body,path:first.path,replay:true});
    expect(await browser.read<string | null>(retained)).toBeNull();
    await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')", "accepted replay unlocks lifecycle");
    await browser.screenshot("same-owner-recovered");
  });
},70000);

test("order761 current full App records shell overlap geometry separately from housekeeping recovery acceptance",async()=>{
  await withHousekeepingAppBrowser("geometry",async browser=>{
    await browser.navigate(1440,"complete");await browser.click("All workspaces");await browser.until("location.search.includes('workspace=ecosystem')", "actual ecosystem");
    const launcher=await browser.read<{occluded:boolean;hit:string}>("(()=>{const e=document.querySelector('.yellow-launch'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{occluded:hit!==e&&!e.contains(hit),hit:hit?.closest('.auth-session-control')?.className??hit?.className??''}})()");
    browser.events.push("GEOMETRY_LAUNCHER "+JSON.stringify(launcher));await browser.screenshot("launcher-diagnostic");
    await openHousekeepingInAssistant(browser);await browser.until("!!document.querySelector('.yellow-inline-workspace .hk-floor-cube')", "actual inline owner");
    const navigation=await browser.read<{overlap:number;hit:string}>("(()=>{const p=document.querySelector('.yellow-inline-workspace').getBoundingClientRect(),n=document.querySelector('.operator-navigation').getBoundingClientRect(),x=Math.max(p.left,n.left)+5,y=Math.max(p.top,n.top)+10,hit=document.elementFromPoint(x,y);return{overlap:Math.max(0,Math.min(p.right,n.right)-Math.max(p.left,n.left)),hit:hit?.closest('.operator-navigation')?.className??''}})()");
    browser.events.push("GEOMETRY_NAVIGATION "+JSON.stringify(navigation));await browser.screenshot("navigation-diagnostic");
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length")).toBe(1);expect(browser.writes).toHaveLength(0);
    // Measurements are diagnostic facts, not assertions that shell overlap is repaired.
  });
},70000);
