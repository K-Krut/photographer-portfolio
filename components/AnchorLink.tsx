"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { anchorScroll, getLenis, setPendingAnchor } from "@/lib/smooth-scroll";

export function AnchorLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const router = useRouter();

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const lenis = getLenis();
        const plainClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;
        if (event.defaultPrevented || !plainClick || !lenis) return;
        const url = new URL(href, window.location.href);
        const id = decodeURIComponent(url.hash.slice(1));
        if (!id) return;
        event.preventDefault();
        if (url.pathname === window.location.pathname) {
          const target = document.getElementById(id);
          if (url.href !== window.location.href) history.pushState(null, "", url.href);
          if (target) lenis.scrollTo(target, anchorScroll);
          return;
        }
        setPendingAnchor(id);
        router.push(url.pathname + url.search + url.hash, { scroll: false });
      }}
    />
  );
}
