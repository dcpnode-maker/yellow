import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const repository = resolve(import.meta.dir, "..");
const browser = [process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("chromium"), Bun.which("google-chrome")].find((path): path is string => Boolean(path && existsSync(path)));
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const route = `/p/${id(2)}/invoices`;
const interfaceChoices = ["ledger", "aura", "relay", "journey", "orbit", "atlas", "focus", "index"] as const;
const workspaceGroups = ["front-desk", "finance", "operations", "revenue", "system"] as const;
const prototypeNumbers = { ledger: "03", aura: "04", relay: "05", journey: "06", orbit: "07", atlas: "08", focus: "09", index: "10" } as const;

// An explicitly synthetic HTTP fixture exercises the real authenticated shell,
// not a replacement dashboard. It is never served by the founder review runtime.
const documentValue = { kind: "india_native_invoice_v1", documentId: id(10), propertyNode: id(2),
  reservationId: id(4), folioId: id(5), seriesId: id(7), documentNumber: "INV/STUDY/17",
  businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z", recipientRegistrationId: id(6),
  sourceEvidenceHash: "a".repeat(64), documentSha256: "b".repeat(64), previousHash: null,
  contentJson: JSON.stringify({ Version: "1.1", TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: "INV/STUDY/17", Dt: "06/09/2044" },
    SellerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Fictional Yellow Hotel", Addr1: "1 Test Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: "27AAPFU0939F1ZV", LglNm: "Fictional River Guest", Addr1: "1 Test Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH", UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00", IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" } }),
};
const todayRows = {
  due_in: { reservationId: id(21), confirmationNo: "ARR-STUDY-21", primaryGuestDisplayName: "Fictional Arrival Guest",
    status: "due_in",
    sellableUnitLabel: "Room 203", unitTypeLabel: "King", ratePlanLabel: "Flexible", adults: 2, children: 0, channelCode: "DIRECT" },
  due_out: { reservationId: id(22), confirmationNo: "DEP-STUDY-22", primaryGuestDisplayName: "Fictional Departure Guest",
    status: "due_out",
    sellableUnitLabel: "Room 118", unitTypeLabel: "Twin", ratePlanLabel: "Member", adults: 1, children: 1, channelCode: "DIRECT" },
  in_house: { reservationId: id(23), confirmationNo: "STAY-STUDY-23", primaryGuestDisplayName: "Fictional In-house Guest",
    status: "in_house",
    sellableUnitLabel: "Room 311", unitTypeLabel: "Suite", ratePlanLabel: "Corporate", adults: 2, children: 1, channelCode: "DIRECT" },
} as const;

function todayRowForWindow(status: keyof typeof todayRows, requestUrl: URL) {
  const from = Date.parse(requestUrl.searchParams.get("from") ?? "");
  const to = Date.parse(requestUrl.searchParams.get("to") ?? "");
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new Error("Synthetic Today request has invalid bounds");
  const day = to - from;
  const stay: readonly [number, number] = status === "due_in" ? [from + day * 0.375, to + day * 2]
    : status === "due_out" ? [from - day * 3, from + day * 0.5]
    : [from - day, to + day * 2];
  return { ...todayRows[status], stayFrom: new Date(stay[0]).toISOString(), stayTo: new Date(stay[1]).toISOString() };
}

type CdpSend = <Result>(method: string, params?: Record<string, unknown>) => Promise<Result>;

function transientPortRead(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code));
}

async function withOwnedCdp<Result>(
  profile: string,
  run: (send: CdpSend, runtimeErrors: string[]) => Promise<Result>,
): Promise<Result> {
  if (!browser) throw new Error("Chrome or Chromium is required for the actual workspace layout proof");
  const chrome = Bun.spawn([
    browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | null = null;
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try {
        if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? "";
      } catch (error) {
        if (!transientPortRead(error)) throw error;
      }
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${chrome.exitCode ?? "unknown"})`);
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Chromium target creation failed (${targetResponse.status})`);
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    let commandId = 0;
    const runtimeErrors: string[] = [];
    const pending = new Map<number, {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }>();
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Chromium debugger socket did not open")), 5_000);
      socket?.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket?.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("Chromium debugger socket failed")); }, { once: true });
    });
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as {
        id?: number; result?: unknown; error?: { message?: string }; method?: string;
        params?: { type?: string; args?: Array<{ value?: unknown; description?: string }>; exceptionDetails?: { text?: string; exception?: { description?: string } } };
      };
      if (message.method === "Runtime.exceptionThrown") {
        runtimeErrors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? "Runtime exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && ["error", "assert"].includes(message.params?.type ?? "")) {
        runtimeErrors.push((message.params?.args ?? []).map(argument => String(argument.value ?? argument.description ?? "")).join(" "));
      }
      if (!message.id) return;
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id);
      clearTimeout(command.timer);
      if (message.error) command.reject(new Error(message.error.message ?? "Chromium command failed"));
      else command.resolve(message.result);
    });
    const send: CdpSend = <CommandResult>(method: string, params: Record<string, unknown> = {}) => new Promise<CommandResult>((resolveCommand, rejectCommand) => {
      commandId += 1;
      const id = commandId;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectCommand(new Error(`Chromium command timed out: ${method}`));
      }, 5_000);
      pending.set(id, { resolve: value => resolveCommand(value as CommandResult), reject: rejectCommand, timer });
      socket?.send(JSON.stringify({ id, method, params }));
    });
    try {
      return await run(send, runtimeErrors);
    } finally {
      for (const command of pending.values()) {
        clearTimeout(command.timer);
        command.reject(new Error("Chromium debugger closed with a command pending"));
      }
      pending.clear();
    }
  } finally {
    socket?.close();
    if (chrome.exitCode === null) chrome.kill();
    await chrome.exited;
  }
}

