import Image from "next/image";
import Link from "next/link";
import { SkeletonImage } from "./SkeletonImage";
import { texts, type Category } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

const coverSizes = "(min-width: 1152px) 512px, (min-width: 768px) 45vw, 100vw";

const fanPositions = [
  "fan-open:-translate-x-2 fan-open:-translate-y-5 fan-open:-rotate-3",
  "fan-open:translate-x-2 fan-open:-translate-y-4 fan-open:rotate-3",
  "fan-open:-translate-y-7 fan-open:rotate-1",
];

export function CollectionGrid({
  locale,
  categories,
  eagerCount,
  heading: Heading,
}: {
  locale: Locale;
  categories: readonly Category[];
  eagerCount: number;
  heading: "h2" | "h3";
}) {
  const { photoCount } = texts[locale];

  return (
    <ul className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
      {categories.map((category, position) => {
        const fan = category.photos
          .filter((photo) => photo.src !== category.cover.src)
          .slice(0, fanPositions.length);

        return (
          <li key={category.slug}>
            <Link
              href={`/${locale}/portfolio/${category.slug}`}
              prefetch
              data-collection-card
              className="group block outline-offset-8"
            >
              <div className="relative aspect-3/2">
                <div aria-hidden="true" data-fan className="hidden can-hover:block">
                  {fan.map((photo, index) => (
                    <div
                      key={photo.src}
                      data-fan-photo
                      className={`absolute inset-0 opacity-0 fan-open:scale-90 fan-open:opacity-100 motion-safe:transition-[translate,rotate,scale,opacity] ${fanPositions[index]}`}
                    >
                      <Image
                        src={photo.src}
                        fill
                        alt=""
                        sizes={coverSizes}
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
                <SkeletonImage
                  src={category.cover.src}
                  fill
                  alt={category.cover.alt[locale]}
                  loading={position < eagerCount ? "eager" : "lazy"}
                  sizes={coverSizes}
                  frameClassName="absolute inset-0 z-10"
                  className="z-10 object-cover"
                />
              </div>
              <Heading className="mt-6 text-sm uppercase tracking-[0.25em] underline decoration-transparent underline-offset-4 transition-[text-decoration-color] group-hover:decoration-current">
                {category.name[locale]}
              </Heading>
              <p className="mt-2 text-xs text-muted">
                {photoCount(category.photos.length)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
