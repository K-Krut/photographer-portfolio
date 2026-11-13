import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AllCollections } from "@/components/AllCollections";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { isLocale } from "@/lib/i18n";
import { allCollectionsMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/portfolio">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return allCollectionsMetadata(locale);
}

export default async function AllCollectionsPage({
  params,
}: PageProps<"/[locale]/portfolio">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <PageTransition>
      <main>
        <AllCollections locale={locale} />
      </main>
      <Footer locale={locale} />
    </PageTransition>
  );
}
