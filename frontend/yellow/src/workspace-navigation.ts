export type WorkspacePart = "today" | "reservations" | "guests" | "housekeeping" | "operations" | "ecosystem" | "market-lab" | "rates" | "finance" | "settings";
export type WorkspaceRoute = Readonly<{
  workspace: WorkspacePart; reservationId: string | null;
  lane: "due_in" | "due_out" | "in_house" | null;
  guest: string; financeReservation: string | null; search: string;
}>;

export function readWorkspaceRoute(href: string, internalMarketLabEnabled = false): WorkspaceRoute {
  const url = new URL(href, "https://yellow.invalid");
  const query = url.searchParams;
  const requested = query.get("workspace");
  const path = /^\/p\/[^/]+\/(today|reservations|guests|housekeeping|operations|ecosystem)$/.exec(url.pathname)?.[1];
  const workspace: WorkspacePart = requested === "rates" || requested === "finance" || requested === "settings" ||
    requested === "operations" || requested === "ecosystem" || (requested === "market-lab" && internalMarketLabEnabled)
    ? requested : path ? path as WorkspacePart : "today";
  const lane = query.get("lane");
  return { workspace, reservationId: /^\/p\/[^/]+\/res\/([^/]+)$/.exec(url.pathname)?.[1] ?? null,
    lane: lane === "due_in" || lane === "due_out" || lane === "in_house" ? lane : null,
    guest: query.get("guest")?.trim() ?? "", financeReservation: query.get("reservation")?.trim() || null, search: url.search };
}

export function softWorkspaceHref(href: string, currentHref: string, propertyId: string): string | null {
  const current = new URL(currentHref);
  const target = new URL(href, current);
  const route = /^\/p\/([^/]+)\/(?:today|reservations|guests|housekeeping|operations|ecosystem|res\/[^/]+)$/.exec(target.pathname);
  if (target.origin !== current.origin || target.username || target.password || route?.[1] !== propertyId || target.searchParams.get("legacy") === "1") return null;
  return target.pathname + target.search + target.hash;
}

type NavigationOptions = Readonly<{
  propertyId: string; canNavigate: () => boolean; onNavigate: (href: string) => void; browser?: Window;
}>;
// A mounted App owns this controller. Its property/API context is never rebound.
// Native navigation still owns new tabs, legacy screens and property switches.
export function createWorkspaceNavigation({ propertyId, canNavigate, onNavigate, browser = window }: NavigationOptions) {
  const relative = () => browser.location.pathname + browser.location.search + browser.location.hash;
  let acceptedHref = relative();
  let notifying = false;
  const allowed = () => canNavigate() && browser.dispatchEvent(new Event("beforeunload", { cancelable: true }));
  const publish = () => { acceptedHref = relative(); onNavigate(acceptedHref); };
  function navigate(href: string): boolean {
    const target = softWorkspaceHref(href, browser.location.href, propertyId);
    if (target === null) {
      if (!canNavigate()) return false;
      browser.location.assign(href);
      return true;
    }
    if (!allowed()) return false;
    if (target === acceptedHref) return true;
    browser.history.pushState(null, "", target);
    publish();
    // Existing reservation ribbon subscribers use this event as their URL signal.
    notifying = true;
    try { browser.dispatchEvent(new Event("popstate")); } finally { notifying = false; }
    return true;
  }
  const popstate = () => {
    if (notifying) return;
    if (softWorkspaceHref(browser.location.href, browser.location.href, propertyId) === null || !allowed()) {
      // Keep unfinished/recovery work mounted when Back would leave it.
      browser.history.pushState(null, "", acceptedHref);
      return;
    }
    publish();
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    const anchor = element?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self") ||
        anchor.rel.split(/\s+/).includes("external") || softWorkspaceHref(anchor.href, browser.location.href, propertyId) === null) return;
    event.preventDefault();
    navigate(anchor.href);
  };
  browser.addEventListener("popstate", popstate, true);
  browser.document.addEventListener("click", click);
  return { navigate, dispose() { browser.removeEventListener("popstate", popstate, true); browser.document.removeEventListener("click", click); } };
}

let active: ReturnType<typeof createWorkspaceNavigation> | null = null;
export function installWorkspaceNavigation(options: NavigationOptions): () => void {
  const controller = createWorkspaceNavigation(options);
  active = controller;
  return () => { controller.dispose(); if (active === controller) active = null; };
}
export function navigateYellow(href: string): void {
  if (active) active.navigate(href);
  else window.location.assign(href);
}
