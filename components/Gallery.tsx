import type { Category, ViewerLabels } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { BackLink } from "./BackLink";
import { GalleryGrid } from "./GalleryGrid";

export type GalleryLabels = {
  back: string;
  viewer: ViewerLabels;
};

export function Gallery({
  locale,
  category,
  labels,
}: {
  locale: Locale;
  category: Category;
  labels: GalleryLabels;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 pb-10 md:px-10 md:pt-12 md:pb-16">
      <div
        data-gallery-bar
        className="mb-6 flex items-center gap-4 py-4 text-xl md:gap-5 md:text-2xl"
      >
        <BackLink locale={locale} label={labels.back} />
        <h1 className="uppercase tracking-[0.3em]">{category.name[locale]}</h1>
      </div>
      <GalleryGrid
        labels={labels.viewer}
        photos={category.photos.map((photo) => ({
          src: photo.src,
          width: photo.width,
          height: photo.height,
          alt: photo.alt[locale],
        }))}
      />
    </div>
  );
}
