import { useLayoutEffect, useRef, type ReactNode } from "react";

export function RibbonPanel({
  id,
  transitionKey,
  className,
  children,
}: Readonly<{
  id?: string;
  transitionKey: string | number;
  className?: string;
  children: ReactNode;
}>) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstTransition = useRef(true);
  const animationRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (firstTransition.current) {
      firstTransition.current = false;
      return;
    }
    animationRef.current?.cancel();
    animationRef.current = null;
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof panel.animate !== "function") return;

    const animation = panel.animate(
      [{ opacity: 0.48 }, { opacity: 1 }],
      { duration: 170, easing: "ease-out" },
    );
    animationRef.current = animation;
    return () => {
      animation.cancel();
      if (animationRef.current === animation) animationRef.current = null;
    };
  }, [transitionKey]);

  useLayoutEffect(() => () => {
    animationRef.current?.cancel();
    animationRef.current = null;
  }, []);

  return <div ref={panelRef} id={id} className={`ribbon-panel${className ? ` ${className}` : ""}`}>{children}</div>;
}
