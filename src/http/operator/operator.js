(() => {
  "use strict";

  let accessToken = "";
  let operator = null;
  let activeView = "availability";
  let inventoryData = { unitTypes: [], spaces: [], sellableUnits: [] };
  const pendingKeys = new Map();

  const loginView = document.querySelector("#login-view");
  const workbenchView = document.querySelector("#workbench-view");
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  const availabilityForm = document.querySelector("#availability-form");
  const propertySelect = document.querySelector("#property-select");
  const results = document.querySelector("#results");
  const resultSummary = document.querySelector("#result-summary");
  const sessionState = document.querySelector("#session-state");
  const operatorName = document.querySelector("#operator-name");
  const signOutButton = document.querySelector("#sign-out");
  const themeSelect = document.querySelector("#theme-select");
  const workbenchTitle = document.querySelector("#workbench-title");
  const availabilityView = document.querySelector("#availability-view");
  const inventoryView = document.querySelector("#inventory-view");
  const navigation = document.querySelectorAll(".domain-tab");
  const refreshInventory = document.querySelector("#refresh-inventory");
  const inventoryStatus = document.querySelector("#inventory-status");
  const unitTypeList = document.querySelector("#unit-type-list");
  const spaceList = document.querySelector("#space-list");
  const sellableList = document.querySelector("#sellable-list");
  const unitTypeCount = document.querySelector("#unit-type-count");
  const spaceCount = document.querySelector("#space-count");
  const sellableCount = document.querySelector("#sellable-count");
  const unitTypeForm = document.querySelector("#unit-type-form");
  const spaceForm = document.querySelector("#space-form");
  const sellableForm = document.querySelector("#sellable-unit-form");
  const sellableUnitType = document.querySelector("#sellable-unit-type");
  const sellableSpace = document.querySelector("#sellable-space");

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === "pixel" ? "pixel" : "apple";
  }

  function localInputValue(date) {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function initializeDates() {
    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(15, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 2);
    availabilityForm.elements.from.value = localInputValue(from);
    availabilityForm.elements.to.value = localInputValue(to);
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("content-type", "application/json");
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    const response = await fetch(path, { ...options, headers });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const message = body && typeof body.detail === "string" ? body.detail : "The request could not be completed";
      throw new Error(message);
    }
    return body;
  }

  function setLoginMessage(message, isError = false) {
    loginMessage.textContent = message;
    loginMessage.classList.toggle("error", isError);
  }

  function showLogin() {
    accessToken = "";
    operator = null;
    loginView.hidden = false;
    workbenchView.hidden = true;
    sessionState.textContent = "Local review · signed out";
    results.replaceChildren();
    inventoryData = { unitTypes: [], spaces: [], sellableUnits: [] };
    pendingKeys.clear();
    history.replaceState(null, "", "/");
    loginForm.elements.password.value = "";
    loginForm.elements.email.focus();
  }

  async function loadProperties() {
    const body = await request("/api/v1/me/properties");
    propertySelect.replaceChildren();
    for (const property of body.properties) {
      const option = document.createElement("option");
      option.value = property.id;
      option.textContent = `${property.name} · ${property.timezone}`;
      propertySelect.append(option);
    }
    if (body.properties.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No granted properties";
      option.value = "";
      propertySelect.append(option);
      propertySelect.disabled = true;
    } else {
      propertySelect.disabled = false;
      const pathProperty = location.pathname.match(/^\/p\/([0-9a-f-]+)\/(?:availability|inventory)$/)?.[1];
      if (pathProperty && body.properties.some(({ id }) => id === pathProperty)) propertySelect.value = pathProperty;
    }
  }

  function showWorkbench() {
    loginView.hidden = true;
    workbenchView.hidden = false;
    sessionState.textContent = `${operator.displayName} · authenticated`;
    operatorName.textContent = `Signed in as ${operator.displayName}. Results come from live tenant-scoped PostgreSQL truth.`;
    propertySelect.focus();
    setView(activeView, false);
  }

  function emptyList(container, message) {
    const item = document.createElement("p");
    item.className = "list-empty";
    item.textContent = message;
    container.replaceChildren(item);
  }

  function inventoryItem(titleText, detailText, badgeText) {
    const item = document.createElement("article");
    item.className = "inventory-item";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = titleText;
    const detail = document.createElement("span");
    detail.textContent = detailText;
    copy.append(title, detail);
    const badge = document.createElement("span");
    badge.className = "mini-badge";
    badge.textContent = badgeText;
    item.append(copy, badge);
    return item;
  }

  function populateSelect(select, items, label, value) {
    select.replaceChildren();
    if (items.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = `Create a ${label} first`;
      select.append(option);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = value(item);
      select.append(option);
    }
  }

  function renderInventory() {
    unitTypeCount.textContent = String(inventoryData.unitTypes.length);
    spaceCount.textContent = String(inventoryData.spaces.length);
    sellableCount.textContent = String(inventoryData.sellableUnits.length);

    unitTypeList.replaceChildren(...inventoryData.unitTypes.map((item) =>
      inventoryItem(item.name, `${item.baseOccupancy} base · ${item.maxOccupancy} max`, item.code)
    ));
    spaceList.replaceChildren(...inventoryData.spaces.map((item) =>
      inventoryItem(`Space ${item.code}`, item.floor ? `Floor ${item.floor}` : "Floor not set", item.status)
    ));
    sellableList.replaceChildren(...inventoryData.sellableUnits.map((item) =>
      inventoryItem(item.name, item.spaces.map((space) => space.code).join(", "), item.unitTypeCode)
    ));
    if (inventoryData.unitTypes.length === 0) emptyList(unitTypeList, "No room types yet.");
    if (inventoryData.spaces.length === 0) emptyList(spaceList, "No physical spaces yet.");
    if (inventoryData.sellableUnits.length === 0) emptyList(sellableList, "No sellable units yet.");
    populateSelect(sellableUnitType, inventoryData.unitTypes, "room type", (item) => `${item.code} · ${item.name}`);
    populateSelect(sellableSpace, inventoryData.spaces, "physical space", (item) => item.code);
  }

  async function loadInventory() {
    const property = propertySelect.value;
    if (!property) return;
    inventoryStatus.textContent = "Loading live inventory…";
    try {
      inventoryData = await request(`/api/v1/properties/${encodeURIComponent(property)}/inventory`);
      renderInventory();
      inventoryStatus.textContent = "Inventory is current from tenant-scoped PostgreSQL.";
    } catch (error) {
      inventoryStatus.textContent = error instanceof Error ? error.message : "Inventory could not be loaded";
    }
  }

  function setView(view, updateHistory = true) {
    activeView = view === "inventory" ? "inventory" : "availability";
    availabilityView.hidden = activeView !== "availability";
    inventoryView.hidden = activeView !== "inventory";
    workbenchTitle.textContent = activeView === "inventory" ? "Inventory setup" : "Availability";
    for (const tab of navigation) {
      const selected = tab.dataset.view === activeView;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    }
    if (propertySelect.value && updateHistory) {
      history.pushState(null, "", `/p/${propertySelect.value}/${activeView}`);
    }
    if (activeView === "inventory") void loadInventory();
  }

  function formMessage(form, message, isError = false) {
    const target = form.querySelector(".form-message");
    target.textContent = message;
    target.classList.toggle("error", isError);
  }

  async function submitInventory(form, route, body) {
    const button = form.querySelector("button[type=submit]");
    const identity = `${route}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    formMessage(form, "Saving through the audited inventory service…");
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/inventory/${route}`, {
        method: "POST",
        headers: { "idempotency-key": key },
        body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      formMessage(form, "Saved. Audit fact and event committed.");
      await loadInventory();
      return true;
    } catch (error) {
      formMessage(form, error instanceof Error ? error.message : "Save failed", true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  function causeNode(cause, type) {
    const item = document.createElement("li");
    item.className = `cause ${cause.blocks ? "blocking" : "warning"}`;
    const title = document.createElement("strong");
    title.textContent = type === "restriction" ? `Restriction · ${cause.kind}` : `${cause.kind.toUpperCase()} · ${cause.blocks ? "blocks sale" : "warning only"}`;
    const detail = document.createElement("span");
    detail.textContent = type === "restriction"
      ? (cause.value === null ? "Rule is active" : `Rule value: ${cause.value}`)
      : (cause.reason || "No reason recorded");
    item.append(title, detail);
    return item;
  }

  function renderOptions(options) {
    results.replaceChildren();
    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No active sellable configurations fit this search. Inventory setup may still be required.";
      results.append(empty);
      resultSummary.textContent = "No options returned.";
      return;
    }

    const bookable = options.filter((option) => option.bookable).length;
    resultSummary.textContent = `${options.length} option${options.length === 1 ? "" : "s"} · ${bookable} bookable`;
    for (const option of options) {
      const card = document.createElement("article");
      card.className = `option-card ${option.bookable ? "" : "is-blocked"}`;
      const head = document.createElement("div");
      head.className = "option-head";
      const identity = document.createElement("div");
      const name = document.createElement("h2");
      name.textContent = option.sellableUnitName;
      const code = document.createElement("div");
      code.className = "code";
      code.textContent = `${option.unitTypeCode} · max ${option.maxOccupancy}`;
      identity.append(name, code);
      const count = document.createElement("div");
      count.className = "count";
      const number = document.createElement("strong");
      number.textContent = String(option.availableCount);
      const countLabel = document.createElement("span");
      countLabel.textContent = "physically free";
      count.append(number, countLabel);
      head.append(identity, count);

      const badge = document.createElement("span");
      badge.className = `badge ${option.bookable ? "available" : "blocked"}`;
      badge.textContent = option.bookable ? "Bookable" : "Not bookable";
      card.append(head, badge);

      const causes = document.createElement("ul");
      causes.className = "cause-list";
      for (const restriction of option.restrictionsApplied) causes.append(causeNode(restriction, "restriction"));
      for (const block of option.operationalBlocksApplied) causes.append(causeNode(block, "operational"));
      if (causes.childElementCount > 0) card.append(causes);
      results.append(card);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    setLoginMessage("Checking credentials…");
    try {
      const fields = new FormData(loginForm);
      const body = await request("/api/v1/auth/local:login", {
        method: "POST",
        body: JSON.stringify({
          tenant: fields.get("tenant"),
          email: fields.get("email"),
          password: fields.get("password"),
        }),
      });
      accessToken = body.accessToken;
      operator = body.user;
      loginForm.elements.password.value = "";
      await loadProperties();
      showWorkbench();
      setLoginMessage("");
    } catch (error) {
      accessToken = "";
      setLoginMessage(error instanceof Error ? error.message : "Sign-in failed", true);
    } finally {
      button.disabled = false;
    }
  });

  availabilityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = availabilityForm.querySelector("button[type=submit]");
    button.disabled = true;
    resultSummary.textContent = "Searching PostgreSQL truth…";
    results.replaceChildren();
    try {
      const fields = new FormData(availabilityForm);
      const property = propertySelect.value;
      const from = new Date(String(fields.get("from")));
      const to = new Date(String(fields.get("to")));
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/availability:search`, {
        method: "POST",
        body: JSON.stringify({
          from: from.toISOString(),
          to: to.toISOString(),
          partySize: Number(fields.get("partySize")),
        }),
      });
      history.pushState(null, "", `/p/${property}/availability`);
      renderOptions(body.options);
    } catch (error) {
      resultSummary.textContent = error instanceof Error ? error.message : "Search failed";
    } finally {
      button.disabled = false;
    }
  });

  propertySelect.addEventListener("change", () => {
    if (propertySelect.value) history.replaceState(null, "", `/p/${propertySelect.value}/${activeView}`);
    if (activeView === "inventory") void loadInventory();
  });
  for (const tab of navigation) tab.addEventListener("click", () => setView(tab.dataset.view));
  refreshInventory.addEventListener("click", () => void loadInventory());
  unitTypeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(unitTypeForm);
    const saved = await submitInventory(unitTypeForm, "unit-types", {
      code: fields.get("code"), name: fields.get("name"), profileKey: "hotel",
      baseOccupancy: Number(fields.get("baseOccupancy")),
      maxOccupancy: Number(fields.get("maxOccupancy")),
    });
    if (saved) unitTypeForm.elements.code.value = unitTypeForm.elements.name.value = "";
  });
  spaceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(spaceForm);
    const floor = String(fields.get("floor") || "");
    const body = {
      code: fields.get("code"), profileKey: "hotel", capacity: Number(fields.get("capacity")),
      ...(floor ? { floor } : {}),
    };
    const saved = await submitInventory(spaceForm, "spaces", body);
    if (saved) spaceForm.elements.code.value = spaceForm.elements.floor.value = "";
  });
  sellableForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(sellableForm);
    const saved = await submitInventory(sellableForm, "sellable-units", {
      unitTypeId: fields.get("unitTypeId"), name: fields.get("name"),
      spaces: [{ spaceId: fields.get("spaceId"), claimMode: "exclusive" }],
    });
    if (saved) sellableForm.elements.name.value = "";
  });
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  signOutButton.addEventListener("click", showLogin);
  applyTheme(themeSelect.value);
  initializeDates();
  const initialView = location.pathname.endsWith("/inventory") ? "inventory" : "availability";
  setView(initialView, false);
})();
