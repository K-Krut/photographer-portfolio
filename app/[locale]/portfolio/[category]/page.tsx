import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { CollectionGallery } from "@/components/CollectionGallery";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { getCategories, getCategory, texts } from "@/lib/content";
import { isLocale } from "@/lib/i18n";
import { collectionMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/portfolio/[category]">): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const category = getCategory(slug);
  if (!isLocale(locale) || !category) notFound();
  return collectionMetadata(locale, category);
}

async function UrlDataMarker({
  params,
}: Pick<PageProps<"/[locale]/portfolio/[category]">, "params">) {
  await params;
  return null;
}

export default async function CollectionPage({
  params,
}: PageProps<"/[locale]/portfolio/[category]">) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();

  return (
    <PageTransition>
      <main>
        <CollectionGallery
          locale={locale}
          categories={getCategories()}
          labels={{ back: texts[locale].back, viewer: texts[locale].viewer }}
        />
      </main>
      <Footer locale={locale} />
      <Suspense>
        <UrlDataMarker params={params} />
      </Suspense>
    </PageTransition>
  );
}
