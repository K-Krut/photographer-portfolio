import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/content";
import { locales } from "@/lib/i18n";
import {
  absoluteUrl,
  allCollectionsPath,
  bookingPath,
  collectionPath,
  languageAlternates,
  localizedPath,
} from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    allCollectionsPath,
    bookingPath,
    ...getCategories().map(collectionPath),
  ];
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, path)),
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
