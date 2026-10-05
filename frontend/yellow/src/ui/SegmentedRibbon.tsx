import { useEffect, useRef } from "react";

export type RibbonItem<Key extends string> = Readonly<{
  key: Key;
  label: string;
  icon?: string;
  count?: number | null;
}>;

export function SegmentedRibbon<Key extends string>({
  label,
  items,
  value,
  onChange,
  layered = false,
}: Readonly<{
  label: string;
  items: readonly RibbonItem<Key>[];
  value: Key;
  onChange: (value: Key) => void;
  layered?: boolean;
}>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef(new Map<Key, HTMLButtonElement>());

  const reveal = (key: Key) => {
    const selected = refs.current.get(key);
    const scroller = scrollerRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!selected || !scroller) return;
    scroller.scrollTo({
      left: selected.offsetLeft - (scroller.clientWidth - selected.offsetWidth) / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    reveal(value);
  }, [value]);

  const move = (direction: -1 | 1) => {
    const current = items.findIndex((item) => item.key === value);
    const next = items[(current + direction + items.length) % items.length];
    if (!next) return;
    onChange(next.key);
    requestAnimationFrame(() => {
      refs.current.get(next.key)?.focus();
      reveal(next.key);
    });
  };
  const selectAt = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.key);
    requestAnimationFrame(() => {
      refs.current.get(item.key)?.focus();
      reveal(item.key);
    });
  };

  return (
    <div ref={scrollerRef} className={`segmented-ribbon-scroll${layered ? " is-layered" : ""}`}>
      {layered ? (
        <>
          <span className="segmented-ribbon-depth segmented-ribbon-depth-one" aria-hidden="true" />
          <span className="segmented-ribbon-depth segmented-ribbon-depth-two" aria-hidden="true" />
        </>
      ) : null}
      <div className="segmented-ribbon" role="tablist" aria-label={label}>
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
            tabIndex={item.key === value ? 0 : -1}
            className={item.key === value ? "is-selected" : undefined}
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
  );
}
