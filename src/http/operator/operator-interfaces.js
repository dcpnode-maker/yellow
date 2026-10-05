/**
 * Order458: optional presentation enhancement. No data, networking, authentication,
 * navigation or business command authority belongs in this module. Skin selection
 * delegates to the existing, pure workspace selector and never remounts a form.
 */
(() => {
  "use strict";
  const root = document.documentElement;
  const select = document.querySelector("#workspace-skin-select");
  const dialog = document.querySelector("#interface-gallery");
  const grid = document.querySelector("#interface-gallery-grid");
  const open = document.querySelector("#interface-gallery-open");
  const close = document.querySelector("#interface-gallery-close");
  const motion = document.querySelector("#interface-motion-select");
  const depth = document.querySelector("#interface-depth-play");
  const note = document.querySelector("#interface-motion-note");
  const status = document.querySelector("#interface-gallery-status");
  const workbench = document.querySelector("#workbench-view");
  if (!select || !dialog || !grid || !open || !close || !motion || !depth || !note || !status) return;

  const interfaces = Object.freeze([
    ["ledger", "03", "Ledger", "Precision desk", "A crisp navigation rail, aligned records and a side-by-side inspector."],
    ["aura", "04", "Aura", "Spatial glass", "Translucent dock, luminous edges and layered work surfaces in daylight."],
    ["relay", "05", "Relay", "Operations board", "A wide operational canvas with clearly separated arrival and service queues."],
    ["journey", "06", "Journey", "Guided workspace", "A calm, chapter-led workspace that brings the next step into focus."],
    ["orbit", "07", "Orbit", "Command centre", "An intent-centred composition with evidence kept close to the work."],
    ["atlas", "08", "Atlas", "Portfolio studio", "An airy property studio with contextual cards and room to compare."],
    ["focus", "09", "Focus", "Task companion", "Large touch targets and a single task column, on phone or desktop."],
    ["index", "10", "Index", "Planning desk", "A precise planning surface with tabular rhythm and compact context."],
  ]);
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let returnFocus = null;
  let pointerFrame = 0;
  let pointerCard = null;
  let pointerX = 0;
  let pointerY = 0;
  let enteringTimer = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The miniatures are abstract layout diagrams, not fictional hotel statistics.
  for (const [id, number, name, subtitle, description] of interfaces) {
    const button = element("button", "interface-choice");
    button.type = "button";
    button.dataset.interfaceChoice = id;
    button.setAttribute("aria-label", `${name}: ${subtitle}. ${description}`);
    button.setAttribute("aria-pressed", "false");
    const miniature = element("span", "interface-miniature");
    miniature.setAttribute("aria-hidden", "true");
    miniature.append(element("span", "mini-nav"), element("span", "mini-head"));
    for (const suffix of ["one", "two", "three"]) {
      const panel = element("span", `mini-panel mini-panel-${suffix}`);
      for (let line = 0; line < 3; line += 1) panel.append(element("span", "mini-line"));
      miniature.append(panel);
    }
    miniature.append(element("span", "mini-orbit"), element("span", "mini-tile"));
    const copy = element("span", "interface-choice-copy");
    copy.append(element("span", "interface-number", `${number} / ${subtitle}`),
      element("strong", "interface-name", name), element("span", "interface-description", description));
    button.append(miniature, copy);
    button.addEventListener("click", () => {
      select.value = id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      dismiss();
    });
    grid.append(button);
  }

  function syncSelection() {
    for (const button of grid.querySelectorAll("[data-interface-choice]")) {
      button.setAttribute("aria-pressed", String(button.dataset.interfaceChoice === select.value));
    }
    const current = interfaces.find(([id]) => id === select.value);
    status.textContent = current ? `${current[2]} selected. Your records and work in progress are unchanged.` : "";
  }

  function clearPointer() {
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    if (pointerCard) {
      pointerCard.style.removeProperty("--pointer-x");
      pointerCard.style.removeProperty("--pointer-y");
      pointerCard.removeAttribute("data-depth");
    }
    pointerCard = null;
  }

  function applyMotion() {
    const reduced = preference.matches || motion.value === "reduced";
    root.dataset.interfaceMotion = reduced ? "reduced" : "spatial";
    depth.disabled = reduced;
    if (reduced) {
      clearPointer();
      dialog.removeAttribute("data-exploded");
      depth.setAttribute("aria-pressed", "false");
      depth.textContent = "Explore depth";
      window.clearTimeout(enteringTimer);
      workbench?.classList.remove("is-interface-entering");
    }
    note.textContent = preference.matches
      ? "Your system’s reduced-motion preference is active. Every interface remains available without spatial motion."
      : reduced ? "Reduced motion is active. Every layout and action remains available."
        : "Spatial previews respond to your pointer. Explore depth separates their layers; keyboard and touch also work.";
  }

  function reveal() {
    if (!workbench || workbench.hidden || root.dataset.interfaceMotion !== "spatial") return;
    window.clearTimeout(enteringTimer);
    workbench.classList.remove("is-interface-entering");
    // One finite transition, never a render loop or delay before an action.
    window.requestAnimationFrame(() => {
      if (root.dataset.interfaceMotion !== "spatial" || workbench.hidden) return;
      workbench.classList.add("is-interface-entering");
      enteringTimer = window.setTimeout(() => workbench.classList.remove("is-interface-entering"), 420);
    });
  }

  function dismiss() {
    clearPointer();
    dialog.close();
  }

  open.addEventListener("click", () => {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    syncSelection();
    dialog.showModal();
    grid.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  close.addEventListener("click", dismiss);
  dialog.addEventListener("close", () => {
    clearPointer();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
  dialog.addEventListener("cancel", clearPointer);
  dialog.addEventListener("click", event => { if (event.target === dialog) dismiss(); });
  depth.addEventListener("click", () => {
    if (root.dataset.interfaceMotion !== "spatial") return;
    const exploded = dialog.dataset.exploded !== "true";
    dialog.dataset.exploded = String(exploded);
    depth.setAttribute("aria-pressed", String(exploded));
    depth.textContent = exploded ? "Settle layers" : "Explore depth";
  });
  grid.addEventListener("pointermove", event => {
    if (root.dataset.interfaceMotion !== "spatial" || !finePointer.matches) return;
    const card = event.target.closest(".interface-choice");
    if (!card) return clearPointer();
    if (pointerCard !== card) { clearPointer(); pointerCard = card; }
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (pointerFrame) return;
    pointerFrame = window.requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!pointerCard || !dialog.open) return;
      const bounds = pointerCard.getBoundingClientRect();
      const x = Math.max(-.5, Math.min(.5, (pointerX - bounds.left) / Math.max(bounds.width, 1) - .5));
      const y = Math.max(-.5, Math.min(.5, (pointerY - bounds.top) / Math.max(bounds.height, 1) - .5));
      pointerCard.style.setProperty("--pointer-x", String(x));
      pointerCard.style.setProperty("--pointer-y", String(y));
      pointerCard.dataset.depth = "on";
    });
  });
  grid.addEventListener("pointerleave", clearPointer);
  grid.addEventListener("pointercancel", clearPointer);
  select.addEventListener("change", () => { syncSelection(); clearPointer(); reveal(); });
  motion.addEventListener("change", applyMotion);
  preference.addEventListener("change", applyMotion);
  finePointer.addEventListener("change", clearPointer);
  // Observe only the finite, mounted route roots. Never observe guest text or forms.
  const routeObserver = new MutationObserver(records => {
    if (records.some(record => record.target instanceof HTMLElement && !record.target.hidden)) reveal();
  });
  if (workbench) {
    routeObserver.observe(workbench, { attributes: true, attributeFilter: ["hidden"] });
    for (const section of workbench.children) {
      if (section.tagName === "SECTION") routeObserver.observe(section, { attributes: true, attributeFilter: ["hidden"] });
    }
  }
  window.addEventListener("pagehide", () => {
    clearPointer();
    window.clearTimeout(enteringTimer);
  });
  applyMotion();
  syncSelection();
})();
