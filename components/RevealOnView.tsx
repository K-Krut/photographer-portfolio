"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function RevealOnView({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.dataset.reveal = "waiting";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete element.dataset.reveal;
    };
  }, []);

  return (
    <div ref={ref} data-reveal-on-view className={className}>
      <div className="transition-[opacity,translate] duration-700 in-data-[reveal=waiting]:translate-y-4 in-data-[reveal=waiting]:opacity-0">
        {children}
      </div>
    </div>
  );
}
