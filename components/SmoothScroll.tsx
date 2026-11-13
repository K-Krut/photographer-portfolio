"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { anchorScroll, attachLenis, getLenis, takePendingAnchor } from "@/lib/smooth-scroll";

const finePointer = "(hover: hover) and (pointer: fine)";
const motionAllowed = "(prefers-reduced-motion: no-preference)";

export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const pointer = window.matchMedia(finePointer);
    const motion = window.matchMedia(motionAllowed);
    let lenis: Lenis | null = null;

    const update = () => {
      const enabled = pointer.matches && motion.matches;
      if (enabled && !lenis) {
        lenis = new Lenis({ autoRaf: true, lerp: 0.1, stopInertiaOnNavigate: true });
        attachLenis(lenis);
      } else if (!enabled && lenis) {
        lenis.destroy();
        lenis = null;
        attachLenis(null);
      }
    };

    const yieldToNativeScroll = () => {
      if (!lenis || !lenis.isSmooth || lenis.isStopped) return;
      if (Math.abs(window.scrollY - lenis.animatedScroll) <= 2) return;
      lenis.stop();
      lenis.start();
    };

    update();
    pointer.addEventListener("change", update);
    motion.addEventListener("change", update);
    window.addEventListener("scroll", yieldToNativeScroll, { passive: true });
    return () => {
      pointer.removeEventListener("change", update);
      motion.removeEventListener("change", update);
      window.removeEventListener("scroll", yieldToNativeScroll);
      lenis?.destroy();
      attachLenis(null);
    };
  }, []);

  useLayoutEffect(() => {
    const lenis = getLenis();
    const anchor = takePendingAnchor();
    if (!lenis || lenis.isStopped) return;
    lenis.stop();
    lenis.start();
    if (!anchor) return;
    let frame = 0;
    let attempts = 0;
    const glide = () => {
      const target = document.getElementById(anchor);
      if (!target) {
        attempts += 1;
        if (attempts < 120) frame = requestAnimationFrame(glide);
        return;
      }
      lenis.resize();
      lenis.scrollTo(0, { immediate: true, force: true });
      lenis.scrollTo(target, anchorScroll);
    };
    glide();
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
