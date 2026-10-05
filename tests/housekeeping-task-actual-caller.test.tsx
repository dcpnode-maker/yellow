import { expect, test } from "bun:test";
import { withHousekeepingBrowser } from "./housekeeping-task-workspace.browser.test";

test("lost verified caller retains frozen intent and replays before 404 pre-read across reload and navigation", async () => {
  await withHousekeepingBrowser("lost-verify", async browser => {
    await browser.navigate(process.env.YELLOW_HK_ORIGINAL === "1" ? 1440 : 375, "verify");
    await browser.read("history.replaceState({},'',location.pathname+'?view=old');history.pushState({},'',location.pathname+'?view=current')");
    await browser.select(); browser.mode("lose-until-reconcile"); await browser.confirm();
    await browser.until("!!document.querySelector('.hk-task-message') || !!document.querySelector('.housekeeping-grid .error')", "lost verify response");
    expect(browser.writes).toHaveLength(process.env.YELLOW_HK_ORIGINAL === "1" ? 2 : 1); expect(browser.writes[0]?.body).toContain('"action":"verify"');
    // This exact oracle deliberately fails against the original exported App caller.
    expect(await browser.read<boolean>("!!document.querySelector('.hk-task-confirm,.housekeeping-action-proposal')")).toBe(true);
    const original = browser.writes.at(-1)!;
    expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(0);
    expect(original.body).toContain('"action":"verify"');
    expect(await browser.read<boolean>("!window.dispatchEvent(new Event('beforeunload',{cancelable:true}))")).toBe(true);
    const href = await browser.read<string>("location.href");
    await browser.read("history.back()"); await browser.until(`location.href===${JSON.stringify(href)}`, "Back lock");
    await browser.read("history.forward()"); await Bun.sleep(100); expect(await browser.read<string>("location.href")).toBe(href);
    const beforeReload = await browser.read<string>("window.hkBootId");
    await browser.send("Page.reload"); await browser.until(`window.hkBootId!==${JSON.stringify(beforeReload)}&&!!document.querySelector('.hk-task-confirm')`, "reload retained command");
    expect(await browser.read<string>("sessionStorage.getItem('yellow.housekeeping.sent.v1')")).not.toMatch(/Bearer|synthetic-memory-only|password/);
    const boundary = browser.events.length;
    browser.mode("normal");
    await browser.click("I confirm reconciliation of this retained command."); await browser.click("Reconcile same request");
    await browser.until("!!document.querySelector('.hk-task-receipt')", "verified replay");
    expect(browser.writes.at(-1)).toEqual({ ...original, replay: true });
    expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(1);
    const events = browser.events.slice(boundary), write = events.findIndex(e => e.startsWith("POST "));
    expect(write).toBeGreaterThanOrEqual(0);
    expect(events.slice(0, write).some(e => e.includes("/housekeeping/tasks/"))).toBe(false);
    expect(await browser.read<string>("document.querySelector('.hk-task-receipt').innerText")).toContain("verified · inspected · native replay");
    expect(await browser.read<string | null>("sessionStorage.getItem('yellow.housekeeping.sent.v1')")).toBeNull();
    await browser.screenshot("settled-replay");
    await browser.read("history.back()"); await browser.until("location.search==='?view=old'", "settled Back accepted");
    await browser.read("history.forward()"); await browser.until(`location.href===${JSON.stringify(href)}`, "settled Forward accepted");
  });
}, 120000);

