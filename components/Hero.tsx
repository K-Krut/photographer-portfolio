import { BookSessionLink } from "./BookSessionLink";
import { SkeletonImage } from "./SkeletonImage";
import { portrait, site, texts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

export function Hero({ locale }: { locale: Locale }) {
  const { role, bio } = texts[locale];

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-5 pt-5 pb-12 md:grid-cols-2 md:items-center md:gap-16 md:px-10 md:pt-[calc(6rem-var(--header-height))] md:pb-24"
    >
      <SkeletonImage
        src={portrait.src}
        width={portrait.width}
        height={portrait.height}
        alt={portrait.alt[locale]}
        preload
        sizes="(min-width: 768px) 50vw, 100vw"
        frameClassName="relative w-full"
        frameStyle={{ aspectRatio: "4 / 5" }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-4xl uppercase tracking-[0.2em] md:text-6xl">
            {site.name}
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-muted">
            {role}
          </p>
        </div>
        <p className="max-w-prose leading-relaxed">{bio}</p>
        <BookSessionLink
          locale={locale}
          className="self-start py-3 text-sm tracking-[0.2em] md:text-base md:tracking-[0.25em]"
        />
      </div>
    </section>
  );
}
