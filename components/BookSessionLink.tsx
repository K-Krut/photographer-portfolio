import Link from "next/link";
import { Arrow } from "./Arrow";
import { texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { bookingPath } from "@/lib/seo";

export function BookSessionLink({
  locale,
  className = "",
}: {
  locale: Locale;
  className?: string;
}) {
  return (
    <Link
      href={`/${locale}${bookingPath}`}
      data-book-session
      className={`group inline-flex min-h-11 items-center gap-3 whitespace-nowrap uppercase transition-opacity can-hover:hover:opacity-60 md:gap-4 ${className}`}
    >
      {texts[locale].booking.bookSession}
      <Arrow
        direction="right"
        className="h-[1em] w-[1.5em] motion-safe:group-hover:translate-x-1.5 motion-safe:group-focus-visible:translate-x-1.5 in-data-[reveal=shown]:animate-nudge"
      />
    </Link>
  );
}