test("actual caller separates verified receipt from failed refresh and fences denied, foreign and stale responses", async () => {
  await withHousekeepingBrowser("fences", async browser => {
    await browser.navigate(1440, "complete"); await browser.select(); await browser.read("window.hkThrowCallback=true"); browser.mode("after-read-loss"); await browser.confirm();
    await browser.until("!!document.querySelector('.hk-task-receipt')&&!![...document.querySelectorAll('button')].find(b=>b.textContent==='Retry floor read')", "receipt despite read failure");
    const settledWrites = browser.writes.length; browser.mode("normal"); await browser.click("Retry floor read");
    expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(1);
    await browser.until("document.querySelector('.hk-task-receipt').textContent.includes('Current observed room condition: clean')", "read-only retry"); expect(browser.writes).toHaveLength(settledWrites);
    await browser.navigate(1440, "start"); await browser.select(); browser.mode("gate"); await browser.confirm();
    await browser.read("window.hkFixture.expire()"); browser.gate(); await browser.until("!!document.querySelector('.hk-task-locked')", "late response access lock");
    expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(0);
    await Bun.sleep(100); await browser.read("window.hkFixture.foreign();window.hkFixture.restoreProperty()");
    expect(await browser.read<boolean>("!!document.querySelector('.hk-task-locked')")).toBe(true);
    const gated = browser.writes.at(-1)!; await browser.read("window.hkFixture.restore()");
    await browser.until("!!document.querySelector('.hk-task-confirm')&&!document.querySelector('.hk-task-confirm input').disabled", "stale operation ownership cleared");
    await browser.read("window.hkFixture.property()"); await browser.until("!!document.querySelector('.hk-task-locked')", "property quarantine");
    await browser.read("window.hkFixture.restoreProperty()"); await browser.until("!!document.querySelector('.hk-task-confirm')", "original property returns");
    await browser.click("I confirm reconciliation of this retained command."); await browser.click("Reconcile same request");
    await browser.until("!!document.querySelector('.hk-task-receipt')", "late response exact replay"); expect(browser.writes.at(-1)).toEqual({ ...gated, replay: true });
    await browser.navigate(375, "verify"); await browser.select(); browser.mode("deny"); await browser.confirm();
    await browser.until("!!document.querySelector('.hk-task-locked')", "native role denial");
    expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(0);
    expect(await browser.read<string>("document.body.innerText")).not.toContain("101"); const denied = browser.writes.at(-1)!;
    browser.mode("normal"); await browser.read("window.hkFixture.restore()"); await browser.until("!!document.querySelector('.hk-task-confirm')", "same-principal role restoration");
    for (const denial of ["missing", "integrity", "unavailable"]) {
      const writeCount = browser.writes.length;
      browser.mode(denial); await browser.click("I confirm reconciliation of this retained command."); await browser.click("Reconcile same request");
      await browser.until(denial === "missing" ? "!!document.querySelector('.hk-task-locked')" :
        `document.querySelector('.hk-task-message')?.textContent.includes('(${denial === "integrity" ? "409" : "503"})')&&!document.querySelector('.hk-task-confirm input').disabled`, "native denial settled");
      expect(browser.writes).toHaveLength(writeCount + 1);
      expect(browser.writes.at(-1)?.key).toBe(denied.key); expect(browser.writes.at(-1)?.body).toBe(denied.body);
      expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(0);
      if (denial === "missing") { expect(await browser.read<boolean>("!!document.querySelector('.hk-task-locked')")).toBe(true); await browser.read("window.hkFixture.restore()"); }
      await browser.until("!!document.querySelector('.hk-task-confirm')", "unresolved same request retained");
    }
    browser.mode("normal"); await browser.click("I confirm reconciliation of this retained command."); await browser.click("Reconcile same request"); await browser.until("!!document.querySelector('.hk-task-receipt')", "native recovery");
    await browser.navigate(375, "verify"); await browser.select(); browser.mode("receipt-mismatch"); await browser.confirm();
    await browser.until("!!document.querySelector('.hk-task-confirm')&&!!document.querySelector('.hk-task-message')", "malformed receipt retained");
    expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(0);
    const malformed = browser.writes.at(-1)!; browser.mode("normal");
    await browser.click("I confirm reconciliation of this retained command."); await browser.click("Reconcile same request");
    await browser.until("!!document.querySelector('.hk-task-receipt')", "malformed result reconciled");
    expect(browser.writes.at(-1)).toEqual({ ...malformed, replay: true }); expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(1);
    await browser.navigate(1440, "start"); await browser.select(); browser.mode("gate"); await browser.confirm();
    const beforeUnmount = browser.writes.length; await browser.read("window.hkFixture.unmount()"); browser.gate(); await Bun.sleep(100);
    expect(browser.writes).toHaveLength(beforeUnmount); expect(await browser.read<number>("window.hkFixture.verified.length")).toBe(0);
    expect(await browser.read<string>("document.body.innerText")).toContain("Caller unmounted");
    expect(await browser.read<string | null>("sessionStorage.getItem('yellow.housekeeping.sent.v1')")).not.toBeNull();
    // Test-only legacy scenario does not authorize a product clear/replacement operation.
    await browser.read("sessionStorage.setItem('yellow.housekeeping.sent.v1','legacy-invalid')"); await browser.send("Page.reload");
    await browser.until("!!document.querySelector('.hk-task-locked')", "legacy quarantine"); expect(await browser.read<string>("document.body.innerText")).not.toContain("101");
  });
}, 120000);
