"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { keyboardUsed } from "@/lib/input-modality";
import { maxScrollTop, scrollToTop } from "@/lib/scroller";
import { recordVisit, rememberedScroll, rememberScroll } from "@/lib/site-history";
import { getLenis } from "@/lib/smooth-scroll";

function restoreScroll(top: number) {
  scrollToTop(top);
  const lenis = getLenis();
  lenis?.resize();
  lenis?.scrollTo(top, { immediate: true, force: true });
}

function focusQuietly(element: HTMLElement) {
  element.dataset.quietFocus = "";
  element.addEventListener("blur", () => delete element.dataset.quietFocus, { once: true });
  element.focus({ preventScroll: true });
}

function fitsPage(top: number) {
  return maxScrollTop() >= top;
}

export function NavigationHistory() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const traversedAt = useRef(-Infinity);

  useEffect(() => {
    const onPopState = () => {
      traversedAt.current = performance.now();
    };
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) rememberScroll();
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    recordVisit();
    const from = previous.current;
    previous.current = pathname;
    if (!from) return;
    let frame = 0;
    const timer = window.setTimeout(() => {
      if (performance.now() - traversedAt.current > 2000) return;
      traversedAt.current = -Infinity;
      const links = document.querySelectorAll<HTMLElement>(`main a[href="${CSS.escape(from)}"]`);
      const link = [...links].find((candidate) => candidate.checkVisibility());
      if (link && keyboardUsed()) link.focus({ preventScroll: true });
      else if (link) focusQuietly(link);
      const top = rememberedScroll();
      if (top === undefined) return;
      let attempts = 0;
      const apply = () => {
        if (!fitsPage(top) && attempts < 60) {
          attempts += 1;
          frame = requestAnimationFrame(apply);
          return;
        }
        restoreScroll(top);
      };
      apply();
    });
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
