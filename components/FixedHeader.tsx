"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FixedHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--header-height", `${header.offsetHeight}px`);
    });
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--header-height");
    };
  }, []);

  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-40 bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] [view-transition-name:site-header] before:absolute before:inset-x-0 before:bottom-full before:h-screen before:bg-background"
    >
      {children}
    </header>
  );
}
