(() => {
 "use strict";

 const SKINS = new Set(["ledger", "aura", "relay", "journey", "orbit", "atlas", "focus", "index"]);
 const ROLE_SELECTORS = Object.freeze({
  context: ".section-heading,.invoice-workbench__toolbar,.management-journey-index",
  queue: ".invoice-workbench__queue,.reservation-board-table-wrap,.folio-statement,.today-lane-list",
  detail: ".invoice-workbench__detail,.reservation-detail-drawer,#folio-workspace",
 });
 const CHAPTERS = Object.freeze([
  { id: "due_in", label: "Due in" },
  { id: "due_out", label: "Due out" },
  { id: "in_house", label: "In house" },
 ]);

 const root = document.documentElement;
 const workbench = document.getElementById("workbench-view");
 const workspaceSkinSelect = document.getElementById("workspace-skin-select");
 const domainBar = workbench?.querySelector(".domain-bar");
 const domainNav = domainBar?.querySelector(".domain-nav");
 const workspaceNavigation = document.getElementById("workspace-navigation");
 if (!workbench || !domainBar || !domainNav) return;

 let chapter = "due_in";
 let launcherReturn = null;
 let groupDisclosure = null;
 let navigationDisclosureOpen = null;
 let scheduled = false;
 const laneSemantics = new WeakMap();

 const tools = document.createElement("section");
 tools.className = "operator-layout-tools";
 tools.dataset.layoutOwned = "";
 tools.setAttribute("aria-label", "Workspace presentation tools");

 const launcher = document.createElement("button");
 launcher.id = "layout-workspace-launcher";
 launcher.className = "quiet layout-workspace-launcher";
 launcher.type = "button";
 launcher.textContent = "Find a workspace";
 launcher.setAttribute("aria-controls", "workspace-domain-navigation");
 launcher.setAttribute("aria-expanded", "false");
 domainNav.id ||= "workspace-domain-navigation";

 const chapterNav = document.createElement("div");
 chapterNav.className = "layout-chapter-nav";
 chapterNav.setAttribute("role", "tablist");
 chapterNav.setAttribute("aria-label", "Today chapters");
 for (const item of CHAPTERS) {
  const button = document.createElement("button");
  button.className = "quiet layout-chapter-choice";
  button.type = "button";
  button.setAttribute("role", "tab");
  button.dataset.layoutChapterChoice = item.id;
  button.id = `layout-chapter-${item.id.replace("_", "-")}`;
  button.textContent = item.label;
  button.setAttribute("aria-controls", `today-${item.id.replace("_", "-")}-chapter`);
  chapterNav.append(button);
 }

 const focusAction = document.createElement("button");
 focusAction.className = "quiet layout-focus-action";
 focusAction.type = "button";
 focusAction.textContent = "Focus current task";
 tools.append(launcher, chapterNav, focusAction);
 domainBar.before(tools);

 function selectedSkin() {
  return SKINS.has(root.dataset.workspaceSkin) ? root.dataset.workspaceSkin : "ledger";
 }

 function visibleRoute() {
  return [...workbench.children].find(element =>
   element instanceof HTMLElement && element.matches('section[id$="-view"]') && !element.hidden
  ) || null;
 }

 function clearManagedRegions() {
  for (const element of workbench.querySelectorAll("[data-layout-managed]")) {
   element.classList.remove("layout-region", "is-layout-active", "is-layout-current");
   delete element.dataset.layoutManaged;
   delete element.dataset.layoutRole;
   delete element.dataset.layoutView;
   if (!element.matches("[data-today-lane]")) delete element.dataset.layoutChapter;
  }
 }

 function mark(element, role) {
  if (!(element instanceof HTMLElement)) return;
  element.classList.add("layout-region");
  element.dataset.layoutManaged = "";
  element.dataset.layoutRole = role;
 }

 function isRendered(element) {
  if (!(element instanceof HTMLElement) || element.closest("[hidden],[inert]")) return false;
  let disclosure = element.closest("details");
  while (disclosure) {
   const summary = disclosure.querySelector(":scope > summary");
   if (!disclosure.open && !summary?.contains(element)) return false;
   disclosure = disclosure.parentElement?.closest("details") || null;
  }
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
 }

 function taskRegion(route) {
  const controls = route.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)");
  for (const control of controls) {
   if (!isRendered(control)) continue;
   const region = control.closest(".card,.reservation-board-card,article,[data-today-lane],form");
   if (region && region !== route) return region;
  }
  return [...route.querySelectorAll('[data-layout-role="queue"],[data-layout-role="detail"]')].find(isRendered) || null;
 }

 function updateChapters(skin) {
  const lanes = [...document.querySelectorAll("[data-today-lane]")];
  for (const lane of lanes) {
   const id = lane.dataset.todayLane;
   if (!laneSemantics.has(lane)) laneSemantics.set(lane, {
    role: lane.getAttribute("role"),
    labelledBy: lane.getAttribute("aria-labelledby"),
    tabIndex: lane.getAttribute("tabindex"),
   });
   lane.id ||= `today-${id.replace("_", "-")}-chapter`;
   mark(lane, "chapter");
   lane.dataset.layoutChapter = id;
   lane.classList.toggle("is-layout-current", skin === "journey" && id === chapter);
   const original = laneSemantics.get(lane);
   if (skin === "journey") {
    lane.setAttribute("role", "tabpanel");
    lane.setAttribute("aria-labelledby", `layout-chapter-${id.replace("_", "-")}`);
    lane.setAttribute("tabindex", "-1");
   } else {
    if (original.role === null) lane.removeAttribute("role"); else lane.setAttribute("role", original.role);
    if (original.labelledBy === null) lane.removeAttribute("aria-labelledby"); else lane.setAttribute("aria-labelledby", original.labelledBy);
    if (original.tabIndex === null) lane.removeAttribute("tabindex"); else lane.setAttribute("tabindex", original.tabIndex);
   }
  }
  for (const button of chapterNav.querySelectorAll("[data-layout-chapter-choice]")) {
   const selected = button.dataset.layoutChapterChoice === chapter;
   button.setAttribute("aria-selected", String(selected));
   button.tabIndex = selected ? 0 : -1;
  }
 }

 function annotate() {
  scheduled = false;
  if (workbench.hidden) closeLauncher({ restoreDisclosure: false, restoreFocus: false });
  const skin = selectedSkin();
  const route = visibleRoute();
  clearManagedRegions();
  workbench.classList.add("layout-composition");
  workbench.dataset.layoutSkin = skin;
  if (route) {
   mark(route, "record");
   route.classList.add("is-layout-active");
   route.dataset.layoutView = route.id.replace(/-view$/, "");
   for (const [role, selector] of Object.entries(ROLE_SELECTORS)) {
    for (const element of route.querySelectorAll(selector)) mark(element, role);
   }
  }
  updateChapters(skin);
  if (route && skin === "focus") mark(taskRegion(route), "task");
  root.dataset.layoutController = "ready";
 }

 function scheduleAnnotate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(annotate);
 }

 function closeLauncher({ restoreDisclosure = true, restoreFocus = false } = {}) {
  if (workbench.dataset.layoutLauncher !== "open") return;
  delete workbench.dataset.layoutLauncher;
  launcher.setAttribute("aria-expanded", "false");
  if (restoreDisclosure && groupDisclosure) {
   for (const [group, wasOpen] of groupDisclosure) group.open = wasOpen;
  }
  if (restoreDisclosure && navigationDisclosureOpen !== null && workspaceNavigation instanceof HTMLDetailsElement) {
   workspaceNavigation.open = navigationDisclosureOpen;
  }
  groupDisclosure = null;
  navigationDisclosureOpen = null;
  if (restoreFocus && launcherReturn?.isConnected) launcherReturn.focus({ preventScroll: true });
  launcherReturn = null;
 }

 function openLauncher() {
  if (selectedSkin() !== "orbit") return;
  if (workbench.dataset.layoutLauncher === "open") {
   closeLauncher({ restoreFocus: true });
   return;
  }
  launcherReturn = launcher;
  navigationDisclosureOpen = workspaceNavigation instanceof HTMLDetailsElement ? workspaceNavigation.open : null;
  groupDisclosure = new Map([...domainNav.querySelectorAll(".workspace-group")].map(group => [group, group.open]));
  if (workspaceNavigation instanceof HTMLDetailsElement) workspaceNavigation.open = true;
  for (const group of groupDisclosure.keys()) group.open = true;
  workbench.dataset.layoutLauncher = "open";
  launcher.setAttribute("aria-expanded", "true");
  const current = domainNav.querySelector('[data-view][aria-current="page"]');
  (current || domainNav.querySelector("[data-view]"))?.focus({ preventScroll: true });
 }

 launcher.addEventListener("click", openLauncher);
