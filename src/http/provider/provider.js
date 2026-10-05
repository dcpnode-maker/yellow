(() => {
  "use strict";
  const handoff = new URL(location.href).searchParams.get("handoff") || "";
  const summary = document.getElementById("summary"); const actions = document.getElementById("actions");
  const handoffField = document.getElementById("handoff");
  async function boot() {
    const response = await fetch(`/api/provider/local-deposit/handoff?handoff=${encodeURIComponent(handoff)}`,
      { credentials:"omit", cache:"no-store", redirect:"error", headers:{accept:"application/json"} });
    if (!response.ok) { summary.textContent="This signed handoff is invalid or expired."; return; }
    const value = await response.json(); summary.textContent=`Deposit ${value.currency} ${value.amountMinor}`;
    handoffField.value=handoff; actions.hidden=false;
  }
  boot().catch(() => { summary.textContent="The signed handoff is unavailable."; });
})();
