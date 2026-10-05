import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import "./movement-ribbon.css";

export type RibbonItem<Key extends string> = Readonly<{
  key: Key;
  label: string;
  icon?: string;
  count?: number | null;
}>;

/** Transient visual feedback never becomes the committed tab selection. */
export function ribbonPreviewKey<Key extends string>(
  items: readonly RibbonItem<Key>[], value: Key, hover: Key | null, focus: Key | null,
): Key {
  return [hover, focus].find((key): key is Key => key !== null && items.some((item) => item.key === key)) ?? value;
}

export function SegmentedRibbon<Key extends string>({
  label,
  items,
  value,
  onChange,
  layered = false,
  collapsedLabel,
  defaultExpanded = true,
  contentId,
}: Readonly<{
  label: string;
  items: readonly RibbonItem<Key>[];
  value: Key;
  onChange: (value: Key) => void;
  layered?: boolean;
  collapsedLabel?: string;
  defaultExpanded?: boolean;
  contentId?: string;
}>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const disclosureRef = useRef<HTMLButtonElement | null>(null);
  const refs = useRef(new Map<Key, HTMLButtonElement>());
  const generatedId = useId();
  const panelId = `segmented-ribbon-panel-${generatedId}`;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [hoverKey, setHoverKey] = useState<Key | null>(null);
  const [focusKey, setFocusKey] = useState<Key | null>(null);
  const expanded = collapsedLabel === undefined || isExpanded;
  const previewKey = ribbonPreviewKey(items, value, hoverKey, focusKey);

  useEffect(() => { setHoverKey(null); setFocusKey(null); }, [value, expanded]);

  const reveal = (key: Key) => {
    const selected = refs.current.get(key);
    const scroller = scrollerRef.current;
    if (!selected || !scroller) return;
    scroller.scrollTo({
      left: selected.offsetLeft - (scroller.clientWidth - selected.offsetWidth) / 2,
      // Reveal immediately; native focus scrolling must not race a second smooth scroll.
      behavior: "auto",
    });
  };

  useEffect(() => {
    if (expanded) reveal(value);
  }, [value, expanded]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const selected = refs.current.get(previewKey);
    const indicator = indicatorRef.current;
    if (!expanded || !rail || !selected || !indicator) {
      if (indicator) indicator.style.opacity = "0";
      return;
    }

    const measure = () => {
      // Layout coordinates share the indicator's offset parent. Screen rectangles
      // include borders and transient pressed/ancestor transforms, causing drift.
      indicator.style.top = `${selected.offsetTop}px`;
      indicator.style.left = "0px";
      indicator.style.width = `${selected.offsetWidth}px`;
      indicator.style.height = `${selected.offsetHeight}px`;
      indicator.style.transform = `translate3d(${selected.offsetLeft}px, 0, 0)`;
      indicator.style.opacity = "1";
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    observer.observe(selected);
    return () => observer.disconnect();
  }, [previewKey, items, expanded]);

  const move = (direction: -1 | 1) => {
    const current = items.findIndex((item) => item.key === value);
    const next = items[(current + direction + items.length) % items.length];
    if (!next) return;
    onChange(next.key);
    requestAnimationFrame(() => {
      refs.current.get(next.key)?.focus({ preventScroll: true });
      reveal(next.key);
    });
  };
  const selectAt = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.key);
    requestAnimationFrame(() => {
      refs.current.get(item.key)?.focus({ preventScroll: true });
      reveal(item.key);
    });
  };
  const collapse = () => {
    setIsExpanded(false);
    disclosureRef.current?.focus();
  };

  return (
    <div className={`segmented-ribbon-scroll${layered ? " is-layered" : ""}`}>
      {layered ? (
        <>
          <span className="segmented-ribbon-depth segmented-ribbon-depth-one" aria-hidden="true" />
          <span className="segmented-ribbon-depth segmented-ribbon-depth-two" aria-hidden="true" />
        </>
      ) : null}
      {collapsedLabel !== undefined ? (
        <button
          ref={disclosureRef}
          type="button"
          className="segmented-ribbon-disclosure"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${label}: ${items.find((item) => item.key === value)?.label ?? "selected view"}`}
          onClick={() => expanded ? collapse() : setIsExpanded(true)}
        >
          <span>{collapsedLabel}</span>
          <strong>{items.find((item) => item.key === value)?.label}</strong>
          <svg className="segmented-ribbon-disclosure-icon" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={expanded ? "m6 12 4-4 4 4" : "m8 6 4 4-4 4"} /></svg>
        </button>
      ) : null}
      <div
        ref={scrollerRef}
        id={panelId}
        className="segmented-ribbon-panel"
        hidden={!expanded}
        onKeyDown={(event) => {
          if (event.key === "Escape" && collapsedLabel !== undefined) {
            event.preventDefault();
            collapse();
          }
        }}
      >
        <div className="segmented-ribbon" role="tablist" aria-label={label} ref={railRef}
          data-preview-key={previewKey}
          onPointerLeave={() => setHoverKey(null)}
          onPointerCancel={() => setHoverKey(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocusKey(null);
          }}
        >
          <span ref={indicatorRef} className="segmented-ribbon-indicator" aria-hidden="true" />
          {items.map((item) => (
            <button
              key={item.key}
              ref={(node) => {
                if (node) refs.current.set(item.key, node);
                else refs.current.delete(item.key);
              }}
              type="button"
              role="tab"
              aria-selected={item.key === value}
              aria-controls={contentId}
              tabIndex={item.key === value ? 0 : -1}
              className={item.key === value ? "is-selected" : undefined}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") setHoverKey(item.key);
              }}
              onFocus={() => setFocusKey(item.key)}
              onClick={() => onChange(item.key)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  selectAt(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  selectAt(items.length - 1);
                }
              }}
            >
              {item.icon ? <span className="ribbon-icon" aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
              {typeof item.count === "number" ? <small>{item.count}</small> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
