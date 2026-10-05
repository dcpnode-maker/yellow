import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function OptionsDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: Readonly<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (!open) { if (drawer.open) drawer.close(); return; }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawer.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab") return;
      const controls = [...(drawerRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? [])];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = previousOverflow;
      if (drawer.open) drawer.close();
      previous?.focus();
    };
  }, [open]);

  return createPortal(
    <dialog ref={drawerRef} className="options-layer" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="options-drawer">
        <header>
          <div>
            <span className="eyebrow">Contextual controls</span>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="drawer-close" onClick={onClose} aria-label="Close options">×</button>
        </header>
        <div className="options-drawer-body">{children}</div>
      </section>
    </dialog>,
    document.body,
  );
}
