import Link from "next/link";
import { Arrow } from "./Arrow";
import { CollectionGrid } from "./CollectionGrid";
import { getFeaturedCategories, texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

export function Portfolio({ locale }: { locale: Locale }) {
  const { headings, viewAll } = texts[locale];
  const featuredCategories = getFeaturedCategories();

  return (
    <section
      id="portfolio"
      aria-labelledby="portfolio-heading"
      className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-4 md:gap-x-8">
        <h2
          id="portfolio-heading"
          className="text-xl uppercase tracking-[0.3em] md:text-2xl"
        >
          {headings.portfolio}
        </h2>
        <Link
          href={`/${locale}/portfolio`}
          data-view-all
          className="group inline-flex items-center gap-3 whitespace-nowrap text-sm uppercase md:text-base tracking-[0.2em] transition-opacity md:gap-4 md:tracking-[0.25em] hover:opacity-60"
        >
          {viewAll}
          <Arrow
            direction="right"
            className="h-[0.9375rem] w-[1.40625rem] md:-my-px md:h-[1.125rem] md:w-[1.6875rem] motion-safe:group-hover:translate-x-1.5 motion-safe:group-focus-visible:translate-x-1.5"
          />
        </Link>
      </div>
      <CollectionGrid
        locale={locale}
        categories={featuredCategories}
        eagerCount={featuredCategories.length}
        heading="h3"
      />
    </section>
  );
}