domainNav.addEventListener("click", event => {
  const requested = event.target instanceof Element ? event.target.closest("[data-view]") : null;
  if (!requested) return;
  if (workbench.dataset.layoutLauncher === "open") {
   closeLauncher({ restoreDisclosure: false, restoreFocus: false });
  }
 });
 document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || workbench.dataset.layoutLauncher !== "open") return;
  event.preventDefault();
  event.stopPropagation();
  closeLauncher({ restoreFocus: true });
 });

 chapterNav.addEventListener("click", event => {
  const button = event.target instanceof Element ? event.target.closest("[data-layout-chapter-choice]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  if (selectedSkin() !== "journey") return;
  chapter = button.dataset.layoutChapterChoice;
  annotate();
  const lane = document.querySelector(`[data-today-lane="${chapter}"]`);
  lane?.focus({ preventScroll: true });
  lane?.scrollIntoView({ block: "nearest", behavior: root.dataset.interfaceMotion === "reduced" ? "auto" : "smooth" });
 });
chapterNav.addEventListener("keydown", event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  if (selectedSkin() !== "journey") return;
  const buttons = [...chapterNav.querySelectorAll("[data-layout-chapter-choice]")];
  const current = Math.max(0, buttons.indexOf(document.activeElement));
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
   (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault();
  chapter = buttons[next].dataset.layoutChapterChoice;
  annotate();
  buttons[next].focus({ preventScroll: true });
 });

 focusAction.addEventListener("click", () => {
  if (selectedSkin() !== "focus") return;
  const route = visibleRoute();
  if (!route) return;
  const region = taskRegion(route);
  const target = [...(region || route).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].find(isRendered);
  const fallback = route.querySelector("h2") || route;
  if (!target && !fallback.hasAttribute("tabindex")) fallback.setAttribute("tabindex", "-1");
  const destination = target || fallback;
  destination.focus({ preventScroll: true });
  destination.scrollIntoView({ block: "nearest", behavior: root.dataset.interfaceMotion === "reduced" ? "auto" : "smooth" });
 });

 workspaceSkinSelect?.addEventListener("change", () => {
  if (selectedSkin() !== "orbit") closeLauncher({ restoreFocus: false });
  scheduleAnnotate();
 });
 new MutationObserver(scheduleAnnotate).observe(workbench, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden"],
 });
 new MutationObserver(scheduleAnnotate).observe(root, {
  attributes: true,
  attributeFilter: ["data-workspace-skin"],
 });
 annotate();
})();
