import type Lenis from "lenis";
import { scroller } from "./scroller";

let instance: Lenis | null = null;
let locks = 0;
let pendingAnchor: string | null = null;

export const anchorScroll = {
  duration: 1.1,
  easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

export const revealScroll = {
  duration: 1.4,
  easing: (t: number) => (1 - Math.cos(Math.PI * t)) / 2,
};

export function attachLenis(lenis: Lenis | null) {
  instance = lenis;
  if (lenis && locks > 0) lenis.stop();
}

export function getLenis() {
  return instance;
}

export function lockScroll() {
  const root = scroller();
  locks += 1;
  instance?.stop();
  if (locks === 1) {
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "stable";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks > 0) return;
    root.style.removeProperty("overflow");
    root.style.removeProperty("scrollbar-gutter");
    instance?.start();
  };
}

export function setPendingAnchor(id: string | null) {
  pendingAnchor = id;
}

export function takePendingAnchor() {
  const id = pendingAnchor;
  pendingAnchor = null;
  return id;
}

export function revealElement(target: HTMLElement, block: "start" | "center" = "start") {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lenis = getLenis();
  if (!lenis || reduced || lenis.isStopped) {
    target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block });
    return;
  }
  lenis.resize();
  if (block === "start") {
    lenis.scrollTo(target, revealScroll);
    return;
  }
  const rect = target.getBoundingClientRect();
  lenis.scrollTo(lenis.scroll + rect.top - (window.innerHeight - rect.height) / 2, revealScroll);
}
