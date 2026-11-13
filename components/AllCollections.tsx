import { BackLink } from "./BackLink";
import { CollectionGrid } from "./CollectionGrid";
import { getCategories, texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

export function AllCollections({ locale }: { locale: Locale }) {
  return (
    <section
      id="collections"
      aria-labelledby="collections-heading"
      className="mx-auto max-w-6xl px-5 pt-10 pb-16 md:px-10 md:pt-16 md:pb-24"
    >
      <div className="flex items-center gap-4 text-xl md:gap-5 md:text-2xl">
        <BackLink locale={locale} label={texts[locale].back} />
        <h1 id="collections-heading" className="uppercase tracking-[0.3em]">
          {texts[locale].headings.portfolio}
        </h1>
      </div>
      <CollectionGrid locale={locale} categories={getCategories()} eagerCount={2} heading="h2" />
    </section>
  );
}
