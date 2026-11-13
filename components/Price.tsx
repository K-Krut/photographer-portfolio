import { BookSessionLink } from "./BookSessionLink";
import { RevealOnView } from "./RevealOnView";
import { currency, priceItems, texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

export function Price({ locale }: { locale: Locale }) {
  const { headings, priceConditions } = texts[locale];

  return (
    <section
      id="price"
      aria-labelledby="price-heading"
      className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24"
    >
      <h2
        id="price-heading"
        className="text-xl uppercase tracking-[0.3em] md:text-2xl"
      >
        {headings.price}
      </h2>
      <div className="mt-10 grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <ul className="flex flex-col gap-4 text-lg">
            {priceItems.map((item) => (
              <li key={item.duration.en}>
                {item.duration[locale]} — {item.amount} {currency}
              </li>
            ))}
          </ul>
          <ul className="mt-10 flex flex-col gap-2 text-sm text-muted">
            {priceConditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </div>
        <RevealOnView className="md:justify-self-center">
          <BookSessionLink
            locale={locale}
            className="py-3 text-sm tracking-[0.2em] md:py-5 md:text-xl md:tracking-[0.3em]"
          />
        </RevealOnView>
      </div>
    </section>
  );
}
