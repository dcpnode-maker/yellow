(() => {
  "use strict";
  const parts = location.pathname.split("/").filter(Boolean);
  const isReturn = parts[0] === "pay-return";
  const token = parts[0] === "pay" || isReturn ? parts[1] : "";
  const generation = { value: 0 };
  const card = document.querySelector(".card");
  const message = document.getElementById("message");
  const list = document.querySelector("dl");
  const form = document.getElementById("continue");
  const button = form.querySelector("button");
  const refresh = document.getElementById("refresh");
  form.action = isReturn ? "" : `/pay/${encodeURIComponent(token)}/continue`;
  if (isReturn) form.hidden = true;
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  async function load() {
    const current = ++generation.value;
    card.setAttribute("aria-busy", "true"); button.disabled = true;
    try {
      const response = await fetch(`${isReturn ? "/api/public/hosted-deposit-returns/" : "/api/public/hosted-deposits/"}${encodeURIComponent(token)}`, {
        credentials: "omit", cache: "no-store", headers: { accept: "application/json" }, redirect: "error"
      });
      if (!response.ok) throw new Error("unavailable");
      const value = await response.json();
      if (current !== generation.value || token !== parts[1]) return;
      text("property", String(value.propertyName)); text("folio", String(value.folioReference));
      text("amount", `${value.currency} ${value.amountMinor}`); text("expiry", new Date(value.expiresAt).toLocaleString());
      list.hidden = false; message.textContent = value.state === "captured" ? "Deposit received." :
        value.state === "ready" || value.state === "processing" ? "Details verified by Yellow." : `This link is ${value.state}.`;
      button.disabled = value.state !== "ready" && value.state !== "processing";
    } catch { if (current === generation.value) message.textContent = "This deposit link is unavailable."; }
    finally { if (current === generation.value) card.setAttribute("aria-busy", "false"); }
  }
  refresh.addEventListener("click", load); load();
})();
