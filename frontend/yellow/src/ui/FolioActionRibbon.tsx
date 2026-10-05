import { Children, createContext, isValidElement, useContext, useId, useState, type ReactNode } from "react";

type ActionProps = Readonly<{ title: string; description: string; locked?: boolean; children: ReactNode }>;
type RibbonContext = Readonly<{ selected: string | null; disabled: boolean; prefix: string; toggle: (title: string) => void }>;
const Context = createContext<RibbonContext | null>(null);

export function BillingIcon({ kind }: Readonly<{ kind: "search" | "charge" | "split" | "account" | "deposit" | "reservation" | "edit" | "correction" }>) {
  return <svg className="billing-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>}
    {kind === "charge" && <path d="M12 5v14M5 12h14" />}
    {kind === "split" && <><path d="M4 8h16l-4-4M20 16H4l4 4" /><path d="m16 12 4-4M8 12l-4 4" /></>}
    {kind === "account" && <><path d="M5 21V5l7-3 7 3v16M3 21h18M10 21v-5h4v5" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01" /></>}
    {kind === "deposit" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>}
    {kind === "reservation" && <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 11h16m-10 5 2 2 4-4" /></>}
    {kind === "edit" && <><path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z" /></>}
    {kind === "correction" && <><path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" /></>}
  </svg>;
}

function iconFor(title: string) {
  if (title === "Split bill windows") return "split";
  if (title === "Direct billing") return "account";
  if (title === "Deposits") return "deposit";
  if (title === "Corrections") return "correction";
  return "charge";
}
const actionKey = (title: string) => title.toLowerCase().replaceAll(" ", "-");

/** Disclosure only. Hidden commands stay mounted; locked recovery is always visible. */
export function FolioActionRibbon({ children, disabled = false }: Readonly<{ children: ReactNode; disabled?: boolean }>) {
  const [selected, setSelected] = useState<string | null>(null);
  const prefix = useId();
  const actions = Children.toArray(children).filter(isValidElement<ActionProps>);
  const navigationLocked = disabled || actions.some(action => action.props.locked);
  const toggle = (title: string) => {
    if (!navigationLocked) setSelected(current => current === title ? null : title);
  };
  return <Context.Provider value={{ selected, disabled: navigationLocked, prefix, toggle }}>
    <div className="folio-action-ribbon" role="group" aria-label="Bill actions">
      {actions.map(action => {
        const { title, description, locked } = action.props;
        const expanded = selected === title || Boolean(locked);
        return <button type="button" key={title} title={description} aria-label={title}
          aria-expanded={expanded} aria-controls={`${prefix}-${actionKey(title)}`}
          disabled={navigationLocked} className={expanded ? "active" : undefined} onClick={() => toggle(title)}>
          <BillingIcon kind={iconFor(title)} /><span>{title === "Split bill windows" ? "Split bill" : title}</span>
        </button>;
      })}
    </div>
    {children}
  </Context.Provider>;
}

export function FolioActionPanel({ title, description, locked = false, children }: ActionProps) {
  const context = useContext(Context);
  if (!context) throw new Error("Folio actions require their shared ribbon.");
  const expanded = context.selected === title;
  const open = expanded || locked;
  const id = `${context.prefix}-${actionKey(title)}`;
  return <section className="folio-action-panel" hidden={!open} aria-label={title}>
    <h3><button type="button" aria-expanded={open} aria-controls={id} disabled={locked || context.disabled}
      onClick={() => context.toggle(title)}>
      <span><strong>{title}</strong><small>{description}</small></span>
      <svg className="billing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
    </button></h3>
    <div id={id} hidden={!open} className="folio-action-content">{children}</div>
  </section>;
}
