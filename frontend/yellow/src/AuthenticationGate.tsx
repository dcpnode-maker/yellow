import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { AuthenticationError, grantedPropertyRoute, reactAuthSession, requestedGrantedRoute, type AuthSessionAccess } from "./auth-session";
import "./authentication.css";

type GateLocation = Readonly<{ pathname: string; search: string; replace: (href: string) => void }>;
function browserLocation(): GateLocation {
  return typeof window === "undefined" ? { pathname: "/", search: "", replace() {} } : {
    pathname: window.location.pathname, search: window.location.search,
    replace: href => window.history.replaceState(null, "", href),
  };
}
export function AuthenticationGate({ children, auth = reactAuthSession, location = browserLocation() }: {
  children: ReactNode; auth?: AuthSessionAccess; location?: GateLocation;
}) {
  const snapshot = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
  const [workspaceEntered, setWorkspaceEntered] = useState(() => snapshot.principal !== null &&
    requestedGrantedRoute(location.pathname, location.search, snapshot.properties) !== null);
  const [renewing, setRenewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(snapshot.principal === null);
  const initialLocation = useRef(location);
  useEffect(() => {
    let active = true;
    const target = initialLocation.current;
    const property = /^\/p\/([^/]+)/.exec(target.pathname)?.[1];
    void auth.bootstrap(property).then(accepted => {
      if (active && accepted.status === "authenticated" && requestedGrantedRoute(target.pathname, target.search, accepted.properties)) {
        setWorkspaceEntered(true);
      }
    }).catch(error => {
      if (active) setMessage(error instanceof AuthenticationError ? error.message : "Session restoration is unavailable. Sign in to continue.");
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [auth]);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  const locked = snapshot.status !== "authenticated" || renewing || !workspaceEntered;
  const signInVisible = snapshot.status !== "authenticated" || renewing;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || restoring) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const passwordInput = form.elements.namedItem("password");
    const currentProperty = /^\/p\/([^/]+)/.exec(location.pathname)?.[1];
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const accepted = await auth.signIn({ tenant: String(fields.get("tenant") ?? ""),
        email: String(fields.get("email") ?? ""), password: String(fields.get("password") ?? "") },
      workspaceEntered ? currentProperty : undefined);
      const route = requestedGrantedRoute(location.pathname, location.search, accepted.properties);
      if (route !== null) setWorkspaceEntered(true);
      setRenewing(false);
    } catch (error) {
      setMessage(error instanceof AuthenticationError ? error.message : "Sign-in is unavailable. Try again.");
    } finally {
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
      submitting.current = false;
      setBusy(false);
    }
  }
  async function signOut() {
    setMessage(""); setBusy(true);
    try { await auth.logout(); }
    catch (error) { setMessage(error instanceof AuthenticationError ? error.message : "Server sign-out could not be confirmed. Try again."); }
    finally { setBusy(false); }
  }
  function chooseProperty(id: string) {
    location.replace(grantedPropertyRoute(id, snapshot.properties));
    setWorkspaceEntered(true);
  }

  if (restoring) return <div className="auth-screen auth-opening" role="status" aria-live="polite">
    <section className="auth-card">
      <span className="auth-brand">YELLOW</span>
      <p>Opening Yellow…</p>
    </section>
  </div>;

  return <>
    {workspaceEntered ? <div className="auth-workspace" inert={locked ? true : undefined} aria-hidden={locked ? true : undefined}>
      {children}
    </div> : null}
    {!locked ? <div className="auth-session-control">
      <span>{snapshot.principal?.displayName}</span>
      <button type="button" data-lifecycle-recovery="true" data-property-mode-recovery="true" onClick={() => { setMessage(""); setRenewing(true); }}>Sign in again</button>
      <button type="button" data-lifecycle-recovery="true" data-property-mode-recovery="true" onClick={() => void signOut()}>Sign out</button>
    </div> : <div className="auth-screen" role={workspaceEntered ? "dialog" : undefined}
      aria-modal={workspaceEntered ? true : undefined} aria-labelledby="auth-title">
      <section className="auth-card" data-lifecycle-recovery="true" data-property-mode-recovery="true">
        <span className="auth-brand">YELLOW</span>
        <h1 id="auth-title">{signInVisible ? workspaceEntered ? "Continue your session" : "Sign in" : "Choose a property"}</h1>
        {signInVisible ? <>
          <p>{workspaceEntered ? "Use the same account to continue. Your current work is retained." : "Use your tenant, email and password to open your granted properties."}</p>
          <form onSubmit={event => void submit(event)} aria-busy={busy || restoring}>
            <label htmlFor="auth-tenant">Tenant</label>
            <input id="auth-tenant" name="tenant" autoComplete="organization" required disabled={busy || restoring} />
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" name="email" type="email" autoComplete="username" required disabled={busy || restoring} />
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" name="password" type="password" autoComplete="current-password" required disabled={busy || restoring} />
            {message ? <p className="auth-error" role="alert">{message}</p> : null}
            <button type="submit" disabled={busy || restoring}>{restoring ? "Restoring session…" : busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </> : <div className="auth-properties">
          {snapshot.properties.map(property => <button type="button" key={property.id} onClick={() => chooseProperty(property.id)}>
            <strong>{property.name}</strong><small>{property.timezone}</small>
          </button>)}
        </div>}
        <p className="auth-preview-note">Your session expires after its original sign-in period. Sign in again to renew it.</p>
      </section>
    </div>}
  </>;
}
