import type { Metadata } from "next";
import {
  type Category,
  currency,
  ogImage,
  type Photo,
  priceItems,
  site,
  texts,
} from "./content";
import { defaultLocale, type Locale, locales } from "./i18n";
import { phoneNumber } from "./phone";

const openGraphLocales: Record<Locale, string> = {
  en: "en_US",
  pl: "pl_PL",
};

export function localizedPath(locale: Locale, path = ""): string {
  return `/${locale}${path}`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

export function languageAlternates(path = ""): Record<string, string> {
  return {
    ...Object.fromEntries(
      locales.map((locale) => [locale, absoluteUrl(localizedPath(locale, path))]),
    ),
    "x-default": absoluteUrl(localizedPath(defaultLocale, path)),
  };
}

function pageMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  image: Photo,
): Metadata {
  const url = absoluteUrl(localizedPath(locale, path));
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: site.name,
      locale: openGraphLocales[locale],
      alternateLocale: locales
        .filter((other) => other !== locale)
        .map((other) => openGraphLocales[other]),
      images: [
        {
          url: absoluteUrl(image.src),
          width: image.width,
          height: image.height,
          alt: image.alt[locale],
        },
      ],
    },
  };
}

export function landingMetadata(locale: Locale): Metadata {
  const { title, description } = texts[locale].meta;
  return pageMetadata(locale, "", title, description, ogImage);
}

export const allCollectionsPath = "/portfolio";

export function allCollectionsMetadata(locale: Locale): Metadata {
  const { portfolioTitle, portfolioDescription } = texts[locale].meta;
  return pageMetadata(
    locale,
    allCollectionsPath,
    portfolioTitle,
    portfolioDescription,
    ogImage,
  );
}

export const bookingPath = "/booking";

export function bookingMetadata(locale: Locale): Metadata {
  const { bookingTitle, bookingDescription } = texts[locale].meta;
  return pageMetadata(
    locale,
    bookingPath,
    bookingTitle,
    bookingDescription,
    ogImage,
  );
}

export function collectionPath(category: Category): string {
  return `${allCollectionsPath}/${category.slug}`;
}

export function collectionMetadata(locale: Locale, category: Category): Metadata {
  const { galleryTitle, galleryDescription } = texts[locale].meta;
  const name = category.name[locale];
  return pageMetadata(
    locale,
    collectionPath(category),
    galleryTitle(name),
    category.description?.[locale] ?? galleryDescription(name),
    category.cover,
  );
}

export function businessJsonLd(locale: Locale) {
  const amounts = priceItems.map((item) => item.amount);
  const telephone = phoneNumber(site.phone);
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${absoluteUrl("/")}#business`,
    name: site.name,
    description: texts[locale].meta.description,
    url: absoluteUrl(localizedPath(locale)),
    image: absoluteUrl(ogImage.src),
    email: site.email,
    ...(telephone && { telephone }),
    address: {
      "@type": "PostalAddress",
      addressLocality: site.city[locale],
      addressCountry: "PL",
    },
    areaServed: [
      { "@type": "City", name: site.city[locale] },
      { "@type": "Country", name: site.country[locale] },
    ],
    sameAs: site.socials.map((social) => social.href),
    priceRange: `${Math.min(...amounts)}–${Math.max(...amounts)} ${currency}`,
    currenciesAccepted: currency,
  };
}
