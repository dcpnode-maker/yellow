import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPortfolioPage } from "../yellow-api";
import { propertyWorkspaceUrl, shouldLoadInitialPortfolioPage, type PortfolioNode } from "../portfolio-navigation";
import "./PortfolioExplorer.css";

type Props = Readonly<{ propertyId: string; propertyName: string; locked: boolean }>;
type LoadMode = "initial" | "more" | null;

const kindLabel: Record<PortfolioNode["kind"], string> = {
  group: "Group", brand: "Brand", region: "Region", property: "Property",
};

export function PortfolioExplorer({ propertyId, propertyName, locked }: Props) {
  const [open, setOpen] = useState(false);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [scopePath, setScopePath] = useState<readonly PortfolioNode[]>([]);
  const [nodes, setNodes] = useState<readonly PortfolioNode[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const version = useRef(0);
  const rowsRef = useRef<readonly PortfolioNode[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (requestedScope: string | null, after: string | null, mode: Exclude<LoadMode, null>) => {
    const requestVersion = ++version.current;
    setLoading(mode);
    setError(null);
    try {
      const page = await loadPortfolioPage({ scopeNode: requestedScope, after, limit: 50 });
      if (version.current !== requestVersion) return;
      if (after !== null && page.nextCursor === after) throw new Error("The portfolio page did not advance.");
      const current = mode === "initial" ? [] : rowsRef.current;
      const ids = new Set(current.map((node) => node.id));
      if (page.nodes.some((node) => ids.has(node.id))) throw new Error("The portfolio returned duplicate rows across pages.");
      if (current.length && page.nodes.length && page.nodes[0]!.id.toLowerCase() <= current.at(-1)!.id.toLowerCase()) throw new Error("The portfolio pages are out of order.");
      const combined = [...current, ...page.nodes];
      rowsRef.current = combined;
      setNodes(combined);
      setNextCursor(page.nextCursor);
      setHasLoaded(true);
      if (page.scope) setScopePath((path) => path.map((item) => item.id === page.scope!.id ? page.scope! : item));
    } catch (cause) {
      if (version.current !== requestVersion) return;
      rowsRef.current = [];
      setNodes([]);
      setNextCursor(null);
      setHasLoaded(true);
      setError(cause instanceof Error ? cause.message : "Portfolio choices are temporarily unavailable.");
    } finally {
      if (version.current === requestVersion) setLoading(null);
    }
  }, []);

  useEffect(() => {
    if (shouldLoadInitialPortfolioPage(open, hasLoaded, loading !== null, error !== null)) void fetchPage(scopeId, null, "initial");
  }, [open, scopeId, loading, hasLoaded, error, fetchPage]);

  useEffect(() => {
    if (!open || !portalRef.current) return;
    const wrapper = portalRef.current;
    const oldOverflow = document.body.style.overflow;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== wrapper);
    const wasInert = background.map((node) => node.inert);
    document.body.style.overflow = "hidden";
    background.forEach((node) => { node.inert = true; });
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']") ?? [])];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      background.forEach((node, index) => { node.inert = wasInert[index] ?? false; });
      document.removeEventListener("keydown", keydown);
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => () => { version.current += 1; }, []);

  const show = () => {
    if (locked) return;
    version.current += 1;
    setScopeId(null);
    setScopePath([]);
    rowsRef.current = [];
    setNodes([]);
    setNextCursor(null);
    setError(null);
    setHasLoaded(false);
    setLoading(null);
    setOpen(true);
  };
  const reload = () => {
    version.current += 1;
    rowsRef.current = [];
    setNodes([]);
    setNextCursor(null);
    setError(null);
    setHasLoaded(false);
    setLoading(null);
    void fetchPage(scopeId, null, "initial");
  };
  const enterScope = (node: PortfolioNode) => {
    version.current += 1;
    setScopeId(node.id);
    setScopePath((path) => [...path, node]);
    rowsRef.current = [];
    setNodes([]);
    setNextCursor(null);
    setError(null);
    setHasLoaded(false);
    setLoading(null);
    void fetchPage(node.id, null, "initial");
  };
  const goToCrumb = (index: number) => {
    const path = scopePath.slice(0, index + 1);
    const target = path.at(-1) ?? null;
    version.current += 1;
    setScopePath(path);
    setScopeId(target?.id ?? null);
    rowsRef.current = [];
    setNodes([]);
    setNextCursor(null);
    setError(null);
    setHasLoaded(false);
    setLoading(null);
    void fetchPage(target?.id ?? null, null, "initial");
  };
  const openProperty = (id: string) => {
    if (locked) return;
    const href = propertyWorkspaceUrl(window.location.href, id);
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return <>
    <button ref={triggerRef} className="portfolio-trigger" type="button" disabled={locked} aria-haspopup="dialog" aria-expanded={open} onClick={show} aria-label={`Choose another authorized property. Current property: ${propertyName}`}>
      <span aria-hidden="true">▦</span><span>Portfolio</span>
    </button>
    {open && typeof document !== "undefined" ? createPortal(<div ref={portalRef} className="portfolio-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialogRef} className="portfolio-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-title" aria-describedby="portfolio-description">
        <header className="portfolio-dialog-header">
          <div><p className="portfolio-eyebrow">YOUR PORTFOLIO</p><h2 id="portfolio-title">Portfolio</h2><p id="portfolio-description">Browse the properties and groups available to you. Opening a property starts a separate workspace tab and keeps this work in place.</p></div>
          <button ref={closeRef} className="portfolio-close" type="button" onClick={() => setOpen(false)} aria-label="Close portfolio">×</button>
        </header>
        <div className="portfolio-current"><span>Current workspace</span><strong>{propertyName}</strong></div>
        <nav className="portfolio-breadcrumbs" aria-label="Portfolio location">
          <button type="button" aria-current={scopePath.length === 0 ? "location" : undefined} onClick={() => goToCrumb(-1)}>All authorized scopes</button>
          {scopePath.map((crumb, index) => <span key={crumb.id} className="portfolio-crumb"><span aria-hidden="true">›</span><button type="button" aria-current={index === scopePath.length - 1 ? "location" : undefined} onClick={() => goToCrumb(index)}>{crumb.name}</button></span>)}
        </nav>
        <div className="portfolio-actions"><span>{nodes.length ? `${nodes.length} shown` : "Authorized scopes"}</span><button type="button" onClick={reload} disabled={loading !== null}>Reload access</button></div>
        <div className="portfolio-results" aria-live="polite" aria-busy={loading !== null}>
          {loading === "initial" ? <p className="portfolio-state" role="status">Loading authorized scopes…</p> : null}
          {error ? <div className="portfolio-state portfolio-error" role="alert"><p>{error}</p><button type="button" onClick={reload}>Retry</button></div> : null}
          {!loading && !error && nodes.length === 0 ? <p className="portfolio-state">No authorized scopes are available here.</p> : null}
          {nodes.map((node) => node.kind === "property" ? <button key={node.id} type="button" className="portfolio-row portfolio-property" onClick={() => openProperty(node.id)} disabled={locked}>
            <span className="portfolio-node-icon" aria-hidden="true">⌂</span><span className="portfolio-node-copy"><strong>{node.name}</strong><small>{kindLabel[node.kind]}{node.timezone ? ` · ${node.timezone}` : ""}{node.currency ? ` · ${node.currency}` : ""}</small></span><span className="portfolio-count">Open in new tab</span><span aria-hidden="true">↗</span>
          </button> : <button key={node.id} type="button" className="portfolio-row" onClick={() => enterScope(node)}>
            <span className="portfolio-node-icon" aria-hidden="true">⌑</span><span className="portfolio-node-copy"><strong>{node.name}</strong><small>{kindLabel[node.kind]}</small></span><span className="portfolio-count">{node.authorizedPropertyCount} {node.authorizedPropertyCount === 1 ? "property" : "properties"}</span><span aria-hidden="true">›</span>
          </button>)}
          {loading === "more" ? <p className="portfolio-state" role="status">Loading more…</p> : null}
        </div>
        {nextCursor && !error ? <button className="portfolio-load-more" type="button" disabled={loading !== null} onClick={() => void fetchPage(scopeId, nextCursor, "more")}>Load more authorized scopes</button> : null}
        <footer className="portfolio-dialog-footer">Only properties you can access are shown.</footer>
      </section>
    </div>, document.body) : null}
  </>;
}
