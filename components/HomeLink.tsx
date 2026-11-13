"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { scroller } from "@/lib/scroller";
import { anchorScroll, getLenis } from "@/lib/smooth-scroll";

export function HomeLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const pathname = usePathname();

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const plainClick =
          event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
        if (event.defaultPrevented || !plainClick || pathname !== href) return;
        event.preventDefault();
        if (window.location.hash) history.replaceState(null, "", href);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const lenis = getLenis();
        if (lenis && !lenis.isStopped && !reduced) {
          lenis.scrollTo(0, anchorScroll);
          return;
        }
        scroller().scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
      }}
    />
  );
}