function driver(skin: string, fontExpected: boolean): string {
  return `<pre id="layout-proof" hidden></pre><script type="module">
  const finish=value=>document.querySelector('#layout-proof').textContent=JSON.stringify(value);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(predicate,label)=>{for(let i=0;i<200;i++){if(predicate())return;await sleep(20)}throw new Error('Timed out: '+label)};
  const settleFiniteAnimations=async(label)=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const running=()=>document.getAnimations({subtree:true}).filter(animation=>{const iterations=animation.effect?.getComputedTiming().iterations;
      return iterations!==Infinity&&(animation.playState==='running'||animation.playState==='pending')});
    await until(()=>running().length===0,label)};
  const colorCanvas=document.createElement('canvas');colorCanvas.width=1;colorCanvas.height=1;const colorContext=colorCanvas.getContext('2d',{willReadFrequently:true});
  const rgba=value=>{if(!value||!colorContext)return null;colorContext.clearRect(0,0,1,1);colorContext.fillStyle=value;colorContext.fillRect(0,0,1,1);
    const pixel=colorContext.getImageData(0,0,1,1).data;return[pixel[0],pixel[1],pixel[2],pixel[3]/255]};
  const luminance=color=>{const channels=color.slice(0,3).map(value=>{const unit=value/255;return unit<=.04045?unit/12.92:Math.pow((unit+.055)/1.055,2.4)});return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]};
  const contrast=(foreground,background)=>{const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  const composite=(front,back)=>{const alpha=front[3]+back[3]*(1-front[3]);return alpha===0?[0,0,0,0]:[
    (front[0]*front[3]+back[0]*back[3]*(1-front[3]))/alpha,(front[1]*front[3]+back[1]*back[3]*(1-front[3]))/alpha,
    (front[2]*front[3]+back[2]*back[3]*(1-front[3]))/alpha,alpha]};
  const backdrop=element=>{const layers=[];for(let node=element;node;node=node.parentElement){const color=rgba(getComputedStyle(node).backgroundColor);if(color)layers.push(color)}
    let resolved=[255,255,255,1];for(let index=layers.length-1;index>=0;index-=1)resolved=composite(layers[index],resolved);return resolved};
  try {
    let loadedFontFaces=[],fontLoadError=null;
    try{loadedFontFaces=await document.fonts.load('400 16px Urbanist')}catch(error){fontLoadError=String(error?.name||error)}
    if(${String(fontExpected)}&&!loadedFontFaces.length)throw new Error('Urbanist font did not load');
    const form=document.querySelector('#login-form');
    await until(()=>!form.querySelector('button[type=submit]').disabled,'login ready');
    form.elements.tenant.value='synthetic';form.elements.email.value='synthetic@example.test';form.elements.password.value='fictional-only';form.requestSubmit();
    await until(()=>document.querySelector('.invoice-workbench__queue-item'),'real invoice queue');
    document.querySelector('.invoice-workbench__queue-item').click();
    await until(()=>document.querySelector('.invoice-workbench__detail')?.textContent.includes('INV/STUDY/17'),'real invoice detail');
    const audit=document.querySelector('.invoice-workbench__audit');
    if(!audit)throw new Error('Document verification disclosure is missing');
    const auditProof={closedInitially:!audit.open,tag:audit.tagName,
      label:audit.querySelector('summary')?.textContent,
      documentHash:audit.textContent.includes('b'.repeat(64)),sourceHash:audit.textContent.includes('a'.repeat(64)),
      reservation:audit.textContent.includes(${JSON.stringify(id(4))}),folio:audit.textContent.includes(${JSON.stringify(id(5))}),
      identityOutsideAudit:!audit.contains(document.querySelector('.invoice-workbench__detail-heading')),
      date:document.querySelector('.invoice-workbench__identity-date')?.getAttribute('datetime')};
    audit.querySelector('summary').click();
    const query=document.querySelector('.invoice-workbench__query');
    query.value='Unsubmitted guest filter';query.setSelectionRange(2,9);
    const focusedControl=innerWidth<=1020?document.querySelector('.invoice-workbench__print'):query;
    focusedControl.focus();
    await until(()=>document.documentElement.dataset.layoutController==='ready','layout controller ready');
    const groups=[...document.querySelectorAll('.workspace-group')];
    const picker=document.querySelector('#workspace-skin-select'),pickerReference=picker;
    const workspaceNavigation=document.querySelector('#workspace-navigation');
    const navigationOpenBefore=workspaceNavigation.open;
    const groupOpenBefore=groups.map(group=>group.open);
    const groupedNavigation={keys:groups.map(group=>group.dataset.workspaceGroup),
      counts:groups.map(group=>group.querySelectorAll(':scope > .workspace-group-items > button[data-view]').length),
      summaries:groups.map(group=>group.querySelector(':scope > summary')?.textContent?.replace(/\\s+/g,' ').trim()),
      financeOpen:document.querySelector('[data-workspace-group="finance"]')?.open===true,
      current:groups.filter(group=>group.classList.contains('contains-current')).map(group=>group.dataset.workspaceGroup),
      active:[...document.querySelectorAll('button[data-view].is-active')].map(button=>button.dataset.view),
      outerTag:workspaceNavigation.tagName,outerOpen:navigationOpenBefore,currentLabel:document.querySelector('#workspace-navigation-current')?.textContent,
      legacyRemoved:!document.querySelector('#secondary-workspaces,#secondary-workspaces-toggle')};
    let disclosureModes;
    if(innerWidth>1020){
      const finance=groups.find(group=>group.dataset.workspaceGroup==='finance'),property=groups.find(group=>group.dataset.workspaceGroup==='operations');
      picker.value='ledger';picker.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>groups.every(group=>group.getAttribute('name')==='ledger-workspace-rail'),'Ledger native disclosure names');
      finance.open=false;property.open=false;finance.querySelector(':scope > summary').click();
      const financeOpened=finance.open&&!property.open;
      property.querySelector(':scope > summary').click();
      const propertyOpened=property.open&&!finance.open;
      const propertySummary=property.querySelector(':scope > summary');propertySummary.focus();
      propertySummary.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      const ledger={names:groups.map(group=>group.getAttribute('name')),financeOpened,propertyOpened,
        escapeClosed:!property.open,escapeFocus:document.activeElement===propertySummary};
      picker.value='aura';picker.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>groups.every(group=>!group.hasAttribute('name')),'non-Ledger independent disclosures');
      finance.open=false;property.open=false;finance.querySelector(':scope > summary').click();property.querySelector(':scope > summary').click();
      const ordinary={names:groups.map(group=>group.getAttribute('name')),financeOpen:finance.open,propertyOpen:property.open};
      disclosureModes={ledger,ordinary};
      picker.value='ledger';picker.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>document.documentElement.dataset.workspaceSkin==='ledger'&&document.querySelector('#workbench-view').dataset.layoutSkin==='ledger',
        'restored Ledger presentation');
      await settleFiniteAnimations('settled Ledger presentation');
    }else{
      disclosureModes={compactNames:groups.map(group=>group.getAttribute('name'))};
    }
    workspaceNavigation.open=true;
    const iconProof=[];
    for(const group of groups){
      for(const candidate of groups)candidate.open=candidate===group;
      const buttons=[...group.querySelectorAll(':scope > .workspace-group-items > button[data-view]')];
      await until(()=>buttons.every(button=>{const icon=button.querySelector('svg');try{return icon.getBBox().width>0&&icon.getBBox().height>0}catch{return false}}),'Phosphor symbols');
      for(const button of buttons){
        button.focus();await settleFiniteAnimations('settled '+button.id+' focus');
        const icon=button.querySelector('svg'),use=icon.querySelector('use'),box=icon.getBoundingClientRect(),shape=icon.getBBox(),style=getComputedStyle(icon),buttonStyle=getComputedStyle(button),foreground=rgba(style.color),background=backdrop(button);
        const backgroundChain=[];for(let node=button;node;node=node.parentElement)backgroundChain.push({tag:node.tagName,id:node.id,
          classes:node.className,background:getComputedStyle(node).backgroundColor});
        iconProof.push({id:button.id,label:button.querySelector('span')?.textContent?.trim(),href:use?.getAttribute('href'),target:button.getBoundingClientRect().height,
          box:[box.width,box.height],shape:[shape.width,shape.height],fill:style.fill,color:style.color,background:background.slice(0,3).map(value=>Math.round(value)),
          buttonColor:buttonStyle.color,buttonBackground:buttonStyle.backgroundColor,borderColor:buttonStyle.borderColor,
          backgroundChain,classes:button.className,active:button.classList.contains('is-active'),focusVisible:button.matches(':focus-visible'),
          contrast:foreground?contrast(foreground,background):0,skin:document.documentElement.dataset.workspaceSkin,
          visible:style.visibility==='visible',focus:document.activeElement===button});
      }
    }
    const groupSummaryProof=groups.map(group=>{const summary=group.querySelector(':scope > summary'),style=getComputedStyle(summary),foreground=rgba(style.color),background=backdrop(summary),box=summary.getBoundingClientRect();
      return{group:group.dataset.workspaceGroup,visible:summary.getClientRects().length>0,height:box.height,color:style.color,
        background:background.slice(0,3).map(value=>Math.round(value)),contrast:foreground?contrast(foreground,background):0}});
    groups.forEach((group,index)=>{group.open=groupOpenBefore[index]});workspaceNavigation.open=navigationOpenBefore;focusedControl.focus();
    const mount=document.querySelector('#invoices-mount'),detail=document.querySelector('.invoice-workbench__detail');
    const propertySelect=document.querySelector('#property-select'),propertyReference=propertySelect;
    const hiddenControls=[...document.querySelectorAll('[hidden]')];
    const before={route:location.pathname,property:propertySelect.value,calls:performance.getEntriesByType('resource').length};
    const galleryOpen=document.querySelector('#interface-gallery-open'),gallery=document.querySelector('#interface-gallery');
    const galleryClose=document.querySelector('#interface-gallery-close'),relayChoice=gallery.querySelector('[data-interface-choice="relay"]');
    const depthControl=document.querySelector('#interface-depth-play');
    galleryOpen.focus();galleryOpen.click();await until(()=>gallery.open,'interface gallery open');
    const galleryFocus=gallery.contains(document.activeElement),galleryCalls=performance.getEntriesByType('resource').length;
    const mediaReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const activeChoice=gallery.querySelector('[aria-pressed="true"]'),miniature=activeChoice.querySelector('.interface-miniature');
    const depthLayer=activeChoice.querySelector('.mini-panel-two'),depthBefore=depthLayer.getBoundingClientRect();
    let depthProof={disabled:depthControl.disabled,root:document.documentElement.dataset.interfaceMotion};
    if(!mediaReduced){
      depthControl.click();
      let depthAfter,miniatureOverflow='',miniatureTransformStyle='',layerTransform='',translateZ=0,boundsChanged=false;
      await until(()=>{
        depthAfter=depthLayer.getBoundingClientRect();
        const miniatureStyle=getComputedStyle(miniature),layerStyle=getComputedStyle(depthLayer);
        miniatureOverflow=miniatureStyle.overflow;miniatureTransformStyle=miniatureStyle.transformStyle;
        layerTransform=layerStyle.transform;
        const matrix=layerTransform.startsWith('matrix3d')
          ?layerTransform.slice(layerTransform.indexOf('(')+1,-1).split(',').map(Number):[];
        translateZ=matrix[14]||0;
        boundsChanged=Math.abs(depthBefore.x-depthAfter.x)>.01||Math.abs(depthBefore.y-depthAfter.y)>.01||
          Math.abs(depthBefore.width-depthAfter.width)>.01||Math.abs(depthBefore.height-depthAfter.height)>.01;
        return gallery.dataset.exploded==='true'&&layerTransform.startsWith('matrix3d')&&translateZ>0&&boundsChanged;
      },'computed projected interface depth');
      depthProof={...depthProof,exploded:gallery.dataset.exploded,overflow:miniatureOverflow,
        transformStyle:miniatureTransformStyle,layerTransform,translateZ,boundsChanged};
      depthControl.click();await sleep(0);
    }
    relayChoice.click();await until(()=>document.documentElement.dataset.workspaceSkin==='relay'&&picker.value==='relay','gallery Relay choice');
    const choiceProof={root:document.documentElement.dataset.workspaceSkin,picker:picker.value,
      requests:performance.getEntriesByType('resource').length===galleryCalls};
    if(!gallery.open){galleryOpen.click();await until(()=>gallery.open,'interface gallery reopen for close')}
    galleryClose.click();await until(()=>!gallery.open,'interface gallery close button');
    const closeFocus=document.activeElement===galleryOpen;
    galleryOpen.click();await until(()=>gallery.open,'interface gallery reopen for Escape');
    document.body.dataset.galleryEscapeReady='1';
    await until(()=>!gallery.open,'native interface gallery Escape');
    const escapeFocus=document.activeElement===galleryOpen;
    const motion=document.querySelector('#interface-motion-select'),motionChoices=[...motion.options].map(option=>option.value);
    motion.value='reduced';motion.dispatchEvent(new Event('change',{bubbles:true}));await sleep(0);
    const reducedRoot=document.documentElement.dataset.interfaceMotion;
    const explicitReduced={choiceTransition:getComputedStyle(activeChoice).transitionDuration,
      miniatureTransition:getComputedStyle(miniature).transitionDuration,miniatureTransform:getComputedStyle(miniature).transform};
    motion.value='spatial';motion.dispatchEvent(new Event('change',{bubbles:true}));await sleep(0);
    const spatialRoot=document.documentElement.dataset.interfaceMotion;
    focusedControl.focus();
    const measuredRect=element=>{const box=element.getBoundingClientRect();return{x:+box.x.toFixed(1),y:+box.y.toFixed(1),
      width:+box.width.toFixed(1),height:+box.height.toFixed(1),right:+box.right.toFixed(1),bottom:+box.bottom.toFixed(1)}};
    const composition=()=>{const record=document.querySelector('#workbench-view > .layout-region.is-layout-active[data-layout-role="record"]');
      if(!record)throw new Error('Visible layout record hook is missing');
      const regions=[...record.querySelectorAll('.layout-region[data-layout-role]')].filter(region=>region.getClientRects().length>0);
      return{skin:document.querySelector('#workbench-view').dataset.layoutSkin,view:record.dataset.layoutView,
        record:measuredRect(record),grid:{columns:getComputedStyle(record).gridTemplateColumns,rows:getComputedStyle(record).gridTemplateRows},
        regions:regions.map((region,index)=>{const style=getComputedStyle(region);return{index,role:region.dataset.layoutRole,
          chapter:region.dataset.layoutChapter||null,current:region.classList.contains('is-layout-current'),rect:measuredRect(region),
           area:style.gridArea,position:style.position,transform:style.transform,zIndex:style.zIndex}})};
    };
    const journeyChapterTools=()=>{const nav=document.querySelector('.layout-chapter-nav'),buttons=[...document.querySelectorAll('[data-layout-chapter-choice]')],
      panels=[...document.querySelectorAll('[role="tabpanel"][data-layout-chapter]')];return{navRendered:nav.getClientRects().length>0,
        visibleButtons:buttons.filter(button=>button.getClientRects().length>0).length,totalButtons:buttons.length,
        visiblePanels:panels.filter(panel=>panel.getClientRects().length>0).length,totalPanels:panels.length}};
    const samples=[];
    for(const layout of ${JSON.stringify(interfaceChoices)}){
      picker.value=layout;picker.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>document.documentElement.dataset.workspaceSkin===layout&&document.querySelector('#workbench-view').dataset.layoutSkin===layout&&
        document.querySelector('#invoices-view.layout-region.is-layout-active[data-layout-role="record"]'),'invoice composition '+layout);
      const nav=document.querySelector('.domain-bar').getBoundingClientRect();
      const heading=document.querySelector('.workbench-head').getBoundingClientRect();
      const content=document.querySelector('#invoices-view').getBoundingClientRect();
      const surface=getComputedStyle(document.documentElement);
      samples.push({layout,root:document.documentElement.dataset.workspaceSkin,
        sameMount:mount===document.querySelector('#invoices-mount'),sameDetail:detail===document.querySelector('.invoice-workbench__detail'),
        sameAudit:audit===document.querySelector('.invoice-workbench__audit'),sameProperty:propertyReference===document.querySelector('#property-select'),
        samePicker:pickerReference===document.querySelector('#workspace-skin-select'),auditOpen:audit.open,
        query:query.value,selection:[query.selectionStart,query.selectionEnd],focus:document.activeElement===focusedControl,
        searchVisible:query.getClientRects().length>0,
        route:location.pathname,property:document.querySelector('#property-select').value,
        hiddenStable:hiddenControls.every(control=>control.hasAttribute('hidden')&&control.getClientRects().length===0),
        nav:{x:nav.x,y:nav.y,width:nav.width,height:nav.height,bottom:nav.bottom},navigationOpen:workspaceNavigation.open,
        heading:{x:heading.x,y:heading.y},content:{x:content.x,y:content.y},
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        columns:getComputedStyle(document.querySelector('.invoice-workbench__layout')).gridTemplateColumns,composition:composition(),chapterTools:journeyChapterTools(),
        ink:surface.getPropertyValue('--ink').trim(),paper:surface.getPropertyValue('--paper').trim(),muted:surface.getPropertyValue('--muted').trim()});
    }
    const afterCalls=performance.getEntriesByType('resource').length;
    const navToday=document.querySelector('#nav-today'),navInvoices=document.querySelector('#nav-invoices');
    if(innerWidth<=1020)workspaceNavigation.open=true;
    navToday.click();
    await until(()=>location.pathname.endsWith('/today')&&document.querySelectorAll('.today-lane-list:not([hidden]) .reservation-board-card').length===3,'loaded Today lanes');
    await until(()=>document.querySelector('#today-view.layout-region.is-layout-active[data-layout-role="record"]'),'Today layout hook');
    const todayCalls=performance.getEntriesByType('resource').length;
    const todaySamples=[];
    for(const layout of ${JSON.stringify(interfaceChoices)}){
      picker.value=layout;picker.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>document.documentElement.dataset.workspaceSkin===layout&&document.querySelector('#workbench-view').dataset.layoutSkin===layout&&
        document.querySelector('#today-view.layout-region.is-layout-active[data-layout-role="record"]'),'Today composition '+layout);
      todaySamples.push({layout,root:document.documentElement.dataset.workspaceSkin,composition:composition(),
        chapterTools:journeyChapterTools(),
        route:location.pathname,property:propertySelect.value,overflow:document.documentElement.scrollWidth>innerWidth+1,
        invalidDates:document.querySelector('#today-view').textContent.includes('Invalid server date'),
        actions:[...document.querySelectorAll('.today-operational-action')].map(action=>{const style=getComputedStyle(action),foreground=rgba(style.color);
          return{visible:action.getClientRects().length>0,height:action.getBoundingClientRect().height,background:style.backgroundColor,border:style.borderStyle,
            contrast:foreground?contrast(foreground,backdrop(action)):0}}),
        rows:document.querySelectorAll('.today-lane-list:not([hidden]) .reservation-board-card').length,
        chapters:[...document.querySelectorAll('[data-layout-role="chapter"][data-layout-chapter]')].map(chapter=>({
          key:chapter.dataset.layoutChapter,current:chapter.classList.contains('is-layout-current'),visible:chapter.getClientRects().length>0}))});
    }
    const afterTodaySkinCalls=performance.getEntriesByType('resource').length;
    const todayGroup=groups.find(group=>group.classList.contains('contains-current'));
    const todayNavigation={route:location.pathname,current:todayGroup?.dataset.workspaceGroup,open:todayGroup?.open===true,outerOpen:workspaceNavigation.open,
      currentLabel:document.querySelector('#workspace-navigation-current')?.textContent,
      active:document.querySelector('button[data-view].is-active')?.dataset.view};
    if(innerWidth<=1020)workspaceNavigation.open=true;
    navInvoices.click();await until(()=>location.pathname.endsWith('/invoices')&&document.querySelector('.invoice-workbench__queue-item'),'invoice return');
    document.querySelector('.invoice-workbench__queue-item').click();
    await until(()=>location.pathname.endsWith(${JSON.stringify(`/invoices/${id(10)}`)})&&document.querySelector('.invoice-workbench__detail')?.textContent.includes('INV/STUDY/17'),'invoice detail return');
    const returnedQuery=document.querySelector('.invoice-workbench__query');
    const invoiceReturn={query:returnedQuery.value,selection:[returnedQuery.selectionStart,returnedQuery.selectionEnd],
      route:location.pathname,property:propertySelect.value,financeOpen:document.querySelector('[data-workspace-group="finance"]')?.open===true,
      outerOpen:workspaceNavigation.open,currentLabel:document.querySelector('#workspace-navigation-current')?.textContent,
      current:groups.filter(group=>group.classList.contains('contains-current')).map(group=>group.dataset.workspaceGroup)};
    audit.querySelector('summary').click();
    const resourceProof=performance.getEntriesByType('resource').map(entry=>{const url=new URL(entry.name);return{path:url.pathname,origin:url.origin,
      transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize}});
    const resources=resourceProof.map(entry=>entry.path),brand=document.querySelector('.brand strong'),brandBox=brand.getBoundingClientRect();
    finish({width:innerWidth,height:innerHeight,before,afterCalls,todayCalls,afterTodaySkinCalls,samples,todaySamples,
      groups:groupedNavigation,disclosureModes,groupSummaryProof,todayNavigation,invoiceReturn,audit:auditProof,iconProof,resources,
      gallery:{tag:gallery.tagName,focus:galleryFocus,choice:choiceProof,closeFocus,escapeFocus,depth:depthProof},
      motion:{choices:motionChoices,reducedRoot,spatialRoot,mediaReduced,explicitReduced},
      resourceProof,resourceOrigins:[...new Set(resourceProof.map(entry=>entry.origin))],
      font:{expected:${String(fontExpected)},loaded:loadedFontFaces.length>0&&loadedFontFaces.every(face=>face.status==='loaded'),loadError:fontLoadError,
        family:getComputedStyle(document.body).fontFamily,readable:brand.textContent==='Yellow'&&brandBox.width>0&&brandBox.height>0&&getComputedStyle(brand).visibility==='visible'},
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      forcedColors:matchMedia('(forced-colors: active)').matches,
      legacy:!!document.querySelector('#experience-select,#theme-select,#secondary-workspaces,#secondary-workspaces-toggle'),
      choices:[...picker.options].map(option=>option.value)});
  }catch(error){finish({error:String(error?.stack||error)})}
  </script>`;
}

