"use client";

import { notFound, useParams } from "next/navigation";
import type { Category } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { Gallery, type GalleryLabels } from "./Gallery";

export function CollectionGallery({
  locale,
  categories,
  labels,
}: {
  locale: Locale;
  categories: readonly Category[];
  labels: GalleryLabels;
}) {
  const { category: slug } = useParams<{ category: string }>();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return <Gallery locale={locale} category={category} labels={labels} />;
}
