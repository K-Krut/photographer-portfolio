"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { cameFromSite } from "@/lib/site-history";
import { AnchorLink } from "./AnchorLink";
import { Arrow } from "./Arrow";

export function BackLink({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  return (
    <AnchorLink
      href={`/${locale}#portfolio`}
      aria-label={label}
      data-back-link
      className="group -m-1 inline-flex shrink-0 items-center p-1 transition-opacity hover:opacity-60"
      onClick={(event) => {
        const plainClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;
        if (!plainClick || !cameFromSite()) return;
        event.preventDefault();
        router.back();
      }}
    >
      <Arrow
        direction="left"
        className="h-[0.75em] w-[1.125em] motion-safe:group-hover:-translate-x-1.5 motion-safe:group-focus-visible:-translate-x-1.5"
      />
    </AnchorLink>
  );
}