async function closeGalleryWithEscape(send: CdpSend): Promise<void> {
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const evaluation = await send<{ result?: { value?: { ready: boolean; proof: string } } }>("Runtime.evaluate", {
      expression: "({ready:document.body?.dataset.galleryEscapeReady === '1',proof:document.querySelector('#layout-proof')?.textContent || ''})",
      returnByValue: true,
    });
    ready = evaluation.result?.value?.ready === true;
    if (ready) break;
    if (evaluation.result?.value?.proof) {
      const proof = JSON.parse(evaluation.result.value.proof) as { error?: string };
      if (proof.error) throw new Error(`Layout driver failed before Escape: ${proof.error}`);
    }
    await Bun.sleep(20);
  }
  if (!ready) throw new Error("Interface gallery did not become ready for native Escape proof");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
}

test("Order459 eight compositions retain loaded records, drafts and grouped accessible navigation", async () => {
  if (!browser) throw new Error("Chrome or Chromium is required for the actual workspace layout proof");
  const html = await Bun.file(resolve(repository, "src/http/operator/index.html")).text();
  let requestedSkin = "ledger";
  let fontExpected = true;
  const apiRequests: Array<{ method: string; path: string }> = [];
  const todayFixtureWindows: Array<{ status: keyof typeof todayRows; from: string; to: string; stayFrom: string; stayTo: string }> = [];
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;
    const assets: Record<string, { file: string; type: string }> = {
      "/assets/operator.js": { file: "operator.js", type: "text/javascript" },
      "/assets/operator.css": { file: "operator.css", type: "text/css" },
      "/assets/operator-interfaces.js": { file: "operator-interfaces.js", type: "text/javascript" },
      "/assets/operator-interfaces.css": { file: "operator-interfaces.css", type: "text/css" },
      "/assets/operator-layouts.js": { file: "operator-layouts.js", type: "text/javascript" },
      "/assets/operator-invoices.js": { file: "invoices.js", type: "text/javascript" },
      "/static/fonts/urbanist-v1.330.woff2": { file: "vendor/urbanist-v1.330/Urbanist[ital,wght].woff2", type: "font/woff2" },
      "/static/icons/phosphor-nav-2.1.1.svg": { file: "vendor/phosphor-core-2.1.1/phosphor-nav-regular.svg", type: "image/svg+xml" },
    };
    if (assets[path]) return new Response(Bun.file(resolve(repository, "src/http/operator", assets[path].file)), { headers: { "content-type": assets[path].type } });
    if (path === "/api/v1/auth/local:login") return Response.json({ accessToken: "synthetic-layout-token", user: { displayName: "Synthetic UI study operator" } });
    if (path.startsWith("/api/")) {
      apiRequests.push({ method: request.method, path: `${path}${requestUrl.search}` });
      if (request.headers.get("authorization") !== "Bearer synthetic-layout-token") return Response.json({ type: "unauthorized" }, { status: 401 });
      if (path === "/api/v1/me/properties") return Response.json({ properties: [{ id: id(2), name: "Fictional Yellow Hotel · UI study", timezone: "Asia/Kolkata" }] });
      if (path.endsWith("/invoices/search")) return Response.json({ invoices: { items: [{ documentId: id(10), documentNumber: "INV/STUDY/17", businessDate: "2044-09-06", issuedAt: documentValue.issuedAt, reservationId: id(4), folioId: id(5), recipientRegistrationId: id(6), buyerName: "Fictional River Guest", buyerGstin: "27AAPFU0939F1ZV", currency: "INR", taxableMinor: "10000", taxMinor: "500", totalMinor: "10500" }], matchingCount: "1", nextCursor: null } });
      if (path.endsWith(`/invoices/${id(10)}`)) return Response.json({ invoice: documentValue });
      if (path.endsWith("/reservation-board")) {
        const status = requestUrl.searchParams.get("status") as keyof typeof todayRows;
        if (!(status in todayRows)) return Response.json({ type: "invalid_today_status" }, { status: 400 });
        const row = todayRowForWindow(status, requestUrl);
        todayFixtureWindows.push({ status, from: requestUrl.searchParams.get("from") ?? "", to: requestUrl.searchParams.get("to") ?? "",
          stayFrom: row.stayFrom, stayTo: row.stayTo });
        return Response.json({ reservations: [row], nextCursor: null });
      }
      if (path.endsWith("/receipt")) return Response.json({ type: "forbidden" }, { status: 403 });
      return Response.json({ type: "unexpected_fixture_request" }, { status: 404 });
    }
    if (path === route) return new Response(html.replace("</body>", `${driver(requestedSkin, fontExpected)}</body>`), { headers: { "content-type": "text/html" } });
    return new Response("not found", { status: 404 });
  } });
  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-order459-compositions-"));
  try {
    const captures = process.env.YELLOW_INTERFACE_SCREENSHOTS;
    if (captures) await mkdir(captures, { recursive: true });
    const cases = [[1440,900,"ledger"],[1024,768,"orbit"],[375,844,"index"]] as const;
    const url = `http://127.0.0.1:${server.port}${route}`;
    await withOwnedCdp(resolve(temporary, "chrome"), async (send, runtimeErrors) => {
      await send("Page.enable");
      await send("Runtime.enable");
      await send("Network.enable");
      await send("Emulation.setEmulatedMedia", { features: [
        { name: "prefers-reduced-motion", value: "no-preference" },
        { name: "forced-colors", value: "none" },
      ] });
      for (const [width,height,skin] of cases) {
        requestedSkin = skin;
        await send("Emulation.setDeviceMetricsOverride", {
          width, height, deviceScaleFactor: 1, mobile: width < 768,
          screenWidth: width, screenHeight: height,
        });
        runtimeErrors.length = 0;
        await send("Page.navigate", { url });
        await closeGalleryWithEscape(send);
        let encoded = "";
        for (let attempt = 0; attempt < 300; attempt += 1) {
          const evaluation = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
            expression: "document.querySelector('#layout-proof')?.textContent || ''",
            returnByValue: true,
          });
          encoded = evaluation.result?.value ?? "";
          if (encoded) break;
          await Bun.sleep(20);
        }
        if (!encoded) throw new Error(`No layout proof ${width}/${skin}`);
        const proof = JSON.parse(encoded);
        if(captures){
          await Bun.write(resolve(captures, `${width}-${height}-${skin}-proof.json`), JSON.stringify(proof, null, 2));
          const diagnostic = await send<{ data?: string }>("Page.captureScreenshot", {
            format: "png", fromSurface: true, captureBeyondViewport: false,
          });
          if(!diagnostic.data)throw new Error(`No pre-assert diagnostic screenshot ${width}/${skin}`);
          await Bun.write(resolve(captures, `${width}-${height}-${skin}-pre-assert.png`), Buffer.from(diagnostic.data, "base64"));
        }
        expect(proof.error).toBeUndefined();
        expect(runtimeErrors).toEqual([]);
        expect({ width: proof.width, height: proof.height }).toEqual({ width, height });
        expect(proof.reducedMotion).toBe(false);
        expect(proof.forcedColors).toBe(false);
        expect(proof.legacy).toBe(false);
        expect(proof.choices).toEqual(interfaceChoices);
        expect(proof.font).toMatchObject({ expected: true, loaded: true, loadError: null, readable: true });
        expect(proof.font.family).toMatch(/^Urbanist/);
        expect(proof.resourceOrigins).toEqual([`http://127.0.0.1:${server.port}`]);
        expect(proof.resources).toContain("/static/fonts/urbanist-v1.330.woff2");
        expect(proof.resources).toContain("/assets/operator-layouts.js");
        expect(proof.resources).not.toContain("/static/icons/phosphor-nav-2.1.1.svg");
        expect(proof.iconProof).toHaveLength(15);
        expect(new Set(proof.iconProof.map((icon: { href: string }) => icon.href)).size).toBe(15);
        for (const icon of proof.iconProof) {
          expect(icon.href).toMatch(/^#ph-[a-z-]+$/);
          expect(icon.label.length).toBeGreaterThan(0);
          expect(icon.target).toBeGreaterThanOrEqual(44);
          expect(icon.box[0]).toBeGreaterThan(0);
          expect(icon.box[1]).toBeGreaterThan(0);
          expect(icon.shape[0]).toBeGreaterThan(0);
          expect(icon.shape[1]).toBeGreaterThan(0);
          expect(icon.fill).toBe(icon.color);
          expect(icon.contrast,`${icon.id} icon contrast`).toBeGreaterThanOrEqual(3);
          expect(icon).toMatchObject({ visible: true, focus: true });
        }
        expect(proof.groupSummaryProof.map((summary: { group: string })=>summary.group)).toEqual(workspaceGroups);
        for(const summary of proof.groupSummaryProof){
          expect(summary.visible,`${summary.group} group summary visible`).toBe(true);
          expect(summary.height,`${summary.group} group summary target`).toBeGreaterThanOrEqual(44);
          expect(summary.contrast,`${summary.group} group summary contrast on rgb(${summary.background.join(',')})`).toBeGreaterThanOrEqual(3);
        }
        expect(proof.afterCalls).toBe(proof.before.calls);
        expect(proof.gallery).toMatchObject({tag:"DIALOG",focus:true,choice:{root:"relay",picker:"relay",requests:true},
          closeFocus:true,escapeFocus:true,depth:{disabled:false,root:"spatial",exploded:"true",
            transformStyle:"preserve-3d",boundsChanged:true}});
        expect(["clip", "visible"]).toContain(proof.gallery.depth.overflow);
        expect(proof.gallery.depth.layerTransform).toMatch(/^matrix3d\(/);
        expect(proof.gallery.depth.translateZ).toBeGreaterThan(0);
        expect(proof.motion).toEqual({choices:["spatial","reduced"],reducedRoot:"reduced",spatialRoot:"spatial",mediaReduced:false,
          explicitReduced:{choiceTransition:"0s",miniatureTransition:"0s",miniatureTransform:"none"}});
        expect(proof.audit).toEqual({closedInitially:true,tag:"DETAILS",label:"Document history & verification",
          documentHash:true,sourceHash:true,reservation:true,folio:true,identityOutsideAudit:true,date:"2044-09-06"});
        expect(proof.groups).toEqual({keys:workspaceGroups,counts:[3,5,3,3,1],
          summaries:["Front desk3","Finance5","Property3","Rates & inventory3","System1"],
          financeOpen:true,current:["finance"],active:["invoices"],outerTag:"DETAILS",outerOpen:width>1020,
          currentLabel:"Invoices",legacyRemoved:true});
        if(width>1020){
          expect(proof.disclosureModes).toEqual({ledger:{names:Array(5).fill("ledger-workspace-rail"),financeOpened:true,
            propertyOpened:true,escapeClosed:true,escapeFocus:true},ordinary:{names:Array(5).fill(null),financeOpen:true,propertyOpen:true}});
        }else{
          expect(proof.disclosureModes).toEqual({compactNames:Array(5).fill(null)});
        }
        expect(proof.todayNavigation).toMatchObject({current:"front-desk",open:true,outerOpen:width>1020,currentLabel:"Today",active:"today"});
        expect(proof.todayNavigation.route).toBe(`/p/${id(2)}/today`);
        expect(proof.invoiceReturn).toEqual({query:"Unsubmitted guest filter",selection:[2,9],
          route:`/p/${id(2)}/invoices/${id(10)}`,property:id(2),financeOpen:true,outerOpen:width>1020,
          currentLabel:"Invoices",current:["finance"]});
        expect(proof.afterTodaySkinCalls).toBe(proof.todayCalls);
        for (const sample of proof.samples) {
          expect(sample).toMatchObject({root:sample.layout,sameMount:true,sameDetail:true,sameAudit:true,sameProperty:true,
            samePicker:true,auditOpen:true,query:"Unsubmitted guest filter",selection:[2,9],focus:true,
            route:proof.before.route,property:id(2),hiddenStable:true,overflow:false});
          expect(sample.composition).toMatchObject({skin:sample.layout,view:"invoices"});
          expect(sample.composition.regions.length).toBeGreaterThanOrEqual(2);
          if(sample.layout==="journey")expect(sample.chapterTools).toEqual({navRendered:false,visibleButtons:0,totalButtons:3,visiblePanels:0,totalPanels:3});
          expect(sample.nav.x).toBeGreaterThanOrEqual(-4);
          expect(sample.nav.x+sample.nav.width).toBeLessThanOrEqual(width+4);
          expect(sample.navigationOpen).toBe(width>1020);
          if (width > 1020 && sample.layout === "ledger") expect(sample.nav.height).toBeLessThanOrEqual(130);
          if (width <= 1020) {
            expect(sample.nav.height).toBeLessThanOrEqual(180);
            expect(sample.content.y).toBeGreaterThanOrEqual(sample.nav.bottom-1);
          }
          expect(sample.searchVisible).toBe(width>1020);
        }
        expect(proof.samples.map((sample: { layout: string }) => sample.layout)).toEqual(interfaceChoices);
        expect(proof.todaySamples.map((sample: { layout: string }) => sample.layout)).toEqual(interfaceChoices);
        for (const sample of proof.todaySamples) {
          expect(sample).toMatchObject({root:sample.layout,route:`/p/${id(2)}/today`,property:id(2),overflow:false,rows:3});
          expect(sample.invalidDates).toBe(false);
          expect(sample.composition).toMatchObject({skin:sample.layout,view:"today"});
          if(sample.layout==="journey")expect(sample.chapterTools).toEqual({navRendered:true,visibleButtons:3,totalButtons:3,visiblePanels:1,totalPanels:3});
          expect(sample.chapters.map((chapter: { key: string }) => chapter.key)).toEqual(["due_in","due_out","in_house"]);
          expect(sample.chapters.filter((chapter: { visible: boolean }) => chapter.visible)).toHaveLength(sample.layout==="journey"?1:3);
          expect(sample.chapters.filter((chapter: { current: boolean }) => chapter.current)).toHaveLength(sample.layout==="journey"?1:0);
          expect(sample.actions).toHaveLength(3);
          const visibleActions=sample.actions.filter((action: { visible: boolean })=>action.visible);
          expect(visibleActions).toHaveLength(sample.layout==="journey"?1:3);
          expect(Math.min(...visibleActions.map((action: { height: number })=>action.height)),`${sample.layout} Today action target`).toBeGreaterThanOrEqual(44);
          expect(Math.min(...visibleActions.map((action: { contrast: number })=>action.contrast)),`${sample.layout} Today action contrast`).toBeGreaterThanOrEqual(3);
          if(sample.layout==="aura")expect(visibleActions.every((action: { background: string; border: string }) => action.background!=="rgba(0, 0, 0, 0)"&&action.border!=="none")).toBe(true);
        }
        if (proof.width >= 1200) {
          const structuralSignature = (sample: { composition: { grid: unknown; regions: Array<{ role: string; chapter: string | null;
            current: boolean; rect: { x: number; y: number; width: number; height: number }; area: string; position: string; transform: string; zIndex: string }> } }) =>
            JSON.stringify([sample.composition.grid,sample.composition.regions.map(region=>[region.role,region.chapter,region.current,
              Math.round(region.rect.x/20),Math.round(region.rect.y/20),Math.round(region.rect.width/20),Math.round(region.rect.height/20),
              region.area,region.position,region.transform==="none"?"flat":"transformed",region.zIndex])]);
          expect(new Set(proof.samples.map(structuralSignature)).size).toBe(interfaceChoices.length);
          expect(new Set(proof.todaySamples.map(structuralSignature)).size).toBe(interfaceChoices.length);
        }
        await send("Runtime.evaluate", {expression:"document.querySelector('.invoice-workbench__audit-summary').focus()"});
        for (const expectedOpen of [true, false]) {
          await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,text:"\r",unmodifiedText:"\r"});
          await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
          const keyboard = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
            expression:"({open:document.querySelector('.invoice-workbench__audit').open,focus:document.activeElement===document.querySelector('.invoice-workbench__audit-summary'),calls:performance.getEntriesByType('resource').length})",returnByValue:true,
          });
          expect(keyboard.result?.value).toMatchObject({open:expectedOpen,focus:true});
        }
        if (width <= 1020) {
          const outerStart = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
            expression:"(()=>{const outer=document.querySelector('#workspace-navigation'),summary=outer.querySelector(':scope > summary');outer.open=false;summary.focus();return{open:outer.open,focus:document.activeElement===summary,calls:performance.getEntriesByType('resource').length}})()",returnByValue:true,
          });
          expect(outerStart.result?.value).toMatchObject({open:false,focus:true});
          await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,text:"\r",unmodifiedText:"\r"});
          await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
          const outerEnter = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
            expression:"(()=>{const outer=document.querySelector('#workspace-navigation');return{open:outer.open,focus:document.activeElement===outer.querySelector(':scope > summary'),calls:performance.getEntriesByType('resource').length}})()",returnByValue:true,
          });
          expect(outerEnter.result?.value).toEqual({...(outerStart.result?.value as object),open:true});
        }
        const groupKeyboardStart = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
          expression:"(()=>{const outer=document.querySelector('#workspace-navigation'),group=document.querySelector('[data-workspace-group=system]');outer.open=true;group.open=false;group.querySelector('summary').focus();return{open:group.open,focus:document.activeElement===group.querySelector('summary'),calls:performance.getEntriesByType('resource').length}})()",returnByValue:true,
        });
        expect(groupKeyboardStart.result?.value).toMatchObject({open:false,focus:true});
        await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,text:"\r",unmodifiedText:"\r"});
        await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
        const groupEnter = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
          expression:"(()=>{const group=document.querySelector('[data-workspace-group=system]');return{open:group.open,focus:document.activeElement===group.querySelector('summary'),calls:performance.getEntriesByType('resource').length}})()",returnByValue:true,
        });
        expect(groupEnter.result?.value).toEqual({...(groupKeyboardStart.result?.value as object),open:true});
        await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
        await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
        const groupEscape = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
          expression:"(()=>{const group=document.querySelector('[data-workspace-group=system]');return{open:group.open,focus:document.activeElement===group.querySelector('summary'),calls:performance.getEntriesByType('resource').length}})()",returnByValue:true,
        });
        expect(groupEscape.result?.value).toEqual(groupKeyboardStart.result?.value);
        if (width <= 1020) {
          await send("Runtime.evaluate", {expression:"document.querySelector('#workspace-navigation > summary').focus()"});
          await send("Input.dispatchKeyEvent", {type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32,text:" ",unmodifiedText:" "});
          await send("Input.dispatchKeyEvent", {type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
          const outerSpace = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
            expression:"(()=>{const outer=document.querySelector('#workspace-navigation');return{open:outer.open,focus:document.activeElement===outer.querySelector(':scope > summary'),calls:performance.getEntriesByType('resource').length}})()",returnByValue:true,
          });
          expect(outerSpace.result?.value).toEqual(groupKeyboardStart.result?.value);
        }
        if (captures) {
          await Bun.write(resolve(captures, `${width}-${height}-${skin}-proof.json`), JSON.stringify(proof, null, 2));
          const capture = async (name: string) => {
            const scroll = await send<{ result?: { value?: { x: number; y: number } } }>("Runtime.evaluate", {
              expression: "new Promise(resolve=>{document.activeElement?.blur();document.documentElement.style.overflowAnchor='none';document.body.style.overflowAnchor='none';document.documentElement.style.scrollBehavior='auto';const settle=()=>{scrollTo(0,0);document.scrollingElement.scrollTop=0;requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({x:scrollX,y:scrollY})))};document.querySelector('#workbench-view')?.classList.contains('is-interface-entering')?setTimeout(settle,450):settle()})",
              awaitPromise: true,
              returnByValue: true,
            });
            expect(scroll.result?.value).toEqual({ x: 0, y: 0 });
            const screenshot = await send<{ data?: string }>("Page.captureScreenshot", {
              format: "png", fromSurface: true, captureBeyondViewport: false,
            });
            if (!screenshot.data) throw new Error(`No viewport screenshot ${name}`);
            await Bun.write(resolve(captures, name), Buffer.from(screenshot.data, "base64"));
          };
          if (width === 1440) {
            for (const choice of interfaceChoices) {
              await send("Runtime.evaluate", {
                expression: `new Promise(resolve=>{const picker=document.querySelector('#workspace-skin-select');picker.value=${JSON.stringify(choice)};picker.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),450)})`,
                awaitPromise: true,
              });
              await capture(`${width}-${height}-${prototypeNumbers[choice]}-${choice}-invoices.png`);
            }
            await send("Runtime.evaluate", {
              expression: "new Promise(resolve=>{document.querySelector('#nav-today').click();const wait=()=>document.querySelectorAll('.today-lane-list:not([hidden]) .reservation-board-card').length===3?requestAnimationFrame(()=>requestAnimationFrame(resolve)):setTimeout(wait,20);wait()})",
              awaitPromise: true,
            });
            for (const choice of interfaceChoices) {
              await send("Runtime.evaluate", {
                expression: `new Promise(resolve=>{const picker=document.querySelector('#workspace-skin-select');picker.value=${JSON.stringify(choice)};picker.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),450)})`,
                awaitPromise: true,
              });
              await capture(`${width}-${height}-${prototypeNumbers[choice]}-${choice}-today.png`);
            }
            await send("Runtime.evaluate", {
              expression: "new Promise(resolve=>{const picker=document.querySelector('#workspace-skin-select');picker.value='orbit';picker.dispatchEvent(new Event('change',{bubbles:true}));const wait=()=>document.querySelector('#workbench-view').dataset.layoutSkin==='orbit'?requestAnimationFrame(()=>{document.querySelector('#layout-workspace-launcher').click();requestAnimationFrame(()=>requestAnimationFrame(resolve))}):setTimeout(wait,20);wait()})",
              awaitPromise: true,
            });
            await capture(`${width}-${height}-07-orbit-launcher-open.png`);
            await send("Runtime.evaluate", { expression: "document.querySelector('#layout-workspace-launcher').click()" });
            await send("Runtime.evaluate", {
              expression: "new Promise(resolve=>{document.querySelector('#interface-gallery-open').click();requestAnimationFrame(()=>{document.querySelector('#interface-depth-play').click();setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),320)})})",
              awaitPromise: true,
            });
            await capture(`${width}-${height}-gallery-depth.png`);
            await send("Runtime.evaluate", { expression: "document.querySelector('#interface-gallery-close').click()" });
          } else {
            await send("Runtime.evaluate", {
              expression: `new Promise(resolve=>{const picker=document.querySelector('#workspace-skin-select');picker.value=${JSON.stringify(skin)};picker.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),450)})`,
              awaitPromise: true,
            });
            await capture(`${width}-${height}-${skin}.png`);
            if(skin==="orbit"){
              await send("Runtime.evaluate", {expression:"new Promise(resolve=>{document.querySelector('#layout-workspace-launcher').click();requestAnimationFrame(()=>requestAnimationFrame(resolve))})",awaitPromise:true});
              await capture(`${width}-${height}-${skin}-launcher-open.png`);
              await send("Runtime.evaluate", {expression:"document.querySelector('#layout-workspace-launcher').click()"});
            }
          }
          expect(runtimeErrors).toEqual([]);
        }
      }

      requestedSkin = "relay";
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
        screenWidth: 390, screenHeight: 844,
      });
      await send("Emulation.setEmulatedMedia", { features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "forced-colors", value: "active" },
      ] });
      runtimeErrors.length = 0;
      await send("Page.navigate", { url });
      await closeGalleryWithEscape(send);
      let forcedEncoded = "";
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const evaluation = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
          expression: "document.querySelector('#layout-proof')?.textContent || ''",
          returnByValue: true,
        });
        forcedEncoded = evaluation.result?.value ?? "";
        if (forcedEncoded) break;
        await Bun.sleep(20);
      }
      if (!forcedEncoded) throw new Error("No forced-colours layout proof 375/relay");
      const forcedProof = JSON.parse(forcedEncoded);
      expect(runtimeErrors).toEqual([]);
      expect(forcedProof).toMatchObject({ width: 390, height: 844, reducedMotion: true, forcedColors: true, legacy: false });
      expect(forcedProof.font).toMatchObject({ expected: true, loaded: true, loadError: null, readable: true });
      expect(forcedProof.font.family).toMatch(/^Urbanist/);
      expect(forcedProof.resourceOrigins).toEqual([`http://127.0.0.1:${server.port}`]);
      expect(forcedProof.iconProof).toHaveLength(15);
      expect(forcedProof.iconProof.every((icon: { visible: boolean; focus: boolean; target: number; shape: [number, number]; fill: string; color: string; contrast: number }) =>
        icon.visible && icon.focus && icon.target >= 44 && icon.shape[0] > 0 && icon.shape[1] > 0 && icon.fill === icon.color && icon.contrast >= 3)).toBe(true);
      expect(forcedProof.afterCalls).toBe(forcedProof.before.calls);
      expect(forcedProof.gallery.depth).toEqual({ disabled: true, root: "reduced" });
      expect(forcedProof.motion).toEqual({ choices: ["spatial", "reduced"], reducedRoot: "reduced", spatialRoot: "reduced",
        mediaReduced: true, explicitReduced: { choiceTransition: "0s", miniatureTransition: "0s", miniatureTransform: "none" } });
      expect(forcedProof.samples.every((sample: { overflow: boolean; sameMount: boolean; sameDetail: boolean }) =>
        !sample.overflow && sample.sameMount && sample.sameDetail)).toBe(true);
      expect(forcedProof.todaySamples.every((sample: { overflow: boolean; rows: number }) => !sample.overflow && sample.rows === 3)).toBe(true);
      expect(forcedProof.groups).toMatchObject({ keys: workspaceGroups, counts: [3,5,3,3,1], legacyRemoved: true });
      if (captures) {
        await send("Runtime.evaluate", {
          expression: "new Promise(resolve=>{const picker=document.querySelector('#workspace-skin-select');picker.value='relay';picker.dispatchEvent(new Event('change',{bubbles:true}));scrollTo(0,0);requestAnimationFrame(()=>requestAnimationFrame(resolve))})",
          awaitPromise: true,
        });
        const screenshot = await send<{ data?: string }>("Page.captureScreenshot", {
          format: "png", fromSurface: true, captureBeyondViewport: false,
        });
        if (!screenshot.data) throw new Error("No forced-colours viewport screenshot 390/relay");
        await Bun.write(resolve(captures, "390-844-relay-forced-colors.png"), Buffer.from(screenshot.data, "base64"));
      }

      fontExpected = false;
      requestedSkin = "ledger";
      await send("Network.setBlockedURLs", { urls: ["*urbanist-v1.330.woff2*"] });
      await send("Emulation.setEmulatedMedia", { features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "forced-colors", value: "none" },
      ] });
      runtimeErrors.length = 0;
      await send("Page.navigate", { url: `${url}?font-fallback=1` });
      await closeGalleryWithEscape(send);
      let fallbackEncoded = "";
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const evaluation = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
          expression: "document.querySelector('#layout-proof')?.textContent || ''",
          returnByValue: true,
        });
        fallbackEncoded = evaluation.result?.value ?? "";
        if (fallbackEncoded) break;
        await Bun.sleep(20);
      }
      if (!fallbackEncoded) throw new Error("No blocked-font fallback proof 390/ledger");
      const fallbackProof = JSON.parse(fallbackEncoded);
      expect(fallbackProof.error).toBeUndefined();
      expect(runtimeErrors).toEqual([]);
      expect(fallbackProof).toMatchObject({ width: 390, height: 844, reducedMotion: true, forcedColors: false, legacy: false });
      expect(fallbackProof.font).toMatchObject({ expected: false, loaded: false, readable: true });
      expect(fallbackProof.font.family).toMatch(/^Urbanist/);
      expect(fallbackProof.font.family).toContain("system-ui");
      expect(fallbackProof.font.family).toContain("Segoe UI");
      expect(fallbackProof.font.loadError).toBe("NetworkError");
      expect(fallbackProof.resources).toContain("/static/fonts/urbanist-v1.330.woff2");
      expect(fallbackProof.resourceProof.filter((entry: { path: string }) => entry.path === "/static/fonts/urbanist-v1.330.woff2")).toEqual([{
        path: "/static/fonts/urbanist-v1.330.woff2",
        origin: `http://127.0.0.1:${server.port}`,
        transferSize: 0,
        encodedBodySize: 0,
        decodedBodySize: 0,
      }]);
      expect(fallbackProof.resources).not.toContain("/static/icons/phosphor-nav-2.1.1.svg");
      expect(fallbackProof.resourceOrigins).toEqual([`http://127.0.0.1:${server.port}`]);
      await send("DOM.enable");
      await send("CSS.enable");
      const fallbackDocument = await send<{ root: { nodeId: number } }>("DOM.getDocument");
      const fallbackBrand = await send<{ nodeId: number }>("DOM.querySelector", {
        nodeId: fallbackDocument.root.nodeId,
        selector: ".brand strong",
      });
      const fallbackFonts = await send<{ fonts: Array<{ familyName: string; isCustomFont: boolean; glyphCount: number }> }>(
        "CSS.getPlatformFontsForNode",
        { nodeId: fallbackBrand.nodeId },
      );
      expect(fallbackFonts.fonts.length).toBeGreaterThan(0);
      expect(fallbackFonts.fonts.every(font => !font.isCustomFont && font.glyphCount > 0)).toBe(true);
      expect(fallbackFonts.fonts.every(font => font.familyName !== "Urbanist")).toBe(true);
      expect(fallbackProof.iconProof).toHaveLength(15);
      expect(fallbackProof.iconProof.every((icon: { visible: boolean; target: number; shape: [number, number]; contrast: number }) =>
        icon.visible && icon.target >= 44 && icon.shape[0] > 0 && icon.shape[1] > 0 && icon.contrast >= 3)).toBe(true);
      expect(fallbackProof.afterCalls).toBe(fallbackProof.before.calls);
      expect(fallbackProof.audit).toMatchObject({ documentHash: true, sourceHash: true, identityOutsideAudit: true });
      expect(fallbackProof.groups).toMatchObject({ keys: workspaceGroups, counts: [3,5,3,3,1], legacyRemoved: true });
    });
    expect(apiRequests.every(request => request.method === "GET" || request.path.endsWith("/invoices/search"))).toBe(true);
    const todayRequests = apiRequests.filter(request => request.path.includes("/reservation-board?"));
    expect(todayRequests.length).toBeGreaterThanOrEqual(15);
    expect(todayRequests.length % 3).toBe(0);
    for (const status of Object.keys(todayRows)) {
      expect(todayRequests.filter(request => new URL(request.path, "http://fixture.test").searchParams.get("status") === status)).toHaveLength(todayRequests.length / 3);
    }
    expect(todayFixtureWindows).toHaveLength(todayRequests.length);
    for(const fixture of todayFixtureWindows){
      const from=Date.parse(fixture.from),to=Date.parse(fixture.to),stayFrom=Date.parse(fixture.stayFrom),stayTo=Date.parse(fixture.stayTo);
      expect(Number.isFinite(from)&&Number.isFinite(to)&&to>from,`${fixture.status} bounded synthetic Today window`).toBe(true);
      if(fixture.status==='due_in')expect(stayFrom>=from&&stayFrom<to&&stayTo>to,`${fixture.status} fixture matches window`).toBe(true);
      if(fixture.status==='due_out')expect(stayFrom<from&&stayTo>=from&&stayTo<to,`${fixture.status} fixture matches window`).toBe(true);
      if(fixture.status==='in_house')expect(stayFrom<from&&stayTo>to,`${fixture.status} fixture spans window`).toBe(true);
    }
  } finally { server.stop(true); await rm(temporary,{recursive:true,force:true}); }
}, 120_000);
