import {expect,test} from "bun:test";
import {withHousekeepingAppBrowser,type HkAppBrowser} from "./housekeeping-task-app.browser.test";
const retained="sessionStorage.getItem('yellow.housekeeping.sent.v1')";
async function openHousekeepingInAssistant(browser:HkAppBrowser){
  // Actual pointer entry must be available after composing62; no focus/Space fallback.
  const bounds=await browser.read<{clickable:boolean;height:number}>("(()=>{const e=document.querySelector('.yellow-launch'),r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{clickable:h===e||e.contains(h),height:r.height}})()");
  expect(bounds.clickable).toBe(true);expect(bounds.height).toBeGreaterThanOrEqual(44);
  await browser.click("Ask Yellow");
  await browser.until("!!document.querySelector('[aria-label=\"Ask Yellow\"]')","pointer opened actual assistant input");
  const point=await browser.read<{x:number;y:number}>("(()=>{const e=document.querySelector('[aria-label=\"Ask Yellow\"]');e.scrollIntoView({block:'nearest',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);if(h!==e&&!e.contains(h))throw new Error('Composer occluded');return{x,y}})()");
  await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  await browser.send('Input.insertText',{text:'show housekeeping'});await browser.click('Send request to Yellow');
  await browser.until("!!document.querySelector('.yellow-inline-workspace')","current assistant housekeeping delegation");
}
test("order765 combined full App pointer delegates to one retained housekeeping command owner", async () => {
  await withHousekeepingAppBrowser("composed-pointer-owner", async browser => {
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
